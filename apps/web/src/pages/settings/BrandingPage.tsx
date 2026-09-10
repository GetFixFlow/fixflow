import { useState, useRef } from 'react'
import { Upload, Copy, Check } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useBranding, useUpdateBranding } from '@/hooks/useSettings'
import type { BrandingSettings } from '@/api/settings'
import { cn } from '@/lib/utils'

const PRESETS = [
  { name: 'FixFlow Blue', primary: '#2563EB', sidebar: '#1e3a8a', accent: '#3b82f6' },
  { name: 'Forest Green', primary: '#16a34a', sidebar: '#14532d', accent: '#22c55e' },
  { name: 'Corporate Gray', primary: '#475569', sidebar: '#1e293b', accent: '#64748b' },
  { name: 'Navy', primary: '#1e3a5f', sidebar: '#0f2341', accent: '#2563eb' },
  { name: 'Purple', primary: '#7c3aed', sidebar: '#4c1d95', accent: '#a855f7' },
]

const DEFAULT_BRANDING: BrandingSettings = {
  primary_color: '#2563EB',
  sidebar_color: '#1e3a8a',
  accent_color: '#3b82f6',
  login_headline: 'Welcome back',
  login_subtitle: 'Sign in to your FixFlow account',
}

export function BrandingPage() {
  const { user } = useAuthStore()
  const { data: serverBranding, isLoading } = useBranding()
  const updateBranding = useUpdateBranding()

  const [branding, setBranding] = useState<BrandingSettings>({
    ...DEFAULT_BRANDING,
    ...serverBranding,
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const logoRef = useRef<HTMLInputElement>(null)
  const faviconRef = useRef<HTMLInputElement>(null)

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Branding" description="Customize your organization branding" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Access Denied. Only administrators can manage branding.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Branding" description="Customize your organization branding" />
        <Card><CardContent className="p-6 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      </div>
    )
  }

  const handleFileUpload = (type: 'logo' | 'favicon', file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('File must be under 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (type === 'logo') {
        setLogoFile(file)
        setLogoPreview(reader.result as string)
      } else {
        setFaviconFile(file)
        setFaviconPreview(reader.result as string)
      }
    }
    reader.readAsDataURL(file)
  }

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setBranding((prev) => ({
      ...prev,
      primary_color: preset.primary,
      sidebar_color: preset.sidebar,
      accent_color: preset.accent,
    }))
  }

  const copyColor = (color: string) => {
    navigator.clipboard.writeText(color)
    setCopied(color)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSave = () => {
    updateBranding.mutate({
      ...branding,
      ...(logoFile ? { logo: logoFile } : {}),
      ...(faviconFile ? { favicon: faviconFile } : {}),
    })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Branding" description="Customize the look and feel of your FixFlow instance" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: settings */}
        <div className="space-y-6">
          {/* Logo upload */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Logo &amp; Favicon</h3>

              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Logo
                </label>
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-brand-400 transition-colors"
                  onClick={() => logoRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file) handleFileUpload('logo', file)
                  }}
                >
                  {logoPreview ?? (serverBranding?.logo_url) ? (
                    <img
                      src={logoPreview ?? serverBranding?.logo_url}
                      className="h-12 mx-auto object-contain"
                      alt="Logo"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="h-6 w-6 text-gray-400" />
                      <p className="text-xs text-gray-500">Drop logo here or click to upload</p>
                      <p className="text-xs text-gray-400">PNG, SVG, JPG up to 2MB</p>
                    </div>
                  )}
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload('logo', e.target.files[0])}
                  />
                </div>
              </div>

              {/* Favicon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Favicon
                </label>
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-brand-400 transition-colors"
                  onClick={() => faviconRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file) handleFileUpload('favicon', file)
                  }}
                >
                  {faviconPreview ?? serverBranding?.favicon_url ? (
                    <img
                      src={faviconPreview ?? serverBranding?.favicon_url}
                      className="h-8 mx-auto object-contain"
                      alt="Favicon"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="h-5 w-5 text-gray-400" />
                      <p className="text-xs text-gray-500">32×32 ICO, PNG</p>
                    </div>
                  )}
                  <input
                    ref={faviconRef}
                    type="file"
                    accept="image/png,image/x-icon"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload('favicon', e.target.files[0])}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Brand Colors</h3>

              {/* Presets */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Quick Presets</label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-gray-200 dark:border-gray-700 hover:border-brand-400 transition-colors"
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.primary }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color pickers */}
              {(['primary_color', 'sidebar_color', 'accent_color'] as const).map((key) => {
                const labels = {
                  primary_color: 'Primary Color',
                  sidebar_color: 'Sidebar Color',
                  accent_color: 'Accent Color',
                }
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {labels[key]}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding[key]}
                        onChange={(e) => setBranding((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="h-9 w-12 rounded-md border border-gray-300 cursor-pointer p-0.5"
                      />
                      <Input
                        value={branding[key]}
                        onChange={(e) => setBranding((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="font-mono flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => copyColor(branding[key])}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {copied === branding[key] ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Login Page */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Login Page</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Headline
                </label>
                <Input
                  value={branding.login_headline}
                  onChange={(e) => setBranding((prev) => ({ ...prev, login_headline: e.target.value }))}
                  placeholder="Welcome back"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subtitle
                </label>
                <Input
                  value={branding.login_subtitle}
                  onChange={(e) => setBranding((prev) => ({ ...prev, login_subtitle: e.target.value }))}
                  placeholder="Sign in to your account"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Live preview */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500">Live Preview</p>
            </div>
            {/* Mini sidebar preview */}
            <div className="flex h-48 overflow-hidden">
              <div
                className="w-14 flex flex-col items-center pt-3 gap-2"
                style={{ backgroundColor: branding.sidebar_color }}
              >
                {logoPreview || serverBranding?.logo_url ? (
                  <img src={logoPreview ?? serverBranding?.logo_url} className="h-6 w-6 object-contain" alt="Logo" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-white/20" />
                )}
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-1 w-8 rounded-full bg-white/30" />
                ))}
              </div>
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 p-3">
                {/* Mini header */}
                <div
                  className="h-6 rounded-t-md flex items-center px-2 mb-2"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  <div className="h-2 w-16 rounded bg-white/40" />
                </div>
                {/* Mini content */}
                <div className="space-y-1.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: branding.accent_color }} />
                      <div className="h-1.5 flex-1 rounded bg-gray-200 dark:bg-gray-600" />
                    </div>
                  ))}
                </div>
                {/* Mini button */}
                <div className="mt-3">
                  <div
                    className="h-5 w-16 rounded text-white text-[8px] flex items-center justify-center font-medium"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    Button
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Login page preview */}
          <Card className="overflow-hidden">
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500">Login Page Preview</p>
            </div>
            <div
              className="flex items-center justify-center h-40 p-6"
              style={{ background: `linear-gradient(135deg, ${branding.sidebar_color}30, ${branding.primary_color}20)` }}
            >
              <div className="text-center">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {branding.login_headline || 'Welcome back'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {branding.login_subtitle || 'Sign in to your account'}
                </p>
                <div
                  className="mt-3 h-7 w-24 rounded-lg mx-auto flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  Sign In
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateBranding.isPending}>
        {updateBranding.isPending ? 'Saving…' : 'Save Branding'}
      </Button>
    </div>
  )
}
