import React from 'react';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';
import { OutlinedButton } from '../../src/components/OutlinedButton';
import { copy } from '../../src/copy';
import { seedVerbs } from '../../src/data/seed';
import { parseBackup, writeCodex } from '../../src/domain/backup';
import type { Verb } from '../../src/types';
import { BackupScreen } from '../../src/screens/BackupScreen';
import { backupFile } from '../../src/platform/backupFile';
import { confirmDestructive } from '../../src/platform/confirmDestructive';
import { requestPersistentStorage } from '../../src/platform/persistentStorage';
import { ownerStore } from '../../src/storage/ownerStore';
import { verbStore } from '../../src/storage/verbStore';

// The three things this screen does to the device, replaced. Everything else
// (the parse, the two stores, the ordering between them) is the real thing:
// what is under test is precisely how the file is allowed to reach the codex.
jest.mock('../../src/platform/backupFile', () => ({
  backupFile: {
    fileImport: true,
    exportBackup: jest.fn(async () => {}),
    readPickedBackup: jest.fn(async () => null),
  },
}));
jest.mock('../../src/platform/confirmDestructive', () => ({
  confirmDestructive: jest.fn(),
}));
jest.mock('../../src/platform/persistentStorage', () => ({
  requestPersistentStorage: jest.fn(async () => true),
}));

const confirm = jest.mocked(confirmDestructive);
const exportBackup = jest.mocked(backupFile.exportBackup);
const readPickedBackup = jest.mocked(backupFile.readPickedBackup);
const persistent = jest.mocked(requestPersistentStorage);

type ScreenProps = React.ComponentProps<typeof BackupScreen>;

// The first render of this file transforms a large module graph on a cold
// cache, which easily overruns Jest's five-second default.
jest.setTimeout(60_000);

const METRICS = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

const AT = '2026-10-15T12:34:56.789Z';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  mounted.forEach(tree => ReactTestRenderer.act(() => tree.unmount()));
  mounted.length = 0;
});

/** One entry that is not in the seeded codex, so a restore is unmistakable. */
function importedVerb(): Verb {
  return { ...seedVerbs()[0], id: 'imported-1', infinitive: 'finir' };
}

/** A document, as the user would paste it. */
function documentOf(options: { verbs: Verb[]; owner?: string }): string {
  return writeCodex({ verbs: options.verbs, owner: options.owner ?? '' }, AT)
    .text;
}

/**
 * The store is the app singleton, so the codex the screen reads is the real
 * one: each test starts from the seeded codex and an empty name, and leaves
 * both that way for the next.
 */
async function resetCodex(owner = ''): Promise<void> {
  await ReactTestRenderer.act(async () => {
    await verbStore.init();
    await verbStore.replaceAll(seedVerbs());
  });
  await ReactTestRenderer.act(async () => {
    ownerStore.setOwner(owner);
  });
}

async function renderBackup(): Promise<ReactTestRenderer.ReactTestRenderer> {
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
  } as unknown as ScreenProps['navigation'];
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <BackupScreen
          navigation={navigation}
          route={{ key: 'Backup-1', name: 'Backup' } as ScreenProps['route']}
        />
      </SafeAreaProvider>,
    );
  });
  const rendered = tree as ReactTestRenderer.ReactTestRenderer;
  mounted.push(rendered);
  return rendered;
}

/** A fresh codex, and the screen looking at it. */
async function open(owner = '') {
  await resetCodex(owner);
  return renderBackup();
}

function texts(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map(node => {
    const { children } = node.props;
    return Array.isArray(children) ? children.join('') : String(children ?? '');
  });
}

function labels(tree: ReactTestRenderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(OutlinedButton).map(node => node.props.label);
}

async function press(tree: ReactTestRenderer.ReactTestRenderer, label: string) {
  await ReactTestRenderer.act(async () => {
    tree.root.findByProps({ label }).props.onPress();
  });
}

async function paste(tree: ReactTestRenderer.ReactTestRenderer, text: string) {
  await ReactTestRenderer.act(async () => {
    tree.root.findByType(TextInput).props.onChangeText(text);
  });
}

function pasted(tree: ReactTestRenderer.ReactTestRenderer): string {
  return tree.root.findByType(TextInput).props.value;
}

/** The question the screen asked, or a failure naming what it asked instead. */
function prompt(): {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
} {
  expect(confirm).toHaveBeenCalledTimes(1);
  return confirm.mock.calls[0][0];
}

/** Answer « Remplacer » the way the platform dialog would. */
async function replace() {
  await ReactTestRenderer.act(async () => {
    prompt().onConfirm();
  });
  // `replaceAll` is a promise the screen only attaches to; let it settle so the
  // name and the status line that follow it are in the tree.
  await ReactTestRenderer.act(async () => {});
}

describe('BackupScreen: exporting', () => {
  it('hands the platform one document and the name it is filed under', async () => {
    const tree = await open('Camille');

    await press(tree, copy.exportButton);

    expect(exportBackup).toHaveBeenCalledTimes(1);
    const [text, fileName] = exportBackup.mock.calls[0];
    const read = parseBackup(text);
    expect(read.ok && read.verbs).toEqual(verbStore.getSnapshot().verbs);
    expect(read.ok && read.owner).toBe('Camille');
    // One instant decides both, so the day in the file's name is the day it
    // says it was written.
    const day = read.ok ? (read.exportedAt ?? '').slice(0, 10) : '';
    expect(fileName).toBe(`verbcodex-${day}.json`);
    expect(texts(tree)).toContain(copy.exportDone(seedVerbs().length));
  });

  it('warns that the export is the only copy when the platform says so', async () => {
    persistent.mockResolvedValueOnce(false);
    const tree = await open();

    expect(texts(tree)).toContain(copy.exportEvictable);
  });

  it('keeps quiet about eviction when the codex is safe where it stands', async () => {
    const tree = await open();

    expect(texts(tree)).not.toContain(copy.exportEvictable);
  });
});

describe('BackupScreen: importing', () => {
  it('offers nothing to press until something has been pasted', async () => {
    const tree = await open();

    expect(
      tree.root.findByProps({ label: copy.importButton }).props.disabled,
    ).toBe(true);

    await paste(tree, '  \n');

    expect(
      tree.root.findByProps({ label: copy.importButton }).props.disabled,
    ).toBe(true);

    await paste(tree, documentOf({ verbs: [importedVerb()] }));

    expect(
      tree.root.findByProps({ label: copy.importButton }).props.disabled,
    ).toBe(false);
  });

  it('refuses text it cannot read without ever asking to replace the codex', async () => {
    const tree = await open();
    const before = verbStore.getSnapshot().verbs;

    await paste(tree, 'j’ai oublié de copier le fichier');
    await press(tree, copy.importButton);

    // A paste that is not a backup is not a question about the codex: the
    // dialog never opens, and nothing is written.
    expect(confirm).not.toHaveBeenCalled();
    expect(texts(tree)).toContain(copy.importProblemJson);
    expect(verbStore.getSnapshot().verbs).toBe(before);
  });

  it('names the problem in the file rather than in the codex', async () => {
    const tree = await open();

    await paste(tree, '{"hello":"world"}');
    await press(tree, copy.importButton);

    expect(texts(tree)).toContain(copy.importProblemNotBackup);

    await paste(
      tree,
      JSON.stringify({ app: 'verbcodex', format: 99, verbs: [] }),
    );
    await press(tree, copy.importButton);

    expect(texts(tree)).toContain(copy.importProblemNewer);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before it replaces, and says how much it is replacing', async () => {
    const tree = await open();
    const before = verbStore.getSnapshot().verbs;

    await paste(tree, documentOf({ verbs: [importedVerb()] }));
    await press(tree, copy.importButton);

    // The question carries the codex's own count, not the file's.
    expect(prompt().title).toBe(copy.importConfirmTitle);
    expect(prompt().body).toBe(copy.importConfirmBody(before.length));
    // Asked, not answered: the codex is still the one that was here.
    expect(verbStore.getSnapshot().verbs).toBe(before);
  });

  it('does nothing at all when the question is never answered', async () => {
    const tree = await open();
    const before = verbStore.getSnapshot().verbs;

    await paste(tree, documentOf({ verbs: [importedVerb()] }));
    await press(tree, copy.importButton);

    // Cancelling is the absence of an answer, so the codex must be untouched
    // by the mere fact of having asked.
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(verbStore.getSnapshot().verbs).toBe(before);
    expect(pasted(tree)).toBe(documentOf({ verbs: [importedVerb()] }));
  });

  it("replaces the codex wholesale with the file's entries", async () => {
    const tree = await open();
    const before = verbStore.getSnapshot().verbs;

    await paste(tree, documentOf({ verbs: [importedVerb()] }));
    await press(tree, copy.importButton);
    await replace();

    const after = verbStore.getSnapshot().verbs;
    expect(after.map(verb => verb.id)).toEqual(['imported-1']);
    // Interleaving two records is the one outcome nobody can predict.
    expect(after.length).toBeLessThan(before.length);
    expect(texts(tree)).toContain(copy.importDone(1));
    // The document is no longer in the box: it has been dealt with.
    expect(pasted(tree)).toBe('');
  });

  it('adopts the name the file carries', async () => {
    const tree = await open('Camille');

    await paste(tree, documentOf({ verbs: [importedVerb()], owner: 'Alex' }));
    await press(tree, copy.importButton);
    await replace();

    expect(ownerStore.getSnapshot().owner).toBe('Alex');
  });

  it('leaves the name this device knows when the file carries none', async () => {
    const tree = await open('Camille');

    await paste(tree, documentOf({ verbs: [importedVerb()] }));
    await press(tree, copy.importButton);
    await replace();

    expect(ownerStore.getSnapshot().owner).toBe('Camille');
  });

  it('imports straight from a picked file', async () => {
    const document = documentOf({ verbs: [importedVerb()], owner: 'Alex' });
    readPickedBackup.mockResolvedValueOnce(document);
    const tree = await open();

    expect(labels(tree)).toContain(copy.importFromFile);
    await press(tree, copy.importFromFile);

    // The picked text lands in the box and goes through the same question.
    expect(pasted(tree)).toBe(document);
    expect(prompt().body).toBe(copy.importConfirmBody(seedVerbs().length));

    await replace();

    expect(verbStore.getSnapshot().verbs.map(verb => verb.id)).toEqual([
      'imported-1',
    ]);
    expect(ownerStore.getSnapshot().owner).toBe('Alex');
  });
});
