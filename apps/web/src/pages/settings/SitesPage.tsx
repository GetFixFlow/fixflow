import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuthStore } from '@/stores/authStore'
import { useUsers } from '@/hooks/useUsers'
import { useCreateSite, useEnableSites, useSetSitePeople, useSites, useUpdateSite } from '@/hooks/useSites'
import { currentLanguage } from '@/i18n'
import type { Holiday, Site, SiteCalendar, SitesResponse } from '@/api/sites'

const LABEL = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300'
const FIELD = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

const zones = (): string[] => {
  // Newer than the TypeScript library this app is built with, but in every current browser.
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  const known = typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('timeZone') : []
  return known.length > 0 ? known : ['UTC']
}
const weekday = (day: number) => new Intl.DateTimeFormat(currentLanguage(), { weekday: 'short' }).format(new Date(2024, 0, 7 + day))

/** One part of a calendar: it follows the company until the box is unticked, and then has a value of its own. */
function Part({ id, label, same, onSame, sameText, children }: {
  id: string; label: string; same: boolean; onSame: (same: boolean) => void; sameText: string; children: React.ReactNode
}) {
  return (
    <fieldset className="space-y-2">
      <legend className={LABEL}>{label}</legend>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input id={`${id}-same`} type="checkbox" checked={same} onChange={(event) => onSame(event.target.checked)} className="rounded border-gray-300" />
        {sameText}
      </label>
      {!same && children}
    </fieldset>
  )
}

/** A site's calendar: each part follows the company's, or is the site's own. */
function CalendarEditor({ site, company }: { site: Site; company: SitesResponse['company'] }) {
  const { t } = useTranslation()
  const update = useUpdateSite()
  const own = site.settings
  const [zone, setZone] = useState<string | null>(own.timezone ?? null)
  const [hours, setHours] = useState<{ start: string; end: string } | null>(own.work_hours ?? null)
  const [days, setDays] = useState<number[] | null>(own.work_days ?? null)
  const [holidays, setHolidays] = useState<Holiday[] | null>(own.holidays?.length ? own.holidays : null)
  const id = `site-${site.id}`

  const save = () => {
    const settings: SiteCalendar = {}
    if (zone) settings.timezone = zone
    if (hours) settings.work_hours = hours
    if (days) settings.work_days = days
    if (holidays) settings.holidays = holidays
    update.mutate({ id: site.id, site: { settings } })
  }

  const changeHoliday = (index: number, change: Partial<Holiday>) =>
    setHolidays((list) => (list ?? []).map((holiday, at) => (at === index ? { ...holiday, ...change } : holiday)))

  return (
    <div role="group" aria-labelledby={`${id}-calendar`} className="space-y-4">
      <div>
        <h3 id={`${id}-calendar`} className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('sites.card.calendar')}</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">{t('sites.card.calendar_help')}</p>
      </div>

      <Part id={`${id}-zone`} label={t('sites.calendar.timezone')} same={zone === null} onSame={(same) => setZone(same ? null : company.timezone)}
            sameText={t('sites.calendar.same', { value: company.timezone })}>
        <select aria-label={t('sites.calendar.timezone')} value={zone ?? ''} onChange={(event) => setZone(event.target.value)} className={`${FIELD} w-full`}>
          {[...new Set([zone ?? company.timezone, ...zones()])].map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </Part>

      <Part id={`${id}-hours`} label={t('sites.calendar.hours')} same={hours === null} onSame={(same) => setHours(same ? null : { ...company.work_hours })}
            sameText={t('sites.calendar.same', { value: `${company.work_hours.start} – ${company.work_hours.end}` })}>
        <div className="flex items-center gap-2">
          <label className="text-sm">{t('sites.calendar.hours_start')}
            <input type="time" value={hours?.start ?? ''} onChange={(event) => setHours((h) => ({ start: event.target.value, end: h?.end ?? '17:00' }))} className={`${FIELD} ml-1`} />
          </label>
          <label className="text-sm">{t('sites.calendar.hours_end')}
            <input type="time" value={hours?.end ?? ''} onChange={(event) => setHours((h) => ({ start: h?.start ?? '08:00', end: event.target.value }))} className={`${FIELD} ml-1`} />
          </label>
        </div>
      </Part>

      <Part id={`${id}-days`} label={t('sites.calendar.days')} same={days === null} onSame={(same) => setDays(same ? null : [...company.work_days])}
            sameText={t('sites.calendar.same', { value: company.work_days.map(weekday).join(', ') })}>
        <div role="group" aria-label={t('sites.calendar.days')} className="flex flex-wrap gap-3">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <label key={day} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={days?.includes(day) ?? false} className="rounded border-gray-300"
                     onChange={(event) => setDays((list) => (event.target.checked ? [...(list ?? []), day] : (list ?? []).filter((d) => d !== day)).sort())} />
              {weekday(day)}
            </label>
          ))}
        </div>
      </Part>

      <Part id={`${id}-holidays`} label={t('sites.calendar.holidays')} same={holidays === null} onSame={(same) => setHolidays(same ? null : [])}
            sameText={t('sites.calendar.holidays_same', { count: company.holidays.length })}>
        <p className="text-xs text-gray-600 dark:text-gray-400">{t('sites.calendar.holidays_help')}</p>
        {(holidays ?? []).length === 0 && <p className="text-sm text-gray-600 dark:text-gray-400">{t('sites.calendar.holidays_none')}</p>}
        <ul className="space-y-2">
          {(holidays ?? []).map((holiday, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2">
              <input type="date" aria-label={t('sites.calendar.holiday_date')} value={holiday.date} onChange={(event) => changeHoliday(index, { date: event.target.value })} className={FIELD} />
              <input type="text" aria-label={t('sites.calendar.holiday_name')} value={holiday.name} onChange={(event) => changeHoliday(index, { name: event.target.value })} className={`${FIELD} min-w-[8rem] flex-1`} />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={!!holiday.repeating} onChange={(event) => changeHoliday(index, { repeating: event.target.checked })} className="rounded border-gray-300" />
                {t('sites.calendar.holiday_repeats')}
              </label>
              <Button type="button" size="icon" variant="ghost" aria-label={t('sites.calendar.holiday_remove', { name: holiday.name || holiday.date })}
                      onClick={() => setHolidays((list) => (list ?? []).filter((_, at) => at !== index))}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" size="sm" variant="outline" onClick={() => setHolidays((list) => [...(list ?? []), { date: '', name: '', repeating: false }])}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />{t('sites.calendar.holiday_add')}
        </Button>
      </Part>

      <Button type="button" size="sm" onClick={save} disabled={update.isPending}>
        {update.isPending ? t('sites.card.saving') : t('sites.card.save_calendar')}
      </Button>
    </div>
  )
}

/** Who works at a site: anyone but an administrator, who works at every site. */
function PeopleEditor({ site }: { site: Site }) {
  const { t } = useTranslation()
  const save = useSetSitePeople()
  const { data: users } = useUsers({ per_page: 200 })
  const people = (users ?? []).filter((user) => user.role !== 'admin' && user.active !== false)
  const [chosen, setChosen] = useState<number[]>(() => site.people.map((person) => person.id))
  const id = `site-${site.id}`

  return (
    <div role="group" aria-labelledby={`${id}-people`} className="space-y-2">
      <div>
        <h3 id={`${id}-people`} className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('sites.card.people')}</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">{t('sites.card.people_help')}</p>
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('sites.card.no_people')}</p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {people.map((person) => (
            <li key={person.id}>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                <input type="checkbox" checked={chosen.includes(person.id)} className="rounded border-gray-300"
                       onChange={(event) => setChosen((list) => (event.target.checked ? [...list, person.id] : list.filter((one) => one !== person.id)))} />
                {person.full_name} <span className="text-xs text-gray-500 dark:text-gray-400">({person.role})</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" size="sm" onClick={() => save.mutate({ id: site.id, userIds: chosen })} disabled={save.isPending}>
        {save.isPending ? t('sites.card.saving') : t('sites.card.save_people')}
      </Button>
    </div>
  )
}

function SiteCard({ site, company }: { site: Site; company: SitesResponse['company'] }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="space-y-5 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            <Building2 className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            {site.name}
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('sites.card.stats', { assets: site.assets, open: site.open_work_orders, places: site.places })}</p>
        </div>
        <CalendarEditor site={site} company={company} />
        <PeopleEditor site={site} />
      </CardContent>
    </Card>
  )
}

/** Settings, Sites (administrators): switch several sites on, add them, give each its calendar, and say who works where. */
export function SitesPage() {
  const { t } = useTranslation()
  const admin = useAuthStore((state) => state.user?.role) === 'admin'
  const { data, isLoading, isError, refetch } = useSites(admin)
  const enable = useEnableSites()
  const create = useCreateSite()
  const [name, setName] = useState('')

  if (!admin) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('sites.page.title')} description={t('sites.page.description')} />
        <Card><CardContent className="p-8 text-center"><p className="text-gray-600 dark:text-gray-400">{t('sites.page.denied')}</p></CardContent></Card>
      </div>
    )
  }

  const toggle = (on: boolean) => {
    if (window.confirm(t(on ? 'sites.enable.confirm_on' : 'sites.enable.confirm_off'))) enable.mutate(on)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t('sites.page.title')} description={t('sites.page.description')} />

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError || !data ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p role="alert" className="text-sm text-gray-700 dark:text-gray-300">{t('sites.page.load_failed')}</p>
            <Button variant="outline" onClick={() => refetch()}>{t('sites.page.try_again')}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-2 p-4">
              <label className="flex items-center gap-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                <input id="sites-enabled" type="checkbox" checked={data.enabled} disabled={enable.isPending} aria-describedby="sites-enabled-help"
                       onChange={(event) => toggle(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                {t('sites.enable.label')}
              </label>
              <p id="sites-enabled-help" className="text-xs text-gray-600 dark:text-gray-400">{t('sites.enable.help')}</p>
              <p role="status" className="text-xs font-medium text-gray-800 dark:text-gray-200">{t(data.enabled ? 'sites.enable.on_note' : 'sites.enable.off_note')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{t('sites.add.title')}</h2>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => { event.preventDefault(); create.mutate({ name: name.trim() }, { onSuccess: () => setName('') }) }}
              >
                <div className="min-w-[14rem] flex-1">
                  <label htmlFor="site-name" className={LABEL}>{t('sites.add.name')}</label>
                  <Input id="site-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
                </div>
                <Button type="submit" disabled={name.trim().length === 0 || create.isPending}>
                  {create.isPending ? t('sites.add.adding') : t('sites.add.button')}
                </Button>
              </form>
            </CardContent>
          </Card>

          {data.sites.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('sites.add.none')}</p>
          ) : (
            data.sites.map((site) => <SiteCard key={site.id} site={site} company={data.company} />)
          )}
        </>
      )}
    </div>
  )
}
