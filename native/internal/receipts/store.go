// Package receipts retains canonical bytes under content-addressed references.
// Publication uses synced temporary files and atomic links, never partial writes
// to a visible receipt name. Unsupported directory durability fails at startup.
package receipts

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sync"

	"github.com/kujolang/kujo-openai/native/internal/provider"
)

type Store struct {
	root      *os.Root
	directory *os.File
	mu        sync.Mutex
	recent    []string
}

func errorCode(code string, uncertain bool) error {
	return &provider.BoundaryError{Code: code, Uncertain: uncertain}
}
func Open(path string) (*Store, error) {
	if !filepath.IsAbs(path) {
		return nil, errorCode("absolute_receipt_directory_required", false)
	}
	if e := os.MkdirAll(path, 0700); e != nil {
		return nil, errorCode("receipt_directory_unavailable", false)
	}
	before, e := os.Lstat(path)
	if e != nil || !before.IsDir() || before.Mode()&os.ModeSymlink != 0 || before.Mode().Perm()&0077 != 0 {
		return nil, errorCode("unsafe_receipt_directory", false)
	}
	root, e := os.OpenRoot(path)
	if e != nil {
		return nil, errorCode("receipt_directory_unavailable", false)
	}
	directory, e := root.Open(".")
	if e != nil {
		root.Close()
		return nil, errorCode("receipt_directory_unavailable", false)
	}
	after, e := directory.Stat()
	if e != nil || !os.SameFile(before, after) {
		root.Close()
		directory.Close()
		return nil, errorCode("unsafe_receipt_directory", false)
	}
	if e = directory.Sync(); e != nil {
		root.Close()
		directory.Close()
		return nil, errorCode("receipt_storage_durability_unavailable", false)
	}
	return &Store{root: root, directory: directory}, nil
}
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return errors.Join(s.directory.Close(), s.root.Close())
}
func (s *Store) Put(raw json.RawMessage) (string, error) {
	if len(raw) > provider.Limit || !json.Valid(raw) {
		return "", errorCode("invalid_receipt", true)
	}
	sum := sha256.Sum256(raw)
	digest := hex.EncodeToString(sum[:])
	uri := "kujo-receipt://sha256/" + digest
	// Serialize commit/index changes within one instance. Independent processes
	// safely race on the final link; an existing object must match exact bytes.
	s.mu.Lock()
	defer s.mu.Unlock()
	temp := ".pending-" + rand.Text()
	file, e := s.root.OpenFile(temp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if e != nil {
		return "", errorCode("receipt_persistence_failed", true)
	}
	defer s.root.Remove(temp)
	if _, e = file.Write(raw); e == nil {
		e = file.Sync()
	}
	closeError := file.Close()
	if e != nil || closeError != nil {
		return "", errorCode("receipt_persistence_failed", true)
	}
	e = s.root.Link(temp, digest+".json")
	if e != nil {
		if !errors.Is(e, os.ErrExist) {
			return "", errorCode("receipt_persistence_failed", true)
		}
		existing, e := s.read(uri)
		if e != nil || !bytes.Equal(existing, raw) {
			return "", errorCode("receipt_integrity_failed", true)
		}
	}
	if e = s.directory.Sync(); e != nil {
		return "", errorCode("receipt_persistence_failed", true)
	}
	for i, v := range s.recent {
		if v == uri {
			s.recent = append(s.recent[:i], s.recent[i+1:]...)
			break
		}
	}
	s.recent = append(s.recent, uri)
	if len(s.recent) > 32 {
		s.recent = s.recent[len(s.recent)-32:]
	}
	return uri, nil
}

var reference = regexp.MustCompile(`^kujo-receipt://sha256/([a-f0-9]{64})$`)

func (s *Store) Read(uri string) (json.RawMessage, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.read(uri)
}
func (s *Store) read(uri string) (json.RawMessage, error) {
	match := reference.FindStringSubmatch(uri)
	if match == nil {
		return nil, errorCode("invalid_receipt_reference", false)
	}
	name := match[1] + ".json"
	info, e := s.root.Lstat(name)
	if e != nil || !info.Mode().IsRegular() || info.Size() > provider.Limit {
		return nil, errorCode("invalid_receipt_file", false)
	}
	file, e := s.root.Open(name)
	if e != nil {
		return nil, errorCode("invalid_receipt_file", false)
	}
	defer file.Close()
	after, e := file.Stat()
	if e != nil || !os.SameFile(info, after) {
		return nil, errorCode("invalid_receipt_file", false)
	}
	raw, e := io.ReadAll(io.LimitReader(file, provider.Limit+1))
	if e != nil || len(raw) > provider.Limit {
		return nil, errorCode("invalid_receipt_file", false)
	}
	digest := sha256.Sum256(raw)
	if hex.EncodeToString(digest[:]) != match[1] || !json.Valid(raw) {
		return nil, errorCode("receipt_integrity_failed", false)
	}
	return raw, nil
}
func (s *Store) Recent() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]string, len(s.recent))
	for i, v := range s.recent {
		out[len(out)-1-i] = v
	}
	return out
}
