"use client";

import { useEffect, useState } from "react";
import { api, Config, Project } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Settings() {
  const router = useRouter();
  const [config, setConfig] = useState<Config>({
      workspace_root: "",
      host: "",
      port: 0,
      ignored_projects: []
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
        api.fetchConfig(),
        api.fetchProjects(true) // Fetch ALL projects including ignored
    ]).then(([c, p]) => {
        setConfig(c);
        setProjects(p || []);
        setLoading(false);
    }).catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
        await api.updateConfig(config);
        // Trigger restart
        await api.restartAgent();
        // Wait a bit for restart then redirect
        setTimeout(() => {
            router.push('/');
        }, 2000);
    } catch (err) {
        console.error(err);
        alert('Failed to save settings');
        setSaving(false);
    }
  };

  return (
    <div className="container max-w-2xl">
      <div className="mb-8">
        <Link href="/" className="text-gray-400 hover:text-white mb-4 inline-block">&larr; Back to Dashboard</Link>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {loading ? <div>Loading config...</div> : (
          <form onSubmit={handleSave} className="card glass space-y-6">
              <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Workspace Root</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    value={config.workspace_root}
                    onChange={e => setConfig({...config, workspace_root: e.target.value})}
                    placeholder="/Users/username/Development"
                  />
                  <p className="text-xs text-gray-500 mt-1">Directory to scan for Laravel projects.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Host</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                        value={config.host}
                        onChange={e => setConfig({...config, host: e.target.value})}
                      />
                  </div>

                  <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Port</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                        value={config.port}
                        onChange={e => setConfig({...config, port: parseInt(e.target.value)})}
                      />
                  </div>
              </div>

              {/* Watchdog Configuration */}
              <div className="border-t border-slate-700 pt-4 space-y-4">
                 <h3 className="text-sm font-medium text-gray-300">CPU Watchdog</h3>
                 
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">CPU Threshold (%)</label>
                        <input 
                            type="number" 
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                            value={config.cpu_threshold || 50}
                            onChange={e => setConfig({...config, cpu_threshold: parseInt(e.target.value)})}
                        />
                        <p className="text-xs text-gray-500 mt-1">Alert when FPM CPU exceeds this.</p>
                     </div>
                     <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Nginx Access Log</label>
                        <input 
                            type="text" 
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                            value={config.nginx_log_path || ""}
                            onChange={e => setConfig({...config, nginx_log_path: e.target.value})}
                            placeholder="/path/to/access.log"
                        />
                         <p className="text-xs text-gray-500 mt-1">Path to read suspect requests from.</p>
                     </div>
                 </div>
              </div>

              {/* Project Filtering */}
              <div className="border-t border-slate-700 pt-4">
                 <h3 className="text-sm font-medium mb-4 text-gray-300">Active Projects</h3>
                 <div className="bg-black/20 rounded border border-white/5 p-4 max-h-60 overflow-y-auto space-y-2">
                    {projects.length === 0 ? (
                        <div className="text-gray-500 text-sm">No projects found in workspace.</div>
                    ) : (
                        projects.map(p => {
                            const isIgnored = config.ignored_projects?.includes(p.path);
                            return (
                                <div key={p.path} className="flex items-center justify-between p-2 hover:bg-white/5 rounded">
                                    <div className="truncate max-w-[80%]">
                                        <div className="font-medium text-sm">{p.name}</div>
                                        <div className="text-xs text-gray-500 truncate" title={p.path}>{p.path}</div>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="toggle toggle-success toggle-sm"
                                        checked={!isIgnored} 
                                        onChange={(e) => {
                                            const currentIgnored = config.ignored_projects || [];
                                            let newIgnored;
                                            if (e.target.checked) {
                                                // Enable: Remove from ignored list
                                                newIgnored = currentIgnored.filter(path => path !== p.path);
                                            } else {
                                                // Disable: Add to ignored list
                                                newIgnored = [...currentIgnored, p.path];
                                            }
                                            setConfig({...config, ignored_projects: newIgnored});
                                        }}
                                    />
                                </div>
                            );
                        })
                    )}
                 </div>
                 <p className="text-xs text-gray-500 mt-2">Uncheck projects to hide them from the dashboard.</p>
              </div>

              <div className="pt-4 border-t border-slate-700">
                  <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                      {saving ? 'Saving & Restarting...' : 'Save & Restart Agent'}
                  </button>
                  <p className="text-xs text-center text-gray-500 mt-2">
                      The agent will restart to apply these changes.
                  </p>
              </div>
          </form>
      )}
    </div>
  );
}
