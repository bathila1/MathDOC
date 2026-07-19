import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { TeacherAvatar } from "@/components/brand/TeacherAvatar";
import { Button } from "@/components/ui/button";

const steps = [
  {
    no: "01",
    title: "Book a session",
    text: "Register with your phone number, sit a short placement quiz, and pick a time that suits you — in person or online.",
  },
  {
    no: "02",
    title: "Follow your plan",
    text: "After every session Sir sets a personal series of tasks. Finish them one at a time and upload your working as proof.",
  },
  {
    no: "03",
    title: "Earn your certificate",
    text: "Your journey track fills as Sir approves each task. Reach the end and your certificate is issued automatically.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-3">
            <Link
              href="/admin/login"
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Teacher
            </Link>
            <Button size="sm" render={<Link href="/login" />}>
              Student login
            </Button>
          </nav>
        </div>
      </header>

      <section className="bg-graph border-b">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
              One-to-one maths coaching
            </p>
            <h1 className="mt-4 max-w-xl text-4xl leading-tight sm:text-5xl">
              Every student deserves a plan of their own.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Sit down with Sir, talk through what&apos;s holding you back, and
              leave with a step-by-step plan built just for you — tracked,
              checked, and certified.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Button size="lg" render={<Link href="/login" />}>
                Get started
              </Button>
              <span className="text-sm text-muted-foreground">
                Log in with just your phone number.
              </span>
            </div>
          </div>

          {/* Sir — polaroid-style frame */}
          <div className="mx-auto w-full max-w-[19rem]">
            <figure className="rotate-2 rounded-sm border bg-card p-3 pb-4 shadow-lg transition-transform duration-300 hover:rotate-0">
              <TeacherAvatar className="aspect-square w-full rounded-sm" />
              <figcaption className="pt-3 text-center">
                <span
                  className="text-lg italic"
                  style={{ fontFamily: "var(--font-fraunces), serif" }}
                >
                  Sir — your coach
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-10 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.no} className="border-t-2 border-primary/60 pt-5">
              <p
                className="text-3xl text-primary/70"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                {s.no}
              </p>
              <h3 className="mt-2 text-xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MathDoc
      </footer>
    </main>
  );
}
