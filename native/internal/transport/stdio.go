// Package transport bounds MCP stdio framing and in-flight client requests.
package transport

import (
	"bufio"
	"context"
	"errors"
	"io"
	"sync"

	"github.com/modelcontextprotocol/go-sdk/jsonrpc"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const InputLimit = 1024 * 1024
const OutputLimit = 4 * 1024 * 1024
const PendingLimit = 32

type Stdio struct {
	Reader io.ReadCloser
	Writer io.WriteCloser
}

func (s *Stdio) Connect(context.Context) (mcp.Connection, error) {
	if s.Reader == nil || s.Writer == nil {
		return nil, errors.New("stdio_required")
	}
	scan := bufio.NewScanner(s.Reader)
	scan.Buffer(make([]byte, 4096), InputLimit+1)
	return &connection{reader: s.Reader, writer: s.Writer, scan: scan, pending: map[jsonrpc.ID]bool{}}, nil
}

type connection struct {
	reader      io.ReadCloser
	writer      io.WriteCloser
	scan        *bufio.Scanner
	mu          sync.Mutex
	writeMu     sync.Mutex
	closeOnce   sync.Once
	pending     map[jsonrpc.ID]bool
	initialized bool
}

func (c *connection) SessionID() string { return "" }
func (c *connection) Close() error {
	var err error
	c.closeOnce.Do(func() { err = errors.Join(c.reader.Close(), c.writer.Close()) })
	return err
}
func (c *connection) Read(ctx context.Context) (jsonrpc.Message, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	if !c.scan.Scan() {
		if c.scan.Err() != nil {
			return nil, errors.New("invalid_or_oversized_mcp_frame")
		}
		return nil, io.EOF
	}
	raw := c.scan.Bytes()
	if len(raw) > InputLimit {
		return nil, errors.New("oversized_mcp_frame")
	}
	message, err := jsonrpc.DecodeMessage(raw)
	if err != nil {
		return nil, errors.New("invalid_mcp_frame")
	}
	request, ok := message.(*jsonrpc.Request)
	if !ok {
		return message, nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if !request.IsCall() {
		switch request.Method {
		case "notifications/initialized", "notifications/cancelled", "notifications/progress", "notifications/roots/list_changed":
			return message, nil
		default:
			return nil, errors.New("unsupported_mcp_notification")
		}
	}
	if c.pending[request.ID] || len(c.pending) >= PendingLimit {
		return nil, errors.New("mcp_request_limit_or_duplicate")
	}
	if request.Method == "initialize" {
		if c.initialized {
			return nil, errors.New("duplicate_initialize")
		}
		c.initialized = true
	}
	c.pending[request.ID] = true
	return message, nil
}
func (c *connection) Write(ctx context.Context, message jsonrpc.Message) error {
	if ctx.Err() != nil {
		return ctx.Err()
	}
	raw, err := jsonrpc.EncodeMessage(message)
	if err != nil || len(raw) > OutputLimit {
		return errors.New("invalid_or_oversized_mcp_output")
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	raw = append(raw, '\n')
	n, err := c.writer.Write(raw)
	if err != nil {
		return err
	}
	if n != len(raw) {
		return io.ErrShortWrite
	}
	if response, ok := message.(*jsonrpc.Response); ok {
		c.mu.Lock()
		delete(c.pending, response.ID)
		c.mu.Unlock()
	}
	return nil
}
