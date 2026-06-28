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

const DIFF_COLOR: Record<string, string> = {
  easy:   colors.success,
  medium: colors.amber,
  hard:   colors.danger,
}
const DIFF_BG: Record<string, string> = {
  easy:   colors.successMuted,
  medium: colors.amberMuted,
  hard:   colors.dangerMuted,
}

export default function LibraryScreen() {
  const [url, setUrl]               = useState('')
  const [sources, setSources]       = useState<ContentSource[]>([])
  const [loading, setLoading]       = useState(true)
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
    Alert.alert('Remove from Library', `"${title || 'This source'}" will be deleted.`, [
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

  const renderSource = ({ item }: { item: ContentSource }) => {
    const isDone      = item.status === 'done'
    const isAnalyzing = item.status === 'analyzing'
    const isFailed    = item.status === 'failed'

    return (
      <TouchableOpacity
        style={[styles.card, isDone && styles.cardDone, isFailed && styles.cardFailed]}
        onPress={() => isDone && router.push(`/library/${item.id}`)}
        onLongPress={() => confirmDelete(item.id, item.title || '')}
        activeOpacity={isDone ? 0.75 : 1}
      >
        {/* Cyan accent strip for done items */}
        {isDone && <View style={styles.cardAccent} />}

        <View style={styles.cardInner}>
          <View style={styles.cardMeta}>
            <View style={[
              styles.typeBadge,
              { backgroundColor: item.type === 'url' ? colors.cyanMuted : colors.violetMuted },
            ]}>
              <Ionicons
                name={item.type === 'url' ? 'link-outline' : 'document-text-outline'}
                size={11}
                color={item.type === 'url' ? colors.cyan : colors.violet}
              />
              <Text style={[styles.typeBadgeText,
                { color: item.type === 'url' ? colors.cyan : colors.violet }
              ]}>
                {item.type.toUpperCase()}
              </Text>
            </View>

            {item.difficulty && (
              <View style={[styles.diffBadge, { backgroundColor: DIFF_BG[item.difficulty] ?? colors.surface }]}>
                <Text style={[styles.diffBadgeText, { color: DIFF_COLOR[item.difficulty] ?? colors.textSub }]}>
                  {item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}
                </Text>
              </View>
            )}

            {!!item.reading_time_minutes && (
              <View style={styles.timeBadge}>
                <Ionicons name="time-outline" size={11} color={colors.textSub} />
                <Text style={styles.timeBadgeText}>{item.reading_time_minutes} min</Text>
              </View>
            )}

            <View style={{ flex: 1 }} />
            {isAnalyzing && <ActivityIndicator size="small" color={colors.cyan} />}
            {isDone      && <Ionicons name="chevron-forward" size={16} color={colors.cyan} />}
            {isFailed    && <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />}
          </View>

          <Text style={[styles.cardTitle, isFailed && { color: colors.muted }]} numberOfLines={2}>
            {item.title
              || (isAnalyzing ? 'Analyzing content…' : item.url || item.filename || 'Untitled')}
          </Text>

          {isAnalyzing && (
            <Text style={[styles.analyzingText, { color: colors.cyan }]}>
              AI is reading this content…
            </Text>
          )}

          {item.prerequisites && item.prerequisites.length > 0 && (
            <View style={styles.prereqRow}>
              <Text style={styles.prereqLabel}>Needs: </Text>
              <Text style={styles.prereqText}>{item.prerequisites.join(' · ')}</Text>
            </View>
          )}

          {isFailed && (
            <Text style={styles.errorText}>Analysis failed — try again with a different URL.</Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  const header = (
    <View style={styles.headerSection}>
      {/* Section label with cyan accent */}
      <View style={styles.sectionRow}>
        <View style={[styles.sectionAccent, { backgroundColor: colors.cyan }]} />
        <Text style={[styles.sectionLabel, { color: colors.cyan }]}>Add Content</Text>
      </View>

      {/* URL input */}
      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="link-outline" size={15} color={colors.muted} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.urlInput}
            placeholder="https://..."
            placeholderTextColor={colors.muted}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={submitUrl}
          />
        </View>
        <TouchableOpacity
          style={[styles.analyzeBtn, (!url.trim() || submitting) && styles.analyzeBtnOff]}
          onPress={submitUrl}
          disabled={!url.trim() || submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.analyzeBtnText}>Analyze</Text>}
        </TouchableOpacity>
      </View>

      {/* PDF button */}
      <TouchableOpacity style={styles.pdfBtn} onPress={pickPdf} disabled={submitting}>
        <Ionicons name="document-text-outline" size={16} color={colors.violet} />
        <Text style={[styles.pdfBtnText, { color: colors.violet }]}>Upload PDF</Text>
      </TouchableOpacity>

      {sources.length > 0 && (
        <View style={[styles.sectionRow, { marginTop: 20, marginBottom: 4 }]}>
          <View style={[styles.sectionAccent, { backgroundColor: colors.cyan }]} />
          <Text style={[styles.sectionLabel, { color: colors.cyan }]}>My Library</Text>
          <View style={styles.countChip}>
            <Text style={styles.countText}>{sources.length}</Text>
          </View>
        </View>
      )}
    </View>
  )

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.cyan} />
        </View>
      ) : (
        <FlatList
          data={sources}
          keyExtractor={s => s.id}
          renderItem={renderSource}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="library-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyTitle}>Library is empty</Text>
              <Text style={styles.emptyText}>Add a URL or PDF above to get{'\n'}AI-powered learning analysis.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadSources() }}
              tintColor={colors.cyan}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.bg },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  headerSection:   { padding: 16, paddingBottom: 8 },
  sectionRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionAccent:   { width: 3, height: 14, borderRadius: 2 },
  sectionLabel:    { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  inputRow:        { flexDirection: 'row', gap: 8, marginBottom: 10 },
  inputWrap:       { flex: 1, flexDirection: 'row', alignItems: 'center',
                     backgroundColor: colors.card, borderRadius: 12,
                     borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10 },
  urlInput:        { flex: 1, color: colors.text, paddingVertical: 11, fontSize: 14 },
  analyzeBtn:      { backgroundColor: colors.cyan, borderRadius: 12,
                     paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  analyzeBtnOff:   { opacity: 0.4 },
  analyzeBtnText:  { color: colors.bg, fontWeight: '700', fontSize: 14 },

  pdfBtn:          { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                     borderWidth: 1, borderColor: colors.violetMuted, borderRadius: 10,
                     paddingVertical: 9, paddingHorizontal: 14, marginBottom: 8,
                     backgroundColor: colors.violetMuted },
  pdfBtnText:      { fontWeight: '600', fontSize: 14 },

  countChip:       { backgroundColor: colors.cyanMuted, width: 22, height: 22, borderRadius: 11,
                     alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  countText:       { color: colors.cyan, fontSize: 11, fontWeight: '700' },

  card:            { backgroundColor: colors.card, borderRadius: 14, marginHorizontal: 16,
                     marginBottom: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardDone:        { borderColor: colors.cyan + '44' },
  cardFailed:      { borderColor: colors.danger + '44' },
  cardAccent:      { height: 3, backgroundColor: colors.cyan },
  cardInner:       { padding: 14 },
  cardMeta:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  typeBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4,
                     paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  diffBadge:       { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  diffBadgeText:   { fontSize: 10, fontWeight: '700' },
  timeBadge:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
  timeBadgeText:   { fontSize: 11, color: colors.textSub },
  cardTitle:       { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 21 },
  analyzingText:   { fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  prereqRow:       { flexDirection: 'row', marginTop: 8 },
  prereqLabel:     { fontSize: 12, color: colors.muted, fontWeight: '600' },
  prereqText:      { fontSize: 12, color: colors.textSub, flex: 1 },
  errorText:       { fontSize: 12, color: colors.danger, marginTop: 6 },

  emptyBox:        { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyTitle:      { fontSize: 16, fontWeight: '700', color: colors.textSub, marginTop: 8 },
  emptyText:       { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
})
