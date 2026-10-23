package adapter

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func (a *Adapter) registerEvidence(server *mcp.Server) {
	no := false
	server.AddTool(&mcp.Tool{Name: "_kujo_receipt_evidence", Description: "Read a returned canonical Kujo receipt reference, or list up to 32 recent references in this store instance. Not a chat-specific or exhaustive history. Never rerun an Ability solely to recover evidence.", InputSchema: map[string]any{"type": "object", "properties": map[string]any{"receipt_uri": map[string]any{"type": "string"}}, "additionalProperties": false}, OutputSchema: map[string]any{"type": "object"}, Annotations: &mcp.ToolAnnotations{ReadOnlyHint: true, DestructiveHint: &no, OpenWorldHint: &no, IdempotentHint: true}}, func(_ context.Context, request *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		var input map[string]any
		if json.Unmarshal(request.Params.Arguments, &input) != nil || input == nil || len(input) > 1 {
			return Failure(fail("invalid_arguments", false)), nil
		}
		var result map[string]any
		if value, present := input["receipt_uri"]; present {
			uri, ok := value.(string)
			if !ok {
				return Failure(fail("invalid_receipt_reference", false)), nil
			}
			raw, e := a.receipts.Read(uri)
			if e != nil {
				return Failure(e), nil
			}
			if json.Unmarshal(raw, &result) != nil {
				return Failure(fail("receipt_integrity_failed", false)), nil
			}
		} else {
			if len(input) != 0 {
				return Failure(fail("invalid_arguments", false)), nil
			}
			result = map[string]any{"receipt_uris": a.receipts.Recent(), "scope": "store_instance"}
		}
		raw, _ := json.Marshal(result)
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: string(raw)}}, StructuredContent: result}, nil
	})
	server.AddResourceTemplate(&mcp.ResourceTemplate{URITemplate: "kujo-receipt://sha256/{digest}", Name: "Kujo execution receipt", MIMEType: "application/json"}, func(_ context.Context, request *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
		raw, e := a.receipts.Read(request.Params.URI)
		if e != nil {
			return nil, errors.New("receipt_unavailable")
		}
		return &mcp.ReadResourceResult{Contents: []*mcp.ResourceContents{{URI: request.Params.URI, MIMEType: "application/json", Text: string(raw)}}}, nil
	})
}
