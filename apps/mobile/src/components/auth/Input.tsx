// Minimal text input. No label, no border-on-rest, no chrome — just a
// hairline at the bottom that thickens to the accent color on focus.
// Placeholder text is dim and disappears on focus.

import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { theme } from '@/theme';

type Props = Omit<TextInputProps, 'style'> & {
  testID?: string;
  monospace?: boolean;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { monospace = false, onFocus, onBlur, ...rest },
  ref,
): JSX.Element {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.row, focused ? styles.rowFocused : styles.rowResting]}>
      <TextInput
        ref={ref}
        {...rest}
        placeholderTextColor={focused ? 'transparent' : theme.color.textDim}
        selectionColor={theme.color.accent}
        cursorColor={theme.color.accent}
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        style={[styles.input, monospace ? styles.mono : styles.heading]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 0,
    paddingVertical: theme.space.sm,
  },
  rowResting: {
    borderBottomColor: theme.color.divider,
  },
  rowFocused: {
    borderBottomColor: theme.color.accent,
  },
  input: {
    color: theme.color.text,
    fontSize: 18,
    paddingVertical: 8,
  },
  heading: {
    fontFamily: theme.font.heading,
  },
  mono: {
    fontFamily: theme.font.mono,
    letterSpacing: 0.2,
  },
});
