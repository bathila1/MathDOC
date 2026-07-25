"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

/** App-wide light/dark theming. `class` strategy matches the `.dark` variant
 *  in globals.css. Light is the default; the toggle flips to dark and the
 *  choice is remembered. (OS preference is intentionally not followed so the
 *  site opens light for everyone unless they pick dark.) */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
