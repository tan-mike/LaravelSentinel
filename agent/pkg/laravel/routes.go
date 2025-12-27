package laravel

import (
	"encoding/json"
	"fmt"
	"os/exec"
)

// Route represents a single route from artisan route:list
type Route struct {
	Domain     string      `json:"domain"`
	Method     string      `json:"method"`
	Uri        string      `json:"uri"`
	Name       string      `json:"name"`
	Action     string      `json:"action"`
	Middleware interface{} `json:"middleware"` // Can be string or array
}

// GetRoutes executes php artisan route:list --json and returns parsed routes
func GetRoutes(projectPath string) ([]Route, error) {
	cmd := exec.Command("php", "artisan", "route:list", "--json")
	cmd.Dir = projectPath

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to run artisan command: %v", err)
	}

	var routes []Route
	if err := json.Unmarshal(output, &routes); err != nil {
		// Sometimes artisan outputs extra text before JSON?
		// For now assume clean output or future refinement needed
		return nil, fmt.Errorf("failed to parse route json: %v", err)
	}

	return routes, nil
}
