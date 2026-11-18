import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { request, get, post, put, del, buildUrl } from "../src/index.js";

let server: http.Server;
let base = "";

before(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url!, "http://x");
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const send = (status: number, body: unknown, text = false) => {
        res.writeHead(status, { "content-type": text ? "text/plain" : "application/json" });
        res.end(text ? String(body) : JSON.stringify(body));
      };
      if (url.pathname === "/echo")
        return send(200, {
          method: req.method,
          query: url.searchParams.getAll("tag"),
          page: url.searchParams.get("page"),
          auth: req.headers["authorization"] ?? null,
          body: raw ? JSON.parse(raw) : null,
        });
      if (url.pathname === "/404") return send(404, { message: "nope" });
      if (url.pathname === "/badjson") return send(200, "<html>", true);
      if (url.pathname === "/slow") return void setTimeout(() => send(200, {}), 500);
      send(200, {});
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.closeAllConnections?.() ?? server.close());

type Echo = { method: string; query: string[]; page: string | null; auth: string | null; body: unknown };

test("buildUrl skips null/undefined and repeats arrays", () => {
  assert.equal(buildUrl("/a", { p: 1, q: undefined, t: ["x", "y"] }), "/a?p=1&t=x&t=y");
});

test("GET with query + headers", async () => {
  const r = await get<Echo, { page: number; tag: string[] }>(`${base}/echo`, {
    query: { page: 2, tag: ["a", "b"] },
    headers: { Authorization: "Bearer t" },
  });
  assert.ok(r.ok);
  assert.equal(r.data.page, "2");
  assert.deepEqual(r.data.query, ["a", "b"]);
  assert.equal(r.data.auth, "Bearer t");
});

test("POST / PUT / DELETE", async () => {
  const p = await post<Echo, { n: number }>(`${base}/echo`, { n: 1 });
  assert.ok(p.ok);
  assert.equal(p.data.method, "POST");
  assert.deepEqual(p.data.body, { n: 1 });
  const u = await put<Echo>(`${base}/echo`, { n: 2 });
  assert.ok(u.ok && u.data.method === "PUT");
  const d = await del<Echo>(`${base}/echo`);
  assert.ok(d.ok && d.data.method === "DELETE");
});

test("http error", async () => {
  const r = await request(`${base}/404`);
  assert.ok(!r.ok);
  assert.equal(r.error.kind, "http");
  if (r.error.kind === "http") {
    assert.equal(r.error.status, 404);
    assert.deepEqual(r.error.body, { message: "nope" });
  }
});

test("parse error", async () => {
  const r = await request(`${base}/badjson`);
  assert.ok(!r.ok && r.error.kind === "parse");
});

test("network error never throws", async () => {
  const r = await request("http://127.0.0.1:1/");
  assert.ok(!r.ok && r.error.kind === "network");
});

test("timeout", async () => {
  const r = await request(`${base}/slow`, { timeoutMs: 50 });
  assert.ok(!r.ok && r.error.kind === "timeout");
});

test("caller abort", async () => {
  const ac = new AbortController();
  const p = request(`${base}/slow`, { signal: ac.signal });
  ac.abort();
  const r = await p;
  assert.ok(!r.ok && r.error.kind === "aborted");
});

test("validator failure becomes validation error", async () => {
  const r = await request<{ id: number }>(`${base}/echo`, {
    validate: (d) => {
      if (typeof (d as { id?: unknown }).id !== "number") throw new Error("id must be a number");
      return d as { id: number };
    },
  });
  assert.ok(!r.ok && r.error.kind === "validation");
});
