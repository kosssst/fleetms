import React, { useEffect, useState } from 'react';
import { Banner, Text, useTheme } from 'react-native-paper';
import { BatteryOptimization } from '../native/batteryOptimization';

type Props = {
  onOpenHelp?: () => void; // navigate to the full help screen
};

const BatteryOptimizationBanner: React.FC<Props> = ({ onOpenHelp }) => {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await BatteryOptimization.isWhitelisted();
        if (mounted) setVisible(!ok);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (checking || !visible) return null;

  return (
    <Banner
      visible={visible}
      icon="battery-alert"
      style={{ marginTop: 12, backgroundColor: theme.colors.errorContainer }}
      actions={[
        {
          label: 'Allow now',
          onPress: () => BatteryOptimization.request(),
        },
        ...(onOpenHelp ? [{
          label: 'Help',
          onPress: onOpenHelp,
        }] : []),
        {
          label: 'Dismiss',
          onPress: () => setVisible(false),
        },
      ]}
    >
      <Text style={{ color: theme.colors.onErrorContainer }}>
        To record trips reliably with the screen off, allow the app to ignore battery optimizations.
      </Text>
    </Banner>
  );
};

export default BatteryOptimizationBanner;
