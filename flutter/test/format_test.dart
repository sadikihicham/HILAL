// Port Dart de tests/format.test.ts — logique de formatage pure.
import 'package:flutter/painting.dart' show Color;
import 'package:flutter_test/flutter_test.dart';
import 'package:hilal/src/format.dart';

void main() {
  group('fmtBytes', () {
    test('0 octet', () => expect(fmtBytes(0), '0 o'));
    test('sous 1 Ko : pas de décimale', () => expect(fmtBytes(512), '512 o'));
    test('1 Ko', () => expect(fmtBytes(1024), '1.0 Ko'));
    test('1.5 Ko', () => expect(fmtBytes(1536), '1.5 Ko'));
    test('1 Mo', () => expect(fmtBytes(1024 * 1024), '1.0 Mo'));
    test('Go', () => expect(fmtBytes(2.3 * 1024 * 1024 * 1024), '2.3 Go'));
    test('borne les négatifs à 0', () => expect(fmtBytes(-5), '0 o'));
    test('plafonne à To', () => expect(fmtBytes(5 * 1024 * 1024 * 1024 * 1024), '5.0 To'));
  });

  group('pct', () {
    test('0%', () => expect(pct(0), '0%'));
    test('50%', () => expect(pct(0.5), '50%'));
    test('100%', () => expect(pct(1), '100%'));
    test('arrondit', () => expect(pct(0.456), '46%'));
  });

  group('loadColor', () {
    const green = Color(0xFF3FB37F);
    const yellow = Color(0xFFE8C15A);
    const red = Color(0xFFE5705B);
    test('vert au-dessus de 50%', () => expect(loadColor(0.8), green));
    test('jaune entre 20% et 50%', () => expect(loadColor(0.3), yellow));
    test('rouge sous 20%', () => expect(loadColor(0.1), red));
    test('invert : plein = mauvais → rouge à 90% utilisé', () => expect(loadColor(0.9, invert: true), red));
    test('invert : peu utilisé → vert', () => expect(loadColor(0.1, invert: true), green));
  });
}
