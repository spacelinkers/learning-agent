import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '@/constants/colors'
import { LearningPath } from '@/lib/api'
import { ProgressRing } from './ProgressRing'

interface Props {
  path: LearningPath
  progress?: number
  paceStatus?: 'on_track' | 'slight_delay' | 'behind'
  daysBehind?: number
  onPress?: () => void
  onLongPress?: () => void
}

const PACE_COLOR: Record<string, string> = {
  on_track:     colors.success,
  slight_delay: colors.warning,
  behind:       colors.danger,
}

const PACE_LABEL: Record<string, string> = {
  on_track:     'On track',
  slight_delay: 'Slight delay',
  behind:       'Behind',
}

const PRIORITY_SHORT = ['', 'P1', 'P2', 'P3', 'P4', 'P5']
const PRIORITY_FULL  = ['', 'Critical', 'High', 'Normal', 'Low', 'Minimal']

export function PathCard({ path, progress = 0, paceStatus, daysBehind, onPress, onLongPress }: Props) {
  const ringColor = paceStatus ? PACE_COLOR[paceStatus] : colors.primary
  const paceLabel = paceStatus
    ? daysBehind && daysBehind > 0
      ? `${daysBehind}d behind`
      : PACE_LABEL[paceStatus]
    : null
  const isPaused    = path.status === 'paused'
  const isCompleted = path.status === 'completed'

  return (
    <TouchableOpacity
      style={[styles.card, (isPaused || isCompleted) && styles.cardDim]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      {/* Top row: chips */}
      <View style={styles.topRow}>
        <View style={styles.priorityChip}>
          <Text style={styles.priorityText}>{PRIORITY_SHORT[path.priority] ?? `P${path.priority}`}</Text>
        </View>
        {isPaused && (
          <View style={[styles.chip, { backgroundColor: colors.warningMuted }]}>
            <Text style={[styles.chipText, { color: colors.warning }]}>Paused</Text>
          </View>
        )}
        {isCompleted && (
          <View style={[styles.chip, { backgroundColor: colors.successMuted }]}>
            <Text style={[styles.chipText, { color: colors.success }]}>Complete</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {paceLabel && (
          <View style={[styles.paceChip, { backgroundColor: ringColor + '22' }]}>
            <View style={[styles.paceDot, { backgroundColor: ringColor }]} />
            <Text style={[styles.paceText, { color: ringColor }]}>{paceLabel}</Text>
          </View>
        )}
      </View>

      {/* Main content row */}
      <View style={styles.mainRow}>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{path.title}</Text>
          <Text style={styles.sub}>{PRIORITY_FULL[path.priority] ?? 'Normal'} priority</Text>
        </View>
        <ProgressRing progress={progress} size={56} color={ringColor} strokeWidth={5} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card:         { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 12,
                  borderWidth: 1, borderColor: colors.border },
  cardDim:      { opacity: 0.65 },
  topRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  priorityChip: { backgroundColor: colors.primaryMuted, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityText: { color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  chip:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText:     { fontSize: 11, fontWeight: '700' },
  paceChip:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  paceDot:      { width: 6, height: 6, borderRadius: 3 },
  paceText:     { fontSize: 11, fontWeight: '600' },
  mainRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info:         { flex: 1 },
  title:        { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4, lineHeight: 22 },
  sub:          { fontSize: 12, color: colors.textSub },
})
