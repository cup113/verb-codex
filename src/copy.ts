/** UI chrome, kept in French to match the notebook's own voice. */
export const copy = {
  greeting: 'Salut,',
  namePlaceholder: 'votre nom',
  tense: 'Présent',
  searchPlaceholder: 'Chercher un mot',
  tip: 'Touchez pour modifier',
  tipLocked: 'Touchez une ligne pour révéler',
  newVerb: '+ Nouveau',
  /** The header's dots: opens the menu that holds Sauvegarde. */
  more: 'Plus',
  menuDismiss: 'Fermer le menu',
  selfTest: "S'entraîner",
  revealAll: 'Tout révéler',
  /** Dictation: the six words are written from memory, then checked. */
  dictate: 'Écrire',
  quit: 'Quitter',
  verify: 'Vérifier',
  again: 'Encore',
  proceed: 'Continuer',
  tipWrite: 'Écrivez les six formes',
  tipCorrect: 'Corrigez les lignes barrées',
  // A teacher marks faults, not successes: the flawless paper gets the stamp
  // the exercise is named after, a corrected one the smaller remark. The
  // ornament is its own string because it is set in the symbol face while the
  // words stay in the codex's italic (see VerdictStamp).
  stampOrnament: '✦',
  stampFlawless: 'Sans faute',
  stampCorrected: 'Bien corrigé',
  // The way back names where it goes: a group on the entry screen, and the
  // plain word on the two screens that do not stand in a group at all.
  backTo: (label: string) => `‹ ${label}`,
  backFallback: 'Retour',
  emptyGroup: 'Aucun verbe dans ce groupe',
  emptySearch: 'Rien ne correspond dans ce groupe',
  emptyCodex: 'Votre codex est vide — touchez « + Nouveau »',
  addTitle: 'Nouveau verbe',
  infinitiveLabel: 'Infinitif',
  infinitivePlaceholder: 'ex. aimer',
  groupLabel: 'Groupe',
  create: 'Créer',
  cancel: 'Annuler',
  delete: 'Supprimer',
  /**
   * The second half of the two-tap delete: the corner asks again in place
   * rather than opening a dialog over the entry being read.
   */
  deleteSure: 'Vraiment ?',
  deleteArmedHint: 'Touchez encore pour supprimer',
  move: 'Déplacer',
  longPressHint: 'Appui long pour réordonner',
  dragHint: 'Maintenir et glisser pour réordonner',
  // Said out loud for the completion mark, which is drawn rather than written:
  // the row's own text no longer carries how much is on paper.
  rowsRecorded: (filled: number, total: number) =>
    `${filled} ligne${filled > 1 ? 's' : ''} sur ${total}`,
  // The star is read out, never printed: the mark itself says it on the list.
  // Named by the act, because the row already says whether it is complete —
  // a long press here is the only way to write or unwrite it.
  star: 'Marquer d’une étoile',
  unstar: 'Retirer l’étoile',
  starHint: 'Appui long de deux secondes',
  masked: '…',
  noteLabel: 'Notes',
  notePlaceholder: 'Prononciation, usage, remarques…',
  backupLink: 'Sauvegarde',
  backupTitle: 'Sauvegarde',
  exportLabel: 'Exporter',
  exportHint:
    'Tout le codex dans un fichier JSON, à garder hors de l’appareil.',
  exportEvictable:
    'Ce navigateur peut effacer ces données sans prévenir : gardez un export.',
  exportButton: 'Exporter',
  exportDone: (count: number) => `${count} entrées exportées.`,
  importLabel: 'Importer',
  importHint: 'Collez une sauvegarde, ou choisissez-en le fichier.',
  importFromFile: 'Choisir un fichier',
  importPlaceholder: '{ "app": "verbcodex", … }',
  importButton: 'Importer',
  importConfirmTitle: 'Remplacer le codex ?',
  importConfirmBody: (count: number) =>
    `Le contenu actuel (${count} entrées) sera remplacé par la sauvegarde.`,
  importConfirm: 'Remplacer',
  importDone: (count: number) => `${count} entrées importées.`,
  importProblemEmpty: 'Collez d’abord une sauvegarde.',
  importProblemJson: 'Ce texte n’est pas du JSON.',
  importProblemNotBackup:
    'Ce fichier ne ressemble pas à une sauvegarde du codex.',
  importProblemNewer:
    'Cette sauvegarde vient d’une version plus récente de l’application.',
  importProblemNoVerbs: 'Aucun verbe lisible dans cette sauvegarde.',
  // The gender drill (Le Genre). Its chrome is French like the rest of the
  // notebook, and it keeps the prototype's wording — the drill is a rehearsal
  // of one article, not a lesson with a syllabus.
  genreLink: 'Le Genre',
  genreTitle: 'Le Genre',
  genreLede: 'le / la — vingt noms par séance',
  genreStart: 'Commencer',
  genreReview: (due: number) => `La Révision (${due})`,
  genreReviewEmpty: 'La Révision — rien à réviser',
  genreLeitner: 'Leitner : erreur → boîte 1, puis 1 / 3 / 7 jours.',
  genreCredit: 'Noms : Lexique 4.1 — CC BY-SA 4.0',
  genrePrompt: 'Touchez le ou la.',
  genreNext: 'Suivant',
  genreFinish: 'Terminer',
  /** The card's own tag in a review, and the box the question came from. */
  genreKind: 'Révision',
  genreBoxTag: (box: number) => `Boîte ${box}`,
  genreSessionTitle: 'Séance',
  genreAgain: 'Encore',
  // A practice answer's one-line outcome: a wrong word has just joined the
  // ledger; in a review, a right one has moved a box or graduated.
  genreToReview: 'entré en révision',
  genreGraduated: 'Gradué ✓',
  genreBoxDue: (box: number, due: string) => `Boîte ${box} — ${due}`,
  genreDueNow: 'maintenant',
  genreDueIn: (days: number) =>
    days === 1 ? 'dans 1 jour' : `dans ${days} jours`,
  genreScore: (right: number, total: number) => `${right} / ${total}`,
  genreReviewed: (count: number) =>
    count === 1 ? '1 mot revu' : `${count} mots revus`,
  genreAdvanced: (count: number) => `${count} avancé${count > 1 ? 's' : ''}`,
  genreGraduatedCount: (count: number) =>
    `${count} gradué${count > 1 ? 's' : ''}`,
  // « renvoyé » rather than « reculé »: the wrong answer goes all the way back
  // to the first box, not one step down.
  genreSentBack: (count: number) =>
    `${count} renvoyé${count > 1 ? 's' : ''} en Boîte 1`,
  genreReviewAgain: (due: number) => `Réviser encore (${due})`,
  genreReviewNothing: 'Rien à réviser',
  genreEmpty: 'Rien à réviser',
  // Clearing the ledger costs no recorded value, but it is still a two-touch
  // question, on the same terms as deleting an entry.
  genreReset: (count: number) => `Vider la Boîte (${count})`,
  genreResetSure: 'Vraiment ?',
  genreResetHint: 'Touchez encore pour vider',
} as const;
