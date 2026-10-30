// ── Shared primitives ────────────────────────────────────────────────────────

export type Role = 'admin' | 'manager' | 'technician' | 'requester'
export type Priority = 'low' | 'medium' | 'high' | 'critical'

// ── API envelope ─────────────────────────────────────────────────────────────

export interface ApiMeta {
  request_id: string
  timestamp: string
  pagination?: Pagination
}

export interface ApiSuccess<T> {
  success: true
  data: T
  meta: ApiMeta
}

export interface ApiError {
  success: false
  error: { code: string; message: string; details?: Record<string, string[]> }
  meta: ApiMeta
}

export interface Pagination {
  count: number
  page: number
  items: number
  pages: number
  next?: number | null
  prev?: number | null
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  organization_id: number
  avatar_url?: string
  phone?: string
  job_title?: string | null
  /** What an hour of this person's work costs. Only administrators are sent it. */
  hourly_rate?: number | null
  department?: string | null
  organization_name?: string
  created_at?: string
  active?: boolean
  invitation_pending?: boolean
  invitation_accepted_at?: string | null
  /** Signs in with an authenticator app as well as the password. */
  two_factor_enabled?: boolean
  /** Too many wrong passwords: locked for 30 minutes, or until an administrator unlocks it. */
  locked?: boolean
  /** The company requires two-factor sign-in and this person has not set it up yet. */
  two_factor_setup_required?: boolean
}

export interface InvitePayload {
  first_name: string
  last_name: string
  email: string
  role: Role
  send_welcome: boolean
  message?: string
}

export interface InviteResult {
  user: User
  invitation_url: string
  email_sent: boolean
}

export interface InvitationDetails {
  email: string
  first_name: string
  last_name: string
  role: Role
  organization_name: string
}

export interface AuthTokens {
  token: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  password_confirmation: string
  first_name: string
  last_name: string
  organization_name: string
}

// ── Organization ──────────────────────────────────────────────────────────────

export interface Organization {
  id: number
  name: string
  slug: string
  created_at: string
}

// ── Location ─────────────────────────────────────────────────────────────────

export type LocationType = 'site' | 'building' | 'floor' | 'zone' | 'room' | 'outdoor'

export interface Location {
  id: number
  name: string
  location_type: LocationType
  description?: string
  ancestry?: string | null
  parent_id?: number | null
  depth?: number
  full_path?: string
  children?: { id: number; name: string; location_type: LocationType }[]
  organization_id?: number
  created_at: string
  updated_at: string
  // Expected by the locations UI; the API does not return these yet.
  asset_count?: number
  children_count?: number
}

export interface LocationTreeNode extends Location {
  children: LocationTreeNode[]
  depth: number
  path: string
}

// ── Asset ─────────────────────────────────────────────────────────────────────

export type AssetStatus = 'operational' | 'degraded' | 'down' | 'decommissioned'

export interface Asset {
  id: number
  name: string
  asset_tag: string
  /** Random code in the QR label's link, so the public request form cannot be used to list equipment. */
  public_code?: string
  description?: string
  status: AssetStatus
  category?: string
  manufacturer?: string
  model?: string
  serial_number?: string
  purchase_date?: string
  purchase_cost?: number
  location_id?: number | null
  location?: Location | null
  organization_id: number
  custom_fields?: Record<string, unknown>
  created_at: string
  updated_at: string
  // Extended view
  open_work_orders_count?: number
  // Expected by the asset UI; the API does not return these yet.
  last_work_order_date?: string | null
  year_manufactured?: number | null
  warranty_expiry?: string | null
}

// ── Work Order ────────────────────────────────────────────────────────────────

export type WorkOrderStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'on_hold'
  | 'pending_parts'
  | 'completed'
  | 'verified'
  | 'cancelled'

export type WorkOrderType = 'corrective' | 'preventive' | 'inspection' | 'emergency'
export type WorkOrderSource = 'manual' | 'pm' | 'iot_rule'
// Sent as resolution_type when completing a work order. The API does not store it yet.
export type ResolutionType = 'fully_resolved' | 'temporarily_resolved' | 'partially_resolved'

export interface ChecklistItem {
  step: number
  instruction: string
  required?: boolean
  completed?: boolean
  /** Who ticked the step and when, as the server recorded it. */
  completed_by_name?: string | null
  completed_at?: string | null
  /** Ticked without a connection and not sent yet. Set by the app, not the server. */
  pending?: boolean
}

export interface PersonRef {
  id?: number
  full_name: string
  email?: string
  role?: Role
  organization_id?: number
}

export interface WorkOrderComment {
  id: number
  body: string
  internal: boolean
  created_at: string
  user: PersonRef & { id: number }
  /** Written without a connection and not sent yet. */
  pending?: boolean
}

export interface WorkOrderAttachment {
  id: number
  description?: string | null
  content_type: string | null
  filename: string | null
  url: string | null
  created_at: string
  user: PersonRef & { id: number }
}

export interface WorkOrderPart {
  id: number
  part_id: number
  name: string
  sku?: string | null
  quantity_used: number
  unit_cost: number | string | null
}

export interface WorkOrder {
  id: number
  work_order_number: string
  /** How many of this person's changes to it are waiting to be sent. Set by the app, not the server. */
  pending_sync?: number
  title: string
  description?: string
  status: WorkOrderStatus
  priority: Priority
  work_order_type?: WorkOrderType
  due_date?: string | null
  started_at?: string | null
  completed_at?: string | null
  verified_at?: string | null
  estimated_hours?: number | null
  actual_hours?: number | null
  parts_cost?: number | string
  /** Only managers and administrators are sent the labor figures (they reveal what people are paid). */
  labor_cost?: number | string | null
  labor_rate?: number | string | null
  vendor_id?: number | null
  vendor?: { id: number; name: string } | null
  /** What an outside company charged and their invoice number: only managers and administrators are sent these. */
  vendor_cost?: number | string | null
  vendor_reference?: string | null
  completion_notes?: string | null
  rejection_reason?: string | null
  cancellation_reason?: string | null
  checklist?: ChecklistItem[]
  asset_id?: number | null
  asset?: { id: number; name: string; asset_tag: string; location?: { name: string } | null } | null
  assignee_id?: number | null
  assignee?: PersonRef | null
  requester_id?: number | null
  requester?: PersonRef | null
  verified_by?: PersonRef | null
  comments?: WorkOrderComment[]
  attachments?: WorkOrderAttachment[]
  parts_used?: WorkOrderPart[]
  organization_id: number
  created_at: string
  updated_at: string
  // Expected by the work order UI; the API does not return these yet.
  source?: WorkOrderSource
  pm_id?: number | null
  iot_alert_id?: number | null
}

// What someone outside the team sees of their request (no account): where it stands, nothing about the team's work.
export type WorkRequestStatus = 'received' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'

export interface WorkRequest {
  token: string
  title: string
  description?: string
  status: WorkRequestStatus
  created_at: string
  updated_at?: string
}

// What the public form is told about the equipment on a scanned QR label.
export interface PublicAsset {
  name: string
  asset_tag: string
  location: string | null
}

// ── Preventive Maintenance ────────────────────────────────────────────────────

export type PmFrequencyType = 'time_based' | 'meter_based' | 'calendar_based' | 'condition_based'
/** Days, weeks or months for a schedule by time; for one that follows a meter, that meter's unit (hours, km, cycles ...). */
export type PmFrequencyUnit = 'days' | 'weeks' | 'months' | 'hours' | 'cycles' | (string & {})
export type PmStatus = 'active' | 'paused' | 'archived'
export type PmExecutionStatus = 'pending' | 'generated' | 'completed' | 'skipped'

/** @deprecated The API sends frequency_type and frequency_unit. */
export type PmFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom'

export interface PMChecklistStep {
  step: number
  instruction: string
  required: boolean
  estimated_minutes?: number
  photo_required?: boolean
  notes?: string
}

export interface PMRequiredPart {
  part_id: number
  quantity: number
  part?: Part
}

export interface PMTemplate {
  title: string
  description?: string
  checklist?: PMChecklistStep[]
  required_parts?: PMRequiredPart[]
  estimated_hours?: number
}

export interface PreventiveMaintenance {
  id: number
  name: string
  description?: string
  status: PmStatus
  priority: Priority
  frequency_type: PmFrequencyType
  frequency_value?: number
  frequency_unit?: PmFrequencyUnit
  start_date?: string
  end_date?: string | null
  next_due_at?: string | null
  /** Meter-based schedules: the meter followed, and the reading at which the schedule falls due. */
  meter?: { id: number; name: string; unit: string; reading: number } | null
  next_due_reading?: number | null
  last_run_at?: string | null
  times_generated?: number
  times_completed?: number
  times_skipped?: number
  estimated_hours?: number | null
  template?: PMTemplate
  asset?: { id: number; name: string; asset_tag: string; location?: { name: string } | null } | null
  assigned_to?: PersonRef | null
  recent_executions?: PmExecution[]
  created_at: string
  updated_at: string
  // Expected by the PM UI; the API does not return these yet.
  title_template?: string
  checklist_template?: PMChecklistStep[]
  required_parts?: PMRequiredPart[]
  calendar_day_of_month?: number | null
  calendar_day_of_week?: number | null
  compliance_rate?: number
  completed_count?: number
  skipped_count?: number
  missed_count?: number
  generated_count?: number
}

export interface PmExecution {
  id: number
  scheduled_date: string
  generated_at?: string | null
  status: PmExecutionStatus
  skip_reason?: string | null
  notes?: string | null
  work_order?: { id: number; work_order_number: string; status: WorkOrderStatus } | null
  created_at: string
}

export interface PMFilters {
  status: PmStatus | ''
  priority: Priority | ''
  asset_id: number
  overdue: boolean
  search: string
  page: number
}

export interface PMForecastItem {
  pm_id: number
  pm_name: string
  asset_name: string
  due_date: string
  priority: Priority
  estimated_hours?: number
}

export interface PMSchedulePreviewItem {
  date: string
  days_until: number
  occurrence: number
  warnings?: string[]
}

export interface PMDashboardStats {
  period_days: number
  /** Share of due executions that were completed; null when nothing has come due yet. */
  overall_compliance: number | null
  /** Change in points against the previous period; null when either period has no data. */
  compliance_change: number | null
  due_this_week: number
  overdue_count: number
  completed_this_month: number
  scheduled_this_month: number
  avg_completion_hours: number | null
  avg_estimated_hours: number | null
  /** One entry per month, oldest first; month is YYYY-MM. */
  monthly_trend: { month: string; completed: number; missed: number; compliance: number | null }[]
  by_location: { location_name: string; compliance: number | null; count: number }[]
  overdue_pms: PreventiveMaintenance[]
  upcoming_week: { pm: PreventiveMaintenance; due_date: string }[]
  recent_activity: {
    type: 'generated' | 'completed' | 'skipped' | 'missed'
    pm_name: string
    wo_number?: string | null
    occurred_at: string
  }[]
}

// ── IoT ───────────────────────────────────────────────────────────────────────

export type SensorType = 'temperature' | 'humidity' | 'vibration' | 'pressure' | 'current' | 'voltage' | 'custom'
// An alert's severity is its rule's priority; 'info' and 'warning' are older names some screens still accept.
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'warning'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved'

export interface SensorReading {
  id: number
  asset_id: number
  sensor_type: SensorType
  value: number
  unit: string
  recorded_at: string
  metadata?: Record<string, unknown>
}

export interface IotRule {
  id: number
  name: string
  description?: string
  sensor_type: SensorType
  condition: string
  threshold_value: number
  severity: AlertSeverity
  enabled: boolean
  asset_id?: number
  organization_id: number
  created_at: string
  updated_at: string
}

export interface IotAlert {
  id: number
  iot_rule_id: number
  iot_rule?: IotRule
  asset_id: number
  asset?: Asset
  severity: AlertSeverity
  status: AlertStatus
  message: string
  sensor_value: number
  acknowledged_at?: string
  resolved_at?: string
  created_at: string
}

// Extended IoT types for Session 13

export type IoTOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'outside_range'
export type IoTRuleStatus = 'active' | 'paused' | 'archived'
export type AlertSeverityFilter = 'critical' | 'high' | 'medium' | 'low'
export type IoTAlertStatusFilter = 'open' | 'acknowledged' | 'resolved' | 'suppressed'

// Extended IotRule with full spec fields
export interface IotRuleExtended extends IotRule {
  metric_name: string
  metric_unit?: string
  operator: IoTOperator
  threshold_min?: number
  threshold_max?: number
  sustained_minutes?: number
  status: IoTRuleStatus
  auto_create_wo: boolean
  wo_priority?: Priority
  wo_assignee_id?: number
  wo_assignee?: User
  wo_title_template?: string
  wo_description_template?: string
  cooldown_minutes?: number
  trigger_count?: number
  last_triggered_at?: string
  asset?: Asset
}

// Extended IotAlert with full spec fields
export interface IotAlertExtended extends IotAlert {
  metric_name: string
  metric_unit?: string
  threshold_value: number
  threshold_operator?: IoTOperator
  work_order_id?: number
  work_order_number?: string
  work_order?: WorkOrder
  acknowledged_by?: User
  acknowledged_note?: string
  resolved_note?: string
  location_path?: string
  rule_name?: string
  duration_minutes?: number
}

export interface IoTDashboardStats {
  active_sensors: number
  monitored_assets: number
  readings_per_hour: number
  readings_per_hour_change: number
  open_alerts: number
  critical_alerts: number
  high_alerts: number
  medium_alerts: number
  active_rules: number
  triggered_rules: number
  recent_alerts: IotAlertExtended[]
  hourly_readings: { hour: string; count: number; alerts: number }[]
  asset_status: { asset_id: number; asset_name: string; asset_tag: string; metrics: AssetMetricStatus[] }[]
}

export interface AssetMetricStatus {
  metric_name: string
  metric_unit?: string
  latest_value?: number
  latest_reading_at?: string
  is_breached: boolean
  is_stale: boolean
  threshold?: number
  threshold_operator?: IoTOperator
  rule_id?: number
  pct_of_threshold?: number
}

export interface ApiKeyCreateRequest {
  name: string
  description?: string
  expires_at?: string
  scopes: string[]
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string // shown once only
  description?: string
  scopes?: string[]
}

export interface ApiKeyFull extends ApiKey {
  description?: string
  scopes?: string[]
}

// ── Parts / Inventory ─────────────────────────────────────────────────────────

export interface VendorContact {
  id: number
  name: string
  role?: string | null
  phone?: string | null
  email?: string | null
}

/** An outside company that does maintenance work (a contractor, a repair shop, a hire firm). */
export interface Vendor {
  id: number
  name: string
  category?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
  notes?: string | null
  active: boolean
  work_orders_count: number
  /** Only on a single vendor (the detail), not in the list. */
  contacts?: VendorContact[]
  created_at: string
  updated_at: string
}

export interface Part {
  id: number
  name: string
  sku?: string | null
  quantity_on_hand: number
  reorder_point: number
  unit?: string
  /** What one costs; prefilled when logging parts. Null until someone sets it. */
  unit_cost?: number | null
  low_stock?: boolean
  location_id?: number | null
  organization_id: number
  created_at: string
  updated_at: string
}

// ── Activity Log ──────────────────────────────────────────────────────────────

export interface ActivityLog {
  id: number
  action: string
  resource_type: string
  resource_id: number
  resource_name?: string
  ip_address?: string
  metadata?: Record<string, unknown>
  user?: User
  created_at: string
}

// ── Reports / Dashboard ───────────────────────────────────────────────────────

export interface DashboardStats {
  work_orders: {
    open: number
    in_progress: number
    overdue: number
    completed_today: number
    completed_this_week: number
    critical_open: number
    avg_resolution_hours: number
  }
  assets: {
    total: number
    operational: number
    degraded: number
    down: number
    decommissioned: number
    health_score: number
  }
  preventive_maintenance: {
    due_this_week: number
    overdue: number
    /** Share of the last 30 days' due executions that were completed; null when none came due. */
    compliance_rate_30d: number | null
    next_due: { id: number; name: string; asset: string; due_date: string }[]
  }
  iot: {
    active_rules: number
    open_alerts: number
    critical_alerts: number
    readings_last_hour: number
  }
  recent_activity: { type: string; description: string; user?: string; timestamp: string }[]
  generated_at: string
}

/** What a technician sees first: their own work, their maintenance and their own activity. */
export interface TechnicianDashboardStats {
  my_work_orders: { assigned: number; in_progress: number; overdue: number; completed_today: number }
  upcoming_pms: { id: number; name: string; asset: string; due_date: string | null }[]
  recent_activity: { type: string; description: string; timestamp: string }[]
}

/** What a requester sees first: how their own requests are going. */
export interface RequesterDashboardStats {
  my_requests: { total: number; open: number; completed: number }
}

/** The dashboard endpoint answers differently for each kind of person. */
export type DashboardResponse = DashboardStats | TechnicianDashboardStats | RequesterDashboardStats

export interface WorkOrderSummary {
  period: string
  total: number
  completed: number
  avg_completion_hours: number
  by_priority: Record<string, number>
  by_type: Record<string, number>
}

export interface AssetHealthReport {
  asset_id: number
  asset_name: string
  asset_tag: string
  health_score: number
  open_work_orders: number
  total_work_orders: number
  last_maintenance?: string
  sensor_alerts: number
}

// ── API Key ───────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: number
  name: string
  key_prefix: string
  last_used_at?: string
  expires_at?: string
  active: boolean
  organization_id: number
  created_at: string
}
