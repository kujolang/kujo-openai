package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/jsonrpc"
)

type writer struct{ bytes.Buffer }

func (*writer) Close() error { return nil }
func connectionFor(t *testing.T, input string) (*connection, *writer) {
	t.Helper()
	out := &writer{}
	c, e := (&Stdio{Reader: io.NopCloser(strings.NewReader(input)), Writer: out}).Connect(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	return c.(*connection), out
}
func TestFramesAndRequestBudget(t *testing.T) {
	input := ""
	for i := 0; i < 33; i++ {
		input += fmt.Sprintf("{\"jsonrpc\":\"2.0\",\"id\":%d,\"method\":\"tools/list\"}\n", i)
	}
	c, _ := connectionFor(t, input)
	for i := 0; i < 32; i++ {
		if _, e := c.Read(context.Background()); e != nil {
			t.Fatal(e)
		}
	}
	if _, e := c.Read(context.Background()); e == nil {
		t.Fatal("unbounded pending calls")
	}
}
func TestResponseReleasesCapacity(t *testing.T) {
	c, out := connectionFor(t, "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}\n")
	m, e := c.Read(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	response := &jsonrpc.Response{ID: m.(*jsonrpc.Request).ID, Result: json.RawMessage(`{}`)}
	if e = c.Write(context.Background(), response); e != nil {
		t.Fatal(e)
	}
	if len(c.pending) != 0 || !strings.HasSuffix(out.String(), "\n") {
		t.Fatal("response not framed or released")
	}
}
func TestMaliciousFrames(t *testing.T) {
	for _, input := range []string{"{bad}\n", strings.Repeat("x", InputLimit+2), "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{}}\n"} {
		c, _ := connectionFor(t, input)
		if _, e := c.Read(context.Background()); e == nil {
			t.Fatal("unsafe frame accepted")
		}
	}
	for _, method := range []string{"initialize", "tools/list"} {
		input := fmt.Sprintf("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":%q}\n", method)
		c, _ := connectionFor(t, input+input)
		if _, e := c.Read(context.Background()); e != nil {
			t.Fatal(e)
		}
		if _, e := c.Read(context.Background()); e == nil {
			t.Fatal("duplicate accepted")
		}
	}
}
func TestOversizedOutput(t *testing.T) {
	c, _ := connectionFor(t, "")
	id, _ := jsonrpc.MakeID(1)
	raw, _ := json.Marshal(strings.Repeat("x", OutputLimit))
	response := &jsonrpc.Response{ID: id, Result: raw}
	if e := c.Write(context.Background(), response); e == nil {
		t.Fatal("oversized output accepted")
	}
}
