//go:build darwin || linux

package receipts

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestDurableRestartAndConcurrentInstances(t *testing.T) {
	root := filepath.Join(t.TempDir(), "receipts")
	a, e := Open(root)
	if e != nil {
		t.Fatal(e)
	}
	b, e := Open(root)
	if e != nil {
		t.Fatal(e)
	}
	raw := json.RawMessage(`{"schema":"fixture","evidence":{"unchanged":true}}`)
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
	again, e := Open(root)
	if e != nil {
		t.Fatal(e)
	}
	defer again.Close()
	for uri := range uris {
		got, e := again.Read(uri)
		if e != nil || string(got) != string(raw) {
			t.Fatal("receipt changed", e)
		}
	}
	if len(again.Recent()) != 0 {
		t.Fatal("instance-local index should reset")
	}
}
func TestTraversalSymlinksTamperingAndLimits(t *testing.T) {
	root := filepath.Join(t.TempDir(), "receipts")
	s, e := Open(root)
	if e != nil {
		t.Fatal(e)
	}
	defer s.Close()
	for _, uri := range []string{"../private", "kujo-receipt://sha256/../../private", "kujo-receipt://sha256/" + strings.Repeat("A", 64)} {
		if _, e = s.Read(uri); e == nil {
			t.Fatal("unsafe reference accepted")
		}
	}
	raw := json.RawMessage(`{"proof":true}`)
	uri, e := s.Put(raw)
	if e != nil {
		t.Fatal(e)
	}
	file := filepath.Join(root, strings.TrimPrefix(uri, "kujo-receipt://sha256/")+".json")
	if e = os.WriteFile(file, []byte(`{"proof":false}`), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e = s.Read(uri); e == nil {
		t.Fatal("tampering accepted")
	}
	if _, e = s.Put(raw); e == nil {
		t.Fatal("existing corrupt receipt overwritten")
	}
	os.Remove(file)
	outside := filepath.Join(t.TempDir(), "private")
	os.WriteFile(outside, raw, 0600)
	if e = os.Symlink(outside, file); e != nil {
		t.Fatal(e)
	}
	if _, e = s.Read(uri); e == nil {
		t.Fatal("external link followed")
	}
	if _, e = s.Put(json.RawMessage(strings.Repeat("x", 1048577))); e == nil {
		t.Fatal("oversize accepted")
	}
}
func TestRootAndRecentBoundary(t *testing.T) {
	root := t.TempDir()
	link := filepath.Join(t.TempDir(), "linked")
	os.Symlink(root, link)
	if _, e := Open(link); e == nil {
		t.Fatal("linked root accepted")
	}
	os.Chmod(root, 0755)
	if _, e := Open(root); e == nil {
		t.Fatal("public root accepted")
	}
	os.Chmod(root, 0700)
	s, e := Open(root)
	if e != nil {
		t.Fatal(e)
	}
	defer s.Close()
	last := ""
	for i := 0; i < 40; i++ {
		raw, _ := json.Marshal(map[string]int{"index": i})
		last, e = s.Put(raw)
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
}
