import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { getPromotions, createPromotion, getProduits } from '../services/api';

function PromoCard({ item }) {
  const debut = item.date_debut ? new Date(item.date_debut).toLocaleDateString('fr-FR') : '—';
  const fin   = item.date_fin   ? new Date(item.date_fin).toLocaleDateString('fr-FR')   : '—';
  const isActive = item.est_active !== false;

  return (
    <View style={[styles.card, !isActive && styles.cardInactive]}>
      <View style={styles.cardTop}>
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{item.pourcentage_reduction ?? 0}%</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.produit_nom || `Produit #${item.produit_id}`}
          </Text>
          <Text style={styles.cardSub}>{item.motif || item.description || 'Promotion active'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? '#E6FAF6' : COLORS.border }]}>
          <Text style={[styles.statusText, { color: isActive ? '#00B894' : COLORS.textSecondary }]}>
            {isActive ? 'Active' : 'Inactif'}
          </Text>
        </View>
      </View>

      <View style={styles.dateRow}>
        <View style={styles.dateBox}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
          <Text style={styles.dateText}> Du {debut}</Text>
        </View>
        <View style={styles.dateBox}>
          <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
          <Text style={styles.dateText}> Au {fin}</Text>
        </View>
      </View>

      {item.prix_initial != null && item.prix_promo != null && (
        <View style={styles.priceRow}>
          <Text style={styles.priceOld}>{item.prix_initial.toFixed(2)} TND</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.textMuted} />
          <Text style={styles.priceNew}>{item.prix_promo.toFixed(2)} TND</Text>
        </View>
      )}
    </View>
  );
}

// ── Product Picker Modal ─────────────────────────────────────
function ProductPickerModal({ visible, produits, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = produits.filter(p =>
    (p.designation ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.reference ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Choisir un produit</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.pickerSearchRow}>
            <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Rechercher..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerItem} onPress={() => { onSelect(item); onClose(); }}>
                <View>
                  <Text style={styles.pickerItemName}>{item.designation}</Text>
                  <Text style={styles.pickerItemSub}>Réf: {item.reference}  {item.prix_unitaire != null ? `— ${item.prix_unitaire.toFixed(2)} TND` : ''}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.pickerEmpty}>
                <Text style={styles.pickerEmptyText}>Aucun produit trouvé</Text>
              </View>
            }
            style={{ maxHeight: 340 }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Add Promotion Modal ──────────────────────────────────────
function AddModal({ visible, onClose, onAdded }) {
  const [produit, setProduit]     = useState(null);
  const [produits, setProduits]   = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pourcent, setPourcent]   = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin]     = useState('');
  const [motif, setMotif]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [loadingProd, setLoadingProd] = useState(false);

  useEffect(() => {
    if (visible && produits.length === 0) {
      setLoadingProd(true);
      getProduits({ per_page: 200 })
        .then(data => {
          const list = Array.isArray(data) ? data : (data.produits ?? data.items ?? []);
          setProduits(list);
        })
        .catch(() => {})
        .finally(() => setLoadingProd(false));
    }
  }, [visible]);

  function reset() {
    setProduit(null); setPourcent(''); setDateDebut('');
    setDateFin(''); setMotif('');
  }

  // Format: "dd/mm/yyyy" → "yyyy-mm-dd"
  function parseDate(str) {
    if (!str) return undefined;
    if (str.includes('-')) return str; // already ISO
    const parts = str.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    return str;
  }

  async function handleSubmit() {
    if (!produit) {
      Alert.alert('Champ requis', 'Veuillez sélectionner un produit.');
      return;
    }
    if (!pourcent || isNaN(parseFloat(pourcent))) {
      Alert.alert('Champ requis', 'Veuillez saisir un pourcentage de réduction valide.');
      return;
    }
    if (!dateDebut || !dateFin) {
      Alert.alert('Champs requis', 'Les dates de début et fin sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      await createPromotion({
        produit_id: produit.id,
        pourcentage_reduction: parseFloat(pourcent),
        date_debut: parseDate(dateDebut),
        date_fin: parseDate(dateFin),
        motif: motif.trim() || undefined,
      });
      Alert.alert('Succès', 'Promotion créée avec succès !');
      reset();
      onAdded();
      onClose();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle promotion</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Product selector */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Produit *</Text>
                <TouchableOpacity
                  style={[styles.fieldInput, styles.selectorBtn]}
                  onPress={() => setShowPicker(true)}
                >
                  {loadingProd ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : produit ? (
                    <Text style={styles.selectorText} numberOfLines={1}>{produit.designation}</Text>
                  ) : (
                    <Text style={styles.selectorPlaceholder}>Sélectionner un produit…</Text>
                  )}
                  <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Reduction % */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Réduction (%) *</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={pourcent}
                  onChangeText={setPourcent}
                  placeholder="ex: 20"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Dates */}
              <View style={styles.dateFields}>
                <View style={[styles.fieldWrap, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.fieldLabel}>Date début *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={dateDebut}
                    onChangeText={setDateDebut}
                    placeholder="jj/mm/aaaa"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Date fin *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={dateFin}
                    onChangeText={setDateFin}
                    placeholder="jj/mm/aaaa"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Motif */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Motif / Description</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={motif}
                  onChangeText={setMotif}
                  placeholder="Soldes d'été, promotion spéciale..."
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.card} />
                  : <Text style={styles.submitText}>Créer la promotion</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <ProductPickerModal
        visible={showPicker}
        produits={produits}
        onSelect={setProduit}
        onClose={() => setShowPicker(false)}
      />
    </>
  );
}

// ── Main Screen ──────────────────────────────────────────────
export default function PromotionsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [promos, setPromos]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal]   = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getPromotions({ per_page: 50 });
      const list = Array.isArray(data) ? data : (data.promotions ?? data.items ?? []);
      setPromos(list);
    } catch { }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Promotions</Text>
          <Text style={styles.subtitle}>{promos.length} promotion{promos.length !== 1 ? 's' : ''}</Text>
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
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {promos.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="pricetag-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune promotion</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowModal(true)}>
                <Text style={styles.emptyBtnText}>+ Créer une promotion</Text>
              </TouchableOpacity>
            </View>
          ) : (
            promos.map((p, i) => <PromoCard key={`${p.id}-${i}`} item={p} />)
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <AddModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onAdded={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:             { flex: 1, backgroundColor: COLORS.background },
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:            { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  title:              { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitle:           { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn:             { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  list:               { paddingHorizontal: 20 },
  loader:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:               { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, marginBottom: 12, ...SHADOW.sm },
  cardInactive:       { opacity: 0.65 },
  cardTop:            { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  discountBadge:      { width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  discountText:       { fontSize: 14, fontWeight: '900', color: COLORS.card },
  cardInfo:           { flex: 1 },
  cardName:           { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  cardSub:            { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText:         { fontSize: 11, fontWeight: '700' },
  dateRow:            { flexDirection: 'row', gap: 16, marginBottom: 10 },
  dateBox:            { flexDirection: 'row', alignItems: 'center' },
  dateText:           { fontSize: 12, color: COLORS.textSecondary },
  priceRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.background, borderRadius: 10, padding: 10 },
  priceOld:           { fontSize: 14, color: COLORS.textMuted, textDecorationLine: 'line-through' },
  priceNew:           { fontSize: 16, fontWeight: '800', color: '#00B894' },
  empty:              { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:          { fontSize: 15, color: COLORS.textSecondary },
  emptyBtn:           { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText:       { color: COLORS.card, fontWeight: '700', fontSize: 14 },
  // Modal
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll:        { justifyContent: 'flex-end', flexGrow: 1 },
  modalCard:          { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:         { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  fieldWrap:          { marginBottom: 14 },
  fieldLabel:         { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  fieldInput:         { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  selectorBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorText:       { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  selectorPlaceholder:{ fontSize: 14, color: COLORS.textMuted, flex: 1 },
  dateFields:         { flexDirection: 'row' },
  submitBtn:          { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitText:         { fontSize: 16, fontWeight: '700', color: COLORS.card },
  // Product Picker Modal
  pickerOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerCard:         { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  pickerHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pickerTitle:        { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  pickerSearchRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  pickerSearchInput:  { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  pickerItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerItemName:     { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  pickerItemSub:      { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  pickerEmpty:        { alignItems: 'center', paddingVertical: 24 },
  pickerEmptyText:    { fontSize: 14, color: COLORS.textSecondary },
});
