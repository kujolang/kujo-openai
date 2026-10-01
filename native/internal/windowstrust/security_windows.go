//go:build windows

// Package windowstrust inspects local Windows file security descriptors. It
// never changes ACLs, enables privileges, or treats POSIX mode bits as evidence.
package windowstrust

import (
	"errors"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

var unsafePath = errors.New("unsafe_windows_path")
var unsafeACL = errors.New("unsafe_windows_acl")
var unverified = errors.New("windows_security_unverified")

// Windows Modules Installer owns protected OS ancestors. Trust exactly this
// service SID, not arbitrary NT SERVICE identities or an account-name match.
const trustedInstallerSID = "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"

var drive = regexp.MustCompile(`^[A-Za-z]:$`)

// Check inspects the object and every existing ancestor. Network/device paths,
// alternate streams and all reparse points are unsupported, including junctions.
// private additionally rejects data-read grants to unrelated principals on the
// selected object; ancestors need integrity protection, not confidentiality.
func Check(path string, private bool) error {
	if !filepath.IsAbs(path) || !drive.MatchString(filepath.VolumeName(path)) || strings.Contains(strings.TrimPrefix(path, filepath.VolumeName(path)), ":") {
		return unsafePath
	}
	user, e := windows.GetCurrentProcessToken().GetTokenUser()
	if e != nil {
		return unverified
	}
	first := true
	for cursor := filepath.Clean(path); ; cursor = filepath.Dir(cursor) {
		if e = checkObject(cursor, user.User.Sid.String(), private && first); e != nil {
			return e
		}
		if filepath.Dir(cursor) == cursor {
			break
		}
		first = false
	}
	return nil
}

func checkObject(path, current string, private bool) error {
	name, e := windows.UTF16PtrFromString(path)
	if e != nil {
		return unsafePath
	}
	handle, e := windows.CreateFile(name, windows.READ_CONTROL|windows.FILE_READ_ATTRIBUTES, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_OPEN_REPARSE_POINT|windows.FILE_FLAG_BACKUP_SEMANTICS, 0)
	if e != nil {
		return unverified
	}
	defer windows.CloseHandle(handle)
	kind, e := windows.GetFileType(handle)
	if e != nil || kind != windows.FILE_TYPE_DISK {
		return unsafePath
	}
	var info windows.ByHandleFileInformation
	if e = windows.GetFileInformationByHandle(handle, &info); e != nil {
		return unverified
	}
	if info.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 {
		return unsafePath
	}
	descriptor, e := windows.GetSecurityInfo(handle, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION)
	if e != nil {
		return unverified
	}
	return checkDescriptor(descriptor, current, info.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY != 0, private)
}

func checkDescriptor(sd *windows.SECURITY_DESCRIPTOR, current string, directory, private bool) error {
	if sd == nil {
		return unverified
	}
	defer runtime.KeepAlive(sd)
	trusted := func(sid string) bool {
		return sid == current || sid == "S-1-5-18" || sid == "S-1-5-32-544" || sid == trustedInstallerSID
	}
	owner, _, e := sd.Owner()
	if e != nil || owner == nil || !trusted(owner.String()) {
		return unsafeACL
	}
	acl, _, e := sd.DACL()
	if e != nil || acl == nil {
		return unsafeACL
	} // NULL grants everyone full control.
	for i := uint32(0); i < uint32(acl.AceCount); i++ {
		var ace *windows.ACCESS_ALLOWED_ACE
		if e = windows.GetAce(acl, i, &ace); e != nil || ace == nil {
			return unverified
		}
		if ace.Header.AceFlags&windows.INHERIT_ONLY_ACE != 0 {
			continue
		}
		// Unknown callback/object ACE formats are not parsed as standard ACEs.
		if ace.Header.AceType == windows.ACCESS_DENIED_ACE_TYPE {
			continue
		}
		if ace.Header.AceType != windows.ACCESS_ALLOWED_ACE_TYPE || ace.Header.AceSize < 16 {
			return unverified
		}
		sid := (*windows.SID)(unsafe.Pointer(&ace.SidStart))
		bytes := unsafe.Slice((*byte)(unsafe.Pointer(&ace.SidStart)), int(ace.Header.AceSize)-8)
		if bytes[0] != 1 || bytes[1] > 15 || 8+4*int(bytes[1]) > len(bytes) || !sid.IsValid() {
			return unverified
		}
		if trusted(sid.String()) {
			continue
		}
		// Even when a deny ACE might cancel a grant, reject it conservatively.
		forbidden := uint32(windows.GENERIC_ALL | windows.GENERIC_WRITE | windows.WRITE_DAC | windows.WRITE_OWNER | windows.DELETE | windows.FILE_WRITE_EA | windows.FILE_WRITE_ATTRIBUTES)
		if directory {
			forbidden |= 0x40 // FILE_DELETE_CHILD can replace protected descendants.
			// Merely adding a new sibling cannot modify the already existing child.
		} else {
			forbidden |= windows.FILE_WRITE_DATA | windows.FILE_APPEND_DATA
		}
		if private {
			forbidden |= windows.GENERIC_READ | windows.FILE_READ_DATA | windows.FILE_READ_EA | windows.FILE_WRITE_DATA | windows.FILE_APPEND_DATA
		}
		if uint32(ace.Mask)&forbidden != 0 {
			return unsafeACL
		}
	}
	return nil
}

// MkdirPrivate creates a new directory with a protected inheritable DACL. It
// never repairs or broadens an existing object's permissions. Callers must keep
// these paths outside any model-controlled project before invoking this helper.
func MkdirPrivate(path string) error {
	if !filepath.IsAbs(path) || !drive.MatchString(filepath.VolumeName(path)) || strings.Contains(strings.TrimPrefix(path, filepath.VolumeName(path)), ":") {
		return unsafePath
	}
	path = filepath.Clean(path)
	name, e := windows.UTF16PtrFromString(path)
	if e != nil {
		return unsafePath
	}
	if attributes, e := windows.GetFileAttributes(name); e == nil {
		if attributes&windows.FILE_ATTRIBUTE_DIRECTORY == 0 {
			return unsafePath
		}
		return Check(path, true)
	} else if e != windows.ERROR_FILE_NOT_FOUND && e != windows.ERROR_PATH_NOT_FOUND {
		return unverified
	}
	parent := filepath.Dir(path)
	if parent == path {
		return unsafePath
	}
	if _, e := windows.GetFileAttributes(windows.StringToUTF16Ptr(parent)); e != nil {
		if e = MkdirPrivate(parent); e != nil {
			return e
		}
	}
	if e := Check(parent, false); e != nil {
		return e
	}
	user, e := windows.GetCurrentProcessToken().GetTokenUser()
	if e != nil {
		return unverified
	}
	sd, e := windows.SecurityDescriptorFromString("D:P(A;OICI;FA;;;" + user.User.Sid.String() + ")(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)")
	if e != nil {
		return unverified
	}
	defer runtime.KeepAlive(sd)
	attributes := windows.SecurityAttributes{Length: uint32(unsafe.Sizeof(windows.SecurityAttributes{})), SecurityDescriptor: sd}
	e = windows.CreateDirectory(name, &attributes)
	if e != nil && e != windows.ERROR_ALREADY_EXISTS {
		return unverified
	}
	return Check(path, true)
}
