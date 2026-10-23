// Package provider transports bounded requests to an operator-owned canonical
// Kujo provider. It does not define tools, grant authority or fabricate receipts.
package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

const Limit = 1024 * 1024

type BoundaryError struct {
	Code      string
	Uncertain bool
}

func (e *BoundaryError) Error() string          { return e.Code }
func failure(code string, uncertain bool) error { return &BoundaryError{code, uncertain} }

// Config is supplied by the trusted launcher, never by an MCP request. Its
// executable must first pass runtime discovery/version checks. Entry/module
// roots are trusted application code; CWD alone is not a filesystem sandbox.
type Config struct {
	Kujo          string
	Entry         string
	CWD           string
	ModulePaths   []string
	Capabilities  []string
	Timeout       time.Duration
	MaxConcurrent int
	// Values are supplied by the operator, not inherited wholesale from the host.
	Secrets map[string]string
}
type Process struct {
	config Config
	slots  chan struct{}
}

var capabilities = map[string]bool{
	"--allow-fs-read": true, "--allow-fs-write": true, "--allow-clock": true,
	"--allow-random": true, "--allow-process-exec": true, "--allow-net-client": true,
	"--allow-env-read": true, "--allow-database": true,
}
var secretName = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)

func New(c Config) (*Process, error) {
	if runtime.GOOS != "darwin" && runtime.GOOS != "linux" && runtime.GOOS != "windows" {
		return nil, failure("unsupported_platform", false)
	}
	if c.Timeout == 0 {
		c.Timeout = 30 * time.Second
	}
	if c.MaxConcurrent == 0 {
		c.MaxConcurrent = 4
	}
	if c.Timeout < 10*time.Millisecond || c.Timeout > 120*time.Second || c.MaxConcurrent < 1 || c.MaxConcurrent > 16 {
		return nil, failure("invalid_limits", false)
	}
	for _, v := range c.Capabilities {
		if !capabilities[v] {
			return nil, failure("invalid_capabilities", false)
		}
	}
	for _, item := range []struct {
		path string
		dir  bool
	}{{c.Kujo, false}, {c.Entry, false}, {c.CWD, true}} {
		if !filepath.IsAbs(item.path) {
			return nil, failure("absolute_operator_paths_required", false)
		}
		info, err := os.Stat(item.path)
		if err != nil || info.IsDir() != item.dir || (!item.dir && !info.Mode().IsRegular()) {
			return nil, failure("operator_path_unavailable", false)
		}
	}
	var err error
	c.Kujo, err = filepath.EvalSymlinks(c.Kujo)
	if err != nil {
		return nil, failure("operator_path_unavailable", false)
	}
	c.Entry, err = filepath.EvalSymlinks(c.Entry)
	if err != nil {
		return nil, failure("operator_path_unavailable", false)
	}
	c.CWD, err = filepath.EvalSymlinks(c.CWD)
	if err != nil {
		return nil, failure("operator_path_unavailable", false)
	}
	modules := make([]string, 0, len(c.ModulePaths))
	for _, path := range c.ModulePaths {
		if !filepath.IsAbs(path) || strings.ContainsRune(path, os.PathListSeparator) {
			return nil, failure("invalid_module_paths", false)
		}
		real, err := filepath.EvalSymlinks(path)
		if err != nil {
			return nil, failure("invalid_module_paths", false)
		}
		info, err := os.Stat(real)
		if err != nil || !info.IsDir() {
			return nil, failure("invalid_module_paths", false)
		}
		modules = append(modules, real)
	}
	c.ModulePaths = modules
	c.Capabilities = append([]string(nil), c.Capabilities...)
	secrets := make(map[string]string, len(c.Secrets))
	for key, value := range c.Secrets {
		// Secret configuration must not become executable/import/loader control.
		if !secretName.MatchString(key) || key == "PATH" || key == "HOME" || key == "SYSTEMROOT" || key == "COMSPEC" || strings.HasPrefix(key, "KUJO_") || strings.HasPrefix(key, "LD_") || strings.HasPrefix(key, "DYLD_") || key == "GODEBUG" || key == "GORACE" {
			return nil, failure("invalid_secret_configuration", false)
		}
		if value == "" || strings.ContainsRune(value, 0) {
			return nil, failure("required_secret_missing", false)
		}
		secrets[key] = value
	}
	c.Secrets = secrets
	return &Process{config: c, slots: make(chan struct{}, c.MaxConcurrent)}, nil
}

func (p *Process) Request(ctx context.Context, request map[string]any) (json.RawMessage, error) {
	if ctx.Err() != nil {
		return nil, failure("cancelled_before_execution", false)
	}
	operation, _ := request["operation"].(string)
	if operation != "discover" && operation != "invoke" && operation != "resume" {
		return nil, failure("unsupported_operation", false)
	}
	raw, err := json.Marshal(request)
	if err != nil {
		return nil, failure("invalid_request", false)
	}
	if len(raw) > Limit {
		return nil, failure("input_too_large", false)
	}
	select {
	case p.slots <- struct{}{}:
		defer func() { <-p.slots }()
	default:
		return nil, failure("capacity_exceeded", false)
	}
	execution := operation != "discover"
	childContext, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	timer := time.AfterFunc(p.config.Timeout, func() { cancel(errors.New("execution_timeout_uncertain")) })
	defer timer.Stop()
	if childContext.Err() != nil {
		return nil, failure("cancelled_before_execution", false)
	}
	args := append([]string{"run", p.config.Entry, "--untrusted"}, platformArgs()...)
	args = append(args, p.config.Capabilities...)
	cmd := exec.CommandContext(childContext, p.config.Kujo, args...)
	cmd.Dir = p.config.CWD
	// No ambient PATH: handlers needing executables must bind absolute paths.
	cmd.Env = []string{"KUJO_MODULE_PATH=" + strings.Join(p.config.ModulePaths, string(os.PathListSeparator))}
	for key, value := range p.config.Secrets {
		cmd.Env = append(cmd.Env, key+"="+value)
	}
	cmd.Stdin = bytes.NewReader(raw)
	output := &capture{cancel: cancel}
	cmd.Stdout = &stream{owner: output, keep: true}
	cmd.Stderr = &stream{owner: output}
	cleanup := contain(cmd)
	defer cleanup()
	cmd.WaitDelay = 750 * time.Millisecond
	err = cmd.Run()
	if cmd.Process == nil {
		return nil, failure("provider_start_failed", false)
	}
	if cause := context.Cause(childContext); cause != nil {
		code := "execution_cancelled_uncertain"
		if cause.Error() == "execution_timeout_uncertain" || cause.Error() == "provider_output_too_large" {
			code = cause.Error()
		}
		return nil, failure(code, execution)
	}
	if err != nil {
		return nil, failure("provider_failed", execution)
	}
	body := output.body()
	for _, secret := range p.config.Secrets {
		encoded, _ := json.Marshal(secret)
		if bytes.Contains(body, []byte(secret)) || bytes.Contains(body, encoded[1:len(encoded)-1]) {
			return nil, failure("credential_output_rejected", execution)
		}
	}
	if !json.Valid(body) {
		return nil, failure("invalid_provider_response", execution)
	}
	return body, nil
}

// stdout and stderr share one budget; stderr is counted but never retained.
// Do not embed bytes.Buffer: io.Copy would bypass the limiting Write method.
type capture struct {
	mu     sync.Mutex
	size   int
	stdout bytes.Buffer
	cancel context.CancelCauseFunc
}
type stream struct {
	owner *capture
	keep  bool
}

func (s *stream) Write(data []byte) (int, error) {
	c := s.owner
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(data) > Limit-c.size {
		c.cancel(errors.New("provider_output_too_large"))
		return len(data), nil
	}
	c.size += len(data)
	if s.keep {
		return c.stdout.Write(data)
	}
	return len(data), nil
}
func (c *capture) body() []byte {
	c.mu.Lock()
	defer c.mu.Unlock()
	return bytes.Clone(c.stdout.Bytes())
}

var _ io.Writer = (*stream)(nil)
