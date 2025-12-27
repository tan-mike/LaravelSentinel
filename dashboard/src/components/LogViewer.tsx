"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import LogDetailModal from "./LogDetailModal";

// ... previous code

export default function LogViewer({
  projectPath,
  onClose,
}: {
  projectPath: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any | null>(null); // Quick any for now
  
  // ... (existing state and useEffect)
  // Filter States
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // asc = oldest first (default log order)
  
  const endRef = useRef<HTMLDivElement>(null);

  // ... (fetchLogs same)
  async function fetchLogs() {
    try {
      setLoading(true);
      const data = await api.fetchLogs(projectPath);
      setLogs(data.lines);
      setError(null);
    } catch (e) {
      setError("Failed to load logs");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, [projectPath]);

  // Parsing & Filtering
  const parsedLogs = logs.map(line => {
      // Regex to parse Laravel/Monolog format: [2024-12-27 15:00:00] env.LEVEL: Message
      const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+)\.(\w+): (.*)/);
      if (match) {
          return {
              raw: line,
              timestamp: match[1],
              env: match[2],
              level: match[3].toUpperCase(),
              message: match[4]
          };
      }
      return { raw: line, timestamp: '', env: '', level: 'UNKNOWN', message: line };
  });

  const filteredLogs = parsedLogs.filter(log => {
      // ... filters
      const matchesSearch = log.raw.toLowerCase().includes(search.toLowerCase());
      const matchesLevel = level === "ALL" || log.level === level;
      return matchesSearch && matchesLevel;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
      // ... sorting
       if (!a.timestamp || !b.timestamp) return 0;
      return sortOrder === 'asc' 
          ? a.timestamp.localeCompare(b.timestamp) 
          : b.timestamp.localeCompare(a.timestamp);
  });

  // ... (auto scroll effect)
  // Auto-scroll to bottom only if sorting is ASC (newest at bottom) and not searching deep history
  useEffect(() => {
      if (logs.length > 0 && sortOrder === 'asc' && endRef.current) {
          endRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [logs, sortOrder, level, search]);

  const levels = ["ALL", "DEBUG", "INFO", "NOTICE", "WARNING", "ERROR", "CRITICAL", "ALERT", "EMERGENCY"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
      
      <div className="card w-full max-w-5xl h-[85vh] flex flex-col glass relative overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
            <h2 className="text-xl font-bold">Log Viewer</h2>
            <div className="flex gap-2">
                <button onClick={fetchLogs} className="btn hover:bg-white/10 text-sm">Refresh</button>
                <button onClick={onClose} className="btn hover:bg-white/10 text-sm">Close</button>
            </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-white/10 bg-slate-800/50 flex flex-wrap gap-4 items-center">
            {/* Search */}
             <div className="flex-1 min-w-[200px]">
                <input 
                    type="text" 
                    placeholder="Search logs..." 
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            
            {/* Level Filter */}
            <select 
                className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
            >
                {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            {/* Sort Toggle */}
            <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="btn bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 flex gap-1 items-center"
            >
                {sortOrder === 'asc' ? 'Oldest First ↓' : 'Newest First ↑'}
            </button>
        </div>

        {/* Logs Output */}
        <div className="flex-1 overflow-auto bg-[#0d1117] p-4 font-mono text-sm text-gray-300">
            {loading && logs.length === 0 ? (
                <div className="text-center py-20 text-gray-500">Loading logs...</div>
            ) : error ? (
                <div className="text-center py-20 text-red-400">{error}</div>
            ) : (
                <>
                    {sortedLogs.length === 0 ? (
                         <div className="text-center py-20 text-gray-600">
                             {logs.length === 0 ? "Log file is empty." : "No logs match your filters."}
                         </div>
                    ) : (
                        sortedLogs.map((log, i) => (
                            <div 
                                key={i} 
                                onClick={() => setSelectedLog(log)}
                                className="whitespace-nowrap border-b border-white/5 py-1 hover:bg-white/10 px-2 flex gap-3 cursor-pointer transition-colors items-center"
                            >
                                {log.timestamp && (
                                    <span className="text-gray-500 shrink-0 select-none w-[150px]">[{log.timestamp}]</span>
                                )}
                                <span className={`font-bold shrink-0 w-[80px] ${getLevelColor(log.level)}`}>
                                    {log.level !== 'UNKNOWN' ? log.level : ''}
                                </span>
                                <span className="truncate w-full block">{log.message}</span>
                            </div>
                        ))
                    )}
                    <div ref={endRef} />
                </>
            )}
        </div>
        
        {/* Footer */}
        <div className="p-2 bg-slate-900 border-t border-white/10 text-xs flex justify-between px-4 text-gray-500">
            <span>{filteredLogs.length} matching lines</span>
            <span>Total: {logs.length} lines</span>
        </div>
      </div>
    </div>
  );
}

function getLevelColor(level: string) {
    switch (level) {
        case 'ERROR': case 'CRITICAL': case 'ALERT': case 'EMERGENCY': return 'text-red-400';
        case 'WARNING': return 'text-yellow-400';
        case 'NOTICE': return 'text-blue-400';
        case 'INFO': return 'text-green-400';
        case 'DEBUG': return 'text-purple-400';
        default: return 'text-gray-400';
    }
}
