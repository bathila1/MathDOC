// Shared (client + server) helpers for turning a pasted video link into a safe
// embeddable iframe src. We store the ORIGINAL url and derive the embed here so
// the logic can be fixed later without a data migration.

export type EmbedMediaType = "youtube" | "facebook";

/** Extract the 11-char video id from any common YouTube URL, else null. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v") ?? "";
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

/** True when the URL looks like something we can embed for the given type. */
export function isValidEmbedUrl(type: EmbedMediaType, url: string): boolean {
  if (type === "youtube") return youtubeId(url) !== null;
  try {
    const host = new URL(url.trim()).hostname.replace(/^www\./, "");
    return host === "facebook.com" || host === "fb.watch" || host === "web.facebook.com";
  } catch {
    return false;
  }
}

/** Privacy-friendly iframe src for a stored media link, or null if unusable. */
export function toEmbedSrc(type: EmbedMediaType, url: string): string | null {
  if (type === "youtube") {
    const id = youtubeId(url);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (type === "facebook") {
    if (!isValidEmbedUrl("facebook", url)) return null;
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
      url.trim()
    )}&show_text=false`;
  }
  return null;
}
