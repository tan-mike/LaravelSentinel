"use client";

import { useEffect, useState, useMemo } from "react";
import { api, PerformanceEntry } from "@/lib/api";

export default function PerformanceAudit({
  projectPath,
  onClose,
}: {
  projectPath: string;
  onClose: () => void;
}) {
  const [metrics, setMetrics] = useState<PerformanceEntry[]>([]);
  const [deadlocks, setDeadlocks] = useState<any[]>([]); // Use any for quickness or import DeadlockEntry
  const [loading, setLoading] = useState(true);


    useEffect(() => {
        let mounted = true;
        
        async function fetch() {
            try {
                const [perfData, lockData] = await Promise.all([
                    api.fetchPerformance(projectPath),
                    api.fetchDeadlocks(projectPath)
                ]);

                if (mounted) {
                    if (perfData) setMetrics(perfData.reverse());
                    if (lockData) setDeadlocks(lockData.reverse());
                    setLoading(false);
                }
            } catch (e) {
                console.error(e);
            }
        }

        fetch(); // Initial fetch
        const interval = setInterval(fetch, 2000); // Poll every 2s

        return () => {
             mounted = false;
             clearInterval(interval);
        };
    }, [projectPath]);

  // Analyzers
  const slowestRequests = useMemo(() => {
      return [...metrics].sort((a, b) => b.duration_ms - a.duration_ms).slice(0, 5);
  }, [metrics]);

  const heaviestQueries = useMemo(() => {
    return [...metrics].sort((a, b) => b.query_count - a.query_count).slice(0, 5);
  }, [metrics]);

  const memoryHogs = useMemo(() => {
    return [...metrics].sort((a, b) => b.memory_mb - a.memory_mb).slice(0, 5);
  }, [metrics]);

  const recentSlowQueries = useMemo(() => {
      const all: { sql: string; duration: number; uri: string }[] = [];
      metrics.forEach(m => {
          if (m.slow_queries) {
              m.slow_queries.forEach(sq => {
                  all.push({ sql: sq.sql, duration: sq.duration_ms, uri: m.uri });
              });
          }
      });
      return all.sort((a, b) => b.duration - a.duration).slice(0, 10);
  }, [metrics]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-6xl h-[90vh] flex flex-col glass relative overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
            <div className="flex items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                        Performance Audit
                    </h2>
                    <p className="text-xs text-gray-500 font-mono">{projectPath}</p>
                </div>
                 {!loading && (
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                 )}
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={async () => {
                        if(confirm("Clear all telemetry data?")) {
                            await api.clearPerformance(projectPath);
                            setMetrics([]);
                        }
                    }} 
                    className="btn bg-red-600 hover:bg-red-500 text-white border-red-500"
                >
                    Clear Data
                </button>
                <button onClick={onClose} className="btn hover:bg-white/10">Close</button>
            </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-[#0d1117]">
            {loading ? (
                 <div className="grid grid-cols-3 gap-6 animate-pulse">
                    {[1,2,3].map(i => <div key={i} className="h-64 bg-slate-800/50 rounded"></div>)}
                 </div>
            ) : metrics.length === 0 ? (
                <div className="text-center py-20">
                    <h3 className="text-xl font-bold text-gray-500 mb-2">No Performance Data Found</h3>
                    <p className="text-gray-600 mb-4">Perform some requests to your app to generate data.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Critical Incidents (Deadlocks) */}
                    {deadlocks.length > 0 && (
                        <div className="card glass p-0 overflow-hidden border-red-600/50 shadow-[0_0_15px_rgba(220,38,38,0.3)] animate-pulse-slow">
                             <div className="p-3 bg-red-900/40 border-b border-red-600/50 flex justify-between items-center">
                                <h3 className="font-bold text-red-100 text-sm uppercase flex items-center gap-2">
                                    <span>☠️ Critical Incidents Detected</span>
                                    <span className="badge bg-red-600 border-none text-white text-xs">{deadlocks.length}</span>
                                </h3>
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="text-red-200/50 bg-red-900/20">
                                    <tr>
                                        <th className="p-2 w-32">Time</th>
                                        <th className="p-2">Error Message</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-red-500/10">
                                    {deadlocks.map((d, i) => (
                                        <tr key={i} className="hover:bg-red-500/10">
                                            <td className="p-2 font-mono text-red-300">{d.timestamp}</td>
                                            <td className="p-2 font-mono text-white break-words">{d.message}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Top Stats */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Slowest Requests */}
                        <div className="card glass p-0 overflow-hidden border-orange-500/20">
                            <div className="p-3 bg-orange-900/20 border-b border-orange-500/20 flex justify-between items-center">
                                <h3 className="font-bold text-orange-400 text-sm uppercase">🐢 Slowest Endpoints</h3>
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="text-gray-500 bg-black/20">
                                    <tr>
                                        <th className="p-2">URI</th>
                                        <th className="p-2 text-right">Time (ms)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {slowestRequests.map((r, i) => (
                                        <tr key={i} className="hover:bg-white/5">
                                            <td className="p-2 truncate max-w-[150px]" title={r.uri}>
                                                <span className="font-mono text-gray-300">{r.method}</span> {r.uri}
                                            </td>
                                            <td className="p-2 text-right font-mono text-orange-300">{r.duration_ms}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Heavy Queries */}
                        <div className="card glass p-0 overflow-hidden border-blue-500/20">
                             <div className="p-3 bg-blue-900/20 border-b border-blue-500/20 flex justify-between items-center">
                                <h3 className="font-bold text-blue-400 text-sm uppercase">🐘 Heavy Database</h3>
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="text-gray-500 bg-black/20">
                                    <tr>
                                        <th className="p-2">URI</th>
                                        <th className="p-2 text-right">Queries</th>
                                    </tr>
                                </thead>
                                 <tbody className="divide-y divide-white/5">
                                    {heaviestQueries.map((r, i) => (
                                        <tr key={i} className="hover:bg-white/5">
                                            <td className="p-2 truncate max-w-[150px]" title={r.uri}>
                                                 <span className="font-mono text-gray-300">{r.method}</span> {r.uri}
                                            </td>
                                            <td className="p-2 text-right font-mono text-blue-300">{r.query_count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                         {/* Memory Hogs */}
                         <div className="card glass p-0 overflow-hidden border-pink-500/20">
                             <div className="p-3 bg-pink-900/20 border-b border-pink-500/20 flex justify-between items-center">
                                <h3 className="font-bold text-pink-400 text-sm uppercase">💾 Memory Hogs</h3>
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="text-gray-500 bg-black/20">
                                    <tr>
                                        <th className="p-2">URI</th>
                                        <th className="p-2 text-right">MB</th>
                                    </tr>
                                </thead>
                                 <tbody className="divide-y divide-white/5">
                                    {memoryHogs.map((r, i) => (
                                        <tr key={i} className="hover:bg-white/5">
                                            <td className="p-2 truncate max-w-[150px]" title={r.uri}>
                                                 <span className="font-mono text-gray-300">{r.method}</span> {r.uri}
                                            </td>
                                            <td className="p-2 text-right font-mono text-pink-300">{r.memory_mb}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Slow Query Analysis */}
                    {recentSlowQueries.length > 0 && (
                        <div className="card glass p-0 overflow-hidden border-red-500/20">
                            <div className="p-3 bg-red-900/20 border-b border-red-500/20">
                                <h3 className="font-bold text-red-400 text-sm uppercase">🚨 Slow Queries Detected ({'>'}50ms)</h3>
                            </div>
                            <table className="w-full text-left text-xs">
                                <thead className="text-gray-500 bg-black/20">
                                    <tr>
                                        <th className="p-2 w-24 text-right">Time</th>
                                        <th className="p-2 w-32">Page</th>
                                        <th className="p-2">SQL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {recentSlowQueries.map((q, i) => (
                                        <tr key={i} className="hover:bg-white/5 group">
                                            <td className="p-2 text-right font-mono text-red-300 font-bold">{q.duration}ms</td>
                                            <td className="p-2 font-mono text-gray-400 truncate max-w-[200px]" title={q.uri}>{q.uri}</td>
                                            <td className="p-2 font-mono text-gray-300 break-all">
                                                {q.sql}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            
            {/* Recent History List */}
            {!loading && metrics.length > 0 && (
                <div className="mt-6">
                    <h3 className="font-bold text-gray-400 mb-2 uppercase text-xs">Recent Requests History</h3>
                    <div className="card glass overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white/5 text-gray-400">
                                <tr>
                                    <th className="p-3">Time</th>
                                    <th className="p-3">Method</th>
                                    <th className="p-3">URI</th>
                                    <th className="p-3 text-right">Duration</th>
                                    <th className="p-3 text-right">Queries</th>
                                    <th className="p-3 text-right">Memory</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {metrics.slice(0, 20).map((r, i) => (
                                    <tr key={i} className="hover:bg-white/5">
                                        <td className="p-3 text-gray-500">{r.timestamp || '-'}</td>
                                        <td className="p-3 font-mono">
                                            <span className={`px-2 py-0.5 rounded ${r.method === 'GET' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>
                                                {r.method}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-gray-300">{r.uri}</td>
                                        <td className={`p-3 text-right font-mono ${r.duration_ms > 500 ? 'text-orange-400 font-bold' : 'text-gray-400'}`}>
                                            {r.duration_ms}ms
                                        </td>
                                        <td className={`p-3 text-right font-mono ${r.query_count > 10 ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>
                                            {r.query_count}
                                        </td>
                                        <td className={`p-3 text-right font-mono ${r.memory_mb > 20 ? 'text-pink-400 font-bold' : 'text-gray-400'}`}>
                                            {r.memory_mb}MB
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
