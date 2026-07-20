import Link from "next/link";
import { LogoIcon } from "@/components/brand/Logo";
import { TeacherAvatar } from "@/components/brand/TeacherAvatar";

/**
 * Split auth layout: 63% photo of Sir on the left, 37% form on the right
 * (photo hidden on small screens).
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1">
      <div className="relative hidden lg:block lg:w-[63%]">
        <TeacherAvatar className="absolute inset-0 size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
        <div className="absolute bottom-10 left-10 max-w-md text-white">
          <Link href="/" className="inline-flex items-center gap-2">
            <LogoIcon className="size-10" />
            <span className="font-heading text-2xl font-bold">MathDoc</span>
          </Link>
          <p className="mt-3 font-heading text-3xl font-bold leading-tight">
            Every student deserves a plan of their own.
          </p>
          <p className="mt-2 text-sm text-white/80">
            One-to-one maths coaching with Sir.
          </p>
        </div>
      </div>

      <div className="bg-graph flex w-full flex-col items-center justify-center gap-6 p-6 lg:w-[37%]">
        <Link href="/" className="lg:hidden">
          <LogoIcon className="size-12" />
        </Link>
        {children}
      </div>
    </main>
  );
}
