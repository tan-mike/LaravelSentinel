<?php
// Binding function called by Modified index.php (Smart Injection)
if (!function_exists('sentinel_bind')) {
    function sentinel_bind($app) {
        // $debugLog = '/tmp/sentinel_debug.log';
        // file_put_contents($debugLog, date('H:i:s') . " [Bind] invoked. App type: " . gettype($app) . PHP_EOL, FILE_APPEND);
        
        try {
            if (!is_object($app)) {
                 // file_put_contents($debugLog, date('H:i:s') . " [Bind] Abort: App is typically not an object? " . PHP_EOL, FILE_APPEND);
                 return;
            }

            // Hook into DB resolution
            $app->resolving('db', function ($db) {
                // file_put_contents($debugLog, date('H:i:s') . " [Bind] DB resolving..." . PHP_EOL, FILE_APPEND);
                try {
                    $db->enableQueryLog();
                    // file_put_contents($debugLog, date('H:i:s') . " [Bind] enableQueryLog called." . PHP_EOL, FILE_APPEND);
                } catch (\Throwable $e) {
                    // Silent fail
                }
            });
        } catch (\Throwable $e) {
            // Silent fail
        }
    }
}

// SAFETY: Wrap main logic
(function() {
    try {
        // 1. Locate Project Root
        $projectRoot = getcwd();
        if (basename($projectRoot) === 'public') {
            $projectRoot = dirname($projectRoot);
        }

        // define log path in /tmp for guaranteed write access
        $debugLog = '/tmp/sentinel_debug.log';
        
        // Simple file logger
        $log = function($msg) use ($debugLog, $projectRoot) {
            // file_put_contents($debugLog, date('H:i:s') . " [" . $projectRoot . "] " . $msg . PHP_EOL, FILE_APPEND);
        };

        // 2. Register Shutdown Function
        register_shutdown_function(function () use ($projectRoot, $log) {
            try {
                // Basic Telemetry
                $startTime = defined('LARAVEL_START') ? LARAVEL_START : $_SERVER['REQUEST_TIME_FLOAT'];
                $duration = round((microtime(true) - $startTime) * 1000, 2);
                $memory = round(memory_get_peak_usage(true) / 1024 / 1024, 2);
                
                $data = [
                    'uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
                    'method' => $_SERVER['REQUEST_METHOD'] ?? 'CLI',
                    'memory_mb' => $memory,
                    'duration_ms' => $duration,
                    'query_count' => 0,
                    'timestamp' => date('Y-m-d H:i:s'),
                ];

                // Retrieve Query Log
                if (function_exists('app') && app()->has('db')) {
                     try {
                        $queries = \Illuminate\Support\Facades\DB::getQueryLog();
                        $data['query_count'] = count($queries);
                        
                        $data['slow_queries'] = [];
                        foreach ($queries as $q) {
                            if (isset($q['time']) && $q['time'] > 50) { // Threshold: 50ms
                                $data['slow_queries'][] = [
                                    'sql' => $q['query'],
                                    'duration_ms' => $q['time'],
                                    // 'bindings' => $q['bindings'] // Optional: include if safe
                                ];
                            }
                        }
                    } catch (\Throwable $t) {}
                }

                // Send Data to Agent
                $url = 'http://127.0.0.1:8888/projects/ingest';
                
                $options = [
                    'http' => [
                        'header'  => "Content-type: application/json\r\n",
                        'method'  => 'POST',
                        'content' => json_encode($data),
                        'timeout' => 0.2, // 200ms
                        'ignore_errors' => true,
                    ]
                ];
                
                $context  = stream_context_create($options);
                $result = file_get_contents($url, false, $context);
                
                if ($result === false) {
                    $log("Failed to connect to Agent at $url");
                }

            } catch (\Throwable $e) {
                $log("Error collecting/sending data: " . $e->getMessage());
            }
        });
        
    } catch (\Throwable $m) {
        // Global safety net
    }
})();
