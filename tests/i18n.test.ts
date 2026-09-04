import { describe, it, expect } from 'vitest';
import { LANGS, isRTL, langKeys, t } from '../src/i18n';

// Convention HILAL : les 3 langues sont maintenues DE FRONT (cf. CLAUDE.md).
//
// 🪤 Le mobile est PLUS exposé que le desktop sur ce point, car son `t()` se termine
// par `?? S.fr[k]` : une clé absente en arabe ne laisse pas un trou visible, elle
// affiche du FRANÇAIS au milieu d'une interface arabe RTL. Ni la relecture, ni le
// type-check, ni un test d'écran ne voient passer ça. Seule la comparaison des jeux
// de clés l'attrape — d'où cette porte.
describe('parité des traductions', () => {
  const fr = langKeys('fr');

  it('FR déclare bien des clés (garde-fou : un jeu vide rendrait les tests suivants vacants)', () => {
    expect(fr.length).toBeGreaterThan(20);
  });
  it('EN couvre exactement les mêmes clés que FR', () => {
    expect(langKeys('en')).toEqual(fr);
  });
  it('AR couvre exactement les mêmes clés que FR', () => {
    expect(langKeys('ar')).toEqual(fr);
  });
  it('aucune valeur vide', () => {
    for (const l of LANGS) {
      for (const k of langKeys(l.id)) expect(t(k, l.id).trim()).not.toBe('');
    }
  });
  it('aucune traduction EN/AR laissée identique au français', () => {
    // Une clé copiée-collée depuis FR sans être traduite passe la parité ci-dessus.
    // Seules exceptions : les noms techniques identiques dans les deux langues.
    // Liste volontairement MINIMALE — chaque entrée est un trou dans la porte.
    const communes = new Set(['WIFI', 'ETHERNET']);
    for (const l of ['en', 'ar'] as const) {
      for (const k of langKeys(l)) {
        if (communes.has(k)) continue;
        expect(t(k, l), `« ${k} » n'est pas traduit en ${l.toUpperCase()}`).not.toBe(t(k, 'fr'));
      }
    }
  });
});

describe('t / isRTL', () => {
  it('retourne la chaîne de la langue demandée', () => {
    expect(t('battery', 'en')).toBe('Battery');
    expect(t('battery', 'fr')).toBe('Batterie');
  });
  it('clé inconnue -> la clé elle-même (jamais un plantage)', () => {
    expect(t('cléInexistante', 'fr')).toBe('cléInexistante');
  });
  it('seul l’arabe est RTL', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('fr')).toBe(false);
    expect(isRTL('en')).toBe(false);
  });
});
