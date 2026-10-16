import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { copy } from '../copy';
import { cardSurface, colors, serif } from '../theme';

export type MenuItem = {
  label: string;
  onPress: () => void;
};

type ButtonProps = {
  expanded: boolean;
  onPress: () => void;
};

/**
 * The header's "more" trigger: three dots, drawn rather than typed — a ⋯ glyph
 * is one font's opinion, and the two faces here are Latin and hanzi.
 */
export function MoreButton({ expanded, onPress }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={copy.more}
      // `aria-expanded` rather than `accessibilityState={{ expanded }}`: the
      // React Native prop is the platform-neutral spelling and both sides read
      // it, while react-native-web drops the state object and would leave the
      // button announcing nothing about the menu it controls.
      aria-expanded={expanded}
      style={styles.trigger}
    >
      <View style={styles.dot} />
      <View style={styles.dot} />
      <View style={styles.dot} />
    </Pressable>
  );
}

type MenuProps = {
  visible: boolean;
  /** Distance from the top of the window to the menu's own top edge. */
  top: number;
  onDismiss: () => void;
  items: readonly MenuItem[];
};

/**
 * The menu a `MoreButton` opens.
 *
 * A transparent `Modal` rather than a card absolutely positioned inside the
 * header: such a card has to win a z-order fight with the list underneath it,
 * and on Android that fight is settled by `elevation` across parent
 * boundaries — not something to guess at from a desk with no device attached.
 * A modal sits above everything on both platforms, and it gives the Android
 * back button something to close (`onRequestClose`) instead of leaving the
 * screen behind an open menu.
 *
 * Choosing an item always dismisses first: a menu that stays open over the
 * screen it just navigated away from is a menu the user has to close twice.
 */
export function MoreMenu({ visible, top, onDismiss, items }: MenuProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.layer}>
        {/* Invisible, full-screen, and the only way out that is not a choice:
            a tap anywhere else means "never mind". */}
        <Pressable
          style={styles.backdrop}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={copy.menuDismiss}
        />
        <View style={[styles.card, { top }]}>
          {items.map(item => (
            <Pressable
              key={item.label}
              onPress={() => {
                onDismiss();
                item.onPress();
              }}
              style={styles.item}
            >
              <Text style={styles.label}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    gap: 3,
  },
  dot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: colors.inkSecondary,
    opacity: 0.75,
  },
  layer: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    ...cardSurface,
    position: 'absolute',
    // The same gutter the screen keeps, so the menu lines up under the dots.
    right: 24,
    minWidth: 152,
    paddingVertical: 4,
  },
  item: {
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  label: {
    ...serif(15),
  },
});
