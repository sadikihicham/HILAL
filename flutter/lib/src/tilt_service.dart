// Inclinaison via l'accéléromètre — port Dart de src/useTilt.ts.
// IMPORTANT : sensors_plus renvoie des m/s² (z≈9.81 à plat) ; on NORMALISE par g
// pour retrouver la sémantique d'expo-sensors (z≈1 à plat) attendue par tilt.dart.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:sensors_plus/sensors_plus.dart';

import 'tilt.dart';

const double _g = 9.80665;

/// Expose `x`/`y` (composantes de gravité normalisées, pour la bulle) et `angle`
/// (inclinaison vs horizontale, 0° = à plat). Valeurs lissées. Pause en arrière-plan.
class TiltController extends ChangeNotifier with WidgetsBindingObserver {
  StreamSubscription<AccelerometerEvent>? _sub;
  bool _disposed = false;

  double _x = 0;
  double _y = 0;
  double _angle = 0;

  double get x => _x;
  double get y => _y;
  double get angle => _angle;

  TiltController() {
    WidgetsBinding.instance.addObserver(this);
    _listen();
  }

  void _listen() {
    _sub?.cancel();
    _sub = accelerometerEventStream(
      samplingPeriod: const Duration(milliseconds: 80),
    ).listen(
      _onEvent,
      onError: (_) {/* capteur indisponible sur cet appareil */},
      cancelOnError: false,
    );
  }

  void _onEvent(AccelerometerEvent e) {
    if (_disposed) return;
    final nz = e.z / _g;
    _x = smooth(_x, e.x / _g);
    _y = smooth(_y, e.y / _g);
    _angle = smooth(_angle, tiltAngle(nz));
    notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _sub?.cancel();
    if (state == AppLifecycleState.resumed) _listen();
  }

  @override
  void dispose() {
    _disposed = true;
    _sub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
