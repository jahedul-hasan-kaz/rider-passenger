import type { ConfigContext, ExpoConfig } from 'expo/config';

// docs/spec/01-overview-foundation.md §4. One config, three variants picked by EXPO_PUBLIC_APP_ENV, so a development,
// staging and production build can be installed side by side. Only publishable values are read here; secrets live in
// EAS environment variables (build-time) and EAS credentials (signing, push), never in this file.

type AppEnv = 'development' | 'staging' | 'production';

// Placeholders until the product name, bundle ids and deep-link scheme are locked (docs/spec/05-quality-delivery.md D1).
const BASE = {
  name: 'Rider',
  slug: 'rider-passenger',
  scheme: 'riderpassenger',
  bundleId: 'bd.rider.passenger',
};

const VARIANTS: Record<AppEnv, { nameSuffix: string; idSuffix: string; schemeSuffix: string }> = {
  development: { nameSuffix: ' (Dev)', idSuffix: '.dev', schemeSuffix: '-dev' },
  staging: { nameSuffix: ' (Staging)', idSuffix: '.staging', schemeSuffix: '-staging' },
  production: { nameSuffix: '', idSuffix: '', schemeSuffix: '' },
};

function appEnv(): AppEnv {
  const value = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
  if (value === 'development' || value === 'staging' || value === 'production') return value;
  throw new Error(`EXPO_PUBLIC_APP_ENV must be development, staging or production (got "${value}").`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const env = appEnv();
  const variant = VARIANTS[env];
  const bundleId = BASE.bundleId + variant.idSuffix;
  const easProjectId = process.env.EAS_PROJECT_ID;

  return {
    ...config,
    name: BASE.name + variant.nameSuffix,
    slug: BASE.slug,
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: BASE.scheme + variant.schemeSuffix,
    userInterfaceStyle: 'automatic',
    runtimeVersion: { policy: 'appVersion' },
    updates: easProjectId ? { url: `https://u.expo.dev/${easProjectId}` } : undefined,
    ios: {
      bundleIdentifier: bundleId,
      supportsTablet: false,
      icon: './assets/expo.icon',
      infoPlist: {
        CFBundleAllowMixedLocalizations: true,
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: bundleId,
      adaptiveIcon: {
        backgroundColor: '#0B3B2E',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      // Passengers never need background location (spec §11); block it even if a library tries to add it.
      blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION'],
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0B3B2E',
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      ],
      'expo-secure-store',
      ['expo-localization', { supportedLocales: { ios: ['en', 'bn'], android: ['en', 'bn'] } }],
      [
        '@sentry/react-native',
        {
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
        },
      ],
      'expo-updates',
      '@maplibre/maplibre-react-native',
      ['expo-notifications', { color: '#0B3B2E', defaultChannel: 'ride' }],
      [
        'expo-image-picker',
        {
          photosPermission: 'Choose a photo to add as evidence to a safety report.',
          cameraPermission: 'Take a photo to add as evidence to a safety report.',
          microphonePermission: false,
        },
      ],
      [
        'expo-location',
        {
          // Foreground only (spec §11). Shown by iOS under the permission dialog.
          locationWhenInUsePermission:
            'Your location sets the pickup point, gives accurate fares and lets our safety team find you if you press SOS. It is used only while the app is open.',
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appEnv: env,
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  };
};
