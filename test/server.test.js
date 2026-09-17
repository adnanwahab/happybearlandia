// test/server.test.js
import { describe, it, expect } from "bun:test";
import server from "../server.js";

describe("HTTP Server", () => {
  it("should return 200 and 'Hello from Bun!' on root path", async () => {
    // Test the fetch handler directly using a mock Request object
    const req = new Request("http://localhost/");
    const res = await server.fetch(req);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toBe("Hello from Bun!");
  });

  it("should return 404 for unknown paths", async () => {
    const req = new Request("http://localhost/unknown");
    const res = await server.fetch(req);

    expect(res.status).toBe(404);
  });
});
