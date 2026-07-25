import type { Metadata } from "next";
import { Inter, Poppins, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopProgressBar } from "@/components/site/TopProgressBar";
import { ThemeProvider } from "@/components/site/ThemeProvider";
import "./globals.css";

// Inter for UI text; Poppins (bold, rounded, modern) for headings.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MathDOC — Personal Maths Coaching",
    template: "%s | MathDOC",
  },
  description:
    "Book one-to-one sessions with Sir, get a personal improvement plan, and earn your certificate.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TopProgressBar />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
