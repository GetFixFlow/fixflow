import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft, Plus, Trash2, ClipboardList, BarChart2, Wrench, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress'
import { useAuthStore } from '@/stores/authStore'
import { useOnboarding } from '@/hooks/useOnboarding'
import { cn } from '@/lib/utils'

const TOTAL_STEPS = 6
const STEP_LABELS = ['Welcome', 'Organization', 'Locations', 'Asset', 'Team', 'Done']

const INDUSTRIES = ['Manufacturing', 'Facilities', 'Healthcare', 'Education', 'Property', 'Municipal', 'Other']
const SIZES = ['1-10', '11-50', '51-200', '201-500', '500+']
const ASSET_TYPES = ['Equipment', 'Vehicle', 'Facility', 'Tool']
const LOCATION_TYPES = ['Building', 'Floor', 'Room', 'Outdoor', 'Zone', 'Site']
const ROLES = ['admin', 'manager', 'technician', 'requester']

function Step1Welcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex items-center justify-center h-16 w-16 bg-brand-100 dark:bg-brand-900/30 rounded-full mx-auto">
        <Wrench className="h-8 w-8 text-brand-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to FixFlow! 👋</h1>
        <p className="text-gray-500 mt-2 text-sm">
          FixFlow is your all-in-one Computerized Maintenance Management System.
          Let's get your organization set up in just a few minutes.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-left">
        {[
          { icon: ClipboardList, title: 'Work Orders', desc: 'Track and manage maintenance tasks' },
          { icon: BarChart2, title: 'PM Schedules', desc: 'Never miss preventive maintenance' },
          { icon: QrCode, title: 'Asset Tracking', desc: 'QR codes for every asset' },
          { icon: Wrench, title: 'IoT Monitoring', desc: 'Real-time sensor alerts' },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <item.icon className="h-5 w-5 text-brand-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Button className="w-full" onClick={onNext}>
        Start Setup <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
      <button type="button" onClick={onSkip} className="text-sm text-gray-400 hover:text-gray-600">
        I'll set up later →
      </button>
    </div>
  )
}

function Step2Organization({
  data,
  onNext,
  onBack,
  onUpdate,
}: {
  data: { name?: string; industry?: string; size?: string }
  onNext: () => void
  onBack: () => void
  onUpdate: (d: typeof data) => void
}) {
  const [local, setLocal] = useState(data)

  const handleNext = () => {
    if (!local.name) return
    onUpdate(local)
    onNext()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tell us about your organization</h2>
        <p className="text-sm text-gray-400 mt-1">This helps us tailor FixFlow to your needs.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Organization Name *
          </label>
          <Input
            value={local.name ?? ''}
            onChange={(e) => setLocal((l) => ({ ...l, name: e.target.value }))}
            placeholder="Acme Manufacturing"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Industry</label>
          <select
            value={local.industry ?? ''}
            onChange={(e) => setLocal((l) => ({ ...l, industry: e.target.value }))}
            className="h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm"
          >
            <option value="">Select industry</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Size</label>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setLocal((l) => ({ ...l, size: s }))}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm border transition-colors',
                  local.size === s
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button className="flex-1" onClick={handleNext} disabled={!local.name}>
          Continue <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function Step3Locations({
  data,
  onNext,
  onBack,
  onSkip,
  onUpdate,
}: {
  data: { name: string; type: string }[]
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onUpdate: (d: typeof data) => void
}) {
  const [locations, setLocations] = useState(data.length > 0 ? data : [{ name: '', type: 'Building' }])

  const handleNext = () => {
    const valid = locations.filter((l) => l.name)
    onUpdate(valid)
    onNext()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Add your first location</h2>
        <p className="text-sm text-gray-400 mt-1">
          Locations help you organize assets and work orders. You can add more later.
        </p>
      </div>
      <div className="space-y-2">
        {locations.map((loc, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={loc.name}
              onChange={(e) => setLocations((prev) => prev.map((l, idx) => idx === i ? { ...l, name: e.target.value } : l))}
              placeholder="e.g. Main Plant, Building A"
              className="flex-1"
            />
            <select
              value={loc.type}
              onChange={(e) => setLocations((prev) => prev.map((l, idx) => idx === i ? { ...l, type: e.target.value } : l))}
              className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm"
            >
              {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {locations.length > 1 && (
              <button
                type="button"
                onClick={() => setLocations((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLocations((prev) => [...prev, { name: '', type: 'Building' }])}
          className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700"
        >
          <Plus className="h-4 w-4" /> Add Another Location
        </button>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
        <Button className="flex-1" onClick={handleNext}>
          Continue <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function Step4Asset({
  data,
  onNext,
  onBack,
  onSkip,
  onUpdate,
}: {
  data: { name?: string; type?: string } | undefined
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onUpdate: (d: { name: string; type: string }) => void
}) {
  const [local, setLocal] = useState(data ?? { name: '', type: 'Equipment' })

  const handleNext = () => {
    onUpdate(local as { name: string; type: string })
    onNext()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Add your first asset</h2>
        <p className="text-sm text-gray-400 mt-1">
          Assets are the equipment you maintain. You can bulk-import assets later.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Name *</label>
          <Input
            value={local.name}
            onChange={(e) => setLocal((l) => ({ ...l, name: e.target.value }))}
            placeholder="e.g. Air Compressor #1, Forklift A"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Asset Type</label>
          <div className="grid grid-cols-2 gap-2">
            {ASSET_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setLocal((l) => ({ ...l, type }))}
                className={cn(
                  'py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors text-left',
                  local.type === type
                    ? 'bg-brand-50 border-brand-400 text-brand-700 dark:bg-brand-900/30 dark:border-brand-500'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
        <Button className="flex-1" onClick={handleNext} disabled={!local.name}>
          Add Asset <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function Step5Invites({
  data,
  onNext,
  onBack,
  onSkip,
  onUpdate,
}: {
  data: { email: string; role: string }[]
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onUpdate: (d: typeof data) => void
}) {
  const [invites, setInvites] = useState(data.length > 0 ? data : [{ email: '', role: 'technician' }])

  const handleNext = () => {
    const valid = invites.filter((i) => i.email)
    onUpdate(valid)
    onNext()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Invite your team</h2>
        <p className="text-sm text-gray-400 mt-1">
          Invite colleagues to FixFlow. They'll receive a welcome email to set their password.
        </p>
      </div>
      <div className="space-y-2">
        {invites.map((invite, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="email"
              value={invite.email}
              onChange={(e) => setInvites((prev) => prev.map((iv, idx) => idx === i ? { ...iv, email: e.target.value } : iv))}
              placeholder="colleague@company.com"
              className="flex-1"
            />
            <select
              value={invite.role}
              onChange={(e) => setInvites((prev) => prev.map((iv, idx) => idx === i ? { ...iv, role: e.target.value } : iv))}
              className="h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm capitalize"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {invites.length > 1 && (
              <button
                type="button"
                onClick={() => setInvites((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setInvites((prev) => [...prev, { email: '', role: 'technician' }])}
          className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700"
        >
          <Plus className="h-4 w-4" /> Add Another Person
        </button>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
        <Button className="flex-1" onClick={handleNext}>
          Send Invites <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

function Step6Complete({ onFinish }: { onFinish: () => void }) {
  const navigate = useNavigate()

  const quickLinks = [
    { icon: ClipboardList, label: 'Create Work Order', href: '/work-orders/new' },
    { icon: Wrench, label: 'Add Asset', href: '/assets/new' },
    { icon: BarChart2, label: 'Setup PM Schedule', href: '/preventive-maintenance/new' },
    { icon: QrCode, label: 'Scan QR Code', href: '/assets/scan' },
  ]

  const handleFinish = () => {
    onFinish()
    navigate('/dashboard')
  }

  return (
    <div className="text-center space-y-6">
      <div className="flex items-center justify-center h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto">
        <span className="text-3xl">🎉</span>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">FixFlow is ready!</h2>
        <p className="text-sm text-gray-400 mt-2">
          Your organization is set up and ready to go. Here's what you can do next:
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {quickLinks.map((link) => (
          <button
            key={link.label}
            type="button"
            onClick={() => { onFinish(); navigate(link.href) }}
            className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors text-left"
          >
            <link.icon className="h-5 w-5 text-brand-500 shrink-0" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{link.label}</span>
          </button>
        ))}
      </div>
      <Button className="w-full" onClick={handleFinish}>
        Go to Dashboard <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const ob = useOnboarding()

  const handleSkip = () => {
    ob.complete()
    navigate('/dashboard')
  }

  const stepProps = {
    onNext: ob.nextStep,
    onBack: ob.prevStep,
    onSkip: () => { ob.nextStep() },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-gray-100">FixFlow</span>
          </div>
          {ob.step < 6 && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Skip setup
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="mb-6">
          <OnboardingProgress
            currentStep={ob.step}
            totalSteps={TOTAL_STEPS}
            labels={STEP_LABELS}
          />
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6">
          {ob.step === 1 && (
            <Step1Welcome onNext={ob.nextStep} onSkip={handleSkip} />
          )}
          {ob.step === 2 && (
            <Step2Organization
              data={ob.data.org ?? {}}
              onNext={ob.nextStep}
              onBack={ob.prevStep}
              onUpdate={(d) => ob.updateData({ org: d as { name: string; industry: string; size: string } })}
            />
          )}
          {ob.step === 3 && (
            <Step3Locations
              data={ob.data.locations ?? []}
              onNext={ob.nextStep}
              onBack={ob.prevStep}
              onSkip={ob.nextStep}
              onUpdate={(d) => ob.updateData({ locations: d })}
            />
          )}
          {ob.step === 4 && (
            <Step4Asset
              data={ob.data.asset}
              onNext={ob.nextStep}
              onBack={ob.prevStep}
              onSkip={ob.nextStep}
              onUpdate={(d) => ob.updateData({ asset: d })}
            />
          )}
          {ob.step === 5 && (
            <Step5Invites
              data={ob.data.invites ?? []}
              onNext={ob.nextStep}
              onBack={ob.prevStep}
              onSkip={ob.nextStep}
              onUpdate={(d) => ob.updateData({ invites: d })}
            />
          )}
          {ob.step === 6 && (
            <Step6Complete onFinish={ob.complete} />
          )}
        </div>

        {/* Step counter */}
        {ob.step < 6 && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Step {ob.step} of {TOTAL_STEPS}
          </p>
        )}
      </div>
    </div>
  )
}
