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
  on_track:    colors.success,
  slight_delay: colors.warning,
  behind:      colors.danger,
}

const PACE_LABEL: Record<string, string> = {
  on_track:    'On track',
  slight_delay: 'Slight delay',
  behind:      'Behind',
}

const PRIORITY_LABELS = ['', 'P1 — Critical', 'P2 — High', 'P3 — Normal', 'P4 — Low', 'P5 — Minimal']

export function PathCard({ path, progress = 0, paceStatus, daysBehind, onPress, onLongPress }: Props) {
  const ringColor = paceStatus ? PACE_COLOR[paceStatus] : colors.primary
  const paceLabel = paceStatus
    ? daysBehind && daysBehind > 0
      ? `${daysBehind} day${daysBehind > 1 ? 's' : ''} behind`
      : PACE_LABEL[paceStatus]
    : null

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={styles.priority}>{PRIORITY_LABELS[path.priority]}</Text>
          <Text style={styles.title} numberOfLines={2}>{path.title}</Text>
          {paceLabel && (
            <Text style={[styles.pace, { color: ringColor }]}>{paceLabel}</Text>
          )}
          <Text style={[styles.status, path.status === 'paused' && styles.paused]}>
            {path.status.charAt(0).toUpperCase() + path.status.slice(1)}
          </Text>
        </View>
        <ProgressRing progress={progress} size={64} color={ringColor} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card:     { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 16 },
  info:     { flex: 1 },
  priority: { fontSize: 11, color: colors.primary, fontWeight: '600',
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title:    { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  pace:     { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  status:   { fontSize: 12, color: colors.muted },
  paused:   { color: colors.warning },
})
