import { AuthCard } from '@/components/auth/AuthCard'
import { BrandMark } from '@/components/auth/BrandMark'
import { LanguageSwitcher } from '@/components/auth/LanguageSwitcher'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-subtle relative flex min-h-svh flex-col items-center justify-center px-4 py-8">
      <div className="z-sticky absolute end-4 top-[calc(env(safe-area-inset-top)+1rem)]">
        <LanguageSwitcher />
      </div>

      <main
        id="main-content"
        className="flex w-full max-w-md flex-col items-center gap-5"
        tabIndex={-1}
      >
        <BrandMark />
        <AuthCard>{children}</AuthCard>
      </main>
    </div>
  )
}
