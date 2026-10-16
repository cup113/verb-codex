import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Counter, GroupTabs } from '../components/GroupTabs';
import { SearchField } from '../components/SearchField';
import { VerbList } from '../components/VerbList';
import { OutlinedButton } from '../components/OutlinedButton';
import { copy } from '../copy';
import { colors, fonts, serif } from '../theme';
import { verbStore, useVerbState } from '../storage/verbStore';
import { findVerbs, foldQuery, matchHint } from '../domain/search';
import { reorderByDrag } from '../platform/reorderByDrag';
import { Group } from '../types';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VerbList'>;

export function VerbListScreen({ navigation }: Props) {
  const { verbs, ready } = useVerbState();
  const [group, setGroup] = useState<Group>(1);
  const [query, setQuery] = useState('');
  // What the field holds is not what it filters by: a field holding nothing but
  // spaces must not empty the list.
  const folded = foldQuery(query);
  const searching = folded !== '';
  const shown = findVerbs(
    verbs.filter(verb => verb.group === group),
    query,
  );

  /*
   * Ordering exists on both platforms, each with its own idiom: a long press
   * on a phone, a mouse drag in a browser. A touch browser can do neither, so
   * it is told nothing — the hint is a promise, and there would be nothing
   * behind it.
   *
   * Nor while the list is a filtered subset: the drop's index is a slot among
   * the group's entries and its pitch is one row of the group, and a subset's
   * rows are neither.
   */
  const reorderHint = searching
    ? null
    : Platform.OS !== 'web'
      ? copy.longPressHint
      : reorderByDrag
        ? copy.dragHint
        : null;

  if (!ready) {
    return <Screen />;
  }

  return (
    <Screen
      footer={
        <View
          style={[
            styles.actions,
            // With no hint the button is the only child, and `space-between`
            // would strand it on the left.
            reorderHint === null && styles.actionsNoHint,
          ]}
        >
          {reorderHint === null ? null : (
            <Text style={styles.tip}>{reorderHint}</Text>
          )}
          <OutlinedButton
            label={copy.newVerb}
            onPress={() => navigation.navigate('AddVerb', { group })}
          />
        </View>
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>{copy.title}</Text>
        <Pressable
          onPress={() => navigation.navigate('Backup')}
          hitSlop={10}
          style={styles.backupRow}
        >
          <Text style={styles.backupLink}>{copy.backupLink}</Text>
        </Pressable>
        <Counter shown={shown.length} total={verbs.length} />
      </View>
      <SearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
      />
      <GroupTabs active={group} onChange={setGroup} />
      <VerbList
        verbs={shown}
        hintOf={verb => matchHint(verb, folded)}
        reorderEnabled={!searching}
        empty={
          <Text style={styles.empty}>
            {verbs.length === 0
              ? copy.emptyCodex
              : searching
                ? copy.emptySearch
                : copy.emptyGroup}
          </Text>
        }
        onPressVerb={verb =>
          navigation.navigate('VerbDetail', { verbId: verb.id })
        }
        onReorder={(verbId, toIndex) => verbStore.reorderVerb(verbId, toIndex)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    // Title takes the slack, so the backup link sits with the counter as one
    // cluster rather than floating in the middle of the header.
    gap: 12,
    marginBottom: 20,
  },
  title: {
    ...serif(26, { fontFamily: fonts.serifMedium, letterSpacing: -0.5 }),
    flex: 1,
  },
  backupRow: {
    paddingVertical: 4,
  },
  backupLink: {
    ...serif(13, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsNoHint: {
    justifyContent: 'flex-end',
  },
  tip: {
    ...serif(12, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
    flexShrink: 1,
    paddingRight: 12,
  },
  empty: {
    ...serif(15, {
      color: colors.inkSecondary,
      fontFamily: fonts.serifItalic,
      textAlign: 'center',
    }),
  },
});
