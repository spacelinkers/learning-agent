import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router'
import { colors } from '@/constants/colors'
import {
  api,
  ContentSource,
  Flashcard,
  InterviewQuestion,
  NextReads,
  Project,
  QuizQuestion,
  Takeaway,
} from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'Takeaways' | 'Code' | 'Projects' | 'Next Reads' | 'Interview' | 'Flashcards' | 'Quiz'
const TABS: Tab[] = ['Takeaways', 'Code', 'Projects', 'Next Reads', 'Interview', 'Flashcards', 'Quiz']

type CodeLevel = 'simple' | 'intermediate' | 'production'
type InterviewLevel = 'junior' | 'mid' | 'senior'

// ── Sub-components ────────────────────────────────────────────────────────────

function CodeSection({ source }: { source: ContentSource }) {
  const [level, setLevel] = useState<CodeLevel>('simple')
  const code = source.analysis?.code
  if (!code) return null
  const ex = code[level]
  return (
    <View style={s.section}>
      <View style={s.segRow}>
        {(['simple', 'intermediate', 'production'] as CodeLevel[]).map(l => (
          <TouchableOpacity
            key={l}
            style={[s.seg, level === l && s.segActive]}
            onPress={() => setLevel(l)}
          >
            <Text style={[s.segText, level === l && s.segTextActive]}>
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.codeCard}>
        <View style={s.codeHeader}>
          <Text style={s.codeTitle}>{ex?.title}</Text>
          <View style={s.langBadge}>
            <Text style={s.langText}>{ex?.language}</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={s.codeBlock}>{ex?.code}</Text>
        </ScrollView>
        <Text style={s.codeExplain}>{ex?.explanation}</Text>
      </View>
    </View>
  )
}

function ProjectsSection({ projects }: { projects: Project[] }) {
  const diffColor = (d: string) =>
    d === 'easy' ? colors.success : d === 'hard' ? colors.danger : colors.warning
  return (
    <View style={s.section}>
      {projects.map((p, i) => (
        <View key={i} style={s.projectCard}>
          <View style={s.cardRow}>
            <Text style={s.projectTitle}>{p.title}</Text>
            <View style={[s.diffBadge, { backgroundColor: diffColor(p.difficulty) }]}>
              <Text style={s.diffText}>{p.difficulty}</Text>
            </View>
          </View>
          <Text style={s.projectDesc}>{p.description}</Text>
          <View style={s.tagRow}>
            {p.tech_stack.map(t => (
              <View key={t} style={s.tag}><Text style={s.tagText}>{t}</Text></View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

function NextReadsSection({ raw }: { raw: NonNullable<ContentSource['analysis']>['next_reads'] }) {
  const openUrl = (url?: string) => {
    if (url) Linking.openURL(url).catch(() => Alert.alert('Cannot open link', url))
  }

  type Item = { title: string; author?: string; source?: string; reason: string; url?: string }

  // Normalise: new format = {books,articles,blogs}; old format = flat array
  let books: Item[] = [], articles: Item[] = [], blogs: Item[] = []
  if (Array.isArray(raw)) {
    books    = (raw as any[]).filter(r => r.type === 'book')
    articles = (raw as any[]).filter(r => r.type === 'article' || r.type === 'concept' || r.type === 'video')
    blogs    = (raw as any[]).filter(r => r.type === 'blog')
  } else if (raw && typeof raw === 'object') {
    const nr = raw as NextReads
    books    = nr.books    || []
    articles = nr.articles || []
    blogs    = nr.blogs    || []
  }

  const Card = ({ item, iconName, iconColor, label }: {
    item: Item
    iconName: keyof typeof Ionicons.glyphMap
    iconColor: string
    label: string
  }) => (
    <TouchableOpacity
      style={[s.nextCard, !!item.url && s.nextCardClickable]}
      onPress={() => openUrl(item.url)}
      activeOpacity={item.url ? 0.7 : 1}
    >
      <View style={[s.nextIconBox, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.nextHeaderRow}>
          <Text style={[s.nextTitle, !!item.url && s.nextTitleLink]} numberOfLines={2}>{item.title}</Text>
          <View style={[s.typePill, { backgroundColor: iconColor }]}>
            <Text style={s.typePillText}>{label}</Text>
          </View>
        </View>
        {(item.author || item.source) && (
          <Text style={s.nextMeta}>{[item.author, item.source].filter(Boolean).join(' · ')}</Text>
        )}
        <Text style={s.nextReason}>{item.reason}</Text>
        {!!item.url && (
          <View style={s.urlRow}>
            <Ionicons name="open-outline" size={12} color={colors.primary} />
            <Text style={s.urlText} numberOfLines={1}>{item.url}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  const hasAny = books.length > 0 || articles.length > 0 || blogs.length > 0
  return (
    <View style={s.section}>
      {!hasAny && <Text style={s.nextMeta}>No recommendations — re-analyze to generate them.</Text>}
      {books.length > 0 && (
        <>
          <Text style={s.groupLabel}>Books</Text>
          {books.map((b, i) => <Card key={i} item={b} iconName="book-outline" iconColor="#7C3AED" label="BOOK" />)}
        </>
      )}
      {articles.length > 0 && (
        <>
          <Text style={[s.groupLabel, { marginTop: books.length > 0 ? 16 : 0 }]}>Articles</Text>
          {articles.map((a, i) => <Card key={i} item={a} iconName="newspaper-outline" iconColor="#059669" label="ARTICLE" />)}
        </>
      )}
      {blogs.length > 0 && (
        <>
          <Text style={[s.groupLabel, { marginTop: (books.length > 0 || articles.length > 0) ? 16 : 0 }]}>Blogs</Text>
          {blogs.map((b, i) => <Card key={i} item={b} iconName="globe-outline" iconColor="#0891B2" label="BLOG" />)}
        </>
      )}
    </View>
  )
}

function InterviewSection({ iq }: { iq: NonNullable<ContentSource['analysis']>['interview_questions'] }) {
  const [level, setLevel] = useState<InterviewLevel>('junior')
  const [expanded, setExpanded] = useState<number | null>(null)
  const questions: InterviewQuestion[] = iq[level] || []
  return (
    <View style={s.section}>
      <View style={s.segRow}>
        {(['junior', 'mid', 'senior'] as InterviewLevel[]).map(l => (
          <TouchableOpacity key={l} style={[s.seg, level === l && s.segActive]} onPress={() => { setLevel(l); setExpanded(null) }}>
            <Text style={[s.segText, level === l && s.segTextActive]}>{l.charAt(0).toUpperCase() + l.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {questions.map((q, i) => (
        <TouchableOpacity key={i} style={s.iqCard} onPress={() => setExpanded(expanded === i ? null : i)} activeOpacity={0.7}>
          <View style={s.cardRow}>
            <Text style={s.iqQ} numberOfLines={expanded === i ? undefined : 2}>{q.q}</Text>
            <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
          </View>
          {expanded === i && <Text style={s.iqA}>{q.a}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  )
}

function FlashcardsSection({ cards }: { cards: Flashcard[] }) {
  const [idx, setIdx]       = useState(0)
  const [flipped, setFlipped] = useState(false)
  const anim                = useRef(new Animated.Value(0)).current

  const flip = () => {
    Animated.timing(anim, { toValue: flipped ? 0 : 1, duration: 280, useNativeDriver: true }).start()
    setFlipped(f => !f)
  }

  const next = () => {
    anim.setValue(0)
    setFlipped(false)
    setIdx(i => (i + 1) % cards.length)
  }

  const prev = () => {
    anim.setValue(0)
    setFlipped(false)
    setIdx(i => (i - 1 + cards.length) % cards.length)
  }

  const frontRot = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const backRot  = anim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })

  if (!cards.length) return null
  const card = cards[idx]

  return (
    <View style={s.section}>
      <Text style={s.cardCounter}>{idx + 1} / {cards.length}  •  {flipped ? 'Answer' : 'Question'}</Text>
      <TouchableOpacity onPress={flip} activeOpacity={0.9} style={{ height: 180 }}>
        <Animated.View style={[s.flashFront, { transform: [{ rotateY: frontRot }] }, flipped && s.hidden]}>
          <Text style={s.flashQ}>{card.q}</Text>
          <Text style={s.flashHint}>Tap to reveal</Text>
        </Animated.View>
        <Animated.View style={[s.flashBack, { transform: [{ rotateY: backRot }] }, !flipped && s.hidden]}>
          <Text style={s.flashA}>{card.a}</Text>
        </Animated.View>
      </TouchableOpacity>
      <View style={s.fcNav}>
        <TouchableOpacity style={s.fcBtn} onPress={prev}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={s.fcBtn} onPress={next}>
          <Ionicons name="arrow-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

function QuizSection({ questions }: { questions: QuizQuestion[] }) {
  const [qIdx, setQIdx]     = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers, setAnswers]   = useState<(number | null)[]>(() => questions.map(() => null))
  const [finished, setFinished] = useState(false)

  if (!questions.length) return null

  if (finished) {
    const score = answers.reduce((n, a, i) => n + (a === questions[i].correct ? 1 : 0), 0)
    return (
      <View style={[s.section, { alignItems: 'center', paddingTop: 32 }]}>
        <Text style={{ fontSize: 48 }}>{score >= 7 ? '🏆' : score >= 5 ? '👍' : '📚'}</Text>
        <Text style={s.scoreTitle}>{score} / {questions.length}</Text>
        <Text style={s.scoreSub}>{score >= 7 ? 'Excellent!' : score >= 5 ? 'Good job!' : 'Keep learning!'}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => { setQIdx(0); setSelected(null); setAnswers(questions.map(() => null)); setFinished(false) }}>
          <Text style={s.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const q = questions[qIdx]
  const answered = selected !== null

  const choose = (i: number) => {
    if (answered) return
    setSelected(i)
    const updated = [...answers]
    updated[qIdx] = i
    setAnswers(updated)
  }

  const next = () => {
    if (qIdx + 1 >= questions.length) { setFinished(true); return }
    setQIdx(qIdx + 1)
    setSelected(null)
  }

  const optionColor = (i: number) => {
    if (!answered) return colors.card
    if (i === q.correct) return '#14532D'
    if (i === selected) return '#7F1D1D'
    return colors.card
  }

  return (
    <View style={s.section}>
      <Text style={s.cardCounter}>Question {qIdx + 1} of {questions.length}</Text>
      <Text style={s.quizQ}>{q.question}</Text>
      {q.options.map((opt, i) => (
        <TouchableOpacity key={i} style={[s.option, { backgroundColor: optionColor(i) }]} onPress={() => choose(i)} activeOpacity={0.7}>
          <Text style={s.optText}>{opt}</Text>
          {answered && i === q.correct && <Ionicons name="checkmark-circle" size={18} color={colors.success} />}
          {answered && i === selected && i !== q.correct && <Ionicons name="close-circle" size={18} color={colors.danger} />}
        </TouchableOpacity>
      ))}
      {answered && (
        <View style={s.explanBox}>
          <Text style={s.explanText}>{q.explanation}</Text>
        </View>
      )}
      {answered && (
        <TouchableOpacity style={s.nextBtn} onPress={next}>
          <Text style={s.nextBtnText}>{qIdx + 1 >= questions.length ? 'See Score' : 'Next Question'}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LibraryDetailScreen() {
  const { id }                  = useLocalSearchParams<{ id: string }>()
  const [source, setSource]       = useState<ContentSource | null>(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('Takeaways')
  const [completed, setCompleted] = useState<string[]>([])
  const [expandedTakeaway, setExpandedTakeaway] = useState<number | null>(null)

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.replace('/(tabs)/library')
        return true
      })
      return () => sub.remove()
    }, []),
  )

  const load = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.getSource(id)
      setSource(data)
      setCompleted(data.analysis?.completed_topics ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Poll while still analyzing
  useEffect(() => {
    if (source?.status !== 'analyzing') return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [source?.status, load])

  const toggleTopic = async (topic: string) => {
    const next = completed.includes(topic)
      ? completed.filter(t => t !== topic)
      : [...completed, topic]
    setCompleted(next)
    await api.updateProgress(id!, next).catch(() => {})
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
  if (!source) return <View style={s.center}><Text style={s.muted}>Source not found.</Text></View>

  if (source.status === 'analyzing') {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[s.muted, { marginTop: 16 }]}>Analyzing content…{'\n'}This takes about 30–60 seconds.</Text>
      </View>
    )
  }

  if (source.status === 'failed') {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={[s.muted, { marginTop: 12 }]}>Analysis failed. Go back and try again.</Text>
      </View>
    )
  }

  const analysis = source.analysis!
  const takeaways: Takeaway[] = (analysis.takeaways || []).map((t: any) =>
    typeof t === 'string' ? { title: t, explanation: '', code: '', language: '' } : t
  )
  const totalTopics = takeaways.length
  const donePct = totalTopics > 0 ? Math.round((completed.length / totalTopics) * 100) : 0

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Takeaways':
        return (
          <View style={s.section}>
            <View style={s.progressRow}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${donePct}%` as any }]} />
              </View>
              <Text style={s.progressText}>{donePct}%</Text>
            </View>
            {completed.length > 0 && (
              <Text style={s.completedLabel}>
                {completed.length}/{totalTopics} completed
              </Text>
            )}
            {takeaways.map((t, i) => {
              const isDone = completed.includes(t.title)
              const isOpen = expandedTakeaway === i
              return (
                <View key={i} style={[s.takeawayCard, isDone && s.takeawayCardDone]}>
                  <TouchableOpacity
                    style={s.takeawayHeader}
                    onPress={() => setExpandedTakeaway(isOpen ? null : i)}
                    activeOpacity={0.7}
                  >
                    <TouchableOpacity
                      onPress={() => toggleTopic(t.title)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isDone ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={isDone ? colors.success : colors.muted}
                      />
                    </TouchableOpacity>
                    <Text style={[s.takeawayTitle, isDone && s.strikethrough]} numberOfLines={isOpen ? undefined : 2}>
                      {t.title}
                    </Text>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={s.takeawayBody}>
                      {!!t.explanation && (
                        <Text style={s.takeawayExplain}>{t.explanation}</Text>
                      )}
                      {!!t.code && (
                        <View style={s.takeawayCodeWrap}>
                          <View style={s.takeawayCodeHeader}>
                            <Text style={s.takeawayCodeLang}>{t.language || 'code'}</Text>
                          </View>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Text style={s.takeawayCode}>{t.code}</Text>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )
      case 'Code':
        return <CodeSection source={source} />
      case 'Projects':
        return <ProjectsSection projects={analysis.projects || []} />
      case 'Next Reads':
        return <NextReadsSection raw={analysis.next_reads || []} />
      case 'Interview':
        return <InterviewSection iq={analysis.interview_questions || { junior: [], mid: [], senior: [] }} />
      case 'Flashcards':
        return <FlashcardsSection cards={analysis.flashcards || []} />
      case 'Quiz':
        return <QuizSection questions={analysis.quiz || []} />
    }
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/library')} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.titleText} numberOfLines={1}>{source.title || 'Analysis'}</Text>
          <View style={s.metaRow}>
            {source.difficulty && (
              <Text style={[s.metaChip, { color: source.difficulty === 'easy' ? colors.success : source.difficulty === 'hard' ? colors.danger : colors.warning }]}>
                {source.difficulty}
              </Text>
            )}
            {!!source.reading_time_minutes && (
              <Text style={s.metaChip}>{source.reading_time_minutes} min read</Text>
            )}
            {source.prerequisites && source.prerequisites.length > 0 && (
              <Text style={s.metaChip}>Needs: {source.prerequisites.join(', ')}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderTabContent()}
      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 24 },
  muted:          { color: colors.muted, textAlign: 'center', lineHeight: 22, fontSize: 14 },

  // Header
  topBar:         { flexDirection: 'row', alignItems: 'flex-start', padding: 16, paddingBottom: 8 },
  backBtn:        { paddingTop: 2 },
  titleText:      { color: colors.text, fontSize: 16, fontWeight: '700' },
  metaRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  metaChip:       { color: colors.muted, fontSize: 12 },

  // Tab bar
  tabBar:         { borderBottomWidth: 1, borderBottomColor: colors.card, maxHeight: 52 },
  tabBtn:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.card },
  tabBtnActive:   { backgroundColor: colors.primary },
  tabText:        { color: colors.muted, fontSize: 13, fontWeight: '500' },
  tabTextActive:  { color: colors.bg, fontWeight: '700' },

  // Shared
  section:        { padding: 16 },
  cardRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segRow:         { flexDirection: 'row', gap: 6, marginBottom: 14 },
  seg:            { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.card },
  segActive:      { backgroundColor: colors.primary },
  segText:        { color: colors.muted, fontSize: 13 },
  segTextActive:  { color: colors.bg, fontWeight: '600' },

  // Takeaways
  progressRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  progressBg:        { flex: 1, height: 6, backgroundColor: colors.card, borderRadius: 3, overflow: 'hidden' },
  progressFill:      { height: '100%', backgroundColor: colors.success, borderRadius: 3 },
  progressText:      { color: colors.muted, fontSize: 12, width: 36, textAlign: 'right' },
  completedLabel:    { color: colors.muted, fontSize: 11, marginBottom: 12 },
  takeawayCard:      { backgroundColor: colors.card, borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  takeawayCardDone:  { borderColor: colors.success, borderWidth: 1 },
  takeawayHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14 },
  takeawayTitle:     { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  takeawayBody:      { paddingHorizontal: 14, paddingBottom: 14 },
  takeawayExplain:   { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  takeawayCodeWrap:  { backgroundColor: '#0D1117', borderRadius: 8, overflow: 'hidden' },
  takeawayCodeHeader:{ backgroundColor: '#161B22', paddingHorizontal: 12, paddingVertical: 6 },
  takeawayCodeLang:  { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  takeawayCode:      { color: '#A8FF78', fontFamily: 'monospace', fontSize: 12, lineHeight: 18, padding: 12 },
  strikethrough:     { textDecorationLine: 'line-through', color: colors.muted },

  // Code
  codeCard:       { backgroundColor: '#0D1117', borderRadius: 10, padding: 14 },
  codeHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  codeTitle:      { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  langBadge:      { backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  langText:       { color: colors.bg, fontSize: 10, fontWeight: '700' },
  codeBlock:      { color: '#A8FF78', fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  codeExplain:    { color: colors.muted, fontSize: 13, marginTop: 12, lineHeight: 18 },

  // Projects
  projectCard:    { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  projectTitle:   { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  projectDesc:    { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  tagRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag:            { backgroundColor: '#1E293B', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText:        { color: colors.primary, fontSize: 11, fontWeight: '600' },
  diffBadge:      { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  diffText:       { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Next Reads
  groupLabel:     { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  nextCard:         { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: 10, marginBottom: 10 },
  nextCardClickable:{ borderColor: colors.primary, borderWidth: 1 },
  nextTitleLink:    { color: colors.primary },
  urlRow:           { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  urlText:          { color: colors.primary, fontSize: 11, flex: 1 },
  nextIconBox:    { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 2 },
  nextHeaderRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  nextTitle:      { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
  typePill:       { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start', flexShrink: 0 },
  typePillText:   { color: '#fff', fontSize: 9, fontWeight: '700' },
  nextMeta:       { color: colors.primary, fontSize: 12, marginBottom: 4 },
  nextReason:     { color: colors.muted, fontSize: 13, lineHeight: 18 },

  // Interview
  iqCard:         { backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 8 },
  iqQ:            { color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 },
  iqA:            { color: colors.muted, fontSize: 13, marginTop: 10, lineHeight: 20, borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },

  // Flashcards
  cardCounter:    { color: colors.muted, fontSize: 12, textAlign: 'center', marginBottom: 14 },
  flashFront:     { position: 'absolute', width: '100%', height: 180, backgroundColor: colors.card, borderRadius: 14, justifyContent: 'center', alignItems: 'center', padding: 20, backfaceVisibility: 'hidden' },
  flashBack:      { position: 'absolute', width: '100%', height: 180, backgroundColor: '#1E3A5F', borderRadius: 14, justifyContent: 'center', alignItems: 'center', padding: 20, backfaceVisibility: 'hidden' },
  hidden:         { opacity: 0 },
  flashQ:         { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 24 },
  flashHint:      { color: colors.muted, fontSize: 12, position: 'absolute', bottom: 14 },
  flashA:         { color: colors.text, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  fcNav:          { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 16 },
  fcBtn:          { backgroundColor: colors.card, borderRadius: 10, padding: 12 },

  // Quiz
  quizQ:          { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 24, marginBottom: 16 },
  option:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, padding: 14, marginBottom: 8 },
  optText:        { color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 },
  explanBox:      { backgroundColor: '#1E293B', borderRadius: 10, padding: 12, marginTop: 4 },
  explanText:     { color: colors.muted, fontSize: 13, lineHeight: 20 },
  nextBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 10, padding: 14, marginTop: 16 },
  nextBtnText:    { color: colors.bg, fontWeight: '700', fontSize: 15 },
  scoreTitle:     { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: 12 },
  scoreSub:       { color: colors.muted, fontSize: 16, marginTop: 4 },
  retryBtn:       { marginTop: 24, backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText:      { color: colors.bg, fontWeight: '700', fontSize: 15 },
})
