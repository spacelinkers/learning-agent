import { useCallback, useState } from 'react'
import { api, TodayPlan } from '@/lib/api'

export function useTodayPlan() {
  const [plan, setPlan]       = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlan(await api.getTodayPlan())
    } catch (e: any) {
      setError(e.message ?? 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }, [])

  // Optimistic update — revert via refresh() on API error
  const markDone = useCallback(async (itemId: string) => {
    setPlan(prev => prev && {
      ...prev,
      items: prev.items.map(i => i.item_id === itemId ? { ...i, status: 'done' } : i),
    })
    try {
      await api.markDone(itemId)
    } catch {
      refresh()
    }
  }, [refresh])

  const skipTask = useCallback(async (itemId: string) => {
    setPlan(prev => prev && {
      ...prev,
      items: prev.items.map(i => i.item_id === itemId ? { ...i, status: 'missed' } : i),
    })
    try {
      await api.skipTask(itemId)
    } catch {
      refresh()
    }
  }, [refresh])

  return { plan, loading, error, refresh, markDone, skipTask }
}
