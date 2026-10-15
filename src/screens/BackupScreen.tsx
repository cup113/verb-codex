import { useEffect, useState } from 'react';
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
import {
  backupFileName,
  parseBackup,
  serializeBackup,
  type BackupProblem,
} from '../domain/backup';
import { backupFile } from '../platform/backupFile';
import { confirmDestructive } from '../platform/confirmDestructive';
import { requestPersistentStorage } from '../platform/persistentStorage';
import { copy } from '../copy';
import { cardSurface, colors, fonts, mono, serif } from '../theme';
import { verbStore, useVerbState } from '../storage/verbStore';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Backup'>;

const problemText: Record<BackupProblem, string> = {
  empty: copy.importProblemEmpty,
  'not-json': copy.importProblemJson,
  'not-backup': copy.importProblemNotBackup,
  'newer-format': copy.importProblemNewer,
  'no-verbs': copy.importProblemNoVerbs,
};

export function BackupScreen({ navigation }: Props) {
  const { verbs } = useVerbState();
  const [pasted, setPasted] = useState('');
  const [status, setStatus] = useState<{ good: boolean; text: string } | null>(
    null,
  );
  // Android's storage is not evictable, so this is true there and the warning
  // below never appears; on the web it says whether the export is the only copy.
  const [persisted, setPersisted] = useState(true);

  useEffect(() => {
    let live = true;
    requestPersistentStorage().then(value => {
      if (live) {
        setPersisted(value);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const exportCodex = async () => {
    const exportedAt = new Date().toISOString();
    await backupFile.exportBackup(
      serializeBackup(verbs, exportedAt),
      backupFileName(exportedAt),
    );
    setStatus({ good: true, text: copy.exportDone(verbs.length) });
  };

  // Replace, never merge: the codex is a record its owner keeps, and quietly
  // interleaving two records is the one outcome nobody can predict.
  const importCodex = (text: string) => {
    const read = parseBackup(text);
    if (!read.ok) {
      setStatus({ good: false, text: problemText[read.problem] });
      return;
    }
    confirmDestructive({
      title: copy.importConfirmTitle,
      body: copy.importConfirmBody(verbs.length),
      confirmLabel: copy.importConfirm,
      cancelLabel: copy.cancel,
      onConfirm: () => {
        verbStore.replaceAll(read.verbs).then(() => {
          setPasted('');
          setStatus({ good: true, text: copy.importDone(read.verbs.length) });
        });
      },
    });
  };

  const pickFile = () => {
    backupFile.readPickedBackup().then(text => {
      if (text === null) {
        return;
      }
      setPasted(text);
      importCodex(text);
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backRow}
        >
          <Text style={styles.back}>{copy.back}</Text>
        </Pressable>
        <Text style={styles.title}>{copy.backupTitle}</Text>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.card}>
            <Text style={styles.label}>{copy.exportLabel}</Text>
            <Text style={styles.hint}>{copy.exportHint}</Text>
            {persisted ? null : (
              <Text style={styles.problem}>{copy.exportEvictable}</Text>
            )}
            <View style={styles.action}>
              <OutlinedButton
                label={copy.exportButton}
                tone="terracotta"
                onPress={exportCodex}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{copy.importLabel}</Text>
            <Text style={styles.hint}>{copy.importHint}</Text>
            <TextInput
              style={styles.input}
              value={pasted}
              onChangeText={setPasted}
              placeholder={copy.importPlaceholder}
              placeholderTextColor={colors.line}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              underlineColorAndroid="transparent"
            />
            <View style={styles.actions}>
              {backupFile.fileImport ? (
                <OutlinedButton
                  label={copy.importFromFile}
                  onPress={pickFile}
                />
              ) : null}
              <OutlinedButton
                label={copy.importButton}
                tone="terracotta"
                disabled={pasted.trim() === ''}
                onPress={() => importCodex(pasted)}
              />
            </View>
          </View>

          {status ? (
            <Text style={status.good ? styles.good : styles.problem}>
              {status.text}
            </Text>
          ) : null}
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
  },
  back: {
    ...serif(15, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
  },
  title: {
    ...serif(26, { fontFamily: fonts.serifMedium, letterSpacing: -0.5 }),
    marginTop: 6,
    marginBottom: 20,
  },
  scroll: {
    paddingBottom: 16,
  },
  card: {
    ...cardSurface,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 12,
  },
  label: {
    ...mono(10, { letterSpacing: 1.2, textTransform: 'uppercase' }),
    marginBottom: 8,
  },
  hint: {
    ...serif(14, { lineHeight: 20, color: colors.inkSecondary }),
    marginBottom: 14,
  },
  // The pasted document, in the grid's own monospace: this is data, not prose.
  input: {
    ...mono(12, { lineHeight: 18 }),
    minHeight: 96,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 4,
    marginBottom: 14,
  },
  action: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  good: {
    ...serif(13, { fontFamily: fonts.serifItalic, color: colors.inkSecondary }),
    paddingHorizontal: 4,
  },
  problem: {
    ...serif(13, { fontFamily: fonts.serifItalic, color: colors.terracotta }),
    paddingHorizontal: 4,
  },
});
