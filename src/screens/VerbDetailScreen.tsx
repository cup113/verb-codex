import { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
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
import { ConjugationRowView } from '../components/ConjugationRowView';
import { OutlinedButton } from '../components/OutlinedButton';
import { copy } from '../copy';
import { cardSurface, colors, fonts, mono, serif } from '../theme';
import { verbStore, useVerbState } from '../storage/verbStore';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VerbDetail'>;

export function VerbDetailScreen({ route, navigation }: Props) {
  const { verbs } = useVerbState();
  const verb = verbs.find(item => item.id === route.params.verbId);
  const [testing, setTesting] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(
    () => new Set<number>(),
  );

  const exitTest = useCallback(() => {
    setTesting(false);
    setRevealed(new Set<number>());
  }, []);

  // Android back leaves self-test before it leaves the entry.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!testing) {
          return false;
        }
        exitTest();
        return true;
      },
    );
    return () => subscription.remove();
  }, [testing, exitTest]);

  const back = (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={10}
      style={styles.backRow}
    >
      <Text style={styles.back}>{copy.back}</Text>
    </Pressable>
  );

  if (!verb) {
    return <Screen>{back}</Screen>;
  }

  const reveal = (index: number) => {
    setRevealed(previous => {
      const next = new Set(previous);
      next.add(index);
      return next;
    });
  };

  return (
    // Edge-to-edge: without this the body keeps full height behind the IME,
    // the card fits inside it, and the last rows cannot be scrolled into view.
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        footer={
          <View style={styles.actions}>
            <Text style={styles.tip}>
              {testing ? copy.tipLocked : copy.tip}
            </Text>
            <OutlinedButton
              label={testing ? copy.revealAll : copy.selfTest}
              tone={testing ? 'ink' : 'terracotta'}
              onPress={
                testing
                  ? exitTest
                  : () => {
                      setRevealed(new Set<number>());
                      setTesting(true);
                    }
              }
            />
          </View>
        }
      >
        {back}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              {testing ? (
                <Text style={styles.infinitiveText} numberOfLines={1}>
                  {verb.infinitive}
                </Text>
              ) : (
                <TextInput
                  style={styles.infinitiveInput}
                  value={verb.infinitive}
                  onChangeText={text => verbStore.setInfinitive(verb.id, text)}
                  maxLength={40}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  underlineColorAndroid="transparent"
                />
              )}
              <Text style={styles.tense}>{copy.tense}</Text>
            </View>
            <View style={styles.grid}>
              {verb.rows.map((row, index) => (
                <ConjugationRowView
                  key={index}
                  rowIndex={index}
                  row={row}
                  editing={!testing}
                  revealed={revealed.has(index)}
                  onReveal={() => reveal(index)}
                  onChangeStem={text =>
                    verbStore.setRow(verb.id, index, { stem: text })
                  }
                  onChangeEnding={text =>
                    verbStore.setRow(verb.id, index, { ending: text })
                  }
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  backRow: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginBottom: 12,
  },
  back: {
    ...serif(15, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
  scroll: {
    paddingBottom: 16,
  },
  card: {
    ...cardSurface,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    borderStyle: 'dashed',
    paddingBottom: 12,
    marginBottom: 18,
    gap: 12,
  },
  infinitiveText: {
    ...serif(24, { letterSpacing: 0.5 }),
    flexShrink: 1,
  },
  infinitiveInput: {
    ...serif(24, { letterSpacing: 0.5 }),
    flex: 1,
    padding: 0,
    margin: 0,
  },
  tense: {
    ...mono(11, { letterSpacing: 1, textTransform: 'uppercase' }),
  },
  grid: {
    gap: 12,
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
});
