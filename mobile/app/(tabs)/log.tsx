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
      await updatePriority(pathId, 1)   // bump to highest
    } else if (action === 'pause') {
      await updateStatus(pathId, 'paused')
    } else if (action === 'reduce_scope') {
      await updateStatus(pathId, 'paused')  // user can manually adjust tasks after pausing
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
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Weekly review at top of reflection tab */}
        <WeeklyReviewCard
          review={review}
          loading={reviewLoading}
          onApplyRecommendation={applyRecommendation}
        />

        <Text style={styles.heading}>Quick Log</Text>

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
        <Text style={styles.label}>Time spent (minutes)</Text>
        <TextInput
          style={styles.input}
          value={minutes}
          onChangeText={setMinutes}
          placeholder="e.g. 45"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
        />

        {/* Mood */}
        <Text style={styles.label}>How did it feel?</Text>
        <MoodPicker value={mood} onChange={setMood} />

        {/* Notes */}
        <Text style={[styles.label, { marginTop: 16 }]}>Notes (optional)</Text>
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
          style={[styles.btn, saving && styles.btnDisabled]}
          onPress={handleLog}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Log It</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  scroll:               { padding: 20, paddingBottom: 40 },
  heading:              { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 20 },
  label:                { fontSize: 12, color: colors.muted, textTransform: 'uppercase',
                          letterSpacing: 0.5, marginBottom: 8 },
  taskList:             { gap: 8, marginBottom: 20 },
  taskOption:           { backgroundColor: colors.card, borderRadius: 10, padding: 12,
                          borderWidth: 2, borderColor: 'transparent' },
  taskOptionActive:     { borderColor: colors.primary },
  taskOptionText:       { color: colors.muted, fontSize: 14 },
  taskOptionTextActive: { color: colors.text, fontWeight: '600' },
  taskPath:             { fontSize: 11, color: colors.muted, marginTop: 2 },
  input:                { backgroundColor: colors.card, color: colors.text, borderRadius: 12,
                          padding: 14, fontSize: 15, marginBottom: 20 },
  notesInput:           { minHeight: 80 },
  btn:                  { backgroundColor: colors.primary, borderRadius: 12, padding: 16,
                          alignItems: 'center', marginTop: 4 },
  btnDisabled:          { opacity: 0.5 },
  btnText:              { color: '#fff', fontWeight: '700', fontSize: 16 },
})
