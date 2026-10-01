//go:build darwin || linux

package provider

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestNativeKujoCancelsItsSubprocessTree(t *testing.T) {
	binary := os.Getenv("KUJO_NATIVE_TEST_BIN")
	if binary == "" {
		t.Skip("requires installed Kujo 1.7")
	}
	for _, mode := range []string{"cancel", "timeout"} {
		t.Run(mode, func(t *testing.T) {
			root := t.TempDir()
			child := filepath.Join(root, "child.fixture")
			os.WriteFile(child, []byte("child"), 0600)
			helper, e := os.Executable()
			if e != nil {
				t.Fatal(e)
			}
			args, _ := json.Marshal([]string{helper, "run", child})
			entry := filepath.Join(root, "provider.kujo")
			source := "print(to_json(spawn_process(" + string(args) + ",{\"timeout_ms\":10000,\"max_output_bytes\":4096})))\n"
			if e = os.WriteFile(entry, []byte(source), 0600); e != nil {
				t.Fatal(e)
			}
			timeout := 10 * time.Second
			if mode == "timeout" {
				timeout = 2 * time.Second
			}
			p, e := New(Config{Kujo: binary, Entry: entry, CWD: root, Capabilities: []string{"--allow-process-exec"}, Timeout: timeout})
			if e != nil {
				t.Fatal(e)
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			done := make(chan error, 1)
			go func() { _, e := p.Request(ctx, map[string]any{"operation": "invoke"}); done <- e }()
			pid := 0
			defer func() {
				if pid > 0 {
					_ = syscall.Kill(pid, syscall.SIGKILL)
				}
			}()
			deadline := time.Now().Add(5 * time.Second)
			for time.Now().Before(deadline) {
				raw, _ := os.ReadFile(child + ".started")
				pid, _ = strconv.Atoi(strings.TrimSpace(string(raw)))
				if pid > 0 {
					break
				}
				time.Sleep(10 * time.Millisecond)
			}
			if pid <= 0 {
				t.Fatal("native child never started")
			}
			expected := "execution_timeout_uncertain"
			if mode == "cancel" {
				cancel()
				expected = "execution_cancelled_uncertain"
			}
			select {
			case e = <-done:
				code(t, e, expected, true)
			case <-time.After(5 * time.Second):
				t.Fatal("provider did not stop")
			}
			if e = syscall.Kill(pid, 0); e != syscall.ESRCH {
				t.Fatal("native child survived cancellation", e)
			}
			pid = 0
		})
	}
}
