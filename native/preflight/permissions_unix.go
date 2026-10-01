//go:build darwin || linux

package main

import (
	"errors"
	"os"
	"syscall"
)

func trustedPermissions(info os.FileInfo) error {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return errors.New("runtime_permissions_unverified")
	}
	if stat.Uid != 0 && stat.Uid != uint32(os.Getuid()) {
		return errors.New("unsafe_runtime")
	}
	if info.Mode().Perm()&0022 != 0 {
		return errors.New("unsafe_runtime")
	}
	return nil
}
