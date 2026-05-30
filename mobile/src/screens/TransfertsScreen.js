import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Modal,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import {
  getDepots, getMagasins, getProduits, getStocks,
  transfererDepotVersMagasin, transfererMagasinVersDepot, transfererEntreMagasins,
} from '../services/api';

const TYPES = [
  { key: 'depot_magasin', label: 'Dépôt → Magasin', icon: 'arrow-forward-circle-outline', color: COLORS.primary },
  { key: 'magasin_depot', label: 'Magasin → Dépôt', icon: 'arrow-back-circle-outline', color: COLORS.success },
  { key: 'magasin_magasin', label: 'Magasin → Magasin', icon: 'swap-horizontal-outline', color: COLORS.warning },
];

// ── Sélecteur dropdown simple ────────────────────────────────
function Dropdown({ label, items, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const selected = items.find(i => i.id === value);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.dropdown} onPress={() => setOpen(true)}>
        <Text style={[styles.dropdownText, !selected && { color: COLORS.textMuted }]}>
          {selected ? `${selected.nom} (${selected.code ?? selected.reference ?? ''})` : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dropOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.dropBox}>
            <Text style={styles.dropTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {items.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.dropItem, item.id === value && styles.dropItemActive]}
                  onPress={() => { onChange(item.id); setOpen(false); }}
                >
                  <Text style={[styles.dropItemText, item.id === value && { color: COLORS.primary, fontWeight: '700' }]}>
                    {item.nom}
                  </Text>
                  <Text style={styles.dropItemSub}>{item.code ?? item.reference ?? ''}</Text>
                </TouchableOpacity>
              ))}
              {items.length === 0 && <Text style={styles.dropEmpty}>Aucun élément disponible</Text>}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Écran principal ──────────────────────────────────────────
export default function TransfertsScreen() {
  const insets = useSafeAreaInsets();

  const [step, setStep]       = useState(0); // 0=type, 1=form, 2=confirm
  const [typeKey, setTypeKey] = useState(null);

  // Data
  const [depots, setDepots]     = useState([]);
  const [magasins, setMagasins] = useState([]);
  const [produits, setProduits] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [stockDispo, setStockDispo] = useState(null);

  // Formulaire
  const [sourceId, setSourceId]   = useState(null);
  const [destId, setDestId]       = useState(null);
  const [produitId, setProduitId] = useState(null);
  const [quantite, setQuantite]   = useState('');
  const [reference, setReference] = useState('');
  const [motif, setMotif]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, m, p] = await Promise.all([getDepots(), getMagasins(), getProduits()]);
      setDepots(Array.isArray(d) ? d : d.depots ?? []);
      setMagasins(Array.isArray(m) ? m : m.magasins ?? []);
      setProduits(Array.isArray(p) ? p : p.produits ?? []);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Charger le stock disponible quand source + produit sont sélectionnés
  useEffect(() => {
    if (!sourceId || !produitId) { setStockDispo(null); return; }
    getStocks({ produit_id: produitId, entrepot_id: sourceId })
      .then(data => {
        const list = Array.isArray(data) ? data : data.stocks ?? [];
        const total = list.reduce((s, x) => s + (x.quantite ?? 0), 0);
        setStockDispo(total);
      })
      .catch(() => setStockDispo(null));
  }, [sourceId, produitId]);

  function reset() {
    setStep(0); setTypeKey(null);
    setSourceId(null); setDestId(null); setProduitId(null);
    setQuantite(''); setReference(''); setMotif('');
    setStockDispo(null);
  }

  async function submit() {
    if (!sourceId || !destId || !produitId || !quantite) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    const qte = parseFloat(quantite);
    if (isNaN(qte) || qte <= 0) { Alert.alert('Quantité invalide', 'Entrez une quantité positive.'); return; }
    if (stockDispo !== null && qte > stockDispo) {
      Alert.alert('Stock insuffisant', `Stock disponible : ${stockDispo} unités`); return;
    }
    setSubmitting(true);
    try {
      const payload = {
        source_id: sourceId,
        destination_id: destId,
        produit_id: produitId,
        quantite: qte,
        reference_externe: reference.trim() || undefined,
        motif: motif.trim() || undefined,
      };
      if (typeKey === 'depot_magasin') await transfererDepotVersMagasin(payload);
      else if (typeKey === 'magasin_depot') await transfererMagasinVersDepot(payload);
      else await transfererEntreMagasins(payload);
      Alert.alert('Succès', 'Transfert effectué !', [{ text: 'OK', onPress: reset }]);
    } catch (e) { Alert.alert('Erreur', e.message); }
    finally { setSubmitting(false); }
  }

  // Sources et destinations selon le type
  const sources = typeKey === 'depot_magasin' ? depots
                : typeKey === 'magasin_depot' ? magasins
                : magasins;
  const dests   = typeKey === 'depot_magasin' ? magasins
                : typeKey === 'magasin_depot' ? depots
                : magasins.filter(m => m.id !== sourceId);

  const selectedType   = TYPES.find(t => t.key === typeKey);
  const selectedSource = sources.find(s => s.id === sourceId);
  const selectedDest   = dests.find(d => d.id === destId);
  const selectedProd   = produits.find(p => p.id === produitId);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Transferts</Text>
          <Text style={styles.subtitle}>Déplacer du stock entre sites</Text>
        </View>
        {step > 0 && (
          <TouchableOpacity style={styles.resetBtn} onPress={reset}>
            <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Indicateur d'étapes */}
      <View style={styles.stepBar}>
        {['Type', 'Détails', 'Confirmer'].map((s, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[styles.stepCircle, step >= i && styles.stepCircleActive]}>
              <Text style={[styles.stepNum, step >= i && styles.stepNumActive]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, step >= i && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* Étape 0 : choix du type */}
        {step === 0 && (
          <View>
            <Text style={styles.sectionTitle}>Type de transfert</Text>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeCard, typeKey === t.key && { borderColor: t.color, borderWidth: 2 }]}
                onPress={() => { setTypeKey(t.key); setStep(1); }}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIcon, { backgroundColor: t.color + '20' }]}>
                  <Ionicons name={t.icon} size={26} color={t.color} />
                </View>
                <Text style={styles.typeLabel}>{t.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Étape 1 : formulaire */}
        {step === 1 && selectedType && (
          <View>
            <View style={[styles.typeBanner, { backgroundColor: selectedType.color + '15' }]}>
              <Ionicons name={selectedType.icon} size={20} color={selectedType.color} />
              <Text style={[styles.typeBannerText, { color: selectedType.color }]}>{selectedType.label}</Text>
            </View>

            <Dropdown
              label={typeKey === 'depot_magasin' ? 'Dépôt source *' : 'Magasin source *'}
              items={sources}
              value={sourceId}
              onChange={(id) => { setSourceId(id); setProduitId(null); setStockDispo(null); }}
              placeholder="Sélectionner la source..."
            />
            <Dropdown
              label={typeKey === 'magasin_depot' ? 'Dépôt destination *' : 'Magasin destination *'}
              items={dests}
              value={destId}
              onChange={setDestId}
              placeholder="Sélectionner la destination..."
            />
            <Dropdown
              label="Produit *"
              items={produits}
              value={produitId}
              onChange={setProduitId}
              placeholder="Sélectionner un produit..."
            />

            {stockDispo !== null && (
              <View style={styles.stockInfo}>
                <Ionicons name="cube-outline" size={14} color={COLORS.success} />
                <Text style={styles.stockInfoText}>Stock disponible : <Text style={{ fontWeight: '700' }}>{stockDispo}</Text> unités</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Quantité *</Text>
            <TextInput
              style={styles.input}
              placeholder="Quantité à transférer"
              value={quantite}
              onChangeText={setQuantite}
              keyboardType="numeric"
            />
            <Text style={styles.fieldLabel}>Référence externe</Text>
            <TextInput
              style={styles.input}
              placeholder="N° bon de transfert (optionnel)"
              value={reference}
              onChangeText={setReference}
            />
            <Text style={styles.fieldLabel}>Motif</Text>
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
              placeholder="Motif du transfert (optionnel)"
              value={motif}
              onChangeText={setMotif}
              multiline
            />

            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 8 }]}
              onPress={() => {
                if (!sourceId || !destId || !produitId || !quantite) {
                  Alert.alert('Champs requis', 'Remplissez tous les champs obligatoires.'); return;
                }
                setStep(2);
              }}
            >
              <Text style={styles.btnPrimaryText}>Continuer →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 2 : confirmation */}
        {step === 2 && (
          <View>
            <View style={[styles.confirmCard, SHADOW.sm]}>
              <Text style={styles.confirmTitle}>Récapitulatif</Text>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Type</Text>
                <Text style={styles.confirmValue}>{selectedType?.label}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Source</Text>
                <Text style={styles.confirmValue}>{selectedSource?.nom ?? '—'}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Destination</Text>
                <Text style={styles.confirmValue}>{selectedDest?.nom ?? '—'}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Produit</Text>
                <Text style={styles.confirmValue}>{selectedProd?.designation ?? '—'}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>Quantité</Text>
                <Text style={[styles.confirmValue, { color: COLORS.primary, fontWeight: '700', fontSize: 16 }]}>{quantite}</Text>
              </View>
              {stockDispo !== null && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Stock restant après</Text>
                  <Text style={[styles.confirmValue, { color: parseFloat(quantite) > stockDispo ? COLORS.danger : COLORS.success }]}>
                    {stockDispo - parseFloat(quantite || 0)} unités
                  </Text>
                </View>
              )}
              {reference.trim() !== '' && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Référence</Text>
                  <Text style={styles.confirmValue}>{reference}</Text>
                </View>
              )}
              {motif.trim() !== '' && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmLabel}>Motif</Text>
                  <Text style={styles.confirmValue}>{motif}</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setStep(1)}>
                <Text style={styles.btnCancelText}>← Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={submit} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator size="small" color={COLORS.card} />
                  : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.card} />
                      <Text style={styles.btnPrimaryText}>Confirmer le transfert</Text>
                    </View>
                  )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  center:         { justifyContent: 'center', alignItems: 'center' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  title:          { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  subtitle:       { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  resetBtn:       { padding: 8, borderRadius: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  stepBar:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 24 },
  stepItem:       { alignItems: 'center', gap: 4 },
  stepCircle:     { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive:{ backgroundColor: COLORS.primary },
  stepNum:        { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  stepNumActive:  { color: COLORS.card },
  stepLabel:      { fontSize: 11, color: COLORS.textMuted },
  stepLabelActive:{ color: COLORS.primary, fontWeight: '600' },
  sectionTitle:   { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  typeCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: COLORS.border, ...StyleSheet.flatten({ shadowColor: COLORS.primary, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }) },
  typeIcon:       { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeLabel:      { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  typeBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, marginBottom: 16 },
  typeBannerText: { fontSize: 15, fontWeight: '700' },
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  dropdown:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.card },
  dropdownText:   { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  dropOverlay:    { flex: 1, backgroundColor: '#00000055', justifyContent: 'center', padding: 20 },
  dropBox:        { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, maxHeight: 400 },
  dropTitle:      { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  dropItem:       { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  dropItemActive: { backgroundColor: COLORS.primaryLight },
  dropItemText:   { fontSize: 14, color: COLORS.textPrimary },
  dropItemSub:    { fontSize: 11, color: COLORS.textSecondary },
  dropEmpty:      { textAlign: 'center', color: COLORS.textMuted, padding: 16 },
  stockInfo:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.successLight, padding: 10, borderRadius: 8, marginBottom: 12 },
  stockInfoText:  { fontSize: 13, color: COLORS.success },
  input:          { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14, color: COLORS.textPrimary, backgroundColor: COLORS.card },
  confirmCard:    { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, gap: 2 },
  confirmTitle:   { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  confirmRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border + '50' },
  confirmLabel:   { fontSize: 13, color: COLORS.textSecondary },
  confirmValue:   { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500', flex: 1, textAlign: 'right' },
  btnPrimary:     { paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 15, color: COLORS.card, fontWeight: '700' },
  btnCancel:      { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  btnCancelText:  { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
});
