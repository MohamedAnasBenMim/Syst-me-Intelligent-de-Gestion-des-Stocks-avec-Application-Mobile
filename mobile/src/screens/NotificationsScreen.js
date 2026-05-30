import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { getNotifications, getNotificationsStats } from '../services/api';

const TYPE_CFG = {
  alerte_stock:   { icon: 'warning-outline',      color: '#F39C12', bg: '#FEF5E7' },
  alerte_expiration: { icon: 'time-outline',      color: '#E74C3C', bg: '#FDECEA' },
  systeme:        { icon: 'settings-outline',      color: '#6C5CE7', bg: '#EEF0FF' },
  ia:             { icon: 'sparkles-outline',      color: '#004678', bg: '#E6EFF7' },
  default:        { icon: 'notifications-outline', color: COLORS.primary, bg: COLORS.primaryLight },
};

function NotifCard({ item }) {
  const cfg = TYPE_CFG[item.type_notification] || TYPE_CFG.default;
  const isUnread = item.statut !== 'lu';
  const date = item.created_at
    ? new Date(item.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <View style={[styles.card, isUnread && styles.cardUnread]}>
      <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.sujet || item.produit_nom || item.type_notification}
          </Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
        {item.produit_nom ? (
          <Text style={styles.cardSub} numberOfLines={1}>
            Produit : {item.produit_nom}
            {item.entrepot_nom ? ` — ${item.entrepot_nom}` : ''}
          </Text>
        ) : null}
        {item.niveau_alerte ? (
          <View style={[styles.niveauBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.niveauText, { color: cfg.color }]}>
              {item.niveau_alerte.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Text style={styles.cardDate}>{date}</Text>
      </View>
    </View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [notifs, setNotifs]         = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nData, sData] = await Promise.all([
        getNotifications({ per_page: 100 }),
        getNotificationsStats(),
      ]);
      const list = Array.isArray(nData) ? nData : (nData.notifications ?? []);
      setNotifs(list);
      setStats(sData);
    } catch { }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const nonLues = notifs.filter(n => n.statut !== 'lu').length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>{nonLues} non lues</Text>
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          {[
            { label: 'Envoyées',   value: stats.total_envoyees  ?? 0 },
            { label: 'En attente', value: stats.total_en_attente ?? 0 },
            { label: 'Échecs',     value: stats.total_echecs    ?? 0 },
          ].map(s => (
            <View key={s.label} style={styles.statBox}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {notifs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune notification</Text>
            </View>
          ) : (
            notifs.map((n, i) => <NotifCard key={`${n.id}-${i}`} item={n} />)
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: COLORS.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:     { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  title:       { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitle:    { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  statsRow:    { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 20, marginBottom: 16, backgroundColor: COLORS.card, borderRadius: 16, padding: 14, ...SHADOW.sm },
  statBox:     { alignItems: 'center' },
  statValue:   { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  statLabel:   { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  list:        { paddingHorizontal: 20 },
  loader:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:        { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardUnread:  { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  iconBox:     { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardContent: { flex: 1 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:   { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  unreadDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  cardSub:     { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  niveauBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  niveauText:  { fontSize: 10, fontWeight: '700' },
  cardDate:    { fontSize: 11, color: COLORS.textMuted },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:   { fontSize: 15, color: COLORS.textSecondary },
});
