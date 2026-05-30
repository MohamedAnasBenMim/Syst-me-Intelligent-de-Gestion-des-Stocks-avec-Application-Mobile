import { useEffect, useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { getDashboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Header        from '../components/Header';
import KPICard       from '../components/KPICard';
import AIInsightCard from '../components/AIInsightCard';
import ChartCard     from '../components/ChartCard';

// ── Menu rapide vers les autres écrans ───────────────────────
const QUICK_LINKS = [
  { icon: 'business-outline',        label: 'Dépôts',          screen: 'Warehouses',          color: '#004678' },
  { icon: 'storefront-outline',      label: 'Fournisseurs',    screen: 'Fournisseurs',        color: '#8E44AD' },
  { icon: 'swap-horizontal-outline', label: 'Transferts',      screen: 'Transferts',          color: '#00B894' },
  { icon: 'refresh-circle-outline',  label: 'Réappro.',        screen: 'Reapprovisionnement', color: '#E67E22' },
  { icon: 'bar-chart-outline',       label: 'Reporting',       screen: 'Reporting',           color: '#6C5CE7' },
  { icon: 'sparkles-outline',        label: 'IA Chat',         screen: 'IAChat',              color: '#F39C12' },
  { icon: 'notifications-outline',   label: 'Notifs',          screen: 'Notifications',       color: '#E74C3C' },
  { icon: 'pricetag-outline',        label: 'Promotions',      screen: 'Promotions',          color: '#00CEC9' },
  { icon: 'people-outline',          label: 'Utilisateurs',    screen: 'Users',               color: '#2980B9' },
];

export default function HomeScreen({ navigation }) {
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const [dash, setDash]         = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getDashboard();
      setDash(data);
    } catch { /* Garde le state précédent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Construit les KPI depuis la réponse dashboard
  const kpiItems = dash?.kpi ? [
    {
      id: '1',
      label: 'Total Produits',
      value: (dash.kpi.total_produits ?? 0).toLocaleString(),
      change: '+12%',
      icon: 'cube-outline',
      bgColor: COLORS.primaryLight,
      iconColor: COLORS.primary,
    },
    {
      id: '2',
      label: 'Alertes Stock',
      value: String(dash.kpi.total_alertes_actives ?? 0),
      badge: String(dash.kpi.total_critiques ?? 0),
      icon: 'warning-outline',
      bgColor: '#FEF5E7',
      iconColor: '#F39C12',
    },
    {
      id: '3',
      label: 'Dépôts Actifs',
      value: String(dash.kpi.total_entrepots ?? dash.kpi.total_depots ?? 0),
      badge: 'Live',
      icon: 'pulse-outline',
      bgColor: '#E6FAF6',
      iconColor: '#00B894',
    },
    {
      id: '4',
      label: 'Valeur Stock (TND)',
      value: (dash.kpi.valeur_stock_total ?? 0).toLocaleString('fr-TN', { maximumFractionDigits: 0 }),
      change: '+8%',
      icon: 'trending-up-outline',
      bgColor: '#EBF5FB',
      iconColor: '#2980B9',
    },
  ] : null;

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <Header hasNotification user={user} />

      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        {kpiItems
          ? kpiItems.map(item => <KPICard key={item.id} item={item} />)
          : [1, 2, 3, 4].map(i => <View key={i} style={styles.kpiSkeleton} />)
        }
      </View>

      {/* Menu rapide */}
      <Text style={styles.sectionTitle}>Accès rapide</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickRow}
      >
        {QUICK_LINKS.map(l => (
          <TouchableOpacity
            key={l.screen}
            style={styles.quickBtn}
            onPress={() => navigation.navigate(l.screen)}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIcon, { backgroundColor: `${l.color}18` }]}>
              <Ionicons name={l.icon} size={22} color={l.color} />
            </View>
            <Text style={styles.quickLabel}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <AIInsightCard navigation={navigation} />
      <ChartCard />

      {/* Top produits */}
      {dash?.top_produits?.length > 0 && (
        <View style={styles.topSection}>
          <Text style={styles.sectionTitle}>Top Produits</Text>
          <View style={styles.topCard}>
            {dash.top_produits.slice(0, 5).map((p, i) => (
              <View key={p.produit_id} style={[styles.topRow, i < 4 && styles.topBorder]}>
                <View style={styles.topRank}>
                  <Text style={styles.topRankText}>{i + 1}</Text>
                </View>
                <Text style={styles.topName} numberOfLines={1}>{p.produit_nom || `Produit #${p.produit_id}`}</Text>
                <Text style={styles.topQty}>{p.total_sortie ?? p.total_mouvements ?? 0} u.</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: COLORS.background },
  content:      { paddingBottom: 16 },
  kpiGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
  kpiSkeleton:  { width: '48%', height: 110, backgroundColor: COLORS.border, borderRadius: 18, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: 20, marginTop: 4, marginBottom: 12 },
  quickRow:     { paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  quickBtn:     { alignItems: 'center', width: 70 },
  quickIcon:    { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickLabel:   { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  topSection:   { marginTop: 8 },
  topCard:      { marginHorizontal: 20, backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', ...SHADOW.sm },
  topRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  topBorder:    { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topRank:      { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  topRankText:  { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  topName:      { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  topQty:       { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
});
