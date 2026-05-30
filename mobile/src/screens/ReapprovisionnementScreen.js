import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { getPrevisions, getRecommandations, sendFeedback } from '../services/api';

const URGENCE_CONFIG = {
  critique: { color: COLORS.danger,  bg: '#FDECEA', label: 'Critique', icon: 'alert-circle' },
  haute:    { color: '#E67E22',       bg: '#FEF5E7', label: 'Haute',    icon: 'warning' },
  normale:  { color: COLORS.success,  bg: '#E6FAF6', label: 'Normale',  icon: 'checkmark-circle' },
  stable:   { color: COLORS.textSecondary, bg: COLORS.background, label: 'Stable', icon: 'remove-circle-outline' },
};

const SEUIL_OPTIONS = [
  { label: '7j',  value: 7  },
  { label: '15j', value: 15 },
  { label: '30j', value: 30 },
  { label: '60j', value: 60 },
];

// ── Carte prévision ──────────────────────────────────────────
function PrevisionCard({ prev }) {
  const cfg = URGENCE_CONFIG[prev.urgence] ?? URGENCE_CONFIG.stable;
  return (
    <View style={[styles.card, SHADOW.sm]}>
      <View style={styles.cardTop}>
        <View style={[styles.urgBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={14} color={cfg.color} />
          <Text style={[styles.urgText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={styles.prodNom} numberOfLines={2}>{prev.produit_nom}</Text>
        <Text style={styles.locText}>{prev.entrepot_nom || `Dépôt #${prev.entrepot_id}`}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{prev.stock_actuel ?? '—'}</Text>
          <Text style={styles.statLabel}>Stock actuel</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: COLORS.warning }]}>{prev.seuil_min ?? '—'}</Text>
          <Text style={styles.statLabel}>Seuil min</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: COLORS.danger }]}>{prev.jours_restants != null ? `${prev.jours_restants}j` : '—'}</Text>
          <Text style={styles.statLabel}>Jours restants</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statVal, { color: COLORS.primary }]}>{prev.qte_commander ?? '—'}</Text>
          <Text style={styles.statLabel}>À commander</Text>
        </View>
      </View>
      {prev.methode && (
        <View style={styles.methodBadge}>
          <Ionicons name={prev.methode === 'prophet' ? 'analytics-outline' : 'calculator-outline'} size={11} color={COLORS.textSecondary} />
          <Text style={styles.methodText}>{prev.methode}</Text>
        </View>
      )}
    </View>
  );
}

// ── Carte recommandation IA ──────────────────────────────────
function RecommandationCard({ rec, onFeedback }) {
  const typeColor = rec.type === 'COMMANDE' ? COLORS.primary
                  : rec.type === 'promotion' || rec.type === 'PROMOTION' ? COLORS.warning
                  : COLORS.success;
  const typeIcon  = rec.type === 'COMMANDE'   ? 'cart-outline'
                  : rec.type === 'promotion'   ? 'pricetag-outline'
                  : 'flash-outline';

  return (
    <View style={[styles.recCard, SHADOW.sm]}>
      <View style={styles.recHeader}>
        <View style={[styles.recTypeBadge, { backgroundColor: typeColor + '20' }]}>
          <Ionicons name={typeIcon} size={14} color={typeColor} />
          <Text style={[styles.recTypeText, { color: typeColor }]}>{rec.type}</Text>
        </View>
        <Text style={styles.recProd} numberOfLines={1}>{rec.titre}</Text>
        <Text style={styles.recLoc}>{rec.entrepot_id ? `Dépôt #${rec.entrepot_id}` : '—'}</Text>
      </View>
      <Text style={styles.recMsg} numberOfLines={3}>{rec.contenu}</Text>
      {rec.statut === 'GENEREE' && (
        <View style={styles.feedbackRow}>
          <TouchableOpacity style={styles.fbBtn} onPress={() => onFeedback(rec.id, 'APPROUVEE')}>
            <Ionicons name="thumbs-up-outline" size={14} color={COLORS.success} />
            <Text style={[styles.fbText, { color: COLORS.success }]}>Approuver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fbBtn} onPress={() => onFeedback(rec.id, 'REJETEE')}>
            <Ionicons name="thumbs-down-outline" size={14} color={COLORS.danger} />
            <Text style={[styles.fbText, { color: COLORS.danger }]}>Rejeter</Text>
          </TouchableOpacity>
        </View>
      )}
      {rec.statut && rec.statut !== 'GENEREE' && (
        <View style={styles.statutBadge}>
          <Text style={[styles.statutText, {
            color: rec.statut === 'APPROUVEE' ? COLORS.success : rec.statut === 'REJETEE' ? COLORS.danger : COLORS.textSecondary
          }]}>{rec.statut}</Text>
        </View>
      )}
    </View>
  );
}

// ── Écran principal ──────────────────────────────────────────
export default function ReapprovisionnementScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab]           = useState('previsions'); // 'previsions' | 'recommandations'
  const [seuil, setSeuil]       = useState(30);
  const [previsions, setPrevisions]         = useState([]);
  const [recommandations, setRecommandations] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState('all'); // 'all' | 'critique' | 'haute' | 'normale'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prev, recs] = await Promise.all([
        getPrevisions(seuil),
        getRecommandations({ statut: 'GENEREE' }),
      ]);
      setPrevisions(Array.isArray(prev) ? prev : prev.previsions ?? []);
      setRecommandations(Array.isArray(recs) ? recs : recs.recommandations ?? []);
    } catch { setPrevisions([]); setRecommandations([]); }
    finally { setLoading(false); }
  }, [seuil]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function handleFeedback(id, statut) {
    try {
      await sendFeedback({ recommandation_id: id, statut });
      setRecommandations(r => r.map(x => x.id === id ? { ...x, statut } : x));
    } catch { }
  }

  const filteredPrev = filter === 'all' ? previsions : previsions.filter(p => p.urgence === filter);

  const nbCritique = previsions.filter(p => p.urgence === 'critique').length;
  const nbHaute    = previsions.filter(p => p.urgence === 'haute').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Réapprovisionnement</Text>
          <Text style={styles.subtitle}>Prévisions ML & Recommandations IA</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* KPI bar */}
      <View style={styles.kpiBar}>
        <View style={[styles.kpi, { backgroundColor: '#FDECEA' }]}>
          <Text style={[styles.kpiVal, { color: COLORS.danger }]}>{nbCritique}</Text>
          <Text style={styles.kpiLabel}>Critiques</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: '#FEF5E7' }]}>
          <Text style={[styles.kpiVal, { color: '#E67E22' }]}>{nbHaute}</Text>
          <Text style={styles.kpiLabel}>Haute urgence</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: COLORS.primaryLight }]}>
          <Text style={[styles.kpiVal, { color: COLORS.primary }]}>{recommandations.length}</Text>
          <Text style={styles.kpiLabel}>Recommandations</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'previsions' && styles.tabActive]}
          onPress={() => setTab('previsions')}
        >
          <Ionicons name="analytics-outline" size={16} color={tab === 'previsions' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.tabText, tab === 'previsions' && styles.tabTextActive]}>Prévisions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'recommandations' && styles.tabActive]}
          onPress={() => setTab('recommandations')}
        >
          <Ionicons name="bulb-outline" size={16} color={tab === 'recommandations' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.tabText, tab === 'recommandations' && styles.tabTextActive]}>IA Recommandations</Text>
        </TouchableOpacity>
      </View>

      {/* Seuil selector (prévisions seulement) */}
      {tab === 'previsions' && (
        <View style={styles.seuilRow}>
          <Text style={styles.seuilLabel}>Horizon :</Text>
          {SEUIL_OPTIONS.map(o => (
            <TouchableOpacity
              key={o.value}
              style={[styles.seuilBtn, seuil === o.value && styles.seuilBtnActive]}
              onPress={() => setSeuil(o.value)}
            >
              <Text style={[styles.seuilBtnText, seuil === o.value && styles.seuilBtnTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Filtre urgence (prévisions) */}
      {tab === 'previsions' && (
        <View style={styles.filterRow}>
          {['all', 'critique', 'haute', 'normale'].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'Tous' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Contenu */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement des données IA...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {tab === 'previsions' && (
            filteredPrev.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="analytics-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>Aucune prévision disponible</Text>
              </View>
            ) : (
              filteredPrev.map((p, i) => <PrevisionCard key={`${p.produit_id}-${p.entrepot_id}-${i}`} prev={p} />)
            )
          )}
          {tab === 'recommandations' && (
            recommandations.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="bulb-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>Aucune recommandation en attente</Text>
              </View>
            ) : (
              recommandations.map((r, i) => (
                <RecommandationCard key={r.id ?? i} rec={r} onFeedback={handleFeedback} />
              ))
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  title:        { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  subtitle:     { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  refreshBtn:   { padding: 8, borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  kpiBar:       { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 4 },
  kpi:          { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  kpiVal:       { fontSize: 20, fontWeight: '800' },
  kpiLabel:     { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  tabBar:       { flexDirection: 'row', marginHorizontal: 14, backgroundColor: COLORS.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  tabActive:    { backgroundColor: COLORS.primaryLight },
  tabText:      { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive:{ color: COLORS.primary, fontWeight: '700' },
  seuilRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 6, gap: 6 },
  seuilLabel:   { fontSize: 13, color: COLORS.textSecondary, marginRight: 4 },
  seuilBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  seuilBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  seuilBtnText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  seuilBtnTextActive: { color: COLORS.card },
  filterRow:    { flexDirection: 'row', paddingHorizontal: 14, marginBottom: 4, gap: 6 },
  filterBtn:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:   { fontSize: 12, color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.card, fontWeight: '700' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:  { fontSize: 14, color: COLORS.textSecondary },
  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:    { fontSize: 15, color: COLORS.textMuted },
  // Prévision card
  card:         { backgroundColor: COLORS.card, borderRadius: 14, marginBottom: 10, padding: 14 },
  cardTop:      { marginBottom: 10 },
  urgBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 },
  urgText:      { fontSize: 12, fontWeight: '700' },
  prodNom:      { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  locText:      { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statsRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  stat:         { alignItems: 'center', flex: 1 },
  statVal:      { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  statLabel:    { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  methodBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-end' },
  methodText:   { fontSize: 10, color: COLORS.textSecondary, fontStyle: 'italic' },
  // Recommandation card
  recCard:      { backgroundColor: COLORS.card, borderRadius: 14, marginBottom: 10, padding: 14 },
  recHeader:    { marginBottom: 8 },
  recTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 },
  recTypeText:  { fontSize: 11, fontWeight: '700' },
  recProd:      { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  recLoc:       { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  recMsg:       { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 10 },
  feedbackRow:  { flexDirection: 'row', gap: 8 },
  fbBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  fbText:       { fontSize: 13, fontWeight: '600' },
  statutBadge:  { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: COLORS.background },
  statutText:   { fontSize: 12, fontWeight: '700' },
});
