// Paste your YouTube video link here later (watch or youtu.be URL).
// Leave empty to show the video placeholder on the landing page.
export const YOUTUBE_VIDEO_URL = "";

export function youtubeEmbedUrl(url: string): string | null {
  if (!url.trim()) return null;
  try {
    const u = new URL(url.trim());
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2] ?? "";
    else id = u.searchParams.get("v") ?? "";
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}
