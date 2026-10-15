import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DraggableFlatList, {
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { Screen } from '../components/Screen';
import { Counter, GroupTabs } from '../components/GroupTabs';
import { VerbRow } from '../components/VerbRow';
import { OutlinedButton } from '../components/OutlinedButton';
import { copy } from '../copy';
import { colors, fonts, serif } from '../theme';
import { verbStore, useVerbState } from '../storage/verbStore';
import { Group } from '../types';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VerbList'>;

export function VerbListScreen({ navigation }: Props) {
  const { verbs, ready } = useVerbState();
  const [group, setGroup] = useState<Group>(1);
  const shown = verbs.filter(verb => verb.group === group);

  if (!ready) {
    return <Screen />;
  }

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Text style={styles.tip}>{copy.longPressHint}</Text>
          <OutlinedButton
            label={copy.newVerb}
            onPress={() => navigation.navigate('AddVerb')}
          />
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>{copy.title}</Text>
        <Counter shown={shown.length} total={verbs.length} />
      </View>
      <GroupTabs active={group} onChange={setGroup} />
      <DraggableFlatList
        data={shown}
        keyExtractor={verb => verb.id}
        // `to` indexes the reordered array, so that entry is the dragged one;
        // the store does the moving and writes it out immediately.
        onDragEnd={({ data, to }) => verbStore.reorderVerb(data[to].id, to)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          shown.length === 0 ? styles.emptyWrap : undefined
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {verbs.length === 0 ? copy.emptyCodex : copy.emptyGroup}
          </Text>
        }
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator>
            <VerbRow
              verb={item}
              dragging={isActive}
              onPress={() =>
                navigation.navigate('VerbDetail', { verbId: item.id })
              }
              onLongPress={drag}
            />
          </ScaleDecorator>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    ...serif(26, { fontFamily: fonts.serifMedium, letterSpacing: -0.5 }),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tip: {
    ...serif(12, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
    flexShrink: 1,
    paddingRight: 12,
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    ...serif(15, {
      color: colors.inkSecondary,
      fontFamily: fonts.serifItalic,
      textAlign: 'center',
    }),
  },
});
