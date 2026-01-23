import { describe, it, expect, vi } from "vitest";
import {
  SseEmitter,
  StreamWriter,
  createSseEmitter,
  createStreamWriter,
  createNdjsonStream,
  streamIterable,
  streamSseIterable
} from "../src/core/streaming";

describe("SseEmitter", () => {
  describe("send", () => {
    it("sends simple data", () => {
      const write = vi.fn();
      const emitter = new SseEmitter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      emitter.send("hello");
      expect(write).toHaveBeenCalledWith("data: hello\n\n");
    });

    it("sends JSON data", () => {
      const write = vi.fn();
      const emitter = new SseEmitter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      emitter.send({ message: "hello" });
      expect(write).toHaveBeenCalledWith('data: {"message":"hello"}\n\n');
    });

    it("sends event with type", () => {
      const write = vi.fn();
      const emitter = new SseEmitter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      emitter.send({ event: "message", data: "hello" });
      expect(write).toHaveBeenCalledWith("event: message\ndata: hello\n\n");
    });

    it("sends event with id", () => {
      const write = vi.fn();
      const emitter = new SseEmitter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      emitter.send({ id: "123", data: "hello" });
      expect(write).toHaveBeenCalledWith("id: 123\ndata: hello\n\n");
    });

    it("sends event with retry", () => {
      const write = vi.fn();
      const emitter = new SseEmitter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      emitter.send({ retry: 5000, data: "hello" });
      expect(write).toHaveBeenCalledWith("retry: 5000\ndata: hello\n\n");
    });

    it("formats multi-line data", () => {
      const write = vi.fn();
      const emitter = new SseEmitter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      emitter.send("line1\nline2");
      expect(write).toHaveBeenCalledWith("data: line1\ndata: line2\n\n");
    });
  });

  describe("emit", () => {
    it("sends event with type using emit method", () => {
      const write = vi.fn();
      const emitter = new SseEmitter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      emitter.emit("message", "hello");
      expect(write).toHaveBeenCalledWith("event: message\ndata: hello\n\n");
    });
  });

  describe("comment", () => {
    it("sends comment", () => {
      const write = vi.fn();
      const emitter = new SseEmitter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      emitter.comment("keep-alive");
      expect(write).toHaveBeenCalledWith(": keep-alive\n\n");
    });
  });

  describe("close", () => {
    it("calls end on response", () => {
      const end = vi.fn();
      const emitter = new SseEmitter({ write: vi.fn(), flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn(), end } as any);
      
      emitter.close();
      expect(end).toHaveBeenCalled();
    });

    it("prevents further writes after close", () => {
      const write = vi.fn();
      const emitter = new SseEmitter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn(), end: vi.fn() } as any);
      
      emitter.close();
      emitter.send("hello");
      expect(write).not.toHaveBeenCalled();
    });
  });
});

describe("StreamWriter", () => {
  describe("write", () => {
    it("writes data to response", () => {
      const write = vi.fn();
      const writer = new StreamWriter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      writer.write("data");
      expect(write).toHaveBeenCalledWith("data");
    });
  });

  describe("writeLine", () => {
    it("writes line with newline", () => {
      const write = vi.fn();
      const writer = new StreamWriter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      writer.writeLine("line");
      expect(write).toHaveBeenCalledWith("line\n");
    });
  });

  describe("writeJson", () => {
    it("writes JSON data", () => {
      const write = vi.fn();
      const writer = new StreamWriter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      writer.writeJson({ key: "value" });
      expect(write).toHaveBeenCalledWith('{"key":"value"}');
    });
  });

  describe("writeJsonLine", () => {
    it("writes JSON line", () => {
      const write = vi.fn();
      const writer = new StreamWriter({ write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      
      writer.writeJsonLine({ key: "value" });
      expect(write).toHaveBeenCalledWith('{"key":"value"}\n');
    });
  });
});

describe("Stream Helpers", () => {
  describe("createSseEmitter", () => {
    it("creates SseEmitter instance", () => {
      const emitter = createSseEmitter({ write: vi.fn(), flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      expect(emitter).toBeInstanceOf(SseEmitter);
    });
  });

  describe("createStreamWriter", () => {
    it("creates StreamWriter instance", () => {
      const writer = createStreamWriter({ write: vi.fn(), flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn() } as any);
      expect(writer).toBeInstanceOf(StreamWriter);
    });
  });

  describe("createNdjsonStream", () => {
    it("sets correct content type", () => {
      const setHeader = vi.fn();
      createNdjsonStream({ write: vi.fn(), flushHeaders: vi.fn(), setHeader, on: vi.fn() } as any);
      expect(setHeader).toHaveBeenCalledWith("Content-Type", "application/x-ndjson");
    });
  });

  describe("streamIterable", () => {
    it("streams async iterable", async () => {
      const write = vi.fn();
      const iterable = (async function* () {
        yield "data1";
        yield "data2";
      })();
      
      await streamIterable(
        { write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn(), end: vi.fn() } as any,
        iterable,
        { transform: (item) => item + "\n" }
      );
      
      expect(write).toHaveBeenCalledTimes(2);
      expect(write).toHaveBeenNthCalledWith(1, "data1\n");
      expect(write).toHaveBeenNthCalledWith(2, "data2\n");
    });
  });

  describe("streamSseIterable", () => {
    it("streams SSE events from async iterable", async () => {
      const write = vi.fn();
      const iterable = (async function* () {
        yield "event1";
        yield "event2";
      })();
      
      await streamSseIterable(
        { write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn(), end: vi.fn() } as any,
        iterable
      );
      
      expect(write).toHaveBeenCalledTimes(2);
      expect(write).toHaveBeenNthCalledWith(1, "data: event1\n\n");
      expect(write).toHaveBeenNthCalledWith(2, "data: event2\n\n");
    });

    it("streams events with specific type", async () => {
      const write = vi.fn();
      const iterable = (async function* () {
        yield "event1";
        yield "event2";
      })();
      
      await streamSseIterable(
        { write, flushHeaders: vi.fn(), setHeader: vi.fn(), on: vi.fn(), end: vi.fn() } as any,
        iterable,
        { eventType: "custom" }
      );
      
      expect(write).toHaveBeenCalledWith("event: custom\ndata: event1\n\n");
    });
  });
});
