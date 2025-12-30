package injector

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

const InspectorFilename = "sentinel_inspector.php"

// Injector manages the injection of the inspector script into PHP projects
type Injector struct {
	InspectorContent []byte
}

func New(content []byte) *Injector {
	return &Injector{
		InspectorContent: content,
	}
}

// EnableAudit injects require_once into public/index.php
func (i *Injector) EnableAudit(projectPath string) error {
	publicDir := filepath.Join(projectPath, "public")
	if _, err := os.Stat(publicDir); os.IsNotExist(err) {
		publicDir = projectPath
	}

	// 1. Write the Inspector File Locally
	localInspectorPath := filepath.Join(publicDir, InspectorFilename)
	fmt.Printf("[Injector] Writing inspector to %s\n", localInspectorPath)
	if err := os.WriteFile(localInspectorPath, i.InspectorContent, 0644); err != nil {
		return fmt.Errorf("failed to write local inspector: %v", err)
	}

	// 2. Modify index.php
	indexPhpPath := filepath.Join(publicDir, "index.php")
	content, err := os.ReadFile(indexPhpPath)
	if err != nil {
		return fmt.Errorf("failed to read index.php: %v", err)
	}

	// Check if already injected
	injectionInclude := fmt.Sprintf("include_once __DIR__.'/%s';", InspectorFilename)
	if bytes.Contains(content, []byte(injectionInclude)) {
		fmt.Println("[Injector] Already injected.")
		return nil // Already active
	}

	// 3. Prepare Injections
	// A. Basic Include at top
	newContent := bytes.Replace(content, []byte("<?php"), []byte("<?php\n"+injectionInclude), 1)

	// B. Smart Hook for Laravel 11/Modern Pattern
	// Regex: Match (require_once ... bootstrap/app.php ... )
	// We handle the surrounding parens carefully.
	re := regexp.MustCompile(`\(\s*require_once\s+__DIR__\s*\.\s*['"]/../bootstrap/app\.php['"]\s*\)`)

	match := re.Find(newContent)
	if match != nil {
		fmt.Println("[Injector] Regex MATCHED! Applying Smart Hook.")

		// matchedStr is (require_once ... )
		matchedStr := string(match)

		// Replacement: capture result into variable -> hook -> verify variable
		replacement := fmt.Sprintf(`$__sentinel_app = %s;
if (function_exists('sentinel_bind')) { sentinel_bind($__sentinel_app); }
$__sentinel_app`, matchedStr)

		newContent = bytes.Replace(newContent, match, []byte(replacement), 1)
	} else {
		fmt.Println("[Injector] Regex FAILED to match bootstrap pattern.")
	}

	return os.WriteFile(indexPhpPath, newContent, 0644)
}

// DisableAudit removes the injection from index.php
func (i *Injector) DisableAudit(projectPath string) error {
	publicDir := filepath.Join(projectPath, "public")
	if _, err := os.Stat(publicDir); os.IsNotExist(err) {
		publicDir = projectPath
	}

	// 1. Remove Local Inspector File
	localInspectorPath := filepath.Join(publicDir, InspectorFilename)
	os.Remove(localInspectorPath)

	// 2. Clean index.php
	indexPhpPath := filepath.Join(publicDir, "index.php")
	content, err := os.ReadFile(indexPhpPath)
	if err != nil {
		return nil // Missing index.php? ignore
	}

	// Define markers
	injectionInclude := fmt.Sprintf("include_once __DIR__.'/%s';", InspectorFilename)

	// A. Remove Top Include
	newContent := bytes.Replace(content, []byte("\n"+injectionInclude), []byte(""), -1)
	newContent = bytes.Replace(newContent, []byte(injectionInclude), []byte(""), -1)

	// B. Revert Smart Hook
	// Match: $__sentinel_app = (...);
	// if (function_exists('sentinel_bind')) ...
	// $__sentinel_app
	// We use a strict pattern to match exactly what we injected, preventing partial matches.
	re := regexp.MustCompile(`\$__sentinel_app\s*=\s*(\(.*?require_once.*?\));\s*if\s*\(function_exists\('sentinel_bind'\)\)[\s\S]*?\}\s*\$__sentinel_app`)

	if loc := re.FindSubmatchIndex(newContent); loc != nil {
		// loc[2] and loc[3] are the capture group indices (original bootstrap)
		originalBootstrap := newContent[loc[2]:loc[3]]
		newContent = bytes.Replace(newContent, newContent[loc[0]:loc[1]], originalBootstrap, 1)
		fmt.Println("[Injector] Reverted Smart Hook.")
	}

	return os.WriteFile(indexPhpPath, newContent, 0644)
}
