# Laravel Sentinel

Laravel Sentinel is a comprehensive observability and development toolkit for Laravel applications. It combines a lightweight backend agent (Go) with a modern dashboard (Next.js) to provide real-time telemetry, log analysis, and route debugging.

## Features

- 🔭 **Project Discovery**: Automatically detects Laravel projects in your workspace.
- 📊 **Real-time Telemetry**: Monitor system CPU, Memory, and specific PHP-FPM process stats.
- ⚡ **Performance Metrics**: View Web vs CLI memory usage and active worker counts.
- 🛣️ **Route Explorer**: Browse and test application routes with a built-in proxy capable of inspecting requests.
- 📝 **Log Viewer**: View project logs with real-time filtering, sorting, and detail inspection.
- 📂 **Log Parser**: Offline tool to analyze large log files (drag & drop support for 200MB+ files).
- ⚙️ **Process Management**: Start/Stop `sentinel:run` CLI runners directly from the dashboard.

## Prerequisites

- **Go**: 1.22 or higher
- **Node.js**: 18 or higher (LTS recommended)
- **PHP**: 8.2 or higher
- **Laravel**: Compatible with Laravel 10/11+

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mike/sentinel-agent.git
   cd sentinel-agent
   ```

2. **Setup the Agent (Backend)**:
   ```bash
   cd agent
   go mod tidy
   ```

3. **Setup the Dashboard (Frontend)**:
   ```bash
   cd ../dashboard
   npm install
   ```

## Usage

You need to run both the Agent and the Dashboard simultaneously. It is recommended to use two terminal tabs.

### 1. Start the Agent

The agent runs on port `:8888` by default.

```bash
cd agent
go run main.go
```

### 2. Start the Dashboard

The dashboard runs on port `:4000` by default.

```bash
cd dashboard
npm run dev
```

Open [http://localhost:4000](http://localhost:4000) in your browser.

## Configuration

### Agent
The agent creates a configuration file at `~/.sentinel/config.yaml`.
- **Ignored Projects**: You can manage ignored projects via the "Settings" tab in the dashboard.
- **Port**: Configurable via environment variables if needed (`SENTINEL_PORT`).

### Dashboard
- **Backend URL**: Defaults to `http://localhost:8888`. Can be configured via `.env` if deployed remotely.

## Troubleshooting

- **Connection Error**: Ensure the Agent is running and accessible at `http://localhost:8888`.
- **Log Parsing Issues**: If you encounter issues with very large log files, try the "Log Parser" tab which is optimized for performance.
