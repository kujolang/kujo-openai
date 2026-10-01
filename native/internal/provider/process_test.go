package provider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// Isolated subprocess fixtures exercise the boundary with no shell or Node.
func TestMain(m *testing.M) {
	if len(os.Args) > 2 && os.Args[1] == "run" {
		mode, err := os.ReadFile(os.Args[2])
		if err != nil {
			os.Exit(8)
		}
		switch string(mode) {
		case "child":
			os.WriteFile(os.Args[2]+".started", []byte(fmt.Sprint(os.Getpid())), 0600)
			time.Sleep(30 * time.Second)
		case "sleep":
			os.WriteFile(os.Args[2]+".started", []byte("ready"), 0600)
			time.Sleep(10 * time.Second)
			fmt.Print(`{}`)
		case "stderr":
			fmt.Fprint(os.Stderr, strings.Repeat("x", Limit+1))
			fmt.Print(`{}`)
		case "combined":
			fmt.Fprint(os.Stderr, strings.Repeat("x", Limit*3/4))
			fmt.Print(strings.Repeat("x", Limit*3/4))
		case "stdout":
			fmt.Print(strings.Repeat("x", Limit+1))
		case "invalid":
			fmt.Print("private diagnostic")
		case "crash":
			fmt.Fprint(os.Stderr, "private diagnostic")
			os.Exit(7)
		case "secret":
			json.NewEncoder(os.Stdout).Encode(map[string]string{"value": os.Getenv("TEST_CREDENTIAL")})
		default:
			raw, _ := io.ReadAll(os.Stdin)
			json.NewEncoder(os.Stdout).Encode(map[string]any{"request": json.RawMessage(raw), "argv": os.Args[3:], "ambient": os.Getenv("AMBIENT_SECRET"), "path": os.Getenv("PATH")})
		}
		os.Exit(0)
	}
	os.Exit(m.Run())
}
func setup(t *testing.T, mode string) Config {
	t.Helper()
	root := t.TempDir()
	entry := filepath.Join(root, "provider.fixture")
	if e := os.WriteFile(entry, []byte(mode), 0600); e != nil {
		t.Fatal(e)
	}
	binary, e := os.Executable()
	if e != nil {
		t.Fatal(e)
	}
	return Config{Kujo: binary, Entry: entry, CWD: root, Timeout: 3 * time.Second, MaxConcurrent: 2}
}
func code(t *testing.T, err error, want string, uncertain bool) {
	t.Helper()
	var b *BoundaryError
	if !errors.As(err, &b) || b.Code != want || b.Uncertain != uncertain {
		t.Fatalf("got %v; want %s uncertain=%v", err, want, uncertain)
	}
}
func ready(t *testing.T, c Config) {
	t.Helper()
	end := time.Now().Add(3 * time.Second)
	for time.Now().Before(end) {
		if _, e := os.Stat(c.Entry + ".started"); e == nil {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("fixture did not start")
}
func TestValidation(t *testing.T) {
	c := setup(t, "echo")
	for _, mutate := range []func(*Config){func(c *Config) { c.Kujo = "kujo" }, func(c *Config) { c.Timeout = 121 * time.Second }, func(c *Config) { c.MaxConcurrent = 17 }, func(c *Config) { c.Capabilities = []string{"--allow-all"} }, func(c *Config) { c.ModulePaths = []string{"."} }, func(c *Config) { c.Secrets = map[string]string{"LD_PRELOAD": "bad"} }, func(c *Config) { c.Secrets = map[string]string{"TOKEN": ""} }} {
		bad := c
		mutate(&bad)
		if _, err := New(bad); err == nil {
			t.Fatal("invalid configuration accepted")
		}
	}
}
func TestDataAndEnvironment(t *testing.T) {
	t.Setenv("AMBIENT_SECRET", "must-not-inherit")
	c := setup(t, "echo")
	c.Capabilities = []string{"--allow-clock"}
	p, e := New(c)
	if e != nil {
		t.Fatal(e)
	}
	raw, e := p.Request(context.Background(), map[string]any{"operation": "invoke", "input": "$(touch forbidden); /bin/sh"})
	if e != nil {
		t.Fatal(e)
	}
	var result map[string]any
	if e = json.Unmarshal(raw, &result); e != nil {
		t.Fatal(e)
	}
	if result["ambient"] != "" || result["path"] != "" {
		t.Fatal("ambient environment inherited")
	}
	if result["request"].(map[string]any)["input"] != "$(touch forbidden); /bin/sh" {
		t.Fatal("input altered")
	}
	args := result["argv"].([]any)
	if args[0] != "--untrusted" || args[len(args)-1] != "--allow-clock" {
		t.Fatal(args)
	}
}
func TestInputAndOperationLimits(t *testing.T) {
	p, _ := New(setup(t, "echo"))
	_, e := p.Request(context.Background(), map[string]any{"operation": "shell"})
	code(t, e, "unsupported_operation", false)
	_, e = p.Request(context.Background(), map[string]any{"operation": "invoke", "input": strings.Repeat("x", Limit)})
	code(t, e, "input_too_large", false)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, e = p.Request(ctx, map[string]any{"operation": "invoke"})
	code(t, e, "cancelled_before_execution", false)
}
func TestOutputCrashAndMalformed(t *testing.T) {
	for mode, want := range map[string]string{"combined": "provider_output_too_large", "stdout": "provider_output_too_large", "stderr": "provider_output_too_large", "crash": "provider_failed", "invalid": "invalid_provider_response"} {
		t.Run(mode, func(t *testing.T) {
			p, _ := New(setup(t, mode))
			_, e := p.Request(context.Background(), map[string]any{"operation": "invoke"})
			code(t, e, want, true)
			if strings.Contains(e.Error(), "private") {
				t.Fatal("raw output leaked")
			}
		})
	}
}
func TestSecretsAndConfigCopy(t *testing.T) {
	c := setup(t, "secret")
	c.Secrets = map[string]string{"TEST_CREDENTIAL": "secret\nquoted\"marker"}
	p, e := New(c)
	if e != nil {
		t.Fatal(e)
	}
	c.Secrets["TEST_CREDENTIAL"] = "changed"
	_, e = p.Request(context.Background(), map[string]any{"operation": "invoke"})
	code(t, e, "credential_output_rejected", true)
}
func TestTimeout(t *testing.T) {
	c := setup(t, "sleep")
	c.Timeout = 100 * time.Millisecond
	p, _ := New(c)
	start := time.Now()
	_, e := p.Request(context.Background(), map[string]any{"operation": "invoke"})
	code(t, e, "execution_timeout_uncertain", true)
	if time.Since(start) > 2*time.Second {
		t.Fatal("timeout wait not bounded")
	}
}
func TestCancellationAndCapacity(t *testing.T) {
	c := setup(t, "sleep")
	c.MaxConcurrent = 1
	p, _ := New(c)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { _, e := p.Request(ctx, map[string]any{"operation": "invoke"}); done <- e }()
	ready(t, c)
	_, e := p.Request(context.Background(), map[string]any{"operation": "invoke"})
	code(t, e, "capacity_exceeded", false)
	cancel()
	code(t, <-done, "execution_cancelled_uncertain", true)
	if len(p.slots) != 0 {
		t.Fatal("capacity was not released")
	}
}
func TestConcurrentAndRestart(t *testing.T) {
	c := setup(t, "echo")
	c.MaxConcurrent = 8
	p, _ := New(c)
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			raw, e := p.Request(context.Background(), map[string]any{"operation": "invoke", "input": i})
			if e != nil {
				t.Error(e)
				return
			}
			var result struct{ Request struct{ Input int } }
			if e = json.Unmarshal(raw, &result); e != nil || result.Request.Input != i {
				t.Error("cross-call contamination")
			}
		}(i)
	}
	wg.Wait()
	again, e := New(c)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = again.Request(context.Background(), map[string]any{"operation": "discover"}); e != nil {
		t.Fatal(e)
	}
}
func TestStartFailureIsNotExecution(t *testing.T) {
	c := setup(t, "echo")
	p, _ := New(c)
	p.config.Kujo = filepath.Join(c.CWD, "missing")
	_, e := p.Request(context.Background(), map[string]any{"operation": "invoke"})
	code(t, e, "provider_start_failed", false)
}

func TestCanonicalKujoProvider(t *testing.T) {
	binary := os.Getenv("KUJO_NATIVE_TEST_BIN")
	if binary == "" {
		t.Skip("set KUJO_NATIVE_TEST_BIN to an independently installed Kujo 1.7 executable")
	}
	root, e := filepath.Abs("../../..")
	if e != nil {
		t.Fatal(e)
	}
	p, e := New(Config{Kujo: binary, Entry: filepath.Join(root, "tests/provider.kujo"), CWD: root, Capabilities: []string{"--allow-clock"}})
	if e != nil {
		t.Fatal(e)
	}
	raw, e := p.Request(context.Background(), map[string]any{"operation": "discover"})
	if e != nil {
		t.Fatal(e)
	}
	var catalog struct {
		OK     bool   `json:"ok"`
		Schema string `json:"schema"`
		Tools  []struct {
			Name string         `json:"name"`
			Meta map[string]any `json:"_meta"`
		} `json:"tools"`
	}
	if e = json.Unmarshal(raw, &catalog); e != nil || !catalog.OK || len(catalog.Tools) != 7 || catalog.Schema != "kujo.openai.catalog/v1" {
		t.Fatalf("invalid canonical catalog: %v", e)
	}
	for index, tc := range []struct {
		id, status string
		input      map[string]any
	}{
		{"read", "succeeded", map[string]any{"value": "native transport"}},
		{"read", "rejected", map[string]any{}},
		{"write", "approval_required", map[string]any{"value": "no host approval"}},
		{"denied", "rejected", map[string]any{"value": "denied"}},
		{"failure", "failed", map[string]any{"value": "failure"}},
	} {
		name := ""
		for _, tool := range catalog.Tools {
			if tool.Meta["kujo/abilityId"] == "kujo.fixture."+tc.id {
				name = tool.Name
			}
		}
		if name == "" {
			t.Fatal("canonical identity missing")
		}
		id := fmt.Sprintf("7b132a1d-8b31-4b24-8a90-%012d", index)
		raw, e = p.Request(context.Background(), map[string]any{"operation": "invoke", "name": name, "input": tc.input, "invocation_id": id})
		if e != nil {
			t.Fatal(e)
		}
		var result struct {
			Receipt struct {
				Status  string         `json:"status"`
				ID      string         `json:"invocation_id"`
				Ability string         `json:"ability_id"`
				Result  map[string]any `json:"result"`
			} `json:"receipt"`
		}
		if e = json.Unmarshal(raw, &result); e != nil || result.Receipt.Status != tc.status || result.Receipt.ID != id || result.Receipt.Ability != "kujo.fixture."+tc.id {
			t.Fatalf("canonical result changed for %s: %s", tc.id, raw)
		}
		if tc.status == "succeeded" && result.Receipt.Result["value"] != "native transport" {
			t.Fatal("canonical output changed")
		}
	}
}
