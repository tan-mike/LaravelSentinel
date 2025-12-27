"use client";

import { useEffect, useState } from "react";
import { api, Project, TelemetryStatus } from "@/lib/api";
import Link from "next/link";

import RouteExplorer from "@/components/RouteExplorer";
import LogViewer from "@/components/LogViewer";
import PerformanceAudit from "@/components/PerformanceAudit";

function ProjectCard({ project, onViewRoutes, onViewLogs, onAudit }: { 
    project: Project; 
    onViewRoutes: () => void; 
    onViewLogs: () => void; 
    onAudit: () => void; 
}) {
    const [port, setPort] = useState(8000 + (project.path.length % 100)); // Simple unique-ish default
    const [withQueue, setWithQueue] = useState(false);
    const [running, setRunning] = useState(false);
    const [actualPort, setActualPort] = useState(0);
    const [loading, setLoading] = useState(false);

    // Initial check
    useEffect(() => {
        api.runnerStatus().then(status => {
             const key = project.path + ":web";
             if (status[key] && status[key].running) {
                 setRunning(true);
                 setActualPort(status[key].port);
                 setPort(status[key].port);
             }
        });
    }, [project.path]);

    const handleStart = async () => {
        setLoading(true);
        try {
            await api.runnerStart(project.path, port, withQueue);
            setRunning(true);
            setActualPort(port);
        } catch (e) {
            alert("Failed to start runner: " + e);
        }
        setLoading(false);
    };

    const handleStop = async () => {
        setLoading(true);
        try {
            await api.runnerStop(project.path);
            setRunning(false);
        } catch (e) {
             alert("Failed to stop runner: " + e);
        }
        setLoading(false);
    }

    return (
        <div className="card glass">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold mb-1">{project.name}</h3>
                    <p className="text-sm text-gray-500 mb-4 font-mono truncate max-w-xs" title={project.path}>
                        {project.path}
                    </p>
                </div>
                {running && (
                    <div className="badge bg-green-500/20 text-green-400 border-green-500/50 animate-pulse">
                        Running on :{actualPort}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-2 mt-2 border-b border-white/5 pb-4 mb-4">
                <button className="btn bg-slate-700 hover:bg-slate-600 text-xs" onClick={onViewRoutes}>
                   Routes
                </button>
                <button className="btn bg-slate-700 hover:bg-slate-600 text-xs" onClick={onViewLogs}>
                   View Logs
                </button>
                <button className="btn bg-purple-600 hover:bg-purple-500 text-xs text-white" onClick={onAudit}>
                   Audit Perf
                </button>
            </div>

            {/* Runner Controls */}
            <div className="bg-black/20 p-3 rounded border border-white/5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">Audit Server</span>
                    {running && <a href={`http://127.0.0.1:${actualPort}`} target="_blank" className="text-xs text-blue-400 hover:underline">Open Browser ↗</a>}
                </div>
                
                {!running ? (
                    <div className="flex items-end gap-2">
                        <div>
                            <label className="text-[10px] text-gray-500 block mb-1">Port</label>
                            <input 
                                type="number" 
                                className="input h-8 w-20 text-xs bg-black/40 border-white/10" 
                                value={port} 
                                onChange={(e) => setPort(parseInt(e.target.value))}
                            />
                        </div>
                         <div className="flex items-center gap-2 mb-2">
                            <input 
                                type="checkbox" 
                                checked={withQueue} 
                                onChange={(e) => setWithQueue(e.target.checked)}
                                className="checkbox checkbox-xs checkbox-primary"
                            />
                            <span className="text-xs text-gray-400">+ Queue</span>
                        </div>
                        <button 
                            onClick={handleStart} 
                            disabled={loading}
                            className="btn bg-green-600 hover:bg-green-500 text-white text-xs h-8 flex-1"
                        >
                            {loading ? "..." : "▶ Start"}
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={handleStop} 
                        disabled={loading}
                        className="btn bg-red-900/50 hover:bg-red-800/80 text-red-200 border-red-500/30 w-full text-xs h-8"
                    >
                        {loading ? "..." : "⏹ Stop Server"}
                    </button>
                )}
            </div>
        </div>
    );
}

export default function Home() {
  const [health, setHealth] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<TelemetryStatus | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // View State
  const [viewProject, setViewProject] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'routes' | 'logs' | 'performance' | null>(null);

  useEffect(() => {
    async function load() {
      const h = await api.fetchHealth();
      setHealth(h);
      if (h) {
        try {
          const [t, p] = await Promise.all([
            api.fetchTelemetry(),
            api.fetchProjects(),
          ]);
          setTelemetry(t);
          setProjects(p || []);
        } catch (e) {
            console.error(e);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="container">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Laravel Sentinel</h1>
          <p className="text-gray-400">Local Development Dashboard</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-4">
             {telemetry && (
                 <Link href="/metrics" className="hidden md:flex gap-3 text-xs font-mono text-gray-400 bg-black/20 p-2 rounded border border-white/5 hover:bg-black/40 hover:border-white/20 transition cursor-pointer" title="Click to view full System Metrics">
                     <span title="PHP Web Memory (PHP-FPM)">PHP: {telemetry.system_stats?.php_web_memory_mb ?? '?'}MB</span>
                     <span className="text-gray-600">|</span>
                     <span title="Agent Memory Usage">AGT: {telemetry.system_stats?.memory_usage_mb ?? '?'}MB</span>
                 </Link>
             )}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
              <div className={`w-2 h-2 rounded-full ${health ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></div>
              <span className="text-xs font-medium text-gray-300">Agent</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700">
              <div className={`w-2 h-2 rounded-full ${telemetry?.php_fpm ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-gray-600'}`}></div>
               <span className="text-xs font-medium text-gray-300">PHP-FPM</span>
            </div>
          </div>
            <Link href="/log-parser" className="btn bg-slate-800 hover:bg-slate-700 text-gray-300 border-slate-700">
                Log Parser
            </Link>
            <Link href="/settings" className="btn btn-primary glass">
                Settings
            </Link>
        </div>
      </header>

      {loading ? (
        <div className="grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card glass animate-pulse">
                <div className="h-6 bg-slate-700/50 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-slate-700/30 rounded w-2/3 mb-6"></div>
                <div className="flex gap-2">
                    <div className="h-8 bg-slate-700/50 rounded w-24"></div>
                    <div className="h-8 bg-slate-700/50 rounded w-24"></div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <main>
          {!health && (
             <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded mb-8">
                <strong>Connection Error:</strong> Could not connect to Sentinel Agent. Ensure it is running on port 8888.
             </div>
          )}

          <h2 className="text-xl font-semibold mb-4">Discovered Projects</h2>
          
          {projects.length === 0 ? (
              <div className="card text-center py-10 text-gray-400">
                  No projects found. Check your workspace settings.
              </div>
          ) : (
              <div className="grid">
                {projects.map((project) => (
                  <ProjectCard 
                    key={project.path} 
                    project={project} 
                    onViewRoutes={() => { setViewProject(project.path); setViewMode('routes'); }}
                    onViewLogs={() => { setViewProject(project.path); setViewMode('logs'); }}
                    onAudit={() => { setViewProject(project.path); setViewMode('performance'); }}
                  />
                ))}
              </div>
          )}

          {viewProject && viewMode === 'routes' && (
              <RouteExplorer 
                projectPath={viewProject} 
                onClose={() => { setViewProject(null); setViewMode(null); }} 
              />
          )}

          {viewProject && viewMode === 'logs' && (
              <LogViewer 
                projectPath={viewProject} 
                onClose={() => { setViewProject(null); setViewMode(null); }} 
              />
          )}

          {viewProject && viewMode === 'performance' && (
              <PerformanceAudit
                projectPath={viewProject} 
                onClose={() => { setViewProject(null); setViewMode(null); }} 
              />
          )}

        </main>
      )}
    </div>
  );
}
