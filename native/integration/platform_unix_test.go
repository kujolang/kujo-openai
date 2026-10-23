//go:build !windows

package integration

import "os"

func trustedTestDirectory(home, prefix string) (string, error) { return os.MkdirTemp(home, prefix) }
func runtimeFilename() string                                  { return "kujo" }
func testEnvironment(home string) []string                     { return []string{"HOME=" + home, "PATH="} }
func testWorkingDirectory(_ string) string                     { return "/" }
