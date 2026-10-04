import { Alert } from 'react-native';

/** Asks the user to approve an action. Resolves false on Cancel or dismiss. */
export function confirmAction(message: string, confirmLabel = 'Allow'): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      'Confirm',
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
