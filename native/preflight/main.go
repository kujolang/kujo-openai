// kujo-preflight diagnoses a preinstalled runtime. It never installs or serves MCP.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const installURL = "https://github.com/kujolang/kujo/blob/main/docs/ECOSYSTEM_INSTALL.md"

type report struct {
	Schema        string `json:"schema"`
	Status        string `json:"status"`
	Platform      string `json:"platform"`
	Version       string `json:"version,omitempty"`
	ProviderRange string `json:"providerRuntimeRange"`
	NativeMCP     bool   `json:"nativeMcpVerified"`
	Message       string `json:"message"`
	InstallURL    string `json:"installURL"`
}
type locator struct{ home, path, explicit, project, cwd string }

func inside(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

// Inspect both the lexical path and resolved target: a trusted target behind a
// repository-controlled symlink is not a trusted launch path.
func trusted(path string, excluded []string) (string, error) {
	if !filepath.IsAbs(path) {
		return "", errors.New("unsafe_runtime")
	}
	path = filepath.Clean(path)
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", errors.New("runtime_missing")
		}
		return "", errors.New("runtime_permission_denied")
	}
	for _, root := range excluded {
		if root == "" {
			continue
		}
		if inside(root, path) || inside(root, resolved) {
			return "", errors.New("unsafe_runtime")
		}
	}
	for _, candidate := range []string{path, resolved} {
		for p := candidate; ; p = filepath.Dir(p) {
			info, err := os.Stat(p)
			if err != nil {
				return "", errors.New("runtime_permission_denied")
			}
			if err = trustedPermissions(info); err != nil {
				return "", err
			}
			if filepath.Dir(p) == p {
				break
			}
		}
	}
	info, err := os.Stat(resolved)
	if err != nil || !info.Mode().IsRegular() {
		return "", errors.New("unsafe_runtime")
	}
	if runtime.GOOS != "windows" && info.Mode().Perm()&0111 == 0 {
		return "", errors.New("runtime_permission_denied")
	}
	return resolved, nil
}

func (l locator) find() (string, error) {
	excluded := []string{}
	for _, p := range []string{l.cwd, l.project} {
		if p == "" {
			continue
		}
		if !filepath.IsAbs(p) {
			return "", errors.New("invalid_project")
		}
		real, err := filepath.EvalSymlinks(p)
		if err != nil {
			return "", errors.New("project_unavailable")
		}
		info, err := os.Stat(real)
		if err != nil || !info.IsDir() {
			return "", errors.New("project_unavailable")
		}
		excluded = append(excluded, filepath.Clean(p), real)
	}
	if l.explicit != "" {
		return trusted(l.explicit, excluded)
	}
	name := "kujo"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	candidates := []string{}
	if filepath.IsAbs(l.home) {
		candidates = append(candidates, filepath.Join(l.home, ".local", "bin", name))
	}
	for _, dir := range filepath.SplitList(l.path) {
		if filepath.IsAbs(dir) {
			candidates = append(candidates, filepath.Join(dir, name))
		}
	}
	last := errors.New("runtime_missing")
	for _, candidate := range candidates {
		found, err := trusted(candidate, excluded)
		if err == nil {
			return found, nil
		}
		if err.Error() != "runtime_missing" {
			last = err
		}
	}
	return "", last
}

type boundedBuffer struct{ data bytes.Buffer }

func (b *boundedBuffer) Write(p []byte) (int, error) {
	if b.data.Len()+len(p) > 4096 {
		return 0, errors.New("runtime_output_limit")
	}
	return b.data.Write(p)
}

// No inherited tokens, shell startup files, module paths or dynamic-loader vars.
// Probe only fixed --version; repository content never supplies argv.
func version(ctx context.Context, path string) (string, error) {
	cmd := exec.CommandContext(ctx, path, "--version")
	cmd.Dir = filepath.Dir(path)
	cmd.Env = []string{}
	if runtime.GOOS == "windows" {
		if v := os.Getenv("SystemRoot"); v != "" {
			cmd.Env = append(cmd.Env, "SystemRoot="+v)
		}
	}
	out := &boundedBuffer{}
	cmd.Stdout = out
	cmd.Stderr = io.Discard
	cmd.WaitDelay = 250 * time.Millisecond
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return "", errors.New("runtime_probe_timeout")
		}
		return "", errors.New("runtime_probe_failed")
	}
	match := regexp.MustCompile(`^kujo ([0-9]+)\.([0-9]+)\.([0-9]+)\s*$`).FindStringSubmatch(out.data.String())
	if match == nil {
		return "", errors.New("runtime_version_invalid")
	}
	major, _ := strconv.Atoi(match[1])
	minor, _ := strconv.Atoi(match[2])
	if major != 1 || minor != 7 {
		return strings.TrimSpace(strings.TrimPrefix(out.data.String(), "kujo ")), errors.New("runtime_version_unsupported")
	}
	return strings.TrimSpace(strings.TrimPrefix(out.data.String(), "kujo ")), nil
}

func check(ctx context.Context, l locator) report {
	r := report{Schema: "kujo.openai.preflight/v1", Platform: runtime.GOOS + "/" + runtime.GOARCH, ProviderRange: ">=1.7.0 <1.8.0", InstallURL: installURL}
	path, err := l.find()
	if err == nil {
		r.Version, err = version(ctx, path)
	}
	if err != nil {
		r.Status = err.Error()
	} else {
		r.Status = "native_mcp_unavailable"
	}
	messages := map[string]string{
		"runtime_missing":                "Kujo was not found in trusted install locations. Install Kujo using the official guide, then retry. Nothing was installed.",
		"unsafe_runtime":                 "Refusing a repository-local or writable runtime path. Use an independently trusted installation outside the project.",
		"runtime_permission_denied":      "Kujo could not be executed or inspected. Check installation permissions without elevating privileges.",
		"runtime_permissions_unverified": "This platform's executable ownership/ACL checks are not implemented. Native launch remains blocked.",
		"runtime_probe_timeout":          "Kujo version check timed out. Verify the installation; no automatic retry occurred.",
		"runtime_probe_failed":           "Kujo version check failed. Verify the official installation; raw process output was suppressed.",
		"runtime_version_invalid":        "Kujo returned an unrecognized version. Verify the official installation.",
		"runtime_version_unsupported":    "This runtime version is outside the tested provider range. Use a reviewed compatible version; newer versions require compatibility tests.",
		"invalid_project":                "Supply an absolute project directory. Relative project paths are not accepted.",
		"project_unavailable":            "Project directory is unavailable. Select an accessible project in the host; this check does not grant access.",
		"native_mcp_unavailable":         "Kujo 1.7 has mcp make, not a native stdio Ability server. This runtime can run providers, but the current adapter still requires Node. The preinstalled-only plugin is blocked; do not substitute an invented MCP command.",
	}
	r.Message = messages[r.Status]
	return r
}
func main() {
	binary := flag.String("kujo", "", "absolute trusted preinstalled binary (operator only)")
	project := flag.String("project", "", "absolute project directory to exclude from runtime discovery; does not authorize access")
	flag.Parse()
	if flag.NArg() != 0 {
		fmt.Fprintln(os.Stderr, "usage: kujo-preflight [--kujo /absolute/path] [--project /absolute/path]")
		os.Exit(2)
	}
	home, _ := os.UserHomeDir()
	cwd, _ := os.Getwd()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	r := check(ctx, locator{home: home, path: os.Getenv("PATH"), explicit: *binary, project: *project, cwd: cwd})
	_ = json.NewEncoder(os.Stdout).Encode(r)
	os.Exit(1) // No native stdio contract has been verified. Never claim readiness.
}
