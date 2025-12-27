"use client";

import { useEffect, useState } from "react";
import { api, RoutesParsed } from "@/lib/api";

export default function RouteExplorer({
  projectPath,
  onClose,
}: {
  projectPath: string;
  onClose: () => void;
}) {
  const [routes, setRoutes] = useState<RoutesParsed[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Test State
  const [testRoute, setTestRoute] = useState<RoutesParsed | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const data = await api.fetchRoutes(projectPath);
        if (data === null) {
            setError("Failed to load routes. Ensure 'php artisan route:list' works in this project.");
        } else {
            setRoutes(data);
        }
      } catch (e) {
        setError("Failed to load routes");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [projectPath]);

  const filteredRoutes = routes.filter((r) =>
    r.uri.toLowerCase().includes(search.toLowerCase()) ||
    (r.action && r.action.toLowerCase().includes(search.toLowerCase())) ||
    (r.name && r.name.toLowerCase().includes(search.toLowerCase()))
  );

  const methodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case "GET": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "POST": return "bg-green-500/20 text-green-300 border-green-500/30";
      case "PUT": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "DELETE": return "bg-red-500/20 text-red-300 border-red-500/30";
      default: return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-5xl h-[80vh] flex flex-col glass relative overflow-hidden">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <h2 className="text-xl font-bold">Route Explorer {testRoute && `> Test ${testRoute.uri}`}</h2>
            <button onClick={onClose} className="btn hover:bg-white/10">Close</button>
        </div>

        {!testRoute ? (
             <>
                <div className="p-4 border-b border-white/10">
                    <input 
                        type="text" 
                        placeholder="Search routes..." 
                        className="w-full bg-slate-900/50 border border-slate-700 rounded px-4 py-2 outline-none focus:border-blue-500 transition"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-auto p-4">
                    {loading ? (
                        <div className="text-center py-20 text-gray-500">Loading routes...</div>
                    ) : error ? (
                        <div className="text-center py-20 text-red-400">{error}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-gray-400 border-b border-white/5">
                                    <tr>
                                        <th className="pb-3 pl-2">Method</th>
                                        <th className="pb-3">URI</th>
                                        <th className="pb-3">Name</th>
                                        <th className="pb-3">Action</th>
                                        <th className="pb-3">Middleware</th>
                                        <th className="pb-3 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredRoutes.map((route, i) => (
                                        <tr key={i} className="hover:bg-white/5 group">
                                            <td className="py-3 pl-2">
                                                <span className={`px-2 py-1 rounded text-xs border ${methodColor(route.method.split('|')[0])}`}>
                                                    {route.method}
                                                </span>
                                            </td>
                                            <td className="py-3 font-mono text-gray-300">{route.uri}</td>
                                            <td className="py-3 text-gray-400">{route.name || '-'}</td>
                                            <td className="py-3 text-gray-400 truncate max-w-xs" title={route.action}>{route.action}</td>
                                            <td className="py-3 text-gray-500 text-xs truncate max-w-xs" title={Array.isArray(route.middleware) ? route.middleware.join(', ') : route.middleware}>
                                                {Array.isArray(route.middleware) ? route.middleware.join(', ') : route.middleware}
                                            </td>
                                            <td className="py-3">
                                                <button 
                                                    onClick={() => setTestRoute(route)}
                                                    className="btn bg-blue-600 hover:bg-blue-500 text-xs py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    Test
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredRoutes.length === 0 && (
                                <div className="text-center py-10 text-gray-500">No routes found matching your search.</div>
                            )}
                        </div>
                    )}
                </div>
            </>
        ) : (
            <TestInterface route={testRoute} onBack={() => setTestRoute(null)} />
        )}
      </div>
    </div>
  );
}

function TestInterface({ route, onBack }: { route: RoutesParsed, onBack: () => void }) {
    const [url, setUrl] = useState(route.uri);
    const [method, setMethod] = useState(route.method.split('|')[0]);
    const [headers, setHeaders] = useState("{\n  \"Content-Type\": \"application/json\",\n  \"Accept\": \"application/json\"\n}");
    const [body, setBody] = useState("");
    
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Replace {params} in URI with placeholders
    useEffect(() => {
        // Simple heuristic to ensure fully qualified URL if needed, but proxy takes relative URI usually?
        // Actually proxy executes request from Agent, so 'http://127.0.0.1:8000/api/users' etc.
        // But we don't know the local dev port of the specific laravel app from here easily without asking.
        // Users usually run 'php artisan serve' on 8000. 
        // We will default to relative '/uri' and let user prepend domain if needed, or default localhost:8000
        let effectiveUri = route.uri.startsWith('/') ? route.uri : '/' + route.uri;
        setUrl(`http://127.0.0.1:8000${effectiveUri}`);
    }, [route]);

    const handleSend = async () => {
        setLoading(true);
        setResponse(null);
        try {
            const parsedHeaders = JSON.parse(headers);
            const res = await api.proxyRequest(method, url, parsedHeaders, body);
            setResponse(res);
        } catch (e) {
            setResponse({ error: "Request Failed", details: String(e) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-1 overflow-hidden">
             {/* Left: Request Config */}
            <div className="w-1/2 border-r border-white/10 p-4 flex flex-col overflow-auto bg-[#0d1117]">
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={onBack} className="text-gray-400 hover:text-white">&larr; Back</button>
                    <h3 className="font-bold">Request Configuration</h3>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-2">
                        <select 
                            value={method} 
                            onChange={e => setMethod(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm font-bold w-24"
                        >
                            {["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input 
                            type="text" 
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm font-mono text-blue-300"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={loading}
                            className="btn btn-primary px-6"
                        >
                            {loading ? 'Sending...' : 'Send'}
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs uppercase text-gray-500 mb-1 font-bold">Headers (JSON)</label>
                        <textarea 
                            value={headers}
                            onChange={e => setHeaders(e.target.value)}
                            className="w-full h-32 bg-slate-800 border border-slate-700 rounded p-2 font-mono text-xs text-green-300 focus:border-blue-500 outline-none"
                            spellCheck={false}
                        />
                    </div>

                     <div>
                        <label className="block text-xs uppercase text-gray-500 mb-1 font-bold">Body</label>
                        <textarea 
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            className="w-full h-40 bg-slate-800 border border-slate-700 rounded p-2 font-mono text-xs text-gray-300 focus:border-blue-500 outline-none"
                            placeholder="Raw body content..."
                            spellCheck={false}
                        />
                    </div>
                </div>
            </div>

            {/* Right: Response */}
            <div className="w-1/2 p-4 flex flex-col overflow-auto bg-[#0d1117] relative">
                <h3 className="font-bold mb-4 pl-2 border-l-2 border-blue-500">Response</h3>
                
                {response ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex gap-4 text-sm font-mono border-b border-white/10 pb-2">
                            <span className={response.status >= 200 && response.status < 300 ? "text-green-400" : "text-red-400"}>
                                Status: {response.status}
                            </span>
                        </div>
                        
                         <div>
                            <label className="block text-xs uppercase text-gray-500 mb-1 font-bold">Headers</label>
                            <pre className="text-xs text-gray-400 font-mono overflow-auto max-h-32 bg-white/5 p-2 rounded">
                                {JSON.stringify(response.headers, null, 2)}
                            </pre>
                        </div>

                        <div>
                            <label className="block text-xs uppercase text-gray-500 mb-1 font-bold">Body</label>
                            <pre className="text-xs text-blue-100 font-mono overflow-auto bg-slate-900 p-2 rounded border border-white/5">
                                {response.body}
                                {tryFormatJson(response.body)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-600">
                        Ready to send request...
                    </div>
                )}
            </div>
        </div>
    );
}

function tryFormatJson(str: string) {
    try {
        const obj = JSON.parse(str);
        return <div className="hidden">{/* Just a helper, visual display handled by raw body for now or enhance later */}</div>;
        // actually let's just replace the display if parsable
    } catch { 
        return null 
    }
}
