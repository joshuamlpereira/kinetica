// Placeholder destination after a successful registration or login.
// Phase 3 replaces this with the real app shell. For now we surface
// the user_id + device_id so a reviewer can see the round-trip
// completed against the backend.

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/auth/ScreenContainer';
import { theme } from '@/theme';

import type { AuthStackParamList } from '../../navigation/AuthStack.tsx';

type Props = NativeStackScreenProps<AuthStackParamList, 'Authenticated'>;

export function AuthenticatedScreen({ route }: Props): JSX.Element {
  const { userId, deviceId } = route.params;
  return (
    <ScreenContainer testID="authenticated-screen">
      <View style={styles.body}>
        <Text style={styles.eyebrow}>Signed in</Text>
        <Text style={styles.heading}>{`You’re in.`}</Text>
        <View style={styles.identity}>
          <Text style={styles.label}>user</Text>
          <Text style={styles.mono} testID="authenticated-user-id">
            {userId}
          </Text>
          <Text style={[styles.label, styles.labelGap]}>device</Text>
          <Text style={styles.mono} testID="authenticated-device-id">
            {deviceId}
          </Text>
        </View>
        <Text style={styles.note}>App shell lands in Phase 3.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: theme.space.xl,
  },
  eyebrow: {
    color: theme.color.accent,
    fontFamily: theme.font.heading,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heading: {
    color: theme.color.text,
    fontFamily: theme.font.heading,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: theme.space.sm,
  },
  identity: {
    marginTop: theme.space.xl,
  },
  label: {
    color: theme.color.textDim,
    fontFamily: theme.font.heading,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  labelGap: { marginTop: theme.space.md },
  mono: {
    color: theme.color.text,
    fontFamily: theme.font.mono,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  note: {
    marginTop: theme.space.xl,
    color: theme.color.textDim,
    fontFamily: theme.font.heading,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
