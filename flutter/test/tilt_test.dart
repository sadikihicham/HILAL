// Port Dart de tests/tilt.test.ts — inclinaison + hystérésis haptique.
import 'dart:math' as math;
import 'package:flutter_test/flutter_test.dart';
import 'package:hilal/src/tilt.dart';

void main() {
  group('tiltAngle', () {
    test('0° quand à plat (|z| = 1)', () {
      expect(tiltAngle(1), closeTo(0, 1e-5));
      expect(tiltAngle(-1), closeTo(0, 1e-5));
    });
    test('90° à la verticale (z = 0)', () => expect(tiltAngle(0), closeTo(90, 1e-5)));
    test('~45° à mi-inclinaison', () => expect(tiltAngle(math.cos(math.pi / 4)), closeTo(45, 1e-4)));
    test('borne |z| > 1 (bruit du capteur) sans NaN', () {
      expect(tiltAngle(1.5), 0);
      expect(tiltAngle(2).isNaN, isFalse);
    });
  });

  group('smooth', () {
    test('mélange selon alpha', () => expect(smooth(0, 10, 0.3), closeTo(3, 1e-6)));
    test('stable si prev = cur', () => expect(smooth(10, 10), 10));
    test('alpha = 1 → pas de lissage', () => expect(smooth(0, 100, 1), 100));
  });

  group('clampOffset', () {
    test('borne dans [-max, max]', () {
      expect(clampOffset(100, 46), 46);
      expect(clampOffset(-100, 46), -46);
      expect(clampOffset(20, 46), 20);
    });
  });

  group('levelHapticStep — hystérésis retour haptique « à niveau »', () {
    test('déclenche en passant sous levelIn', () {
      expect(levelHapticStep(false, 1), (atLevel: true, haptic: true));
    });
    test('ne re-déclenche pas tant qu\'on reste à niveau (anti-rebond)', () {
      expect(levelHapticStep(true, 1), (atLevel: true, haptic: false));
    });
    test('ne déclenche pas pile au seuil levelIn (strictement inférieur)', () {
      expect(levelHapticStep(false, levelIn), (atLevel: false, haptic: false));
    });
    test('reste armé dans la zone morte [levelIn, levelOut[ sans buzzer', () {
      expect(levelHapticStep(true, 4), (atLevel: true, haptic: false));
    });
    test('se ré-arme au-delà de levelOut, puis re-buzze au retour à niveau', () {
      var s = levelHapticStep(false, 1);
      expect(s.haptic, isTrue);
      s = levelHapticStep(s.atLevel, 4);
      expect(s, (atLevel: true, haptic: false));
      s = levelHapticStep(s.atLevel, levelOut);
      expect(s.atLevel, isFalse);
      s = levelHapticStep(s.atLevel, 1);
      expect(s, (atLevel: true, haptic: true));
    });
  });
}
