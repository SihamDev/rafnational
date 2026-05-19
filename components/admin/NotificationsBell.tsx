'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { Bell, X, Check, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { markNotificationRead, markAllNotificationsRead } from '@/lib/actions/notifications'
import type { AdminNotification } from '@/types'
import { cn } from '@/lib/utils'
import { formatWesternShortDateTime } from '@/lib/format-western'

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [isPending, startTransition] = useTransition()
  // Stable client ref — prevents useEffect from re-firing on every render
  const supabase = useRef(createClient()).current

  const unread = notifications.filter((n) => !n.read_at).length

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15)
      if (data) setNotifications(data as AdminNotification[])
    }
    load()

    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => {
          setNotifications((prev) => [payload.new as AdminNotification, ...prev].slice(0, 15))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      )
    })
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    })
  }

  const TYPE_ICON: Record<string, string> = {
    new_request: '📋',
    quota_exceeded: '⚠️',
    new_entity: '🏢',
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="text-ink text-sm font-semibold">الإشعارات</h3>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    disabled={isPending}
                    onClick={handleMarkAll}
                    className="text-navy-400 hover:text-brand flex items-center gap-1 text-xs transition-colors"
                  >
                    <CheckCheck size={13} />
                    علّم الكل
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="max-h-72 divide-y divide-gray-50 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">لا توجد إشعارات</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50',
                      !n.read_at && 'bg-brand/5'
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-lg">{TYPE_ICON[n.type] ?? '🔔'}</span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-sm',
                          !n.read_at ? 'text-ink font-semibold' : 'text-gray-700'
                        )}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{n.body}</p>
                      )}
                      <p className="mt-1 text-[10px] text-gray-300">
                        {formatWesternShortDateTime(n.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {!n.read_at && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="hover:text-brand text-gray-300 transition-colors"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => setOpen(false)}
                          className="text-brand text-[10px] hover:underline"
                        >
                          عرض
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
