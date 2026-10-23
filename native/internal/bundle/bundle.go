// Package bundle contains reviewed canonical source, not a downloaded runtime.
package bundle

import (
	"embed"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

//go:embed assets
var assets embed.FS

// Extract materializes shipped source into a fresh private launch directory.
// The caller supplies operator-selected paths, never model-provided values.
func Extract(parent, project, audit string) (string, error) {
	directory, e := os.MkdirTemp(parent, ".provider-")
	if e != nil {
		return "", e
	}
	quote := func(s string) string { raw, _ := json.Marshal(s); return string(raw) }
	e = fs.WalkDir(assets, "assets", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relative := strings.TrimPrefix(path, "assets")
		target := filepath.Join(directory, filepath.FromSlash(relative))
		if entry.IsDir() {
			return os.MkdirAll(target, 0700)
		}
		body, err := assets.ReadFile(path)
		if err != nil {
			return err
		}
		if path == "assets/provider.kujo" {
			body = []byte(strings.NewReplacer("__AUDIT_LITERAL__", quote(audit), "__SOURCE_LITERAL__", quote(filepath.Join(directory, "mcp")), "__PROJECT_LITERAL__", quote(project)).Replace(string(body)))
		}
		file, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if err != nil {
			return err
		}
		_, err = file.Write(body)
		closeErr := file.Close()
		if err != nil {
			return err
		}
		return closeErr
	})
	if e != nil {
		os.RemoveAll(directory)
		return "", e
	}
	return directory, nil
}
