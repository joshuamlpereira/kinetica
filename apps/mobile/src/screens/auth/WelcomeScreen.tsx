// Welcome — the first screen anyone sees. Wordmark + one-line positioning
// + two CTAs. Negative space is intentional; this is not a marketing
// surface.

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/auth/Button';
import { ScreenContainer } from '@/components/auth/ScreenContainer';
import { theme } from '@/theme';

import type { AuthStackParamList } from '../../navigation/AuthStack.tsx';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props): JSX.Element {
  return (
    <ScreenContainer testID="welcome-screen">
      <View style={styles.body}>
        <View style={styles.brand}>
          <Text style={styles.wordmark}>Kinetica</Text>
          <Text style={styles.subtitle}>Train. Sleep. Eat. See yourself clearly.</Text>
        </View>
        <View style={styles.actions}>
          <Button
            label="Create account"
            onPress={() => navigation.navigate('RegisterEmail')}
            testID="welcome-cta-register"
          />
          <Button
            label="I already have an account"
            variant="ghost"
            onPress={() => navigation.navigate('Login')}
            testID="welcome-cta-login"
            style={styles.secondaryCta}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brand: {
    marginTop: theme.space.xl,
  },
  wordmark: {
    color: theme.color.text,
    fontFamily: theme.font.heading,
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  subtitle: {
    color: theme.color.textDim,
    fontFamily: theme.font.heading,
    fontSize: 15,
    fontWeight: '300',
    lineHeight: 22,
    marginTop: theme.space.md,
    maxWidth: 300,
  },
  actions: {
    marginBottom: theme.space.xl,
  },
  secondaryCta: {
    marginTop: theme.space.md,
  },
});
