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
import { Card } from "@/components/ui/card"
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
    <AppShell title="Profile">
      <div className="mx-auto w-full max-w-2xl space-y-6 py-2">
        {/* Header card */}
        <FadeIn>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-primary to-primary/70 px-5 pb-14 pt-6" />
            <div className="-mt-12 flex flex-col items-center px-5 pb-6 text-center">
              <div className="relative">
                <Avatar className="size-24 ring-4 ring-card">
                  <AvatarImage src={profile?.photo_url || user?.photoURL || undefined} alt={profile?.full_name || "User"} />
                  <AvatarFallback className="text-2xl font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <button
                  aria-label="Edit Profile"
                  onClick={() => setEditOpen(true)}
                  className="absolute -bottom-1 -right-1 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card hover:bg-primary/90 transition-colors"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
              <h2 className="mt-3 break-words font-display text-xl font-bold">{profile?.full_name || "No Name Configured"}</h2>
              <p className="max-w-full break-all text-sm text-muted-foreground">{user?.email || profile?.email}</p>
            </div>
          </Card>
        </FadeIn>

        {/* Contact info */}
        <FadeIn delay={0.05}>
          <SectionCard title="Contact Information">
            <Row icon={Mail} label="Email" value={user?.email || profile?.email || "Unavailable"} />
            <Row icon={Phone} label="Phone" value={profile?.phone || "Not Configured"} />
          </SectionCard>
        </FadeIn>

        {/* Medical */}
        <FadeIn delay={0.1}>
          <SectionCard title="Medical Information">
            <Row icon={Droplet} label="Blood Group" value={profile?.blood_group || "Not Configured"} accent />
          </SectionCard>
        </FadeIn>

        {/* Preferences */}
        <FadeIn delay={0.15}>
          <SectionCard title="Preferences">
            <LinkRow icon={Users} label="Trusted Contacts" href="/contacts" />
            <LinkRow icon={Bell} label="SOS Settings" href="/sos-settings" />
            <LinkRow icon={Info} label="How SafeHer works" href="/how-it-works" />
            <LinkRow icon={MapPin} label="Permissions" href="/permissions" />
            <Row icon={Globe} label="Language" value={profile?.language || "English"} />
            <div className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Palette className="size-4" />
                </span>
                <span className="text-sm font-medium">Theme</span>
              </div>
              <ModeToggle />
            </div>
          </SectionCard>
        </FadeIn>

        <FadeIn delay={0.2}>
          <button
            onClick={handleLogoutClick}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive/30 py-3.5 font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-5" />
            Logout
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
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </Card>
  )
}

function Row({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-9 items-center justify-center rounded-xl ${
            accent ? "bg-destructive/10 text-destructive" : "bg-secondary text-primary"
          }`}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="max-w-[50%] truncate text-sm text-muted-foreground">{value}</span>
    </div>
  )
}

function LinkRow({
  icon: Icon,
  label,
  href,
}: {
  icon: LucideIcon
  label: string
  href: string
}) {
  return (
    <Link href={href} className="flex min-h-12 items-center justify-between py-3.5 transition-colors hover:opacity-80">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-4" />
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronRight className="size-4" />
      </div>
    </Link>
  )
}
