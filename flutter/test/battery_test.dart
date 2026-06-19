// Port Dart de tests/battery.test.ts — hystérésis de l'alerte batterie faible.
import 'package:flutter_test/flutter_test.dart';
import 'package:hilal/src/battery_logic.dart';

({bool fired, bool notify}) step(bool prev, double level, {bool charging = false, bool alertOn = true}) =>
    lowBatteryStep(prev, level: level, charging: charging, alertOn: alertOn);

void main() {
  group('lowBatteryStep — hystérésis alerte batterie', () {
    test('notifie sous le seuil low, hors charge, alerte activée', () {
      expect(step(false, 0.1), (fired: true, notify: true));
    });
    test('ne re-notifie pas tant que déjà tirée (anti-spam)', () {
      expect(step(true, 0.1), (fired: true, notify: false));
    });
    test('ne notifie jamais en charge, même sous le seuil', () {
      expect(step(false, 0.05, charging: true), (fired: false, notify: false));
    });
    test('ne notifie pas si l\'alerte est désactivée', () {
      expect(step(false, 0.05, alertOn: false), (fired: false, notify: false));
    });
    test('ne notifie pas pile au seuil low (strictement inférieur)', () {
      expect(step(false, low), (fired: false, notify: false));
    });
    test('se ré-arme une fois la batterie remontée à rearm', () {
      var s = step(false, 0.1);
      expect(s.notify, isTrue);
      s = step(s.fired, 0.17);
      expect(s, (fired: true, notify: false));
      s = step(s.fired, rearm);
      expect(s.fired, isFalse);
      s = step(s.fired, 0.1);
      expect(s, (fired: true, notify: true));
    });
    test('ne se ré-arme pas dans la zone morte juste sous rearm', () {
      expect(step(true, 0.19).fired, isTrue);
    });
  });
}
