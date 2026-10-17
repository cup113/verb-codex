import { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { Counter, GroupTabs } from '../components/GroupTabs';
import { SearchField } from '../components/SearchField';
import { MoreButton, MoreMenu } from '../components/MoreMenu';
import { VerbList } from '../components/VerbList';
import { OutlinedButton } from '../components/OutlinedButton';
import { copy } from '../copy';
import { colors, fonts, serif } from '../theme';
import { verbStore, useVerbState } from '../storage/verbStore';
import { ownerStore, useOwnerState } from '../storage/ownerStore';
import { findVerbs, foldQuery, matchHint } from '../domain/search';
import { reorderByDrag } from '../platform/reorderByDrag';
import { useBlurFocusedInputOnKeyboardHide } from '../platform/blurOnKeyboardHide';
import { Group } from '../types';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VerbList'>;

const NAME_MAX = 30;

/**
 * Where the ⋯ menu's top edge lands, measured from the safe area: the Screen's
 * own 20pt inset, the height of the header row, and a 6pt gap under it. A
 * constant rather than a measured anchor because the row it hangs from is our
 * own fixed one — the menu is the only thing on this screen that floats.
 */
const MENU_TOP = 58;

export function VerbListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { verbs, ready } = useVerbState();
  const { owner, ready: ownerReady } = useOwnerState();
  // The field holds the raw draft while it has focus and only hands it over on
  // blur, so trimming on commit cannot eat the space between two typed words.
  const [draft, setDraft] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [group, setGroup] = useState<Group>(1);
  const [query, setQuery] = useState('');
  useBlurFocusedInputOnKeyboardHide();

  const commitName = () => {
    const typed = draft;
    setDraft(null);
    if (typed !== null) {
      ownerStore.setOwner(typed);
    }
  };

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

  // Both stores are read in the same frame, so the greeting waits for the name
  // as well: showing "votre nom" for one frame before a recorded name arrives
  // would read as the codex having forgotten it.
  if (!ready || !ownerReady) {
    return <Screen />;
  }

  // One entry today; the menu is here so the corner has somewhere to put the
  // next one without a second trip to the layout.
  const menuItems = [
    { label: copy.backupLink, onPress: () => navigation.navigate('Backup') },
  ];

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
        <Text style={styles.greeting}>{copy.greeting}</Text>
        {/* The owner line of a notebook: the name is written straight onto the
            rule, and the same line stays the field that edits it. */}
        <TextInput
          style={[styles.name, draft !== null && styles.nameFocused]}
          value={draft ?? owner}
          onFocus={() => setDraft(owner)}
          onChangeText={setDraft}
          onBlur={commitName}
          placeholder={copy.namePlaceholder}
          placeholderTextColor={colors.line}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          underlineColorAndroid="transparent"
        />
        {/* Right-hand corner: how much of the codex the list is showing, and
            everything else behind one dot-dot-dot. `alignSelf: 'center'` rather
            than the row's baseline, which has nothing to align a View to. */}
        <View style={styles.corner}>
          <Counter shown={shown.length} total={verbs.length} />
          <MoreButton
            expanded={menuOpen}
            onPress={() => setMenuOpen(open => !open)}
          />
          <MoreMenu
            visible={menuOpen}
            top={insets.top + MENU_TOP}
            onDismiss={() => setMenuOpen(false)}
            items={menuItems}
          />
        </View>
      </View>
      <GroupTabs active={group} onChange={setGroup} />
      <SearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
      />
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
          navigation.navigate('VerbDetail', { verbId: verb.id, group })
        }
        onReorder={(verbId, toIndex) => verbStore.reorderVerb(verbId, toIndex)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    // Every child here is text of its own, so the small ones keep sitting on
    // the greeting's baseline exactly as they sat on the title's.
    alignItems: 'baseline',
    marginBottom: 20,
  },
  greeting: {
    ...serif(26, {
      fontFamily: fonts.serifItalic,
      color: colors.inkSecondary,
      letterSpacing: -0.3,
    }),
    // One word space, not the 12pt the other gaps use: "Salut," and the name
    // are one phrase.
    marginRight: 6,
  },
  name: {
    // The name is the second half of one phrase, so it is set the way the
    // greeting is: the codex's own italic. `serifMedium` is the face a
    // *recorded* word wears, and the name is not one of those.
    ...serif(26, { fontFamily: fonts.serifItalicHan, letterSpacing: -0.3 }),
    // A first name wide, and no wider: the blank is somewhere to write a name,
    // not a spacer that eats the row. A longer name scrolls inside it while it
    // is being typed, which is what any narrow field does.
    width: 140,
    flexShrink: 1,
    // The floor that actually matters, and only on the web: an <input> there
    // carries the browser's default field width — twenty characters, ~290pt at
    // this size — as a minimum it will not shrink below, which pushed the
    // counter off the side of the screen. Native has no such floor.
    minWidth: 0,
    padding: 0,
    marginRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed',
    // Android gives a text field font padding the Text beside it does not have;
    // without this the dashed rule hangs below the greeting's baseline.
    includeFontPadding: false,
  },
  nameFocused: {
    borderBottomColor: colors.terracotta,
  },
  corner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // Everything here is right-aligned chrome rather than prose, so it neither
    // takes the baseline nor needs a spacer to reach the edge.
    marginLeft: 'auto',
    alignSelf: 'center',
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
