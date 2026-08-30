import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test, { after } from "node:test";

const PORT = 4173;
const server = spawn("node", ["server.js"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "pipe",
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("server.js did not start in time")), 10_000);
  server.stdout.on("data", (chunk) => {
    if (chunk.toString().includes("running on port")) {
      clearTimeout(timeout);
      resolve();
    }
  });
  server.on("exit", (code) => {
    clearTimeout(timeout);
    reject(new Error(`server.js exited early with code ${code}`));
  });
});

after(() => {
  server.kill();
});

test("health check responds", async () => {
  const response = await fetch(`http://localhost:${PORT}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("serves the built app shell for unknown routes", async () => {
  const response = await fetch(`http://localhost:${PORT}/anything`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const body = await response.text();
  assert.match(body, /<div id="root">/);
});

test("rejects an import request without an auth token", async () => {
  const response = await fetch(`http://localhost:${PORT}/api/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com/recipe" }),
  });
  assert.equal(response.status, 401);
});
