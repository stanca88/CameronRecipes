function metaContent(html: string, name: string): string {
  const match = new RegExp(`<meta[^>]+property=["']${name}["'][^>]*content=["']([^"']+)["']`, "i").exec(html)
    || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*property=["']${name}["']`, "i").exec(html);
  return match?.[1] || "";
}

export async function POST(request: Request) {
  let originalUrl = "";
  try {
    const { url } = await request.json() as { url?: string };
    originalUrl = url || "";
    const imageUrl = new URL(originalUrl);
    if (!/^https?:$/.test(imageUrl.protocol)) return Response.json({ url: originalUrl }, { status: 200 });
    if (!/(^|\.)flickr\.com$/i.test(imageUrl.hostname)) return Response.json({ url: originalUrl }, { status: 200 });

    const response = await fetch(imageUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; CameronFamilyRecipes/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return Response.json({ url }, { status: 200 });
    const html = await response.text();
    const resolved = metaContent(html, "og:image");
    return Response.json({ url: resolved || originalUrl }, { status: 200 });
  } catch {
    return Response.json({ url: originalUrl }, { status: 200 });
  }
}
