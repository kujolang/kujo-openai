//go:build darwin || linux

package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func writeConfig(t *testing.T, config any) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "config.json")
	raw, e := json.Marshal(config)
	if e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(path, raw, 0600); e != nil {
		t.Fatal(e)
	}
	return path
}
func TestOperatorConfigBoundary(t *testing.T) {
	path := writeConfig(t, map[string]any{"schema": "kujo.openai.local/v1"})
	if _, e := loadOperator(path); e != nil {
		t.Fatal(e)
	}
	os.Chmod(path, 0644)
	if _, e := loadOperator(path); e == nil {
		t.Fatal("public config accepted")
	}
	os.Chmod(path, 0600)
	link := filepath.Join(t.TempDir(), "link")
	os.Symlink(path, link)
	if _, e := loadOperator(link); e == nil {
		t.Fatal("linked config accepted")
	}
	unknown := writeConfig(t, map[string]any{"schema": "kujo.openai.local/v1", "approved": true})
	if _, e := loadOperator(unknown); e == nil {
		t.Fatal("unknown authority field accepted")
	}
	if _, e := loadOperator("relative.json"); e == nil {
		t.Fatal("relative config accepted")
	}
}
func TestProjectCannotSupplyTrustedCodeOrState(t *testing.T) {
	project := t.TempDir()
	entry := filepath.Join(project, "provider.kujo")
	os.WriteFile(entry, []byte("malicious"), 0600)
	trusted := t.TempDir()
	link := filepath.Join(trusted, "provider.kujo")
	os.Symlink(entry, link)
	for _, candidate := range []string{entry, link} {
		path := writeConfig(t, map[string]any{"schema": "kujo.openai.local/v1", "entry": candidate, "cwd": trusted, "stateDirectory": trusted})
		e := serve(context.Background(), path, project)
		if e == nil || e.Error() != "trusted_state_must_be_outside_project" {
			t.Fatal("project provider accepted", e)
		}
	}
	path := writeConfig(t, map[string]any{"schema": "kujo.openai.local/v1"})
	if e := serve(context.Background(), path, ""); e == nil || e.Error() != "explicit_project_required" {
		t.Fatal(e)
	}
}

func TestProjectCannotAliasTrustedImports(t *testing.T) {
	project := t.TempDir()
	trusted := t.TempDir()
	entry := filepath.Join(trusted, "provider.kujo")
	if e := os.WriteFile(entry, []byte("unused"), 0600); e != nil {
		t.Fatal(e)
	}
	module := filepath.Join(project, "imports")
	if e := os.Symlink(trusted, module); e != nil {
		t.Fatal(e)
	}
	path := writeConfig(t, map[string]any{"schema": "kujo.openai.local/v1", "entry": entry, "cwd": trusted, "stateDirectory": trusted, "modulePaths": []string{module}})
	e := serve(context.Background(), path, project)
	if e == nil || e.Error() != "trusted_code_must_be_outside_project" {
		t.Fatal("project-owned import alias accepted", e)
	}
}
