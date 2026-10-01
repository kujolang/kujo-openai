//go:build windows

package integration

import (
	"crypto/rand"
	"github.com/kujolang/kujo-openai/native/internal/windowstrust"
	"os"
	"path/filepath"
)

func trustedTestDirectory(home, prefix string) (string, error) {
	path := filepath.Join(home, prefix+rand.Text())
	return path, windowstrust.MkdirPrivate(path)
}
func runtimeFilename() string { return "kujo.exe" }
func testEnvironment(home string) []string {
	return []string{"USERPROFILE=" + home, "SystemRoot=" + os.Getenv("SystemRoot"), "PATH="}
}
func testWorkingDirectory(home string) string {
	return filepath.VolumeName(home) + string(os.PathSeparator)
}
