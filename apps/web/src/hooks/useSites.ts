import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sitesApi, type SiteInput } from '@/api/sites'
import { apiErrorMessage } from '@/lib/apiError'
import { t } from '@/i18n'

export const SITES_KEY = ['sites'] as const

/** The sites this person may see, whether sites are on, and the company's calendar. */
export function useSites(enabled = true) {
  return useQuery({ queryKey: SITES_KEY, queryFn: () => sitesApi.list().then((r) => r.data), enabled, staleTime: 60 * 1000 })
}

/** What a change to the sites touches everywhere: what each person sees, the schedule, the reports. */
function useRefresh() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

export function useEnableSites() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (enabled: boolean) => sitesApi.enable(enabled),
    onSuccess: refresh,
    onError: (error) => toast.error(apiErrorMessage(error, t('sites.save_failed'))),
  })
}

export function useCreateSite() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (site: SiteInput) => sitesApi.create(site),
    onSuccess: () => { refresh(); toast.success(t('sites.toast.created')) },
    onError: (error) => toast.error(apiErrorMessage(error, t('sites.save_failed'))),
  })
}

export function useUpdateSite() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, site }: { id: number; site: SiteInput }) => sitesApi.update(id, site),
    onSuccess: () => { refresh(); toast.success(t('sites.toast.saved')) },
    onError: (error) => toast.error(apiErrorMessage(error, t('sites.save_failed'))),
  })
}

export function useSetSitePeople() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ id, userIds }: { id: number; userIds: number[] }) => sitesApi.setPeople(id, userIds),
    onSuccess: () => { refresh(); toast.success(t('sites.toast.people')) },
    onError: (error) => toast.error(apiErrorMessage(error, t('sites.save_failed'))),
  })
}

/** The sites side by side. */
export function useSitesReport(params: { from?: string; to?: string }) {
  return useQuery({ queryKey: ['reports', 'sites', params], queryFn: () => sitesApi.report(params).then((r) => r.data.data) })
}
