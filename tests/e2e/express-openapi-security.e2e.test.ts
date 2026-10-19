import { describe, expect, it, vi } from "vitest";
import { attachExpressOpenApi } from "../../src";

describe("Express OpenAPI docs HTML", () => {
  it("escapes configurable title, Swagger asset URL, and OpenAPI path", () => {
    const routes: Array<{ path: string; handler: (_req: unknown, res: any) => void }> = [];
    const app = {
      get(path: string, handler: (_req: unknown, res: any) => void) {
        routes.push({ path, handler });
      }
    };

    const title = 'Docs</title><script>alert("x")</script>';
    const swaggerUiUrl = 'https://cdn.example/" onerror="alert(1)';
    const openApiPath = '</script><script>alert("x")</script>';

    attachExpressOpenApi(app as any, [], {
      info: { title: "API", version: "1.0.0" },
      path: openApiPath,
      docs: { title, swaggerUiUrl }
    });

    const docsRoute = routes.find((route) => route.path === "/docs");
    expect(docsRoute).toBeDefined();
    let html = "";
    docsRoute!.handler({}, {
      type: vi.fn().mockReturnThis(),
      send: (value: string) => { html = value; }
    });

    expect(html).toContain("Docs&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain('href="https://cdn.example/&quot; onerror=&quot;alert(1)/swagger-ui.css"');
    expect(html).toContain('src="https://cdn.example/&quot; onerror=&quot;alert(1)/swagger-ui-bundle.js"');
    expect(html).toContain('url: "/\\u003c/script>\\u003cscript>alert(\\"x\\")\\u003c/script>"');
    expect(html).not.toContain('</script><script>alert("x")</script>');
  });
});
