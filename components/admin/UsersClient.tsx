'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Shield, User, Trash2, X, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { createUserAccount, updateUserRole, deleteUserAccount } from '@/lib/actions/admin'
import { cn } from '@/lib/utils'

interface UserRow {
  id: string
  full_name: string | null
  phone: string | null
  role: string
  email: string
  created_at: string
  leads_count: number
}

type RoleFilter = 'all' | 'admin' | 'sales_agent' | 'user'
type NewRole = 'admin' | 'sales_agent' | 'user'

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير',
  sales_agent: 'مندوب مبيعات',
  user: 'مستخدم',
}

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  sales_agent: 'bg-emerald-100 text-emerald-700',
  user: 'bg-gray-100 text-gray-600',
}

function nextRole(current: string): NewRole {
  if (current === 'user') return 'sales_agent'
  if (current === 'sales_agent') return 'admin'
  return 'user'
}

export default function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[]
  currentUserId: string
}) {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [isPending, startTransition] = useTransition()
  const [createModal, setCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'sales_agent' as NewRole,
  })
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase()
    const matchQ =
      !q || (u.full_name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchQ && matchRole
  })

  function handleRoleToggle(u: UserRow) {
    const newRole = nextRole(u.role)
    startTransition(async () => {
      const res = await updateUserRole(u.id, newRole)
      if (res?.error) toast.error(res.error)
      else {
        setUsers((prev) => prev.map((r) => (r.id === u.id ? { ...r, role: newRole } : r)))
        toast.success(`تم تغيير الدور إلى: ${ROLE_LABELS[newRole]}`)
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      const res = await deleteUserAccount(deleteTarget.id)
      if (res?.error) toast.error(res.error)
      else {
        setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
        toast.success('تم حذف الحساب')
        setDeleteTarget(null)
        router.refresh()
      }
    })
  }

  function handleCreate() {
    startTransition(async () => {
      const res = await createUserAccount(newUser)
      if (res?.error) toast.error(res.error)
      else {
        toast.success('تم إنشاء الحساب بنجاح')
        setCreateModal(false)
        setNewUser({ email: '', password: '', full_name: '', role: 'sales_agent' })
        router.refresh()
      }
    })
  }

  const FILTERS: { key: RoleFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'admin', label: 'مديرون' },
    { key: 'sales_agent', label: 'مندوبو مبيعات' },
    { key: 'user', label: 'مستخدمون' },
  ]

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو البريد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setRoleFilter(f.key)}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                roleFilter === f.key
                  ? 'bg-navy-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {f.label}
              <span className="ms-1.5 opacity-60">
                ({f.key === 'all' ? users.length : users.filter((u) => u.role === f.key).length})
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setCreateModal(true)}
          className="bg-brand hover:bg-brand-light text-navy-900 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors"
        >
          <Plus size={14} />
          عضو جديد
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-right">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['العضو', 'الدور الوظيفي', 'عملاء مسندون', 'تاريخ الانضمام', 'الإجراءات'].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-gray-400">
                  لا توجد نتائج.
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const initials = ((u.full_name ?? u.email) || '؟').slice(0, 2).toUpperCase()
                const roleLbl = ROLE_LABELS[u.role] ?? u.role
                const roleCls = ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-600'
                const nextRoleLbl = ROLE_LABELS[nextRole(u.role)]
                const isSelf = u.id === currentUserId
                return (
                  <tr key={u.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-navy-900 text-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-navy-900 text-sm font-semibold">
                              {u.full_name ?? '—'}
                            </p>
                            {isSelf && (
                              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">
                                أنت
                              </span>
                            )}
                          </div>
                          <p className="font-sans text-xs text-gray-400">{u.email || (u.phone ?? '—')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', roleCls)}>
                        {roleLbl}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Briefcase size={12} className="text-gray-400" />
                        <span className="text-navy-900 font-sans text-sm font-semibold tabular-nums">
                          {u.leads_count > 0 ? u.leads_count.toLocaleString('ar-SA') : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-sans text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="text-xs text-gray-300 italic">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={isPending}
                            onClick={() => handleRoleToggle(u)}
                            title={`تغيير الدور إلى: ${nextRoleLbl}`}
                            className={cn(
                              'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors',
                              u.role === 'admin'
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : u.role === 'sales_agent'
                                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            )}
                          >
                            {u.role === 'admin' ? (
                              <User size={12} />
                            ) : u.role === 'sales_agent' ? (
                              <Shield size={12} />
                            ) : (
                              <Briefcase size={12} />
                            )}
                            {nextRoleLbl}
                          </button>
                          <button
                            disabled={isPending}
                            onClick={() => setDeleteTarget(u)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-navy-900 text-lg font-bold">إضافة عضو جديد</h3>
              <button onClick={() => setCreateModal(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { label: 'الاسم الكامل', key: 'full_name', type: 'text' },
                { label: 'البريد الإلكتروني', key: 'email', type: 'email' },
                { label: 'كلمة المرور', key: 'password', type: 'password' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-navy-900 text-sm font-medium">{f.label}</label>
                  <input
                    type={f.type}
                    value={newUser[f.key as keyof typeof newUser]}
                    onChange={(e) => setNewUser({ ...newUser, [f.key]: e.target.value })}
                    className="focus:border-brand mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="text-navy-900 text-sm font-medium">الدور الوظيفي</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as NewRole })}
                  className="focus:border-brand mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none"
                >
                  <option value="sales_agent">مندوب مبيعات</option>
                  <option value="admin">مدير</option>
                  <option value="user">مستخدم عادي</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                disabled={isPending || !newUser.email || !newUser.password}
                onClick={handleCreate}
                className="bg-brand hover:bg-brand-light text-navy-900 flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                إنشاء الحساب
              </button>
              <button
                onClick={() => setCreateModal(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center shadow-2xl">
            <p className="text-navy-900 font-bold">
              حذف {deleteTarget.full_name ?? deleteTarget.email}؟
            </p>
            <p className="text-sm text-gray-500">لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button
                disabled={isPending}
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                حذف
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
