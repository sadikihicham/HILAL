// Helpers de formatage purs (sans dépendance React/DOM), testables en isolation.
// Copie volontairement autonome de l'app mobile (../../src/format.ts) : le desktop
// est un produit séparé et ne doit PAS importer hors de desktop/ (isolation de build
// CI + découplage des cycles de release). Garder en phase avec le mobile si besoin.

// Octets -> chaîne lisible ("0 o", "1.5 Mo", "2.3 Go"). Borne à >= 0.
export const fmtBytes = (b: number) => {
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let v = Math.max(0, b), i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

// Fraction 0..1 -> pourcentage arrondi ("45%").
export const pct = (f: number) => `${Math.round(f * 100)}%`;

// Palette d'accents sémantiques : bon / avertissement / critique. Le thème HUD
// (`lib/theme.ts`) la fournit déjà, déclinée sombre/clair — un `Theme` est donc
// directement acceptable ici, sans préréglage de couleurs séparé à maintenir.
export type LoadPalette = { good: string; warn: string; crit: string };

// Échelle de couleur charge : bon (>50%) -> avertissement (>20%) -> critique.
// `invert` pour les métriques où "plein" = mauvais (ex: CPU/RAM/disque utilisés).
export const loadColor = (f: number, invert = false, palette: LoadPalette) => {
  const v = invert ? 1 - f : f;
  return v > 0.5 ? palette.good : v > 0.2 ? palette.warn : palette.crit;
};
