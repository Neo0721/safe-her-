import type { Metadata, Viewport } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { AndroidBackHandler } from '@/components/android-back-handler'
import { FocusScroll } from '@/components/focus-scroll'
import { SystemBarsSync } from '@/components/system-bars-sync'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SafeHer — Your Safety. Always Within Reach.',
  description:
    'SafeHer is a women’s emergency safety app with gesture-based SOS, live location sharing, and instant emergency response to keep you protected anywhere.',
  keywords: [
    'women safety app',
    'emergency SOS',
    'personal safety',
    'live location sharing',
    'SafeHer',
  ],
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6c63ff' },
    { media: '(prefers-color-scheme: dark)', color: '#100e1a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
          </AuthProvider>
          {/* Opaque strip behind the status bar so scrolled content never slides under the clock/icons. */}
          <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[2000]" style={{ height: 'var(--sat)', background: 'var(--statusbar-bg, var(--background))' }} />
          <AndroidBackHandler />
          <FocusScroll />
          <SystemBarsSync />
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}

