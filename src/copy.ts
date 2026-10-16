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
  deleteTitle: (infinitive: string) => `Supprimer « ${infinitive} » ?`,
  deleteBody: 'Cette entrée et ses six lignes seront effacées.',
  longPressHint: 'Appui long pour réordonner',
  dragHint: 'Maintenir et glisser pour réordonner',
  // Said out loud for the completion mark, which is drawn rather than written:
  // the row's own text no longer carries how much is on paper.
  rowsRecorded: (filled: number, total: number) =>
    `${filled} ligne${filled > 1 ? 's' : ''} sur ${total}`,
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
} as const;
