import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '@/constants/colors'

type Mood = 'good' | 'okay' | 'tired'

const MOODS: Array<{ key: Mood; emoji: string; label: string }> = [
  { key: 'good',  emoji: '😊', label: 'Good'  },
  { key: 'okay',  emoji: '😐', label: 'Okay'  },
  { key: 'tired', emoji: '😴', label: 'Tired' },
]

// Each mood gets its own color for expressiveness
const MOOD_COLOR: Record<Mood, string> = {
  good:  colors.success,
  okay:  colors.amber,
  tired: colors.violet,
}
const MOOD_BG: Record<Mood, string> = {
  good:  colors.successMuted,
  okay:  colors.amberMuted,
  tired: colors.violetMuted,
}

interface Props {
  value: Mood | null
  onChange: (mood: Mood) => void
}

export function MoodPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {MOODS.map(m => {
        const active = value === m.key
        return (
          <TouchableOpacity
            key={m.key}
            style={[
              styles.option,
              active && { backgroundColor: MOOD_BG[m.key], borderColor: MOOD_COLOR[m.key] },
            ]}
            onPress={() => onChange(m.key)}
          >
            <Text style={styles.emoji}>{m.emoji}</Text>
            <Text style={[styles.label, active && { color: MOOD_COLOR[m.key], fontWeight: '700' }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 10, marginBottom: 20 },
  option: { flex: 1, alignItems: 'center', paddingVertical: 12,
            backgroundColor: colors.surface, borderRadius: 12,
            borderWidth: 1, borderColor: colors.border },
  emoji:  { fontSize: 26 },
  label:  { marginTop: 4, fontSize: 12, color: colors.muted },
})
