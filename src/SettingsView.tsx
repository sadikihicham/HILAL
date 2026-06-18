import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coords } from './useLocation';
import { GOLD, METHODS } from './islamic';
import { isRTL, Lang, t } from './i18n';
import {
  cancelPrayerNotifications, requestNotificationPermission, schedulePrayerNotifications,
} from './notifications';

export const NOTIF_KEY = 'notifications.enabled';

export default function SettingsView({
  coords, method, onChangeMethod, lang, onChangeLang,
}: {
  coords: Coords | null; method: string; onChangeMethod: (id: string) => void;
  lang: Lang; onChangeLang: (l: Lang) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const rtl = isRTL(lang);
  const rowDir = { flexDirection: (rtl ? 'row-reverse' : 'row') as 'row' | 'row-reverse' };
  const txtAlign = { textAlign: (rtl ? 'right' : 'left') as 'right' | 'left' };

  useEffect(() => { AsyncStorage.getItem(NOTIF_KEY).then((v) => setEnabled(v === '1')); }, []);

  async function toggle(v: boolean) {
    setEnabled(v);
    await AsyncStorage.setItem(NOTIF_KEY, v ? '1' : '0');
    if (v) {
      const ok = await requestNotificationPermission();
      if (!ok) { setEnabled(false); await AsyncStorage.setItem(NOTIF_KEY, '0'); return; }
      if (coords) setCount(await schedulePrayerNotifications(coords.lat, coords.lng, method));
    } else {
      await cancelPrayerNotifications();
      setCount(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={[styles.title, txtAlign]}>{t('settings', lang)}</Text>

      {/* Langue */}
      <Text style={[styles.section, txtAlign]}>{t('language', lang)}</Text>
      <View style={[styles.card, rowDir, { gap: 10 }]}>
        {(['fr', 'ar'] as Lang[]).map((l) => {
          const sel = l === lang;
          return (
            <Pressable key={l} onPress={() => onChangeLang(l)} style={[styles.langBtn, sel && styles.langSel]}>
              <Text style={[styles.langTxt, sel && styles.langTxtSel]}>{l === 'ar' ? 'العربية' : 'Français'}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Notifications */}
      <View style={[styles.card, { marginTop: 18 }]}>
        <View style={[styles.row, rowDir]}>
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text style={[styles.label, txtAlign]}>{t('notifTitle', lang)}</Text>
            <Text style={[styles.sub, txtAlign]}>{t('notifSub', lang)}</Text>
          </View>
          <Switch value={enabled} onValueChange={toggle}
            trackColor={{ true: GOLD, false: '#2a4d40' }} thumbColor="#fff" />
        </View>
        {enabled && count != null && <Text style={[styles.info, txtAlign]}>✓ {count} {t('remindersSet', lang)}</Text>}
        {enabled && !coords && <Text style={[styles.info, txtAlign]}>{t('waitingLoc', lang)}</Text>}
      </View>

      {/* Méthode de calcul */}
      <Text style={[styles.section, txtAlign]}>{t('calcMethod', lang)}</Text>
      <View style={styles.card}>
        {METHODS.map((m, i) => {
          const sel = m.id === method;
          return (
            <Pressable key={m.id} onPress={() => onChangeMethod(m.id)}
              style={[styles.method, rowDir, i > 0 && styles.methodBorder]}>
              <Text style={[styles.methodLabel, sel && styles.methodSel]}>{lang === 'ar' ? m.labelAr : m.label}</Text>
              {sel && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.foot}>{t('appFooter', lang)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingTop: 70, paddingBottom: 30 },
  title: { color: GOLD, fontSize: 26, fontWeight: '800', marginBottom: 22 },
  section: { color: '#9FC3B4', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 26, marginBottom: 10, marginHorizontal: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: 'rgba(201,162,75,0.25)',
  },
  row: { alignItems: 'center' },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sub: { color: '#9FC3B4', fontSize: 13, marginTop: 4, lineHeight: 18 },
  info: { color: GOLD, fontSize: 13, marginTop: 14 },
  langBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  langSel: { backgroundColor: 'rgba(201,162,75,0.2)', borderWidth: 1, borderColor: GOLD },
  langTxt: { color: '#cfe6dc', fontSize: 15 },
  langTxtSel: { color: '#fff', fontWeight: '700' },
  method: { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  methodBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  methodLabel: { color: '#cfe6dc', fontSize: 15 },
  methodSel: { color: '#fff', fontWeight: '700' },
  check: { color: GOLD, fontSize: 16, fontWeight: '700' },
  foot: { color: '#6f9486', fontSize: 11, marginTop: 30, textAlign: 'center' },
});
