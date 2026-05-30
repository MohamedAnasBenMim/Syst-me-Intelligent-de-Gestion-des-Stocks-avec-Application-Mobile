import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { getMouvements, createMouvement, getProduits, getEntrepots } from '../services/api';

const TYPE_CFG = {
  entree:    { label: 'Entrée',    icon: 'arrow-down-circle', color: '#00B894', bg: '#E6FAF6' },
  sortie:    { label: 'Sortie',    icon: 'arrow-up-circle',   color: '#E74C3C', bg: '#FDECEA' },
  transfert: { label: 'Transfert', icon: 'swap-horizontal',   color: '#6C5CE7', bg: '#EEF0FF' },
};

const FILTERS = ['Tous', 'entree', 'sortie', 'transfert'];

// ── Mouvement Card ───────────────────────────────────────────
function MouvementCard({ item }) {
  const cfg = TYPE_CFG[item.type_mouvement] || TYPE_CFG.entree;
  const rawDate = item.date_mouvement || item.created_at;
  const date = rawDate
    ? new Date(rawDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{item.produit_nom || `Produit #${item.produit_id}`}</Text>
          <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.typeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={styles.cardSub}>
          {item.entrepot_source_nom ? `De : ${item.entrepot_source_nom}` : ''}
          {item.entrepot_source_nom && item.entrepot_dest_nom ? '  →  ' : ''}
          {item.entrepot_dest_nom && !item.entrepot_source_nom ? `Vers : ${item.entrepot_dest_nom}` : item.entrepot_dest_nom || ''}
        </Text>
        {item.motif ? <Text style={styles.cardMotif} numberOfLines={1}>{item.motif}</Text> : null}
        <View style={styles.cardBottom}>
          <Text style={styles.cardDate}>{date}</Text>
          <Text style={[styles.cardQty, { color: cfg.color }]}>
            {item.type_mouvement === 'sortie' ? '-' : '+'}{item.quantite} u.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Generic Picker Modal ─────────────────────────────────────
function PickerModal({ visible, title, items, labelKey, subKey, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = items.filter(it =>
    (it[labelKey] ?? '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.pickerSearchRow}>
            <Ionicons name="search-outline" size={15} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Rechercher..." placeholderTextColor={COLORS.textMuted}
              value={search} onChangeText={setSearch}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={it => String(it.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerItem} onPress={() => { onSelect(item); onClose(); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerItemName}>{item[labelKey]}</Text>
                  {subKey ? <Text style={styles.pickerItemSub}>{item[subKey]}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.pickerEmpty}>Aucun résultat</Text>}
            style={{ maxHeight: 320 }}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Add Mouvement Modal ──────────────────────────────────────
function AddMouvementModal({ visible, onClose, onAdded }) {
  const [type, setType]           = useState('entree');
  const [produit, setProduit]     = useState(null);
  const [entSource, setEntSource] = useState(null);
  const [entDest, setEntDest]     = useState(null);
  const [quantite, setQuantite]   = useState('');
  const [motif, setMotif]         = useState('');
  const [reference, setRef]       = useState('');
  const [loading, setLoading]     = useState(false);

  const [produits, setProduits]     = useState([]);
  const [entrepots, setEntrepots]   = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [showProdPicker, setShowProdPicker]   = useState(false);
  const [showSrcPicker, setShowSrcPicker]     = useState(false);
  const [showDestPicker, setShowDestPicker]   = useState(false);

  useEffect(() => {
    if (visible && produits.length === 0) {
      setLoadingData(true);
      Promise.all([
        getProduits({ per_page: 200 }),
        getEntrepots({ per_page: 50 }),
      ]).then(([pData, eData]) => {
        const pl = Array.isArray(pData) ? pData : (pData.produits ?? pData.items ?? []);
        const el = Array.isArray(eData) ? eData : (eData.entrepots ?? []);
        setProduits(pl);
        setEntrepots(el);
      }).catch(() => {}).finally(() => setLoadingData(false));
    }
  }, [visible]);

  function reset() {
    setType('entree'); setProduit(null); setEntSource(null);
    setEntDest(null); setQuantite(''); setMotif(''); setRef('');
  }

  async function handleSubmit() {
    if (!produit) return Alert.alert('Champ requis', 'Sélectionnez un produit.');
    if (!quantite || isNaN(parseFloat(quantite))) return Alert.alert('Champ requis', 'Quantité invalide.');
    if (type === 'entree' && !entDest) return Alert.alert('Champ requis', 'Choisissez un dépôt destination.');
    if (type === 'sortie' && !entSource) return Alert.alert('Champ requis', 'Choisissez un dépôt source.');
    if (type === 'transfert' && (!entSource || !entDest)) return Alert.alert('Champs requis', 'Source et destination obligatoires.');

    setLoading(true);
    try {
      await createMouvement({
        type_mouvement:   type,
        produit_id:       produit.id,
        quantite:         parseFloat(quantite),
        entrepot_source_id: entSource?.id ?? undefined,
        entrepot_dest_id:   entDest?.id   ?? undefined,
        motif:  motif.trim()     || undefined,
        reference: reference.trim() || undefined,
      });
      Alert.alert('Succès', 'Mouvement créé avec succès !');
      reset(); onAdded(); onClose();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  }

  const needSrc  = type === 'sortie'    || type === 'transfert';
  const needDest = type === 'entree'    || type === 'transfert';

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouveau mouvement</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Type selector */}
              <Text style={styles.fieldLabel}>Type *</Text>
              <View style={styles.typeRow}>
                {['entree', 'sortie', 'transfert'].map(t => {
                  const cfg = TYPE_CFG[t];
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, type === t && { backgroundColor: cfg.color }]}
                      onPress={() => setType(t)}
                    >
                      <Ionicons name={cfg.icon} size={16} color={type === t ? '#fff' : cfg.color} />
                      <Text style={[styles.typeBtnText, { color: type === t ? '#fff' : cfg.color }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {loadingData ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 12 }} />
              ) : (
                <>
                  {/* Produit */}
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Produit *</Text>
                    <TouchableOpacity style={[styles.fieldInput, styles.selectorBtn]} onPress={() => setShowProdPicker(true)}>
                      <Text style={produit ? styles.selectorText : styles.selectorPlaceholder} numberOfLines={1}>
                        {produit ? produit.designation : 'Sélectionner un produit…'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* Source */}
                  {needSrc && (
                    <View style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>Dépôt source *</Text>
                      <TouchableOpacity style={[styles.fieldInput, styles.selectorBtn]} onPress={() => setShowSrcPicker(true)}>
                        <Text style={entSource ? styles.selectorText : styles.selectorPlaceholder} numberOfLines={1}>
                          {entSource ? entSource.nom : 'Sélectionner un dépôt…'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Destination */}
                  {needDest && (
                    <View style={styles.fieldWrap}>
                      <Text style={styles.fieldLabel}>Dépôt destination *</Text>
                      <TouchableOpacity style={[styles.fieldInput, styles.selectorBtn]} onPress={() => setShowDestPicker(true)}>
                        <Text style={entDest ? styles.selectorText : styles.selectorPlaceholder} numberOfLines={1}>
                          {entDest ? entDest.nom : 'Sélectionner un dépôt…'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Quantité */}
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Quantité *</Text>
                    <TextInput
                      style={styles.fieldInput} value={quantite} onChangeText={setQuantite}
                      placeholder="ex: 50" placeholderTextColor={COLORS.textMuted} keyboardType="numeric"
                    />
                  </View>

                  {/* Motif & Référence */}
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Motif</Text>
                    <TextInput style={styles.fieldInput} value={motif} onChangeText={setMotif}
                      placeholder="Raison du mouvement" placeholderTextColor={COLORS.textMuted} />
                  </View>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>Référence BL</Text>
                    <TextInput style={styles.fieldInput} value={reference} onChangeText={setRef}
                      placeholder="ex: BL-2026-001" placeholderTextColor={COLORS.textMuted} />
                  </View>
                </>
              )}

              <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.card} /> : <Text style={styles.submitText}>Enregistrer le mouvement</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <PickerModal visible={showProdPicker} title="Choisir un produit"
        items={produits} labelKey="designation" subKey="reference"
        onSelect={setProduit} onClose={() => setShowProdPicker(false)} />
      <PickerModal visible={showSrcPicker} title="Dépôt source"
        items={entrepots} labelKey="nom" subKey="ville"
        onSelect={setEntSource} onClose={() => setShowSrcPicker(false)} />
      <PickerModal visible={showDestPicker} title="Dépôt destination"
        items={entrepots} labelKey="nom" subKey="ville"
        onSelect={setEntDest} onClose={() => setShowDestPicker(false)} />
    </>
  );
}

// ── Main Screen ──────────────────────────────────────────────
export default function MovementsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [mouvements, setMouvements] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Tous');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [showModal, setShowModal]   = useState(false);

  const load = useCallback(async (p = 1, filter = activeFilter) => {
    try {
      const params = { page: p, per_page: 20 };
      if (filter !== 'Tous') params.type_mouvement = filter;
      const data = await getMouvements(params);
      const list = Array.isArray(data) ? data : (data.mouvements ?? []);
      setTotal(data.total ?? list.length);
      if (p === 1) setMouvements(list);
      else setMouvements(prev => [...prev, ...list]);
    } catch { }
  }, [activeFilter]);

  useEffect(() => {
    setPage(1);
    load(1, activeFilter).finally(() => setLoading(false));
  }, [activeFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); setPage(1);
    await load(1, activeFilter);
    setRefreshing(false);
  }, [load, activeFilter]);

  const loadMore = () => {
    if (mouvements.length < total) {
      const next = page + 1;
      setPage(next);
      load(next, activeFilter);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mouvements</Text>
          <Text style={styles.subtitle}>{total} mouvements</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={22} color={COLORS.card} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow} style={{ maxHeight: 50 }}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f}
            style={[styles.pill, activeFilter === f && styles.pillActive]}
            onPress={() => setActiveFilter(f)}>
            <Text style={[styles.pillText, activeFilter === f && styles.pillTextActive]}>
              {f === 'Tous' ? 'Tous' : TYPE_CFG[f]?.label ?? f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          onMomentumScrollEnd={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 40) loadMore();
          }}
          scrollEventThrottle={400}
        >
          {mouvements.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="swap-horizontal-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucun mouvement trouvé</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowModal(true)}>
                <Text style={styles.emptyBtnText}>+ Créer un mouvement</Text>
              </TouchableOpacity>
            </View>
          ) : (
            mouvements.map((m, i) => <MouvementCard key={`${m.id}-${i}`} item={m} />)
          )}
          {mouvements.length < total && (
            <View style={styles.loadMore}><ActivityIndicator size="small" color={COLORS.primary} /></View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <AddMouvementModal visible={showModal} onClose={() => setShowModal(false)}
        onAdded={() => { setPage(1); load(1, activeFilter); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:             { flex: 1, backgroundColor: COLORS.background },
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10, gap: 12 },
  backBtn:            { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  title:              { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitle:           { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn:             { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  filterRow:          { paddingHorizontal: 20, gap: 8, alignItems: 'center', paddingBottom: 10 },
  pill:               { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  pillActive:         { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText:           { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  pillTextActive:     { color: COLORS.card },
  list:               { paddingHorizontal: 20 },
  loader:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:               { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10, ...SHADOW.sm },
  iconBox:            { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardContent:        { flex: 1 },
  cardTop:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName:           { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  typeBadge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  typeText:           { fontSize: 11, fontWeight: '700' },
  cardSub:            { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2 },
  cardMotif:          { fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic', marginBottom: 4 },
  cardBottom:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate:           { fontSize: 11, color: COLORS.textMuted },
  cardQty:            { fontSize: 14, fontWeight: '800' },
  empty:              { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:          { fontSize: 15, color: COLORS.textSecondary },
  emptyBtn:           { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText:       { color: COLORS.card, fontWeight: '700', fontSize: 14 },
  loadMore:           { alignItems: 'center', paddingVertical: 16 },
  // Modal
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll:        { justifyContent: 'flex-end', flexGrow: 1 },
  modalCard:          { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:         { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  typeRow:            { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border },
  typeBtnText:        { fontSize: 12, fontWeight: '700' },
  fieldWrap:          { marginBottom: 14 },
  fieldLabel:         { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  fieldInput:         { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  selectorBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorText:       { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  selectorPlaceholder:{ fontSize: 14, color: COLORS.textMuted, flex: 1 },
  submitBtn:          { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitText:         { fontSize: 16, fontWeight: '700', color: COLORS.card },
  // Picker
  pickerOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerCard:         { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  pickerHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pickerTitle:        { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  pickerSearchRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  pickerSearchInput:  { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  pickerItem:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerItemName:     { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  pickerItemSub:      { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  pickerEmpty:        { textAlign: 'center', color: COLORS.textMuted, paddingVertical: 24 },
});
