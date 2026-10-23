//go:build windows

package receipts

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kujolang/kujo-openai/native/internal/provider"
	"github.com/kujolang/kujo-openai/native/internal/windowstrust"
	bolt "go.etcd.io/bbolt"
	"golang.org/x/sys/windows"
)

func windowsStore(t *testing.T) (*Store, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "receipts")
	s, e := Open(path)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { s.Close() })
	return s, path
}
func assertBoundary(t *testing.T, e error, code string, uncertain bool) {
	t.Helper()
	var boundary *provider.BoundaryError
	if !errors.As(e, &boundary) || boundary.Code != code || boundary.Uncertain != uncertain {
		t.Fatalf("want %s uncertain=%v; got %v", code, uncertain, e)
	}
}

func TestWindowsReceiptsConcurrentRestart(t *testing.T) {
	a, path := windowsStore(t)
	b, e := Open(path)
	if e != nil {
		t.Fatal(e)
	}
	defer b.Close()
	raw := json.RawMessage("{\n  \"canonical\": true, \"unicode\": \"é\"\n}")
	var wg sync.WaitGroup
	uris := make(chan string, 16)
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			s := a
			if i%2 != 0 {
				s = b
			}
			uri, e := s.Put(raw)
			if e != nil {
				t.Error(e)
				return
			}
			uris <- uri
		}(i)
	}
	wg.Wait()
	close(uris)
	a.Close()
	b.Close()
	c, e := Open(path)
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	count := 0
	for uri := range uris {
		count++
		got, e := c.Read(uri)
		if e != nil || string(got) != string(raw) {
			t.Fatal("canonical bytes changed", e)
		}
	}
	if count != 16 || len(c.Recent()) != 0 {
		t.Fatal("missing writes or persisted instance index")
	}
	if e := windowstrust.Check(filepath.Join(path, databaseName), true); e != nil {
		t.Fatal("database not private", e)
	}
}

func TestWindowsReceiptBoundsAndIndex(t *testing.T) {
	s, _ := windowsStore(t)
	for _, uri := range []string{"../private", "kujo-receipt://sha256/../../private", "kujo-receipt://sha256/" + strings.Repeat("A", 64)} {
		_, e := s.Read(uri)
		assertBoundary(t, e, "invalid_receipt_reference", false)
	}
	for _, raw := range []json.RawMessage{nil, []byte("not json"), []byte(`"` + strings.Repeat("x", provider.Limit) + `"`)} {
		_, e := s.Put(raw)
		assertBoundary(t, e, "invalid_receipt", true)
	}
	last := ""
	for i := 0; i < 40; i++ {
		var e error
		last, e = s.Put(json.RawMessage(fmt.Sprintf(`{"index":%d}`, i)))
		if e != nil {
			t.Fatal(e)
		}
	}
	list := s.Recent()
	if len(list) != 32 || list[0] != last {
		t.Fatal("unbounded or unordered index")
	}
	list[0] = "changed"
	if s.Recent()[0] != last {
		t.Fatal("index alias")
	}
	s.Close()
	_, e := s.Put(json.RawMessage(`{}`))
	assertBoundary(t, e, "receipt_persistence_failed", true)
	_, e = s.Read(last)
	assertBoundary(t, e, "invalid_receipt_file", false)
}

func TestWindowsReceiptTampering(t *testing.T) {
	s, _ := windowsStore(t)
	raw := json.RawMessage(`{"proof":true}`)
	uri, e := s.Put(raw)
	if e != nil {
		t.Fatal(e)
	}
	e = s.transaction(false, func(db *bolt.DB) error {
		return db.Update(func(tx *bolt.Tx) error {
			return tx.Bucket(bucketName).Put([]byte(strings.TrimPrefix(uri, "kujo-receipt://sha256/")), []byte(`{"proof":false}`))
		})
	})
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Read(uri)
	assertBoundary(t, e, "receipt_integrity_failed", false)
	_, e = s.Put(raw)
	assertBoundary(t, e, "receipt_integrity_failed", true)
}

func TestWindowsReceiptMissingDatabaseNotRecreated(t *testing.T) {
	s, path := windowsStore(t)
	if e := os.Remove(filepath.Join(path, databaseName)); e != nil {
		t.Fatal(e)
	}
	_, e := s.Put(json.RawMessage(`{}`))
	assertBoundary(t, e, "receipt_persistence_failed", true)
	if _, e = os.Stat(filepath.Join(path, databaseName)); !errors.Is(e, os.ErrNotExist) {
		t.Fatal("missing database recreated")
	}
}

func TestWindowsReceiptLockTimeout(t *testing.T) {
	s, path := windowsStore(t)
	db, e := bolt.Open(filepath.Join(path, databaseName), 0600, nil)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	start := time.Now()
	_, e = s.Put(json.RawMessage(`{"secret_fixture":"must_not_leak"}`))
	assertBoundary(t, e, "receipt_persistence_failed", true)
	if elapsed := time.Since(start); elapsed < lockTimeout-100*time.Millisecond || elapsed > lockTimeout+3*time.Second {
		t.Fatalf("lock deadline %s", elapsed)
	}
	if len(s.Recent()) != 0 {
		t.Fatal("failed commit entered index")
	}
}

func TestWindowsReceiptPathAndReparseBoundaries(t *testing.T) {
	for _, path := range []string{"relative", `\\server\share\receipts`, `C:\receipt:stream`} {
		if s, e := Open(path); e == nil {
			s.Close()
			t.Fatal("unsafe path accepted")
		}
	}
	s, path := windowsStore(t)
	// An open store pins its directory; it cannot be renamed underneath calls.
	if e := os.Rename(path, path+"-moved"); e == nil {
		t.Fatal("open root was replaceable")
	}
	s.Close()
	link := filepath.Join(t.TempDir(), "linked")
	if e := os.Symlink(path, link); e != nil {
		t.Fatal(e)
	}
	if other, e := Open(link); e == nil {
		other.Close()
		t.Fatal("linked directory accepted")
	}
	database := filepath.Join(path, databaseName)
	if e := os.Remove(database); e != nil {
		t.Fatal(e)
	}
	outside := filepath.Join(t.TempDir(), "outside.db")
	if e := os.WriteFile(outside, []byte("not a database"), 0600); e != nil {
		t.Fatal(e)
	}
	if e := os.Symlink(outside, database); e != nil {
		t.Fatal(e)
	}
	if other, e := Open(path); e == nil {
		other.Close()
		t.Fatal("linked database accepted")
	}
	got, _ := os.ReadFile(outside)
	if string(got) != "not a database" {
		t.Fatal("external content changed")
	}
}

func TestWindowsReceiptCorruptDatabase(t *testing.T) {
	s, path := windowsStore(t)
	s.Close()
	if e := os.WriteFile(filepath.Join(path, databaseName), []byte("private_corrupt_fixture"), 0600); e != nil {
		t.Fatal(e)
	}
	_, e := Open(path)
	assertBoundary(t, e, "receipt_storage_durability_unavailable", false)
	if e = os.Truncate(filepath.Join(path, databaseName), 0); e != nil {
		t.Fatal(e)
	}
	_, e = Open(path)
	assertBoundary(t, e, "receipt_storage_durability_unavailable", false)
}

func TestWindowsReceiptPrivateACLRequired(t *testing.T) {
	s, path := windowsStore(t)
	database := filepath.Join(path, databaseName)
	user, e := windows.GetCurrentProcessToken().GetTokenUser()
	if e != nil {
		t.Fatal(e)
	}
	sd, e := windows.SecurityDescriptorFromString("D:P(A;;FA;;;" + user.User.Sid.String() + ")(A;;FA;;;SY)(A;;FA;;;BA)(A;;GR;;;WD)")
	if e != nil {
		t.Fatal(e)
	}
	acl, _, e := sd.DACL()
	if e != nil {
		t.Fatal(e)
	}
	if e = windows.SetNamedSecurityInfo(database, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION|windows.PROTECTED_DACL_SECURITY_INFORMATION, nil, nil, acl, nil); e != nil {
		t.Fatal(e)
	}
	_, e = s.Put(json.RawMessage(`{}`))
	assertBoundary(t, e, "receipt_persistence_failed", true)
	s.Close()
	_, e = Open(path)
	assertBoundary(t, e, "receipt_storage_durability_unavailable", false)
}

func TestWindowsReceiptInterruptedTransaction(t *testing.T) {
	const raw = `{"uncommitted":true}`
	sum := sha256.Sum256([]byte(raw))
	digest := hex.EncodeToString(sum[:])
	if path := os.Getenv("KUJO_RECEIPT_ABORT_CHILD"); path != "" {
		s, e := Open(path)
		if e != nil {
			os.Exit(30)
		}
		s.transaction(false, func(db *bolt.DB) error {
			return db.Update(func(tx *bolt.Tx) error {
				if e := tx.Bucket(bucketName).Put([]byte(digest), []byte(raw)); e != nil {
					os.Exit(31)
				}
				fmt.Println("ready")
				time.Sleep(time.Minute)
				return errors.New("not_committed")
			})
		})
		os.Exit(32)
	}
	s, path := windowsStore(t)
	old, e := s.Put(json.RawMessage(`{"previous_commit":true}`))
	if e != nil {
		t.Fatal(e)
	}
	cmd := exec.Command(os.Args[0], "-test.run=^TestWindowsReceiptInterruptedTransaction$")
	cmd.Env = append(os.Environ(), "KUJO_RECEIPT_ABORT_CHILD="+path)
	out, e := cmd.StdoutPipe()
	if e != nil {
		t.Fatal(e)
	}
	if e = cmd.Start(); e != nil {
		t.Fatal(e)
	}
	defer cmd.Process.Kill()
	ready := make(chan bool, 1)
	go func() { scanner := bufio.NewScanner(out); ready <- scanner.Scan() && scanner.Text() == "ready" }()
	select {
	case ok := <-ready:
		if !ok {
			cmd.Process.Kill()
			cmd.Wait()
			t.Fatal("child did not begin transaction")
		}
	case <-time.After(10 * time.Second):
		cmd.Process.Kill()
		cmd.Wait()
		t.Fatal("child deadline")
	}
	if e = cmd.Process.Kill(); e != nil {
		t.Fatal(e)
	}
	cmd.Wait()
	if _, e = s.Read(old); e != nil {
		t.Fatal("prior committed receipt lost", e)
	}
	_, e = s.Read("kujo-receipt://sha256/" + digest)
	assertBoundary(t, e, "invalid_receipt_file", false)
	if _, e = s.Put(json.RawMessage(raw)); e != nil {
		t.Fatal("lock not released after termination", e)
	}
}

func TestWindowsReceiptProcessExit(t *testing.T) {
	if path := os.Getenv("KUJO_RECEIPT_TEST_CHILD"); path != "" {
		s, e := Open(path)
		if e != nil {
			os.Exit(20)
		}
		if _, e = s.Put(json.RawMessage(`{"child_commit":true}`)); e != nil {
			os.Exit(21)
		}
		// No Store.Close or graceful Go exit: receipt already committed and synced.
		os.Exit(0)
	}
	s, path := windowsStore(t)
	cmd := exec.Command(os.Args[0], "-test.run=^TestWindowsReceiptProcessExit$")
	cmd.Env = append(os.Environ(), "KUJO_RECEIPT_TEST_CHILD="+path)
	if out, e := cmd.CombinedOutput(); e != nil {
		t.Fatalf("child: %v %s", e, out)
	}
	sum := sha256.Sum256([]byte(`{"child_commit":true}`))
	uri := "kujo-receipt://sha256/" + hex.EncodeToString(sum[:])
	got, e := s.Read(uri)
	if e != nil || string(got) != `{"child_commit":true}` {
		t.Fatal("process commit lost", e)
	}
}
