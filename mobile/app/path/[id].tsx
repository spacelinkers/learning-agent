import { useEffect, useState } from 'react'
import {
  ActivityIndicator, BackHandler, FlatList, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/colors'
import { ProgressRing } from '@/components/ProgressRing'
import { api, PathDetail, LearningTrack, LearningTask } from '@/lib/api'

const STATUS_COLOR: Record<string, string> = {
  completed: colors.success,
  skipped:   colors.muted,
  suggested: colors.primary,
  active:    colors.primary,
  pending:   colors.muted,
}

const PRIORITY_LABEL: Record<number, string> = {
  1: 'Critical', 2: 'High', 3: 'Normal', 4: 'Low', 5: 'Minimal',
}

function TaskRow({ task }: { task: LearningTask }) {
  const [expanded, setExpanded] = useState(false)
  const done           = task.status === 'completed'
  const hasDescription = !!task.description?.trim()
  const statusColor    = STATUS_COLOR[task.status] ?? colors.muted

  return (
    <TouchableOpacity
      style={[styles.taskRow, done && styles.taskRowDone]}
      onPress={() => hasDescription && setExpanded(e => !e)}
      activeOpacity={hasDescription ? 0.7 : 1}
    >
      <View style={[styles.taskDot, { backgroundColor: statusColor }]} />
      <View style={styles.taskInfo}>
        <View style={styles.taskTitleRow}>
          <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={expanded ? undefined : 2}>
            {task.title}
          </Text>
          {hasDescription && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.muted}
            />
          )}
        </View>
        {expanded && hasDescription && (
          <Text style={styles.taskDesc}>{task.description}</Text>
        )}
        <View style={styles.taskMeta}>
          <View style={styles.taskTimeChip}>
            <Text style={styles.taskTimeText}>{task.estimated_hours}h</Text>
          </View>
          {(task.rollover_count ?? 0) > 0 && (
            <Text style={styles.taskRollover}>×{task.rollover_count} rollover</Text>
          )}
          <View style={{ flex: 1 }} />
          <Text style={[styles.taskStatus, { color: statusColor }]}>
            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function TrackSection({ track }: { track: LearningTrack }) {
  const tasks = track.learning_tasks ?? []
  const done  = tasks.filter(t => t.status === 'completed').length
  const total = tasks.length
  const pct   = total > 0 ? done / total : 0

  return (
    <View style={styles.trackBlock}>
      <View style={styles.trackHeader}>
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle}>{track.title}</Text>
          <Text style={styles.trackMeta}>{done}/{total} tasks · {track.estimated_days ?? '?'}d</Text>
        </View>
        <View style={styles.trackProgress}>
          <View style={styles.trackProgressBg}>
            <View style={[styles.trackProgressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
          </View>
          <Text style={styles.trackPct}>{Math.round(pct * 100)}%</Text>
        </View>
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

  // Intercept Android hardware/gesture back — always go to Paths tab
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/paths' as any)
      return true
    })
    return () => sub.remove()
  }, [router])

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
  const pct = totalTasks > 0 ? doneTasks / totalTasks : 0

  return (
    <View style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={t => t.id}
        renderItem={({ item }) => <TrackSection track={item} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => router.replace('/(tabs)/paths' as any)}
            >
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
              <Text style={styles.backLabel}>My Paths</Text>
            </TouchableOpacity>

            <View style={styles.heroCard}>
              <View style={styles.heroLeft}>
                <View style={styles.heroChipRow}>
                  <View style={styles.priorityChip}>
                    <Text style={styles.priorityChipText}>
                      P{path.priority} · {PRIORITY_LABEL[path.priority] ?? 'Normal'}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusChip,
                    path.status === 'paused'
                      ? { backgroundColor: colors.warningMuted }
                      : { backgroundColor: colors.primaryMuted },
                  ]}>
                    <Text style={[
                      styles.statusChipText,
                      { color: path.status === 'paused' ? colors.warning : colors.primary },
                    ]}>
                      {path.status.charAt(0).toUpperCase() + path.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.pathTitle}>{path.title}</Text>
                <Text style={styles.pathMeta}>
                  {tracks.length} tracks · {totalTasks} tasks · {doneTasks} done
                </Text>
              </View>
              <ProgressRing progress={pct} size={64} color={colors.primary} strokeWidth={5} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No tracks found.</Text>
            <Text style={styles.emptyHint}>Try re-importing from the Import tab.</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.bg },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText:         { color: colors.danger, marginBottom: 16, textAlign: 'center' },
  backBtn:           { padding: 12 },
  backBtnText:       { color: colors.primary, fontSize: 15 },

  list:              { paddingHorizontal: 16, paddingBottom: 40 },

  header:            { marginBottom: 8 },
  backRow:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  backLabel:         { color: colors.primary, fontSize: 14, fontWeight: '600' },

  heroCard:          { backgroundColor: colors.card, borderRadius: 16, padding: 16,
                       flexDirection: 'row', alignItems: 'center', gap: 12,
                       borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  heroLeft:          { flex: 1 },
  heroChipRow:       { flexDirection: 'row', gap: 6, marginBottom: 8 },
  priorityChip:      { backgroundColor: colors.primaryMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityChipText:  { color: colors.primary, fontSize: 11, fontWeight: '700' },
  statusChip:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusChipText:    { fontSize: 11, fontWeight: '700' },
  pathTitle:         { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4, lineHeight: 24 },
  pathMeta:          { fontSize: 12, color: colors.textSub },

  trackBlock:        { marginBottom: 20 },
  trackHeader:       { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  trackInfo:         { flex: 1 },
  trackTitle:        { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  trackMeta:         { fontSize: 12, color: colors.textSub },
  trackProgress:     { alignItems: 'flex-end', gap: 3, minWidth: 56 },
  trackProgressBg:   { height: 3, width: 56, backgroundColor: colors.surface, borderRadius: 2 },
  trackProgressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  trackPct:          { fontSize: 10, color: colors.muted, fontWeight: '600' },
  noTasksText:       { color: colors.muted, fontSize: 12, paddingLeft: 18 },

  taskRow:           { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10,
                       paddingHorizontal: 12, backgroundColor: colors.card,
                       borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: colors.border },
  taskRowDone:       { opacity: 0.5 },
  taskDot:           { width: 8, height: 8, borderRadius: 4, marginRight: 10, marginTop: 5, flexShrink: 0 },
  taskInfo:          { flex: 1 },
  taskTitleRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  taskTitle:         { flex: 1, color: colors.text, fontSize: 13, fontWeight: '500', lineHeight: 19 },
  taskTitleDone:     { color: colors.muted, textDecorationLine: 'line-through' },
  taskDesc:          { color: colors.textSub, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 2 },
  taskMeta:          { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  taskTimeChip:      { backgroundColor: colors.surface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  taskTimeText:      { fontSize: 11, color: colors.textSub, fontWeight: '500' },
  taskRollover:      { fontSize: 11, color: colors.rollover },
  taskStatus:        { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },

  emptyText:         { color: colors.textSub, textAlign: 'center', fontSize: 15, marginBottom: 8 },
  emptyHint:         { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
})
