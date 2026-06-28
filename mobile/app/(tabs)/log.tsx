import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { colors } from '@/constants/colors'
import { MoodPicker } from '@/components/MoodPicker'
import { WeeklyReviewCard } from '@/components/WeeklyReviewCard'
import { api, PlanItem, WeeklyReview } from '@/lib/api'
import { useTodayPlan } from '@/hooks/useTodayPlan'
import { usePaths } from '@/hooks/usePaths'

type Mood = 'good' | 'okay' | 'tired'

export default function LogScreen() {
  const { plan, refresh: refreshPlan }   = useTodayPlan()
  const { updatePriority, updateStatus } = usePaths()

  const [selectedItem, setSelectedItem] = useState<PlanItem | null>(null)
  const [minutes,      setMinutes]      = useState('')
  const [notes,        setNotes]        = useState('')
  const [mood,         setMood]         = useState<Mood | null>(null)
  const [saving,       setSaving]       = useState(false)

  const [review,        setReview]        = useState<WeeklyReview | null>(null)
  const [reviewLoading, setReviewLoading] = useState(true)

  useEffect(() => {
    refreshPlan()
    loadReview()
  }, [])

  async function loadReview() {
    setReviewLoading(true)
    try {
      setReview(await api.getWeeklyReview())
    } catch {
      // Non-critical — log form still works without review
    } finally {
      setReviewLoading(false)
    }
  }

  const applyRecommendation = useCallback(async (pathId: string, action: string) => {
    if (action === 'increase_priority') {
      await updatePriority(pathId, 1)
    } else if (action === 'pause') {
      await updateStatus(pathId, 'paused')
    } else if (action === 'reduce_scope') {
      await updateStatus(pathId, 'paused')
    }
  }, [updatePriority, updateStatus])

  const pendingItems = plan?.items.filter(i => i.status !== 'done') ?? []

  async function handleLog() {
    if (!minutes || parseInt(minutes) <= 0) {
      Alert.alert('Enter time', 'Please enter how many minutes you spent.')
      return
    }
    setSaving(true)
    try {
      await api.logTask({
        task_id: selectedItem?.task_id,
        path_id: selectedItem?.path_id,
        time_spent_minutes: parseInt(minutes),
        notes: notes.trim() || undefined,
        mood: mood ?? undefined,
      })
      Alert.alert('Logged!', 'Your progress has been saved.')
      setSelectedItem(null)
      setMinutes('')
      setNotes('')
      setMood(null)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <WeeklyReviewCard
          review={review}
          loading={reviewLoading}
          onApplyRecommendation={applyRecommendation}
        />

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Quick Log</Text>

          {/* Task selector */}
          <Text style={styles.label}>Task (optional)</Text>
          <View style={styles.taskList}>
            <TouchableOpacity
              style={[styles.taskOption, !selectedItem && styles.taskOptionActive]}
              onPress={() => setSelectedItem(null)}
            >
              <Text style={[styles.taskOptionText, !selectedItem && styles.taskOptionTextActive]}>
                General / no task
              </Text>
            </TouchableOpacity>
            {pendingItems.map(item => (
              <TouchableOpacity
                key={item.item_id}
                style={[styles.taskOption, selectedItem?.item_id === item.item_id && styles.taskOptionActive]}
                onPress={() => setSelectedItem(item)}
              >
                <Text style={[styles.taskOptionText, selectedItem?.item_id === item.item_id && styles.taskOptionTextActive]}>
                  {item.title}
                </Text>
                <Text style={styles.taskPath}>{item.path_title}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Time */}
          <Text style={styles.label}>Time spent</Text>
          <View style={styles.timeRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={minutes}
              onChangeText={setMinutes}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            <Text style={styles.timeUnit}>minutes</Text>
          </View>

          {/* Mood */}
          <Text style={styles.label}>How did it feel?</Text>
          <MoodPicker value={mood} onChange={setMood} />

          {/* Notes */}
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="What did you learn? Any blockers?"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.logBtn, saving && styles.logBtnOff]}
            onPress={handleLog}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.logBtnText}>Log Progress</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root:                 { flex: 1, backgroundColor: colors.bg },
  scroll:               { padding: 16, paddingBottom: 40 },

  formCard:             { backgroundColor: colors.card, borderRadius: 16, padding: 20,
                          borderWidth: 1, borderColor: colors.border },
  formTitle:            { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 20 },

  label:                { fontSize: 11, color: colors.muted, fontWeight: '700',
                          textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  taskList:             { gap: 8, marginBottom: 20 },
  taskOption:           { backgroundColor: colors.surface, borderRadius: 10, padding: 12,
                          borderWidth: 1, borderColor: colors.border },
  taskOptionActive:     { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  taskOptionText:       { color: colors.textSub, fontSize: 14 },
  taskOptionTextActive: { color: colors.text, fontWeight: '600' },
  taskPath:             { fontSize: 11, color: colors.muted, marginTop: 2 },

  timeRow:              { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  timeUnit:             { color: colors.textSub, fontSize: 14, fontWeight: '500' },

  input:                { backgroundColor: colors.surface, color: colors.text, borderRadius: 12,
                          paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
                          borderWidth: 1, borderColor: colors.border },
  notesInput:           { minHeight: 88, marginBottom: 20 },

  logBtn:               { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16,
                          alignItems: 'center', marginTop: 4 },
  logBtnOff:            { opacity: 0.5 },
  logBtnText:           { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
})
