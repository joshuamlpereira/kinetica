import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

import {
  ARGON2ID_MEM_LIMIT,
  ARGON2ID_OPS_LIMIT,
  initAppCrypto,
  runArgon2idBenchmark,
  type BenchmarkResult,
} from '@/crypto';
import { HealthKitBridge, HealthKitTypeIdentifier } from '@/health/bridge';
import { theme } from '@/theme';

const PHASE_1_TYPES: HealthKitTypeIdentifier[] = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
];

type AuthState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'granted'; types: HealthKitTypeIdentifier[] }
  | { kind: 'error'; message: string };

type CryptoBootState =
  | { kind: 'booting' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

type BenchState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; result: BenchmarkResult }
  | { kind: 'error'; message: string };

export default function App(): JSX.Element {
  const [auth, setAuth] = useState<AuthState>({ kind: 'idle' });
  const [boot, setBoot] = useState<CryptoBootState>({ kind: 'booting' });
  const [bench, setBench] = useState<BenchState>({ kind: 'idle' });

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

  const onAuthHealthKit = async (): Promise<void> => {
    setAuth({ kind: 'pending' });
    try {
      const result = await HealthKitBridge.requestAuthorization(PHASE_1_TYPES);
      setAuth({ kind: 'granted', types: result.granted });
    } catch (e) {
      setAuth({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  const onRunBenchmark = async (): Promise<void> => {
    setBench({ kind: 'running' });
    try {
      const result = await runArgon2idBenchmark(
        5,
        { opsLimit: ARGON2ID_OPS_LIMIT, memLimit: ARGON2ID_MEM_LIMIT },
        'ios-simulator',
      );
      console.log('[KEK_BENCH]', JSON.stringify(result));
      setBench({ kind: 'done', result });
    } catch (e) {
      setBench({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.color.background} />
      <View style={styles.container}>
        <Text style={styles.title}>Kinetica</Text>
        <Text style={styles.subtitle}>Phase 2 — crypto bench</Text>

        <Text style={styles.statusText}>crypto: {boot.kind}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request HealthKit authorization"
          onPress={onAuthHealthKit}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonLabel}>
            {auth.kind === 'pending' ? 'Requesting…' : 'Authorize HealthKit'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Run KEK benchmark"
          onPress={onRunBenchmark}
          disabled={boot.kind !== 'ready' || bench.kind === 'running'}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            boot.kind !== 'ready' && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.buttonLabel}>
            {bench.kind === 'running' ? 'Running…' : 'Run KEK benchmark'}
          </Text>
        </Pressable>

        <View style={styles.status}>
          {auth.kind === 'granted' && (
            <Text style={styles.statusText}>
              Granted: {auth.types.length === 0 ? 'none' : auth.types.join(', ')}
            </Text>
          )}
          {auth.kind === 'error' && (
            <Text style={styles.statusError}>Error: {auth.message}</Text>
          )}
          {bench.kind === 'done' && (
            <Text style={styles.statusText}>
              KEK median {bench.result.median_ms.toFixed(1)}ms / p95{' '}
              {bench.result.p95_ms.toFixed(1)}ms (n={bench.result.iterations}, t=
              {bench.result.params.opsLimit}, m=
              {Math.round(bench.result.params.memLimit / (1024 * 1024))}MiB,{' '}
              {bench.result.provenance})
            </Text>
          )}
          {bench.kind === 'error' && (
            <Text style={styles.statusError}>Bench error: {bench.message}</Text>
          )}
          {boot.kind === 'error' && (
            <Text style={styles.statusError}>Crypto boot: {boot.message}</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.color.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.space.lg,
    justifyContent: 'center',
    gap: theme.space.md,
  },
  title: {
    color: theme.color.text,
    fontSize: 36,
    fontFamily: theme.font.heading,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.color.textDim,
    fontSize: 14,
    fontFamily: theme.font.heading,
  },
  button: {
    backgroundColor: theme.color.accent,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    color: theme.color.background,
    fontSize: 16,
    fontFamily: theme.font.heading,
    fontWeight: '600',
  },
  status: {
    minHeight: 48,
  },
  statusText: {
    color: theme.color.text,
    fontFamily: theme.font.mono,
    fontSize: 13,
  },
  statusError: {
    color: '#FF6B6B',
    fontFamily: theme.font.mono,
    fontSize: 13,
  },
});
