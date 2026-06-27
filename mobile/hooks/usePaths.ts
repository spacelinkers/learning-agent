import { useCallback, useState } from 'react'
import { api, LearningPath } from '@/lib/api'

export function usePaths() {
  const [paths, setPaths]     = useState<LearningPath[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPaths(await api.getPaths())
    } catch (e: any) {
      setError(e.message ?? 'Failed to load paths')
    } finally {
      setLoading(false)
    }
  }, [])

  const updatePriority = useCallback(async (pathId: string, priority: number) => {
    await api.updatePriority(pathId, priority)
    refresh()
  }, [refresh])

  const updateStatus = useCallback(async (pathId: string, status: string) => {
    await api.updateStatus(pathId, status)
    refresh()
  }, [refresh])

  return { paths, loading, error, refresh, updatePriority, updateStatus }
}
