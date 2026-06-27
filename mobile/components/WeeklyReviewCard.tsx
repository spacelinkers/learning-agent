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
  increase_priority: '↑ Boost priority',
  reduce_scope:      '✂ Reduce scope',
  pause:             '⏸ Pause path',
  continue:          '✓ Keep going',
}

const ACTION_DESTRUCTIVE = new Set(['pause', 'reduce_scope'])

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
        <Text style={styles.emptyTitle}>📊 Weekly Review</Text>
        <Text style={styles.emptyText}>
          Your review is generated every Sunday at 9 PM.{'\n'}
          Keep learning — see you at the end of the week!
        </Text>
      </View>
    )
  }

  async function handleApply(rec: WeeklyReview['recommendations'][0]) {
    if (!onApplyRecommendation) return
    setApplying(rec.path_id)
    try {
      await onApplyRecommendation(rec.path_id, rec.action)
      Alert.alert('Applied', `Recommendation applied for "${rec.path_title}".`)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setApplying(null)
    }
  }

  const weekLabel = `${review.week_start} → ${review.week_end}`

  return (
    <View style={styles.card}>
      <Text style={styles.weekLabel}>{weekLabel}</Text>
      <Text style={styles.title}>📊 Weekly Review</Text>
      <Text style={styles.summary}>{review.summary}</Text>

      {review.highlights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✅ Highlights</Text>
          {review.highlights.map((h, i) => (
            <Text key={i} style={[styles.bullet, { color: colors.success }]}>• {h}</Text>
          ))}
        </View>
      )}

      {review.concerns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Concerns</Text>
          {review.concerns.map((c, i) => (
            <Text key={i} style={[styles.bullet, { color: colors.warning }]}>• {c}</Text>
          ))}
        </View>
      )}

      {review.recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Recommendations</Text>
          {review.recommendations.map((rec, i) => (
            <View key={i} style={styles.rec}>
              <View style={styles.recInfo}>
                <Text style={styles.recPath}>{rec.path_title}</Text>
                <Text style={styles.recReason}>{rec.reason}</Text>
              </View>
              {onApplyRecommendation && rec.action !== 'continue' && (
                <TouchableOpacity
                  style={[
                    styles.applyBtn,
                    ACTION_DESTRUCTIVE.has(rec.action) && styles.applyBtnWarn,
                    applying === rec.path_id && styles.applyBtnDisabled,
                  ]}
                  onPress={() => handleApply(rec)}
                  disabled={applying !== null}
                >
                  {applying === rec.path_id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.applyBtnText}>{ACTION_LABEL[rec.action]}</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {review.next_week_focus && (
        <View style={[styles.section, styles.focusBox]}>
          <Text style={styles.sectionTitle}>🎯 Next Week</Text>
          <Text style={styles.focusText}>{review.next_week_focus}</Text>
        </View>
      )}

      <Text style={styles.encouragement}>{review.encouragement}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card:             { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 20 },
  weekLabel:        { fontSize: 11, color: colors.muted, marginBottom: 4 },
  title:            { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  summary:          { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 12 },
  section:          { marginBottom: 12 },
  sectionTitle:     { fontSize: 12, fontWeight: '700', color: colors.muted,
                      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  bullet:           { fontSize: 13, lineHeight: 20, marginBottom: 2 },
  rec:              { flexDirection: 'row', alignItems: 'center', gap: 10,
                      marginBottom: 8, backgroundColor: colors.bg,
                      borderRadius: 10, padding: 10 },
  recInfo:          { flex: 1 },
  recPath:          { fontSize: 13, fontWeight: '700', color: colors.text },
  recReason:        { fontSize: 12, color: colors.muted, marginTop: 2 },
  applyBtn:         { backgroundColor: colors.primary, borderRadius: 8,
                      paddingHorizontal: 10, paddingVertical: 6 },
  applyBtnWarn:     { backgroundColor: colors.warning },
  applyBtnDisabled: { opacity: 0.5 },
  applyBtnText:     { color: '#fff', fontSize: 11, fontWeight: '700' },
  focusBox:         { backgroundColor: colors.bg, borderRadius: 10, padding: 10 },
  focusText:        { fontSize: 13, color: colors.text, lineHeight: 20 },
  encouragement:    { fontSize: 13, color: colors.primary, fontStyle: 'italic', marginTop: 4 },
  loadingText:      { color: colors.muted, textAlign: 'center', marginTop: 8 },
  emptyTitle:       { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptyText:        { fontSize: 13, color: colors.muted, lineHeight: 20 },
})
