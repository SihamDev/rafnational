// Shared TypeScript types for RAF National CRM

export type { FlexibleFunnelSubmitPayload } from './funnel-payload'

export type UserRole = 'user' | 'admin' | 'sales_agent'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  role: UserRole
  created_at: string
}

export interface ActivityLog {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor?: { full_name: string | null }
}

export interface AdminNotification {
  id: string
  admin_id: string | null
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export interface AppSetting {
  key: string
  value: Record<string, unknown>
  updated_by: string | null
  updated_at: string
}
