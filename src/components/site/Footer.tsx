import { RiseupMark } from "@/components/brand/RiseupMark";

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6V11H8.5v3h2.3v7h2.7Z" />
    </svg>
  );
}
function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.3 5 12 5 12 5s-6.3 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26.4 26.4 0 0 0 2 12c0 1.6.1 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8c1.5.4 7.8.4 7.8.4s6.3 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.3-1.6.4-3.2.4-4.8 0-1.6-.1-3.2-.4-4.8ZM10 15.2V8.8L15.5 12 10 15.2Z" />
    </svg>
  );
}
function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 1.8a7.2 7.2 0 1 1-3.7 13.4l-.3-.2-2.7.7.7-2.6-.2-.3A7.2 7.2 0 0 1 12 4.8Zm-2.6 3.4c-.2 0-.4 0-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.2 1.6 2.5 3.9 3.4 1.9.8 2.3.6 2.7.6.4 0 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.4-.2-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a5.9 5.9 0 0 1-1.7-1.1 6.5 6.5 0 0 1-1.2-1.5c-.1-.2 0-.3.1-.5l.5-.6c.1-.2.1-.3 0-.5l-.7-1.6c-.1-.4-.3-.4-.5-.4h-.8Z" />
    </svg>
  );
}
function TelegramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M20.7 4.2 3.3 10.9c-.9.3-.9 1.2-.2 1.4l4.4 1.4 1.7 5.2c.2.6.9.7 1.3.3l2.4-2.3 4.5 3.3c.5.3 1.2 0 1.3-.6l2.6-13.9c.2-1-.5-1.7-1.6-1.5ZM8.5 13.2l9.3-5.8c.2-.1.4.1.2.3l-7.7 7.1-.3 3-1.5-4.6Z" />
    </svg>
  );
}

export interface FooterSocials {
  facebookUrl?: string | null;
  youtubeUrl?: string | null;
  whatsappUrl?: string | null;
  telegramUrl?: string | null;
}

export function SiteFooter({ socials: links = {} }: { socials?: FooterSocials }) {
  // Only render an icon when Sir has actually set that URL — an icon linking
  // to "#" is worse than no icon. URLs are scheme-validated on save.
  const socials = [
    { label: "Facebook", href: links.facebookUrl, icon: FacebookIcon },
    { label: "YouTube", href: links.youtubeUrl, icon: YoutubeIcon },
    { label: "WhatsApp", href: links.whatsappUrl, icon: WhatsAppIcon },
    { label: "Telegram", href: links.telegramUrl, icon: TelegramIcon },
  ].filter((s): s is { label: string; href: string; icon: typeof FacebookIcon } =>
    Boolean(s.href)
  );

  return (
    // Pure white (bg-card) against the page's warm off-white canvas: the footer
    // reads as its own band without a colour change, matching how cards lift
    // off the background elsewhere. Flips to the dark card surface in dark mode.
    <footer className="border-t bg-card text-card-foreground">
      {socials.length > 0 && (
        <div className="mx-auto max-w-5xl px-4 py-14 text-center">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
            Follow us on
          </p>
          <h3 className="mt-1 text-2xl">Social media!</h3>
          <div className="mt-7 flex justify-center gap-4">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={s.label}
                className="flex size-12 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <s.icon className="size-5" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 py-5 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} MathDOC. All rights reserved.</p>
        </div>
        <div className="flex items-center justify-center gap-2 pb-6 text-xs text-muted-foreground">
          <span>Crafted by</span>
          <a
            href="https://riseup.lk"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="riseup — opens riseup.lk in a new tab"
            className="transition-opacity hover:opacity-80"
          >
            <RiseupMark />
          </a>
        </div>
      </div>
    </footer>
  );
}
