package config

import (
	"encoding/json"
	"os"
)

type Config struct {
	WorkspaceRoot   string   `json:"workspace_root"`
	Host            string   `json:"host"`
	Port            int      `json:"port"`
	IgnoredProjects []string `json:"ignored_projects"`
	CpuThreshold    int      `json:"cpu_threshold"`
	NginxLogPath    string   `json:"nginx_log_path"`
	PhpFpmPath      string   `json:"php_fpm_path"` // Manual override
}

const ConfigFile = "sentinel-config.json"

func Load() (Config, error) {
	var cfg Config
	file, err := os.ReadFile(ConfigFile)
	if os.IsNotExist(err) {
		// Return default config if not exists
		return Config{
			Host: "127.0.0.1",
			Port: 8888,
		}, nil
	}
	if err != nil {
		return cfg, err
	}
	err = json.Unmarshal(file, &cfg)

	// Set defaults if empty
	if cfg.Host == "" {
		cfg.Host = "127.0.0.1"
	}
	if cfg.Port == 0 {
		cfg.Port = 8888
	}
	if cfg.CpuThreshold == 0 {
		cfg.CpuThreshold = 50
	}

	return cfg, err
}

func (c *Config) Save() error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(ConfigFile, data, 0644)
}
