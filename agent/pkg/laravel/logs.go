package laravel

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// GetRecentLogs reads the last N lines of storage/logs/laravel.log
func GetRecentLogs(projectPath string, linesToRead int) ([]string, error) {
	logPath := filepath.Join(projectPath, "storage", "logs", "laravel.log")

	file, err := os.Open(logPath)
	if os.IsNotExist(err) {
		return []string{"Log file not found (" + logPath + ")"}, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// Simple approach: Read all lines, keep last N.
	// For very large files, a seek-from-end approach would be better,
	// but for local dev logs this is usually sufficient.
	scanner := bufio.NewScanner(file)
	var lines []string

	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	total := len(lines)
	if total <= linesToRead {
		return lines, nil
	}

	return lines[total-linesToRead:], nil
}

type PerformanceEntry struct {
	Method      string      `json:"method"`
	URI         string      `json:"uri"`
	DurationMS  float64     `json:"duration_ms"`
	MemoryMB    float64     `json:"memory_mb"`
	QueryCount  int         `json:"query_count"`
	SlowQueries []SlowQuery `json:"slow_queries"`
	Timestamp   string      `json:"timestamp"` // Extracted from log line prefix if possible
}

type SlowQuery struct {
	SQL        string  `json:"sql"`
	DurationMS float64 `json:"duration_ms"`
}

// GetPerformanceLogs scans the log file for [SENTINEL_PERF] entries
func GetPerformanceLogs(projectPath string) ([]PerformanceEntry, error) {
	// Reuse GetRecentLogs logic but scan for specific tag
	lines, err := GetRecentLogs(projectPath, 2000) // Scan last 2000 lines
	if err != nil {
		return nil, err
	}

	var metrics []PerformanceEntry
	for _, line := range lines {
		if idx := strings.Index(line, "[SENTINEL_PERF]"); idx != -1 {
			// Extract JSON part: "[SENTINEL_PERF] {...}"
			// The part after tag is often the JSON.
			// Sometimes finding the first '{' after the tag is safer.
			jsonPartIdx := strings.Index(line[idx:], "{")
			if jsonPartIdx == -1 {
				continue
			}
			jsonStr := line[idx+jsonPartIdx:]

			var entry PerformanceEntry
			if err := json.Unmarshal([]byte(jsonStr), &entry); err == nil {
				// Try to extract timestamp from the beginning of the line
				// Example: "[2024-01-01 12:00:00] local.INFO: [SENTINEL_PERF] ..."
				if len(line) > 21 && line[0] == '[' && line[20] == ']' {
					entry.Timestamp = line[1:20]
				}
				metrics = append(metrics, entry)
			}
		}
	}

	// Reverse to show newest first? Or handle in frontend.
	// API usually returns list, frontend sorts.
	return metrics, nil
}

type DeadlockEntry struct {
	Timestamp string `json:"timestamp"`
	Message   string `json:"message"`
}

// GetDeadlocks scans for database lock errors
func GetDeadlocks(projectPath string) ([]DeadlockEntry, error) {
	lines, err := GetRecentLogs(projectPath, 5000) // Look back further for errors
	if err != nil {
		return nil, err
	}

	var deadlocks []DeadlockEntry
	for _, line := range lines {
		// Check for MySQL/Postgres deadlock keywords
		if strings.Contains(line, "Deadlock found") || strings.Contains(line, "Lock wait timeout exceeded") {
			entry := DeadlockEntry{
				Message: line,
			}
			// Extract timestamp [2024-...]
			if len(line) > 21 && line[0] == '[' && line[20] == ']' {
				entry.Timestamp = line[1:20]
				// Clean up message to remove timestamp/env parts if possible
				if len(line) > 22 {
					entry.Message = strings.TrimSpace(line[22:])
				}
			}
			deadlocks = append(deadlocks, entry)
		}
	}

	return deadlocks, nil
}
