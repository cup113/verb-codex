import { useEffect } from 'react';
import { Keyboard, Platform, TextInput } from 'react-native';

/**
 * Take the cursor away with the keyboard.
 *
 * Android hides the IME on its own — the back gesture, a swipe down, another
 * app taking the foreground — and leaves the field focused: the keyboard is
 * gone, yet the caret keeps blinking and the field still looks like the one
 * being typed into. Only the app knows the two belong together, so whatever
 * holds the focus is blurred once the keyboard reports it has hidden. Blurring
 * on `keyboardDidHide` rather than on a timer also means the recorded text is
 * committed by the field's own `onBlur`, with no second path to keep in step.
 *
 * The web needs none of it: a browser moves the focus itself when a tap lands
 * outside the field, and it has no IME to dismiss.
 */
export function useBlurFocusedInputOnKeyboardHide(): void {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      TextInput.State.currentlyFocusedInput()?.blur();
    });
    return () => subscription.remove();
  }, []);
}
