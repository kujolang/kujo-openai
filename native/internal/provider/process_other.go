//go:build !darwin && !linux

package provider

import "os/exec"

// Runtime child job containment requires Kujo 1.7 on Windows. The native
// launcher's Windows executable ACL gate still rejects unverified paths.
func platformArgs() []string     { return []string{"--kill-children-on-exit"} }
func contain(_ *exec.Cmd) func() { return func() {} }
