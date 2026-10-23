//go:build windows

package main

import (
	"errors"
	"github.com/kujolang/kujo-openai/native/internal/windowstrust"
	"os"
)

func trustedPermissions(path string, _ os.FileInfo) error {
	if windowstrust.Check(path, false) != nil {
		return errors.New("unsafe_runtime")
	}
	return nil
}
func privatePermissions(path string, _ os.FileInfo) error {
	if windowstrust.Check(path, true) != nil {
		return errors.New("unsafe_private_path")
	}
	return nil
}
func makePrivateDirectory(path string) error { return windowstrust.MkdirPrivate(path) }
