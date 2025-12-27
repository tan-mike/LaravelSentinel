package telemetry

import (
	"net"
	"runtime"
	"strings"
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

func GetSystemStats() SystemStats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	webMem, cliMem, webCpu, webWorkers := getPHPStats()

	return SystemStats{
		MemoryUsageMB:     m.Alloc / 1024 / 1024,
		NumGoroutine:      runtime.NumGoroutine(),
		PhpWebMemoryMB:    webMem,
		PhpCliMemoryMB:    cliMem,
		PhpFpmCpuPercent:  webCpu,
		PhpFpmWorkerCount: webWorkers,
	}
}

func getPHPStats() (int, int, float64, int) {
	// Use gopsutil for cross-platform process monitoring
	procs, err := process.Processes()
	if err != nil {
		return 0, 0, 0.0, 0
	}

	var webKB, cliKB uint64
	var webCPU float64
	var webWorkers int

	for _, p := range procs {
		name, err := p.Name()
		if err != nil {
			continue
		}

		// Windows/Unix compatibility
		name = strings.ToLower(name)
		isPhp := strings.Contains(name, "php") // Matches php, php-fpm, php-cgi.exe, php.exe

		if !isPhp {
			continue
		}

		cmdline, err := p.Cmdline()
		if err != nil {
			continue
		}
		cmdline = strings.ToLower(cmdline)

		// Get Memory
		memInfo, err := p.MemoryInfo()
		rss := uint64(0)
		if err == nil && memInfo != nil {
			rss = memInfo.RSS
		}

		// Get CPU
		cpuPercent, err := p.CPUPercent()
		if err != nil {
			cpuPercent = 0.0
		}

		// Heuristics
		if strings.Contains(name, "fpm") || strings.Contains(name, "cgi") || strings.Contains(cmdline, "php-fpm") {
			// Web Process (FPM or CGI)
			webKB += rss
			webCPU += cpuPercent
			webWorkers++
		} else if strings.Contains(cmdline, "artisan") || strings.Contains(cmdline, "serve") {
			// CLI Process
			cliKB += rss
		}
	}

	return int(webKB / 1024 / 1024), int(cliKB / 1024 / 1024), webCPU, webWorkers
}

func GetStatus() Status {
	stats := GetSystemStats()

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
