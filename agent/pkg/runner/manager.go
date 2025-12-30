package runner

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "embed"

	"github.com/mike/sentinel-agent/pkg/injector"
)

//go:embed inspector.php
var inspectorContent []byte

type AuditStatus struct {
	Path      string    `json:"path"`
	StartTime time.Time `json:"start_time"`
	Active    bool      `json:"active"`
}

// Manager handles the "Audit Mode" state for projects
type Manager struct {
	audits   map[string]*AuditStatus // Key: ProjectPath
	mu       sync.RWMutex
	injector *injector.Injector
	baseDir  string // ~/.sentinel
}

func NewManager() *Manager {
	home, _ := os.UserHomeDir()
	baseDir := filepath.Join(home, ".sentinel")
	os.MkdirAll(baseDir, 0755)

	return &Manager{
		audits:   make(map[string]*AuditStatus),
		baseDir:  baseDir,
		injector: injector.New(inspectorContent),
	}
}

// EnableAudit injects the telemetry probe
func (m *Manager) EnableAudit(projectPath string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.audits[projectPath]; exists {
		return fmt.Errorf("audit already active for this project")
	}

	if err := m.injector.EnableAudit(projectPath); err != nil {
		return fmt.Errorf("failed to inject audit probe: %v", err)
	}

	m.audits[projectPath] = &AuditStatus{
		Path:      projectPath,
		StartTime: time.Now(),
		Active:    true,
	}

	fmt.Printf("[Audit] Enabled for %s\n", projectPath)
	return nil
}

// DisableAudit removes the telemetry probe
func (m *Manager) DisableAudit(projectPath string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.audits[projectPath]; !exists {
		return nil // Already disabled
	}

	if err := m.injector.DisableAudit(projectPath); err != nil {
		return fmt.Errorf("failed to remove audit probe: %v", err)
	}

	delete(m.audits, projectPath)
	fmt.Printf("[Audit] Disabled for %s\n", projectPath)
	return nil
}

func (m *Manager) GetStatus() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	status := make(map[string]interface{})
	for key, audit := range m.audits {
		// Key matches old format for frontend compatibility if needed,
		// but let's just use path as key for simpler logic?
		// Old frontend expects "{path}:web". Let's keep that for now to minimize breakage
		// until frontend is updated.
		compositeKey := key + ":web"
		status[compositeKey] = map[string]interface{}{
			"path":       audit.Path,
			"running":    audit.Active, // Matches "running" prop in frontend
			"start_time": audit.StartTime,
			"port":       0, // No port in audit mode
		}
	}
	return status
}
