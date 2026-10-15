import { FlatList, StyleSheet } from 'react-native';
import { VerbRow } from './VerbRow';
import type { VerbListProps } from './VerbList';

/**
 * Web: a plain list, with no way to reorder.
 *
 * Ordering runs on reanimated, whose worklet transform has no place in the
 * Vite pipeline (see docs/spike-web.md), so offering the long-press drag here
 * would be offering something inert — the exact failure this twin removes.
 * The codex keeps working; ordering stays a native-only affordance.
 *
 * `onReorder` is not destructured on purpose: it exists so both platforms
 * share one props type at the call site, and the web never calls it.
 */
export function VerbList({ verbs, empty, onPressVerb }: VerbListProps) {
  return (
    <FlatList
      data={verbs}
      keyExtractor={verb => verb.id}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={verbs.length === 0 ? styles.emptyWrap : undefined}
      ListEmptyComponent={empty}
      renderItem={({ item }) => (
        <VerbRow verb={item} onPress={() => onPressVerb(item)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
