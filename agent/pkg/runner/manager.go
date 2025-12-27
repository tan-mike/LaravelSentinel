package runner

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

type ProcessType string

const (
	ProcessTypeWeb   ProcessType = "web"
	ProcessTypeQueue ProcessType = "queue"
)

type RunnerProcess struct {
	Cmd       *exec.Cmd
	Port      int // Only for ProcessTypeWeb
	Type      ProcessType
	StartTime time.Time
	Path      string
}

// Manager handles multiple running processes
type Manager struct {
	processes map[string]*RunnerProcess // Key: ProjectPath + Type
	mu        sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{
		processes: make(map[string]*RunnerProcess),
	}
}

func (m *Manager) Start(projectPath string, port int, withQueue bool, inspectorPath string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 1. Start Web Server
	webKey := projectPath + ":web"
	if _, exists := m.processes[webKey]; exists {
		return fmt.Errorf("web server already running for %s", projectPath)
	}

	// 0. Copy Inspector to Project Root (to avoid path/permission issues)
	localInspectorName := "sentinel_inspector.php"
	localInspectorPath := filepath.Join(projectPath, localInspectorName)

	input, err := os.ReadFile(inspectorPath)
	if err != nil {
		return fmt.Errorf("failed to read global inspector: %v", err)
	}
	if err := os.WriteFile(localInspectorPath, input, 0644); err != nil {
		return fmt.Errorf("failed to write local inspector: %v", err)
	}

	// php -S 127.0.0.1:<PORT> -t <PATH>/public -d auto_prepend_file=<INSPECTOR>
	// php -d auto_prepend_file=<INSPECTOR> -S 127.0.0.1:<PORT> -t <PATH>/public
	// We use ABSOLUTE path for auto_prepend_file to be safe regardless of -t (docroot)
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	args := []string{
		"-d", fmt.Sprintf("auto_prepend_file=%s", localInspectorPath),
		"-S", addr,
		"-t", projectPath + "/public",
	}

	cmd := exec.Command("php", args...)

	// DEBUG: Connect to Agent's stdout/stderr for now
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Dir = projectPath // CRITICAL: Run from project root so inspector.php finds artisan

	fmt.Printf("[Runner] Starting Web: php %v (in %s)\n", args, projectPath)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start web server: %v", err)
	}

	m.processes[webKey] = &RunnerProcess{
		Cmd:       cmd,
		Port:      port,
		Type:      ProcessTypeWeb,
		StartTime: time.Now(),
		Path:      projectPath,
	}

	// 2. Start Queue Worker (Optional)
	if withQueue {
		queueKey := projectPath + ":queue"
		if _, exists := m.processes[queueKey]; exists {
			// Already running, skip or error? Let's skip nicely
		} else {
			// php artisan queue:work -d auto_prepend_file=<INSPECTOR>
			// Use absolute path here too
			localInspectorPath := filepath.Join(projectPath, "sentinel_inspector.php")
			qArgs := []string{
				"-d", fmt.Sprintf("auto_prepend_file=%s", localInspectorPath),
				projectPath + "/artisan",
				"queue:work",
			}

			qCmd := exec.Command("php", qArgs...)
			qCmd.Dir = projectPath
			if err := qCmd.Start(); err == nil {
				m.processes[queueKey] = &RunnerProcess{
					Cmd:       qCmd,
					Type:      ProcessTypeQueue,
					StartTime: time.Now(),
					Path:      projectPath,
				}
			}
		}
	}

	return nil
}

func (m *Manager) Stop(projectPath string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	webKey := projectPath + ":web"
	queueKey := projectPath + ":queue"

	// Kill Web
	if p, exists := m.processes[webKey]; exists {
		if p.Cmd.Process != nil {
			p.Cmd.Process.Kill()
		}
		// Cleanup local inspector (best effort)
		os.Remove(filepath.Join(p.Path, "sentinel_inspector.php"))
		delete(m.processes, webKey)
	}

	// Kill Queue
	if p, exists := m.processes[queueKey]; exists {
		if p.Cmd.Process != nil {
			p.Cmd.Process.Kill()
		}
		// Cleanup (duplicate remove is fine, it handles error silently usually, or we check)
		// Actually web process owns the file usually, but same path.
		delete(m.processes, queueKey)
	}

	return nil
}

func (m *Manager) GetStatus() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	status := make(map[string]interface{})
	for key, p := range m.processes {
		status[key] = map[string]interface{}{
			"path":       p.Path,
			"type":       p.Type,
			"port":       p.Port,
			"start_time": p.StartTime,
			"running":    p.Cmd.ProcessState == nil, // simplistic check
		}
	}
	return status
}
