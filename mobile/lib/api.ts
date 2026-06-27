import { getSupabaseToken } from './auth'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlanItem {
  item_id: string
  task_id: string
  path_id: string
  title: string
  path_title: string
  description?: string
  estimated_hours: number
  suggested_order: number
  is_rollover: boolean
  status: 'pending' | 'done' | 'missed'
  rollover_count: number
  needs_review: boolean
}

export interface TodayPlan {
  plan_id: string
  date: string
  hours_budget: number
  status: string
  items: PlanItem[]
}

export interface LearningPath {
  id: string
  user_id: string
  title: string
  priority: number
  status: 'active' | 'paused' | 'completed' | 'archived'
  estimated_days?: number
  start_date?: string
  target_date?: string
  source: string
  created_at: string
}

export interface TaskPreview {
  title: string
  estimated_hours: number
  sequence_order: number
}

export interface TrackPreview {
  title: string
  estimated_days: number
  subtopics: TaskPreview[]
}

export interface SchedulePreview {
  title: string
  tracks: TrackPreview[]
}

export interface WeeklyReview {
  id: string
  user_id: string
  week_start: string
  week_end: string
  summary: string
  highlights: string[]
  concerns: string[]
  recommendations: Array<{
    path_id: string
    path_title: string
    action: 'increase_priority' | 'reduce_scope' | 'pause' | 'continue'
    reason: string
  }>
  next_week_focus: string
  encouragement: string
  created_at: string
}

export interface LearningTask {
  id: string
  title: string
  description?: string
  estimated_hours: number
  sequence_order: number
  status: 'pending' | 'suggested' | 'completed' | 'skipped'
  rollover_count: number
}

export interface LearningTrack {
  id: string
  title: string
  estimated_days: number
  sequence_order: number
  status: 'pending' | 'active' | 'completed'
  learning_tasks: LearningTask[]
}

export interface PathDetail extends LearningPath {
  learning_tracks: LearningTrack[]
}

export interface LogData {
  task_id?: string
  path_id?: string
  date?: string
  time_spent_minutes: number
  notes?: string
  mood?: 'good' | 'okay' | 'tired'
}

// ── Client ────────────────────────────────────────────────────────────────────

async function apiCall<T = unknown>(
  endpoint: string,
  method = 'GET',
  body?: object,
): Promise<T> {
  const token = await getSupabaseToken()
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).detail ?? `API error ${res.status}`)
  }
  return res.json() as T
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export const api = {
  // Plan
  getTodayPlan:   ()                            => apiCall<TodayPlan>('/api/plan/today'),
  generatePlan:   ()                            => apiCall('/api/plan/generate', 'POST'),
  markDone:       (id: string)                  => apiCall(`/api/plan/item/${id}/done`, 'POST'),
  skipTask:       (id: string)                  => apiCall(`/api/plan/item/${id}/skip`, 'POST'),

  // Schedule import
  parsePlan:      (text: string)                => apiCall<SchedulePreview>('/api/schedule/parse', 'POST', { raw_text: text }),
  savePlan:       (s: SchedulePreview, p: number) =>
    apiCall('/api/schedule/save', 'POST', { approved_schedule: s, priority: p }),

  // Paths
  getPaths:       ()                            => apiCall<LearningPath[]>('/api/paths'),
  getPath:        (id: string)                  => apiCall<PathDetail>(`/api/paths/${id}`),
  updatePriority: (id: string, priority: number) =>
    apiCall(`/api/paths/${id}/priority`, 'PUT', { priority }),
  updateStatus:   (id: string, status: string) =>
    apiCall(`/api/paths/${id}/status`, 'PUT', { status }),

  // Log
  logTask:        (data: LogData)               => apiCall('/api/log', 'POST', data),
  getWeeklySummary: ()                          => apiCall('/api/log/weekly'),

  // User
  savePushToken:    (token: string)             => apiCall('/api/user/push-token', 'POST', { token }),

  // Weekly review
  getWeeklyReview:  ()                          => apiCall<WeeklyReview | null>('/api/review/weekly'),
  triggerReview:    ()                          => apiCall('/api/review/generate', 'POST'),
}
