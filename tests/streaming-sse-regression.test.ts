import { describe, expect, it } from "vitest";
import { createSseEmitter, createStreamWriter } from "../src/core/streaming";

function createStrictResponse() {
  const headers = new Map<string, string>();
  const writes: Array<string | Buffer> = [];

  return {
    headersSent: false,
    writableEnded: false,
    headers,
    writes,
    setHeader(name: string, value: string) {
      if (this.headersSent) {
        const error = new Error("Cannot set headers after they are sent to the client");
        Object.assign(error, { code: "ERR_HTTP_HEADERS_SENT" });
        throw error;
      }
      headers.set(name, value);
    },
    flushHeaders() {
      this.headersSent = true;
    },
    write(data: string | Buffer) {
      writes.push(data);
      return true;
    },
    end() {
      this.writableEnded = true;
    },
    on() {
      // The regression only needs Node's committed-header semantics.
    }
  };
}

describe("SSE and raw streaming on the same response", () => {
  it("does not rewrite headers after the SSE emitter commits them", () => {
    const res = createStrictResponse();

    const emitter = createSseEmitter(res, { keepAlive: false });

    expect(res.headersSent).toBe(true);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Connection")).toBe("keep-alive");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");

    expect(() => createStreamWriter(res)).not.toThrow();

    const writer = createStreamWriter(res);
    expect(writer.write('data: {"choices":[]}\n\n')).toBe(true);
    expect(res.writes).toEqual(['data: {"choices":[]}\n\n']);

    emitter.close();
  });
});
