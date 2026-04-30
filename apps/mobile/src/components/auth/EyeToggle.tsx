// Show/hide passphrase toggle. Icon-only (no text), 44pt tap target. The
// glyph is a hand-drawn eye in two states — open (passphrase visible)
// and slashed (hidden). React Native ships no icon library and we don't
// want one as a dep, so the icon is a pair of vector paths.

import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

type Props = {
  visible: boolean;
  onToggle: () => void;
  testID?: string;
};

export function EyeToggle({ visible, onToggle, testID }: Props): JSX.Element {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: visible }}
      accessibilityLabel={visible ? 'Hide passphrase' : 'Show passphrase'}
      testID={testID}
      style={({ pressed }) => [styles.tap, pressed && styles.pressed]}
      hitSlop={8}
    >
      {/* Eye outline. */}
      <View style={[styles.eye, !visible && styles.eyeDim]}>
        <View style={[styles.pupil, !visible && styles.pupilDim]} />
      </View>
      {visible ? null : <View style={styles.slash} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  eye: {
    width: 20,
    height: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.text,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeDim: { borderColor: theme.color.textDim },
  pupil: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.color.text,
  },
  pupilDim: { backgroundColor: theme.color.textDim },
  slash: {
    position: 'absolute',
    width: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.color.textDim,
    transform: [{ rotate: '-22deg' }],
  },
});
