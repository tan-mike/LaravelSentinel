package main

import (
	"log"

	"github.com/mike/sentinel-agent/pkg/config"
	"github.com/mike/sentinel-agent/pkg/server"
)

func main() {
	log.Println("Sentinel Agent Starting...")

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
