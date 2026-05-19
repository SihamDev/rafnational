'use client'

import { useState, useTransition } from 'react'
import { Save, Shield, Globe, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { updateAppSetting } from '@/lib/actions/admin'
import { cn } from '@/lib/utils'

type Tab = 'funnel' | 'notifications' | 'general'

interface Props {
  initialSettings: Record<string, Record<string, unknown>>
}

export default function SettingsClient({ initialSettings }: Props) {
  const [tab, setTab] = useState<Tab>('funnel')
  const [isPending, startTransition] = useTransition()

  // Funnel settings
  const [funnelSecret, setFunnelSecret] = useState(String(initialSettings.funnel?.secret ?? ''))
  const [allowedOrigins, setAllowedOrigins] = useState(
    String(initialSettings.funnel?.allowed_origins ?? 'https://www.rafnationals.com')
  )
  const [rateLimit, setRateLimit] = useState(Number(initialSettings.funnel?.rate_limit ?? 40))

  // Notification settings
  const [whatsappEnabled, setWhatsappEnabled] = useState(
    Boolean(initialSettings.notifications?.whatsapp_enabled ?? false)
  )
  const [whatsappNumber, setWhatsappNumber] = useState(
    String(initialSettings.notifications?.whatsapp_number ?? '966920031241')
  )

  // General
  const [companyName, setCompanyName] = useState(
    String(initialSettings.general?.company_name ?? 'شركة راف الوطنية للتطوير والاستثمار العقاري')
  )
  const [supportEmail, setSupportEmail] = useState(
    String(initialSettings.general?.support_email ?? 'support@rafnational.com')
  )

  function handleSaveFunnel() {
    startTransition(async () => {
      const res = await updateAppSetting('funnel', {
        secret: funnelSecret,
        allowed_origins: allowedOrigins,
        rate_limit: rateLimit,
      })
      if (res?.error) toast.error(res.error)
      else toast.success('تم حفظ إعدادات الفانل')
    })
  }

  function handleSaveNotifications() {
    startTransition(async () => {
      const res = await updateAppSetting('notifications', {
        whatsapp_enabled: whatsappEnabled,
        whatsapp_number: whatsappNumber,
      })
      if (res?.error) toast.error(res.error)
      else toast.success('تم حفظ إعدادات الإشعارات')
    })
  }

  function handleSaveGeneral() {
    startTransition(async () => {
      const res = await updateAppSetting('general', {
        company_name: companyName,
        support_email: supportEmail,
      })
      if (res?.error) toast.error(res.error)
      else toast.success('تم حفظ الإعدادات العامة')
    })
  }

  const TABS = [
    { id: 'funnel' as Tab, label: 'إعدادات الفانل', icon: Globe },
    { id: 'notifications' as Tab, label: 'الإشعارات', icon: Bell },
    { id: 'general' as Tab, label: 'عام', icon: Shield },
  ]

  const inputCls =
    'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none'
  const labelCls = 'text-sm font-medium text-ink mb-1 block'
  const hintCls = 'text-xs text-gray-400 mt-1'

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex w-fit gap-1.5 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'bg-ink text-white' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Funnel tab */}
      {tab === 'funnel' && (
        <div className="max-w-lg space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div>
            <label className={labelCls}>مفتاح الأمان (Funnel Secret)</label>
            <input
              type="text"
              dir="ltr"
              value={funnelSecret}
              onChange={(e) => setFunnelSecret(e.target.value)}
              className={cn(inputCls, 'font-mono text-xs')}
            />
            <p className={hintCls}>
              يُرسل في header كـ Authorization: Bearer عند POST إلى /api/leads/submit
            </p>
          </div>
          <div>
            <label className={labelCls}>المصادر المسموحة (CORS Origins)</label>
            <input
              type="text"
              dir="ltr"
              value={allowedOrigins}
              onChange={(e) => setAllowedOrigins(e.target.value)}
              className={cn(inputCls, 'font-mono text-xs')}
            />
            <p className={hintCls}>
              افصل بين الروابط بفاصلة — مثال: https://www.rafnationals.com,http://localhost:3030
            </p>
          </div>
          <div>
            <label className={labelCls}>الحد الأقصى للطلبات في الدقيقة</label>
            <input
              type="number"
              min={0}
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value) || 0)}
              className={cn(inputCls, 'font-sans')}
            />
          </div>
          <button
            disabled={isPending}
            onClick={handleSaveFunnel}
            className="bg-brand hover:bg-brand-light text-ink flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Save size={14} />
            حفظ إعدادات الفانل
          </button>
        </div>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="max-w-lg space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={whatsappEnabled}
                onChange={(e) => setWhatsappEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-emerald-500 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full" />
            </label>
            <span className="text-ink text-sm font-medium">إشعارات واتساب عند وصول عميل جديد</span>
          </div>
          <div>
            <label className={labelCls}>رقم الواتساب</label>
            <input
              type="text"
              dir="ltr"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className={cn(inputCls, 'font-mono')}
            />
            <p className={hintCls}>الرقم بالصيغة الدولية بدون + مثل: 966920031241</p>
          </div>
          <button
            disabled={isPending}
            onClick={handleSaveNotifications}
            className="bg-brand hover:bg-brand-light text-ink flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Save size={14} />
            حفظ
          </button>
        </div>
      )}

      {/* General tab */}
      {tab === 'general' && (
        <div className="max-w-lg space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div>
            <label className={labelCls}>اسم الشركة</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>البريد الإلكتروني للدعم</label>
            <input
              type="email"
              dir="ltr"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className={cn(inputCls, 'font-mono text-xs')}
            />
          </div>
          <button
            disabled={isPending}
            onClick={handleSaveGeneral}
            className="bg-brand hover:bg-brand-light text-ink flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <Save size={14} />
            حفظ الإعدادات
          </button>
        </div>
      )}
    </div>
  )
}
