const HOST = process.env.NEXT_PUBLIC_SENTINEL_HOST || 'http://localhost';
const PORT = process.env.NEXT_PUBLIC_SENTINEL_PORT || 8888;
const BASE_URL = `${HOST}:${PORT}`;

export interface Project {
  name: string;
  path: string;
}

export interface Config {
  workspace_root: string;
  host: string;
  port: number;
  ignored_projects?: string[];
  cpu_threshold?: number;
  nginx_log_path?: string;
  php_fpm_path?: string;
}

export interface TelemetryStatus {
  php_fpm: boolean;
  system_stats: {
    memory_usage_mb: number;
    num_goroutines: number;
    php_web_memory_mb: number;
    php_cli_memory_mb: number;
    php_fpm_cpu_percent: number;
    php_fpm_worker_count: number;
  };
}

export interface Incident {
    timestamp: string;
    cpu_percent: number;
    suspect_requests: string[];
}

export interface RoutesParsed {
    domain: string | null;
    method: string;
    uri: string;
    name: string | null;
    action: string;
    middleware: string[] | string;
}

export interface LogsParsed {
    lines: string[];
}

export interface PerformanceEntry {
    method: string;
    uri: string;
    duration_ms: number;
    memory_mb: number;
    query_count: number;
    timestamp: string;
}

export const api = {
  fetchPerformance: async (projectPath: string): Promise<PerformanceEntry[]> => {
      try {
        const res = await fetch(`${BASE_URL}/projects/performance?path=${encodeURIComponent(projectPath)}`);
        if(!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
  },

  runnerStart: async (path: string, port: number, with_queue: boolean) => {
    await fetch(`${BASE_URL}/runner/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, port, with_queue })
    });
  },

  runnerStop: async (path: string) => {
    await fetch(`${BASE_URL}/runner/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
  },

  runnerStatus: async (): Promise<Record<string, { port: number, running: boolean, type: string }>> => {
      try {
        const res = await fetch(`${BASE_URL}/runner/status`);
        return res.json();
      } catch {
        return {};
      }
  },

  fetchHealth: async () => {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  fetchProjects: async (includeIgnored = false): Promise<Project[]> => {
    try {
      const url = includeIgnored ? `${BASE_URL}/projects?include_ignored=true` : `${BASE_URL}/projects`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  },

  fetchTelemetry: async (): Promise<TelemetryStatus> => {
    const res = await fetch(`${BASE_URL}/telemetry`);
    if (!res.ok) throw new Error('Failed to fetch telemetry');
    return res.json();
  },

  fetchConfig: async (): Promise<Config> => {
    const res = await fetch(`${BASE_URL}/config`);
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  },

  updateConfig: async (config: Config) => {
    const res = await fetch(`${BASE_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to update config');
    return res.json();
  },

  restartAgent: async () => {
    // Fire and forget, or expect error as connection drops
    try {
      await fetch(`${BASE_URL}/restart`, { method: 'POST' });
    } catch (e) {
      // Ignore connection error on restart
      console.log("Restart triggered", e);
    }
  },

  fetchRoutes: async (projectPath: string): Promise<RoutesParsed[] | null> => {
      try {
        const res = await fetch(`${BASE_URL}/projects/routes?path=${encodeURIComponent(projectPath)}`);
        if(!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
  },

  fetchLogs: async (projectPath: string): Promise<LogsParsed> => {
      try {
        const res = await fetch(`${BASE_URL}/projects/logs?path=${encodeURIComponent(projectPath)}`);
        if(!res.ok) return { lines: [] };
        return res.json();
      } catch {
        return { lines: [] };
      }
  },

  proxyRequest: async (method: string, url: string, headers: Record<string, string>, body: string) => {
      const res = await fetch(`${BASE_URL}/proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method, url, headers, body })
      });
      
      const responseBody = await res.text();
      return {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body: responseBody
      };
  },

  fetchAlerts: async (): Promise<Incident | null> => {
    try {
        const res = await fetch(`${BASE_URL}/alerts`);
        if (res.status === 204) return null;
        return res.json();
    } catch {
        return null;
    }
  }
};
