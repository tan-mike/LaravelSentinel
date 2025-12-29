package telemetry

import (
	"net"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/process"
)

type SystemStats struct {
	MemoryUsageMB     uint64  `json:"memory_usage_mb"`
	NumGoroutine      int     `json:"num_goroutines"`
	PhpWebMemoryMB    int     `json:"php_web_memory_mb"`
	PhpCliMemoryMB    int     `json:"php_cli_memory_mb"`
	PhpFpmCpuPercent  float64 `json:"php_fpm_cpu_percent"`
	PhpFpmWorkerCount int     `json:"php_fpm_worker_count"`
}

type Status struct {
	PhpFpm      bool        `json:"php_fpm"`
	SystemStats SystemStats `json:"system_stats"`
}

type Monitor struct {
	procs map[int32]*process.Process
	mu    sync.Mutex
}

func NewMonitor() *Monitor {
	return &Monitor{
		procs: make(map[int32]*process.Process),
	}
}

func (m *Monitor) GetSystemStats() SystemStats {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)

	webMem, cliMem, webCpu, webWorkers := m.getPHPStats()

	return SystemStats{
		MemoryUsageMB:     ms.Alloc / 1024 / 1024,
		NumGoroutine:      runtime.NumGoroutine(),
		PhpWebMemoryMB:    webMem,
		PhpCliMemoryMB:    cliMem,
		PhpFpmCpuPercent:  webCpu,
		PhpFpmWorkerCount: webWorkers,
	}
}

func (m *Monitor) getPHPStats() (int, int, float64, int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	pids, err := process.Pids()
	if err != nil {
		return 0, 0, 0.0, 0
	}

	// Track current PIDs to clean up old ones
	currentPids := make(map[int32]bool)

	var webKB, cliKB uint64
	var webCPU float64
	var webWorkers int

	for _, pid := range pids {
		currentPids[pid] = true

		proc, exists := m.procs[pid]
		if !exists {
			var err error
			proc, err = process.NewProcess(pid)
			if err != nil {
				continue
			}
			m.procs[pid] = proc
		}

		name, err := proc.Name()
		if err != nil {
			continue
		}

		// Windows/Unix compatibility
		name = strings.ToLower(name)
		isPhp := strings.Contains(name, "php") // Matches php, php-fpm, php-cgi.exe, php.exe

		if !isPhp {
			continue
		}

		cmdline, err := proc.Cmdline()
		if err != nil {
			continue
		}
		cmdline = strings.ToLower(cmdline)

		// Get Memory
		memInfo, err := proc.MemoryInfo()
		rss := uint64(0)
		if err == nil && memInfo != nil {
			rss = memInfo.RSS
		}

		// Get CPU - This is stateful on 'proc'
		cpuPercent, err := proc.CPUPercent()
		if err != nil {
			cpuPercent = 0.0
		}

		// Heuristics
		if strings.Contains(name, "fpm") || strings.Contains(name, "cgi") || strings.Contains(cmdline, "php-fpm") {
			// Web Process (FPM or CGI)
			webKB += rss
			webCPU += cpuPercent
			webWorkers++
			// fmt.Printf("Found PHP-FPM: %s (PID: %d) CPU: %.2f%%\n", name, pid, cpuPercent)
		} else if strings.Contains(cmdline, "artisan") || strings.Contains(cmdline, "serve") {
			// CLI Process
			cliKB += rss
		}
	}

	// Cleanup old processes
	for pid := range m.procs {
		if !currentPids[pid] {
			delete(m.procs, pid)
		}
	}

	return int(webKB / 1024 / 1024), int(cliKB / 1024 / 1024), webCPU, webWorkers
}

func (m *Monitor) GetStatus() Status {
	stats := m.GetSystemStats()

	// Check FPM via Process Memory OR TCP Port
	fpmStatus := stats.PhpWebMemoryMB > 0 || checkPHPFPM()

	return Status{
		PhpFpm:      fpmStatus,
		SystemStats: stats,
	}
}

func checkPHPFPM() bool {
	// Try to connect to a common PHP-FPM socket or port
	conn, err := net.DialTimeout("tcp", "127.0.0.1:9000", 100*time.Millisecond)
	if err == nil {
		conn.Close()
		return true
	}
	return false
}
