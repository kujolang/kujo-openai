// Package adapter projects the canonical Kujo provider into the official MCP
// SDK. Definitions and execution policy remain in Ability, not in Go wrappers.
package adapter

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/jsonschema-go/jsonschema"
	"github.com/kujolang/kujo-openai/native/internal/provider"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type Backend interface {
	Request(context.Context, map[string]any) (json.RawMessage, error)
}
type Receipts interface {
	Put(json.RawMessage) (string, error)
	Read(string) (json.RawMessage, error)
	Recent() []string
}
type Adapter struct {
	backend       Backend
	receipts      Receipts
	continuations Receipts
}
type selected struct {
	tool   *mcp.Tool
	output *jsonschema.Resolved
}

func New(backend Backend, receipts Receipts) (*Adapter, error) {
	if backend == nil || receipts == nil {
		return nil, fail("adapter_dependencies_required", false)
	}
	return &Adapter{backend: backend, receipts: receipts}, nil
}
func fail(code string, uncertain bool) error {
	return &provider.BoundaryError{Code: code, Uncertain: uncertain}
}

var identity = regexp.MustCompile(`^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){2,}$`)
var version = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+$`)
var digest = regexp.MustCompile(`^[a-f0-9]{64}$`)

func Name(id, v string) string {
	prefix := strings.ReplaceAll(id, ".", "_")
	if len(prefix) > 26 {
		prefix = prefix[:26]
	}
	sum := sha256.Sum256([]byte(id + "@" + v))
	return prefix + "_" + hex.EncodeToString(sum[:])[:32]
}
func compile(value any) (*jsonschema.Resolved, error) {
	raw, e := json.Marshal(value)
	if e != nil {
		return nil, e
	}
	var schema jsonschema.Schema
	if e = json.Unmarshal(raw, &schema); e != nil {
		return nil, e
	}
	if schema.Type != "object" {
		return nil, errors.New("object_schema_required")
	}
	return schema.Resolve(nil) // No remote loader: schema references cannot fetch URLs.
}
func (a *Adapter) discover(ctx context.Context) (map[string]selected, []*mcp.Tool, bool, error) {
	raw, err := a.backend.Request(ctx, map[string]any{"operation": "discover"})
	if err != nil {
		return nil, nil, false, err
	}
	var catalog struct {
		OK           bool              `json:"ok"`
		Schema       string            `json:"schema"`
		Tools        []*mcp.Tool       `json:"tools"`
		Unsupported  []json.RawMessage `json:"unsupported"`
		Capabilities map[string]any    `json:"capabilities"`
	}
	if json.Unmarshal(raw, &catalog) != nil || !catalog.OK || catalog.Schema != "kujo.openai.catalog/v1" || catalog.Tools == nil || catalog.Unsupported == nil || len(catalog.Tools) > 256 {
		return nil, nil, false, fail("invalid_catalog", false)
	}
	resume := catalog.Capabilities["resume"] == "invocation-v1" && a.continuations != nil
	if catalog.Capabilities["resume"] != nil && !resume {
		return nil, nil, false, fail("native_continuation_unsupported", false)
	}
	next := map[string]selected{}
	for _, tool := range catalog.Tools {
		if tool == nil {
			return nil, nil, false, fail("invalid_catalog_identity", false)
		}
		id, _ := tool.Meta["kujo/abilityId"].(string)
		v, _ := tool.Meta["kujo/abilityVersion"].(string)
		d, _ := tool.Meta["kujo/definitionDigest"].(string)
		if !identity.MatchString(id) || !version.MatchString(v) || !digest.MatchString(d) || tool.Name != Name(id, v) {
			return nil, nil, false, fail("invalid_catalog_identity", false)
		}
		if _, exists := next[tool.Name]; exists {
			return nil, nil, false, fail("invalid_catalog_identity", false)
		}
		if _, err = compile(tool.InputSchema); err != nil {
			return nil, nil, false, fail("unsupported_host_schema", false)
		}
		output, err := compile(tool.OutputSchema)
		if err != nil {
			return nil, nil, false, fail("unsupported_host_schema", false)
		}
		next[tool.Name] = selected{tool, output}
	}
	return next, catalog.Tools, resume, nil
}
func (a *Adapter) Discover(ctx context.Context) ([]*mcp.Tool, error) {
	_, tools, _, e := a.discover(ctx)
	return tools, e
}
func invocationID() string {
	var id [16]byte
	if _, e := rand.Read(id[:]); e != nil {
		panic(e)
	}
	id[6] = (id[6] & 15) | 64
	id[8] = (id[8] & 63) | 128
	return fmt.Sprintf("%x-%x-%x-%x-%x", id[:4], id[4:6], id[6:8], id[8:10], id[10:])
}
func (a *Adapter) Call(ctx context.Context, name string, input map[string]any) (*mcp.CallToolResult, error) {
	if input == nil {
		return nil, fail("invalid_arguments", false)
	}
	catalog, _, resume, err := a.discover(ctx)
	if err != nil {
		return nil, err
	}
	tool, found := catalog[name]
	if !found {
		return nil, fail("ability_tool_not_available", false)
	}
	id := invocationID()
	reference := ""
	if resume {
		saved, _ := json.Marshal(continuation{Schema: "kujo.openai.continuation/v1", Name: name, InvocationID: id, Meta: mcp.Meta{"kujo/abilityId": tool.tool.Meta["kujo/abilityId"], "kujo/abilityVersion": tool.tool.Meta["kujo/abilityVersion"], "kujo/definitionDigest": tool.tool.Meta["kujo/definitionDigest"]}})
		uri, e := a.continuations.Put(saved)
		if e != nil {
			return nil, fail("continuation_persistence_failed", false)
		}
		reference = strings.Replace(uri, "kujo-receipt:", "kujo-continuation:", 1)
	}
	return a.execute(ctx, tool, map[string]any{"operation": "invoke", "name": name, "input": input, "invocation_id": id}, reference)
}
func (a *Adapter) execute(ctx context.Context, tool selected, request map[string]any, reference string) (result *mcp.CallToolResult, err error) {
	defer func() {
		if err != nil && reference != "" {
			err = &continuationError{err, reference}
		}
	}()
	id := request["invocation_id"]
	raw, err := a.backend.Request(ctx, request)
	if err != nil {
		return nil, err
	}

	var response struct {
		OK      *bool           `json:"ok"`
		Receipt json.RawMessage `json:"receipt"`
	}
	if json.Unmarshal(raw, &response) != nil || response.OK == nil || len(response.Receipt) == 0 || string(response.Receipt) == "null" {
		return nil, fail("invalid_execution_response", true)
	}
	var receipt struct {
		Schema    string `json:"schema"`
		ID        string `json:"invocation_id"`
		Ability   string `json:"ability_id"`
		Version   string `json:"ability_version"`
		Digest    string `json:"definition_digest"`
		Surface   string `json:"surface"`
		Status    string `json:"status"`
		ReceiptID string `json:"receipt_id"`
		Started   *int64 `json:"started_at_ms"`
		Completed *int64 `json:"completed_at_ms"`
		Result    any    `json:"result"`
		Error     any    `json:"error"`
	}
	if json.Unmarshal(response.Receipt, &receipt) != nil {
		return nil, fail("receipt_identity_invalid", true)
	}
	m := tool.tool.Meta
	statuses := map[string]bool{"succeeded": true, "failed": true, "rejected": true, "approval_required": true, "in_progress": true, "cancelled": true, "timed_out": true}
	if receipt.Schema != "kujo.ability.receipt/v1" || receipt.ID != id || receipt.Ability != m["kujo/abilityId"] || receipt.Version != m["kujo/abilityVersion"] || receipt.Digest != m["kujo/definitionDigest"] || receipt.Surface != "mcp" || !statuses[receipt.Status] || receipt.ReceiptID == "" || receipt.Started == nil || receipt.Completed == nil || *receipt.Completed < *receipt.Started {
		return nil, fail("receipt_identity_invalid", true)
	}
	success := receipt.Status == "succeeded"
	if *response.OK != success || (success && tool.output.Validate(receipt.Result) != nil) {
		return nil, fail("receipt_result_invalid", true)
	}
	uri, err := a.receipts.Put(response.Receipt)
	if err != nil {
		return nil, fail("receipt_persistence_failed", true)
	}
	summary := map[string]any{"ok": success, "status": receipt.Status, "ability_id": receipt.Ability, "receipt_id": receipt.ReceiptID, "receipt_uri": uri}
	if receipt.Error != nil {
		summary["error"] = receipt.Error
	}
	text, _ := json.Marshal(summary)
	result = &mcp.CallToolResult{IsError: !success, Content: []mcp.Content{&mcp.TextContent{Text: string(text)}}, Meta: mcp.Meta{"kujo/receiptUri": uri, "kujo/invocationId": id}}
	if success {
		result.StructuredContent = receipt.Result
		body, _ := json.Marshal(receipt.Result)
		result.Content = append(result.Content, &mcp.TextContent{Text: string(body)})
	}
	if reference != "" {
		result.Meta["kujo/continuationUri"] = reference
		summary["continuation_uri"] = reference
		text, _ = json.Marshal(summary)
		result.Content[0] = &mcp.TextContent{Text: string(text)}
	}
	return result, nil
}
func Failure(err error) *mcp.CallToolResult {
	status, code := "completion_uncertain", "internal_failure"
	var boundary *provider.BoundaryError
	if errors.As(err, &boundary) {
		code = boundary.Code
		if !boundary.Uncertain {
			status = "not_executed"
		}
	}
	summary := map[string]any{"ok": false, "status": status, "code": code}
	meta := mcp.Meta{}
	var continuation *continuationError
	if errors.As(err, &continuation) {
		summary["continuation_uri"] = continuation.reference
		meta["kujo/continuationUri"] = continuation.reference
	}
	body, _ := json.Marshal(summary)
	return &mcp.CallToolResult{IsError: true, Content: []mcp.Content{&mcp.TextContent{Text: string(body)}}, Meta: meta}

}

// Register snapshots discovery for the SDK's tool list; every call rechecks the
// canonical catalog so a stale host list cannot bypass revocation.
func (a *Adapter) Register(ctx context.Context, server *mcp.Server) error {
	_, tools, resume, err := a.discover(ctx)
	if err != nil {
		return err
	}
	for _, tool := range tools {
		name := tool.Name
		server.AddTool(tool, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			var input map[string]any
			if json.Unmarshal(req.Params.Arguments, &input) != nil || input == nil {
				return Failure(fail("invalid_arguments", false)), nil
			}
			result, err := a.Call(ctx, name, input)
			if err != nil {
				return Failure(err), nil
			}
			return result, nil
		})
	}
	if resume {
		a.registerResume(server)
	}
	a.registerEvidence(server)
	return nil
}
