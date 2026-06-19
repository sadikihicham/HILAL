// Cœur du sampling capteurs — port Dart de src/useDeviceMetrics.ts.
// Poll toutes les 3 s, pause en arrière-plan, historique batterie borné.
// AUCUN accès réseau sortant (invariant produit HILAL).
import 'dart:async';
import 'dart:io' show Platform;

import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:storage_space/storage_space.dart';

const int _historyMax = 40;

class BatteryInfo {
  final double level; // 0..1
  final BatteryState state;
  final bool lowPower;
  const BatteryInfo(this.level, this.state, this.lowPower);
}

class StorageInfo {
  final int free;
  final int total;
  const StorageInfo(this.free, this.total);
}

class NetworkInfoData {
  final String type; // clé i18n : WIFI / CELLULAR / ETHERNET / NONE / OTHER
  final bool isConnected;
  final String? ip;
  const NetworkInfoData(this.type, this.isConnected, this.ip);
}

class DeviceMetrics {
  final BatteryInfo? battery;
  final StorageInfo? storage;
  final NetworkInfoData? network;
  final int? ramTotal; // device_info_plus ne l'expose pas → null (parité dégradée)
  final double? brightness; // 0..1
  final String deviceModel;
  final String deviceOs;
  final List<double> batteryHistory; // 0..1, du plus ancien au plus récent

  const DeviceMetrics({
    this.battery,
    this.storage,
    this.network,
    this.ramTotal,
    this.brightness,
    this.deviceModel = '—',
    this.deviceOs = '—',
    this.batteryHistory = const [],
  });
}

String _connType(List<ConnectivityResult> r) {
  if (r.contains(ConnectivityResult.wifi)) return 'WIFI';
  if (r.contains(ConnectivityResult.mobile)) return 'CELLULAR';
  if (r.contains(ConnectivityResult.ethernet)) return 'ETHERNET';
  if (r.contains(ConnectivityResult.none)) return 'NONE';
  return 'OTHER';
}

/// Échantillonne les capteurs locaux et notifie ses auditeurs. En pause quand
/// l'app passe en arrière-plan (économie de batterie). `refresh()` = tirer-pour-rafraîchir.
class DeviceMetricsController extends ChangeNotifier with WidgetsBindingObserver {
  final Duration interval;
  final Battery _battery = Battery();
  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();
  final NetworkInfo _networkInfo = NetworkInfo();

  DeviceMetrics _metrics = const DeviceMetrics();
  DeviceMetrics get metrics => _metrics;

  Timer? _timer;
  bool _disposed = false;

  DeviceMetricsController({this.interval = const Duration(seconds: 3)}) {
    WidgetsBinding.instance.addObserver(this);
    refresh();
    _start();
  }

  void _start() {
    _timer?.cancel();
    _timer = Timer.periodic(interval, (_) => refresh());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _timer?.cancel();
    if (state == AppLifecycleState.resumed) {
      refresh();
      _start();
    }
  }

  Future<void> refresh() async {
    try {
      final levelPct = await _battery.batteryLevel;
      final state = await _battery.batteryState;
      bool lowPower = false;
      try {
        lowPower = await _battery.isInBatterySaveMode;
      } catch (_) {/* indisponible */}

      StorageInfo? storage;
      try {
        final s = await getStorageSpace(
          lowOnSpaceThreshold: 2 * 1024 * 1024 * 1024,
          fractionDigits: 1,
        );
        storage = StorageInfo(s.free, s.total);
      } catch (_) {/* indisponible */}

      List<ConnectivityResult> conn = const [ConnectivityResult.none];
      try {
        conn = await Connectivity().checkConnectivity();
      } catch (_) {/* indisponible */}
      String? ip;
      try {
        ip = await _networkInfo.getWifiIP();
      } catch (_) {/* indisponible */}

      double? brightness;
      try {
        brightness = await ScreenBrightness.instance.application;
      } catch (_) {/* indisponible */}

      String model = '—';
      String os = '—';
      try {
        if (Platform.isAndroid) {
          final a = await _deviceInfo.androidInfo;
          model = a.model;
          os = 'Android ${a.version.release}'.trim();
        } else if (Platform.isIOS) {
          final i = await _deviceInfo.iosInfo;
          model = i.utsname.machine.isNotEmpty ? i.utsname.machine : i.model;
          os = '${i.systemName} ${i.systemVersion}'.trim();
        }
      } catch (_) {/* indisponible */}

      if (_disposed) return;

      final level = levelPct / 100.0;
      final history = [..._metrics.batteryHistory, level];
      final bounded = history.length > _historyMax
          ? history.sublist(history.length - _historyMax)
          : history;

      _metrics = DeviceMetrics(
        battery: BatteryInfo(level, state, lowPower),
        storage: storage,
        network: NetworkInfoData(
          _connType(conn),
          !conn.contains(ConnectivityResult.none),
          ip,
        ),
        ramTotal: null,
        brightness: brightness,
        deviceModel: model,
        deviceOs: os,
        batteryHistory: bounded,
      );
      notifyListeners();
    } catch (_) {/* lecture impossible ce tick */}
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
