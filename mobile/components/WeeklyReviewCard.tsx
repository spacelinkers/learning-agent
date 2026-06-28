import React, { useState } from 'react'
import {
  ActivityIndicator, Alert, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import { colors } from '@/constants/colors'
import { WeeklyReview, api } from '@/lib/api'

interface Props {
  review: WeeklyReview | null
  loading: boolean
  onApplyRecommendation?: (pathId: string, action: string) => Promise<void>
}

const ACTION_LABEL: Record<string, string> = {
  increase_priority: '↑ Boost',
  reduce_scope:      '✂ Reduce',
  pause:             '⏸ Pause',
  continue:          '✓ On track',
}

const ACTION_COLOR: Record<string, string> = {
  increase_priority: colors.primary,
  reduce_scope:      colors.warning,
  pause:             colors.warning,
  continue:          colors.success,
}

export function WeeklyReviewCard({ review, loading, onApplyRecommendation }: Props) {
  const [applying, setApplying] = useState<string | null>(null)

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading review…</Text>
      </View>
    )
  }

  if (!review) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyHeader}>
          <Text style={styles.emptyIcon}>📊</Text>
          <View>
            <Text style={styles.emptyTitle}>Weekly Review</Text>
            <Text style={styles.emptySubtitle}>Generated every Sunday at 9 PM</Text>
          </View>
        </View>
        <Text style={styles.emptyText}>Keep learning — check back at the end of the week!</Text>
      </View>
    )
  }

  async function handleApply(rec: WeeklyReview['recommendations'][0]) {
    if (!onApplyRecommendation) return
    setApplying(rec.path_id)
    try {
      await onApplyRecommendation(rec.path_id, rec.action)
      Alert.alert('Applied', `Updated "${rec.path_title}".`)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setApplying(null)
    }
  }

  const weekLabel = `${review.week_start} → ${review.week_end}`

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.weekBadge}>{weekLabel}</Text>
        <Text style={styles.cardTitle}>📊 Weekly Review</Text>
      </View>

      <Text style={styles.summary}>{review.summary}</Text>

      {review.highlights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Highlights</Text>
          {review.highlights.map((h, i) => (
            <View key={i} style={[styles.bulletRow, { borderLeftColor: colors.success }]}>
              <Text style={styles.bulletText}>{h}</Text>
            </View>
          ))}
        </View>
      )}

      {review.concerns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Concerns</Text>
          {review.concerns.map((c, i) => (
            <View key={i} style={[styles.bulletRow, { borderLeftColor: colors.warning }]}>
              <Text style={styles.bulletText}>{c}</Text>
            </View>
          ))}
        </View>
      )}

      {review.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recommendations</Text>
          {review.recommendations.map((rec, i) => {
            const actionColor = ACTION_COLOR[rec.action] ?? colors.primary
            return (
              <View key={i} style={styles.recRow}>
                <View style={styles.recInfo}>
                  <Text style={styles.recPath}>{rec.path_title}</Text>
                  <Text style={styles.recReason}>{rec.reason}</Text>
                </View>
                {onApplyRecommendation && rec.action !== 'continue' ? (
                  <TouchableOpacity
                    style={[
                      styles.applyBtn,
                      { backgroundColor: actionColor + '22', borderColor: actionColor + '55' },
                      applying === rec.path_id && styles.applyBtnOff,
                    ]}
                    onPress={() => handleApply(rec)}
                    disabled={applying !== null}
                  >
                    {applying === rec.path_id
                      ? <ActivityIndicator size="small" color={actionColor} />
                      : <Text style={[styles.applyBtnText, { color: actionColor }]}>
                          {ACTION_LABEL[rec.action]}
                        </Text>
                    }
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.applyBtn, { backgroundColor: colors.successMuted, borderColor: colors.success + '44' }]}>
                    <Text style={[styles.applyBtnText, { color: colors.success }]}>
                      {ACTION_LABEL.continue}
                    </Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      )}

      {review.next_week_focus && (
        <View style={styles.focusBox}>
          <Text style={styles.focusLabel}>Next Week</Text>
          <Text style={styles.focusText}>{review.next_week_focus}</Text>
        </View>
      )}

      <Text style={styles.encouragement}>{review.encouragement}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card:             { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16,
                      borderWidth: 1, borderColor: colors.border },

  cardHeader:       { marginBottom: 12 },
  weekBadge:        { fontSize: 11, color: colors.muted, marginBottom: 4, fontWeight: '500' },
  cardTitle:        { fontSize: 18, fontWeight: '800', color: colors.text },

  summary:          { fontSize: 14, color: colors.textSub, lineHeight: 21, marginBottom: 16 },

  section:          { marginBottom: 16 },
  sectionLabel:     { fontSize: 10, color: colors.muted, fontWeight: '700', textTransform: 'uppercase',
                      letterSpacing: 0.8, marginBottom: 8 },
  bulletRow:        { borderLeftWidth: 2, paddingLeft: 10, marginBottom: 6, paddingVertical: 2 },
  bulletText:       { fontSize: 13, color: colors.text, lineHeight: 19 },

  recRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
                      backgroundColor: colors.surface, borderRadius: 10, padding: 10,
                      borderWidth: 1, borderColor: colors.border },
  recInfo:          { flex: 1 },
  recPath:          { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 },
  recReason:        { fontSize: 12, color: colors.textSub, lineHeight: 17 },
  applyBtn:         { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
                      minWidth: 74, alignItems: 'center' },
  applyBtnOff:      { opacity: 0.5 },
  applyBtnText:     { fontSize: 11, fontWeight: '700' },

  focusBox:         { backgroundColor: colors.surface, borderRadius: 10, padding: 12,
                      marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  focusLabel:       { fontSize: 10, color: colors.muted, fontWeight: '700', textTransform: 'uppercase',
                      letterSpacing: 0.8, marginBottom: 6 },
  focusText:        { fontSize: 13, color: colors.text, lineHeight: 20 },

  encouragement:    { fontSize: 13, color: colors.primary, fontStyle: 'italic', marginTop: 4 },

  loadingText:      { color: colors.muted, textAlign: 'center', marginTop: 8 },
  emptyHeader:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  emptyIcon:        { fontSize: 28 },
  emptyTitle:       { fontSize: 16, fontWeight: '700', color: colors.text },
  emptySubtitle:    { fontSize: 11, color: colors.muted, marginTop: 2 },
  emptyText:        { fontSize: 13, color: colors.textSub, lineHeight: 20 },
})
