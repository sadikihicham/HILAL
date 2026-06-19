// HILAL — moniteur d'appareil, lecture seule 100% locale. Port Flutter de App.tsx.
// App mono-écran : SafeArea + scroll + pull-to-refresh. Aucun accès réseau sortant.
import 'package:battery_plus/battery_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:share_plus/share_plus.dart';

import 'src/battery_logic.dart';
import 'src/device_metrics.dart';
import 'src/format.dart';
import 'src/i18n.dart';
import 'src/notifications.dart';
import 'src/theme.dart';
import 'src/tilt.dart';
import 'src/tilt_service.dart';

const String _alertKey = 'alert.lowbattery';
const String _langKey = 'app.lang';
const String _themeKey = 'theme.mode';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await configureNotifications();
  runApp(const HilalApp());
}

class HilalApp extends StatelessWidget {
  const HilalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'HILAL',
      debugShowCheckedModeBanner: false,
      home: MonitorScreen(),
    );
  }
}

String _batteryStateLabel(BatteryState s, Lang lang) {
  switch (s) {
    case BatteryState.charging:
      return tr('charging', lang);
    case BatteryState.full:
      return tr('full', lang);
    case BatteryState.discharging:
      return tr('onBattery', lang);
    default:
      return '';
  }
}

class MonitorScreen extends StatefulWidget {
  const MonitorScreen({super.key});

  @override
  State<MonitorScreen> createState() => _MonitorScreenState();
}

class _MonitorScreenState extends State<MonitorScreen> {
  final DeviceMetricsController _metricsCtrl = DeviceMetricsController();
  final TiltController _tiltCtrl = TiltController();

  Lang _lang = Lang.fr;
  Mode _mode = Mode.dark;
  bool _alertOn = false;

  bool _fired = false; // hystérésis alerte batterie
  bool _atLevel = true; // hystérésis haptique niveau (true → pas de buzz au lancement)

  @override
  void initState() {
    super.initState();
    _loadPrefs();
    _metricsCtrl.addListener(_onMetrics);
    _tiltCtrl.addListener(_onTilt);
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final lang = prefs.getString(_langKey);
    final mode = prefs.getString(_themeKey);
    if (!mounted) return;
    setState(() {
      _alertOn = prefs.getBool(_alertKey) ?? false;
      if (lang == 'fr') _lang = Lang.fr;
      if (lang == 'en') _lang = Lang.en;
      if (lang == 'ar') _lang = Lang.ar;
      if (mode == 'dark') _mode = Mode.dark;
      if (mode == 'light') _mode = Mode.light;
    });
  }

  void _onMetrics() {
    final b = _metricsCtrl.metrics.battery;
    if (b == null) return;
    final charging = b.state == BatteryState.charging ||
        b.state == BatteryState.full ||
        b.state == BatteryState.connectedNotCharging; // branché → pas d'alerte
    final step = lowBatteryStep(_fired,
        level: b.level, charging: charging, alertOn: _alertOn);
    _fired = step.fired;
    if (step.notify) notifyLowBattery(b.level);
  }

  void _onTilt() {
    final step = levelHapticStep(_atLevel, _tiltCtrl.angle);
    _atLevel = step.atLevel;
    if (step.haptic) HapticFeedback.mediumImpact();
  }

  Future<void> _changeLang(Lang l) async {
    setState(() => _lang = l);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_langKey, l.name);
  }

  Future<void> _toggleTheme() async {
    final next = _mode == Mode.dark ? Mode.light : Mode.dark;
    setState(() => _mode = next);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_themeKey, next.name);
  }

  Future<void> _toggleAlert(bool v) async {
    setState(() => _alertOn = v);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_alertKey, v);
    if (v) {
      final ok = await requestNotificationPermission();
      if (!ok && mounted) {
        setState(() => _alertOn = false);
        await prefs.setBool(_alertKey, false);
        return;
      }
    }
    _onMetrics(); // réévalue tout de suite (parité avec la dépendance `alertOn` de l'original)
  }

  Future<void> _onShare() async {
    final m = _metricsCtrl.metrics;
    String l(String k) => tr(k, _lang);
    final lines = <String>['HILAL'];
    final b = m.battery;
    if (b != null) {
      lines.add('${l('battery')}: ${pct(b.level)} (${_batteryStateLabel(b.state, _lang)})');
    }
    final s = m.storage;
    if (s != null) {
      lines.add('${l('storage')}: ${fmtBytes(s.total - s.free)} / ${fmtBytes(s.total)}');
      lines.add('${l('free')}: ${fmtBytes(s.free)}');
    }
    if (m.brightness != null) lines.add('${l('brightness')}: ${pct(m.brightness!)}');
    final net = m.network;
    if (net != null) {
      final label = '${tr(net.type, _lang)}'
          '${net.isConnected ? '' : ' (${l('disconnected')})'}';
      lines.add('${l('network')}: $label${net.ip != null ? ' · ${net.ip}' : ''}');
    }
    lines.add('${l('device')}: ${m.deviceModel}');
    lines.add('${l('system')}: ${m.deviceOs}');
    await SharePlus.instance.share(ShareParams(text: lines.join('\n')));
  }

  @override
  void dispose() {
    _metricsCtrl.removeListener(_onMetrics);
    _tiltCtrl.removeListener(_onTilt);
    _metricsCtrl.dispose();
    _tiltCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = getTheme(_mode);
    final rtl = isRtl(_lang);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: theme.statusBar == Brightness.light
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      child: Directionality(
        textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
        child: Scaffold(
          backgroundColor: theme.bg,
          body: SafeArea(
            // Seules les métriques (3 s) reconstruisent tout l'écran. Le tilt
            // (~12 Hz) est isolé autour de la seule carte Niveau (sobriété batterie).
            child: ListenableBuilder(
              listenable: _metricsCtrl,
              builder: (context, _) => _buildBody(theme),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(AppTheme theme) {
    final m = _metricsCtrl.metrics;
    final b = m.battery;
    final s = m.storage;
    final usedStorage = s != null ? s.total - s.free : 0;
    final storageFrac = s != null && s.total > 0 ? usedStorage / s.total : 0.0;

    return RefreshIndicator(
      color: theme.gold,
      backgroundColor: theme.card,
      onRefresh: _metricsCtrl.refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(22, 18, 22, 30),
        children: [
          _header(theme),
          const SizedBox(height: 8),
          Text(tr('subtitle', _lang),
              style: TextStyle(color: theme.textMuted, fontSize: 13)),
          const SizedBox(height: 26),
          if (b != null)
            MetricRow(
              icon: '🔋',
              label: tr('battery', _lang),
              value: '${pct(b.level)}${b.lowPower ? ' · ${tr('eco', _lang)}' : ''}',
              frac: b.level,
              color: loadColor(b.level, invert: true),
              theme: theme,
            ),
          if (b != null && _batteryStateLabel(b.state, _lang).isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(_batteryStateLabel(b.state, _lang),
                  style: TextStyle(color: theme.textMuted, fontSize: 13)),
            ),
          if (m.batteryHistory.length > 1)
            Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: Sparkline(
                values: m.batteryHistory,
                color: loadColor(b?.level ?? 1, invert: true),
                theme: theme,
              ),
            ),
          if (s != null)
            MetricRow(
              icon: '💾',
              label: tr('storage', _lang),
              value: '${fmtBytes(usedStorage)} / ${fmtBytes(s.total)}',
              frac: storageFrac,
              color: loadColor(storageFrac),
              theme: theme,
            ),
          _infoCard(theme, m),
          ListenableBuilder(
            listenable: _tiltCtrl,
            builder: (context, _) => _levelCard(theme),
          ),
          _alertCard(theme),
          const SizedBox(height: 22),
          Center(
            child: OutlinedButton(
              onPressed: _onShare,
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: theme.gold),
                backgroundColor: theme.chipSel,
                padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              ),
              child: Text(tr('share', _lang),
                  style: TextStyle(color: theme.gold, fontSize: 15, fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(height: 30),
          Text('${tr('footer', _lang)} هلال',
              textAlign: TextAlign.center,
              style: TextStyle(color: theme.textFooter, fontSize: 11, height: 1.45)),
        ],
      ),
    );
  }

  Widget _header(AppTheme theme) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text('HILAL',
            style: TextStyle(
                color: theme.gold, fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: 3)),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            GestureDetector(
              onTap: _toggleTheme,
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: Text(_mode == Mode.dark ? '☀️' : '🌙', style: const TextStyle(fontSize: 18)),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              decoration: BoxDecoration(color: theme.chipBg, borderRadius: BorderRadius.circular(8)),
              padding: const EdgeInsets.all(2),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: langs.map((opt) {
                  final sel = _lang == opt.id;
                  return GestureDetector(
                    onTap: () => _changeLang(opt.id),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: sel ? theme.chipSel : Colors.transparent,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(opt.label,
                          style: TextStyle(
                              color: sel ? theme.textPrimary : theme.textSecondary,
                              fontSize: 13,
                              fontWeight: FontWeight.w700)),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: theme.sealBg,
                border: Border.all(color: theme.sealBorder),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text('🔒 Local',
                  style: TextStyle(color: theme.sealTxt, fontSize: 12, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ],
    );
  }

  Widget _infoCard(AppTheme theme, DeviceMetrics m) {
    final rows = <Widget>[];
    if (m.storage != null) {
      rows.add(InfoRow(label: tr('free', _lang), value: fmtBytes(m.storage!.free), theme: theme));
    }
    if (m.ramTotal != null) {
      rows.add(InfoRow(label: tr('ram', _lang), value: fmtBytes(m.ramTotal!), theme: theme));
    }
    if (m.brightness != null) {
      rows.add(InfoRow(label: tr('brightness', _lang), value: pct(m.brightness!), theme: theme));
    }
    if (m.network != null) {
      final net = m.network!;
      final label = '${tr(net.type, _lang)}${net.isConnected ? '' : ' (${tr('disconnected', _lang)})'}';
      rows.add(InfoRow(label: tr('network', _lang), value: label, theme: theme));
    }
    if (m.network?.ip != null) {
      rows.add(InfoRow(label: tr('ip', _lang), value: m.network!.ip!, theme: theme));
    }
    rows.add(InfoRow(label: tr('device', _lang), value: m.deviceModel, theme: theme));
    rows.add(InfoRow(label: tr('system', _lang), value: m.deviceOs, theme: theme, last: true));

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.cardBorder),
      ),
      child: Column(children: rows),
    );
  }

  Widget _levelCard(AppTheme theme) {
    final atLevel = _tiltCtrl.angle < levelIn;
    final dx = clampOffset(-_tiltCtrl.x * 46, 46);
    final dy = clampOffset(_tiltCtrl.y * 46, 46);
    return Container(
      margin: const EdgeInsets.only(top: 18),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text('📐 ${tr('level', _lang)}',
                style: TextStyle(color: theme.textPrimary, fontSize: 15, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: 140,
            height: 140,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: theme.track,
                    border: Border.all(color: theme.cardBorder),
                  ),
                ),
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: theme.gold.withValues(alpha: 0.5)),
                  ),
                ),
                Transform.translate(
                  offset: Offset(dx, dy),
                  child: Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: atLevel ? theme.gold : const Color(0xFF5FD3A0),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            atLevel ? tr('levelOk', _lang) : '${_tiltCtrl.angle.round()}° ${tr('tilt', _lang)}',
            style: TextStyle(
                color: atLevel ? theme.gold : theme.textMuted,
                fontSize: 14,
                fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _alertCard(AppTheme theme) {
    return Container(
      margin: const EdgeInsets.only(top: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.cardBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr('alertTitle', _lang),
                      style: TextStyle(color: theme.textPrimary, fontSize: 15, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(tr('alertSub', _lang),
                      style: TextStyle(color: theme.textSecondary, fontSize: 12, height: 1.33)),
                ],
              ),
            ),
          ),
          Switch(
            value: _alertOn,
            onChanged: _toggleAlert,
            activeTrackColor: theme.gold,
            inactiveTrackColor: theme.alertTrackOff,
            thumbColor: const WidgetStatePropertyAll(Colors.white),
          ),
        ],
      ),
    );
  }
}

class Gauge extends StatelessWidget {
  final double value; // 0..1
  final Color color;
  final AppTheme theme;
  const Gauge({super.key, required this.value, required this.color, required this.theme});

  @override
  Widget build(BuildContext context) {
    final frac = value.clamp(0.02, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.circular(5),
      child: Container(
        height: 10,
        color: theme.track,
        child: Align(
          alignment: AlignmentDirectional.centerStart,
          child: FractionallySizedBox(
            widthFactor: frac,
            child: Container(color: color),
          ),
        ),
      ),
    );
  }
}

class Sparkline extends StatelessWidget {
  final List<double> values; // 0..1
  final Color color;
  final AppTheme theme;
  const Sparkline({super.key, required this.values, required this.color, required this.theme});

  @override
  Widget build(BuildContext context) {
    if (values.length < 2) return const SizedBox.shrink();
    return SizedBox(
      height: 34,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < values.length; i++) ...[
            Expanded(
              child: FractionallySizedBox(
                heightFactor: values[i].clamp(0.06, 1.0),
                child: Container(
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.65),
                    borderRadius: BorderRadius.circular(1),
                  ),
                ),
              ),
            ),
            if (i < values.length - 1) const SizedBox(width: 2),
          ],
        ],
      ),
    );
  }
}

class MetricRow extends StatelessWidget {
  final String icon;
  final String label;
  final String value;
  final double frac;
  final Color color;
  final AppTheme theme;
  const MetricRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.frac,
    required this.color,
    required this.theme,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(
                child: Text('$icon  $label',
                    style: TextStyle(color: theme.textLabel, fontSize: 16, fontWeight: FontWeight.w600)),
              ),
              Text(value,
                  style: TextStyle(
                      color: color,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ),
          const SizedBox(height: 8),
          Gauge(value: frac, color: color, theme: theme),
        ],
      ),
    );
  }
}

class InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final AppTheme theme;
  final bool last;
  const InfoRow({
    super.key,
    required this.label,
    required this.value,
    required this.theme,
    this.last = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 14),
      decoration: BoxDecoration(
        border: last ? null : Border(bottom: BorderSide(color: theme.cardBorder, width: 0.5)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(child: Text(label, style: TextStyle(color: theme.textSecondary, fontSize: 14))),
          const SizedBox(width: 12),
          Flexible(
            child: Text(value,
                textAlign: TextAlign.end,
                style: TextStyle(
                    color: theme.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFeatures: const [FontFeature.tabularFigures()])),
          ),
        ],
      ),
    );
  }
}
