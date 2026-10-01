package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"

	"github.com/kujolang/kujo-openai/native/internal/bundle"
)

func serveProjectBundle(ctx context.Context, binary, project, state string) error {
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
	home, e := os.UserHomeDir()
	if e != nil {
		return errors.New("private_state_unavailable")
	}
	// Validate runtime before creating any state or unpacking shipped source.
	runtime, e := (locator{home: home, path: os.Getenv("PATH"), explicit: binary, project: selected, cwd: selected}).find()
	if e != nil {
		return e
	}
	if state == "" {
		state = filepath.Join(home, ".local", "share", "kujo", "openai-native")
	}
	if !filepath.IsAbs(state) || inside(selected, state) {
		return errors.New("trusted_state_must_be_outside_project")
	}
	// Reject symlinks and writable ancestors before creating state. Missing
	// suffixes are permitted; no repository configuration is consulted.
	for cursor := state; ; cursor = filepath.Dir(cursor) {
		info, err := os.Lstat(cursor)
		if err == nil {
			if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() || trustedPermissions(info) != nil {
				return errors.New("unsafe_project_state")
			}
		} else if !os.IsNotExist(err) {
			return errors.New("unsafe_project_state")
		}
		if filepath.Dir(cursor) == cursor {
			break
		}
	}
	if e = os.MkdirAll(state, 0700); e != nil {
		return errors.New("private_state_unavailable")
	}
	hash := sha256.Sum256([]byte(selected))
	state = filepath.Join(state, hex.EncodeToString(hash[:]))
	for _, path := range []string{state, filepath.Join(state, "audit"), filepath.Join(state, "receipts")} {
		if e = os.MkdirAll(path, 0700); e != nil {
			return errors.New("private_state_unavailable")
		}
		info, e := os.Lstat(path)
		if e != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0077 != 0 || trustedPermissions(info) != nil {
			return errors.New("unsafe_project_state")
		}
	}
	source, e := bundle.Extract(state, selected, filepath.Join(state, "audit"))
	if e != nil {
		return errors.New("bundled_provider_unavailable")
	}
	defer os.RemoveAll(source)
	config := operatorConfig{Schema: "kujo.openai.local/v1", Kujo: runtime, Entry: filepath.Join(source, "provider.kujo"), CWD: source, StateDirectory: filepath.Join(state, "receipts"), ModulePaths: []string{source, filepath.Join(source, "mcp"), filepath.Join(source, "vendor", "ability")}, Capabilities: []string{"--allow-fs-read", "--allow-fs-write", "--allow-clock"}, TimeoutMS: 30000, MaxConcurrent: 4}
	return serveOperator(ctx, config, source, selected)
}
