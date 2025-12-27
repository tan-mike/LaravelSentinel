<?php
// ~/.sentinel/inspector.php

// Only run if we are inside a Laravel app
if (file_exists(__DIR__ . '/../artisan') || file_exists(getcwd() . '/artisan')) {
    
    // Register the Shutdown Handler
    register_shutdown_function(function () {
        // Ensure we are in a fully booted Laravel app
        if (function_exists('app') && app()->has('db')) {
            try {
                // Enable Query Log (if not already on, though too late for this request maybe? 
                // Actually, auto_prepend runs BEFORE request, so we can enable here!)
                \Illuminate\Support\Facades\DB::enableQueryLog();
                
                // We need to hook into the APP FINISH to get data, because shutdown is too late for some things?
                // But auto_prepend puts us in global scope.
                // Let's rely on Laravel's events if possible, or just grab what we can at shutdown.
                
                // Ideally we register an event listener HERE, at the start.
                if (function_exists('app')) {
                     // Wait, app() might not be ready yet in auto_prepend.
                     // We should hook into boot if possible.
                     // But we can't easily hook into boot from outside without modifying code.
                     // EXCEPT: We can use `register_shutdown_function` which runs after app flows.
                }

                $data = [
                    'uri' => request()->path(),
                    'method' => request()->method(),
                    'memory_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
                    'duration_ms' => round((microtime(true) - LARAVEL_START) * 1000, 2),
                    'query_count' => count(\Illuminate\Support\Facades\DB::getQueryLog()),
                    'timestamp' => date('Y-m-d H:i:s'),
                    'project_path' => base_path(),
                ];
                
                // Send to Sentinel Agent (Fire and Forget)
                // We use a curl with strict timeout to minimize impact
                $ch = curl_init('http://127.0.0.1:8888/projects/ingest'); 
                curl_setopt($ch, CURLOPT_POST, 1);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                curl_setopt($ch, CURLOPT_TIMEOUT_MS, 50); // Max 50ms delay
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_exec($ch);
                curl_close($ch);
                
            } catch (\Throwable $e) {
                // Ignore errors
            }
        }
    });
    
    // Attempt to enable query log early if app is ready? No, app isn't created yet likely.
    // But we are in auto_prepend... Laravel's index.php hasn't run.
    // So we can't access Facades yet.
    // Implementation Detail: We might need to specificy a "Bootloader" approach or just accept that 
    // we only get data visible at shutdown.
    // Actually, DB query log needs to be enabled. 
    // If we can't enable it, we get 0 queries. 
    // Solution: We can define a global helper function that Laravel might pick up? No.
    // Valid strategy: Check if User has `DB_LOG_ENABLED` env or similar.
    // improved strategy: We can't easily enable query log from outside without touching code.
    // For now, let's ship the basic "Duration/Memory" spy. Query counting might require user config.
}
