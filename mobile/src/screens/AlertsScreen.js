import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView,
  TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { getAlertesActives, updateAlerte } from '../services/api';

const NIVEAU_CONFIG = {
  critique: { bg: '#FDECEA', border: '#E74C3C', icon: 'warning',            iconColor: '#E74C3C', actionColor: '#E74C3C' },
  rupture:  { bg: '#FDECEA', border: '#E74C3C', icon: 'alert-circle',       iconColor: '#E74C3C', actionColor: '#E74C3C' },
  normal:   { bg: '#FEF5E7', border: '#F39C12', icon: 'trending-down-outline', iconColor: '#F39C12', actionColor: '#F39C12' },
  surstock: { bg: '#E6EFF7', border: '#004678', icon: 'archive-outline',    iconColor: '#004678', actionColor: '#004678' },
};

function AlertCard({ item, onResolve }) {
  const cfg = NIVEAU_CONFIG[item.niveau] || NIVEAU_CONFIG.normal;
  return (
    <View style={[styles.card, { backgroundColor: cfg.bg, borderLeftColor: cfg.border }]}>
      <View style={styles.cardHeader}>
        <Ionicons name={cfg.icon} size={17} color={cfg.iconColor} />
        <Text style={[styles.cardTitle, { color: cfg.iconColor }]}>{item.message}</Text>
        <View style={[styles.niveauBadge, { backgroundColor: cfg.border + '22' }]}>
          <Text style={[styles.niveauText, { color: cfg.border }]}>{item.niveau?.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.cardDesc} numberOfLines={2}>{item.message}</Text>

      {[
        { label: 'Produit',   value: item.produit_nom  || item.produit_id },
        { label: 'Entrepôt',  value: item.entrepot_nom || item.entrepot_id },
        { label: 'Quantité',  value: item.quantite_actuelle != null ? `${item.quantite_actuelle} u.` : null },
      ].filter(r => r.value != null).map(row => (
        <View key={row.label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{row.label}</Text>
          <Text style={styles.detailValue}>{row.value}</Text>
        </View>
      ))}

      <View style={styles.cardFooter}>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.timeText}> {item.statut}</Text>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: cfg.actionColor }]}
          onPress={() => onResolve(item.id)}
        >
          <Text style={[styles.actionText, { color: cfg.actionColor }]}>Résoudre ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const [alerts, setAlerts]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getAlertesActives();
      const list = Array.isArray(data) ? data : (data.alertes ?? []);
      setAlerts(list);
    } catch { /* garde état */ }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleResolve = useCallback(async (id) => {
    Alert.alert('Résoudre', 'Marquer cette alerte comme résolue ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Résoudre', style: 'default',
        onPress: async () => {
          try {
            await updateAlerte(id, { statut: 'resolue' });
            setAlerts(prev => prev.filter(a => a.id !== id));
          } catch (e) {
            Alert.alert('Erreur', e.message);
          }
        },
      },
    ]);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alertes</Text>
          <Text style={styles.subtitle}>{alerts.length} alertes actives</Text>
        </View>
        <TouchableOpacity onPress={load} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {alerts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={56} color={COLORS.success} />
              <Text style={styles.emptyText}>Aucune alerte active !</Text>
            </View>
          ) : (
            alerts.map(item => (
              <AlertCard key={item.id} item={item} onResolve={handleResolve} />
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: COLORS.background },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  title:       { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },
  subtitle:    { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  refreshBtn:  { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  list:        { paddingHorizontal: 20 },
  loader:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:        { borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, ...SHADOW.sm },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle:   { fontSize: 14, fontWeight: '700', flex: 1 },
  niveauBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  niveauText:  { fontSize: 10, fontWeight: '700' },
  cardDesc:    { fontSize: 12, color: COLORS.textSecondary, marginBottom: 10, lineHeight: 18 },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  detailLabel: { fontSize: 12, color: COLORS.textSecondary },
  detailValue: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  timeRow:     { flexDirection: 'row', alignItems: 'center' },
  timeText:    { fontSize: 11, color: COLORS.textMuted },
  actionBtn:   { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
  actionText:  { fontSize: 12, fontWeight: '700' },
  empty:       { alignItems: 'center', paddingTop: 80, gap: 14 },
  emptyText:   { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },
});
