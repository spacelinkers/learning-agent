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

  return (
    <View style={[styles.card, isDone && styles.cardDone, isMissed && styles.cardMissed]}>
      {/* Badges */}
      <View style={styles.badges}>
        {item.is_rollover && (
          <View style={[styles.badge, { backgroundColor: colors.rollover + '33' }]}>
            <Text style={[styles.badgeText, { color: colors.rollover }]}>🔄 Rollover</Text>
          </View>
        )}
        {item.needs_review && (
          <View style={[styles.badge, { backgroundColor: colors.danger + '22' }]}>
            <Text style={[styles.badgeText, { color: colors.danger }]}>⚠️ Needs review</Text>
          </View>
        )}
      </View>

      <Text style={styles.pathLabel}>{item.path_title}</Text>
      <Text style={[styles.title, (isDone || isMissed) && styles.titleDim]}>{item.title}</Text>

      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      ) : null}

      <Text style={styles.time}>{Math.round(item.estimated_hours * 60)} min</Text>

      {isActive && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>✓ Done</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.8}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {isDone   && <Text style={[styles.statusLine, { color: colors.success }]}>✓ Completed</Text>}
      {isMissed && <Text style={[styles.statusLine, { color: colors.muted }]}>— Skipped</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card:        { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardDone:    { opacity: 0.6 },
  cardMissed:  { opacity: 0.45 },
  badges:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:   { fontSize: 11, fontWeight: '600' },
  pathLabel:   { fontSize: 11, color: colors.primary, fontWeight: '600',
                 textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  title:       { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  titleDim:    { color: colors.muted },
  description: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  time:        { fontSize: 12, color: colors.muted, marginBottom: 12 },
  actions:     { flexDirection: 'row', gap: 10 },
  doneBtn:     { flex: 1, backgroundColor: colors.primary, borderRadius: 10,
                 paddingVertical: 10, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  skipBtn:     { paddingHorizontal: 20, paddingVertical: 10,
                 borderWidth: 1, borderColor: colors.muted, borderRadius: 10, alignItems: 'center' },
  skipBtnText: { color: colors.muted, fontSize: 14 },
  statusLine:  { fontSize: 13, fontWeight: '600', marginTop: 4 },
})
