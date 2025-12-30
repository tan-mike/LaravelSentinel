package server

import (
	"fmt"
	"net/http"
	"time"

	"github.com/mike/sentinel-agent/pkg/config"
	"github.com/mike/sentinel-agent/pkg/runner"
	"github.com/mike/sentinel-agent/pkg/telemetry"
	"github.com/mike/sentinel-agent/pkg/watchdog"
)

type Server struct {
	Config   *config.Config
	Runner   *runner.Manager
	Store    *telemetry.Store
	Watchdog *watchdog.Watchdog
	Monitor  *telemetry.Monitor
}

func NewServer(cfg *config.Config) *Server {
	return &Server{
		Config:   cfg,
		Runner:   runner.NewManager(),
		Store:    telemetry.NewStore(100),
		Watchdog: watchdog.New(),
		Monitor:  telemetry.NewMonitor(),
	}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	// Defined in handler.go
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/projects", s.handleProjects)
	mux.HandleFunc("/projects/routes", s.handleRoutes)
	mux.HandleFunc("/projects/logs", s.handleLogs)
	mux.HandleFunc("/projects/performance", s.handlePerformance)
	mux.HandleFunc("/projects/performance/clear", s.handlePerformanceClear)
	mux.HandleFunc("/projects/ingest", s.handleIngest) // Direct Telemetry Ingest

	// Runner API
	mux.HandleFunc("/runner/start", s.handleRunnerStart)
	mux.HandleFunc("/runner/stop", s.handleRunnerStop)
	mux.HandleFunc("/runner/status", s.handleRunnerStatus)

	mux.HandleFunc("/telemetry", s.handleTelemetry)
	mux.HandleFunc("/config", s.handleConfig)
	mux.HandleFunc("/restart", s.handleRestart)
	mux.HandleFunc("/proxy", s.handleProxy)
	mux.HandleFunc("/alerts", s.handleAlerts)

	// Start Watchdog Routine
	go s.startWatchdogLoop()

	// Add CORS middleware
	handler := enableCORS(mux)

	addr := fmt.Sprintf("%s:%d", s.Config.Host, s.Config.Port)
	fmt.Printf("Server listening on http://%s\n", addr)
	return http.ListenAndServe(addr, handler)
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow all origins for local dev
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) startWatchdogLoop() {
	// Ticker every 5 seconds to reduce load
	ticker := time.NewTicker(5 * time.Second)
	for range ticker.C {
		stats := s.Monitor.GetSystemStats()

		// Run Check
		if s.Watchdog != nil {
			s.Watchdog.Check(
				stats.PhpFpmCpuPercent,
				s.Config.CpuThreshold,
				s.Config.NginxLogPath,
			)
		}
	}
}
