import { Alert } from 'react-native';

export type DestructivePrompt = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
};

/** Android and iOS: the platform dialog. */
export function confirmDestructive({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: DestructivePrompt): void {
  Alert.alert(title, body, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
