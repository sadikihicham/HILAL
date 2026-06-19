// i18n FR / EN / AR — port Dart de src/i18n.ts (version Expo originale).
// FR par défaut. Toute chaîne UI passe par `tr(key, lang)`.

enum Lang { fr, en, ar }

class LangOption {
  final Lang id;
  final String label;
  const LangOption(this.id, this.label);
}

const List<LangOption> langs = [
  LangOption(Lang.fr, 'FR'),
  LangOption(Lang.en, 'EN'),
  LangOption(Lang.ar, 'ع'),
];

bool isRtl(Lang l) => l == Lang.ar;

const Map<Lang, Map<String, String>> _strings = {
  Lang.fr: {
    'subtitle': 'Moniteur d’appareil · tirez pour rafraîchir',
    'battery': 'Batterie', 'storage': 'Stockage', 'free': 'Espace libre', 'ram': 'Mémoire (RAM)',
    'brightness': 'Luminosité', 'network': 'Réseau', 'ip': 'Adresse IP', 'device': 'Appareil', 'system': 'Système',
    'level': 'Niveau', 'levelOk': '✓ à niveau', 'tilt': 'inclinaison', 'share': '📤 Partager l’état',
    'charging': '⚡ En charge', 'full': '✓ Pleine', 'onBattery': 'Sur batterie', 'eco': 'éco',
    'alertTitle': '🔔 Alerte batterie faible', 'alertSub': 'Notification locale sous 15% (hors charge).',
    'footer': 'Lecture des capteurs locaux uniquement — aucun accès réseau sortant.',
    'disconnected': 'déconnecté',
    'WIFI': 'Wi-Fi', 'CELLULAR': 'Cellulaire', 'ETHERNET': 'Ethernet', 'NONE': 'Hors-ligne', 'UNKNOWN': 'Inconnu', 'OTHER': 'Autre',
  },
  Lang.en: {
    'subtitle': 'Device monitor · pull to refresh',
    'battery': 'Battery', 'storage': 'Storage', 'free': 'Free space', 'ram': 'Memory (RAM)',
    'brightness': 'Brightness', 'network': 'Network', 'ip': 'IP address', 'device': 'Device', 'system': 'System',
    'level': 'Level', 'levelOk': '✓ level', 'tilt': 'tilt', 'share': '📤 Share status',
    'charging': '⚡ Charging', 'full': '✓ Full', 'onBattery': 'On battery', 'eco': 'low power',
    'alertTitle': '🔔 Low-battery alert', 'alertSub': 'Local notification below 15% (not charging).',
    'footer': 'Reads local sensors only — no outbound network.',
    'disconnected': 'disconnected',
    'WIFI': 'Wi-Fi', 'CELLULAR': 'Cellular', 'ETHERNET': 'Ethernet', 'NONE': 'Offline', 'UNKNOWN': 'Unknown', 'OTHER': 'Other',
  },
  Lang.ar: {
    'subtitle': 'مراقب الجهاز · اسحب للتحديث',
    'battery': 'البطارية', 'storage': 'التخزين', 'free': 'المساحة الحرة', 'ram': 'الذاكرة (RAM)',
    'brightness': 'السطوع', 'network': 'الشبكة', 'ip': 'عنوان IP', 'device': 'الجهاز', 'system': 'النظام',
    'level': 'الميزان', 'levelOk': '✓ مستوٍ', 'tilt': 'الميل', 'share': '📤 مشاركة الحالة',
    'charging': '⚡ قيد الشحن', 'full': '✓ ممتلئة', 'onBattery': 'على البطارية', 'eco': 'توفير',
    'alertTitle': '🔔 تنبيه انخفاض البطارية', 'alertSub': 'إشعار محلي تحت 15٪ (دون شحن).',
    'footer': 'يقرأ المستشعرات المحلية فقط — دون أي اتصال شبكي صادر.',
    'disconnected': 'غير متصل',
    'WIFI': 'واي فاي', 'CELLULAR': 'خلوي', 'ETHERNET': 'إيثرنت', 'NONE': 'غير متصل', 'UNKNOWN': 'غير معروف', 'OTHER': 'أخرى',
  },
};

/// Traduction avec repli FR puis clé brute (parité avec t() de la version Expo).
String tr(String key, Lang lang) =>
    _strings[lang]?[key] ?? _strings[Lang.fr]?[key] ?? key;
