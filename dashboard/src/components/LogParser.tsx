"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import VirtualList from "./VirtualList";

const List = VirtualList;

interface LogEntry {
  id: number;
  raw: string;
  timestamp: string;
  env: string;
  level: string;
  message: string;
}

import LogDetailModal from "./LogDetailModal";

// ... existing imports

export default function LogParser() {
  const [file, setFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("ALL");
  const [parsingTime, setParsingTime] = useState(0);
  
  // Modal State
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // States for list sizing
  const [listHeight, setListHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);

  // ... (Resize observer, parsing logic same as before)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loading, logs.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseFile(e.target.files[0]);
    }
  };

  const parseFile = async (f: File) => {
      // ... (existing parse logic)
      setFile(f);
    setLoading(true);
    setLogs([]);
    setProgress(0);
    const start = performance.now();
    
    const text = await f.text();
    setProgress(50);

    setTimeout(() => {
        const lines = text.split('\n');
        const parsed: LogEntry[] = [];
        const regex = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+)\.(\w+): (.*)/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            const match = line.match(regex);
            if (match) {
                parsed.push({
                    id: i,
                    raw: line,
                    timestamp: match[1],
                    env: match[2],
                    level: match[3].toUpperCase(),
                    message: match[4]
                });
            } else {
                 parsed.push({
                    id: i,
                    raw: line,
                    timestamp: '',
                    env: '',
                    level: 'UNKNOWN',
                    message: line
                });
            }
        }
        
        setLogs(parsed);
        setLoading(false);
        setParsingTime(performance.now() - start);
        setProgress(100);
    }, 100);
  };

  // Memoized Filters
  const filteredLogs = useMemo(() => {
      if (!search && level === "ALL") return logs;
      
      const lowerSearch = search.toLowerCase();
      return logs.filter(log => {
          const matchesSearch = !search || log.raw.toLowerCase().includes(lowerSearch);
          const matchesLevel = level === "ALL" || log.level === level;
          return matchesSearch && matchesLevel;
      });
  }, [logs, search, level]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const log = filteredLogs[index];
    return (
      <div 
        style={style} 
        onClick={() => setSelectedLog(log)}
        className="flex gap-2 px-2 hover:bg-white/10 border-b border-white/5 text-xs font-mono items-center whitespace-nowrap cursor-pointer transition-colors"
      >
        {log.timestamp && <span className="text-gray-500 w-[140px] shrink-0">[{log.timestamp}]</span>}
        <span className={`w-[60px] font-bold shrink-0 ${getLevelColor(log.level)}`}>{log.level !== 'UNKNOWN' ? log.level : ''}</span>
        <span className="text-gray-300 truncate w-full">{log.message}</span>
      </div>
    );
  };
  
  return (
    <div className="flex flex-col h-full relative">
       {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}

      {/* Configuration / Drop Area */}
      {!file ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-lg bg-white/5 m-4">
              <input 
                type="file" 
                onChange={handleFileChange} 
                className="hidden" 
                id="file-upload"
                accept=".log,.txt"
              />
              <label htmlFor="file-upload" className="btn btn-primary btn-lg cursor-pointer">
                  Select Log File
              </label>
              <p className="mt-4 text-gray-400">or drag and drop here (Max 200MB)</p>
          </div>
      ) : (
          <>
            {/* Toolbar */}
             <div className="p-4 border-b border-white/10 bg-slate-900/50 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => { setFile(null); setLogs([]); }} className="btn btn-ghost btn-sm text-gray-400 hover:text-white">
                        ← Pick Different File
                    </button>
                    <div>
                        <h3 className="font-bold">{file.name}</h3>
                        <p className="text-xs text-gray-500">
                            {logs.length.toLocaleString()} lines parsed in {(parsingTime / 1000).toFixed(2)}s
                            {loading && <span className="ml-2 text-blue-400 animate-pulse">Processing...</span>}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Search logs..." 
                        className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500 w-64"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select 
                        className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                    >
                         {["ALL", "DEBUG", "INFO", "NOTICE", "WARNING", "ERROR", "CRITICAL", "ALERT", "EMERGENCY"].map(l => (
                             <option key={l} value={l}>{l}</option>
                         ))}
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 bg-[#0d1117]" ref={containerRef}>
                {loading ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        Loading File...
                    </div>
                ) : (
                     <List
                        height={listHeight}
                        itemCount={filteredLogs.length}
                        itemSize={30} // Row height
                        width="100%"
                    >
                        {Row}
                    </List>
                )}
            </div>
            
            <div className="bg-slate-900 p-2 text-xs text-center text-gray-500 border-t border-white/10">
                Found {filteredLogs.length.toLocaleString()} matches
            </div>
          </>
      )}
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
