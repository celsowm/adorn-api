import { describe, expect, it, vi } from "vitest";
import { Controller, Get, Raw, attachExpressControllers } from "../../src";
import { getControllerMeta } from "../../src/core/metadata";

@Controller("/raw")
class RawController {
  @Get("/")
  @Raw({ contentType: "text/plain" })
  get() {
    return "ok";
  }
}

describe("Express raw response content type", () => {
  it("resolves route response content type once at registration, not per request", async () => {
    const meta = getControllerMeta(RawController)!;
    const responses = meta.routes[0].responses!;
    const find = vi.spyOn(responses, "find");
    let handler: any;
    const app = {
      get(_path: string, routeHandler: any) {
        handler = routeHandler;
      },
      all() {}
    };

    await attachExpressControllers(app as any, [RawController]);
    expect(find).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 2; i++) {
      const res: any = {
        headersSent: false,
        getHeader: vi.fn(),
        type: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn()
      };
      await handler({
        method: "GET", headers: {}, params: {}, query: {}, body: {},
        originalUrl: "/raw/", url: "/raw/"
      }, res, vi.fn());
      expect(res.type).toHaveBeenCalledWith("text/plain");
      expect(res.send).toHaveBeenCalledWith("ok");
    }

    expect(find).toHaveBeenCalledTimes(3); // one cached content-type lookup plus default status per request
  });
});
