import { useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { colors } from '@/constants/colors'
import { api, SchedulePreview, TaskPreview, TrackPreview } from '@/lib/api'

// ── Editable state types ───────────────────────────────────────────────────────

type EditTask = TaskPreview & { _key: string }

type EditTrack = {
  title: string
  estimated_days: number
  subtopics: EditTask[]
  _key: string
  _expanded: boolean
}

type EditSchedule = { title: string; tracks: EditTrack[] }

function toEdit(preview: SchedulePreview): EditSchedule {
  return {
    title: preview.title,
    tracks: preview.tracks.map((t, ti) => ({
      title: t.title,
      estimated_days: t.estimated_days,
      _key: `t${ti}`,
      _expanded: true,
      subtopics: (t.subtopics ?? []).map((s, si) => ({
        ...s,
        description: s.description ?? '',
        _key: `t${ti}s${si}`,
      })),
    })),
  }
}

function toPreview(s: EditSchedule): SchedulePreview {
  return {
    title: s.title,
    tracks: s.tracks.map((t, ti) => ({
      title: t.title,
      estimated_days: Number(t.estimated_days) || 7,
      subtopics: t.subtopics.map((sk, si) => ({
        title: sk.title,
        description: sk.description,
        estimated_hours: Number(sk.estimated_hours) || 1,
        sequence_order: si + 1,
      })),
    })),
  }
}

// ── Helper: unique key ─────────────────────────────────────────────────────────

let _uid = 0
const uid = () => String(++_uid)

// ── Subcomponents ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>
}

function Field({
  label, value, onChangeText, multiline = false, keyboardType = 'default',
}: {
  label: string; value: string; onChangeText: (v: string) => void
  multiline?: boolean; keyboardType?: any
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={colors.muted}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function ImportScreen() {
  const router = useRouter()

  const [rawText,        setRawText]        = useState('')
  const [schedule,       setSchedule]       = useState<EditSchedule | null>(null)
  const [priority,       setPriority]       = useState(3)
  const [startDate,      setStartDate]      = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [parsing,        setParsing]        = useState(false)
  const [saving,         setSaving]         = useState(false)

  // ── Parse ──────────────────────────────────────────────────────────────────

  async function handleParse() {
    if (!rawText.trim()) return
    setParsing(true)
    setSchedule(null)
    try {
      const result = await api.parsePlan(rawText)
      setSchedule(toEdit(result))
    } catch (e: any) {
      Alert.alert('Parse failed', e.message)
    } finally {
      setParsing(false)
    }
  }

  // ── Schedule mutations ─────────────────────────────────────────────────────

  function setTitle(title: string) {
    setSchedule(s => s ? { ...s, title } : s)
  }

  function setTrack(ti: number, patch: Partial<EditTrack>) {
    setSchedule(s => {
      if (!s) return s
      const tracks = [...s.tracks]
      tracks[ti] = { ...tracks[ti], ...patch }
      return { ...s, tracks }
    })
  }

  function setTask(ti: number, si: number, patch: Partial<EditTask>) {
    setSchedule(s => {
      if (!s) return s
      const tracks = [...s.tracks]
      const subtopics = [...tracks[ti].subtopics]
      subtopics[si] = { ...subtopics[si], ...patch }
      tracks[ti] = { ...tracks[ti], subtopics }
      return { ...s, tracks }
    })
  }

  function deleteTrack(ti: number) {
    setSchedule(s => s ? { ...s, tracks: s.tracks.filter((_, i) => i !== ti) } : s)
  }

  function deleteTask(ti: number, si: number) {
    setSchedule(s => {
      if (!s) return s
      const tracks = [...s.tracks]
      tracks[ti] = { ...tracks[ti], subtopics: tracks[ti].subtopics.filter((_, i) => i !== si) }
      return { ...s, tracks }
    })
  }

  function addTask(ti: number) {
    const newTask: EditTask = {
      title: '', description: '', estimated_hours: 1, sequence_order: 0, _key: uid(),
    }
    setSchedule(s => {
      if (!s) return s
      const tracks = [...s.tracks]
      tracks[ti] = { ...tracks[ti], subtopics: [...tracks[ti].subtopics, newTask] }
      return { ...s, tracks }
    })
  }

  function addTrack() {
    const newTrack: EditTrack = {
      title: '', estimated_days: 7, subtopics: [], _key: uid(), _expanded: true,
    }
    setSchedule(s => s ? { ...s, tracks: [...s.tracks, newTrack] } : s)
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!schedule) return
    setSaving(true)
    try {
      const isoDate = startDate.toISOString().split('T')[0]
      await api.savePlan(toPreview(schedule), priority, isoDate)
      Alert.alert('Saved!', `"${schedule.title}" added to your paths.`, [
        { text: 'View Paths', onPress: () => router.replace('/(tabs)/paths') },
      ])
      setRawText('')
      setSchedule(null)
    } catch (e: any) {
      Alert.alert('Save failed', e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 1: Paste & Parse ── */}
        <Text style={styles.heading}>Import from Chat</Text>
        <Text style={styles.subheading}>Paste a learning schedule from any AI chat conversation.</Text>

        <TextInput
          style={styles.textArea}
          value={rawText}
          onChangeText={setRawText}
          placeholder="Paste your conversation here…"
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.btn, (!rawText.trim() || parsing) && styles.btnDisabled]}
          onPress={handleParse}
          disabled={!rawText.trim() || parsing}
        >
          {parsing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>✨ Parse with AI</Text>}
        </TouchableOpacity>

        {/* ── Step 2: Edit & Save ── */}
        {schedule && (
          <View>
            <View style={styles.divider} />

            {/* Path title */}
            <SectionLabel>PATH TITLE</SectionLabel>
            <TextInput
              style={styles.titleInput}
              value={schedule.title}
              onChangeText={setTitle}
              placeholderTextColor={colors.muted}
            />

            {/* Start date */}
            <SectionLabel>START DATE</SectionLabel>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateBtnIcon}>📅</Text>
              <Text style={styles.dateBtnText}>{fmtDate(startDate)}</Text>
              <Text style={styles.dateBtnChevron}>▼</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
                minimumDate={new Date()}
                onChange={(_, date) => {
                  setShowDatePicker(false)
                  if (date) setStartDate(date)
                }}
              />
            )}

            {/* Priority */}
            <SectionLabel>PRIORITY (1 = highest)</SectionLabel>
            <View style={styles.priorityRow}>
              {[1, 2, 3, 4, 5].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pBtn, priority === p && styles.pBtnActive]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[styles.pBtnText, priority === p && styles.pBtnTextActive]}>
                    P{p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tracks */}
            <SectionLabel>TRACKS & TASKS</SectionLabel>

            {schedule.tracks.map((track, ti) => (
              <View key={track._key} style={styles.trackCard}>

                {/* Track header row */}
                <View style={styles.trackHeaderRow}>
                  <TextInput
                    style={styles.trackTitleInput}
                    value={track.title}
                    onChangeText={v => setTrack(ti, { title: v })}
                    placeholderTextColor={colors.muted}
                    placeholder="Track title"
                  />
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Delete track?', track.title || 'This track', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteTrack(ti) },
                      ])
                    }}
                    style={styles.deleteBtn}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Estimated days */}
                <View style={styles.trackMetaRow}>
                  <Text style={styles.metaLabel}>Duration (days):</Text>
                  <TextInput
                    style={styles.daysInput}
                    value={String(track.estimated_days)}
                    onChangeText={v => setTrack(ti, { estimated_days: Number(v) || 0 })}
                    keyboardType="numeric"
                  />
                </View>

                {/* Expand/collapse tasks */}
                <TouchableOpacity
                  style={styles.expandBtn}
                  onPress={() => setTrack(ti, { _expanded: !track._expanded })}
                >
                  <Text style={styles.expandBtnText}>
                    {track._expanded ? '▲' : '▼'}  {track.subtopics.length} task{track.subtopics.length !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>

                {track._expanded && (
                  <View style={styles.tasksContainer}>
                    {track.subtopics.map((task, si) => (
                      <View key={task._key} style={styles.taskCard}>

                        {/* Task title row */}
                        <View style={styles.taskTitleRow}>
                          <TextInput
                            style={styles.taskTitleInput}
                            value={task.title}
                            onChangeText={v => setTask(ti, si, { title: v })}
                            placeholder="Task title"
                            placeholderTextColor={colors.muted}
                          />
                          <TouchableOpacity
                            onPress={() => deleteTask(ti, si)}
                            style={styles.deleteBtn}
                          >
                            <Text style={styles.deleteBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Description */}
                        <Text style={styles.taskFieldLabel}>Description / Notes</Text>
                        <TextInput
                          style={styles.descInput}
                          value={task.description ?? ''}
                          onChangeText={v => setTask(ti, si, { description: v })}
                          placeholder="Details, resources, tips…"
                          placeholderTextColor={colors.muted}
                          multiline
                          textAlignVertical="top"
                        />

                        {/* Estimated hours */}
                        <View style={styles.taskMetaRow}>
                          <Text style={styles.metaLabel}>Estimated hours:</Text>
                          <TextInput
                            style={styles.hoursInput}
                            value={String(task.estimated_hours)}
                            onChangeText={v => setTask(ti, si, { estimated_hours: Number(v) || 1 })}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      </View>
                    ))}

                    <TouchableOpacity style={styles.addTaskBtn} onPress={() => addTask(ti)}>
                      <Text style={styles.addBtnText}>+ Add task</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addTrackBtn} onPress={addTrack}>
              <Text style={styles.addBtnText}>+ Add track</Text>
            </TouchableOpacity>

            {/* Save */}
            <TouchableOpacity
              style={[styles.btn, styles.btnSuccess, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>✅ Approve & Save</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll:        { padding: 20, paddingBottom: 60 },
  heading:       { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subheading:    { fontSize: 14, color: colors.muted, marginBottom: 16, lineHeight: 20 },
  textArea:      { backgroundColor: colors.card, color: colors.text, borderRadius: 12,
                   padding: 14, fontSize: 14, minHeight: 130, marginBottom: 12 },
  btn:           { backgroundColor: colors.primary, borderRadius: 12, padding: 16,
                   alignItems: 'center', marginBottom: 12 },
  btnDisabled:   { opacity: 0.45 },
  btnSuccess:    { backgroundColor: colors.success },
  btnText:       { color: '#fff', fontWeight: '700', fontSize: 15 },
  divider:       { height: 1, backgroundColor: colors.card, marginVertical: 20 },

  sectionLabel:  { fontSize: 11, color: colors.muted, fontWeight: '700',
                   textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },

  titleInput:    { backgroundColor: colors.card, color: colors.text, borderRadius: 10,
                   padding: 12, fontSize: 16, fontWeight: '600', marginBottom: 4 },

  dateBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
                   borderRadius: 10, padding: 12, gap: 10 },
  dateBtnIcon:   { fontSize: 18 },
  dateBtnText:   { color: colors.text, fontSize: 15, flex: 1, fontWeight: '500' },
  dateBtnChevron:{ color: colors.muted, fontSize: 12 },

  priorityRow:   { flexDirection: 'row', gap: 8, marginBottom: 4 },
  pBtn:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8,
                   backgroundColor: colors.card, borderWidth: 1, borderColor: 'transparent' },
  pBtnActive:    { borderColor: colors.primary },
  pBtnText:      { color: colors.muted, fontWeight: '600' },
  pBtnTextActive:{ color: colors.primary },

  trackCard:     { backgroundColor: colors.card, borderRadius: 14, padding: 14,
                   marginBottom: 12 },
  trackHeaderRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  trackTitleInput:{ flex: 1, color: colors.text, fontSize: 15, fontWeight: '700',
                    backgroundColor: colors.bg, borderRadius: 8, padding: 8 },
  trackMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  metaLabel:     { color: colors.muted, fontSize: 12 },
  daysInput:     { backgroundColor: colors.bg, color: colors.text, borderRadius: 8,
                   paddingHorizontal: 10, paddingVertical: 6, width: 60,
                   textAlign: 'center', fontSize: 14 },
  expandBtn:     { paddingVertical: 6 },
  expandBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  tasksContainer:{ marginTop: 8, gap: 8 },
  taskCard:      { backgroundColor: colors.bg, borderRadius: 10, padding: 12 },
  taskTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  taskTitleInput:{ flex: 1, color: colors.text, fontSize: 13, fontWeight: '600',
                   backgroundColor: colors.card, borderRadius: 8, padding: 8 },
  taskFieldLabel:{ color: colors.muted, fontSize: 11, marginBottom: 4 },
  descInput:     { backgroundColor: colors.card, color: colors.text, borderRadius: 8,
                   padding: 10, fontSize: 12, minHeight: 80, marginBottom: 10,
                   lineHeight: 18 },
  taskMetaRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hoursInput:    { backgroundColor: colors.card, color: colors.text, borderRadius: 8,
                   paddingHorizontal: 10, paddingVertical: 6, width: 60,
                   textAlign: 'center', fontSize: 14 },

  deleteBtn:     { padding: 6 },
  deleteBtnText: { color: colors.danger, fontSize: 15, fontWeight: '700' },

  addTaskBtn:    { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, borderStyle: 'dashed',
                   padding: 10, alignItems: 'center', marginTop: 4 },
  addTrackBtn:   { borderWidth: 1, borderColor: colors.muted, borderRadius: 10, borderStyle: 'dashed',
                   padding: 12, alignItems: 'center', marginBottom: 16 },
  addBtnText:    { color: colors.primary, fontWeight: '600', fontSize: 13 },

  field:         { marginBottom: 10 },
  fieldLabel:    { color: colors.muted, fontSize: 11, marginBottom: 4 },
  fieldInput:    { backgroundColor: colors.card, color: colors.text, borderRadius: 8,
                   padding: 10, fontSize: 14 },
  fieldInputMulti:{ minHeight: 80 },
})
