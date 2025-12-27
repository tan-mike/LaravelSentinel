"use client";

import { useEffect, useState } from "react";
import { api, TelemetryStatus, Config } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Metrics() {
  const router = useRouter();
  const [telemetry, setTelemetry] = useState<TelemetryStatus | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [incident, setIncident] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [t, c, i] = await Promise.all([
        api.fetchTelemetry(),
        api.fetchConfig(),
        api.fetchAlerts()
      ]);
      setTelemetry(t);
      setConfig(c);
      setIncident(i);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 2 seconds
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container max-w-4xl">
      <div className="mb-8 flex justify-between items-center">
        <div>
            <Link href="/" className="text-gray-400 hover:text-white mb-4 inline-block">&larr; Back to Dashboard</Link>
            <h1 className="text-3xl font-bold">System Metrics</h1>
            <p className="text-gray-400 font-mono text-sm mt-1">Live Telemetry from Sentinel Agent</p>
        </div>
        <button onClick={fetchData} className="btn bg-white/10 hover:bg-white/20">
            Refresh Now
        </button>
      </div>

      {loading && !telemetry ? (
          <div className="text-center py-20 text-gray-500">Connecting to Agent...</div>
      ) : (
          <div className="space-y-6">
            {/* Alert Banner */}
            {incident && (
                <div role="alert" className="alert alert-error bg-red-900/50 border-red-500 text-white shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div className="w-full">
                        <h3 className="font-bold text-lg">High CPU Load Detected!</h3>
                        <p className="text-sm">PHP-FPM spiked to <span className="font-mono font-bold">{(incident.cpu_percent).toFixed(1)}%</span> at {new Date(incident.timestamp).toLocaleTimeString()}</p>
                        
                        <div className="mt-2 p-2 bg-black/40 rounded font-mono text-xs overflow-x-auto max-h-32 text-red-200">
                             <div className="font-bold mb-1 opacity-50">Last {incident.suspect_requests.length} Requests / Log Entries:</div>
                             {incident.suspect_requests.map((line: string, i: number) => (
                                 <div key={i} className="truncate border-b border-white/5 pb-1 mb-1">{line}</div>
                             ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PHP Web Memory */}
              <div className="card glass p-6 border-blue-500/30 bg-blue-500/5">
                  <h3 className="text-blue-400 uppercase text-xs font-bold mb-4">PHP Web Memory (FPM)</h3>
                  <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-bold text-white">
                          {telemetry?.system_stats.php_web_memory_mb ?? 0}
                      </span>
                      <span className="text-xl text-gray-500 mb-1">MB</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(((telemetry?.system_stats.php_web_memory_mb || 0) / 1024) * 100, 100)}%` }}
                      ></div>
                  </div>
                  <p className="text-xs text-gray-500">Shared PHP-FPM Pool Usage</p>
              </div>

              {/* PHP CLI Memory */}
              <div className="card glass p-6 border-purple-500/30 bg-purple-500/5">
                  <h3 className="text-purple-400 uppercase text-xs font-bold mb-4">PHP CLI Memory (Artisan)</h3>
                  <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-bold text-white">
                          {telemetry?.system_stats.php_cli_memory_mb ?? 0}
                      </span>
                      <span className="text-xl text-gray-500 mb-1">MB</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(((telemetry?.system_stats.php_cli_memory_mb || 0) / 1024) * 100, 100)}%` }}
                      ></div>
                  </div>
                  <p className="text-xs text-gray-500">Queues, Workers & Commands</p>
              </div>

              {/* Agent RAM Usage */}
              <div className="card glass p-6">
                  <h3 className="text-gray-400 uppercase text-xs font-bold mb-4">Agent Memory</h3>
                  <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-bold text-white">
                          {telemetry?.system_stats.memory_usage_mb ?? 0}
                      </span>
                      <span className="text-xl text-gray-500 mb-1">MB</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                      <div 
                        className="bg-gray-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(((telemetry?.system_stats.memory_usage_mb || 0) / 512) * 100, 100)}%` }}
                      ></div>
                  </div>
                  <p className="text-xs text-gray-500">Sentinel Agent Heap</p>
              </div>

              {/* Goroutines */}
              <div className="card glass p-6">
                  <h3 className="text-gray-400 uppercase text-xs font-bold mb-4">Agent Concurrency</h3>
                  <div className="flex items-end gap-2 mb-2">
                      <span className="text-5xl font-bold text-white">
                          {telemetry?.system_stats.num_goroutines ?? 0}
                      </span>
                      <span className="text-xl text-gray-500 mb-1">Goroutines</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(((telemetry?.system_stats.num_goroutines || 0) / 100) * 100, 100)}%` }}
                      ></div>
                  </div>
                  <p className="text-xs text-gray-500">Active Threads</p>
              </div>

              {/* Agent Config */}
              <div className="card glass p-6 md:col-span-2">
                  <h3 className="text-gray-400 uppercase text-xs font-bold mb-4">Agent Configuration</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                          <label className="text-gray-500 block">Host</label>
                          <span className="font-mono text-white">{config?.host}</span>
                      </div>
                      <div>
                          <label className="text-gray-500 block">Port</label>
                          <span className="font-mono text-white">{config?.port}</span>
                      </div>
                      <div className="col-span-2">
                          <label className="text-gray-500 block">Workspace Root</label>
                          <span className="font-mono text-white break-all">{config?.workspace_root}</span>
                      </div>
                  </div>
              </div>

              {/* PHP-FPM Load */}
               <div className="card glass p-6 md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-400 uppercase text-xs font-bold">PHP-FPM Load</h3>
                        {telemetry?.php_fpm ? (
                            <span className="text-green-400 text-xs font-bold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Active
                            </span>
                        ) : (
                            <span className="text-red-400 text-xs font-bold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                Unreachable
                            </span>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                        {/* CPU */}
                        <div>
                             <div className="flex items-end gap-2 mb-2">
                                <span className="text-4xl font-bold text-white">
                                    {(telemetry?.system_stats.php_fpm_cpu_percent ?? 0).toFixed(1)}%
                                </span>
                                <span className="text-sm text-gray-500 mb-1">CPU Usage</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2">
                                <div 
                                    className="bg-yellow-500 h-2 rounded-full transition-all duration-500" 
                                    style={{ width: `${Math.min((telemetry?.system_stats.php_fpm_cpu_percent || 0), 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Workers */}
                        <div>
                             <div className="flex items-end gap-2 mb-2">
                                 <span className="text-4xl font-bold text-white">
                                    {telemetry?.system_stats.php_fpm_worker_count ?? 0}
                                </span>
                                <span className="text-sm text-gray-500 mb-1">Active Workers</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2">
                                <div 
                                    className="bg-blue-400 h-2 rounded-full transition-all duration-500" 
                                    style={{ width: `${Math.min(((telemetry?.system_stats.php_fpm_worker_count || 0) / 20) * 100, 100)}%` }} // Assume 20 max for bar scaling
                                ></div>
                            </div>
                        </div>
                    </div>
              </div>
           </div>
          </div>
      )}
    </div>
  );
}
