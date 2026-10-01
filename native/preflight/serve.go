package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/kujolang/kujo-openai/native/internal/adapter"
	"github.com/kujolang/kujo-openai/native/internal/provider"
	"github.com/kujolang/kujo-openai/native/internal/receipts"
	"github.com/kujolang/kujo-openai/native/internal/transport"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type operatorConfig struct {
	Schema            string   `json:"schema"`
	Kujo              string   `json:"kujo"`
	Entry             string   `json:"entry"`
	CWD               string   `json:"cwd"`
	StateDirectory    string   `json:"stateDirectory"`
	TimeoutMS         int      `json:"timeoutMs"`
	MaxConcurrent     int      `json:"maxConcurrent"`
	Capabilities      []string `json:"capabilities"`
	ModulePaths       []string `json:"modulePaths"`
	SecretEnvironment []string `json:"secretEnvironment"`
}

func loadOperator(path string) (operatorConfig, error) {
	var config operatorConfig
	if !filepath.IsAbs(path) {
		return config, errors.New("absolute_operator_config_required")
	}
	info, e := os.Lstat(path)
	if e != nil || !info.Mode().IsRegular() || info.Mode().Perm()&0077 != 0 || info.Size() > provider.Limit {
		return config, errors.New("unsafe_operator_config")
	}
	file, e := os.Open(path)
	if e != nil {
		return config, errors.New("unsafe_operator_config")
	}
	defer file.Close()
	opened, e := file.Stat()
	if e != nil || !os.SameFile(info, opened) {
		return config, errors.New("unsafe_operator_config")
	}
	decoder := json.NewDecoder(io.LimitReader(file, provider.Limit+1))
	decoder.DisallowUnknownFields()
	if e = decoder.Decode(&config); e != nil {
		return config, errors.New("invalid_operator_config")
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF || config.Schema != "kujo.openai.local/v1" {
		return config, errors.New("invalid_operator_config")
	}
	return config, nil
}
func serve(ctx context.Context, path, project string) error {
	config, e := loadOperator(path)
	if e != nil {
		return e
	}
	// Selection is operator/host launch configuration, never an MCP tool argument.
	if !filepath.IsAbs(project) {
		return errors.New("explicit_project_required")
	}
	selected, e := filepath.EvalSymlinks(project)
	if e != nil {
		return errors.New("project_unavailable")
	}
	info, e := os.Stat(selected)
	if e != nil || !info.IsDir() {
		return errors.New("project_unavailable")
	}
	for _, trustedPath := range []string{path, config.StateDirectory, config.Entry, config.CWD} {
		if !filepath.IsAbs(trustedPath) {
			return errors.New("absolute_operator_paths_required")
		}
		resolved, e := filepath.EvalSymlinks(trustedPath)
		if e != nil {
			return errors.New("operator_path_unavailable")
		}
		if inside(selected, trustedPath) || inside(selected, resolved) {
			return errors.New("trusted_state_must_be_outside_project")
		}
	}
	for _, module := range config.ModulePaths {
		real, e := filepath.EvalSymlinks(module)
		if e != nil || inside(selected, real) {
			return errors.New("trusted_code_must_be_outside_project")
		}
	}
	home, _ := os.UserHomeDir()
	binary, e := (locator{home: home, path: os.Getenv("PATH"), explicit: config.Kujo, project: selected, cwd: selected}).find()
	if e != nil {
		return e
	}
	probe, cancel := context.WithTimeout(ctx, 3*time.Second)
	_, e = version(probe, binary)
	cancel()
	if e != nil {
		return e
	}
	secrets := map[string]string{}
	for _, name := range config.SecretEnvironment {
		secrets[name] = os.Getenv(name)
	}
	backend, e := provider.New(provider.Config{Kujo: binary, Entry: config.Entry, CWD: config.CWD, ModulePaths: config.ModulePaths, Capabilities: config.Capabilities, Timeout: time.Duration(config.TimeoutMS) * time.Millisecond, MaxConcurrent: config.MaxConcurrent, Secrets: secrets})
	if e != nil {
		return e
	}
	store, e := receipts.Open(config.StateDirectory)
	if e != nil {
		return e
	}
	defer store.Close()
	references, e := receipts.Open(filepath.Join(config.StateDirectory, "continuations"))
	if e != nil {
		return e
	}
	defer references.Close()
	a, e := adapter.NewWithContinuations(backend, store, references)
	if e != nil {
		return e
	}
	server := mcp.NewServer(&mcp.Implementation{Name: "kujo-openai-native", Version: "0.1.0"}, &mcp.ServerOptions{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))})
	if e = a.Register(ctx, server); e != nil {
		return e
	}
	e = server.Run(ctx, &transport.Stdio{Reader: os.Stdin, Writer: os.Stdout})
	if errors.Is(e, context.Canceled) {
		return nil
	}
	if e != nil {
		return errors.New("mcp_session_failed")
	}
	return nil
}
