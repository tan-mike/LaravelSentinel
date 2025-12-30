package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/mike/sentinel-agent/pkg/config"
	"github.com/mike/sentinel-agent/pkg/laravel"
	"github.com/mike/sentinel-agent/pkg/project"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleProjects(w http.ResponseWriter, r *http.Request) {
	ignored := s.Config.IgnoredProjects
	if r.URL.Query().Get("include_ignored") == "true" {
		ignored = nil
	}

	projects, err := project.FindProjects(s.Config.WorkspaceRoot, ignored)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if projects == nil {
		projects = []project.Project{}
	}
	json.NewEncoder(w).Encode(projects)
}

func (s *Server) handleTelemetry(w http.ResponseWriter, r *http.Request) {
	status := s.Monitor.GetStatus()
	json.NewEncoder(w).Encode(status)
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var newConfig config.Config
		if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
			http.Error(w, "Invalid config", http.StatusBadRequest)
			return
		}

		// Update fields
		s.Config.Host = newConfig.Host
		s.Config.Port = newConfig.Port
		s.Config.WorkspaceRoot = newConfig.WorkspaceRoot
		s.Config.IgnoredProjects = newConfig.IgnoredProjects
		s.Config.CpuThreshold = newConfig.CpuThreshold
		s.Config.NginxLogPath = newConfig.NginxLogPath

		if err := s.Config.Save(); err != nil {
			http.Error(w, "Failed to save config", http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "updated", "message": "Config saved. Restart required."})
		return
	}

	// GET - return current config
	json.NewEncoder(w).Encode(s.Config)
}

func (s *Server) handleRestart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Write([]byte(`{"status": "restarting"}`))

	go func() {
		TriggerRestart()
	}()
}

func (s *Server) handleRoutes(w http.ResponseWriter, r *http.Request) {
	projectPath := r.URL.Query().Get("path")
	if projectPath == "" {
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	routes, err := laravel.GetRoutes(projectPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(routes)
}

func (s *Server) handleLogs(w http.ResponseWriter, r *http.Request) {
	projectPath := r.URL.Query().Get("path")
	if projectPath == "" {
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	logs, err := laravel.GetRecentLogs(projectPath, 50) // Default to 50 lines
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(linesWrapper{Lines: logs})
}

type linesWrapper struct {
	Lines []string `json:"lines"`
}

type ProxyRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

func (s *Server) handleProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ProxyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Create request
	proxyReq, err := http.NewRequest(req.Method, req.URL, strings.NewReader(req.Body))
	if err != nil {
		http.Error(w, "Failed to create request: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Add headers
	for k, v := range req.Headers {
		proxyReq.Header.Set(k, v)
	}

	// Execute
	resp, err := http.DefaultClient.Do(proxyReq)
	if err != nil {
		// Return 502 Bad Gateway if connection fails
		http.Error(w, "Request failed: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Copy headers
	for k, v := range resp.Header {
		w.Header()[k] = v
	}
	w.WriteHeader(resp.StatusCode)

	// Copy body
	io.Copy(w, resp.Body)
}

// Runner Handlers
type RunnerStartRequest struct {
	Path      string `json:"path"`
	Port      int    `json:"port"`
	WithQueue bool   `json:"with_queue"`
}

type RunnerStopRequest struct {
	Path string `json:"path"`
}

func (s *Server) handleRunnerStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req RunnerStartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	fmt.Printf("[Server] Received Audit Start Request for %s\n", req.Path)

	if err := s.Runner.EnableAudit(req.Path); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func (s *Server) handleRunnerStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req RunnerStopRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if err := s.Runner.DisableAudit(req.Path); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

func (s *Server) handleRunnerStatus(w http.ResponseWriter, r *http.Request) {
	status := s.Runner.GetStatus()
	json.NewEncoder(w).Encode(status)
}

// Ingest Handler (for Direct Telemetry)
func (s *Server) handleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var entry laravel.PerformanceEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		fmt.Printf("Ingest Decode Error: %v\n", err) // Debug
		http.Error(w, "Invalid metric", http.StatusBadRequest)
		return
	}

	// Add to in-memory store
	if s.Store != nil {
		s.Store.Add(entry)
		fmt.Printf("Ingested: %s %s (%v ms)\n", entry.Method, entry.URI, entry.DurationMS) // DEBUG
	}

	w.WriteHeader(http.StatusOK)
}

func (s *Server) handlePerformance(w http.ResponseWriter, r *http.Request) {
	projectPath := r.URL.Query().Get("path")
	if projectPath == "" {
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	// 1. Get Logs from File (Standard)
	metrics, err := laravel.GetPerformanceLogs(projectPath)
	if err != nil {
		// Just log error and continue, acceptable to have empty file logs
		fmt.Printf("Error reading log file: %v\n", err)
		metrics = []laravel.PerformanceEntry{}
	}

	// 2. Get In-Memory Metrics from Store (Runner)
	if s.Store != nil {
		memoryMetrics := s.Store.GetAll()
		metrics = append(metrics, memoryMetrics...)
	}

	json.NewEncoder(w).Encode(metrics)
}

func (s *Server) handlePerformanceClear(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if s.Store != nil {
		s.Store.Clear()
	}
	// Also could truncate log file if we wanted, but for now just clear memory

	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleAlerts(w http.ResponseWriter, r *http.Request) {
	if s.Watchdog == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	incident := s.Watchdog.GetLatest()
	if incident == nil {
		w.WriteHeader(http.StatusNoContent) // 204 No Content
		return
	}
	json.NewEncoder(w).Encode(incident)
}

func (s *Server) handleDeadlocks(w http.ResponseWriter, r *http.Request) {
	projectPath := r.URL.Query().Get("path")
	if projectPath == "" {
		http.Error(w, "Missing 'path' query parameter", http.StatusBadRequest)
		return
	}

	deadlocks, err := laravel.GetDeadlocks(projectPath)
	if err != nil {
		// Return empty list on error to avoid breaking UI (e.g. log file missing)
		deadlocks = []laravel.DeadlockEntry{}
	}

	json.NewEncoder(w).Encode(deadlocks)
}
