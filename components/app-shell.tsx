import type { ReactNode } from 'react'
import { AppNavbar } from '@/components/app-navbar'
import { BottomNav } from '@/components/bottom-nav'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  title?: string
  showBack?: boolean
  showLogo?: boolean
  hideBottomNav?: boolean
  contentClassName?: string
}

export function AppShell({
  children,
  title,
  showBack,
  showLogo,
  hideBottomNav,
  contentClassName,
}: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <AppNavbar title={title} showBack={showBack} showLogo={showLogo} />
      <main
        className={cn(
          'min-w-0 flex-1 px-4 pt-3',
          // Leave room for the floating bottom bar plus the system navigation inset.
          hideBottomNav ? 'pb-[calc(2rem+var(--sab))]' : 'pb-[calc(8.5rem+var(--sab))]',
          contentClassName,
        )}
      >
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  )
}
