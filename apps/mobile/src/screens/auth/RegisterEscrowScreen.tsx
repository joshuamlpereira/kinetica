// Step 3 — escrow choice, then commit. Two cards, one selected at a
// time. The Create button performs the actual cryptographic work
// (Argon2id KEK + master key generation + wrap + canonical-JSON sign)
// followed by the network POST. While that runs the sweeping accent
// line replaces the button row.

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { postRegister } from '@/auth/api';
import { prepareRegistration } from '@/auth/registration';
import { saveCredentials } from '@/auth/storage';
import { Button } from '@/components/auth/Button';
import { Card } from '@/components/auth/Card';
import { ScreenContainer } from '@/components/auth/ScreenContainer';
import { SweepingLine } from '@/components/auth/SweepingLine';
import { useRegistrationDraft, type EscrowMode } from '@/state/registration';
import { theme } from '@/theme';

import { StepIndicator } from './_StepIndicator.tsx';
import type { AuthStackParamList } from '../../navigation/AuthStack.tsx';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterEscrow'>;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export function RegisterEscrowScreen({ navigation }: Props): JSX.Element {
  const draft = useRegistrationDraft((s) => s.draft);
  const setEscrow = useRegistrationDraft((s) => s.setEscrow);
  const reset = useRegistrationDraft((s) => s.reset);
  const [mode, setMode] = useState<EscrowMode>(draft.escrowMode ?? 'icloud');
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const select = (m: EscrowMode): void => {
    setMode(m);
    setEscrow(m);
  };

  const submit = async (): Promise<void> => {
    setPhase('submitting');
    setError(null);
    try {
      const { payload, localKeys } = await prepareRegistration(
        draft.email,
        draft.passphrase,
        deviceLabel(),
      );
      const response = await postRegister(payload);
      await saveCredentials({
        email: draft.email.trim(),
        password_salt_b64: payload.password_salt,
        wrapped_master_key_b64: payload.wrapped_master_key,
        device_pubkey_b64: payload.device_pubkey,
        device_secret_key_b64: toBase64(localKeys.deviceKeypair.privateKey),
        user_id: response.user_id,
        device_id: response.device_id,
      });
      reset();
      navigation.reset({
        index: 0,
        routes: [
          { name: 'Authenticated', params: { userId: response.user_id, deviceId: response.device_id } },
        ],
      });
    } catch (e) {
      setPhase('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScreenContainer testID="register-escrow-screen">
      <StepIndicator step={3} of={3} />
      <View style={styles.body}>
        <Text style={styles.heading}>How should we handle recovery?</Text>
        <Text style={styles.subhead}>
          You can change this later. Either way, we never see your passphrase.
        </Text>
        <View style={styles.cards}>
          <Card
            title="Recover with iCloud Keychain"
            description="Your encryption keys sync across your Apple devices via iCloud Keychain. If you lose this phone, signing in on a new one restores your data."
            selected={mode === 'icloud'}
            onPress={() => select('icloud')}
            testID="register-escrow-icloud"
          />
          <View style={styles.cardSpacer} />
          <Card
            title="Don't escrow — I'll remember it"
            description="Your keys never leave this device. Strongest privacy, no fallback."
            selected={mode === 'zk'}
            onPress={() => select('zk')}
            warning="If you lose your passphrase, your data is unrecoverable."
            testID="register-escrow-zk"
          />
        </View>
      </View>
      {phase === 'submitting' ? (
        <View style={styles.progress}>
          <SweepingLine testID="register-escrow-progress" />
          <Text style={styles.progressLabel}>Building your keys.</Text>
        </View>
      ) : (
        <Button
          label="Create account"
          onPress={() => {
            void submit();
          }}
          testID="register-escrow-submit"
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScreenContainer>
  );
}

function deviceLabel(): string {
  // Phase 6 ops will pull this from `expo-device`. The Phase 2 demo uses a
  // stable string so the device row is identifiable in the DB.
  return 'iPhone (Phase 2 demo)';
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: theme.space.xl,
  },
  heading: {
    color: theme.color.text,
    fontFamily: theme.font.heading,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subhead: {
    color: theme.color.textDim,
    fontFamily: theme.font.heading,
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 20,
    marginTop: theme.space.sm,
    maxWidth: 320,
  },
  cards: { marginTop: theme.space.xl },
  cardSpacer: { height: theme.space.md },
  progress: {
    minHeight: 52,
    justifyContent: 'center',
  },
  progressLabel: {
    color: theme.color.textDim,
    fontFamily: theme.font.heading,
    fontSize: 12,
    marginTop: theme.space.sm,
  },
  error: {
    marginTop: theme.space.sm,
    color: '#FF6B6B',
    fontFamily: theme.font.heading,
    fontSize: 12,
  },
});
