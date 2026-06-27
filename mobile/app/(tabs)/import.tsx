import { useState } from 'react'
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors } from '@/constants/colors'
import { api, SchedulePreview } from '@/lib/api'

export default function ImportScreen() {
  const router = useRouter()
  const [rawText,   setRawText]   = useState('')
  const [preview,   setPreview]   = useState<SchedulePreview | null>(null)
  const [priority,  setPriority]  = useState(3)
  const [parsing,   setParsing]   = useState(false)
  const [saving,    setSaving]    = useState(false)

  async function handleParse() {
    if (!rawText.trim()) return
    setParsing(true)
    setPreview(null)
    try {
      const result = await api.parsePlan(rawText)
      setPreview(result)
    } catch (e: any) {
      Alert.alert('Parse failed', e.message)
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!preview) return
    setSaving(true)
    try {
      await api.savePlan(preview, priority)
      Alert.alert('Saved!', `"${preview.title}" added to your paths.`, [
        { text: 'View Paths', onPress: () => router.replace('/(tabs)/paths') },
      ])
      setRawText('')
      setPreview(null)
    } catch (e: any) {
      Alert.alert('Save failed', e.message)
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
        <Text style={styles.heading}>Import from Chat</Text>
        <Text style={styles.subheading}>Paste a learning schedule from any AI chat conversation.</Text>

        <TextInput
          style={styles.textArea}
          value={rawText}
          onChangeText={setRawText}
          placeholder="Paste your conversation here…"
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.btn, (!rawText.trim() || parsing) && styles.btnDisabled]}
          onPress={handleParse}
          disabled={!rawText.trim() || parsing}
        >
          {parsing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>✨ Parse with AI</Text>
          }
        </TouchableOpacity>

        {preview && (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>{preview.title}</Text>
            <Text style={styles.sectionLabel}>{preview.tracks.length} tracks extracted</Text>

            {preview.tracks.map((track, i) => (
              <View key={i} style={styles.trackRow}>
                <Text style={styles.trackTitle}>{track.title}</Text>
                <Text style={styles.trackMeta}>
                  {track.estimated_days}d · {track.subtopics.length} tasks
                </Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>Priority (1 = highest)</Text>
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

            <TouchableOpacity
              style={[styles.btn, styles.btnSuccess, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>✅ Approve & Save</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  scroll:         { padding: 20, paddingBottom: 40 },
  heading:        { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  subheading:     { fontSize: 14, color: colors.muted, marginBottom: 20, lineHeight: 20 },
  textArea:       { backgroundColor: colors.card, color: colors.text, borderRadius: 12,
                    padding: 14, fontSize: 14, minHeight: 160, marginBottom: 14 },
  btn:            { backgroundColor: colors.primary, borderRadius: 12, padding: 16,
                    alignItems: 'center', marginBottom: 12 },
  btnDisabled:    { opacity: 0.5 },
  btnSuccess:     { backgroundColor: colors.success },
  btnText:        { color: '#fff', fontWeight: '700', fontSize: 15 },
  preview:        { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginTop: 4 },
  previewTitle:   { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 12 },
  sectionLabel:   { fontSize: 11, color: colors.muted, textTransform: 'uppercase',
                    letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  trackRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bg },
  trackTitle:     { fontSize: 14, color: colors.text, flex: 1 },
  trackMeta:      { fontSize: 12, color: colors.muted },
  priorityRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pBtn:           { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8,
                    backgroundColor: colors.bg, borderWidth: 1, borderColor: 'transparent' },
  pBtnActive:     { borderColor: colors.primary },
  pBtnText:       { color: colors.muted, fontWeight: '600' },
  pBtnTextActive: { color: colors.primary },
})
