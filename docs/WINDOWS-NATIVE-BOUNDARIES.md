# Windows native boundary implementation

Status: staged security component; native launcher remains fail-closed. Cross-compilation is not Windows execution evidence. Receipt storage, launcher integration and full native acceptance must pass before enabling Windows.

`native/internal/windowstrust` reads object security through a handle opened with `READ_CONTROL`, `FILE_READ_ATTRIBUTES`, `FILE_FLAG_OPEN_REPARSE_POINT` and directory-compatible flags. It rejects network/device paths, alternate streams and reparse points, then checks owner and DACL. The current user, SYSTEM, built-in Administrators and the exact Windows TrustedInstaller service SID are trusted; other owners fail closed. Unknown ACE layouts fail closed. NULL DACLs fail closed. Foreign write/change-owner/change-ACL/delete grants are rejected even if a deny ACE could cancel them. Directory ancestor delete-child grants are rejected; merely creating a sibling does not imply control of an already existing child. Private objects also reject foreign data-read and child-creation grants.

`MkdirPrivate` creates missing application directories with a protected inheritable DACL limited to the current user, SYSTEM and Administrators. It verifies existing directories rather than altering ACLs. Paths must already be selected by trusted host/operator configuration outside the project; this helper is not a model-facing operation.

Threat boundary: same-user administrators, SYSTEM and a compromised OS remain trusted. This is not a general sandbox or an effective-access evaluator for arbitrary enterprise ACLs. Conditional/object ACEs, network storage and reparse installations are unsupported, with explicit rejection. ACLs can change after inspection; callers must protect live object identity and apply project exclusion independently. Do not infer a filesystem grant from MCP roots or model content.

Tests include descriptor policies, real file DACL changes, reparse rejection, complete ancestor checks and private inheritance. The dedicated `Native Windows security boundaries` workflow runs on Windows; exact run results must be recorded before claiming validation. The library is deliberately not wired into the native launcher yet.

## Primary references (accessed 2026-10-01)

- [GetSecurityInfo](https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-getsecurityinfo): handle-based owner/DACL retrieval and required access rights.
- [NULL versus empty DACLs](https://learn.microsoft.com/en-us/windows/win32/secauthz/null-dacls-and-empty-dacls): NULL grants broad access; an empty ACL denies it.
- [ACCESS_ALLOWED_ACE](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-access_allowed_ace): standard mask/SID layout.
- [Reparse points and file operations](https://learn.microsoft.com/en-us/windows/win32/fileio/reparse-points-and-file-operations): explicit reparse-open behavior.
- [File security/access rights](https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights): file/directory permission meanings.
- [FlushFileBuffers](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers): Windows file durability requires appropriate writable handles; the POSIX directory-sync implementation is not assumed portable.

Windows CI identified the drive-root owner as TrustedInstaller. The policy recognizes that exact service SID and verifies it against Windows account lookup in a test; it does not accept arbitrary service accounts. See [Windows Resource Protection](https://learn.microsoft.com/en-us/windows/win32/wfp/about-windows-file-protection) (accessed 2026-10-01) for the service's operating-system authority. This resolves an overly restrictive owner check without accepting ordinary foreign writers.
