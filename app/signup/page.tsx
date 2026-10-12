'use client'

import { Lock, Mail, Phone, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { AuthHero } from '@/components/auth-hero'
import { FadeIn } from '@/components/motion'
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
      console.warn('Signup failed:', (error as { code?: string }).code)
      toast.error(authErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="bg-aurora min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <AuthHero title="Create your account" subtitle="Set up your safety profile in under a minute." />

        <FadeIn delay={0.05} className="relative z-10 -mt-8 flex-1 px-5 pb-[calc(1.5rem+var(--sab))]">
          <form onSubmit={handleSubmit} className="surface-raised space-y-4 rounded-[2rem] p-5">
            <div className="space-y-2">
              <Label htmlFor="name">
                <User className="size-4 text-primary" />
                Full name
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
              <Label htmlFor="phone">
                <Phone className="size-4 text-primary" />
                Phone number
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
                <Lock className="size-4 text-primary" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">
                <Lock className="size-4 text-primary" />
                Confirm password
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

            <button
              type="submit"
              disabled={loading}
              className="gradient-primary glow-primary mt-1 min-h-14 w-full rounded-2xl font-display text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="inline-flex min-h-11 items-center font-bold text-primary">
              Log in
            </Link>
          </p>
        </FadeIn>
      </div>
    </main>
  )
}
