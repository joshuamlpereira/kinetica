// Step 1 of registration — email only. Autofocus on mount, no labels.
// Continue button activates only when the input matches a basic email
// pattern. The pattern is deliberately simple; full RFC 5322 lives on
// the server (Pydantic's EmailStr).

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/auth/Button';
import { Input } from '@/components/auth/Input';
import { ScreenContainer } from '@/components/auth/ScreenContainer';
import { useRegistrationDraft } from '@/state/registration';
import { theme } from '@/theme';

import { StepIndicator } from './_StepIndicator.tsx';
import type { AuthStackParamList } from '../../navigation/AuthStack.tsx';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterEmail'>;

export function RegisterEmailScreen({ navigation }: Props): JSX.Element {
  const ref = useRef<TextInput>(null);
  const draft = useRegistrationDraft((s) => s.draft);
  const setEmail = useRegistrationDraft((s) => s.setEmail);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => ref.current?.focus(), 80);
    return () => clearTimeout(id);
  }, []);

  const trimmed = draft.email.trim();
  const valid = EMAIL_REGEX.test(trimmed);

  return (
    <ScreenContainer testID="register-email-screen" keyboardAvoiding>
      <StepIndicator step={1} of={3} />
      <View style={styles.body}>
        <Text style={styles.heading}>{`What’s your email?`}</Text>
        <Text style={styles.subhead}>
          We use this once to send you a welcome message and never store it.
        </Text>
        <View style={styles.field}>
          <Input
            ref={ref}
            value={draft.email}
            onChangeText={(t) => {
              setEmail(t);
              if (!touched) setTouched(true);
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            inputMode="email"
            monospace
            returnKeyType="next"
            testID="register-email-input"
            onSubmitEditing={() =>
              valid ? navigation.navigate('RegisterPassphrase') : null
            }
          />
        </View>
      </View>
      <Button
        label="Continue"
        onPress={() => navigation.navigate('RegisterPassphrase')}
        disabled={!valid}
        testID="register-email-continue"
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
    marginTop: theme.space.xl,
  },
});
