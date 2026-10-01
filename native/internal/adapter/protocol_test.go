package adapter

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/kujolang/kujo-openai/native/internal/provider"
	"github.com/kujolang/kujo-openai/native/internal/receipts"
	"github.com/kujolang/kujo-openai/native/internal/transport"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Real canonical invocations over the legacy wire handshake, independently of
// the SDK client's 2026-07-28 default covered by the executable acceptance tests.
func TestCanonicalLegacyProtocolCompatibility(t *testing.T) {
	binary := os.Getenv("KUJO_NATIVE_TEST_BIN")
	if binary == "" {
		t.Skip("requires installed Kujo 1.7")
	}
	root, err := filepath.Abs("../../..")
	if err != nil {
		t.Fatal(err)
	}
	for _, version := range []string{"2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25", "2020-01-01"} {
		t.Run(version, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			b, err := provider.New(provider.Config{Kujo: binary, Entry: filepath.Join(root, "tests/provider.kujo"), CWD: root, Capabilities: []string{"--allow-clock"}})
			if err != nil {
				t.Fatal(err)
			}
			store, err := receipts.Open(filepath.Join(t.TempDir(), "receipts"))
			if err != nil {
				t.Fatal(err)
			}
			defer store.Close()
			a, err := New(b, store)
			if err != nil {
				t.Fatal(err)
			}
			server := mcp.NewServer(&mcp.Implementation{Name: "kujo-compatibility", Version: "1"}, nil)
			if err := a.Register(ctx, server); err != nil {
				t.Fatal(err)
			}
			inR, inW := io.Pipe()
			outR, outW := io.Pipe()
			defer inR.Close()
			defer inW.Close()
			defer outR.Close()
			defer outW.Close()
			done := make(chan error, 1)
			go func() { done <- server.Run(ctx, &transport.Stdio{Reader: inR, Writer: outW}) }()
			stop := context.AfterFunc(ctx, func() { inR.Close(); inW.Close(); outR.Close(); outW.Close() })
			defer stop()
			encoder, decoder := json.NewEncoder(inW), json.NewDecoder(outR)
			request := func(id int, method string, params any) map[string]any {
				t.Helper()
				if err := encoder.Encode(map[string]any{"jsonrpc": "2.0", "id": id, "method": method, "params": params}); err != nil {
					t.Fatal(err)
				}
				var reply map[string]any
				for {
					if err := decoder.Decode(&reply); err != nil {
						t.Fatal(err)
					}
					if reply["id"] != nil {
						break
					}
				}
				if reply["id"] != float64(id) || reply["error"] != nil {
					t.Fatalf("unexpected RPC response: %v", reply)
				}
				result, ok := reply["result"].(map[string]any)
				if !ok {
					t.Fatalf("missing result: %v", reply)
				}
				return result
			}
			initialized := request(1, "initialize", map[string]any{"protocolVersion": version, "capabilities": map[string]any{}, "clientInfo": map[string]any{"name": "legacy-wire-client", "version": "1"}})
			expected := version
			if version == "2020-01-01" {
				expected = "2025-11-25"
			} // Pinned SDK's legacy fallback.
			if initialized["protocolVersion"] != expected {
				t.Fatalf("negotiated %v, want %s", initialized["protocolVersion"], expected)
			}
			if err := encoder.Encode(map[string]any{"jsonrpc": "2.0", "method": "notifications/initialized"}); err != nil {
				t.Fatal(err)
			}
			listing := request(2, "tools/list", map[string]any{})
			tools, ok := listing["tools"].([]any)
			if !ok || len(tools) != 8 {
				t.Fatalf("catalog changed: %v", listing)
			}
			name := Name("kujo.fixture.read", "1.0.0")
			found := false
			for _, raw := range tools {
				if raw.(map[string]any)["name"] == name {
					found = true
				}
			}
			if !found {
				t.Fatal("canonical tool missing")
			}
			result := request(3, "tools/call", map[string]any{"name": name, "arguments": map[string]any{"value": "legacy wire"}})
			if result["isError"] == true {
				t.Fatalf("canonical call failed: %v", result)
			}
			meta, ok := result["_meta"].(map[string]any)
			if !ok {
				t.Fatal("missing receipt metadata")
			}
			uri, ok := meta["kujo/receiptUri"].(string)
			if !ok || uri == "" {
				t.Fatal("missing receipt URI")
			}
			receipt, err := store.Read(uri)
			if err != nil {
				t.Fatal(err)
			}
			var canonical map[string]any
			if err := json.Unmarshal(receipt, &canonical); err != nil {
				t.Fatal(err)
			}
			if canonical["ability_id"] != "kujo.fixture.read" || canonical["status"] != "succeeded" || canonical["result"].(map[string]any)["value"] != "legacy wire" {
				t.Fatalf("receipt contract changed: %v", canonical)
			}
			evidence := request(4, "tools/call", map[string]any{"name": "_kujo_receipt_evidence", "arguments": map[string]any{"receipt_uri": uri}})
			if !reflect.DeepEqual(evidence["structuredContent"], canonical) {
				t.Fatal("retrieved receipt changed across protocol boundary")
			}
			if evidence["isError"] == true {
				t.Fatal("receipt retrieval failed")
			}
			inW.Close()
			select {
			case err := <-done:
				if err != nil {
					t.Fatal(err)
				}
			case <-ctx.Done():
				t.Fatal("server did not terminate on EOF")
			}
		})
	}
}
