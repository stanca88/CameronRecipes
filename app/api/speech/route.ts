const maxCharacters = 1200;

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return Response.json({ error: "Natural voice is not configured." }, { status: 503 });

  let text = "";
  try {
    const body = await request.json() as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return Response.json({ error: "Send the step text to read." }, { status: 400 });
  }
  if (!text) return Response.json({ error: "Send the step text to read." }, { status: 400 });
  if (text.length > maxCharacters) return Response.json({ error: "That step is too long to read aloud." }, { status: 413 });

  try {
    const upstream = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-US", name: "en-US-Neural2-F" },
        audioConfig: { audioEncoding: "MP3" },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const result = await upstream.json().catch(() => null) as { audioContent?: string; error?: { status?: string } } | null;
    if (!upstream.ok || !result?.audioContent) {
      console.error("Google speech request failed", upstream.status, result?.error?.status);
      return Response.json({ error: "Natural voice is unavailable right now.", status: upstream.status, reason: result?.error?.status ?? null }, { status: 502 });
    }
    return new Response(Buffer.from(result.audioContent, "base64"), { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });
  } catch (error) {
    console.error("Google speech request error", error);
    return Response.json({ error: "Natural voice is unavailable right now." }, { status: 502 });
  }
}
