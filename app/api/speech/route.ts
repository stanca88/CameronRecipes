const maxCharacters = 1200;

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] as string);

export async function POST(request: Request) {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  if (!apiKey || !region || !/^[a-z0-9-]+$/i.test(region)) return Response.json({ error: "Natural voice is not configured." }, { status: 503 });

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
    const upstream = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "ocp-apim-subscription-key": apiKey,
        "content-type": "application/ssml+xml",
        "x-microsoft-outputformat": "audio-24khz-48kbitrate-mono-mp3",
        "user-agent": "cameron-recipes",
      },
      body: `<speak version="1.0" xml:lang="en-US"><voice name="en-US-AvaMultilingualNeural">${escapeXml(text)}</voice></speak>`,
      signal: AbortSignal.timeout(20000),
    });
    if (!upstream.ok || !upstream.body) {
      console.error("Azure speech request failed", upstream.status);
      return Response.json({ error: "Natural voice is unavailable right now.", status: upstream.status }, { status: 502 });
    }
    return new Response(upstream.body, { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });
  } catch (error) {
    console.error("Azure speech request error", error);
    return Response.json({ error: "Natural voice is unavailable right now." }, { status: 502 });
  }
}
