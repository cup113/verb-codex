import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { OutlinedButton } from '../components/OutlinedButton';
import { copy } from '../copy';
import { cardSurface, colors, fonts, serif } from '../theme';
import { verbStore } from '../storage/verbStore';
import { useBlurFocusedInputOnKeyboardHide } from '../platform/blurOnKeyboardHide';
import { Group, GROUPS, GROUP_LABELS } from '../types';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'AddVerb'>;

export function AddVerbScreen({ navigation, route }: Props) {
  const [infinitive, setInfinitive] = useState('');
  // Recording starts in the group the list was showing, so the common case
  // needs no second tap; the choice stays editable below.
  const [group, setGroup] = useState<Group>(route.params.group);
  const canCreate = infinitive.trim() !== '';
  useBlurFocusedInputOnKeyboardHide();

  // Recording lands straight on the entry, with its six rows still blank.
  const create = () => {
    if (!canCreate) {
      return;
    }
    verbStore.addVerb({ infinitive, group }).then(verb => {
      // The way back names the group the list is standing in, which is the one
      // this screen was opened from — not necessarily the one just chosen.
      navigation.replace('VerbDetail', {
        verbId: verb.id,
        group: route.params.group,
      });
    });
  };

  return (
    // The screen is edge-to-edge, so the window is not resized for the IME and
    // the action bar would sit behind the keyboard without this.
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        footer={
          <View style={styles.actions}>
            <OutlinedButton
              label={copy.cancel}
              onPress={() => navigation.goBack()}
            />
            <OutlinedButton
              label={copy.create}
              tone="terracotta"
              disabled={!canCreate}
              onPress={create}
            />
          </View>
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.form}
        >
          <Text style={styles.title}>{copy.addTitle}</Text>
          <Text style={styles.label}>{copy.infinitiveLabel}</Text>
          <TextInput
            style={styles.input}
            value={infinitive}
            onChangeText={setInfinitive}
            placeholder={copy.infinitivePlaceholder}
            placeholderTextColor={colors.line}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={create}
            underlineColorAndroid="transparent"
          />
          <Text style={styles.label}>{copy.groupLabel}</Text>
          <View style={styles.groups}>
            {GROUPS.map(value => (
              <GroupChoice
                key={value}
                group={value}
                selected={value === group}
                onPress={() => setGroup(value)}
              />
            ))}
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function GroupChoice({
  group,
  selected,
  onPress,
}: {
  group: Group;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text
        style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}
      >
        {GROUP_LABELS[group]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  form: {
    paddingBottom: 8,
  },
  title: {
    ...serif(26, { fontFamily: fonts.serifMedium, letterSpacing: -0.5 }),
    marginBottom: 24,
  },
  label: {
    ...serif(12, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
    marginBottom: 6,
  },
  input: {
    ...serif(22),
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 24,
  },
  groups: {
    ...cardSurface,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  choice: {
    paddingVertical: 14,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    paddingLeft: 12,
  },
  choiceSelected: {
    borderLeftColor: colors.terracotta,
  },
  choiceLabel: {
    ...serif(17, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
  choiceLabelSelected: {
    ...serif(17, { fontFamily: fonts.serifMedium, color: colors.ink }),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
