import { useState } from 'react';
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

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

export default function App(): JSX.Element {
  const [auth, setAuth] = useState<AuthState>({ kind: 'idle' });

  const onPress = async (): Promise<void> => {
    setAuth({ kind: 'pending' });
    try {
      const result = await HealthKitBridge.requestAuthorization(PHASE_1_TYPES);
      setAuth({ kind: 'granted', types: result.granted });
    } catch (e) {
      setAuth({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.color.background} />
      <View style={styles.container}>
        <Text style={styles.title}>Kinetica</Text>
        <Text style={styles.subtitle}>Phase 1 — bridge smoke test</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Request HealthKit authorization"
          onPress={onPress}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonLabel}>
            {auth.kind === 'pending' ? 'Requesting…' : 'Authorize HealthKit'}
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
    gap: theme.space.lg,
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
