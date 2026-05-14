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
    total: number
    open: number
    in_progress: number
    completed_this_month: number
    overdue: number
    by_priority: Record<string, number>
    by_status: Record<string, number>
  }
  assets: {
    total: number
    operational: number
    maintenance: number
    offline: number
    health_score: number
  }
  preventive_maintenance: {
    total: number
    active: number
    due_this_week: number
    overdue: number
    compliance_rate: number
  }
  iot: {
    open_alerts: number
    critical_alerts: number
    readings_today: number
  }
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
