package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/mike/sentinel-agent/pkg/config"
	"github.com/mike/sentinel-agent/pkg/server"
)

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
	// Only write if not exists or force update?
	// For dev, let's always write it to ensure latest version.

	// We read the 'inspector.php' from the implementation file.
	// In a real build, we'd embed this via //go:embed.
	// For now, let's write a hardcoded version or assume it's development flow.
	// Since I cannot embed easily without changing file structure significantly,
	// I will write the string content here.

	content := `<?php
// ~/.sentinel/inspector.php

// 1. Unconditional Debug Log
file_put_contents('/tmp/sentinel_debug_boot.log', "Booted at " . date('c') . " CWD: " . getcwd() . PHP_EOL, FILE_APPEND);

// Determine Project Root
$projectRoot = getcwd();
if (!file_exists($projectRoot . '/artisan') && file_exists($projectRoot . '/../artisan')) {
    $projectRoot = dirname($projectRoot); // We are likely in /public
}

file_put_contents('/tmp/sentinel_debug_boot.log', "Project Root detected as: " . $projectRoot . PHP_EOL, FILE_APPEND);

if (file_exists($projectRoot . '/artisan')) {
    
    // Register Shutdown
    register_shutdown_function(function () use ($projectRoot) {
        
        // Ensure we can access Laravel app
        // Note: In auto_prepend, 'app()' helper might not be available yet, but inside shutdown function it should be.
        if (function_exists('app') && app()->has('db')) {
            try {
                // Try to enable query log late (might miss early queries but better than nothing)
                // Ideally this line runs immediately, not in shutdown.
                // \Illuminate\Support\Facades\DB::enableQueryLog(); 
                
                // DATA COLLECTION
                $data = [
                    'uri' => request()->path(),
                    'method' => request()->method(),
                    'memory_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
                    'duration_ms' => round((microtime(true) - LARAVEL_START) * 1000, 2),
                    'query_count' => 0, // Default
                    'timestamp' => date('Y-m-d H:i:s'),
                ];
                
                try {
                    $queries = \Illuminate\Support\Facades\DB::getQueryLog();
                    $data['query_count'] = count($queries);
                } catch (\Throwable $t) {}

                // Send via stream context
                $options = [
                    'http' => [
                        'header'  => "Content-type: application/json\r\n",
                        'method'  => 'POST',
                        'content' => json_encode($data),
                        'timeout' => 0.1, // 100ms
                        'ignore_errors' => true,
                    ]
                ];
                $context  = stream_context_create($options);
                file_get_contents('http://127.0.0.1:8888/projects/ingest', false, $context);
                
                // Log success
                 file_put_contents('/tmp/sentinel_debug_success.log', "Sent: " . $data['uri'] . PHP_EOL, FILE_APPEND);
                
            } catch (\Throwable $e) {
                file_put_contents('/tmp/sentinel_inspector_error.log', $e->getMessage() . PHP_EOL, FILE_APPEND);
            }
        } else {
             file_put_contents('/tmp/sentinel_debug_boot.log', "App not ready in shutdown" . PHP_EOL, FILE_APPEND);
        }
    });
    
    // Attempt to enable query log IMMEDIATELY if we can find the Facade?
    // Hard without autoloader. Laravel handles autoloader in index.php.
    // Since auto_prepend runs BEFORE index.php, we rely on Laravel's booter to eventually run.
    // We can't enable DB log HERE.
     file_put_contents('/tmp/sentinel_debug_boot.log', "Registered Shutdown Function" . PHP_EOL, FILE_APPEND);
} else {
     file_put_contents('/tmp/sentinel_debug_boot.log', "Artisan not found" . PHP_EOL, FILE_APPEND);
}
`
	return os.WriteFile(path, []byte(content), 0644)
}
