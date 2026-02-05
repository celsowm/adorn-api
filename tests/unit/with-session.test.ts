import { describe, expect, it } from "vitest";
import { withSession } from "../../src/adapter/metal-orm/index";

describe("withSession", () => {
  it("disposes session after handler completes", async () => {
    let disposed = false;

    const mockSession = {
      dispose: async () => {
        disposed = true;
      }
    } as any;

    const createSession = () => mockSession;

    const result = await withSession(createSession, async (_session) => {
      return { id: 1 };
    });

    expect(result).toEqual({ id: 1 });
    expect(disposed).toBe(true);
  });

  it("disposes session even when handler throws", async () => {
    let disposed = false;

    const mockSession = {
      dispose: async () => {
        disposed = true;
      }
    } as any;

    const createSession = () => mockSession;

    await expect(
      withSession(createSession, async () => {
        throw new Error("Test error");
      })
    ).rejects.toThrow("Test error");

    expect(disposed).toBe(true);
  });
});
