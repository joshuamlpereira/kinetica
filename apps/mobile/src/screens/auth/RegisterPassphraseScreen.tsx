// Step 2 — passphrase + confirmation, with live zxcvbn strength meter.
// Continue activates only when (a) score >= 3 and (b) confirm matches.
// The eye toggle reveals both fields together so visual confirmation is
// instant; one toggle for both is intentional.

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import zxcvbn from 'zxcvbn';

import { Button } from '@/components/auth/Button';
import { EyeToggle } from '@/components/auth/EyeToggle';
import { Input } from '@/components/auth/Input';
import { ScreenContainer } from '@/components/auth/ScreenContainer';
import { StrengthBar } from '@/components/auth/StrengthBar';
import { useRegistrationDraft } from '@/state/registration';
import { theme } from '@/theme';

import { StepIndicator } from './_StepIndicator.tsx';
import type { AuthStackParamList } from '../../navigation/AuthStack.tsx';

const MIN_SCORE = 3;

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterPassphrase'>;

export function RegisterPassphraseScreen({ navigation }: Props): JSX.Element {
  const draft = useRegistrationDraft((s) => s.draft);
  const setPassphrase = useRegistrationDraft((s) => s.setPassphrase);
  const [confirm, setConfirm] = useState('');
  const [revealed, setRevealed] = useState(false);

  const result = useMemo(
    () => (draft.passphrase ? zxcvbn(draft.passphrase) : null),
    [draft.passphrase],
  );
  const score = result?.score ?? 0;
  const matches = draft.passphrase.length > 0 && draft.passphrase === confirm;
  const canContinue = score >= MIN_SCORE && matches;

  const feedback = useMemo(() => {
    if (!result || draft.passphrase.length === 0) return 'Aim for four words or more.';
    const r = result.feedback;
    if (r.warning) return r.warning;
    if (r.suggestions.length > 0) return r.suggestions[0]!;
    if (score < MIN_SCORE) return 'Add another word, or pick less common ones.';
    if (!matches) return draft.passphrase && confirm ? 'Doesn’t match.' : 'Confirm below.';
    return 'Strong enough.';
  }, [result, score, matches, draft.passphrase, confirm]);

  return (
    <ScreenContainer testID="register-passphrase-screen" keyboardAvoiding>
      <StepIndicator step={2} of={3} />
      <View style={styles.body}>
        <Text style={styles.heading}>Pick a passphrase.</Text>
        <Text style={styles.subhead}>
          A few unrelated words. We never see it; if you forget it, your data is gone.
        </Text>
        <View style={styles.field}>
          <Input
            value={draft.passphrase}
            onChangeText={setPassphrase}
            placeholder="passphrase"
            secureTextEntry={!revealed}
            autoComplete="off"
            textContentType="newPassword"
            monospace
            testID="register-passphrase-input"
          />
        </View>
        <View style={styles.field}>
          <Input
            value={confirm}
            onChangeText={setConfirm}
            placeholder="confirm"
            secureTextEntry={!revealed}
            autoComplete="off"
            textContentType="newPassword"
            monospace
            testID="register-passphrase-confirm"
          />
        </View>
        <View style={styles.metaRow}>
          <View style={styles.meterWrap}>
            <StrengthBar score={score} />
          </View>
          <EyeToggle visible={revealed} onToggle={() => setRevealed((v) => !v)} />
        </View>
        <Text style={styles.feedback} testID="register-passphrase-feedback">
          {feedback}
        </Text>
      </View>
      <Button
        label="Continue"
        onPress={() => navigation.navigate('RegisterEscrow')}
        disabled={!canContinue}
        testID="register-passphrase-continue"
      />
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
  field: {
    marginTop: theme.space.lg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.space.lg,
  },
  meterWrap: {
    flex: 1,
    marginRight: theme.space.md,
  },
  feedback: {
    marginTop: theme.space.sm,
    color: theme.color.textDim,
    fontFamily: theme.font.heading,
    fontSize: 12,
    lineHeight: 16,
  },
});
