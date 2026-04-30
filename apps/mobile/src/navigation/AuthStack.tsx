// React Navigation native-stack covering the Phase 2 auth surface.
// Header is hidden on every screen — the visual hierarchy carries
// position via the StepIndicator + the heading typography. Replacing
// the default header chrome with our own restraint costs less code
// than themeing the platform header into invisibility.

import {
  NavigationContainer,
  type LinkingOptions,
  type Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthenticatedScreen } from '@/screens/auth/AuthenticatedScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterEmailScreen } from '@/screens/auth/RegisterEmailScreen';
import { RegisterEscrowScreen } from '@/screens/auth/RegisterEscrowScreen';
import { RegisterPassphraseScreen } from '@/screens/auth/RegisterPassphraseScreen';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { theme } from '@/theme';

export type AuthStackParamList = {
  Welcome: undefined;
  RegisterEmail: undefined;
  RegisterPassphrase: undefined;
  RegisterEscrow: undefined;
  Login: undefined;
  Authenticated: { userId: string; deviceId: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

// Deep links: `kinetica://<path>`. Used for screenshot capture without
// needing simulator-driving tools — `xcrun simctl openurl booted
// kinetica://register/passphrase` jumps straight to the passphrase
// step. The same `kinetica:` scheme is declared in app.json.
const linking: LinkingOptions<AuthStackParamList> = {
  prefixes: ['kinetica://'],
  config: {
    screens: {
      Welcome: '',
      RegisterEmail: 'register/email',
      RegisterPassphrase: 'register/passphrase',
      RegisterEscrow: 'register/escrow',
      Login: 'login',
      Authenticated: 'home',
    },
  },
};

const navTheme: Theme = {
  dark: true,
  colors: {
    primary: theme.color.accent,
    background: theme.color.background,
    card: theme.color.background,
    text: theme.color.text,
    border: theme.color.divider,
    notification: theme.color.accent,
  },
  fonts: {
    regular: { fontFamily: theme.font.heading, fontWeight: '400' },
    medium: { fontFamily: theme.font.heading, fontWeight: '500' },
    bold: { fontFamily: theme.font.heading, fontWeight: '700' },
    heavy: { fontFamily: theme.font.heading, fontWeight: '800' },
  },
};

export function AuthNavigator(): JSX.Element {
  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.color.background },
          animation: 'slide_from_right',
          animationDuration: 220,
          // `gestureEnabled: true` (iOS swipe-to-go-back) caused the
          // native-stack to keep a low-opacity card of the previous
          // screen rendered above the current one until the gesture
          // is dismissed. On the iOS 26 simulator that card stays
          // visible at idle and produces the ghost rectangle near
          // the top of the screen we kept seeing in screenshots.
          // Disabled — we can re-enable per screen later.
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="RegisterEmail" component={RegisterEmailScreen} />
        <Stack.Screen name="RegisterPassphrase" component={RegisterPassphraseScreen} />
        <Stack.Screen name="RegisterEscrow" component={RegisterEscrowScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Authenticated" component={AuthenticatedScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
