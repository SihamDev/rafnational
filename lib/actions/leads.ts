'use server'

import { revalidatePath } from 'next/cache'

import { getStaffUser } from '@/lib/supabase/server'
import {
  QUALIFICATION_ORDER,
  type QualificationStatus,
  SALES_WORKFLOW_ORDER,
  type SalesWorkflowStatus,
} from '@/types/leads'

function assertLeadQualification(value: QualificationStatus) {
  if (!QUALIFICATION_ORDER.includes(value)) throw new Error('qualification غير معروفة')
}

function assertSalesWorkflow(value: SalesWorkflowStatus) {
  if (!SALES_WORKFLOW_ORDER.includes(value)) throw new Error('حالة مبيعات غير معروفة')
}

export async function adminUpdateLead(
  leadId: string,
  input: Partial<{
    qualification_status: QualificationStatus
    sales_workflow_status: SalesWorkflowStatus
    assigned_to: string | null
    internal_notes: string | null
    next_followup_at: string | null
  }>
) {
  const staff = await getStaffUser()
  if (!staff) return { error: 'غير مصرح' }
  if (staff.role !== 'admin') return { error: 'ليست صلاحية الإدارة' }

  const patch: Record<string, unknown> = {}

  if (typeof input.internal_notes !== 'undefined') {
    patch.internal_notes = input.internal_notes
  }

  if (typeof input.qualification_status !== 'undefined') {
    assertLeadQualification(input.qualification_status)
    patch.qualification_status = input.qualification_status
  }

  if (typeof input.sales_workflow_status !== 'undefined') {
    assertSalesWorkflow(input.sales_workflow_status)
    patch.sales_workflow_status = input.sales_workflow_status
  }

  if (typeof input.next_followup_at !== 'undefined') {
    patch.next_followup_at = input.next_followup_at
  }

  if (typeof input.assigned_to !== 'undefined') {    if (input.assigned_to) {
      const { data: pr, error: prErr } = await staff.supabase
        .from('profiles')
        .select('id,role')
        .eq('id', input.assigned_to)
        .single()

      const profile = pr as { id: string; role: string } | null
      if (prErr || !profile?.id) return { error: 'المستخدم غير موجود' }
      if (profile.role !== 'sales_agent') {
        return { error: 'يمكن تعيين مندوبي مبيعات فقط' }
      }
    }

    patch.assigned_to = input.assigned_to
  }

  if (Object.keys(patch).length === 0) {
    return { error: 'لا يوجد تغيير' }
  }

  const { error } = await staff.supabase.from('leads').update(patch).eq('id', leadId)

  if (error) return { error: error.message }

  revalidatePath('/admin/leads')
  revalidatePath('/admin/agent')
  return { ok: true as const }
}

/** One-click qualify / unqualify — admin only */
export async function quickQualifyLead(
  leadId: string,
  status: 'qualified' | 'unqualified' | 'pending',
) {
  const staff = await getStaffUser()
  if (!staff) return { error: 'غير مصرح' }
  if (staff.role !== 'admin') return { error: 'ليست صلاحية الإدارة' }

  const { error } = await staff.supabase
    .from('leads')
    .update({ qualification_status: status })
    .eq('id', leadId)

  if (error) return { error: error.message }
  revalidatePath('/admin/leads')
  return { ok: true as const }
}

/** Permanently delete a lead — admin only */
export async function deleteLead(leadId: string) {
  const staff = await getStaffUser()
  if (!staff) return { error: 'غير مصرح' }
  if (staff.role !== 'admin') return { error: 'ليست صلاحية الإدارة' }

  const { error } = await staff.supabase
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (error) return { error: error.message }
  revalidatePath('/admin/leads')
  revalidatePath('/admin')
  return { ok: true as const }
}

export async function agentUpdateLead(
  leadId: string,
  input: Partial<{
    sales_workflow_status: SalesWorkflowStatus
    internal_notes: string | null
    next_followup_at: string | null
  }>
) {
  const staff = await getStaffUser()
  if (!staff) return { error: 'غير مصرح' }
  if (staff.role !== 'sales_agent') return { error: 'ليست صلاحية الوكيل' }

  const patch: Record<string, unknown> = {}
  if (typeof input.internal_notes !== 'undefined') patch.internal_notes = input.internal_notes
  if (typeof input.next_followup_at !== 'undefined') patch.next_followup_at = input.next_followup_at
  if (typeof input.sales_workflow_status !== 'undefined') {
    assertSalesWorkflow(input.sales_workflow_status)
    patch.sales_workflow_status = input.sales_workflow_status
  }

  if (Object.keys(patch).length === 0) return { error: 'لا يوجد تغيير' }

  const { error } = await staff.supabase.from('leads').update(patch).eq('id', leadId)

  if (error) return { error: error.message }

  revalidatePath('/admin/leads')
  revalidatePath('/admin/agent')
  return { ok: true as const }
}
