"use client";

import { useEffect, useState } from "react";

interface LogDetailModalProps {
  log: {
    raw: string;
    timestamp: string;
    level: string;
    message: string;
    env?: string;
  };
  onClose: () => void;
}

export default function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  const [formattedMessage, setFormattedMessage] = useState<string>(log.message);
  const [isJson, setIsJson] = useState(false);

  useEffect(() => {
    // Attempt to detect and format JSON in the message
    try {
        // Sometimes JSON is embedded like: "Some text {json}" or just "{json}"
        // For simple formatting, if the whole message parses as JSON, pretty print it.
        const trimmed = log.message.trim();
        if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            const parsed = JSON.parse(trimmed);
            setFormattedMessage(JSON.stringify(parsed, null, 2));
            setIsJson(true);
        } else {
             // Check for "context: {...}" pattern common in Monolog
             const contextMatch = log.message.match(/(.*?)(\{.*\})$/s);
             if (contextMatch && contextMatch[2]) {
                 const textPart = contextMatch[1];
                 const jsonPart = JSON.parse(contextMatch[2]);
                 setFormattedMessage(textPart + "\n\n" + JSON.stringify(jsonPart, null, 2));
                 setIsJson(true);
             }
        }
    } catch (e) {
        // Not JSON, keep as is
    }
  }, [log.message]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="card w-full max-w-4xl max-h-[90vh] flex flex-col glass border border-white/20 shadow-2xl scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-start bg-slate-900/80">
            <div>
                 <div className="flex gap-2 items-center mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${getLevelBadgeColor(log.level)}`}>
                        {log.level}
                    </span>
                    <span className="text-gray-400 text-sm font-mono">{log.timestamp}</span>
                    {log.env && <span className="text-gray-500 text-xs uppercase tracking-wider">[{log.env}]</span>}
                 </div>
            </div>
            <button onClick={onClose} className="btn hover:bg-white/10 text-xl leading-none px-2">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-[#0d1117] font-mono text-sm">
            <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2 select-none">Log Message</h4>
            <div className={`whitespace-pre-wrap break-all ${isJson ? 'text-green-300' : 'text-gray-300'}`}>
                {formattedMessage}
            </div>

            <div className="mt-8 pt-4 border-t border-white/10">
                 <h4 className="text-gray-500 text-xs uppercase tracking-wider mb-2 select-none">Raw Line</h4>
                 <div className="bg-black/30 p-3 rounded text-gray-500 text-xs break-all">
                    {log.raw}
                 </div>
            </div>
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-slate-900/50 flex justify-end">
            <button onClick={onClose} className="btn bg-white/10 hover:bg-white/20">Close</button>
        </div>
      </div>
    </div>
  );
}

function getLevelBadgeColor(level: string) {
    switch (level) {
        case 'ERROR': case 'CRITICAL': case 'ALERT': case 'EMERGENCY': return 'bg-red-500/20 text-red-300';
        case 'WARNING': return 'bg-yellow-500/20 text-yellow-300';
        case 'NOTICE': return 'bg-blue-500/20 text-blue-300';
        case 'INFO': return 'bg-green-500/20 text-green-300';
        case 'DEBUG': return 'bg-purple-500/20 text-purple-300';
        default: return 'bg-gray-700 text-gray-400';
    }
}
