import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarCheck, ListChecks, Award } from "lucide-react";

const steps = [
  {
    icon: CalendarCheck,
    title: "1. Book a session",
    text: "Register with your phone number, sit a short placement quiz, and pick a free time — meet Sir in person or online.",
  },
  {
    icon: ListChecks,
    title: "2. Follow your plan",
    text: "After your session, Sir sets personal tasks just for you. Complete them one by one and upload your work as proof.",
  },
  {
    icon: Award,
    title: "3. Earn your certificate",
    text: "Watch your progress bar grow. Finish every task and receive a digital certificate of completion.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-xl font-bold">MathDoc</span>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/admin/login" />}>
              Teacher
            </Button>
            <Button size="sm" render={<Link href="/login" />}>
              Student login
            </Button>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-b from-primary/10 via-primary/5 to-transparent">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            📐 One-to-one maths coaching
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Personal attention for every maths student
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Meet Sir one-to-one, get a plan made just for you, and watch your
            progress grow — one task at a time.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button
              size="lg"
              className="shadow-lg shadow-primary/25"
              render={<Link href="/login" />}
            >
              Get started — it&apos;s easy
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 pb-20 sm:grid-cols-3">
        {steps.map((s) => (
          <Card key={s.title}>
            <CardHeader>
              <s.icon className="size-8 text-primary" />
              <CardTitle className="mt-2">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {s.text}
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MathDoc
      </footer>
    </main>
  );
}
