import { Share } from 'react-native';

export type BackupFile = {
  /** True when this platform can hand back a document the user picked. */
  fileImport: boolean;
  exportBackup(text: string, fileName: string): Promise<void>;
  /** The picked document's text, or null when there is no picker here. */
  readPickedBackup(): Promise<string | null>;
};

/**
 * Android and iOS: the share sheet, with no new native dependency.
 *
 * A backup is a few kilobytes of text, so Drive, Keep, a mail to yourself or
 * any file manager can take it. Importing is therefore a paste (see the
 * screen): a document picker would mean another native module and another
 * 4-ABI compile, which this feature does not justify.
 */
export const backupFile: BackupFile = {
  fileImport: false,
  exportBackup: async (text, fileName) => {
    await Share.share({ message: text, title: fileName });
  },
  readPickedBackup: async () => null,
};
