import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import {
  getFournisseurs, createFournisseur, updateFournisseur, deleteFournisseur,
  getFournisseurProduits,
} from '../services/api';

// ── Étoiles rating ──────────────────────────────────────────
function Stars({ note }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= Math.round(note ?? 0) ? 'star' : 'star-outline'}
          size={12}
          color={i <= Math.round(note ?? 0) ? '#F39C12' : COLORS.border}
        />
      ))}
    </View>
  );
}

// ── Card fournisseur ─────────────────────────────────────────
function FournisseurCard({ f, onEdit, onDelete }) {
  const [expanded, setExpanded]   = useState(false);
  const [produits, setProduits]   = useState([]);
  const [loadingP, setLoadingP]   = useState(false);

  async function loadProduits() {
    setLoadingP(true);
    try {
      const data = await getFournisseurProduits(f.id);
      setProduits(Array.isArray(data) ? data : data.produits ?? []);
    } catch { setProduits([]); }
    finally { setLoadingP(false); }
  }

  function toggle() {
    if (!expanded) loadProduits();
    setExpanded(v => !v);
  }

  return (
    <View style={[styles.card, SHADOW.sm]}>
      <TouchableOpacity onPress={toggle} style={styles.cardHeader} activeOpacity={0.7}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{(f.nom ?? 'F')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.fNom} numberOfLines={1}>{f.nom}</Text>
          <Text style={styles.fSub} numberOfLines={1}>{f.contact_nom || '—'}</Text>
          <Stars note={f.note} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.delai}>{f.delai_livraison_jours ?? '—'}j</Text>
          <Text style={styles.delaiLabel}>délai livraison</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16} color={COLORS.textSecondary} style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {/* Info contact */}
      <View style={styles.infoRow}>
        {f.telephone && (
          <View style={styles.infoChip}>
            <Ionicons name="call-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.infoChipText}>{f.telephone}</Text>
          </View>
        )}
        {f.email && (
          <View style={styles.infoChip}>
            <Ionicons name="mail-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.infoChipText} numberOfLines={1}>{f.email}</Text>
          </View>
        )}
        <View style={[styles.infoChip, { backgroundColor: f.est_actif !== false ? COLORS.successLight : COLORS.dangerLight ?? '#FDECEA' }]}>
          <Text style={[styles.infoChipText, { color: f.est_actif !== false ? COLORS.success : COLORS.danger }]}>
            {f.est_actif !== false ? 'Actif' : 'Inactif'}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.btnSecondary} onPress={onEdit}>
          <Ionicons name="create-outline" size={14} color={COLORS.primary} />
          <Text style={styles.btnSecondaryText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={toggle}>
          <Ionicons name="cube-outline" size={14} color={COLORS.success} />
          <Text style={[styles.btnSecondaryText, { color: COLORS.success }]}>Produits</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDanger} onPress={onDelete}>
          <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
          <Text style={styles.btnDangerText}>Supprimer</Text>
        </TouchableOpacity>
      </View>

      {/* Produits liés */}
      {expanded && (
        <View style={styles.prodSection}>
          <Text style={styles.prodTitle}>Produits liés ({produits.length})</Text>
          {loadingP ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 6 }} />
          ) : produits.length === 0 ? (
            <Text style={styles.emptyProd}>Aucun produit lié à ce fournisseur</Text>
          ) : (
            produits.map((p, i) => (
              <View key={p.id ?? i} style={styles.prodRow}>
                <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} />
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.prodNom} numberOfLines={1}>{p.designation ?? p.produit_designation}</Text>
                  <Text style={styles.prodRef}>{p.reference ?? p.produit_reference}</Text>
                </View>
                {p.prix_achat != null && (
                  <Text style={styles.prodPrix}>{Number(p.prix_achat).toFixed(2)} DT</Text>
                )}
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ── Modal création/édition ───────────────────────────────────
function FournisseurModal({ visible, fournisseur, onClose, onSaved }) {
  const isEdit = !!fournisseur;
  const [nom, setNom]       = useState('');
  const [contact, setContact] = useState('');
  const [tel, setTel]       = useState('');
  const [email, setEmail]   = useState('');
  const [adresse, setAdresse] = useState('');
  const [delai, setDelai]   = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fournisseur) {
      setNom(fournisseur.nom ?? '');
      setContact(fournisseur.contact_nom ?? '');
      setTel(fournisseur.telephone ?? '');
      setEmail(fournisseur.email ?? '');
      setAdresse(fournisseur.adresse ?? '');
      setDelai(fournisseur.delai_livraison_jours != null ? String(fournisseur.delai_livraison_jours) : '');
    } else {
      setNom(''); setContact(''); setTel(''); setEmail(''); setAdresse(''); setDelai('');
    }
  }, [fournisseur, visible]);

  async function submit() {
    if (!nom.trim()) { Alert.alert('Champ requis', 'Le nom est obligatoire.'); return; }
    setLoading(true);
    try {
      const payload = {
        nom: nom.trim(),
        contact_nom: contact.trim() || undefined,
        telephone: tel.trim() || undefined,
        email: email.trim() || undefined,
        adresse: adresse.trim() || undefined,
        delai_livraison_jours: delai ? parseInt(delai) : undefined,
      };
      if (isEdit) await updateFournisseur(fournisseur.id, payload);
      else await createFournisseur(payload);
      Alert.alert('Succès', isEdit ? 'Fournisseur modifié !' : 'Fournisseur créé !');
      onSaved(); onClose();
    } catch (e) { Alert.alert('Erreur', e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.modalBox}>
          <Text style={styles.modalTitle}>{isEdit ? 'Modifier fournisseur' : 'Nouveau fournisseur'}</Text>
          <TextInput style={styles.input} placeholder="Nom *" value={nom} onChangeText={setNom} />
          <TextInput style={styles.input} placeholder="Contact (nom)" value={contact} onChangeText={setContact} />
          <TextInput style={styles.input} placeholder="Téléphone" value={tel} onChangeText={setTel} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Adresse" value={adresse} onChangeText={setAdresse} />
          <TextInput style={styles.input} placeholder="Délai livraison (jours)" value={delai} onChangeText={setDelai} keyboardType="numeric" />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.btnCancel} onPress={onClose}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color={COLORS.card} /> : <Text style={styles.btnPrimaryText}>{isEdit ? 'Enregistrer' : 'Créer'}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Écran principal ──────────────────────────────────────────
export default function FournisseursScreen() {
  const insets = useSafeAreaInsets();
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editF, setEditF]         = useState(null);
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getFournisseurs();
      setFournisseurs(Array.isArray(data) ? data : data.fournisseurs ?? []);
    } catch { setFournisseurs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function handleEdit(f) { setEditF(f); setShowModal(true); }
  function handleAdd()   { setEditF(null); setShowModal(true); }

  function handleDelete(f) {
    Alert.alert('Supprimer', `Supprimer "${f.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteFournisseur(f.id);
            setFournisseurs(list => list.filter(x => x.id !== f.id));
          } catch (e) { Alert.alert('Erreur', e.message); }
        },
      },
    ]);
  }

  const filtered = fournisseurs.filter(f =>
    f.nom?.toLowerCase().includes(search.toLowerCase()) ||
    f.contact_nom?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Fournisseurs</Text>
          <Text style={styles.subtitle}>{fournisseurs.filter(f => f.est_actif !== false).length} actif(s) sur {fournisseurs.length}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Ionicons name="add" size={20} color={COLORS.card} />
          <Text style={styles.addBtnText}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>{search ? 'Aucun résultat' : 'Aucun fournisseur enregistré'}</Text>
            </View>
          ) : (
            filtered.map(f => (
              <FournisseurCard
                key={f.id}
                f={f}
                onEdit={() => handleEdit(f)}
                onDelete={() => handleDelete(f)}
              />
            ))
          )}
        </ScrollView>
      )}

      <FournisseurModal
        visible={showModal}
        fournisseur={editF}
        onClose={() => setShowModal(false)}
        onSaved={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.background },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  title:        { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  subtitle:     { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 4 },
  addBtnText:   { color: COLORS.card, fontWeight: '600', fontSize: 14 },
  searchBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, marginHorizontal: 14, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border },
  searchInput:  { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:    { fontSize: 15, color: COLORS.textMuted },
  card:         { backgroundColor: COLORS.card, borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 8 },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  fNom:         { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  fSub:         { fontSize: 12, color: COLORS.textSecondary, marginTop: 1, marginBottom: 3 },
  delai:        { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  delaiLabel:   { fontSize: 10, color: COLORS.textSecondary },
  infoRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  infoChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  infoChipText: { fontSize: 11, color: COLORS.textSecondary },
  actionRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  btnSecondaryText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  btnDanger:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.danger + '40' },
  btnDangerText:{ fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  prodSection:  { borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
  prodTitle:    { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  prodRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderTopWidth: 1, borderTopColor: COLORS.border + '50' },
  prodNom:      { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  prodRef:      { fontSize: 11, color: COLORS.textSecondary },
  prodPrix:     { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  emptyProd:    { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  modalBox:     { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  input:        { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14, color: COLORS.textPrimary, backgroundColor: COLORS.background },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel:    { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  btnCancelText:{ fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  btnPrimary:   { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
  btnPrimaryText:{ fontSize: 14, color: COLORS.card, fontWeight: '700' },
});
