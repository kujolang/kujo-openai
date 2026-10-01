//go:build !darwin && !linux

package provider

import "os/exec"

// Runtime child job containment requires the validated Kujo 1.7 Windows job
// implementation. Cancellation terminates Kujo and closes its kill-on-close job.
func platformArgs() []string     { return []string{"--kill-children-on-exit"} }
func contain(_ *exec.Cmd) func() { return func() {} }
