import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { VerbRow } from './VerbRow';
import type { Verb } from '../types';

export type VerbListProps = {
  verbs: Verb[];
  empty: ReactElement;
  onPressVerb: (verb: Verb) => void;
  /** Ordering is the native affordance; the web twin accepts and ignores it. */
  onReorder: (verbId: string, toIndex: number) => void;
};

/** Android and iOS: long press a row to move it. */
export function VerbList({
  verbs,
  empty,
  onPressVerb,
  onReorder,
}: VerbListProps) {
  return (
    <DraggableFlatList
      data={verbs}
      keyExtractor={verb => verb.id}
      // `to` indexes the reordered array, so that entry is the dragged one;
      // the store does the moving and writes it out immediately.
      onDragEnd={({ data, to }) => onReorder(data[to].id, to)}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={verbs.length === 0 ? styles.emptyWrap : undefined}
      ListEmptyComponent={empty}
      renderItem={({ item, drag, isActive }) => (
        <ScaleDecorator>
          <VerbRow
            verb={item}
            dragging={isActive}
            onPress={() => onPressVerb(item)}
            onLongPress={drag}
          />
        </ScaleDecorator>
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
