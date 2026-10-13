import { useState, useRef, useEffect } from 'react'
import { Upload, Trash2, AlertCircle, Zap } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useBranding, useUpdateBranding } from '@/hooks/useSettings'
import { applyBrandColor, brandRamp, contrastWithWhite, isHexColor, MIN_CONTRAST_WITH_WHITE } from '@/lib/brandColors'
import type { BrandingSettings } from '@/api/settings'

const PRESETS = [
  { name: 'FixFlow Blue', color: '#2563eb' },
  { name: 'Forest Green', color: '#15803d' },
  { name: 'Corporate Gray', color: '#475569' },
  { name: 'Navy', color: '#1e3a5f' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Crimson', color: '#be123c' },
]

const IMAGE_LIMITS = {
  logo: { bytes: 2 * 1024 * 1024, label: '2 MB', types: ['image/png', 'image/jpeg', 'image/webp'], hint: 'PNG, JPEG or WebP, up to 2 MB', allowed: 'a PNG, JPEG or WebP image' },
  favicon: { bytes: 512 * 1024, label: '512 KB', types: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/webp'], hint: 'PNG or ICO, up to 512 KB', allowed: 'a PNG, ICO or WebP image' },
} as const

type Kind = 'logo' | 'favicon'

function BrandingForm({ saved }: { saved: BrandingSettings }) {
  const update = useUpdateBranding()
  const [color, setColor] = useState(saved.primary_color)
  const [headline, setHeadline] = useState(saved.login_headline)
  const [subtitle, setSubtitle] = useState(saved.login_subtitle)
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({})
  const [previews, setPreviews] = useState<Partial<Record<Kind, string>>>({})
  const [removed, setRemoved] = useState<Partial<Record<Kind, boolean>>>({})
  const [error, setError] = useState<string>()
  const inputs = { logo: useRef<HTMLInputElement>(null), favicon: useRef<HTMLInputElement>(null) }

  // Show the colour on the real app as it is picked; put the saved one back if the page is left unsaved.
  useEffect(() => {
    if (isHexColor(color) && contrastWithWhite(color) >= MIN_CONTRAST_WITH_WHITE) applyBrandColor(color)
    return () => applyBrandColor(saved.primary_color)
  }, [color, saved.primary_color])

  useEffect(() => () => Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u)), [previews])

  const contrast = isHexColor(color) ? contrastWithWhite(color) : 0
  const colorProblem = !isHexColor(color)
    ? 'Enter a colour like #2563eb.'
    : contrast < MIN_CONTRAST_WITH_WHITE
      ? 'This colour is too light for white text to be readable on it. Choose a darker one.'
      : null
  const textProblem = headline.trim().length < 1 || headline.length > 80 ? 'The headline must be 1 to 80 characters.' : subtitle.length > 160 ? 'The subtitle must be 160 characters or fewer.' : null
  const problem = colorProblem ?? textProblem

  const choose = (kind: Kind, file: File) => {
    const limit = IMAGE_LIMITS[kind]
    if (!(limit.types as readonly string[]).includes(file.type)) return setError(`The ${kind} must be ${limit.allowed}.`)
    if (file.size > limit.bytes) return setError(`The ${kind} must be ${limit.label} or smaller.`)
    setError(undefined)
    setFiles((f) => ({ ...f, [kind]: file }))
    setPreviews((p) => ({ ...p, [kind]: URL.createObjectURL(file) }))
    setRemoved((r) => ({ ...r, [kind]: false }))
  }

  const clear = (kind: Kind) => {
    setFiles((f) => ({ ...f, [kind]: undefined }))
    setPreviews((p) => ({ ...p, [kind]: undefined }))
    setRemoved((r) => ({ ...r, [kind]: true }))
  }

  const shown = (kind: Kind) => previews[kind] ?? (removed[kind] ? null : saved[`${kind}_url`])

  const save = () =>
    update.mutate(
      {
        primary_color: color.toLowerCase(), login_headline: headline.trim(), login_subtitle: subtitle.trim(),
        logo: files.logo, favicon: files.favicon,
        remove_logo: removed.logo && !files.logo, remove_favicon: removed.favicon && !files.favicon,
      },
      { onSuccess: () => { setFiles({}); setPreviews({}); setRemoved({}) } },
    )

  const picker = (kind: Kind, title: string) => {
    const url = shown(kind)
    return (
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{title}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Choose ${kind}`}
            onClick={() => inputs[kind].current?.click()}
            className="flex h-16 w-28 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-brand-400 dark:border-gray-600"
          >
            {url ? <img src={url} alt={title} className="max-h-12 max-w-24 object-contain" /> : <Upload className="h-5 w-5 text-gray-400" />}
          </button>
          <div className="text-xs text-gray-500">
            <p>{IMAGE_LIMITS[kind].hint}</p>
            {url && (
              <button type="button" onClick={() => clear(kind)} className="mt-1 flex items-center gap-1 text-red-600 hover:underline">
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
          <input
            ref={inputs[kind]}
            type="file"
            aria-label={`${title} file`}
            accept={IMAGE_LIMITS[kind].types.join(',')}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) choose(kind, f); e.target.value = '' }}
          />
        </div>
      </div>
    )
  }

  const ramp = isHexColor(color) ? brandRamp(color) : null

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader title="Branding" description="Your logo, colour and sign-in page. Changes apply to everyone." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-5 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Logo and favicon</h3>
              {picker('logo', 'Logo')}
              {picker('favicon', 'Favicon (the small icon in the browser tab)')}
              {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Colour</h3>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setColor(p.color)}
                    aria-label={p.name}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:border-brand-400 ${
                      color.toLowerCase() === p.color ? 'border-gray-900 dark:border-gray-100' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick a colour"
                  value={isHexColor(color) ? color : '#2563eb'}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-gray-300 p-0.5"
                />
                <Input aria-label="Colour" value={color} onChange={(e) => setColor(e.target.value)} className="flex-1 font-mono" />
              </div>
              {colorProblem ? (
                <p role="alert" className="flex items-start gap-1.5 text-xs text-red-600"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{colorProblem}</p>
              ) : (
                <p className="text-xs text-gray-500">Used for buttons, links and highlights across the app. White text on it has a contrast of {contrast.toFixed(1)}:1.</p>
              )}
              {ramp && (
                <div className="flex overflow-hidden rounded-md" aria-hidden>
                  {Object.entries(ramp).map(([step, rgb]) => <div key={step} className="h-4 flex-1" style={{ backgroundColor: `rgb(${rgb})` }} />)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Sign-in page</h3>
              <Input id="login-headline" label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} />
              <Input id="login-subtitle" label="Subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={160} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-100 px-4 py-2 dark:border-gray-600 dark:bg-gray-700">
              <p className="text-xs font-medium text-gray-500">Sign-in page preview</p>
            </div>
            <div className="flex flex-col items-center bg-gray-50 p-6 text-center dark:bg-gray-800">
              {shown('logo') ? (
                <img src={shown('logo')!} alt="" className="mb-3 h-10 max-w-40 object-contain" />
              ) : (
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600"><Zap className="h-5 w-5 text-white" /></div>
              )}
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{headline || ' '}</h2>
              <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
              <div className="mt-4 rounded-md bg-brand-600 px-6 py-2 text-sm font-medium text-white">Sign in</div>
            </div>
          </Card>
          <p className="text-xs text-gray-500">The colour is also shown on this page as you pick it. Leave without saving and it goes back.</p>
        </div>
      </div>

      <Button onClick={save} disabled={update.isPending || !!problem}>
        {update.isPending ? 'Saving…' : 'Save branding'}
      </Button>
      {problem && <p className="text-xs text-red-600">{problem}</p>}
    </div>
  )
}

export function BrandingPage() {
  const { user } = useAuthStore()
  const { data, isLoading, isError, refetch } = useBranding()

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Branding" description="Customize your organization branding" />
        <Card><CardContent className="p-8 text-center"><p className="text-gray-500">Access Denied. Only administrators can manage branding.</p></CardContent></Card>
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Branding" description="Customize your organization branding" />
        <Card><CardContent className="space-y-3 p-6">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Branding" description="Customize your organization branding" />
        <Card><CardContent className="space-y-3 p-8 text-center">
          <p className="text-sm text-gray-700 dark:text-gray-300">The branding settings could not be loaded.</p>
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </CardContent></Card>
      </div>
    )
  }
  // Keyed on what is saved, so the form starts again from the server's answer after a save.
  return <BrandingForm key={`${data.primary_color}|${data.logo_url}|${data.favicon_url}|${data.login_headline}|${data.login_subtitle}`} saved={data} />
}
