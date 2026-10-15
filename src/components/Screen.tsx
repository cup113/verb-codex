import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = {
  children?: ReactNode;
  footer?: ReactNode;
  style?: ViewStyle;
};

/** Paper sheet every screen sits on, inset clear of the system bars. */
export function Screen({ children, footer, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 20 }, style]}>
      <View style={styles.body}>{children}</View>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: 24,
  },
  body: {
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    // Opaque: with the keyboard up the body is squeezed and its content would
    // otherwise show through the action bar.
    backgroundColor: colors.paper,
    paddingTop: 14,
  },
});
