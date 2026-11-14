import { http, HttpResponse } from 'msw'

export const handlers = [
  // No custom fields unless a test adds some: every work order and part form asks for them.
  // No saved reports unless a test adds some: every report page that can be saved asks for them.
  http.get('/api/v1/saved_reports', () => HttpResponse.json({ saved_reports: [], eligible_recipients: [] })),
  // Nothing but passwords unless a test turns the company sign-in on: the sign-in screen asks what it offers.
  http.get('/api/v1/auth/directory', () => HttpResponse.json({ oidc: { enabled: false, label: 'Company account' }, ldap: { enabled: false } })),
  // No plugin reports unless a test adds some: the Reports page asks for them.
  http.get('/api/v1/plugin_reports', () => HttpResponse.json({ reports: [] })),
  http.get('/api/v1/custom_fields', () => HttpResponse.json({ custom_fields: [] })),

  http.get('/api/v1/branding', () => {
    return HttpResponse.json({
      branding: {
        name: 'Demo Co', logo_url: null, favicon_url: null, primary_color: '#2563eb',
        login_headline: 'Sign in to FixFlow', login_subtitle: 'Enter your credentials to continue',
      },
    })
  }),

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

  http.get('/api/v1/ai/config', () => {
    return HttpResponse.json({
      success: true,
      data: { enabled: true, model: 'claude-sonnet-4-6' },
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
