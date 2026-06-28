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

// Priority chips: each level has a distinct color
const PRIORITY_COLOR = ['', colors.danger, colors.warning, colors.violet, colors.teal, colors.muted]
const PRIORITY_BG    = ['', colors.dangerMuted, colors.warningMuted, colors.violetMuted, colors.tealMuted, 'rgba(91,111,138,0.13)']
const PRIORITY_SHORT = ['', 'P1 Critical', 'P2 High', 'P3 Normal', 'P4 Low', 'P5 Minimal']

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

export function PathCard({ path, progress = 0, paceStatus, daysBehind, onPress, onLongPress }: Props) {
  const priority    = Math.min(Math.max(path.priority, 1), 5)
  const chipColor   = PRIORITY_COLOR[priority]
  const chipBg      = PRIORITY_BG[priority]
  const ringColor   = paceStatus ? PACE_COLOR[paceStatus] : colors.violet
  const paceLabel   = paceStatus
    ? daysBehind && daysBehind > 0 ? `${daysBehind}d behind` : PACE_LABEL[paceStatus]
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
      {/* Top row: priority chip + status + pace */}
      <View style={styles.topRow}>
        <View style={[styles.priorityChip, { backgroundColor: chipBg, borderColor: chipColor + '44' }]}>
          <Text style={[styles.priorityText, { color: chipColor }]}>
            {PRIORITY_SHORT[priority]}
          </Text>
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

      {/* Main: title + ring */}
      <View style={styles.mainRow}>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{path.title}</Text>
          <Text style={[styles.sub, { color: colors.textSub }]}>
            {path.status.charAt(0).toUpperCase() + path.status.slice(1)}
          </Text>
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
  priorityChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  priorityText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  chip:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  chipText:     { fontSize: 11, fontWeight: '700' },
  paceChip:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  paceDot:      { width: 6, height: 6, borderRadius: 3 },
  paceText:     { fontSize: 11, fontWeight: '600' },
  mainRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info:         { flex: 1 },
  title:        { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4, lineHeight: 22 },
  sub:          { fontSize: 12 },
})
