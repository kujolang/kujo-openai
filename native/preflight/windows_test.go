//go:build windows

package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/windows"
)

// Native executable fixture, only for bounded version/discovery unit tests.
// Full MCP acceptance uses the separately checksum-pinned real Kujo runtime.
func TestMain(m *testing.M) {
	if len(os.Args) == 2 && os.Args[1] == "--version" {
		if strings.Contains(filepath.Base(os.Args[0]), "outdated") {
			fmt.Println("kujo 1.6.0")
		} else {
			fmt.Println("kujo 1.7.0")
		}
		os.Exit(0)
	}
	os.Exit(m.Run())
}
func windowsTestRoot(t *testing.T) string {
	t.Helper()
	home, e := os.UserHomeDir()
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(home, ".kujo-launcher-test-"+rand.Text())
	if e = makePrivateDirectory(path); e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() {
		if e := os.RemoveAll(path); e != nil {
			t.Error(e)
		}
	})
	return path
}
func windowsFixture(t *testing.T, path string) {
	t.Helper()
	if e := makePrivateDirectory(filepath.Dir(path)); e != nil {
		t.Fatal(e)
	}
	exe, e := os.Executable()
	if e != nil {
		t.Fatal(e)
	}
	raw, e := os.ReadFile(exe)
	if e != nil {
		t.Fatal(e)
	}
	if e = os.WriteFile(path, raw, 0700); e != nil {
		t.Fatal(e)
	}
}
func grantEveryone(t *testing.T, path, right string) {
	t.Helper()
	u, e := windows.GetCurrentProcessToken().GetTokenUser()
	if e != nil {
		t.Fatal(e)
	}
	sd, e := windows.SecurityDescriptorFromString("D:P(A;OICI;FA;;;" + u.User.Sid.String() + ")(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;;" + right + ";;;WD)")
	if e != nil {
		t.Fatal(e)
	}
	acl, _, e := sd.DACL()
	if e != nil {
		t.Fatal(e)
	}
	if e = windows.SetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION|windows.PROTECTED_DACL_SECURITY_INFORMATION, nil, nil, acl, nil); e != nil {
		t.Fatal(e)
	}
}
func TestWindowsDiscoveryAndProbe(t *testing.T) {
	home := windowsTestRoot(t)
	exe := filepath.Join(home, ".local", "bin", "kujo.exe")
	windowsFixture(t, exe)
	project := filepath.Join(home, "project")
	if e := makePrivateDirectory(project); e != nil {
		t.Fatal(e)
	}
	l := locator{home: home, project: project, cwd: project}
	got, e := l.find()
	if e != nil || got != exe {
		t.Fatal("empty PATH discovery", e)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	r := check(ctx, l)
	if r.Status != "provider_runtime_ready" || r.Version != "1.7.0" || r.NativeMCP {
		t.Fatal("probe did not distinguish compatibility from host verification", r)
	}
	l.home = ""
	l.path = filepath.Dir(exe)
	got, e = l.find()
	if e != nil || got != exe {
		t.Fatal("absolute PATH discovery", e)
	}
	l.path = ".;relative"
	_, e = l.find()
	if e == nil || e.Error() != "runtime_missing" {
		t.Fatal("relative search path accepted", e)
	}
}
func TestWindowsProjectShadowAndReparse(t *testing.T) {
	root := windowsTestRoot(t)
	project := filepath.Join(root, "project")
	exe := filepath.Join(project, "kujo.exe")
	windowsFixture(t, exe)
	l := locator{explicit: exe, project: project, cwd: project}
	if _, e := l.find(); e == nil {
		t.Fatal("project runtime accepted")
	}
	installed := filepath.Join(root, "installed", "kujo.exe")
	windowsFixture(t, installed)
	link := filepath.Join(root, "linked.exe")
	if e := os.Symlink(installed, link); e != nil {
		t.Fatal(e)
	}
	l.explicit = link
	if _, e := l.find(); e == nil {
		t.Fatal("reparse runtime accepted")
	}
	l.explicit = installed
	if _, e := l.find(); e != nil {
		t.Fatal("trusted runtime rejected", e)
	}
}
func TestWindowsWritableRuntimeRejected(t *testing.T) {
	root := windowsTestRoot(t)
	exe := filepath.Join(root, "kujo.exe")
	windowsFixture(t, exe)
	grantEveryone(t, exe, "GW")
	if _, e := trusted(exe, nil); e == nil {
		t.Fatal("foreign-writable executable accepted")
	}
}
func TestWindowsWritableAncestorRejected(t *testing.T) {
	root := windowsTestRoot(t)
	exe := filepath.Join(root, "bin", "kujo.exe")
	windowsFixture(t, exe)
	grantEveryone(t, filepath.Dir(exe), "0x40")
	if _, e := trusted(exe, nil); e == nil {
		t.Fatal("replaceable ancestor accepted")
	}
}
func TestWindowsPrivateOperatorConfiguration(t *testing.T) {
	root := windowsTestRoot(t)
	path := filepath.Join(root, "operator.json")
	raw, _ := json.Marshal(operatorConfig{Schema: "kujo.openai.local/v1"})
	if e := os.WriteFile(path, raw, 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := loadOperator(path); e != nil {
		t.Fatal("private operator rejected", e)
	}
	grantEveryone(t, path, "GR")
	if _, e := loadOperator(path); e == nil {
		t.Fatal("public operator config accepted")
	}
}
func TestWindowsUnsupportedVersion(t *testing.T) {
	root := windowsTestRoot(t)
	exe := filepath.Join(root, "outdated.exe")
	windowsFixture(t, exe)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_, e := version(ctx, exe)
	if e == nil || e.Error() != "runtime_version_unsupported" {
		t.Fatal("version compatibility bypass", e)
	}
}
