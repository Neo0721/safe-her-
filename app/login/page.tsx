'use client'

import { Eye, EyeOff, Lock, Mail, PhoneCall } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { AuthHero } from '@/components/auth-hero'
import { FadeIn } from '@/components/motion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CONFIG } from '@/lib/config'
import { authErrorMessage, sendResetEmail, signInWithEmail, signInWithGoogle } from '@/lib/auth-actions'

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithEmail(email.trim(), password)
      toast.success('Welcome back to SafeHer')
      router.replace('/home')
    } catch (error) {
      console.warn('Login failed:', (error as { code?: string }).code)
      toast.error(authErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      await signInWithGoogle()
      toast.success('Signed in with Google')
      router.replace('/home')
    } catch (error) {
      console.warn('Google sign-in failed:', (error as { code?: string; message?: string }).code ?? (error as Error).message)
      toast.error(authErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Enter your email address first.')
      return
    }
    try {
      await sendResetEmail(email.trim())
      toast.success('Password reset email sent. Check your inbox.')
    } catch (error) {
      toast.error(authErrorMessage(error))
    }
  }

  return (
    <main className="bg-aurora min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <AuthHero title="Welcome back" subtitle="Log in to keep your safety circle one tap away." />

        <FadeIn delay={0.05} className="relative z-10 -mt-8 flex-1 px-5 pb-[calc(1.5rem+var(--sab))]">
          <div className="surface-raised rounded-[2rem] p-5">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="size-4 text-primary" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  <Lock className="size-4 text-primary" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="pr-14"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground active:bg-muted"
                  >
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={handleForgotPassword} className="flex min-h-11 items-center text-sm font-semibold text-primary">
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="gradient-primary glow-primary min-h-14 w-full rounded-2xl font-display text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? 'Logging in…' : 'Log in'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or continue with
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="surface-raised flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to SafeHer?{' '}
            <Link href="/signup" className="inline-flex min-h-11 items-center font-bold text-primary">
              Create an account
            </Link>
          </p>

          <a
            href={`tel:${CONFIG.emergencyNumber}`}
            className="mx-auto mt-2 flex min-h-11 w-fit items-center gap-2 rounded-full px-4 text-xs font-semibold text-danger"
          >
            <PhoneCall className="size-4" />
            In an emergency? Call {CONFIG.emergencyNumber}
          </a>
        </FadeIn>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06L5.84 9.9c.87-2.6 3.3-4.52 6.16-4.52Z"
      />
    </svg>
  )
}
