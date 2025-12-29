package main

import (
	_ "embed"
	"log"
	"os"
	"path/filepath"

	"github.com/mike/sentinel-agent/pkg/config"
	"github.com/mike/sentinel-agent/pkg/server"
)

//go:embed inspector.php
var inspectorContent string

func main() {
	log.Println("Sentinel Agent Starting...")

	// ensure inspector.php exists
	if err := ensureInspector(); err != nil {
		log.Printf("Warning: Failed to create inspector.php: %v", err)
	}

	// Load Config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize Server
	srv := server.NewServer(&cfg)

	// Start Server
	if err := srv.Start(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func ensureInspector() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dir := filepath.Join(home, ".sentinel")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	path := filepath.Join(dir, "inspector.php")

	// Write the embedded content
	return os.WriteFile(path, []byte(inspectorContent), 0644)
}
