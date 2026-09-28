'use client'

import { Lock, Mail, Phone, User } from 'lucide-react'
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
import { authErrorMessage, signUpWithEmail } from '@/lib/auth-actions'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      await signUpWithEmail({ name: name.trim(), email: email.trim(), phone: phone.trim(), password })
      toast.success('Account created. Welcome to SafeHer!')
      router.replace('/permissions')
    } catch (error) {
      console.error('Signup error:', error)
      toast.error(authErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="pt-safe mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-6 py-8 pb-[calc(2rem+var(--sab))]">
      <div className="flex items-center justify-between">
        <Logo />
        <ModeToggle />
      </div>

      <FadeIn className="mt-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Create your account
        </h1>
        <p className="mt-2 text-muted-foreground">
          Set up your safety profile in under a minute.
        </p>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              <User className="size-4 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
              maxLength={100}
            />
          </div>

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
              inputMode="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              <Phone className="size-4 text-muted-foreground" />
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              <Lock className="size-4 text-muted-foreground" />
              Password
            </Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password (6+ characters)"
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">
              <Lock className="size-4 text-muted-foreground" />
              Confirm Password
            </Label>
            <Input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="mt-2 h-14 w-full rounded-2xl text-base"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            Login
          </Link>
        </p>
      </FadeIn>
    </main>
  )
}
