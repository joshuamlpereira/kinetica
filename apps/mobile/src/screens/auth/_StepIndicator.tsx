// Three-pill step indicator at the top of the registration flow.
// Filled-accent for the current step; hairline divider for upcoming.
// No numbers or text — the position carries the info.

import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

type Props = {
  step: number; // 1-indexed
  of: number;
  testID?: string;
};

export function StepIndicator({ step, of, testID }: Props): JSX.Element {
  return (
    <View style={styles.row} testID={testID}>
      {Array.from({ length: of }, (_, i) => (
        <View
          key={i}
          style={[
            styles.pill,
            i + 1 === step ? styles.pillActive : styles.pillResting,
            i > 0 && styles.gap,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  pillActive: {
    backgroundColor: theme.color.accent,
  },
  pillResting: {
    backgroundColor: theme.color.divider,
  },
  gap: {
    marginLeft: theme.space.sm,
  },
});
