import type { DestructivePrompt } from './confirmDestructive';

/**
 * Web: react-native-web's Alert.alert is literally `static alert() {}`, so
 * using it would make deletion fail silently — no dialog, no error, nothing.
 * The browser's own confirm takes its place.
 */
export function confirmDestructive({
  title,
  body,
  onConfirm,
}: DestructivePrompt): void {
  // The browser's own dialog *is* the intended confirmation on this platform;
  // react-native-web's Alert is an empty function.
  // eslint-disable-next-line no-alert
  if (window.confirm(`${title}\n\n${body}`)) {
    onConfirm();
  }
}
