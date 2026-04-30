// Thin horizontal bar that fills with the accent color as zxcvbn score
// increases. Below score 3 the fill shifts to a desaturated red so the
// "not strong enough yet" state reads at a glance.
//
// Score input is the integer 0..4 zxcvbn returns. Animation hits the
// pinned spring (180 / 22) and stays under 250ms.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

const TRACK_HEIGHT = 2;
const WEAK_COLOR = '#FF6B6B';

type Props = {
  score: number; // 0..4
  testID?: string;
};

export function StrengthBar({ score, testID }: Props): JSX.Element {
  const fraction = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fraction, {
      toValue: clamp01((score + 1) / 5),
      useNativeDriver: false,
      stiffness: theme.motion.spring.stiffness,
      damping: theme.motion.spring.damping,
      mass: 1,
    }).start();
  }, [score, fraction]);

  const widthInterp = fraction.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const color = score >= 3 ? theme.color.accent : WEAK_COLOR;

  return (
    <View style={styles.track} testID={testID}>
      <Animated.View
        style={[styles.fill, { width: widthInterp, backgroundColor: color }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: score, min: 0, max: 4 }}
      />
    </View>
  );
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: theme.color.divider,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  fill: {
    height: TRACK_HEIGHT,
  },
});
