//go:build windows

package receipts

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"

	"github.com/kujolang/kujo-openai/native/internal/provider"
	"github.com/kujolang/kujo-openai/native/internal/windowstrust"
	bolt "go.etcd.io/bbolt"
	"golang.org/x/sys/windows"
)

// Windows uses synced bbolt transactions rather than emulating Unix directory
// fsync. Locks are operation-scoped so independent MCP instances can coexist.
// The database is local, private, bounded, and never supplied by a tool caller.
type Store struct {
	mu        sync.Mutex
	path      string
	directory *os.File
	recent    []string
	closed    bool
}

const databaseName = "receipts-v1.db"
const databaseLimit = 256 << 20
const lockTimeout = 2 * time.Second

var bucketName = []byte("canonical-receipts-v1")
var reference = regexp.MustCompile(`^kujo-receipt://sha256/([a-f0-9]{64})$`)

func errorCode(code string, uncertain bool) error {
	return &provider.BoundaryError{Code: code, Uncertain: uncertain}
}

func Open(path string) (*Store, error) {
	if !filepath.IsAbs(path) {
		return nil, errorCode("absolute_receipt_directory_required", false)
	}
	if err := windowstrust.MkdirPrivate(path); err != nil {
		return nil, errorCode("unsafe_receipt_directory", false)
	}
	name, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return nil, errorCode("unsafe_receipt_directory", false)
	}
	// Denying delete sharing pins the selected directory until Close.
	h, err := windows.CreateFile(name, windows.FILE_READ_ATTRIBUTES, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_BACKUP_SEMANTICS|windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
	if err != nil {
		return nil, errorCode("receipt_directory_unavailable", false)
	}
	s := &Store{path: filepath.Clean(path), directory: os.NewFile(uintptr(h), path)}
	if err = s.check(); err == nil {
		err = s.transaction(true, func(db *bolt.DB) error {
			return db.Update(func(tx *bolt.Tx) error { _, e := tx.CreateBucketIfNotExists(bucketName); return e })
		})
	}
	if err != nil {
		s.directory.Close()
		return nil, errorCode("receipt_storage_durability_unavailable", false)
	}
	return s, nil
}

func (s *Store) check() error {
	if s.closed {
		return errors.New("closed")
	}
	if err := windowstrust.Check(s.path, true); err != nil {
		return err
	}
	before, err := s.directory.Stat()
	if err != nil {
		return err
	}
	after, err := os.Lstat(s.path)
	if err != nil {
		return err
	}
	if !after.IsDir() || after.Mode()&os.ModeSymlink != 0 || !os.SameFile(before, after) {
		return errors.New("changed_directory")
	}
	return nil
}

// The custom opener rejects reparse objects, keeps delete sharing disabled,
// verifies private ACLs and caps size before bbolt maps any pages. On reconnect
// a missing database is an error, not permission to recreate lost evidence.
func (s *Store) transaction(create bool, fn func(*bolt.DB) error) error {
	if err := s.check(); err != nil {
		return err
	}
	path := filepath.Join(s.path, databaseName)
	db, err := bolt.Open(path, 0600, &bolt.Options{Timeout: lockTimeout, MaxSize: databaseLimit,
		OpenFile: func(path string, _ int, _ os.FileMode) (*os.File, error) {
			name, e := windows.UTF16PtrFromString(path)
			if e != nil {
				return nil, e
			}
			disposition := uint32(windows.OPEN_EXISTING)
			if create {
				disposition = windows.CREATE_NEW
			}
			h, e := windows.CreateFile(name, windows.GENERIC_READ|windows.GENERIC_WRITE, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE, nil, disposition, windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
			fresh := create && e == nil
			if create && (e == windows.ERROR_FILE_EXISTS || e == windows.ERROR_ALREADY_EXISTS) {
				h, e = windows.CreateFile(name, windows.GENERIC_READ|windows.GENERIC_WRITE, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE, nil, windows.OPEN_EXISTING, windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
			}
			if e != nil {
				return nil, e
			}
			f := os.NewFile(uintptr(h), path)
			info, e := f.Stat()
			if e == nil && (!info.Mode().IsRegular() || info.Size() > databaseLimit || (!fresh && info.Size() == 0)) {
				e = errors.New("invalid_database")
			}
			if e == nil {
				e = windowstrust.Check(path, true)
			}
			if e != nil {
				f.Close()
				return nil, e
			}
			return f, nil
		},
	})
	if err != nil {
		return err
	}
	defer db.Close()
	err = fn(db)
	return errors.Join(err, db.Close())
}

func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	s.closed = true
	if s.directory.Close() != nil {
		return errorCode("receipt_storage_close_failed", false)
	}
	return nil
}

func (s *Store) Put(raw json.RawMessage) (string, error) {
	if len(raw) > provider.Limit || !json.Valid(raw) {
		return "", errorCode("invalid_receipt", true)
	}
	sum := sha256.Sum256(raw)
	digest := hex.EncodeToString(sum[:])
	uri := "kujo-receipt://sha256/" + digest
	s.mu.Lock()
	defer s.mu.Unlock()
	corrupt := false
	err := s.transaction(false, func(db *bolt.DB) error {
		return db.Update(func(tx *bolt.Tx) error {
			b := tx.Bucket(bucketName)
			if b == nil {
				return errors.New("missing_bucket")
			}
			if old := b.Get([]byte(digest)); old != nil {
				if !bytes.Equal(old, raw) {
					corrupt = true
					return errors.New("changed_receipt")
				}
				return nil
			}
			return b.Put([]byte(digest), raw)
		})
	})
	if corrupt {
		return "", errorCode("receipt_integrity_failed", true)
	}
	if err != nil {
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

func (s *Store) Read(uri string) (json.RawMessage, error) {
	match := reference.FindStringSubmatch(uri)
	if match == nil {
		return nil, errorCode("invalid_receipt_reference", false)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	var raw json.RawMessage
	err := s.transaction(false, func(db *bolt.DB) error {
		return db.View(func(tx *bolt.Tx) error {
			b := tx.Bucket(bucketName)
			if b == nil {
				return errors.New("missing_bucket")
			}
			v := b.Get([]byte(match[1]))
			if len(v) == 0 || len(v) > provider.Limit {
				return errors.New("missing_receipt")
			}
			raw = bytes.Clone(v)
			return nil
		})
	})
	if err != nil {
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
