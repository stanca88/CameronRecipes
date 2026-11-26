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
  delete process.env.GOOGLE_TTS_API_KEY;
  assert.equal((await send({ text: "Stir." })).status, 503);
});

test("validates text and streams audio from the voice service", async () => {
  process.env.GOOGLE_TTS_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => { request = { url: String(url), init }; return Response.json({ audioContent: Buffer.from("audio-bytes").toString("base64") }); };
  try {
    assert.equal((await send({ text: "  " })).status, 400);
    assert.equal((await send({ text: "x".repeat(1300) })).status, 413);
    const response = await send({ text: "Stir gently." });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal(await response.text(), "audio-bytes");
    assert.equal(request.url, "https://texttospeech.googleapis.com/v1/text:synthesize");
    assert.equal(request.init.headers["x-goog-api-key"], "test-key");
    assert.equal(JSON.parse(request.init.body).input.text, "Stir gently.");
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_TTS_API_KEY;
  }
});
