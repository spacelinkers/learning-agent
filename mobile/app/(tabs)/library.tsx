import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { api, ContentSource } from '@/lib/api'

const diffColor = (d?: string) =>
  d === 'easy' ? colors.success : d === 'hard' ? colors.danger : colors.warning

export default function LibraryScreen() {
  const [url, setUrl]           = useState('')
  const [sources, setSources]   = useState<ContentSource[]>([])
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadSources = useCallback(async () => {
    try {
      const data = await api.getSources()
      setSources(data)
    } catch {
      // silent — server may be waking up
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadSources() }, [loadSources])

  // Auto-poll while any source is still analyzing
  useEffect(() => {
    const hasAnalyzing = sources.some(s => s.status === 'analyzing')
    if (!hasAnalyzing) return
    const id = setInterval(loadSources, 4000)
    return () => clearInterval(id)
  }, [sources, loadSources])

  const submitUrl = async () => {
    if (!url.trim()) return
    setSubmitting(true)
    try {
      await api.ingestUrl(url.trim())
      setUrl('')
      await loadSources()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      setSubmitting(true)
      const form = new FormData()
      form.append('file', { uri: asset.uri, name: asset.name, type: 'application/pdf' } as any)
      await api.ingestPdf(form)
      await loadSources()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = (id: string, title: string) => {
    Alert.alert('Remove', `Delete "${title || 'this source'}" from library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSource(id)
            setSources(prev => prev.filter(s => s.id !== id))
          } catch (e: any) {
            Alert.alert('Error', e.message)
          }
        },
      },
    ])
  }

  const renderSource = ({ item }: { item: ContentSource }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => item.status === 'done' && router.push(`/library/${item.id}`)}
      onLongPress={() => confirmDelete(item.id, item.title || '')}
      activeOpacity={item.status === 'done' ? 0.7 : 1}
    >
      <View style={styles.cardRow}>
        <View style={[styles.badge, { backgroundColor: item.type === 'url' ? '#1D4ED8' : '#7C3AED' }]}>
          <Text style={styles.badgeText}>{item.type.toUpperCase()}</Text>
        </View>
        {item.difficulty && (
          <View style={[styles.badge, { backgroundColor: diffColor(item.difficulty) }]}>
            <Text style={styles.badgeText}>{item.difficulty}</Text>
          </View>
        )}
        {!!item.reading_time_minutes && (
          <Text style={styles.metaText}>{item.reading_time_minutes} min</Text>
        )}
        <View style={{ flex: 1 }} />
        {item.status === 'analyzing' && <ActivityIndicator size="small" color={colors.primary} />}
        {item.status === 'done'      && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
        {item.status === 'failed'    && <Ionicons name="alert-circle" size={16} color={colors.danger} />}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title
          || (item.status === 'analyzing' ? 'Analyzing content...' : item.url || item.filename || 'Untitled')}
      </Text>

      {item.prerequisites && item.prerequisites.length > 0 && (
        <Text style={styles.prereqText}>Needs: {item.prerequisites.join(' · ')}</Text>
      )}

      {item.status === 'failed' && (
        <Text style={[styles.prereqText, { color: colors.danger }]}>Analysis failed. Try again.</Text>
      )}
    </TouchableOpacity>
  )

  const header = (
    <View style={styles.headerBox}>
      <Text style={styles.sectionLabel}>Add URL</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="https://..."
          placeholderTextColor={colors.muted}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={submitUrl}
        />
        <TouchableOpacity
          style={[styles.analyzeBtn, (!url.trim() || submitting) && { opacity: 0.5 }]}
          onPress={submitUrl}
          disabled={!url.trim() || submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.analyzeBtnText}>Analyze</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.pdfBtn} onPress={pickPdf} disabled={submitting}>
        <Ionicons name="document-text-outline" size={18} color={colors.primary} />
        <Text style={styles.pdfBtnText}>Upload PDF</Text>
      </TouchableOpacity>

      {sources.length > 0 && <Text style={[styles.sectionLabel, { marginTop: 24 }]}>My Library</Text>}
    </View>
  )

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      ) : (
        <FlatList
          data={sources}
          keyExtractor={s => s.id}
          renderItem={renderSource}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>No content yet.{'\n'}Add a URL or upload a PDF above.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadSources() }}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  headerBox:    { padding: 16 },
  sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  row:          { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input:        { flex: 1, backgroundColor: colors.card, color: colors.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  analyzeBtn:   { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  analyzeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  pdfBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  pdfBtnText:   { color: colors.primary, fontWeight: '600', fontSize: 14 },
  card:         { backgroundColor: colors.card, borderRadius: 12, marginHorizontal: 16, marginBottom: 10, padding: 14 },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  badge:        { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:    { color: '#fff', fontSize: 10, fontWeight: '700' },
  metaText:     { color: colors.muted, fontSize: 12 },
  cardTitle:    { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  prereqText:   { color: colors.muted, fontSize: 12, marginTop: 6 },
  empty:        { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText:    { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 },
})
