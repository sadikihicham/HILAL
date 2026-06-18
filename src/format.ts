// Helpers de formatage purs (sans dependance React Native) — testables en isolation.

// Octets -> chaine lisible ("0 o", "1.5 Mo", "2.3 Go"). Borne a >= 0.
export const fmtBytes = (b: number) => {
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let v = Math.max(0, b), i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
};

// Fraction 0..1 -> pourcentage arrondi ("45%").
export const pct = (f: number) => `${Math.round(f * 100)}%`;

// Echelle de couleur charge : vert (>50%) -> jaune (>20%) -> rouge.
// `invert` pour les metriques ou "plein" = mauvais (ex: stockage utilise).
export const loadColor = (frac: number, invert = false) => {
  const f = invert ? 1 - frac : frac;
  return f > 0.5 ? '#3FB37F' : f > 0.2 ? '#E8C15A' : '#E5705B';
};
