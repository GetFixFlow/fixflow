import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { PageLoader } from '@/components/shared/PageLoader'

// Eagerly-loaded pages (above-the-fold / entry points)
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Lazy-loaded main pages
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const AssetsListPage = lazy(() => import('@/pages/assets/AssetsListPage').then(m => ({ default: m.AssetsListPage })))
const AssetCreatePage = lazy(() => import('@/pages/assets/AssetCreatePage').then(m => ({ default: m.AssetCreatePage })))
const AssetDetailPage = lazy(() => import('@/pages/assets/AssetDetailPage').then(m => ({ default: m.AssetDetailPage })))
const AssetEditPage = lazy(() => import('@/pages/assets/AssetEditPage').then(m => ({ default: m.AssetEditPage })))
const AssetImportPage = lazy(() => import('@/pages/assets/AssetImportPage').then(m => ({ default: m.AssetImportPage })))
const QRLabelPrintPage = lazy(() => import('@/pages/assets/QRLabelPrintPage').then(m => ({ default: m.QRLabelPrintPage })))
const QRScannerPage = lazy(() => import('@/pages/assets/QRScannerPage').then(m => ({ default: m.QRScannerPage })))
const LocationsPage = lazy(() => import('@/pages/assets/LocationsPage').then(m => ({ default: m.LocationsPage })))
const WorkOrdersListPage = lazy(() => import('@/pages/work-orders/WorkOrdersListPage').then(m => ({ default: m.WorkOrdersListPage })))
const WorkOrderCreatePage = lazy(() => import('@/pages/work-orders/WorkOrderCreatePage').then(m => ({ default: m.WorkOrderCreatePage })))
const WorkOrderDetailPage = lazy(() => import('@/pages/work-orders/WorkOrderDetailPage').then(m => ({ default: m.WorkOrderDetailPage })))
const WorkOrderEditPage = lazy(() => import('@/pages/work-orders/WorkOrderEditPage').then(m => ({ default: m.WorkOrderEditPage })))
const PMListPage = lazy(() => import('@/pages/preventive-maintenance/PMListPage').then(m => ({ default: m.PMListPage })))
const PMDashboardPage = lazy(() => import('@/pages/preventive-maintenance/PMDashboardPage').then(m => ({ default: m.PMDashboardPage })))
const PMCreatePage = lazy(() => import('@/pages/preventive-maintenance/PMCreatePage').then(m => ({ default: m.PMCreatePage })))
const PMDetailPage = lazy(() => import('@/pages/preventive-maintenance/PMDetailPage').then(m => ({ default: m.PMDetailPage })))
const PMEditPage = lazy(() => import('@/pages/preventive-maintenance/PMEditPage').then(m => ({ default: m.PMEditPage })))
const IotPage = lazy(() => import('@/pages/iot/IotPage').then(m => ({ default: m.IotPage })))
const ReportsHubPage = lazy(() => import('@/pages/reports/ReportsHubPage').then(m => ({ default: m.ReportsHubPage })))
const WorkOrderReportsPage = lazy(() => import('@/pages/reports/WorkOrderReportsPage').then(m => ({ default: m.WorkOrderReportsPage })))
const AssetHealthReportPage = lazy(() => import('@/pages/reports/AssetHealthReportPage').then(m => ({ default: m.AssetHealthReportPage })))
const PMComplianceReportPage = lazy(() => import('@/pages/reports/PMComplianceReportPage').then(m => ({ default: m.PMComplianceReportPage })))
const IoTAnalyticsReportPage = lazy(() => import('@/pages/reports/IoTAnalyticsReportPage').then(m => ({ default: m.IoTAnalyticsReportPage })))
const TechnicianPerformancePage = lazy(() => import('@/pages/reports/TechnicianPerformancePage').then(m => ({ default: m.TechnicianPerformancePage })))
const CostAnalysisPage = lazy(() => import('@/pages/reports/CostAnalysisPage').then(m => ({ default: m.CostAnalysisPage })))

// Lazy-loaded settings pages (created by Part 1 agent)
const SettingsLayout = lazy(() => import('@/pages/settings/SettingsLayout').then(m => ({ default: m.SettingsLayout })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ProfilePage = lazy(() => import('@/pages/settings/ProfilePage').then(m => ({ default: m.ProfilePage })))
const NotificationsPage = lazy(() => import('@/pages/settings/NotificationsPage').then(m => ({ default: m.NotificationsPage })))
const SecurityPage = lazy(() => import('@/pages/settings/SecurityPage').then(m => ({ default: m.SecurityPage })))
const OrganizationPage = lazy(() => import('@/pages/settings/OrganizationPage').then(m => ({ default: m.OrganizationPage })))
const BrandingPage = lazy(() => import('@/pages/settings/BrandingPage').then(m => ({ default: m.BrandingPage })))
const EmailSettingsPage = lazy(() => import('@/pages/settings/EmailSettingsPage').then(m => ({ default: m.EmailSettingsPage })))
const LocalizationPage = lazy(() => import('@/pages/settings/LocalizationPage').then(m => ({ default: m.LocalizationPage })))
const UsersPage = lazy(() => import('@/pages/settings/UsersPage').then(m => ({ default: m.UsersPage })))
const RolesPage = lazy(() => import('@/pages/settings/RolesPage').then(m => ({ default: m.RolesPage })))
const IoTSettingsPage = lazy(() => import('@/pages/settings/IoTSettingsPage').then(m => ({ default: m.IoTSettingsPage })))
const DataRetentionPage = lazy(() => import('@/pages/settings/DataRetentionPage').then(m => ({ default: m.DataRetentionPage })))
const AuditLogPage = lazy(() => import('@/pages/settings/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const ImportExportPage = lazy(() => import('@/pages/settings/ImportExportPage').then(m => ({ default: m.ImportExportPage })))
const AdvancedSettingsPage = lazy(() => import('@/pages/settings/AdvancedSettingsPage').then(m => ({ default: m.AdvancedSettingsPage })))
const AISettingsPage = lazy(() => import('@/pages/settings/AISettingsPage').then(m => ({ default: m.AISettingsPage })))

// Onboarding
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage').then(m => ({ default: m.OnboardingPage })))

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/onboarding',
    element: <Lazy><OnboardingPage /></Lazy>,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <Lazy><DashboardPage /></Lazy> },
          { path: '/assets', element: <Lazy><AssetsListPage /></Lazy> },
          { path: '/assets/new', element: <Lazy><AssetCreatePage /></Lazy> },
          { path: '/assets/import', element: <Lazy><AssetImportPage /></Lazy> },
          { path: '/assets/scan', element: <Lazy><QRScannerPage /></Lazy> },
          { path: '/assets/print-labels', element: <Lazy><QRLabelPrintPage /></Lazy> },
          { path: '/assets/:id', element: <Lazy><AssetDetailPage /></Lazy> },
          { path: '/assets/:id/edit', element: <Lazy><AssetEditPage /></Lazy> },
          { path: '/locations', element: <Lazy><LocationsPage /></Lazy> },
          { path: '/work-orders', element: <Lazy><WorkOrdersListPage /></Lazy> },
          { path: '/work-orders/new', element: <Lazy><WorkOrderCreatePage /></Lazy> },
          { path: '/work-orders/:id', element: <Lazy><WorkOrderDetailPage /></Lazy> },
          { path: '/work-orders/:id/edit', element: <Lazy><WorkOrderEditPage /></Lazy> },
          { path: '/preventive-maintenance', element: <Lazy><PMListPage /></Lazy> },
          { path: '/preventive-maintenance/dashboard', element: <Lazy><PMDashboardPage /></Lazy> },
          { path: '/preventive-maintenance/new', element: <Lazy><PMCreatePage /></Lazy> },
          { path: '/preventive-maintenance/:id', element: <Lazy><PMDetailPage /></Lazy> },
          { path: '/preventive-maintenance/:id/edit', element: <Lazy><PMEditPage /></Lazy> },
          {
            element: <ProtectedRoute allowedRoles={['admin', 'manager', 'technician']} />,
            children: [
              { path: '/iot', element: <Lazy><IotPage /></Lazy> },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={['admin', 'manager']} />,
            children: [
              { path: '/reports', element: <Lazy><ReportsHubPage /></Lazy> },
              { path: '/reports/work-orders', element: <Lazy><WorkOrderReportsPage /></Lazy> },
              { path: '/reports/assets', element: <Lazy><AssetHealthReportPage /></Lazy> },
              { path: '/reports/pm-compliance', element: <Lazy><PMComplianceReportPage /></Lazy> },
              { path: '/reports/iot', element: <Lazy><IoTAnalyticsReportPage /></Lazy> },
              { path: '/reports/technicians', element: <Lazy><TechnicianPerformancePage /></Lazy> },
              { path: '/reports/costs', element: <Lazy><CostAnalysisPage /></Lazy> },
            ],
          },
          // Settings — nested under SettingsLayout
          {
            element: <ProtectedRoute />,
            children: [
              {
                path: '/settings',
                element: <Lazy><SettingsLayout /></Lazy>,
                children: [
                  { index: true, element: <Navigate to="/settings/profile" replace /> },
                  { path: 'profile', element: <Lazy><ProfilePage /></Lazy> },
                  { path: 'notifications', element: <Lazy><NotificationsPage /></Lazy> },
                  { path: 'security', element: <Lazy><SecurityPage /></Lazy> },
                  // Admin + manager
                  {
                    element: <ProtectedRoute allowedRoles={['admin', 'manager']} />,
                    children: [
                      { path: 'users', element: <Lazy><UsersPage /></Lazy> },
                    ],
                  },
                  // Admin only
                  {
                    element: <ProtectedRoute allowedRoles={['admin']} />,
                    children: [
                      { path: 'organization', element: <Lazy><OrganizationPage /></Lazy> },
                      { path: 'branding', element: <Lazy><BrandingPage /></Lazy> },
                      { path: 'email', element: <Lazy><EmailSettingsPage /></Lazy> },
                      { path: 'localization', element: <Lazy><LocalizationPage /></Lazy> },
                      { path: 'roles', element: <Lazy><RolesPage /></Lazy> },
                      { path: 'iot', element: <Lazy><IoTSettingsPage /></Lazy> },
                      { path: 'data-retention', element: <Lazy><DataRetentionPage /></Lazy> },
                      { path: 'audit-log', element: <Lazy><AuditLogPage /></Lazy> },
                      { path: 'import-export', element: <Lazy><ImportExportPage /></Lazy> },
                      { path: 'advanced', element: <Lazy><AdvancedSettingsPage /></Lazy> },
                      { path: 'ai', element: <Lazy><AISettingsPage /></Lazy> },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
