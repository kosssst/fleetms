import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Button, useTheme } from 'react-native-paper';

interface NotificationProps {
  message: string | null;
  onDismiss: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, onDismiss }) => {
  const theme = useTheme();

  if (!message) {
    return null;
  }

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={!!message}
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.message, { color: theme.colors.onSurface }]}>{message}</Text>
          <Button onPress={onDismiss}>Close</Button>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    width: '80%',
  },
  message: {
    marginBottom: 10,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default Notification;