package adapter

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// NewWithContinuations requires a separate private durable store. References
// carry identity, never approval, original inputs, or replay authority.
func NewWithContinuations(backend Backend, receipts, continuations Receipts) (*Adapter, error) {
	a, err := New(backend, receipts)
	if err != nil {
		return nil, err
	}
	if continuations == nil {
		return nil, fail("adapter_dependencies_required", false)
	}
	a.continuations = continuations
	return a, nil
}

type continuation struct {
	Schema       string   `json:"schema"`
	Name         string   `json:"name"`
	InvocationID string   `json:"invocationId"`
	Meta         mcp.Meta `json:"meta"`
}
type continuationError struct {
	cause     error
	reference string
}

func (e *continuationError) Error() string { return e.cause.Error() }
func (e *continuationError) Unwrap() error { return e.cause }

var continuationURI = regexp.MustCompile(`^kujo-continuation://sha256/[a-f0-9]{64}$`)
var uuid = regexp.MustCompile(`^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$`)

func (a *Adapter) Resume(ctx context.Context, reference string) (*mcp.CallToolResult, error) {
	catalog, _, supported, err := a.discover(ctx)
	if err != nil {
		return nil, err
	}
	if !supported {
		return nil, fail("continuation_unsupported", false)
	}
	if !continuationURI.MatchString(reference) {
		return nil, fail("continuation_unavailable", false)
	}
	raw, err := a.continuations.Read(strings.Replace(reference, "kujo-continuation:", "kujo-receipt:", 1))
	var saved continuation
	if err != nil || json.Unmarshal(raw, &saved) != nil || saved.Schema != "kujo.openai.continuation/v1" || !uuid.MatchString(saved.InvocationID) {
		return nil, fail("continuation_unavailable", false)
	}
	tool, found := catalog[saved.Name]
	if !found {
		return nil, fail("continuation_contract_changed", false)
	}
	for _, key := range []string{"kujo/abilityId", "kujo/abilityVersion", "kujo/definitionDigest"} {
		expected, _ := tool.tool.Meta[key].(string)
		actual, ok := saved.Meta[key].(string)
		if !ok || actual != expected {
			return nil, fail("continuation_contract_changed", false)
		}
	}
	return a.execute(ctx, tool, map[string]any{"operation": "resume", "invocation_id": saved.InvocationID}, reference)
}
func (a *Adapter) registerResume(server *mcp.Server) {
	yes := true
	server.AddTool(&mcp.Tool{Name: "_kujo_resume_invocation", Title: "Resume a pending Kujo invocation", Description: "Ask the application to resume or reconcile a saved invocation. This does not approve execution. The application independently enforces original identity, input, policy, approval and retry semantics.", InputSchema: map[string]any{"type": "object", "required": []string{"reference"}, "properties": map[string]any{"reference": map[string]any{"type": "string", "pattern": continuationURI.String()}}, "additionalProperties": false}, Annotations: &mcp.ToolAnnotations{DestructiveHint: &yes, OpenWorldHint: &yes}}, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		var input map[string]any
		if json.Unmarshal(req.Params.Arguments, &input) != nil || len(input) != 1 {
			return Failure(fail("invalid_arguments", false)), nil
		}
		reference, ok := input["reference"].(string)
		if !ok {
			return Failure(fail("invalid_arguments", false)), nil
		}
		result, err := a.Resume(ctx, reference)
		if err != nil {
			return Failure(err), nil
		}
		return result, nil
	})
}
