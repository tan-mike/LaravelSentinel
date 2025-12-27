package watchdog

import (
	"bufio"
	"fmt"
	"os"
	"sync"
	"time"
)

type Incident struct {
	Timestamp       time.Time `json:"timestamp"`
	CpuPercent      float64   `json:"cpu_percent"`
	SuspectRequests []string  `json:"suspect_requests"`
}

type Watchdog struct {
	mu            sync.RWMutex
	LastIncident  *Incident
	CooldownUntil time.Time
}

func New() *Watchdog {
	return &Watchdog{}
}

func (w *Watchdog) Check(cpuPercent float64, threshold int, logPath string) *Incident {
	w.mu.Lock()
	defer w.mu.Unlock()

	// If below threshold, all good
	if cpuPercent < float64(threshold) {
		return nil
	}

	// Check Cooldown (don't spam alerts every second)
	if time.Now().Before(w.CooldownUntil) {
		return w.LastIncident
	}

	// BREACH DETECTED
	// Read last 15 lines of log
	lines, _ := readLastLines(logPath, 15)

	w.LastIncident = &Incident{
		Timestamp:       time.Now(),
		CpuPercent:      cpuPercent,
		SuspectRequests: lines,
	}

	// Set 1 minute cooldown
	w.CooldownUntil = time.Now().Add(1 * time.Minute)

	return w.LastIncident
}

func (w *Watchdog) GetLatest() *Incident {
	w.mu.RLock()
	defer w.mu.RUnlock()

	// If incident is older than 5 minutes, clear it
	if w.LastIncident != nil && time.Since(w.LastIncident.Timestamp) > 5*time.Minute {
		return nil
	}

	return w.LastIncident
}

func readLastLines(path string, n int) ([]string, error) {
	file, err := os.Open(path)
	if err != nil {
		return []string{fmt.Sprintf("Error reading log: %v", err)}, err
	}
	defer file.Close()

	// Simple approach: Read all lines (inefficient for huge logs, but OK for local dev logs usually)
	// Better approach for huge logs would be seeking from end, but keeping it simple for MVP.
	// Actually, let's use a ring buffer scan to avoid loading 1GB file into memory.

	// Optimistic approach: Most dev logs aren't huge.
	// Safe approach: Seek to file size - 10KB and read from there?

	stat, err := file.Stat()
	if err == nil && stat.Size() > 20000 {
		// Seek to near end
		file.Seek(-20000, 2)
	}

	scanner := bufio.NewScanner(file)
	var lines []string
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	// Return last N
	if len(lines) > n {
		return lines[len(lines)-n:], nil
	}
	return lines, nil
}
