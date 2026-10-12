"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import {
  Mail,
  Phone,
  Droplet,
  Users,
  Globe,
  Bell,
  LogOut,
  ChevronRight,
  Pencil,
  Info,
  MapPin,
  Palette,
  type LucideIcon,
} from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { FadeIn } from "@/components/motion"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ModeToggle } from "@/components/mode-toggle"
import { Dialog } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { apiJson, errorMessage } from "@/lib/api-fetch"
import type { Profile } from "@/lib/auth-actions"
import { initialsOf } from "@/lib/utils"

export default function ProfilePage() {
  const { logout, user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  // Form states
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [bloodGroup, setBloodGroup] = useState("")
  const [language, setLanguage] = useState("English")
  const [saving, setSaving] = useState(false)

  const fetchProfile = async () => {
    try {
      const data = await apiJson<Profile>("/api/profile")
      setProfile(data)
      setFullName(data.full_name || "")
      setPhone(data.phone || "")
      setBloodGroup(data.blood_group || "")
      setLanguage(data.language || "English")
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load your profile."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) void fetchProfile()
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await apiJson<Profile>("/api/profile", {
        method: "POST",
        json: { fullName, phone, bloodGroup, language },
      })
      setProfile(updated)
      toast.success("Profile updated")
      setEditOpen(false)
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update profile. Try again."))
    } finally {
      setSaving(false)
    }
  }

  const handleLogoutClick = async () => {
    try {
      await logout()
    } catch {
      toast.error("Failed to log out. Please try again.")
    }
  }

  if (loading) {
    return (
      <AppShell title="Profile">
        <div className="flex h-64 items-center justify-center" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    )
  }

  const initials = profile?.full_name ? initialsOf(profile.full_name) : "U"

  if (loadError || !profile) {
    return (
      <AppShell title="Profile">
        <div role="alert" className="mt-6 rounded-2xl border border-danger/30 bg-danger/8 p-4 text-sm">
          <p className="font-medium">Could not load your profile</p>
          <p className="mt-1 text-muted-foreground">{loadError}</p>
          <button type="button" onClick={() => { setLoading(true); void fetchProfile() }} className="mt-3 min-h-11 rounded-xl border border-border bg-card px-4 font-semibold">
            Try again
          </button>
          <button type="button" onClick={handleLogoutClick} className="ml-2 mt-3 min-h-11 rounded-xl border border-border px-4 font-semibold text-destructive">
            Log out
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Me" subtitle="Your profile and preferences">
      <div className="space-y-5 py-1">
        {/* Header card */}
        <FadeIn>
          <div className="gradient-primary glow-primary relative overflow-hidden rounded-[2rem] p-5">
            <span className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-white/10" aria-hidden="true" />
            <span className="pointer-events-none absolute -bottom-12 left-10 size-32 rounded-full bg-white/10" aria-hidden="true" />
            <div className="relative flex items-center gap-4">
              <div className="relative shrink-0">
                <Avatar className="size-20 bg-white/25 ring-4 ring-white/30">
                  <AvatarImage src={profile?.photo_url || user?.photoURL || undefined} alt={profile?.full_name || "User"} />
                  <AvatarFallback className="bg-transparent text-2xl font-extrabold text-white">{initials}</AvatarFallback>
                </Avatar>
                <button
                  aria-label="Edit profile"
                  onClick={() => setEditOpen(true)}
                  className="absolute -bottom-1 -right-1 flex size-10 items-center justify-center rounded-full bg-white text-primary shadow-md ring-2 ring-white/40 transition-transform active:scale-90"
                >
                  <Pencil className="size-4" />
                </button>
              </div>
              <div className="min-w-0 flex-1 text-white">
                <h2 className="break-words font-display text-xl font-extrabold leading-tight">{profile?.full_name || "No name set"}</h2>
                <p className="mt-0.5 break-all text-sm text-white/85">{user?.email || profile?.email}</p>
                {profile?.blood_group && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
                    <Droplet className="size-3" /> {profile.blood_group}
                  </span>
                )}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Contact info */}
        <FadeIn delay={0.05}>
          <SectionCard title="Contact">
            <Row icon={Mail} label="Email" value={user?.email || profile?.email || "Unavailable"} />
            <Row icon={Phone} label="Phone" value={profile?.phone || "Not set"} />
            <Row icon={Droplet} label="Blood group" value={profile?.blood_group || "Not set"} accent />
          </SectionCard>
        </FadeIn>

        {/* Preferences */}
        <FadeIn delay={0.1}>
          <SectionCard title="Safety">
            <LinkRow icon={Users} label="My circle" href="/contacts" tone="gradient-primary" />
            <LinkRow icon={Bell} label="SOS settings & quick trigger" href="/sos-settings" tone="gradient-warm" />
            <LinkRow icon={MapPin} label="Permissions" href="/permissions" tone="gradient-sky" />
            <LinkRow icon={Info} label="How SafeHer works" href="/how-it-works" tone="gradient-success" />
          </SectionCard>
        </FadeIn>

        <FadeIn delay={0.15}>
          <SectionCard title="App">
            <Row icon={Globe} label="Language" value={profile?.language || "English"} />
            <div className="flex min-h-14 items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="gradient-primary flex size-10 items-center justify-center rounded-2xl">
                  <Palette className="size-4.5" />
                </span>
                <span className="text-sm font-semibold">Theme</span>
              </div>
              <ModeToggle />
            </div>
          </SectionCard>
        </FadeIn>

        <FadeIn delay={0.2}>
          <button
            onClick={handleLogoutClick}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-danger/30 py-3.5 font-bold text-danger transition-colors active:bg-danger/10"
          >
            <LogOut className="size-5" />
            Log out
          </button>
        </FadeIn>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Profile"
        description="Update your safety profile settings."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sarah Mitchell"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone Number</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-blood">Blood Group</Label>
            <select
              id="edit-blood"
              className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-lang">Preferred Language</Label>
            <select
              id="edit-lang"
              className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 flex-1 rounded-xl"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={saving}
              className="h-12 flex-1 rounded-xl"
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      <div className="surface divide-y divide-border/70 overflow-hidden rounded-3xl px-4">{children}</div>
    </section>
  )
}

function Row({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3">
        <span className={`flex size-10 items-center justify-center rounded-2xl ${accent ? "bg-danger/12 text-danger" : "bg-primary/12 text-primary"}`}>
          <Icon className="size-4.5" />
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <span className="max-w-[55%] truncate text-sm text-muted-foreground">{value}</span>
    </div>
  )
}

function LinkRow({ icon: Icon, label, href, tone }: { icon: LucideIcon; label: string; href: string; tone: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center justify-between gap-3 py-2 active:opacity-70">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="size-4.5" />
        </span>
        <span className="truncate text-sm font-semibold">{label}</span>
      </div>
      <ChevronRight className="size-4.5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
