import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Counter, GroupTabs } from '../components/GroupTabs';
import { VerbList } from '../components/VerbList';
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
        <View
          style={[
            styles.actions,
            // With the hint gone the button is the only child, and
            // `space-between` would strand it on the left.
            Platform.OS === 'web' && styles.actionsWeb,
          ]}
        >
          {/* The web list is not reorderable, so it claims nothing. */}
          {Platform.OS === 'web' ? null : (
            <Text style={styles.tip}>{copy.longPressHint}</Text>
          )}
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
      <VerbList
        verbs={shown}
        empty={
          <Text style={styles.empty}>
            {verbs.length === 0 ? copy.emptyCodex : copy.emptyGroup}
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
  actionsWeb: {
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
