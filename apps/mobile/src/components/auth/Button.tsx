// Two visual variants:
//   primary  — accent fill, dark text. Used for the call-to-action.
//   ghost    — 1px hairline border, accent-text on press. Secondary choices.
//
// Both share a 44pt minimum height (Apple HIG tap-target floor) and the
// 250ms / spring(180,22) press animation pinned in tokens.

import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { theme } from '@/theme';

export type ButtonVariant = 'primary' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: Props): JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number): void => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      stiffness: theme.motion.spring.stiffness,
      damping: theme.motion.spring.damping,
      mass: 1,
    }).start();
  };

  const isGhost = variant === 'ghost';

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={() => animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          isGhost ? styles.ghost : styles.primary,
          pressed && (isGhost ? styles.ghostPressed : styles.primaryPressed),
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.label, isGhost ? styles.ghostLabel : styles.primaryLabel]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 8,
    paddingHorizontal: theme.space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: theme.color.accent,
  },
  primaryPressed: {
    backgroundColor: theme.color.accent,
    opacity: 0.85,
  },
  ghost: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.text,
    backgroundColor: 'transparent',
  },
  ghostPressed: {
    borderColor: theme.color.accent,
  },
  disabled: {
    opacity: 0.32,
  },
  label: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primaryLabel: {
    color: theme.color.background,
  },
  ghostLabel: {
    color: theme.color.text,
  },
});
