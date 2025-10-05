// src/screens/BatteryOptimizationHelp.tsx
import React, { useCallback } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

type TipCardProps = { title: string; children: React.ReactNode };
const TipCard: React.FC<TipCardProps> = ({ title, children }) => (
  <View style={styles.card}>
    <Text variant="titleMedium" style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

const BulletRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.bulletRow}>
    <Text style={styles.bulletDot}>{'\u2022'}</Text>
    <Text style={styles.bulletText}>{children}</Text>
  </View>
);

const BatteryOptimizationHelp: React.FC = () => {
  const theme = useTheme();

  const openIgnoreBatteryOpt = useCallback(() => {
    if (Platform.OS === 'android') {
      Linking.openSettings(); // fallback
      Linking.openURL('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => {});
    }
  }, []);

  const openAutostartSettings = useCallback(() => {
    if (Platform.OS === 'android') {
      // Generic fallbacks; OEM-specific intents handled by manufacturer UIs
      Linking.openSettings();
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleLarge">Maximize background reliability</Text>
      <Text style={styles.topParagraph}>
        Some Android devices restrict background work to save battery. To keep OBD polling,
        GPS, and sending data stable while the screen is off, do the following:
      </Text>

      <TipCard title="1) Allow ignoring Battery Optimization">
        <BulletRow>Open system settings and exclude this app from Battery Optimization.</BulletRow>
        <BulletRow>This prevents Android from delaying timers and network in the background.</BulletRow>
        <Button mode="contained" style={styles.cardButton} onPress={openIgnoreBatteryOpt}>
          Open Battery Optimization
        </Button>
      </TipCard>

      <TipCard title="2) Enable Autostart / Unrestricted battery (OEM specific)">
        <BulletRow>On Xiaomi/MIUI: Settings → Apps → Permissions → Autostart → enable for this app.</BulletRow>
        <BulletRow>On Huawei: Settings → Battery → App launch → Disable “Manage automatically” → enable all three.</BulletRow>
        <BulletRow>On Samsung: Settings → Battery → Background usage limits → remove this app from sleeping apps.</BulletRow>
        <Button mode="outlined" style={styles.cardButton} onPress={openAutostartSettings}>
          Open App Settings
        </Button>
      </TipCard>

      <TipCard title="3) Keep notification enabled">
        <BulletRow>We show a foreground service notification during trips. Don’t block it.</BulletRow>
      </TipCard>

      <Text style={styles.footerNote}>
        Tip: Start a trip, turn the screen off, and confirm the notification stays visible while
        speed/RPM keep updating on the server.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1 },
  topParagraph: { marginTop: 8 },
  card: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#99999955',
  },
  cardTitle: { fontWeight: '600', marginBottom: 4 },
  bulletRow: { flexDirection: 'row', marginTop: 8, alignItems: 'flex-start' },
  bulletDot: { marginRight: 8, lineHeight: 20 },
  bulletText: { flex: 1 },
  cardButton: { marginTop: 12 },
  footerNote: { marginTop: 16 },
});

export default BatteryOptimizationHelp;
