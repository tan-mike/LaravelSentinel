package project

import (
	"os"
	"path/filepath"
)

type Project struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// FindProjects scans the given root directory for Laravel projects (indicated by 'artisan' file)
func FindProjects(rootDir string, ignoredPaths []string) ([]Project, error) {
	var projects []Project

	// Convert slice to map for O(1) lookup
	ignoreMap := make(map[string]bool)
	for _, p := range ignoredPaths {
		ignoreMap[p] = true
	}

	entries, err := os.ReadDir(rootDir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() {
			fullPath := filepath.Join(rootDir, entry.Name())

			// Skip if ignored
			if ignoreMap[fullPath] {
				continue
			}

			if isLaravelProject(fullPath) {
				projects = append(projects, Project{
					Name: entry.Name(),
					Path: fullPath,
				})
			}
		}
	}

	return projects, nil
}

func isLaravelProject(path string) bool {
	info, err := os.Stat(filepath.Join(path, "artisan"))
	if err == nil && !info.IsDir() {
		return true
	}
	return false
}
