import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { AssetsPage } from '@/pages/assets/AssetsPage'
import { WorkOrdersPage } from '@/pages/work-orders/WorkOrdersPage'
import { PmPage } from '@/pages/preventive-maintenance/PmPage'
import { IotPage } from '@/pages/iot/IotPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/assets', element: <AssetsPage /> },
          { path: '/work-orders', element: <WorkOrdersPage /> },
          { path: '/preventive-maintenance', element: <PmPage /> },
          {
            element: <ProtectedRoute allowedRoles={['admin', 'manager', 'technician']} />,
            children: [{ path: '/iot', element: <IotPage /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={['admin', 'manager']} />,
            children: [{ path: '/reports', element: <ReportsPage /> }],
          },
          {
            element: <ProtectedRoute allowedRoles={['admin']} />,
            children: [{ path: '/settings', element: <SettingsPage /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
