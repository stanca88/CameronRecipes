const maxCharacters = 1200;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
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
    const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "coral",
        input: text,
        instructions: "Speak warmly and clearly, like a friendly cook reading a recipe step.",
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!upstream.ok || !upstream.body) {
      console.error("OpenAI speech request failed", upstream.status);
      return Response.json({ error: "Natural voice is unavailable right now." }, { status: 502 });
    }
    return new Response(upstream.body, { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });
  } catch (error) {
    console.error("OpenAI speech request error", error);
    return Response.json({ error: "Natural voice is unavailable right now." }, { status: 502 });
  }
}
