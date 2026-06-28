import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '@/constants/colors'

type Mood = 'good' | 'okay' | 'tired'

const MOODS: Array<{ key: Mood; emoji: string; label: string }> = [
  { key: 'good',  emoji: '😊', label: 'Good'  },
  { key: 'okay',  emoji: '😐', label: 'Okay'  },
  { key: 'tired', emoji: '😴', label: 'Tired' },
]

interface Props {
  value: Mood | null
  onChange: (mood: Mood) => void
}

export function MoodPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {MOODS.map(m => (
        <TouchableOpacity
          key={m.key}
          style={[styles.option, value === m.key && styles.selected]}
          onPress={() => onChange(m.key)}
        >
          <Text style={styles.emoji}>{m.emoji}</Text>
          <Text style={[styles.label, value === m.key && styles.labelSelected]}>
            {m.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row:           { flexDirection: 'row', gap: 10, marginBottom: 20 },
  option:        { flex: 1, alignItems: 'center', paddingVertical: 12,
                   backgroundColor: colors.surface, borderRadius: 12,
                   borderWidth: 1, borderColor: colors.border },
  selected:      { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  emoji:         { fontSize: 26 },
  label:         { marginTop: 4, fontSize: 12, color: colors.muted },
  labelSelected: { color: colors.primary, fontWeight: '600' },
})
