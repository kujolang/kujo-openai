//go:build !darwin && !linux && !windows

package main

import (
	"errors"
	"os"
)

// POSIX mode bits are not evidence of Windows ACL safety. Fail closed until
// native ACL/owner and reparse-point validation have execution coverage.
func trustedPermissions(_ string, _ os.FileInfo) error {
	return errors.New("runtime_permissions_unverified")
}

func privatePermissions(_ string, _ os.FileInfo) error {
	return errors.New("runtime_permissions_unverified")
}
func makePrivateDirectory(_ string) error { return errors.New("runtime_permissions_unverified") }
