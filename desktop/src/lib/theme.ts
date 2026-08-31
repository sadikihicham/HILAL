// Jetons visuels du HUD « SYS//MONITOR » (design Mac Health Dashboard).
// Deux axes indépendants :
//   - `Mode`   : sombre / clair — pilote les fonds de verre, le texte, les traits.
//   - `Accent` : bleu / vert / rouge — la couleur d'accent du HUD (sélecteur « Thème »
//                de la barre de titre). Décliné par mode : les néons du design sont
//                illisibles sur verre clair, on les assombrit en mode `light`.
// Copie autonome (le desktop n'importe rien hors de desktop/ — isolation build CI).
export type Mode = 'dark' | 'light';
export type Accent = 'blue' | 'green' | 'red';

export const ACCENT_LIST: { id: Accent; key: string }[] = [
  { id: 'blue', key: 'accentBlue' },
  { id: 'green', key: 'accentGreen' },
  { id: 'red', key: 'accentRed' },
];

export type AccentTokens = {
  /** Couleur pleine (traits, valeurs, remplissages de jauge). */
  acc: string;
  /** Même teinte à ~50% — halos, bordures internes, drop-shadow SVG. */
  accSoft: string;
  /** Même teinte à ~18% — voiles de fond, dégradés de panneaux. */
  accGlow: string;
  /** Texte posé SUR un aplat d'accent (bouton primaire). */
  onAcc: string;
};

const ACCENTS_DARK: Record<Accent, AccentTokens> = {
  blue: { acc: '#22D3EE', accSoft: 'rgba(34,211,238,.5)', accGlow: 'rgba(34,211,238,.18)', onAcc: '#04070C' },
  green: { acc: '#4ADE80', accSoft: 'rgba(74,222,128,.5)', accGlow: 'rgba(74,222,128,.18)', onAcc: '#04070C' },
  red: { acc: '#FB7185', accSoft: 'rgba(251,113,133,.5)', accGlow: 'rgba(251,113,133,.18)', onAcc: '#04070C' },
};

const ACCENTS_LIGHT: Record<Accent, AccentTokens> = {
  blue: { acc: '#0E7490', accSoft: 'rgba(14,116,144,.45)', accGlow: 'rgba(14,116,144,.14)', onAcc: '#F8FAFC' },
  green: { acc: '#15803D', accSoft: 'rgba(21,128,61,.45)', accGlow: 'rgba(21,128,61,.14)', onAcc: '#F8FAFC' },
  red: { acc: '#BE123C', accSoft: 'rgba(190,18,60,.45)', accGlow: 'rgba(190,18,60,.14)', onAcc: '#F8FAFC' },
};

/** Pastille du sélecteur : toujours la version néon, pour rester reconnaissable. */
export const ACCENT_SWATCH: Record<Accent, string> = {
  blue: '#22D3EE', green: '#4ADE80', red: '#FB7185',
};

export const getAccent = (m: Mode, a: Accent): AccentTokens =>
  (m === 'light' ? ACCENTS_LIGHT : ACCENTS_DARK)[a];

export type Theme = {
  mode: Mode;
  /** Voile teinté posé sur la vibrancy native (fenêtre inactive / active). */
  shell: string;
  shellActive: string;
  /** Barre de titre et barre d'état. */
  chrome: string;
  /** Rail de navigation vertical. */
  rail: string;
  /** Grand panneau vitré (CPU, statut, listes). */
  panel: string;
  /** Tuile secondaire à l'intérieur d'un panneau. */
  panelSoft: string;
  /** Ligne de liste (encore un cran plus discrète). */
  panelFaint: string;
  /** Traits internes (box-shadow inset 1px) — fort puis discret. */
  hairline: string;
  hairlineSoft: string;
  /** Grille du graphique SVG. */
  grid: string;
  /** Lignes de balayage / scanlines de l'habillage HUD. */
  scan: string;
  textPrimary: string;
  textLabel: string;
  textMuted: string;
  textFaint: string;
  textFooter: string;
  track: string;
  good: string;
  warn: string;
  crit: string;
  /** Survol générique (boutons du rail, lignes de liste). */
  hover: string;
};

const DARK: Theme = {
  mode: 'dark',
  shell: 'linear-gradient(155deg, rgba(12,18,30,.62), rgba(5,7,12,.78))',
  shellActive: 'linear-gradient(155deg, rgba(12,18,30,.78), rgba(5,7,12,.9))',
  chrome: 'rgba(6,10,18,.34)',
  rail: 'rgba(6,10,18,.22)',
  panel: 'linear-gradient(155deg, rgba(255,255,255,.1), rgba(255,255,255,.03))',
  panelSoft: 'rgba(255,255,255,.055)',
  panelFaint: 'rgba(255,255,255,.04)',
  hairline: 'rgba(255,255,255,.13)',
  hairlineSoft: 'rgba(255,255,255,.1)',
  grid: 'rgba(255,255,255,.06)',
  scan: 'rgba(255,255,255,.032)',
  textPrimary: '#E6F2FA',
  textLabel: 'rgba(230,242,250,.78)',
  textMuted: 'rgba(230,242,250,.55)',
  textFaint: 'rgba(230,242,250,.42)',
  textFooter: 'rgba(230,242,250,.3)',
  track: 'rgba(255,255,255,.09)',
  good: '#4ADE80',
  warn: '#FBBF24',
  crit: '#FB7185',
  hover: 'rgba(255,255,255,.075)',
};

const LIGHT: Theme = {
  mode: 'light',
  shell: 'linear-gradient(155deg, rgba(248,250,252,.7), rgba(222,230,240,.82))',
  shellActive: 'linear-gradient(155deg, rgba(252,253,255,.88), rgba(222,230,240,.94))',
  chrome: 'rgba(255,255,255,.5)',
  rail: 'rgba(255,255,255,.36)',
  panel: 'linear-gradient(155deg, rgba(255,255,255,.72), rgba(255,255,255,.4))',
  panelSoft: 'rgba(255,255,255,.55)',
  panelFaint: 'rgba(15,23,42,.035)',
  hairline: 'rgba(15,23,42,.15)',
  hairlineSoft: 'rgba(15,23,42,.1)',
  grid: 'rgba(15,23,42,.08)',
  scan: 'rgba(15,23,42,.022)',
  textPrimary: '#0F172A',
  textLabel: 'rgba(15,23,42,.8)',
  textMuted: 'rgba(15,23,42,.58)',
  textFaint: 'rgba(15,23,42,.46)',
  textFooter: 'rgba(15,23,42,.34)',
  track: 'rgba(15,23,42,.1)',
  good: '#15803D',
  warn: '#B45309',
  crit: '#BE123C',
  hover: 'rgba(15,23,42,.06)',
};

export const getTheme = (m: Mode): Theme => (m === 'light' ? LIGHT : DARK);
