//go:build windows

package windowstrust

import (
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/windows"
)

func currentSID(t *testing.T) string {
	t.Helper()
	user, e := windows.GetCurrentProcessToken().GetTokenUser()
	if e != nil {
		t.Fatal(e)
	}
	return user.User.Sid.String()
}
func descriptor(t *testing.T, sddl string) *windows.SECURITY_DESCRIPTOR {
	t.Helper()
	sd, e := windows.SecurityDescriptorFromString(sddl)
	if e != nil {
		t.Fatal(e)
	}
	return sd
}
func TestDescriptorPolicy(t *testing.T) {
	current := currentSID(t)
	for _, test := range []struct {
		name, sddl                string
		directory, private, allow bool
	}{
		{"owner_only", "O:" + current + "D:P(A;;FA;;;" + current + ")", false, true, true},
		{"system_and_administrators", "O:SYD:P(A;;FA;;;SY)(A;;FA;;;BA)", false, false, true},
		{"readable_runtime", "O:" + current + "D:P(A;;FA;;;" + current + ")(A;;GR;;;BU)", false, false, true},
		{"readable_private_data", "O:" + current + "D:P(A;;FA;;;" + current + ")(A;;GR;;;BU)", false, true, false},
		{"everyone_write", "O:" + current + "D:P(A;;GW;;;WD)", false, false, false},
		{"everyone_append", "O:" + current + "D:P(A;;0x4;;;WD)", false, false, false},
		{"everyone_delete_child", "O:" + current + "D:P(A;;0x40;;;WD)", true, false, false},
		{"ancestor_add_sibling_only", "O:" + current + "D:P(A;;0x4;;;BU)", true, false, true},
		{"private_add_child", "O:" + current + "D:P(A;;0x4;;;BU)", true, true, false},
		{"foreign_owner", "O:WDD:P(A;;FA;;;" + current + ")", false, false, false},
		{"null_dacl", "O:" + current + "D:NO_ACCESS_CONTROL", false, false, false},
		{"empty_dacl", "O:" + current + "D:P", false, false, true},
		{"deny_does_not_mask_allow", "O:" + current + "D:P(D;;GW;;;WD)(A;;GW;;;WD)", false, false, false},
		{"inherit_only_not_current", "O:" + current + "D:P(A;OIIO;GW;;;BU)", true, false, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			e := checkDescriptor(descriptor(t, test.sddl), current, test.directory, test.private)
			if (e == nil) != test.allow {
				t.Fatalf("allow=%v error=%v", test.allow, e)
			}
		})
	}
}
func setDACL(t *testing.T, path, sddl string) {
	t.Helper()
	sd := descriptor(t, sddl)
	acl, _, e := sd.DACL()
	if e != nil {
		t.Fatal(e)
	}
	if e = windows.SetNamedSecurityInfo(path, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION|windows.PROTECTED_DACL_SECURITY_INFORMATION, nil, nil, acl, nil); e != nil {
		t.Fatal(e)
	}
}
func TestRealFileSecurityDescriptor(t *testing.T) {
	current := currentSID(t)
	path := filepath.Join(t.TempDir(), "runtime.exe")
	if e := os.WriteFile(path, []byte("not executed"), 0600); e != nil {
		t.Fatal(e)
	}
	private := "D:P(A;;FA;;;" + current + ")(A;;FA;;;SY)(A;;FA;;;BA)"
	setDACL(t, path, private)
	if e := checkObject(path, current, true); e != nil {
		t.Fatal("private file rejected", e)
	}
	setDACL(t, path, private+"(A;;GW;;;WD)")
	if e := checkObject(path, current, false); e == nil {
		t.Fatal("writable executable accepted")
	}
	setDACL(t, path, private)
}
func TestReparseObjectRejected(t *testing.T) {
	directory := t.TempDir()
	target := filepath.Join(directory, "target")
	if e := os.Mkdir(target, 0700); e != nil {
		t.Fatal(e)
	}
	link := filepath.Join(directory, "link")
	if e := os.Symlink(target, link); e != nil {
		t.Fatal("Windows reparse test requires symlink privilege", e)
	}
	if e := checkObject(link, currentSID(t), false); e != unsafePath {
		t.Fatal("reparse accepted", e)
	}
}
func TestUnsupportedPaths(t *testing.T) {
	for _, path := range []string{`relative.exe`, `\\server\share\kujo.exe`, `\\?\C:\kujo.exe`, `C:\kujo.exe:stream`, `\\.\pipe\kujo`} {
		if e := Check(path, false); e != unsafePath {
			t.Fatalf("unsupported path accepted: %q %v", path, e)
		}
	}
}
func TestUnknownACEFailsClosed(t *testing.T) {
	current := currentSID(t)
	sd := descriptor(t, "O:"+current+"D:P(A;;FA;;;"+current+")")
	acl, _, e := sd.DACL()
	if e != nil {
		t.Fatal(e)
	}
	var ace *windows.ACCESS_ALLOWED_ACE
	if e = windows.GetAce(acl, 0, &ace); e != nil {
		t.Fatal(e)
	}
	ace.Header.AceType = 0x5 // object ACE has a different layout; never cast its SID.
	if e = checkDescriptor(sd, current, false, false); e != unverified {
		t.Fatal("unknown ACE accepted", e)
	}
}

// Diagnostics are limited to synthetic CI fixture ancestry and ACL descriptors.
func explainAncestry(t *testing.T, path string) {
	t.Helper()
	for cursor := path; ; cursor = filepath.Dir(cursor) {
		if err := checkObject(cursor, currentSID(t), false); err != nil {
			sd, e := windows.GetNamedSecurityInfo(cursor, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
			if e == nil {
				t.Logf("rejected ancestor %s: %v; %s", filepath.Base(cursor), err, sd.String())
			} else {
				t.Logf("descriptor unavailable: %v", e)
			}
		}
		if filepath.Dir(cursor) == cursor {
			break
		}
	}
}

func TestFullPathChecksAncestors(t *testing.T) {
	current := currentSID(t)
	directory := t.TempDir()
	parent := filepath.Join(directory, "parent")
	if e := os.Mkdir(parent, 0700); e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(parent, "runtime.exe")
	if e := os.WriteFile(path, []byte("never executed"), 0600); e != nil {
		t.Fatal(e)
	}
	private := "D:P(A;;FA;;;" + current + ")(A;;FA;;;SY)(A;;FA;;;BA)"
	setDACL(t, parent, private)
	setDACL(t, path, private)
	// This also verifies the real runner's drive/profile ancestry. Unsupported
	// ownership is reported as a failure, never skipped or treated as permission.
	if e := Check(path, false); e != nil {
		explainAncestry(t, path)
		t.Fatal("trusted path rejected", e)
	}
	setDACL(t, parent, private+"(A;;0x40;;;WD)")
	if e := Check(path, false); e == nil {
		t.Fatal("replaceable ancestor accepted")
	}
	setDACL(t, parent, private)
}

func TestPrivateCreationAndInheritedFiles(t *testing.T) {
	directory := filepath.Join(t.TempDir(), "private", "nested")
	if e := MkdirPrivate(directory); e != nil {
		explainAncestry(t, filepath.Dir(filepath.Dir(directory)))
		t.Fatal(e)
	}
	if e := MkdirPrivate(directory); e != nil {
		t.Fatal("safe existing directory rejected", e)
	}
	file := filepath.Join(directory, "receipt")
	if e := os.WriteFile(file, []byte("private"), 0600); e != nil {
		t.Fatal(e)
	}
	if e := MkdirPrivate(file); e == nil {
		t.Fatal("file accepted as directory")
	}
	if e := MkdirPrivate(directory + "\x00bad"); e == nil {
		t.Fatal("NUL path accepted")
	}
	if e := Check(file, true); e != nil {
		t.Fatal("private DACL did not inherit", e)
	}
	current := currentSID(t)
	private := "D:P(A;;FA;;;" + current + ")(A;;FA;;;SY)(A;;FA;;;BA)"
	setDACL(t, directory, private+"(A;;GR;;;WD)")
	if e := MkdirPrivate(directory); e == nil {
		t.Fatal("unsafe existing state repaired or accepted")
	}
	setDACL(t, directory, private)
}
