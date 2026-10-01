package adapter

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/kujolang/kujo-openai/native/internal/receipts"
	"github.com/kujolang/kujo-openai/native/internal/transport"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kujolang/kujo-openai/native/internal/provider"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Memory storage exists only in these isolated contract tests. A runnable
// production launcher must supply a separately verified durable store.
type memoryStore struct {
	mu      sync.Mutex
	records []json.RawMessage
	deny    bool
}

func (s *memoryStore) Put(raw json.RawMessage) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.deny {
		return "", errors.New("private disk error")
	}
	s.records = append(s.records, append(json.RawMessage(nil), raw...))
	return "kujo-receipt://test/record", nil
}

func (s *memoryStore) Read(string) (json.RawMessage, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.records) == 0 {
		return nil, errors.New("missing")
	}
	return s.records[len(s.records)-1], nil
}
func (s *memoryStore) Recent() []string { return []string{"kujo-receipt://test/record"} }

type backendFunc func(context.Context, map[string]any) (json.RawMessage, error)

func (f backendFunc) Request(c context.Context, r map[string]any) (json.RawMessage, error) {
	return f(c, r)
}
func marshal(v any) json.RawMessage {
	raw, e := json.Marshal(v)
	if e != nil {
		panic(e)
	}
	return raw
}
func fixtureTool() *mcp.Tool {
	return &mcp.Tool{Name: Name("kujo.fixture.read", "1.0.0"), Description: "Isolated validation fixture", InputSchema: map[string]any{"type": "object"}, OutputSchema: map[string]any{"type": "object", "required": []string{"value"}, "properties": map[string]any{"value": map[string]any{"type": "string"}}}, Meta: mcp.Meta{"kujo/abilityId": "kujo.fixture.read", "kujo/abilityVersion": "1.0.0", "kujo/definitionDigest": strings.Repeat("a", 64)}}
}
func catalog(tools ...*mcp.Tool) json.RawMessage {
	if tools == nil {
		tools = []*mcp.Tool{}
	}
	return marshal(map[string]any{"ok": true, "schema": "kujo.openai.catalog/v1", "tools": tools, "unsupported": []any{}})
}
func backend(transform func(map[string]any)) *Adapter {
	tool := fixtureTool()
	a, _ := New(backendFunc(func(_ context.Context, request map[string]any) (json.RawMessage, error) {
		if request["operation"] == "discover" {
			return catalog(tool), nil
		}
		receipt := map[string]any{"schema": "kujo.ability.receipt/v1", "invocation_id": request["invocation_id"], "ability_id": "kujo.fixture.read", "ability_version": "1.0.0", "definition_digest": strings.Repeat("a", 64), "surface": "mcp", "status": "succeeded", "receipt_id": "receipt", "started_at_ms": 1, "completed_at_ms": 2, "result": map[string]any{"value": "hello"}}
		response := map[string]any{"ok": true, "receipt": receipt}
		if transform != nil {
			transform(response)
		}
		return marshal(response), nil
	}), &memoryStore{})
	return a
}
func TestIdentityCollisionAndSchemas(t *testing.T) {
	if Name("kujo.a_b.c", "1.0.0") == Name("kujo.a.b_c", "1.0.0") {
		t.Fatal("collision")
	}
	for _, mutate := range []func(*mcp.Tool){func(t *mcp.Tool) { t.Name = "forged" }, func(t *mcp.Tool) { t.Meta["kujo/definitionDigest"] = "bad" }, func(t *mcp.Tool) { t.InputSchema = map[string]any{"type": "array"} }, func(t *mcp.Tool) {
		t.OutputSchema = map[string]any{"type": "object", "$ref": "https://example.invalid/schema"}
	}} {
		tool := fixtureTool()
		mutate(tool)
		a, _ := New(backendFunc(func(context.Context, map[string]any) (json.RawMessage, error) { return catalog(tool), nil }), &memoryStore{})
		if _, e := a.Discover(context.Background()); e == nil {
			t.Fatal("invalid catalog accepted")
		}
	}
	tool := fixtureTool()
	a, _ := New(backendFunc(func(context.Context, map[string]any) (json.RawMessage, error) { return catalog(tool, tool), nil }), &memoryStore{})
	if _, e := a.Discover(context.Background()); e == nil {
		t.Fatal("duplicate accepted")
	}
}
func TestReceiptForgeryAndResultValidation(t *testing.T) {
	for _, mutate := range []func(map[string]any){func(r map[string]any) { delete(r, "ok") }, func(r map[string]any) { r["receipt"].(map[string]any)["invocation_id"] = "forged" }, func(r map[string]any) { r["receipt"].(map[string]any)["completed_at_ms"] = 0 }, func(r map[string]any) { r["receipt"].(map[string]any)["result"] = map[string]any{"value": 22} }, func(r map[string]any) { delete(r, "receipt") }} {
		a := backend(mutate)
		_, e := a.Call(context.Background(), fixtureTool().Name, map[string]any{})
		var boundary *provider.BoundaryError
		if !errors.As(e, &boundary) || !boundary.Uncertain {
			t.Fatal("forgery not rejected as uncertain", e)
		}
	}
}
func TestPersistenceAndErrorRedaction(t *testing.T) {
	a := backend(nil)
	a.receipts = &memoryStore{deny: true}
	_, e := a.Call(context.Background(), fixtureTool().Name, map[string]any{})
	r := Failure(e)
	raw := string(marshal(r))
	if !r.IsError || strings.Contains(raw, "private disk") || !strings.Contains(raw, "completion_uncertain") {
		t.Fatal(raw)
	}
}
func TestCanonicalRevocationIsRechecked(t *testing.T) {
	var count int
	tool := fixtureTool()
	a, _ := New(backendFunc(func(_ context.Context, r map[string]any) (json.RawMessage, error) {
		count++
		if count == 1 {
			return catalog(tool), nil
		}
		return catalog(), nil
	}), &memoryStore{})
	if _, e := a.Discover(context.Background()); e != nil {
		t.Fatal(e)
	}
	if _, e := a.Call(context.Background(), tool.Name, map[string]any{}); e == nil {
		t.Fatal("stale capability executed")
	}
	if count != 2 {
		t.Fatal("unexpected execution or retry")
	}
}
func TestOfficialSDKProtocol(t *testing.T) {
	ctx := context.Background()
	a := backend(nil)
	server := mcp.NewServer(&mcp.Implementation{Name: "kujo-native-contract-test", Version: "0.1.0"}, nil)
	if e := a.Register(ctx, server); e != nil {
		t.Fatal(e)
	}
	s, c := mcp.NewInMemoryTransports()
	session, e := server.Connect(ctx, s, nil)
	if e != nil {
		t.Fatal(e)
	}
	defer session.Close()
	client := mcp.NewClient(&mcp.Implementation{Name: "contract-test", Version: "1"}, nil)
	cs, e := client.Connect(ctx, c, nil)
	if e != nil {
		t.Fatal(e)
	}
	defer cs.Close()
	tools, e := cs.ListTools(ctx, nil)
	if e != nil || len(tools.Tools) != 2 {
		t.Fatal(e)
	}
	result, e := cs.CallTool(ctx, &mcp.CallToolParams{Name: fixtureTool().Name, Arguments: map[string]any{}})
	if e != nil || result.IsError || result.Meta["kujo/receiptUri"] == nil {
		t.Fatal(result, e)
	}
	if _, e = cs.CallTool(ctx, &mcp.CallToolParams{Name: "unknown", Arguments: map[string]any{}}); e == nil {
		t.Fatal("unknown tool accepted")
	}
}
func TestActualCanonicalThroughSDK(t *testing.T) {
	binary := os.Getenv("KUJO_NATIVE_TEST_BIN")
	if binary == "" {
		t.Skip("set KUJO_NATIVE_TEST_BIN for actual canonical runtime integration")
	}
	root, _ := filepath.Abs("../../..")
	b, e := provider.New(provider.Config{Kujo: binary, Entry: filepath.Join(root, "tests/provider.kujo"), CWD: root, Capabilities: []string{"--allow-clock"}})
	if e != nil {
		t.Fatal(e)
	}
	receipts := &memoryStore{}
	a, _ := New(b, receipts)
	ctx := context.Background()
	server := mcp.NewServer(&mcp.Implementation{Name: "kujo", Version: "0.1.0"}, nil)
	if e = a.Register(ctx, server); e != nil {
		t.Fatal(e)
	}
	s, c := mcp.NewInMemoryTransports()
	ss, e := server.Connect(ctx, s, nil)
	if e != nil {
		t.Fatal(e)
	}
	defer ss.Close()
	client := mcp.NewClient(&mcp.Implementation{Name: "contract", Version: "1"}, nil)
	cs, e := client.Connect(ctx, c, nil)
	if e != nil {
		t.Fatal(e)
	}
	defer cs.Close()
	tools, e := cs.ListTools(ctx, nil)
	if e != nil || len(tools.Tools) != 8 {
		t.Fatal(e)
	}
	rawCatalog, e := b.Request(ctx, map[string]any{"operation": "discover"})
	if e != nil {
		t.Fatal(e)
	}
	var direct struct {
		Tools []map[string]any `json:"tools"`
	}
	if e = json.Unmarshal(rawCatalog, &direct); e != nil {
		t.Fatal(e)
	}
	for _, wireTool := range tools.Tools {
		if wireTool.Name == "_kujo_receipt_evidence" {
			continue
		}
		var observed map[string]any
		json.Unmarshal(marshal(wireTool), &observed)
		matched := false
		for _, canonical := range direct.Tools {
			if canonical["name"] == observed["name"] {
				matched = true
				if !reflect.DeepEqual(canonical, observed) {
					t.Fatal("SDK changed canonical tool metadata")
				}
			}
		}
		if !matched {
			t.Fatal("SDK invented tool")
		}
	}
	for _, item := range []struct {
		id    string
		error bool
		input map[string]any
	}{{"read", false, map[string]any{"value": "native SDK"}}, {"read", true, map[string]any{}}, {"write", true, map[string]any{"value": "no approval"}}, {"failure", true, map[string]any{"value": "failed"}}} {
		r, e := cs.CallTool(ctx, &mcp.CallToolParams{Name: Name("kujo.fixture."+item.id, "1.0.0"), Arguments: item.input})
		if e != nil || r.IsError != item.error || r.Meta["kujo/receiptUri"] == nil {
			t.Fatalf("%s: %v %v", item.id, r, e)
		}
	}
	if len(receipts.records) != 4 {
		t.Fatal("canonical receipts lost")
	}
}

func TestCanonicalStdioAndDurableReceipt(t *testing.T) {
	binary := os.Getenv("KUJO_NATIVE_TEST_BIN")
	if binary == "" {
		t.Skip("requires installed Kujo 1.7")
	}
	root, _ := filepath.Abs("../../..")
	b, e := provider.New(provider.Config{Kujo: binary, Entry: filepath.Join(root, "tests/provider.kujo"), CWD: root, Capabilities: []string{"--allow-clock"}})
	if e != nil {
		t.Fatal(e)
	}
	directory := filepath.Join(t.TempDir(), "receipts")
	store, e := receipts.Open(directory)
	if e != nil {
		t.Fatal(e)
	}
	a, _ := New(b, store)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	server := mcp.NewServer(&mcp.Implementation{Name: "kujo", Version: "0.1.0"}, nil)
	if e = a.Register(ctx, server); e != nil {
		t.Fatal(e)
	}
	inR, inW, e := os.Pipe()
	if e != nil {
		t.Fatal(e)
	}
	outR, outW, e := os.Pipe()
	if e != nil {
		t.Fatal(e)
	}
	defer inR.Close()
	defer inW.Close()
	defer outR.Close()
	defer outW.Close()
	done := make(chan error, 1)
	go func() { done <- server.Run(ctx, &transport.Stdio{Reader: inR, Writer: outW}) }()
	client := mcp.NewClient(&mcp.Implementation{Name: "stdio-contract", Version: "1"}, nil)
	cs, e := client.Connect(ctx, &mcp.IOTransport{Reader: outR, Writer: inW}, nil)
	if e != nil {
		t.Fatal(e)
	}
	list, e := cs.ListTools(ctx, nil)
	if e != nil || len(list.Tools) != 8 {
		t.Fatal("stdio discovery failed", e)
	}
	result, e := cs.CallTool(ctx, &mcp.CallToolParams{Name: Name("kujo.fixture.read", "1.0.0"), Arguments: map[string]any{"value": "real stdio"}})
	if e != nil || result.IsError {
		t.Fatal(result, e)
	}
	uri, ok := result.Meta["kujo/receiptUri"].(string)
	if !ok {
		t.Fatal("receipt reference missing")
	}
	raw, e := store.Read(uri)
	if e != nil {
		t.Fatal(e)
	}
	var receipt map[string]any
	json.Unmarshal(raw, &receipt)
	if receipt["ability_id"] != "kujo.fixture.read" || receipt["result"].(map[string]any)["value"] != "real stdio" {
		t.Fatal("receipt/output mismatch")
	}
	cs.Close()
	select {
	case e = <-done:
		if e != nil {
			t.Fatal(e)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("stdio shutdown did not finish")
	}
	store.Close()
	again, e := receipts.Open(directory)
	if e != nil {
		t.Fatal(e)
	}
	defer again.Close()
	persisted, e := again.Read(uri)
	if e != nil || string(persisted) != string(raw) {
		t.Fatal("receipt did not survive restart", e)
	}
}

func TestContinuationCatalogFailsExplicitly(t *testing.T) {
	a, _ := New(backendFunc(func(context.Context, map[string]any) (json.RawMessage, error) {
		return marshal(map[string]any{"ok": true, "schema": "kujo.openai.catalog/v1", "tools": []any{}, "unsupported": []any{}, "capabilities": map[string]any{"resume": "invocation-v1"}}), nil
	}), &memoryStore{})
	_, e := a.Discover(context.Background())
	if e == nil || e.Error() != "native_continuation_unsupported" {
		t.Fatal("continuation guarantee silently downgraded", e)
	}
}
