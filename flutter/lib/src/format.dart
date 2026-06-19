// Helpers de formatage purs (sans dépendance widgets) — testables en isolation.
// Port Dart de src/format.ts (version Expo originale).
import 'package:flutter/painting.dart' show Color;

/// Octets -> chaîne lisible ("0 o", "1.5 Mo", "2.3 Go"). Borné à >= 0.
String fmtBytes(num b) {
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  var v = b < 0 ? 0.0 : b.toDouble();
  var i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return '${v.toStringAsFixed(i == 0 ? 0 : 1)} ${u[i]}';
}

/// Fraction 0..1 -> pourcentage arrondi ("45%").
String pct(double f) => '${(f * 100).round()}%';

/// Échelle de couleur charge : vert (>50%) -> jaune (>20%) -> rouge.
/// `invert` pour les métriques où "plein" = mauvais (ex : stockage utilisé).
Color loadColor(double frac, {bool invert = false}) {
  final f = invert ? 1 - frac : frac;
  if (f > 0.5) return const Color(0xFF3FB37F);
  if (f > 0.2) return const Color(0xFFE8C15A);
  return const Color(0xFFE5705B);
}
