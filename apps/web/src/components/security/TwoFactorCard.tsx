import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useTranslation } from 'react-i18next'
import { Check, Copy, Download, Shield, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import {
  twoFactorMessage,
  useConfirmTwoFactor,
  useDisableTwoFactor,
  useNewRecoveryCodes,
  useStartTwoFactor,
  useTwoFactorStatus,
} from '@/hooks/useTwoFactor'
import type { TwoFactorSetup } from '@/api/twoFactor'
import { t as translate } from '@/i18n'

/** The QR code of a secret, drawn here: the secret never goes to a service that makes pictures. */
function SetupQr({ uri }: { uri: string }) {
  const { t } = useTranslation()
  const [src, setSrc] = useState('')
  useEffect(() => {
    let current = true
    QRCode.toDataURL(uri, { margin: 1, width: 192 }).then((url) => current && setSrc(url)).catch(() => current && setSrc(''))
    return () => { current = false }
  }, [uri])
  return src ? <img src={src} alt={t('security.two_factor.qr_alt')} className="h-48 w-48 rounded bg-white p-1" /> : <div className="h-48 w-48" />
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const text = codes.join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false) // the codes are on the screen to copy by hand
    }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${translate('security.two_factor.codes_file')}\n\n${text}\n`], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'fixflow-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3" role="region" aria-label={t('security.two_factor.codes_region')}>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('security.two_factor.save_codes')}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('security.two_factor.codes_help')}
      </p>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-gray-50 p-3 font-mono text-sm dark:bg-gray-800">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}{copied ? t('security.two_factor.copied') : t('security.two_factor.copy')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}><Download className="mr-1 h-4 w-4" />{t('common.actions.download')}</Button>
        <Button type="button" size="sm" onClick={onDone}>{t('security.two_factor.saved_them')}</Button>
      </div>
    </div>
  )
}

/** Asks for the password and a current code, for the two things that weaken or renew the protection. */
function ProveItsYou({ action, busy, error, onSubmit, onCancel }: {
  action: string; busy: boolean; error: string | null; onSubmit: (password: string, code: string) => void; onCancel: () => void
}) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800"
      onSubmit={(event) => { event.preventDefault(); onSubmit(password, code) }}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('security.two_factor.prove', { action })}</p>
      <Input id="tf-password" type="password" label={t('auth.password')} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input id="tf-code" label={t('auth.login.code')} inputMode="text" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy} disabled={!password || !code}>{t('common.actions.confirm')}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>{t('common.actions.cancel')}</Button>
      </div>
    </form>
  )
}

type Step = 'idle' | 'setup' | 'codes' | 'turn-off' | 'new-codes'

/**
 * Two-factor sign-in with an authenticator app: where a person switches it on (scan a QR code, enter the first code,
 * keep the recovery codes), turns it off, or gets new recovery codes. `onEnabled` is called once it is on and the
 * recovery codes have been saved.
 */
export function TwoFactorCard({ onEnabled }: { onEnabled?: () => void }) {
  const { t } = useTranslation()
  const { data: status, isLoading, isError } = useTwoFactorStatus()
  const start = useStartTwoFactor()
  const confirm = useConfirmTwoFactor()
  const disable = useDisableTwoFactor()
  const renew = useNewRecoveryCodes()

  const [step, setStep] = useState<Step>('idle')
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [problem, setProblem] = useState<string | null>(null)

  const begin = () => {
    setProblem(null)
    setCode('')
    start.mutate(undefined, {
      onSuccess: (details) => { setSetup(details); setStep('setup') },
      onError: (error) => setProblem(twoFactorMessage(error, t('security.two_factor.start_failed'))),
    })
  }

  const finishSetup = () => {
    setProblem(null)
    confirm.mutate(code, {
      onSuccess: (result) => { setCodes(result.recovery_codes); setSetup(null); setStep('codes') },
      onError: (error) => setProblem(twoFactorMessage(error, t('security.two_factor.code_wrong'))),
    })
  }

  const turnOff = (password: string, answer: string) => {
    setProblem(null)
    disable.mutate({ password, code: answer }, {
      onSuccess: () => setStep('idle'),
      onError: (error) => setProblem(twoFactorMessage(error, t('security.two_factor.turn_off_failed'))),
    })
  }

  const newCodes = (password: string, answer: string) => {
    setProblem(null)
    renew.mutate({ password, code: answer }, {
      onSuccess: (result) => { setCodes(result.recovery_codes); setStep('codes') },
      onError: (error) => setProblem(twoFactorMessage(error, t('security.two_factor.new_codes_failed'))),
    })
  }

  const enabled = status?.enabled ?? false

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {enabled ? <ShieldCheck className="mt-0.5 h-5 w-5 text-green-600" /> : <Shield className="mt-0.5 h-5 w-5 text-gray-400" />}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('security.two_factor.title')}</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                {t('security.two_factor.intro')}
              </p>
              {isLoading && <p className="mt-1.5 text-xs text-gray-500">{t('shell.loading')}</p>}
              {isError && <p role="alert" className="mt-1.5 text-xs text-red-600">{t('security.two_factor.load_failed')}</p>}
              {status && (
                <p role="status" className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-xs ${enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {enabled ? t('security.two_factor.on', { count: status.recovery_codes_left }) : t('security.two_factor.off')}
                </p>
              )}
              {status?.required_by_company && (
                <p className="mt-1.5 text-xs text-gray-500">{t('security.two_factor.required')}</p>
              )}
            </div>
          </div>
          {status && step === 'idle' && !enabled && (
            <Button size="sm" onClick={begin} loading={start.isPending}>{t('security.two_factor.set_up')}</Button>
          )}
        </div>

        {problem && step === 'idle' && <p role="alert" className="text-sm text-red-600">{problem}</p>}

        {step === 'setup' && setup && (
          <form
            className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800"
            onSubmit={(event) => { event.preventDefault(); finishSetup() }}
          >
            <ol className="list-inside list-decimal space-y-1 text-gray-600 dark:text-gray-400">
              <li>{t('security.two_factor.step_scan')}</li>
              <li>{t('security.two_factor.step_code')}</li>
            </ol>
            <div className="flex flex-wrap items-center gap-4">
              <SetupQr uri={setup.otpauth_uri} />
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-gray-500">{t('security.two_factor.cannot_scan')}</p>
                <code className="block break-all rounded bg-white px-2 py-1 font-mono text-xs dark:bg-gray-900">{setup.secret}</code>
              </div>
            </div>
            <Input
              id="tf-first-code"
              label={t('security.two_factor.app_code')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={confirm.isPending} disabled={code.replace(/\s/g, '').length !== 6}>{t('security.two_factor.turn_on')}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setStep('idle'); setSetup(null); setProblem(null) }}>{t('common.actions.cancel')}</Button>
            </div>
          </form>
        )}

        {step === 'codes' && (
          <RecoveryCodes codes={codes} onDone={() => { setCodes([]); setStep('idle'); onEnabled?.() }} />
        )}

        {enabled && step === 'idle' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { setProblem(null); setStep('new-codes') }}>{t('security.two_factor.new_codes')}</Button>
            {!status?.required_by_company && (
              <Button variant="outline" size="sm" onClick={() => { setProblem(null); setStep('turn-off') }}>{t('security.two_factor.turn_off')}</Button>
            )}
          </div>
        )}

        {step === 'turn-off' && (
          <ProveItsYou action={t('security.two_factor.action_off')} busy={disable.isPending} error={problem} onSubmit={turnOff}
            onCancel={() => { setStep('idle'); setProblem(null) }} />
        )}
        {step === 'new-codes' && (
          <ProveItsYou action={t('security.two_factor.action_new_codes')} busy={renew.isPending} error={problem} onSubmit={newCodes}
            onCancel={() => { setStep('idle'); setProblem(null) }} />
        )}
      </CardContent>
    </Card>
  )
}
