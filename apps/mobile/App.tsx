// Phase 2 root: initialise sodium, mount the auth navigator. The
// bench harness UI from earlier turns is gone — its purpose was
// pinning Argon2id constants, which is now done. The benchmark code
// itself remains under src/crypto/benchmark.ts for re-runs on a real
// device.

import { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';

import { initAppCrypto } from '@/crypto';
import { AuthNavigator } from '@/navigation/AuthStack';
import { theme } from '@/theme';

type Boot = { kind: 'booting' } | { kind: 'ready' } | { kind: 'error'; message: string };

export default function App(): JSX.Element {
  const [boot, setBoot] = useState<Boot>({ kind: 'booting' });

  useEffect(() => {
    void (async () => {
      try {
        await initAppCrypto();
        setBoot({ kind: 'ready' });
      } catch (e) {
        setBoot({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
  }, []);

  if (boot.kind === 'error') {
    return (
      <View style={styles.fallback}>
        <StatusBar barStyle="light-content" backgroundColor={theme.color.background} />
        <Text style={styles.fallbackHeading}>Crypto bootstrap failed.</Text>
        <Text style={styles.fallbackBody}>{boot.message}</Text>
      </View>
    );
  }
  if (boot.kind === 'booting') {
    return (
      <View style={styles.fallback}>
        <StatusBar barStyle="light-content" backgroundColor={theme.color.background} />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.color.background} />
      <AuthNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: theme.color.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
  },
  fallbackHeading: {
    color: theme.color.text,
    fontFamily: theme.font.heading,
    fontSize: 18,
    fontWeight: '600',
  },
  fallbackBody: {
    color: theme.color.textDim,
    fontFamily: theme.font.mono,
    fontSize: 12,
    marginTop: theme.space.md,
    textAlign: 'center',
  },
});
