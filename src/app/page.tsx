import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { TeacherAvatar } from "@/components/brand/TeacherAvatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarCheck, ListChecks, Award, Star } from "lucide-react";

const steps = [
  {
    icon: CalendarCheck,
    color: "from-orange-500 to-amber-400",
    title: "1. Book a session",
    text: "Register with your phone number, sit a short placement quiz, and pick a free time — meet Sir in person or online.",
  },
  {
    icon: ListChecks,
    color: "from-red-500 to-orange-400",
    title: "2. Play your plan",
    text: "After your session, Sir sets a game-like task journey just for you. Complete milestones one by one and upload your work.",
  },
  {
    icon: Award,
    color: "from-amber-500 to-yellow-400",
    title: "3. Earn your certificate",
    text: "Watch your progress track fill up. Reach 100% and receive your digital certificate!",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/admin/login" />}>
              Teacher
            </Button>
            <Button
              size="sm"
              className="bg-brand-gradient border-0 text-white"
              render={<Link href="/login" />}
            >
              Student login
            </Button>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-b from-primary/10 via-primary/5 to-transparent">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr]">
          <div className="text-center lg:text-left">
            <span className="inline-block animate-pop-in rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary">
              📐 One-to-one maths coaching
            </span>
            <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Personal attention for{" "}
              <span className="text-brand-gradient">every</span> maths student
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Meet Sir one-to-one, get a plan made just for you, and watch your
              progress grow — one task at a time.
            </p>
            <div className="mt-8 flex justify-center gap-3 lg:justify-start">
              <Button
                size="lg"
                className="bg-brand-gradient border-0 text-white shadow-lg shadow-primary/30"
                render={<Link href="/login" />}
              >
                Get started — it&apos;s easy 🚀
              </Button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-xs">
            <div className="animate-float relative">
              <div className="absolute -inset-3 rounded-[2rem] bg-brand-gradient opacity-20 blur-xl" />
              <div className="relative overflow-hidden rounded-[2rem] border-4 border-white shadow-2xl dark:border-card">
                <TeacherAvatar className="aspect-square w-full" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
                  <p className="text-lg font-extrabold">Sir</p>
                  <p className="flex items-center gap-1 text-xs">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    Your personal maths coach
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 pb-20 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Card
            key={s.title}
            className="hover-lift animate-pop-in"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <CardHeader>
              <div
                className={`flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-md`}
              >
                <s.icon className="size-6" />
              </div>
              <CardTitle className="mt-2">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {s.text}
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MathDoc — made with ❤️ for students
      </footer>
    </main>
  );
}
