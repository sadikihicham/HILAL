export type Mode = 'dark' | 'light';

export type Theme = {
  mode: Mode;
  bg: string;
  card: string;
  cardBorder: string;
  textPrimary: string;
  textLabel: string;
  textSecondary: string;
  textMuted: string;
  textFooter: string;
  gold: string;
  track: string;
  statusBar: 'light-content' | 'dark-content';
  chipBg: string;
  chipSel: string;
  sealBg: string;
  sealBorder: string;
  sealTxt: string;
  alertTrackOff: string;
};

const DARK: Theme = {
  mode: 'dark', bg: '#0E1A16', card: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(201,162,75,0.18)',
  textPrimary: '#ffffff', textLabel: '#e6efe9', textSecondary: '#9bb3a8', textMuted: '#7f9b90', textFooter: '#5e7268',
  gold: '#C9A24B', track: 'rgba(255,255,255,0.08)', statusBar: 'light-content',
  chipBg: 'rgba(255,255,255,0.06)', chipSel: 'rgba(201,162,75,0.25)',
  sealBg: 'rgba(63,179,127,0.15)', sealBorder: 'rgba(63,179,127,0.5)', sealTxt: '#5fd3a0', alertTrackOff: '#28423a',
};

const LIGHT: Theme = {
  mode: 'light', bg: '#F5F2EA', card: 'rgba(0,0,0,0.035)', cardBorder: 'rgba(201,162,75,0.4)',
  textPrimary: '#19231e', textLabel: '#243029', textSecondary: '#5a6b63', textMuted: '#7a8a82', textFooter: '#9aa39e',
  gold: '#A6822F', track: 'rgba(0,0,0,0.09)', statusBar: 'dark-content',
  chipBg: 'rgba(0,0,0,0.05)', chipSel: 'rgba(166,130,47,0.22)',
  sealBg: 'rgba(45,140,95,0.12)', sealBorder: 'rgba(45,140,95,0.45)', sealTxt: '#2d8c5f', alertTrackOff: '#cfd6d1',
};

export const getTheme = (m: Mode): Theme => (m === 'light' ? LIGHT : DARK);
