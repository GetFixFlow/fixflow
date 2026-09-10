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
  created_at: string
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
  full_name: string
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

export interface Location {
  id: number
  name: string
  description?: string
  ancestry?: string
  parent_id?: number
  organization_id: number
  created_at: string
  updated_at: string
}

// ── Asset ─────────────────────────────────────────────────────────────────────

export type AssetStatus = 'operational' | 'maintenance' | 'offline' | 'retired'

export interface Asset {
  id: number
  name: string
  asset_tag: string
  description?: string
  status: AssetStatus
  category?: string
  manufacturer?: string
  model?: string
  serial_number?: string
  purchase_date?: string
  purchase_cost?: number
  location_id?: number
  location?: Location
  organization_id: number
  created_at: string
  updated_at: string
}

// ── Work Order ────────────────────────────────────────────────────────────────

export type WorkOrderStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'verified'
  | 'cancelled'

export type WorkOrderType = 'corrective' | 'preventive' | 'inspection' | 'emergency'

export interface WorkOrder {
  id: number
  work_order_number: string
  title: string
  description?: string
  status: WorkOrderStatus
  priority: Priority
  work_order_type: WorkOrderType
  due_date?: string
  completed_at?: string
  estimated_hours?: number
  actual_hours?: number
  asset_id?: number
  asset?: Asset
  assignee_id?: number
  assignee?: User
  requester_id?: number
  requester?: User
  organization_id: number
  created_at: string
  updated_at: string
}

// ── Preventive Maintenance ────────────────────────────────────────────────────

export type PmFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'custom'
export type PmStatus = 'active' | 'inactive' | 'paused'

export interface PreventiveMaintenance {
  id: number
  title: string
  description?: string
  frequency: PmFrequency
  frequency_value?: number
  next_due_date: string
  status: PmStatus
  estimated_hours?: number
  asset_id: number
  asset?: Asset
  assignee_id?: number
  assignee?: User
  organization_id: number
  created_at: string
  updated_at: string
}

export interface PmExecution {
  id: number
  preventive_maintenance_id: number
  work_order_id?: number
  executed_at?: string
  notes?: string
  created_at: string
}

// ── IoT ───────────────────────────────────────────────────────────────────────

export type SensorType = 'temperature' | 'humidity' | 'vibration' | 'pressure' | 'current' | 'voltage' | 'custom'
export type AlertSeverity = 'info' | 'warning' | 'critical'
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

export interface Part {
  id: number
  name: string
  part_number?: string
  description?: string
  quantity_on_hand: number
  reorder_point?: number
  unit_cost?: number
  supplier?: string
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
    compliance_rate_30d: number
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
