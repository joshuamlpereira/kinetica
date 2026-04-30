// Login on the same device the user registered on. The email field is
// mostly cosmetic (the local Keychain entry already binds to one
// account), but the spec lists both fields and surfacing the email
// keeps the UX honest about which account is being unlocked.
//
// MARQUEE INVARIANT: a wrong passphrase MUST fail locally — `login()`
// throws WrongPassphraseError before any network call when the AEAD
// tag check on the wrapped master key fails. The screen catches that
// specific exception and shows a single dim-red line. No alert, no
// shake, no popup.

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { login, NoLocalAccountError, WrongPassphraseError } from '@/auth/login';
import { Button } from '@/components/auth/Button';
import { EyeToggle } from '@/components/auth/EyeToggle';
import { Input } from '@/components/auth/Input';
import { ScreenContainer } from '@/components/auth/ScreenContainer';
import { SweepingLine } from '@/components/auth/SweepingLine';
import { theme } from '@/theme';

import type { AuthStackParamList } from '../../navigation/AuthStack.tsx';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

type LoginPhase =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'wrong_passphrase' }
  | { kind: 'no_account' }
  | { kind: 'error'; message: string };

export function LoginScreen({ navigation }: Props): JSX.Element {
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState<LoginPhase>({ kind: 'idle' });

  const submit = async (): Promise<void> => {
    setPhase({ kind: 'submitting' });
    try {
      const result = await login(passphrase);
      navigation.reset({
        index: 0,
        routes: [
          { name: 'Authenticated', params: { userId: result.user_id, deviceId: result.device_id } },
        ],
      });
    } catch (e) {
      if (e instanceof WrongPassphraseError) {
        setPhase({ kind: 'wrong_passphrase' });
      } else if (e instanceof NoLocalAccountError) {
        setPhase({ kind: 'no_account' });
      } else {
        setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    }
  };

  const submitting = phase.kind === 'submitting';
  const canSubmit = email.trim().length > 0 && passphrase.length > 0 && !submitting;

  return (
    <ScreenContainer testID="login-screen" keyboardAvoiding>
      <View style={styles.body}>
        <Text style={styles.heading}>Welcome back.</Text>
        <View style={styles.field}>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            inputMode="email"
            monospace
            testID="login-email-input"
          />
        </View>
        <View style={styles.field}>
          <Input
            value={passphrase}
            onChangeText={(t) => {
              setPassphrase(t);
              if (phase.kind === 'wrong_passphrase') setPhase({ kind: 'idle' });
            }}
            placeholder="passphrase"
            secureTextEntry={!revealed}
            autoComplete="password"
            textContentType="password"
            monospace
            testID="login-passphrase-input"
          />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaSpacer} />
          <EyeToggle visible={revealed} onToggle={() => setRevealed((v) => !v)} />
        </View>
        <View style={styles.feedback}>
          {phase.kind === 'wrong_passphrase' ? (
            <Text style={styles.error} testID="login-wrong-passphrase">
              Incorrect passphrase.
            </Text>
          ) : null}
          {phase.kind === 'no_account' ? (
            <Text style={styles.error} testID="login-no-account">
              No account on this device. Create one first.
            </Text>
          ) : null}
          {phase.kind === 'error' ? (
            <Text style={styles.error} testID="login-error">
              {phase.message}
            </Text>
          ) : null}
        </View>
      </View>
      {submitting ? (
        <View style={styles.progress}>
          <SweepingLine testID="login-progress" />
          <Text style={styles.progressLabel}>Unlocking your keys.</Text>
        </View>
      ) : (
        <Button
          label="Sign in"
          onPress={() => {
            void submit();
          }}
          disabled={!canSubmit}
          testID="login-submit"
        />
      )}
    </ScreenContainer>
  );
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
    marginBottom: theme.space.xl,
  },
  field: {
    marginTop: theme.space.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.space.md,
  },
  metaSpacer: { flex: 1 },
  feedback: {
    minHeight: 24,
    marginTop: theme.space.md,
  },
  error: {
    color: '#FF6B6B',
    fontFamily: theme.font.heading,
    fontSize: 13,
    fontWeight: '300',
  },
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
});
