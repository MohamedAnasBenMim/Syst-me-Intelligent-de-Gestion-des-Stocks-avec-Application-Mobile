import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { getProduits, createProduit } from '../services/api';

function getStatus(seuil_min, _seuil_max, quantite) {
  if (quantite <= 0) return 'out';
  if (seuil_min && quantite <= seuil_min) return 'low';
  return 'in_stock';
}

const STATUS_MAP = {
  in_stock: { label: 'En stock',    bg: '#E6FAF6', text: '#00B894' },
  low:      { label: 'Stock faible', bg: '#FEF5E7', text: '#F39C12' },
  out:      { label: 'Rupture',      bg: '#FDECEA', text: '#E74C3C' },
};

function getExpirationInfo(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  exp.setHours(0, 0, 0, 0);
  const diffDays = Math.round((exp - today) / 86400000);
  if (diffDays < 0)  return { label: 'Expiré',          bg: '#FDECEA', text: '#E74C3C' };
  if (diffDays <= 7) return { label: `Expire dans ${diffDays}j`, bg: '#FDECEA', text: '#E74C3C' };
  if (diffDays <= 30) return { label: `Expire dans ${diffDays}j`, bg: '#FEF5E7', text: '#F39C12' };
  return { label: `Exp: ${exp.toLocaleDateString('fr-FR')}`, bg: '#E6FAF6', text: '#00B894' };
}

function ProductCard({ item }) {
  const qty = item.quantite_totale ?? item.stock_actuel ?? 0;
  const statusKey = getStatus(item.seuil_alerte_min, item.seuil_alerte_max, qty);
  const status = STATUS_MAP[statusKey];
  const expInfo = getExpirationInfo(item.date_expiration);

  return (
    <TouchableOpacity style={styles.productCard} activeOpacity={0.85}>
      <View style={styles.emojiBox}>
        <Ionicons name="cube-outline" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.designation}</Text>
        <Text style={styles.productSku}>Réf: {item.reference}</Text>
        <View style={styles.catRow}>
          <Ionicons name="pricetag-outline" size={12} color={COLORS.textSecondary} />
          <Text style={styles.catText}> {item.categorie || 'Général'}</Text>
          {item.prix_unitaire != null && (
            <Text style={styles.priceText}>  {item.prix_unitaire.toFixed(2)} TND</Text>
          )}
        </View>
        {item.date_fabrication && (
          <View style={styles.fabRow}>
            <Ionicons name="hammer-outline" size={10} color={COLORS.textMuted} />
            <Text style={styles.fabText}> Fab: {new Date(item.date_fabrication).toLocaleDateString('fr-FR')}</Text>
          </View>
        )}
        {expInfo && (
          <View style={[styles.expBadge, { backgroundColor: expInfo.bg }]}>
            <Ionicons name="time-outline" size={10} color={expInfo.text} />
            <Text style={[styles.expText, { color: expInfo.text }]}> {expInfo.label}</Text>
          </View>
        )}
      </View>
      <View style={styles.productRight}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
        </View>
        {item.en_promotion && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoText}>PROMO</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function AddModal({ visible, onClose, onAdded }) {
  const [designation, setDesignation] = useState('');
  const [reference, setReference]     = useState('');
  const [categorie, setCategorie]     = useState('');
  const [prix, setPrix]               = useState('');
  const [seuil_min, setSeuilMin]      = useState('');
  const [unite, setUnite]             = useState('unité');
  const [dateExp, setDateExp]         = useState('');
  const [dateFab, setDateFab]         = useState('');
  const [loading, setLoading]         = useState(false);

  function parseDate(str) {
    if (!str) return undefined;
    if (str.includes('-')) return str;
    const parts = str.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    return str;
  }

  function reset() {
    setDesignation(''); setReference(''); setCategorie('');
    setPrix(''); setSeuilMin(''); setUnite('unité'); setDateExp(''); setDateFab('');
  }

  async function handleSubmit() {
    if (!designation.trim() || !reference.trim()) {
      Alert.alert('Champs requis', 'Désignation et référence sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      await createProduit({
        designation: designation.trim(),
        reference: reference.trim(),
        categorie: categorie.trim() || undefined,
        prix_unitaire: prix ? parseFloat(prix) : 0,
        seuil_alerte_min: seuil_min ? parseFloat(seuil_min) : 0,
        seuil_alerte_max: seuil_min ? parseFloat(seuil_min) * 3 : 100,
        unite_mesure: unite.trim() || 'unité',
        date_expiration:  parseDate(dateExp) || undefined,
        date_fabrication: parseDate(dateFab) || undefined,
      });
      Alert.alert('Succès', 'Produit créé avec succès !');
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau produit</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {[
              { label: 'Désignation *', value: designation, set: setDesignation, placeholder: 'Nom du produit' },
              { label: 'Référence *',   value: reference,   set: setReference,   placeholder: 'REF-001' },
              { label: 'Catégorie',     value: categorie,   set: setCategorie,   placeholder: 'Alimentaire' },
              { label: 'Prix unitaire (TND)', value: prix,  set: setPrix,        placeholder: '0.00', keyboard: 'decimal-pad' },
              { label: 'Seuil alerte min', value: seuil_min, set: setSeuilMin,   placeholder: '10', keyboard: 'numeric' },
              { label: 'Unité de mesure', value: unite,     set: setUnite,       placeholder: 'unité' },
              { label: 'Date de fabrication', value: dateFab, set: setDateFab,  placeholder: 'jj/mm/aaaa', keyboard: 'numeric' },
              { label: "Date d'expiration",  value: dateExp, set: setDateExp,   placeholder: 'jj/mm/aaaa', keyboard: 'numeric' },
            ].map(f => (
              <View key={f.label} style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={f.value}
                  onChangeText={f.set}
                  placeholder={f.placeholder}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={f.keyboard || 'default'}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={COLORS.card} />
                : <Text style={styles.submitText}>Créer le produit</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const [produits, setProduits]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [categories, setCategories] = useState(['Tous']);
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [showModal, setShowModal]   = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getProduits({ per_page: 200 });
      const list = Array.isArray(data) ? data : (data.produits ?? data.items ?? []);
      setProduits(list);
      const cats = ['Tous', ...new Set(list.map(p => p.categorie).filter(Boolean))];
      setCategories(cats);
    } catch { }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = produits.filter(p =>
    (activeCategory === 'Tous' || p.categorie === activeCategory) &&
    (p.designation ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Inventaire</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={22} color={COLORS.card} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={17} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher produit ou référence..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.pill, activeCategory === cat && styles.pillActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.pillText, activeCategory === cat && styles.pillTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.countRow}>
        <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} />
        <Text style={styles.countText}> {filtered.length} produits</Text>
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucun produit trouvé</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowModal(true)}>
                <Text style={styles.emptyBtnText}>+ Ajouter un produit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map(item => <ProductCard key={item.id} item={item} />)
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
  screen:          { flex: 1, backgroundColor: COLORS.background },
  pageHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  pageTitle:       { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },
  addBtn:          { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  searchRow:       { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: COLORS.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14, ...SHADOW.sm },
  searchIcon:      { marginRight: 8 },
  searchInput:     { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  categoryScroll:  { maxHeight: 46, marginBottom: 12 },
  categoryContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  pill:            { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  pillActive:      { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText:        { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  pillTextActive:  { color: COLORS.card },
  countRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  countText:       { fontSize: 13, color: COLORS.textSecondary },
  listContent:     { paddingHorizontal: 20 },
  productCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10, ...SHADOW.sm },
  emojiBox:        { width: 50, height: 50, borderRadius: 14, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  productInfo:     { flex: 1 },
  productName:     { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  productSku:      { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  catRow:          { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  catText:         { fontSize: 11, color: COLORS.textSecondary },
  priceText:       { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  fabRow:          { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  fabText:         { fontSize: 10, color: COLORS.textMuted },
  expBadge:        { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  expText:         { fontSize: 10, fontWeight: '600' },
  productRight:    { alignItems: 'flex-end', gap: 4 },
  statusBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText:      { fontSize: 11, fontWeight: '700' },
  promoBadge:      { backgroundColor: '#E74C3C', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  promoText:       { fontSize: 9, fontWeight: '800', color: '#fff' },
  loader:          { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  empty:           { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:       { fontSize: 15, color: COLORS.textSecondary },
  emptyBtn:        { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText:    { color: COLORS.card, fontWeight: '700', fontSize: 14 },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll:     { justifyContent: 'flex-end', flexGrow: 1 },
  modalCard:       { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  fieldWrap:       { marginBottom: 14 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  fieldInput:      { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  submitBtn:       { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitText:      { fontSize: 16, fontWeight: '700', color: COLORS.card },
});
