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
	trusted := func(sid string) bool { return sid == current || sid == "S-1-5-18" || sid == "S-1-5-32-544" }
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
