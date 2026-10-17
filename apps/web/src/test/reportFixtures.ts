// The report responses the server's spec/contracts/report_shapes_spec.rb pins, typed as the screens read them: if
// the JSON stops fitting the type, `tsc` fails here, and if the server stops sending the JSON's shape, its spec fails.
import { http, HttpResponse } from 'msw'
import { server } from './server'
import type {
  AssetHealth, AssetHistory, BacklogReport, CostByAsset, CostSummary, IotAlertsReport, IotRuleEffectiveness, MttrReport,
  PmCompliance, PmForecast, WorkOrderSummary,
} from '@/types/reports'
import type { TechnicianStats } from '@/components/reports/TechnicianScorecard'
import type { DashboardStats, RequesterDashboardStats, TechnicianDashboardStats } from '@/types'
import workOrdersSummary from './fixtures/reports/work_orders_summary.json'
import workOrdersMttr from './fixtures/reports/work_orders_mttr.json'
import workOrdersBacklog from './fixtures/reports/work_orders_backlog.json'
import technicianPerformance from './fixtures/reports/technician_performance.json'
import assetsHealth from './fixtures/reports/assets_health.json'
import assetsHistory from './fixtures/reports/assets_history.json'
import costsSummary from './fixtures/reports/costs_summary.json'
import costsByAsset from './fixtures/reports/costs_by_asset.json'
import pmCompliance from './fixtures/reports/pm_compliance.json'
import pmForecast from './fixtures/reports/pm_forecast.json'
import iotAlerts from './fixtures/reports/iot_alerts.json'
import iotRuleEffectiveness from './fixtures/reports/iot_rule_effectiveness.json'
import dashboardFull from './fixtures/reports/dashboard_full.json'
import dashboardTechnician from './fixtures/reports/dashboard_technician.json'
import dashboardRequester from './fixtures/reports/dashboard_requester.json'

export const fixtures: {
  workOrderSummary: WorkOrderSummary
  mttr: MttrReport
  backlog: BacklogReport
  technicians: { technicians: TechnicianStats[] }
  assetHealth: AssetHealth
  assetHistory: AssetHistory
  costSummary: CostSummary
  costByAsset: CostByAsset
  pmCompliance: PmCompliance
  pmForecast: PmForecast
  iotAlerts: IotAlertsReport
  iotRules: IotRuleEffectiveness
  dashboardFull: DashboardStats
  dashboardTechnician: TechnicianDashboardStats
  dashboardRequester: RequesterDashboardStats
} = {
  workOrderSummary: workOrdersSummary,
  mttr: workOrdersMttr,
  backlog: workOrdersBacklog,
  technicians: technicianPerformance,
  assetHealth: assetsHealth,
  assetHistory: assetsHistory,
  costSummary: costsSummary,
  costByAsset: costsByAsset,
  pmCompliance,
  pmForecast,
  iotAlerts,
  iotRules: iotRuleEffectiveness,
  dashboardFull,
  dashboardTechnician,
  dashboardRequester,
}

const routes: [string, unknown][] = [
  ['/api/v1/reports/work_orders/summary', fixtures.workOrderSummary],
  ['/api/v1/reports/work_orders/mttr', fixtures.mttr],
  ['/api/v1/reports/work_orders/backlog', fixtures.backlog],
  ['/api/v1/reports/work_orders/technician_performance', fixtures.technicians],
  ['/api/v1/reports/assets/health', fixtures.assetHealth],
  ['/api/v1/reports/costs/summary', fixtures.costSummary],
  ['/api/v1/reports/costs/by_asset', fixtures.costByAsset],
  ['/api/v1/reports/assets/:id/history', fixtures.assetHistory],
  ['/api/v1/reports/pm/compliance', fixtures.pmCompliance],
  ['/api/v1/reports/pm/schedule_forecast', fixtures.pmForecast],
  ['/api/v1/reports/iot/alerts', fixtures.iotAlerts],
  ['/api/v1/reports/iot/rule_effectiveness', fixtures.iotRules],
]

/** Serve the fixtures as the server would; returns the URLs asked for, so a test can see what was sent. */
export function serveReportFixtures(): URL[] {
  const asked: URL[] = []
  server.use(...routes.map(([path, body]) => http.get(path, ({ request }) => {
    asked.push(new URL(request.url))
    return HttpResponse.json(body as Record<string, unknown>)
  })))
  return asked
}

/** The number a KPI card shows under its title (text, as shown), once the card has loaded. */
export async function kpiValue(screen: { findAllByText: (text: string) => Promise<HTMLElement[]> }, title: string): Promise<string> {
  const titles = await screen.findAllByText(title)
  const value = titles.map((heading) => heading.nextElementSibling).find((next) => next?.classList.contains('tabular-nums'))
  if (!value) throw new Error(`No KPI card titled "${title}"`)
  return value.textContent ?? ''
}
