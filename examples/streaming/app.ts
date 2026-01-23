import {
  Controller,
  Get,
  Sse,
  Streaming,
  createExpressApp
} from "../..";

@Controller("/streaming")
class StreamingController {
  @Get("/")
  @Streaming({ contentType: "text/plain", description: "Streaming text response" })
  async streamText(ctx: any) {
    const writer = ctx.stream;
    if (!writer) {
      throw new Error("Streaming not supported");
    }

    const data = ["First line", "Second line", "Third line", "Fourth line", "Fifth line"];
    
    for (let i = 0; i < data.length; i++) {
      writer.writeLine(data[i]);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    writer.close();
  }

  @Get("/events")
  @Sse({ description: "Server-Sent Events example" })
  async streamEvents(ctx: any) {
    const emitter = ctx.sse;
    if (!emitter) {
      throw new Error("SSE not supported");
    }

    let count = 0;
    const interval = setInterval(() => {
      count++;
      emitter.emit("message", {
        id: count,
        timestamp: new Date().toISOString(),
        message: `Event ${count}`
      });

      if (count >= 5) {
        clearInterval(interval);
        emitter.close();
      }
    }, 1000);

    // Handle connection close
    ctx.req.on("close", () => {
      clearInterval(interval);
      emitter.close();
    });
  }

  @Get("/ndjson")
  @Streaming({ contentType: "application/x-ndjson", description: "NDJSON stream" })
  async streamNdjson(ctx: any) {
    const writer = ctx.stream;
    if (!writer) {
      throw new Error("Streaming not supported");
    }

    const data = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
      { id: 3, name: "Item 3" },
      { id: 4, name: "Item 4" },
      { id: 5, name: "Item 5" }
    ];

    for (let i = 0; i < data.length; i++) {
      writer.writeJsonLine(data[i]);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    writer.close();
  }
}

export async function start() {
  const app = await createExpressApp({
    controllers: [StreamingController],
    openApi: {
      info: { title: "Streaming API", version: "1.0.0" },
      path: "/openapi.json"
    }
  });

  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`Streaming API server is running at http://localhost:${PORT}`);
    console.log(`OpenAPI documentation: http://localhost:${PORT}/openapi.json`);
  });
}

start().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
