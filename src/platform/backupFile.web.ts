import type { BackupFile } from './backupFile';

/**
 * Web: a real file, because the browser has both halves built in — a download
 * on the way out and an `<input type="file">` on the way back. This is the one
 * place where the web target is ahead of Android rather than behind it.
 */
export const backupFile: BackupFile = {
  fileImport: true,
  exportBackup: async (text, fileName) => {
    const url = URL.createObjectURL(
      new Blob([text], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
  readPickedBackup: () =>
    new Promise<string | null>(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json,text/plain';
      // Cancelling a file dialog fires no event, so the promise simply never
      // settles — which is harmless: nothing waits on it but this screen.
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        file.text().then(resolve, () => resolve(null));
      };
      input.click();
    }),
};
