// Indeterminate progress treatment. A thin accent-colored segment sweeps
// left-to-right across a hairline track. Used during Argon2id derivation
// (~200ms on real device) and the local key unwrap. No spinners.
//
// The sweep is a continuous loop until the parent unmounts the component,
// not a finite-duration animation — the operation may be 50ms or 500ms
// depending on device, and we don't want to commit to a length.

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

const TRACK_HEIGHT = 2;
const SEGMENT_FRACTION = 0.32;
const CYCLE_MS = 1100;

type Props = {
  testID?: string;
};

export function SweepingLine({ testID }: Props): JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: CYCLE_MS,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [progress]);

  // The segment starts off the left edge (-segment width) and sweeps to
  // off the right edge (100%), so each cycle reads as one continuous
  // pass across the track.
  const left = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`-${SEGMENT_FRACTION * 100}%`, '100%'],
  });

  return (
    <View style={styles.track} testID={testID}>
      <Animated.View
        style={[
          styles.segment,
          {
            left,
            width: `${SEGMENT_FRACTION * 100}%`,
          },
        ]}
        accessibilityRole="progressbar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: theme.color.divider,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    backgroundColor: theme.color.accent,
    borderRadius: TRACK_HEIGHT / 2,
  },
});
