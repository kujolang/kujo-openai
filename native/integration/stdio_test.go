package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestNativeExecutableWithoutNodeOrGit(t *testing.T) {
	host := os.Getenv("KUJO_NATIVE_HOST_BIN")
	runtime := os.Getenv("KUJO_NATIVE_TEST_BIN")
	if host == "" || runtime == "" {
		t.Skip("requires built native host and installed Kujo via KUJO_NATIVE_HOST_BIN/KUJO_NATIVE_TEST_BIN")
	}
	home, e := os.UserHomeDir()
	if e != nil {
		t.Fatal(e)
	}
	trusted, e := os.MkdirTemp(home, ".kujo-native-acceptance-")
	if e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(trusted)
	runtimeCopy := filepath.Join(trusted, "kujo")
	source, e := os.Open(runtime)
	if e != nil {
		t.Fatal(e)
	}
	dest, e := os.OpenFile(runtimeCopy, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0700)
	if e != nil {
		t.Fatal(e)
	}
	_, e = io.Copy(dest, source)
	source.Close()
	dest.Close()
	if e != nil {
		t.Fatal(e)
	}
	state := filepath.Join(trusted, "receipts")
	if e = os.Mkdir(state, 0700); e != nil {
		t.Fatal(e)
	}
	root, _ := filepath.Abs("../..")
	project := t.TempDir()
	config := map[string]any{"schema": "kujo.openai.local/v1", "kujo": runtimeCopy, "entry": filepath.Join(root, "tests/provider.kujo"), "cwd": root, "stateDirectory": state, "capabilities": []string{"--allow-clock"}}
	raw, _ := json.Marshal(config)
	configPath := filepath.Join(trusted, "operator.json")
	if e = os.WriteFile(configPath, raw, 0600); e != nil {
		t.Fatal(e)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	start := func() (*mcp.ClientSession, *bytes.Buffer) {
		cmd := exec.Command(host, "--serve-config", configPath, "--project", project)
		cmd.Dir = string(os.PathSeparator) // GUI-like CWD; only explicit project selection controls exclusion.
		cmd.Env = []string{"HOME=" + home, "PATH="}
		stderr := &bytes.Buffer{}
		cmd.Stderr = stderr
		client := mcp.NewClient(&mcp.Implementation{Name: "native-acceptance", Version: "1"}, nil)
		session, e := client.Connect(ctx, &mcp.CommandTransport{Command: cmd}, nil)
		if e != nil {
			t.Fatalf("native connect failed: %v; %s", e, stderr.String())
		}
		return session, stderr
	}
	session, stderr := start()
	tools, e := session.ListTools(ctx, nil)
	if e != nil || len(tools.Tools) != 8 {
		t.Fatal("discovery failed", e)
	}
	name := ""
	for _, tool := range tools.Tools {
		if tool.Meta["kujo/abilityId"] == "kujo.fixture.read" {
			name = tool.Name
		}
	}
	if name == "" {
		t.Fatal("canonical read not discovered")
	}
	result, e := session.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: map[string]any{"value": "native acceptance"}})
	if e != nil || result.IsError {
		t.Fatal("native call failed", e)
	}
	uri, ok := result.Meta["kujo/receiptUri"].(string)
	if !ok {
		t.Fatal("receipt missing")
	}
	evidence, e := session.CallTool(ctx, &mcp.CallToolParams{Name: "_kujo_receipt_evidence", Arguments: map[string]any{"receipt_uri": uri}})
	if e != nil || evidence.IsError {
		t.Fatal("receipt tool failed", e)
	}
	receipt := evidence.StructuredContent.(map[string]any)
	if receipt["ability_id"] != "kujo.fixture.read" || receipt["result"].(map[string]any)["value"] != "native acceptance" {
		t.Fatal("canonical receipt mismatch")
	}
	resource, e := session.ReadResource(ctx, &mcp.ReadResourceParams{URI: uri})
	if e != nil || len(resource.Contents) != 1 {
		t.Fatal("receipt resource failed", e)
	}
	if e = session.Close(); e != nil {
		t.Fatal(e)
	}
	if stderr.Len() != 0 {
		t.Fatalf("unexpected startup diagnostics: %s", stderr.String())
	}
	restarted, stderr := start()
	defer restarted.Close()
	evidence, e = restarted.CallTool(ctx, &mcp.CallToolParams{Name: "_kujo_receipt_evidence", Arguments: map[string]any{"receipt_uri": uri}})
	if e != nil || evidence.IsError {
		t.Fatal("receipt lost on executable restart", e)
	}
	if e = restarted.Close(); e != nil {
		t.Fatal(e)
	}
	if stderr.Len() != 0 {
		t.Fatal("unexpected restart diagnostics")
	}
}
