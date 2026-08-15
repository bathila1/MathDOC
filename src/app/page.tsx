import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { TeacherAvatar } from "@/components/brand/TeacherAvatar";
import { SiteFooter } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";

const steps = [
  {
    no: "01",
    title: "Book a session",
    text: "Register with your phone number, sit a short placement quiz, and pick a time that suits you.",
  },
  {
    no: "02",
    title: "Follow your plan",
    text: "After every session Sir sets tasks made for you. Finish them one at a time and upload your work.",
  },
  {
    no: "03",
    title: "Fix your doubts",
    text: "Stuck on something? Ask Sir directly on the task and get it cleared up before you move on.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo />
          <Button size="sm" render={<Link href="/login" />}>
            Student login
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
        <div className="grid items-center gap-12 sm:grid-cols-[1.3fr_1fr]">
          <div>
            <h1 className="max-w-lg text-4xl leading-tight sm:text-5xl">
              Every student deserves a plan of their own.
            </h1>
            <div className="mt-8">
              <Button size="lg" render={<Link href="/login" />}>
                Get started
              </Button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[15rem]">
            <TeacherAvatar className="aspect-square w-full rounded-lg border object-cover" />
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto grid max-w-4xl gap-10 px-6 py-16 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.no}>
              <p className="font-heading text-sm font-bold text-primary">
                {s.no}
              </p>
              <h3 className="mt-2 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
