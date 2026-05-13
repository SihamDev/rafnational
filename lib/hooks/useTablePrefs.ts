'use client'

import { useState, useCallback, useEffect } from 'react'

export type Density = 'compact' | 'normal' | 'comfortable'

export interface SavedView {
  id: string
  name: string
  filters: {
    status?: string
    entityId?: string
    entityName?: string
    floor?: string
    dateFrom?: string
    dateTo?: string
    guestOnly?: boolean
    unreviewed?: boolean
    q?: string
  }
  columnVisibility?: Record<string, boolean>
}

export type RequestDetailMode = 'page' | 'modal'

export interface TablePrefs {
  columnVisibility: Record<string, boolean>
  columnOrder: string[]
  columnSizes: Record<string, number>
  density: Density
  pageSize: number
  savedViews: SavedView[]
  requestDetailMode: RequestDetailMode
}

const DEFAULT_PREFS: TablePrefs = {
  columnVisibility: { floor: false },
  columnOrder: [],
  columnSizes: {},
  density: 'normal',
  pageSize: 15,
  savedViews: [],
  requestDetailMode: 'page',
}

const STORAGE_KEY = 'admin_requests_prefs'

function loadPrefs(): TablePrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const loaded = JSON.parse(raw)
    return {
      ...DEFAULT_PREFS,
      ...loaded,
      columnVisibility: {
        ...DEFAULT_PREFS.columnVisibility,
        ...loaded.columnVisibility,
      },
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function useTablePrefs() {
  const [prefs, setPrefs] = useState<TablePrefs>(DEFAULT_PREFS)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setPrefs(loadPrefs())
    setMounted(true)
  }, [])

  const updatePrefs = useCallback((patch: Partial<TablePrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
      return next
    })
  }, [])

  const setColumnVisibility = useCallback(
    (v: Record<string, boolean>) => {
      updatePrefs({ columnVisibility: v })
    },
    [updatePrefs]
  )

  const setColumnOrder = useCallback(
    (order: string[]) => {
      updatePrefs({ columnOrder: order })
    },
    [updatePrefs]
  )

  const setColumnSize = useCallback((id: string, size: number) => {
    setPrefs((prev) => {
      const next = { ...prev, columnSizes: { ...prev.columnSizes, [id]: size } }
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
      return next
    })
  }, [])

  const setDensity = useCallback((d: Density) => updatePrefs({ density: d }), [updatePrefs])
  const setPageSize = useCallback((n: number) => updatePrefs({ pageSize: n }), [updatePrefs])
  const setRequestDetailMode = useCallback(
    (m: RequestDetailMode) => updatePrefs({ requestDetailMode: m }),
    [updatePrefs]
  )

  const saveView = useCallback(
    (name: string, filters: SavedView['filters'], columnVisibility?: Record<string, boolean>) => {
      setPrefs((prev) => {
        const view: SavedView = {
          id: Date.now().toString(),
          name,
          filters,
          columnVisibility,
        }
        const next = { ...prev, savedViews: [...prev.savedViews, view] }
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        }
        return next
      })
    },
    []
  )

  const deleteView = useCallback((id: string) => {
    setPrefs((prev) => {
      const next = { ...prev, savedViews: prev.savedViews.filter((v) => v.id !== id) }
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
      return next
    })
  }, [])

  return {
    prefs,
    mounted,
    setColumnVisibility,
    setColumnOrder,
    setColumnSize,
    setDensity,
    setPageSize,
    setRequestDetailMode,
    saveView,
    deleteView,
  }
}
