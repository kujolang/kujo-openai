//go:build darwin || linux

package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func fixture(t *testing.T) (string, locator) {
	t.Helper()
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatal(err)
	}
	root, err := os.MkdirTemp(home, ".kujo-preflight-test-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(root) })
	for _, dir := range []string{"home/.local/bin", "project", "safe"} {
		if err := os.MkdirAll(filepath.Join(root, dir), 0700); err != nil {
			t.Fatal(err)
		}
	}
	return root, locator{home: filepath.Join(root, "home"), cwd: filepath.Join(root, "project")}
}
func binary(t *testing.T, path, body string) {
	t.Helper()
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+body+"\n"), 0700); err != nil {
		t.Fatal(err)
	}
}
func TestMissing(t *testing.T) {
	_, l := fixture(t)
	r := check(context.Background(), l)
	if r.Status != "runtime_missing" || r.NativeMCP || !strings.Contains(r.Message, "official guide") {
		t.Fatal(r)
	}
}
func TestKnownPathWithoutPATH(t *testing.T) {
	_, l := fixture(t)
	binary(t, filepath.Join(l.home, ".local/bin/kujo"), "echo 'kujo 1.7.0'")
	r := check(context.Background(), l)
	if r.Version != "1.7.0" || r.Status != "provider_runtime_ready" || r.NativeMCP {
		t.Fatal(r)
	}
}
func TestAbsolutePATH(t *testing.T) {
	root, l := fixture(t)
	l.path = filepath.Join(root, "safe")
	binary(t, filepath.Join(l.path, "kujo"), "echo 'kujo 1.7.1'")
	p, e := l.find()
	if e != nil || p != filepath.Join(l.path, "kujo") {
		t.Fatal(p, e)
	}
}
func TestRepositoryShadow(t *testing.T) {
	root, l := fixture(t)
	binary(t, filepath.Join(l.cwd, "kujo"), "exit 99")
	safe := filepath.Join(root, "safe")
	binary(t, filepath.Join(safe, "kujo"), "echo 'kujo 1.7.0'")
	l.path = l.cwd + string(os.PathListSeparator) + safe
	p, e := l.find()
	if e != nil || p != filepath.Join(safe, "kujo") {
		t.Fatal(p, e)
	}
}
func TestExplicitRepositoryRejected(t *testing.T) {
	_, l := fixture(t)
	l.explicit = filepath.Join(l.cwd, "kujo")
	binary(t, l.explicit, "exit 99")
	_, e := l.find()
	if e == nil || e.Error() != "unsafe_runtime" {
		t.Fatal(e)
	}
}
func TestSymlinkIntoRepository(t *testing.T) {
	root, l := fixture(t)
	target := filepath.Join(l.cwd, "kujo")
	binary(t, target, "exit 99")
	l.explicit = filepath.Join(root, "safe/kujo")
	if e := os.Symlink(target, l.explicit); e != nil {
		t.Fatal(e)
	}
	_, e := l.find()
	if e == nil || e.Error() != "unsafe_runtime" {
		t.Fatal(e)
	}
}
func TestRepositorySymlinkToTrustedRejected(t *testing.T) {
	root, l := fixture(t)
	target := filepath.Join(root, "safe/kujo")
	binary(t, target, "exit 99")
	l.explicit = filepath.Join(l.cwd, "kujo")
	if e := os.Symlink(target, l.explicit); e != nil {
		t.Fatal(e)
	}
	_, e := l.find()
	if e == nil || e.Error() != "unsafe_runtime" {
		t.Fatal(e)
	}
}
func TestWritableExecutableAndParent(t *testing.T) {
	for _, parent := range []bool{false, true} {
		t.Run(map[bool]string{false: "file", true: "directory"}[parent], func(t *testing.T) {
			root, l := fixture(t)
			l.explicit = filepath.Join(root, "safe/kujo")
			binary(t, l.explicit, "exit 99")
			target := l.explicit
			if parent {
				target = filepath.Dir(target)
			}
			if e := os.Chmod(target, 0777); e != nil {
				t.Fatal(e)
			}
			_, e := l.find()
			if e == nil || e.Error() != "unsafe_runtime" {
				t.Fatal(e)
			}
		})
	}
}
func TestNonExecutable(t *testing.T) {
	root, l := fixture(t)
	l.explicit = filepath.Join(root, "safe/kujo")
	binary(t, l.explicit, "exit 99")
	os.Chmod(l.explicit, 0600)
	_, e := l.find()
	if e == nil || e.Error() != "runtime_permission_denied" {
		t.Fatal(e)
	}
}
func TestRelativePATHIgnored(t *testing.T) {
	_, l := fixture(t)
	l.path = ".:bin:"
	_, e := l.find()
	if e == nil || e.Error() != "runtime_missing" {
		t.Fatal(e)
	}
}
func TestVersionRejection(t *testing.T) {
	for _, v := range []string{"1.6.9", "1.8.0", "2.0.0", "1.7.0-beta", "banana"} {
		t.Run(v, func(t *testing.T) {
			_, l := fixture(t)
			binary(t, filepath.Join(l.home, ".local/bin/kujo"), "echo 'kujo "+v+"'")
			r := check(context.Background(), l)
			if r.Status != "runtime_version_unsupported" && r.Status != "runtime_version_invalid" {
				t.Fatal(r)
			}
		})
	}
}
func TestEnvironmentAndArgv(t *testing.T) {
	_, l := fixture(t)
	t.Setenv("KUJO_TEST_SECRET", "do-not-inherit")
	binary(t, filepath.Join(l.home, ".local/bin/kujo"), "[ -z \"$KUJO_TEST_SECRET\" ] && [ \"$#\" = 1 ] && [ \"$1\" = --version ] || exit 22\necho 'kujo 1.7.0'")
	if r := check(context.Background(), l); r.Status != "provider_runtime_ready" {
		t.Fatal(r)
	}
}
func TestTimeout(t *testing.T) {
	_, l := fixture(t)
	binary(t, filepath.Join(l.home, ".local/bin/kujo"), "exec /bin/sleep 5")
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	r := check(ctx, l)
	if r.Status != "runtime_probe_timeout" {
		t.Fatal(r)
	}
}
func TestCrashRedaction(t *testing.T) {
	_, l := fixture(t)
	binary(t, filepath.Join(l.home, ".local/bin/kujo"), "echo sensitive-value >&2\nexit 5")
	r := check(context.Background(), l)
	if r.Status != "runtime_probe_failed" || strings.Contains(r.Message, "sensitive") {
		t.Fatal(r)
	}
}
func TestBoundedOutput(t *testing.T) {
	_, l := fixture(t)
	binary(t, filepath.Join(l.home, ".local/bin/kujo"), "i=0; while [ $i -lt 500 ]; do echo 0123456789; i=$((i+1)); done")
	r := check(context.Background(), l)
	if r.Status != "runtime_probe_failed" {
		t.Fatal(r)
	}
}
func TestProjectValidation(t *testing.T) {
	_, l := fixture(t)
	l.project = "../outside"
	if r := check(context.Background(), l); r.Status != "invalid_project" {
		t.Fatal(r)
	}
	l.project = filepath.Join(l.home, "absent")
	if r := check(context.Background(), l); r.Status != "project_unavailable" {
		t.Fatal(r)
	}
}
func TestProjectExcludedOutsideCWD(t *testing.T) {
	root, l := fixture(t)
	l.project = filepath.Join(root, "safe")
	l.explicit = filepath.Join(l.project, "kujo")
	binary(t, l.explicit, "exit 99")
	if r := check(context.Background(), l); r.Status != "unsafe_runtime" {
		t.Fatal(r)
	}
}

func TestProjectFilesystemIdentity(t *testing.T) {
	root, l := fixture(t)
	project := filepath.Join(root, "Selected")
	if e := os.Mkdir(project, 0700); e != nil {
		t.Fatal(e)
	}
	target := filepath.Join(project, "kujo")
	binary(t, target, "exit 99")
	alias := filepath.Join(root, "SELECTED", "kujo")
	if _, e := os.Stat(alias); e != nil {
		alias = target
	} // Case-sensitive filesystem: same physical directory path.
	l.project = project
	l.explicit = alias
	if _, e := l.find(); e == nil || e.Error() != "unsafe_runtime" {
		t.Fatal("filesystem alias bypassed project exclusion", e)
	}
}
