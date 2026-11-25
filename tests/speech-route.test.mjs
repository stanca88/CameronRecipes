import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true } });
after(() => vite.close());
const { POST } = await vite.ssrLoadModule("/app/api/speech/route.ts");

const send = (body) => POST(new Request("http://localhost/api/speech", { method: "POST", body: JSON.stringify(body) }));

test("reports natural voice as unavailable without an API key", async () => {
  delete process.env.OPENAI_API_KEY;
  assert.equal((await send({ text: "Stir." })).status, 503);
});

test("validates text and streams audio from the voice service", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => { request = { url: String(url), init }; return new Response("audio-bytes"); };
  try {
    assert.equal((await send({ text: "  " })).status, 400);
    assert.equal((await send({ text: "x".repeat(1300) })).status, 413);
    const response = await send({ text: "Step 1. Stir." });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal(await response.text(), "audio-bytes");
    assert.equal(request.url, "https://api.openai.com/v1/audio/speech");
    assert.equal(JSON.parse(request.init.body).input, "Step 1. Stir.");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});
