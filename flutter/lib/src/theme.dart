// Palettes dark/light — port Dart de src/theme.ts (version Expo originale).
// Les couleurs rgba(...) de la version RN sont converties en ARGB hex.
import 'package:flutter/material.dart';

enum Mode { dark, light }

@immutable
class AppTheme {
  final Mode mode;
  final Color bg;
  final Color card;
  final Color cardBorder;
  final Color textPrimary;
  final Color textLabel;
  final Color textSecondary;
  final Color textMuted;
  final Color textFooter;
  final Color gold;
  final Color track;
  final Brightness statusBar; // luminosité des icônes de la barre d'état
  final Color chipBg;
  final Color chipSel;
  final Color sealBg;
  final Color sealBorder;
  final Color sealTxt;
  final Color alertTrackOff;

  const AppTheme({
    required this.mode,
    required this.bg,
    required this.card,
    required this.cardBorder,
    required this.textPrimary,
    required this.textLabel,
    required this.textSecondary,
    required this.textMuted,
    required this.textFooter,
    required this.gold,
    required this.track,
    required this.statusBar,
    required this.chipBg,
    required this.chipSel,
    required this.sealBg,
    required this.sealBorder,
    required this.sealTxt,
    required this.alertTrackOff,
  });
}

const AppTheme _dark = AppTheme(
  mode: Mode.dark,
  bg: Color(0xFF0E1A16),
  card: Color(0x0AFFFFFF), // rgba(255,255,255,0.04)
  cardBorder: Color(0x2EC9A24B), // rgba(201,162,75,0.18)
  textPrimary: Color(0xFFFFFFFF),
  textLabel: Color(0xFFE6EFE9),
  textSecondary: Color(0xFF9BB3A8),
  textMuted: Color(0xFF7F9B90),
  textFooter: Color(0xFF5E7268),
  gold: Color(0xFFC9A24B),
  track: Color(0x14FFFFFF), // rgba(255,255,255,0.08)
  statusBar: Brightness.light, // 'light-content'
  chipBg: Color(0x0FFFFFFF), // rgba(255,255,255,0.06)
  chipSel: Color(0x40C9A24B), // rgba(201,162,75,0.25)
  sealBg: Color(0x263FB37F), // rgba(63,179,127,0.15)
  sealBorder: Color(0x803FB37F), // rgba(63,179,127,0.5)
  sealTxt: Color(0xFF5FD3A0),
  alertTrackOff: Color(0xFF28423A),
);

const AppTheme _light = AppTheme(
  mode: Mode.light,
  bg: Color(0xFFF5F2EA),
  card: Color(0x09000000), // rgba(0,0,0,0.035)
  cardBorder: Color(0x66C9A24B), // rgba(201,162,75,0.4)
  textPrimary: Color(0xFF19231E),
  textLabel: Color(0xFF243029),
  textSecondary: Color(0xFF5A6B63),
  textMuted: Color(0xFF7A8A82),
  textFooter: Color(0xFF9AA39E),
  gold: Color(0xFFA6822F),
  track: Color(0x17000000), // rgba(0,0,0,0.09)
  statusBar: Brightness.dark, // 'dark-content'
  chipBg: Color(0x0D000000), // rgba(0,0,0,0.05)
  chipSel: Color(0x38A6822F), // rgba(166,130,47,0.22)
  sealBg: Color(0x1F2D8C5F), // rgba(45,140,95,0.12)
  sealBorder: Color(0x732D8C5F), // rgba(45,140,95,0.45)
  sealTxt: Color(0xFF2D8C5F),
  alertTrackOff: Color(0xFFCFD6D1),
);

AppTheme getTheme(Mode m) => m == Mode.light ? _light : _dark;
