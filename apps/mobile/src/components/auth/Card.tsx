// Full-width selectable card. Used for the escrow choice on registration
// step 3. Resting state has a hairline divider border; selected state
// fades to the accent color over the spring window.
//
// The "subtle accent glow" called out in the spec is implemented as a
// border color animation, no shadow — shadows on dark backgrounds read
// as halos and break the pure-black aesthetic.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

type Props = {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  warning?: string | null;
  accessibilityLabel?: string;
  testID?: string;
};

export function Card({
  title,
  description,
  selected,
  onPress,
  warning,
  accessibilityLabel,
  testID,
}: Props): JSX.Element {
  const t = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(t, {
      toValue: selected ? 1 : 0,
      useNativeDriver: false,
      stiffness: theme.motion.spring.stiffness,
      damping: theme.motion.spring.damping,
      mass: 1,
    }).start();
  }, [selected, t]);

  const borderColor = t.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.color.divider, theme.color.accent],
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? title}
      testID={testID}
      style={({ pressed }) => [styles.pressableWrap, pressed && styles.pressed]}
    >
      <Animated.View style={[styles.card, { borderColor }]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        {warning ? <Text style={styles.warning}>{warning}</Text> : null}
        <View style={styles.footer}>
          <Animated.View style={[styles.dot, { opacity: t }]} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableWrap: {
    width: '100%',
  },
  pressed: { opacity: 0.92 },
  card: {
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
  },
  title: {
    color: theme.color.text,
    fontFamily: theme.font.heading,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  description: {
    color: theme.color.textDim,
    fontFamily: theme.font.heading,
    fontSize: 13,
    lineHeight: 18,
  },
  warning: {
    marginTop: theme.space.sm,
    color: theme.color.textDim,
    fontFamily: theme.font.heading,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  footer: {
    marginTop: theme.space.md,
    alignItems: 'flex-end',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.color.accent,
  },
});
