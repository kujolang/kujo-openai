//go:build darwin || linux

package provider

import (
	"os/exec"
	"sync"
	"syscall"
	"time"
)

func platformArgs() []string { return nil }
func contain(cmd *exec.Cmd) func() {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	var mu sync.Mutex
	var escalation *time.Timer
	cmd.Cancel = func() error {
		// Give Kujo's signal handler time to cancel its own isolated child groups.
		err := cmd.Process.Signal(syscall.SIGTERM)
		mu.Lock()
		escalation = time.AfterFunc(500*time.Millisecond, func() { _ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) })
		mu.Unlock()
		return err
	}
	return func() {
		mu.Lock()
		defer mu.Unlock()
		if escalation != nil {
			escalation.Stop()
		}
	}
}
