import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { getKpi, getPrevisionsML, getRapports, createRapport } from '../services/api';

const TYPE_RAPPORT = [
  { key: 'journalier',    label: 'Journalier',    icon: 'today-outline' },
  { key: 'hebdomadaire',  label: 'Hebdomadaire',  icon: 'calendar-outline' },
  { key: 'mensuel',       label: 'Mensuel',        icon: 'stats-chart-outline' },
  { key: 'personnalise',  label: 'Personnalisé',   icon: 'options-outline' },
];

function KpiRow({ label, value, icon, color }) {
  return (
    <View style={styles.kpiRow}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function PrevisionCard({ item }) {
  const rupture = item.rupture_dans_periode ?? false;
  return (
    <View style={styles.prevCard}>
      <Text style={styles.prevName} numberOfLines={1}>
        {item.produit_nom || `Produit #${item.produit_id}`}
      </Text>
      <View style={styles.prevRow}>
        <View style={styles.prevStat}>
          <Text style={styles.prevVal}>{item.quantite_prevue != null ? Math.round(item.quantite_prevue) : '—'}</Text>
          <Text style={styles.prevLabel}>Prévu</Text>
        </View>
        <View style={styles.prevStat}>
          <Text style={[styles.prevVal, { color: rupture ? '#E74C3C' : '#00B894' }]}>{rupture ? 'Risque' : 'OK'}</Text>
          <Text style={styles.prevLabel}>Statut</Text>
        </View>
        <View style={styles.prevStat}>
          <Text style={styles.prevVal}>{item.jours_avant_rupture != null ? `${item.jours_avant_rupture}j` : '—'}</Text>
          <Text style={styles.prevLabel}>Avant rupture</Text>
        </View>
        <View style={styles.prevStat}>
          <Text style={styles.prevVal}>{item.confiance != null ? `${Math.round(item.confiance * 100)}%` : '—'}</Text>
          <Text style={styles.prevLabel}>Confiance</Text>
        </View>
      </View>
      {item.recommandation ? <Text style={styles.prevReco} numberOfLines={2}>{item.recommandation}</Text> : null}
    </View>
  );
}

function RapportCard({ item }) {
  const date = item.created_at
    ? new Date(item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const typeInfo = TYPE_RAPPORT.find(t => t.key === item.type_rapport) || TYPE_RAPPORT[2];
  const donnees = item.donnees_json ? JSON.parse(item.donnees_json) : {};

  return (
    <View style={styles.rapportCard}>
      <View style={styles.rapportTop}>
        <View style={styles.rapportIconBox}>
          <Ionicons name={typeInfo.icon} size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rapportTitre} numberOfLines={1}>{item.titre || `Rapport ${typeInfo.label}`}</Text>
          <Text style={styles.rapportDate}>{date}</Text>
        </View>
        <View style={[styles.rapportBadge, { backgroundColor: item.statut === 'termine' ? '#E6FAF6' : '#FEF5E7' }]}>
          <Text style={[styles.rapportBadgeText, { color: item.statut === 'termine' ? '#00B894' : '#F39C12' }]}>
            {item.statut === 'termine' ? 'Terminé' : item.statut}
          </Text>
        </View>
      </View>
      {Object.keys(donnees).length > 0 && (
        <View style={styles.rapportData}>
          {donnees.total_produits    != null && <Text style={styles.rapportDataText}>Produits : {donnees.total_produits}</Text>}
          {donnees.total_entrepots   != null && <Text style={styles.rapportDataText}>Entrepôts : {donnees.total_entrepots}</Text>}
          {donnees.total_alertes_actives != null && <Text style={styles.rapportDataText}>Alertes : {donnees.total_alertes_actives}</Text>}
          {donnees.description && <Text style={styles.rapportDataDesc} numberOfLines={2}>{donnees.description}</Text>}
        </View>
      )}
    </View>
  );
}

// ── Generate Report Modal ────────────────────────────────────
function GenererRapportModal({ visible, onClose, onGenerated }) {
  const [type, setType]     = useState('journalier');
  const [titre, setTitre]   = useState('');
  const [desc, setDesc]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      await createRapport({
        type_rapport: type,
        titre: titre.trim() || undefined,
        description: desc.trim() || undefined,
      });
      Alert.alert('Succès', 'Rapport généré avec succès !');
      setTitre(''); setDesc('');
      onGenerated();
      onClose();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Générer un rapport</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Type de rapport *</Text>
          <View style={styles.typeGrid}>
            {TYPE_RAPPORT.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, type === t.key && styles.typeBtnActive]}
                onPress={() => setType(t.key)}
              >
                <Ionicons name={t.icon} size={18} color={type === t.key ? COLORS.card : COLORS.primary} />
                <Text style={[styles.typeBtnText, type === t.key && { color: COLORS.card }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Titre (optionnel)</Text>
            <TextInput style={styles.fieldInput} value={titre} onChangeText={setTitre}
              placeholder="Rapport mensuel avril 2026" placeholderTextColor={COLORS.textMuted} />
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput style={[styles.fieldInput, { height: 72, textAlignVertical: 'top' }]}
              value={desc} onChangeText={setDesc} multiline
              placeholder="Résumé de la période..." placeholderTextColor={COLORS.textMuted} />
          </View>

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.card} /> : <Text style={styles.submitText}>Générer le rapport</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────
export default function ReportingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [kpi, setKpi]           = useState(null);
  const [previsions, setPrev]   = useState([]);
  const [rapports, setRapports] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);

  const load = useCallback(async () => {
    try {
      const [kData, pData, rData] = await Promise.all([
        getKpi().catch(() => null),
        getPrevisionsML({ per_page: 20 }).catch(() => []),
        getRapports().catch(() => []),
      ]);
      if (kData) setKpi(kData);
      const list = Array.isArray(pData) ? pData : (pData.previsions ?? []);
      setPrev(list);
      const rlist = Array.isArray(rData) ? rData : [];
      setRapports(rlist);
    } catch { }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Reporting</Text>
          <Text style={styles.subtitle}>KPI · Prévisions ML · Rapports</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={22} color={COLORS.card} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {/* KPI */}
          {kpi && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>KPI Globaux</Text>
              <View style={styles.kpiCard}>
                <KpiRow label="Total produits"        value={(kpi.total_produits ?? 0).toLocaleString()}      icon="cube-outline"           color={COLORS.primary} />
                <KpiRow label="Valeur stock (TND)"    value={kpi.valeur_stock_total != null ? kpi.valeur_stock_total.toLocaleString('fr-TN', { maximumFractionDigits: 0 }) : '—'} icon="cash-outline" color="#00B894" />
                <KpiRow label="Alertes actives"       value={String(kpi.total_alertes_actives ?? 0)}           icon="warning-outline"        color="#F39C12" />
                <KpiRow label="Alertes critiques"     value={String(kpi.total_critiques ?? 0)}                 icon="alert-circle-outline"   color="#E74C3C" />
                <KpiRow label="Entrepôts"             value={String(kpi.total_entrepots ?? 0)}                 icon="business-outline"       color="#6C5CE7" />
                <KpiRow label="Stocks actifs"         value={String(kpi.total_stocks_actifs ?? 0)}             icon="layers-outline"         color="#2980B9" />
                <KpiRow label="Mouvements du jour"    value={String(kpi.total_mouvements_jour ?? 0)}           icon="swap-horizontal-outline" color="#00CEC9" />
                <KpiRow label="Produits en rupture"   value={String(kpi.total_ruptures ?? 0)}                  icon="remove-circle-outline"  color="#E74C3C" />
                <KpiRow label="Taux occupation moy."  value={kpi.taux_occupation_moyen != null ? `${kpi.taux_occupation_moyen.toFixed(1)}%` : '—'} icon="analytics-outline" color="#6C5CE7" />
              </View>
            </View>
          )}

          {/* Prévisions ML */}
          {previsions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prévisions ML</Text>
              {previsions.map((p, i) => <PrevisionCard key={`${p.produit_id}-${i}`} item={p} />)}
            </View>
          )}

          {/* Rapports générés */}
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Rapports générés</Text>
              <TouchableOpacity style={styles.genBtn} onPress={() => setShowModal(true)}>
                <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                <Text style={styles.genBtnText}> Générer</Text>
              </TouchableOpacity>
            </View>
            {rapports.length === 0 ? (
              <View style={styles.rapportEmpty}>
                <Ionicons name="document-outline" size={36} color={COLORS.border} />
                <Text style={styles.rapportEmptyText}>Aucun rapport — appuyez sur « Générer »</Text>
              </View>
            ) : (
              rapports.map((r, i) => <RapportCard key={`${r.id}-${i}`} item={r} />)
            )}
          </View>

          {!kpi && previsions.length === 0 && rapports.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="bar-chart-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune donnée disponible</Text>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <GenererRapportModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onGenerated={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: COLORS.background },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:         { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  title:           { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitle:        { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn:          { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  loader:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content:         { paddingHorizontal: 20 },
  section:         { marginBottom: 24 },
  sectionTitle:    { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  sectionRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  genBtn:          { flexDirection: 'row', alignItems: 'center' },
  genBtnText:      { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  kpiCard:         { backgroundColor: COLORS.card, borderRadius: 18, overflow: 'hidden', ...SHADOW.sm },
  kpiRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  kpiIcon:         { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  kpiLabel:        { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  kpiValue:        { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  prevCard:        { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10, ...SHADOW.sm },
  prevName:        { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  prevRow:         { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: COLORS.background, borderRadius: 12, padding: 10, marginBottom: 8 },
  prevStat:        { alignItems: 'center' },
  prevVal:         { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  prevLabel:       { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  prevReco:        { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  rapportCard:     { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10, ...SHADOW.sm },
  rapportTop:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rapportIconBox:  { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  rapportTitre:    { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  rapportDate:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  rapportBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  rapportBadgeText:{ fontSize: 11, fontWeight: '700' },
  rapportData:     { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 4 },
  rapportDataText: { fontSize: 12, color: COLORS.textSecondary },
  rapportDataDesc: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 2 },
  rapportEmpty:    { alignItems: 'center', paddingVertical: 24, gap: 8 },
  rapportEmptyText:{ fontSize: 13, color: COLORS.textSecondary },
  empty:           { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:       { fontSize: 15, color: COLORS.textSecondary },
  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:       { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  typeGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  typeBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border, minWidth: '45%' },
  typeBtnActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText:     { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  fieldWrap:       { marginBottom: 14 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  fieldInput:      { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  submitBtn:       { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitText:      { fontSize: 16, fontWeight: '700', color: COLORS.card },
});
