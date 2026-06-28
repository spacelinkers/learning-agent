import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '@/constants/colors'
import { PlanItem } from '@/lib/api'

interface Props {
  item: PlanItem
  onDone: () => void
  onSkip: () => void
}

export function TaskCard({ item, onDone, onSkip }: Props) {
  const isDone   = item.status === 'done'
  const isMissed = item.status === 'missed'
  const isActive = !isDone && !isMissed

  // Accent color tells the story at a glance
  const accentColor = item.is_rollover
    ? colors.rollover   // rose — attention needed
    : isDone
      ? colors.success  // emerald — completed
      : isMissed
        ? colors.muted  // grey — skipped
        : colors.primary // indigo — active

  return (
    <View style={[styles.card, isDone && styles.cardDone, isMissed && styles.cardMissed]}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.body}>

        {(item.is_rollover || item.needs_review) && (
          <View style={styles.badgeRow}>
            {item.is_rollover && (
              <View style={[styles.chip, { backgroundColor: colors.rolloverMuted }]}>
                <Text style={[styles.chipText, { color: colors.rollover }]}>↺ Rollover</Text>
              </View>
            )}
            {item.needs_review && (
              <View style={[styles.chip, { backgroundColor: colors.dangerMuted }]}>
                <Text style={[styles.chipText, { color: colors.danger }]}>Review needed</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.pathLabel}>{item.path_title}</Text>

        <Text style={[styles.title, (isDone || isMissed) && styles.titleDim]} numberOfLines={2}>
          {item.title}
        </Text>

        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.timeChip}>
            <Text style={styles.timeChipText}>{Math.round(item.estimated_hours * 60)} min</Text>
          </View>
          {(item.rollover_count ?? 0) > 0 && (
            <Text style={[styles.rolloverCount, { color: colors.rollover }]}>
              ×{item.rollover_count} rolled over
            </Text>
          )}
        </View>

        {isActive && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
              onPress={onDone}
              activeOpacity={0.8}
            >
              <Text style={styles.doneBtnText}>✓  Mark Done</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.8}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}

        {isDone && (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.statusText, { color: colors.success }]}>Completed</Text>
          </View>
        )}
        {isMissed && (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.muted }]} />
            <Text style={[styles.statusText, { color: colors.muted }]}>Skipped</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card:          { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 14,
                   marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardDone:      { opacity: 0.65 },
  cardMissed:    { opacity: 0.45 },
  accent:        { width: 4 },
  body:          { flex: 1, padding: 14 },
  badgeRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  chipText:      { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  pathLabel:     { fontSize: 10, color: colors.primary, fontWeight: '700',
                   textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  title:         { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4, lineHeight: 21 },
  titleDim:      { color: colors.muted },
  description:   { fontSize: 13, color: colors.textSub, marginBottom: 8, lineHeight: 18 },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  timeChip:      { backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  timeChipText:  { fontSize: 12, color: colors.textSub, fontWeight: '500' },
  rolloverCount: { fontSize: 12 },
  actions:       { flexDirection: 'row', gap: 10 },
  doneBtn:       { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  doneBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  skipBtn:       { paddingHorizontal: 18, paddingVertical: 10,
                   borderWidth: 1, borderColor: colors.borderLight, borderRadius: 10, alignItems: 'center' },
  skipBtnText:   { color: colors.textSub, fontSize: 14 },
  statusRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  statusText:    { fontSize: 13, fontWeight: '600' },
})
