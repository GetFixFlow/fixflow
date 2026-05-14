import { http, HttpResponse } from 'msw'

export const handlers = [
  http.post('/api/v1/users/sign_in', () => {
    return HttpResponse.json({
      success: true,
      data: {
        token: 'test-token',
        user: {
          id: 1,
          email: 'admin@demo.com',
          full_name: 'Demo Admin',
          role: 'admin',
          organization_id: 1,
        },
      },
      meta: { request_id: 'test-req-id', timestamp: new Date().toISOString() },
    })
  }),

  http.get('/api/v1/users/me', () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 1,
        email: 'admin@demo.com',
        full_name: 'Demo Admin',
        role: 'admin',
        organization_id: 1,
      },
      meta: { request_id: 'test-req-id', timestamp: new Date().toISOString() },
    })
  }),

  http.get('/api/v1/dashboard', () => {
    return HttpResponse.json({
      success: true,
      data: {
        work_orders: { total: 10, open: 3, in_progress: 2, completed_this_month: 5, overdue: 1, by_status: {}, by_priority: {} },
        assets: { total: 20, operational: 18, maintenance: 1, offline: 1, health_score: 90 },
        preventive_maintenance: { total: 5, active: 4, due_this_week: 1, overdue: 0, compliance_rate: 95 },
        iot: { open_alerts: 2, critical_alerts: 0, readings_today: 150 },
      },
      meta: { request_id: 'test-req-id', timestamp: new Date().toISOString() },
    })
  }),
]
