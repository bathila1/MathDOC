import Link from "next/link";
import { LogoIcon } from "@/components/brand/Logo";
import { TeacherAvatar } from "@/components/brand/TeacherAvatar";

/**
 * Split auth layout: a FIXED 63% poster of Sir on the left (never scrolls)
 * and a scrollable 37% form column on the right. On small screens the
 * poster is hidden and the form takes the full width.
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden">
      {/* fixed poster */}
      <div className="fixed inset-y-0 left-0 hidden w-[63%] lg:block">
        <TeacherAvatar className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
        <div className="absolute bottom-12 left-12 max-w-lg text-white">
          <Link href="/" className="inline-flex items-center gap-2">
            <LogoIcon className="size-10" />
            <span className="font-heading text-2xl font-bold">MathDoc</span>
          </Link>
          <p className="mt-4 font-heading text-4xl leading-tight font-bold">
            Every student deserves a plan of their own.
          </p>
          <p className="mt-3 text-sm text-white/80">
            One-to-one maths coaching with Sir.
          </p>
        </div>
      </div>

      {/* Scrollable form column. NOTE: `my-auto` centres the content instead
          of `justify-center` — with overflow-y-auto, justify-center clips
          the top and bottom of anything taller than the screen (which hid
          the register form's submit button). */}
      <main className="bg-graph flex min-h-screen w-full flex-col items-center overflow-y-auto px-5 py-10 lg:ml-[63%] lg:h-screen lg:w-[37%]">
        <div className="my-auto flex w-full flex-col items-center gap-6">
          <Link href="/" className="lg:hidden">
            <LogoIcon className="size-12" />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
