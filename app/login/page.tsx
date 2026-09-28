'use client'

import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'
import { ModeToggle } from '@/components/mode-toggle'
import { FadeIn } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
      console.error('Login error:', error)
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
      console.error('Google sign-in error:', error)
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
    <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-6 py-8 pb-[calc(2rem+var(--sab))]">
      <div className="flex items-center justify-between">
        <Logo />
        <ModeToggle />
      </div>

      <FadeIn className="mt-10">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-muted-foreground">
          Log in to keep your safety network active.
        </p>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-8">
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">
              <Mail className="size-4 text-muted-foreground" />
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              <Lock className="size-4 text-muted-foreground" />
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
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="size-5" />
                ) : (
                  <Eye className="size-5" />
                )}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
              >
                Forgot Password?
              </button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="h-14 w-full rounded-2xl text-base"
          >
            {loading ? 'Logging in…' : 'Login'}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or continue with</span>
          <Separator className="flex-1" />
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            size="lg"
            className="h-14 w-full rounded-2xl text-base"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {"Don't have an account? "}
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            Create Account
          </Link>
        </p>
      </FadeIn>
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
