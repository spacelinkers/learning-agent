import React from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '@/constants/colors'

interface Props {
  progress: number   // 0–1
  size?: number
  strokeWidth?: number
  color?: string
  label?: string
}

export function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 6,
  color = colors.primary,
  label,
}: Props) {
  const r      = (size - strokeWidth) / 2
  const cx     = size / 2
  const circ   = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(Math.max(progress, 0), 1))
  const pct    = Math.round(progress * 100)

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle cx={cx} cy={cx} r={r} stroke={colors.card} strokeWidth={strokeWidth} fill="none" />
        {/* Progress arc */}
        <Circle
          cx={cx} cy={cx} r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx},${cx}`}
        />
      </Svg>
      <Text style={{ color: colors.text, fontSize: size * 0.22, fontWeight: '700' }}>
        {label ?? `${pct}%`}
      </Text>
    </View>
  )
}
