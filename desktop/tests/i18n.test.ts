import { describe, it, expect } from 'vitest';
import { isRTL, langKeys, t, LANGS } from '../src/lib/i18n';

// Convention HILAL : les 3 langues sont maintenues DE FRONT. Une clé ajoutée en FR
// et oubliée en EN/AR retomberait silencieusement en français dans l'UI — ce test
// transforme cet oubli en échec de porte.
describe('parité des traductions', () => {
  const fr = langKeys('fr');

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
});

describe('t / isRTL', () => {
  it('retourne la chaîne de la langue demandée', () => {
    expect(t('cores', 'en')).toBe('Cores');
    expect(t('cores', 'fr')).toBe('Cœurs');
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
