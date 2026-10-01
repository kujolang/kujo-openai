package adapter

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kujolang/kujo-openai/native/internal/provider"
	"github.com/kujolang/kujo-openai/native/internal/receipts"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestCanonicalContinuationApprovalAndRestart(t *testing.T) {
	binary := os.Getenv("KUJO_NATIVE_TEST_BIN")
	if binary == "" {
		t.Skip("requires installed Kujo 1.7")
	}
	root, _ := filepath.Abs("../../..")
	directory := t.TempDir()
	entry := filepath.Join(root, "tests/continuation-provider.kujo")
	modules := []string{root, filepath.Join(root, "vendor/ability")}
	operator := func(mode, id string) {
		t.Helper()
		command := exec.Command(binary, "run", entry)
		command.Dir = directory
		command.Env = []string{"KUJO_MODULE_PATH=" + strings.Join(modules, string(os.PathListSeparator)), "CONTINUATION_MODE=" + mode, "CONTINUATION_ID=" + id}
		if raw, e := command.CombinedOutput(); e != nil {
			t.Fatalf("operator failed: %v %s", e, raw)
		}
	}
	operator("init", "")
	b, e := provider.New(provider.Config{Kujo: binary, Entry: entry, CWD: directory, ModulePaths: modules, Capabilities: []string{"--allow-database", "--allow-fs-read", "--allow-clock", "--allow-env-read"}})
	if e != nil {
		t.Fatal(e)
	}
	store, e := receipts.Open(filepath.Join(directory, "receipts"))
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	refPath := filepath.Join(directory, "references")
	refs, e := receipts.Open(refPath)
	if e != nil {
		t.Fatal(e)
	}
	a, e := NewWithContinuations(b, store, refs)
	if e != nil {
		t.Fatal(e)
	}
	ctx := context.Background()
	tools, e := a.Discover(ctx)
	if e != nil || len(tools) != 1 {
		t.Fatal(e)
	}
	pending, e := a.Call(ctx, tools[0].Name, map[string]any{"value": "input-canary"})
	if e != nil || !pending.IsError {
		t.Fatal(pending, e)
	}
	reference := pending.Meta["kujo/continuationUri"].(string)
	id := pending.Meta["kujo/invocationId"].(string)
	denied, e := a.Resume(ctx, reference)
	if e != nil || !denied.IsError || !strings.Contains(string(marshal(denied)), "approval_required") {
		t.Fatal(denied, e)
	}
	files, _ := os.ReadDir(refPath)
	for _, file := range files {
		raw, _ := os.ReadFile(filepath.Join(refPath, file.Name()))
		if strings.Contains(string(raw), "input-canary") {
			t.Fatal("input persisted in reference")
		}
	}
	operator("grant", id)
	refs.Close()
	refs, e = receipts.Open(refPath)
	if e != nil {
		t.Fatal(e)
	}
	defer refs.Close()
	a, _ = NewWithContinuations(b, store, refs)
	done, e := a.Resume(ctx, reference)
	if e != nil || done.IsError {
		t.Fatal(done, e)
	}
	replay, e := a.Resume(ctx, reference)
	if e != nil || replay.IsError || replay.Meta["kujo/receiptUri"] != done.Meta["kujo/receiptUri"] {
		t.Fatal("canonical replay changed", replay, e)
	}
	for _, invalid := range []string{"../../outside", "kujo-continuation://sha256/" + strings.Repeat("0", 64)} {
		if _, e := a.Resume(ctx, invalid); e == nil {
			t.Fatal("forged reference accepted")
		}
	}
	server := mcp.NewServer(&mcp.Implementation{Name: "continuation-test", Version: "1"}, nil)
	if e := a.Register(ctx, server); e != nil {
		t.Fatal(e)
	}
	st, ct := mcp.NewInMemoryTransports()
	ss, e := server.Connect(ctx, st, nil)
	if e != nil {
		t.Fatal(e)
	}
	defer ss.Close()
	client := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil)
	cs, e := client.Connect(ctx, ct, nil)
	if e != nil {
		t.Fatal(e)
	}
	defer cs.Close()
	listed, e := cs.ListTools(ctx, nil)
	if e != nil || len(listed.Tools) != 3 {
		t.Fatal("resume discovery", e)
	}
	resumed, e := cs.CallTool(ctx, &mcp.CallToolParams{Name: "_kujo_resume_invocation", Arguments: map[string]any{"reference": reference}})
	if e != nil || resumed.IsError || resumed.Meta["kujo/receiptUri"] != done.Meta["kujo/receiptUri"] {
		t.Fatal("MCP resume", resumed, e)
	}
	forged, e := cs.CallTool(ctx, &mcp.CallToolParams{Name: "_kujo_resume_invocation", Arguments: map[string]any{"reference": reference, "approval": true}})
	if e == nil && !forged.IsError {
		t.Fatal("host approval accepted")
	}
	changed := backendFunc(func(ctx context.Context, request map[string]any) (json.RawMessage, error) {
		if request["operation"] != "discover" {
			t.Fatal("changed contract executed")
		}
		raw, e := b.Request(ctx, request)
		var value map[string]any
		json.Unmarshal(raw, &value)
		value["tools"].([]any)[0].(map[string]any)["_meta"].(map[string]any)["kujo/definitionDigest"] = strings.Repeat("0", 64)
		return marshal(value), e
	})
	a, _ = NewWithContinuations(changed, store, refs)
	if _, e := a.Resume(ctx, reference); e == nil || e.Error() != "continuation_contract_changed" {
		t.Fatal(e)
	}
}

func TestContinuationPersistBeforeInvokeAndUncertainty(t *testing.T) {
	ctx := context.Background()
	for _, deny := range []bool{true, false} {
		t.Run(map[bool]string{true: "storage_failure", false: "uncertain_execution"}[deny], func(t *testing.T) {
			refs, e := receipts.Open(filepath.Join(t.TempDir(), "refs"))
			if e != nil {
				t.Fatal(e)
			}
			defer refs.Close()
			executions := 0
			b := backendFunc(func(_ context.Context, request map[string]any) (json.RawMessage, error) {
				if request["operation"] == "discover" {
					return marshal(map[string]any{"ok": true, "schema": "kujo.openai.catalog/v1", "tools": []any{fixtureTool()}, "unsupported": []any{}, "capabilities": map[string]any{"resume": "invocation-v1"}}), nil
				}
				executions++
				if len(refs.Recent()) != 1 {
					t.Fatal("invoked before durable reference")
				}
				return nil, fail("provider_timed_out", true)
			})
			var references Receipts = refs
			if deny {
				references = &memoryStore{deny: true}
			}
			a, _ := NewWithContinuations(b, &memoryStore{}, references)
			_, e = a.Call(ctx, fixtureTool().Name, map[string]any{})
			if e == nil {
				t.Fatal("failure hidden")
			}
			result := Failure(e)
			if deny {
				if executions != 0 || result.Meta["kujo/continuationUri"] != nil {
					t.Fatal("executed without durable reference")
				}
			} else {
				if executions != 1 || result.Meta["kujo/continuationUri"] == nil || !strings.Contains(string(marshal(result)), "completion_uncertain") {
					t.Fatal("uncertainty/reference lost")
				}
			}
		})
	}
}
