import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, serif } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'ink' | 'terracotta';
};

/** Outlined paper button; it inverts while held, as the demo's does. */
export function OutlinedButton({
  label,
  onPress,
  disabled = false,
  tone = 'ink',
}: Props) {
  const accent = tone === 'terracotta' ? colors.terracotta : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { borderColor: accent },
        pressed && !disabled && { backgroundColor: accent },
        disabled && styles.disabled,
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.label,
            { color: accent },
            pressed && !disabled && { color: colors.paper },
            disabled && styles.disabledLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  label: {
    ...serif(14),
  },
  disabled: {
    borderColor: colors.line,
    opacity: 0.5,
  },
  disabledLabel: {
    color: colors.inkSecondary,
  },
});
