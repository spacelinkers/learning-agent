import { useEffect, useState } from 'react'
import {
  ActivityIndicator, FlatList, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { colors } from '@/constants/colors'
import { api, PathDetail, LearningTrack, LearningTask } from '@/lib/api'

const STATUS_COLOR: Record<string, string> = {
  completed: colors.success,
  skipped:   colors.muted,
  suggested: colors.primary,
  active:    colors.primary,
  pending:   colors.muted,
}

const PRIORITY_LABEL: Record<number, string> = {
  1: 'P1 — Critical', 2: 'P2 — High', 3: 'P3 — Normal',
  4: 'P4 — Low',      5: 'P5 — Minimal',
}

function TaskRow({ task }: { task: LearningTask }) {
  const [expanded, setExpanded] = useState(false)
  const done = task.status === 'completed'
  const hasDescription = !!task.description?.trim()

  return (
    <TouchableOpacity
      style={[styles.taskRow, done && styles.taskDone]}
      onPress={() => hasDescription && setExpanded(e => !e)}
      activeOpacity={hasDescription ? 0.7 : 1}
    >
      <View style={[styles.taskDot, { backgroundColor: STATUS_COLOR[task.status] ?? colors.muted }]} />
      <View style={styles.taskInfo}>
        <Text style={[styles.taskTitle, done && styles.strikethrough]}>
          {task.title}
          {hasDescription ? (expanded ? '  ▲' : '  ▼') : ''}
        </Text>
        {expanded && hasDescription && (
          <Text style={styles.taskDescription}>{task.description}</Text>
        )}
        <Text style={styles.taskMeta}>
          {task.estimated_hours}h
          {(task.rollover_count ?? 0) > 0 ? `  •  🔄 ×${task.rollover_count}` : ''}
        </Text>
      </View>
      <Text style={[styles.taskStatus, { color: STATUS_COLOR[task.status] ?? colors.muted }]}>
        {task.status}
      </Text>
    </TouchableOpacity>
  )
}

function TrackSection({ track }: { track: LearningTrack }) {
  const tasks = track.learning_tasks ?? []
  const done  = tasks.filter(t => t.status === 'completed').length
  const total = tasks.length

  return (
    <View style={styles.trackBlock}>
      <View style={styles.trackHeader}>
        <Text style={styles.trackTitle}>{track.title}</Text>
        <Text style={styles.trackMeta}>{done}/{total} · {track.estimated_days ?? '?'}d</Text>
      </View>
      {tasks.length === 0
        ? <Text style={styles.noTasksText}>No tasks in this track.</Text>
        : tasks.map(task => <TaskRow key={task.id} task={task} />)
      }
    </View>
  )
}

export default function PathDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router  = useRouter()
  const [path, setPath]       = useState<PathDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!id) { setError('No path ID'); setLoading(false); return }
    api.getPath(id)
      .then(setPath)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }
  if (error || !path) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Path not found'}</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/paths' as any)} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const tracks     = path.learning_tracks ?? []
  const totalTasks = tracks.reduce((n, t) => n + (t.learning_tasks ?? []).length, 0)
  const doneTasks  = tracks.reduce(
    (n, t) => n + (t.learning_tasks ?? []).filter(tk => tk.status === 'completed').length, 0,
  )
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/paths' as any)}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.pathTitle}>{path.title}</Text>
          <Text style={styles.pathMeta}>
            {PRIORITY_LABEL[path.priority] ?? `P${path.priority}`}
            {'  ·  '}{path.status}
            {'  ·  '}{pct}% done
          </Text>
          <Text style={styles.pathMeta}>
            {tracks.length} tracks · {totalTasks} tasks
          </Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
        </View>
      </View>

      {/* Tracks */}
      <FlatList
        data={tracks}
        keyExtractor={t => t.id}
        renderItem={({ item }) => <TrackSection track={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No tracks found.</Text>
            <Text style={styles.emptyHint}>
              This path may have been imported before tracks were saved.{'\n'}
              Try re-importing the schedule from the Import tab.
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText:    { color: colors.danger, marginBottom: 16, textAlign: 'center' },
  backBtn:      { padding: 12 },
  backBtnText:  { color: colors.primary, fontSize: 15 },

  header:       { backgroundColor: colors.card, padding: 16, paddingTop: 20, gap: 6, flexDirection: 'row' },
  back:         { color: colors.primary, fontSize: 24, marginRight: 12, lineHeight: 32 },
  headerInfo:   { flex: 1 },
  pathTitle:    { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  pathMeta:     { color: colors.muted, fontSize: 12, marginBottom: 4 },
  progressBg:   { height: 4, backgroundColor: colors.bg, borderRadius: 2, marginTop: 4 },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },

  list:         { padding: 16, paddingBottom: 40 },
  emptyText:    { color: colors.muted, textAlign: 'center', fontSize: 15, marginBottom: 8 },
  emptyHint:    { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },

  trackBlock:   { marginBottom: 24 },
  trackHeader:  { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 8 },
  trackTitle:   { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  trackMeta:    { color: colors.muted, fontSize: 12 },
  noTasksText:  { color: colors.muted, fontSize: 12, paddingLeft: 4 },

  taskRow:        { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
                    paddingHorizontal: 12, backgroundColor: colors.card,
                    borderRadius: 8, marginBottom: 6 },
  taskDone:       { opacity: 0.5 },
  taskDot:        { width: 8, height: 8, borderRadius: 4, marginRight: 10, marginTop: 5 },
  taskInfo:       { flex: 1 },
  taskTitle:      { color: colors.text, fontSize: 13, fontWeight: '500', marginBottom: 4 },
  strikethrough:  { textDecorationLine: 'line-through', color: colors.muted },
  taskDescription:{ color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 6,
                    marginTop: 2 },
  taskMeta:       { color: colors.muted, fontSize: 11 },
  taskStatus:     { fontSize: 11, fontWeight: '600', marginLeft: 8, textTransform: 'capitalize',
                    marginTop: 2 },
})
