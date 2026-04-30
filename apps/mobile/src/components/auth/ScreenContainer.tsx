// Layout primitive every auth screen sits inside. Pure-black background,
// safe-area inset, generous horizontal padding to push content away from
// the edges. The negative space is the design.
//
// `keyboardAvoiding` is opt-in: screens with text inputs pass it. The
// Welcome screen doesn't, and wrapping it in KeyboardAvoidingView
// produces a ghost-render artifact at the top (RN 0.76 + iOS 26
// simulator) that nothing else seems to reproduce.

import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, View } from 'react-native';

import { theme } from '@/theme';

type Props = {
  children: ReactNode;
  testID?: string;
  keyboardAvoiding?: boolean;
};

export function ScreenContainer({
  children,
  testID,
  keyboardAvoiding = false,
}: Props): JSX.Element {
  if (!keyboardAvoiding) {
    return (
      <SafeAreaView style={styles.root} testID={testID}>
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.root} testID={testID}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  flex: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xl,
  },
});
