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
  getDepots, createDepot, updateDepot, deleteDepot,
  getDepotMagasins, getMagasins, createMagasin, deleteMagasin,
} from '../services/api';

// ── Barre d'occupation ───────────────────────────────────────
function OccupationBar({ pct }) {
  const color = pct >= 90 ? COLORS.danger : pct >= 70 ? COLORS.warning : COLORS.success;
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── Ligne magasin dans un dépôt ──────────────────────────────
function MagasinRow({ mag, onDelete }) {
  const occ = mag.capacite_max > 0 ? Math.round((mag.capacite_utilisee ?? 0) / mag.capacite_max * 100) : 0;
  return (
    <View style={styles.magRow}>
      <View style={[styles.dot, { backgroundColor: mag.est_actif ? COLORS.success : COLORS.border }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.magNom} numberOfLines={1}>{mag.nom}</Text>
        <Text style={styles.magDetail}>{mag.code} · {mag.ville || '—'}</Text>
        <OccupationBar pct={occ} />
      </View>
      <Text style={styles.magPct}>{occ}%</Text>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
        <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );
}

// ── Card dépôt ───────────────────────────────────────────────
function DepotCard({ depot, onEdit, onDelete, onRefresh }) {
  const [expanded, setExpanded]   = useState(false);
  const [magasins, setMagasins]   = useState([]);
  const [loadingMag, setLoadingMag] = useState(false);
  const [showAddMag, setShowAddMag] = useState(false);

  const occ = depot.capacite_max > 0
    ? Math.round((depot.capacite_utilisee ?? 0) / depot.capacite_max * 100)
    : 0;

  async function loadMagasins() {
    setLoadingMag(true);
    try {
      const data = await getDepotMagasins(depot.id);
      setMagasins(Array.isArray(data) ? data : data.magasins ?? []);
    } catch { setMagasins([]); }
    finally { setLoadingMag(false); }
  }

  function toggle() {
    if (!expanded) loadMagasins();
    setExpanded(v => !v);
  }

  async function handleDeleteMag(id) {
    Alert.alert('Supprimer', 'Supprimer ce magasin ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteMagasin(id);
            setMagasins(m => m.filter(x => x.id !== id));
          } catch (e) { Alert.alert('Erreur', e.message); }
        },
      },
    ]);
  }

  return (
    <View style={[styles.card, SHADOW.sm]}>
      {/* En-tête */}
      <TouchableOpacity onPress={toggle} style={styles.cardHeader} activeOpacity={0.7}>
        <View style={[styles.typeBadge, { backgroundColor: depot.type === 'CENTRAL' ? COLORS.primaryLight : COLORS.infoLight ?? '#EBF5FB' }]}>
          <Text style={[styles.typeText, { color: depot.type === 'CENTRAL' ? COLORS.primary : COLORS.info ?? '#2980B9' }]}>
            {depot.type ?? 'DEPOT'}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.depotNom} numberOfLines={1}>{depot.nom}</Text>
          <Text style={styles.depotSub}>{depot.code} · {depot.ville || '—'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.occPct}>{occ}%</Text>
          <Text style={styles.occLabel}>occupation</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16} color={COLORS.textSecondary} style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {/* Barre occupation */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
        <OccupationBar pct={occ} />
        <View style={styles.capRow}>
          <Text style={styles.capText}>
            {(depot.capacite_utilisee ?? 0).toLocaleString()} / {(depot.capacite_max ?? 0).toLocaleString()} unités
          </Text>
          <Text style={styles.capText}>{depot.responsable || ''}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.btnSecondary} onPress={onEdit}>
          <Ionicons name="create-outline" size={14} color={COLORS.primary} />
          <Text style={styles.btnSecondaryText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => { toggle(); }}>
          <Ionicons name="storefront-outline" size={14} color={COLORS.success} />
          <Text style={[styles.btnSecondaryText, { color: COLORS.success }]}>Magasins</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnDanger} onPress={onDelete}>
          <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
          <Text style={styles.btnDangerText}>Supprimer</Text>
        </TouchableOpacity>
      </View>

      {/* Magasins expandés */}
      {expanded && (
        <View style={styles.magSection}>
          <View style={styles.magHeader}>
            <Text style={styles.magTitle}>Magasins ({magasins.length})</Text>
            <TouchableOpacity style={styles.btnAddMag} onPress={() => setShowAddMag(true)}>
              <Ionicons name="add" size={14} color={COLORS.card} />
              <Text style={styles.btnAddMagText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          {loadingMag ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 8 }} />
          ) : magasins.length === 0 ? (
            <Text style={styles.emptyMag}>Aucun magasin dans ce dépôt</Text>
          ) : (
            magasins.map(m => (
              <MagasinRow key={m.id} mag={m} onDelete={() => handleDeleteMag(m.id)} />
            ))
          )}
        </View>
      )}

      {/* Modal ajout magasin */}
      <AddMagasinModal
        visible={showAddMag}
        depotId={depot.id}
        onClose={() => setShowAddMag(false)}
        onAdded={() => { loadMagasins(); onRefresh(); }}
      />
    </View>
  );
}

// ── Modal ajout magasin ──────────────────────────────────────
function AddMagasinModal({ visible, depotId, onClose, onAdded }) {
  const [nom, setNom]   = useState('');
  const [code, setCode] = useState('');
  const [ville, setVille] = useState('');
  const [cap, setCap]   = useState('');
  const [loading, setLoading] = useState(false);

  function reset() { setNom(''); setCode(''); setVille(''); setCap(''); }

  async function submit() {
    if (!nom.trim() || !code.trim()) {
      Alert.alert('Champs requis', 'Nom et code sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      await createMagasin({
        nom: nom.trim(),
        code: code.trim().toUpperCase(),
        ville: ville.trim() || undefined,
        capacite_max: cap ? parseFloat(cap) : undefined,
        depot_id: depotId,
      });
      Alert.alert('Succès', 'Magasin créé !');
      reset(); onAdded(); onClose();
    } catch (e) { Alert.alert('Erreur', e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Nouveau magasin</Text>
          <TextInput style={styles.input} placeholder="Nom *" value={nom} onChangeText={setNom} />
          <TextInput style={styles.input} placeholder="Code *" value={code} onChangeText={setCode} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="Ville" value={ville} onChangeText={setVille} />
          <TextInput style={styles.input} placeholder="Capacité max" value={cap} onChangeText={setCap} keyboardType="numeric" />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.btnCancel} onPress={() => { reset(); onClose(); }}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color={COLORS.card} /> : <Text style={styles.btnPrimaryText}>Créer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Modal ajout/édition dépôt ────────────────────────────────
function DepotModal({ visible, depot, onClose, onSaved }) {
  const isEdit = !!depot;
  const [nom, setNom]           = useState('');
  const [code, setCode]         = useState('');
  const [ville, setVille]       = useState('');
  const [resp, setResp]         = useState('');
  const [cap, setCap]           = useState('');
  const [type, setType]         = useState('REGIONAL');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (depot) {
      setNom(depot.nom ?? '');
      setCode(depot.code ?? '');
      setVille(depot.ville ?? '');
      setResp(depot.responsable ?? '');
      setCap(depot.capacite_max ? String(depot.capacite_max) : '');
      setType(depot.type ?? 'REGIONAL');
    } else {
      setNom(''); setCode(''); setVille(''); setResp(''); setCap(''); setType('REGIONAL');
    }
  }, [depot, visible]);

  async function submit() {
    if (!nom.trim() || !code.trim()) {
      Alert.alert('Champs requis', 'Nom et code sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        nom: nom.trim(),
        code: code.trim().toUpperCase(),
        ville: ville.trim() || undefined,
        responsable: resp.trim() || undefined,
        capacite_max: cap ? parseFloat(cap) : undefined,
        type: type,
      };
      if (isEdit) await updateDepot(depot.id, payload);
      else await createDepot(payload);
      Alert.alert('Succès', isEdit ? 'Dépôt modifié !' : 'Dépôt créé !');
      onSaved(); onClose();
    } catch (e) { Alert.alert('Erreur', e.message); }
    finally { setLoading(false); }
  }

  const TYPES = ['CENTRAL', 'REGIONAL', 'LOCAL'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.modalBox}>
          <Text style={styles.modalTitle}>{isEdit ? 'Modifier dépôt' : 'Nouveau dépôt'}</Text>
          <TextInput style={styles.input} placeholder="Nom *" value={nom} onChangeText={setNom} />
          <TextInput style={styles.input} placeholder="Code *" value={code} onChangeText={setCode} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="Ville" value={ville} onChangeText={setVille} />
          <TextInput style={styles.input} placeholder="Responsable" value={resp} onChangeText={setResp} />
          <TextInput style={styles.input} placeholder="Capacité max" value={cap} onChangeText={setCap} keyboardType="numeric" />
          <Text style={styles.inputLabel}>Type</Text>
          <View style={styles.typeRow}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
export default function WarehousesScreen() {
  const insets = useSafeAreaInsets();
  const [depots, setDepots]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editDepot, setEditDepot] = useState(null);
  const [search, setSearch]       = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getDepots();
      setDepots(Array.isArray(data) ? data : data.depots ?? []);
    } catch { setDepots([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function handleEdit(depot) { setEditDepot(depot); setShowModal(true); }
  function handleAdd()        { setEditDepot(null);  setShowModal(true); }

  function handleDelete(depot) {
    Alert.alert('Supprimer', `Supprimer "${depot.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDepot(depot.id);
            setDepots(d => d.filter(x => x.id !== depot.id));
          } catch (e) { Alert.alert('Erreur', e.message); }
        },
      },
    ]);
  }

  const filtered = depots.filter(d =>
    d.nom?.toLowerCase().includes(search.toLowerCase()) ||
    d.code?.toLowerCase().includes(search.toLowerCase()) ||
    d.ville?.toLowerCase().includes(search.toLowerCase())
  );

  const total   = depots.length;
  const actifs  = depots.filter(d => d.est_actif !== false).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dépôts</Text>
          <Text style={styles.subtitle}>{actifs} actif(s) sur {total}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Ionicons name="add" size={20} color={COLORS.card} />
          <Text style={styles.addBtnText}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {/* Recherche */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un dépôt..."
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

      {/* Liste */}
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
              <Text style={styles.emptyText}>{search ? 'Aucun résultat' : 'Aucun dépôt enregistré'}</Text>
            </View>
          ) : (
            filtered.map(d => (
              <DepotCard
                key={d.id}
                depot={d}
                onEdit={() => handleEdit(d)}
                onDelete={() => handleDelete(d)}
                onRefresh={load}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Modal */}
      <DepotModal
        visible={showModal}
        depot={editDepot}
        onClose={() => setShowModal(false)}
        onSaved={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  title:         { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  subtitle:      { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 4 },
  addBtnText:    { color: COLORS.card, fontWeight: '600', fontSize: 14 },
  searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, marginHorizontal: 14, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4, borderWidth: 1, borderColor: COLORS.border },
  searchInput:   { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:         { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:     { fontSize: 15, color: COLORS.textMuted },
  // Card
  card:          { backgroundColor: COLORS.card, borderRadius: 14, marginBottom: 12, overflow: 'hidden' },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 8 },
  typeBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText:      { fontSize: 11, fontWeight: '700' },
  depotNom:      { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  depotSub:      { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  occPct:        { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  occLabel:      { fontSize: 10, color: COLORS.textSecondary },
  barBg:         { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  barFill:       { height: 6, borderRadius: 3 },
  capRow:        { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  capText:       { fontSize: 11, color: COLORS.textSecondary },
  actionRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  btnSecondary:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  btnSecondaryText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  btnDanger:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.danger + '40' },
  btnDangerText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  // Magasins
  magSection:    { borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
  magHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  magTitle:      { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  btnAddMag:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 3 },
  btnAddMagText: { color: COLORS.card, fontSize: 12, fontWeight: '600' },
  magRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.border + '60' },
  dot:           { width: 8, height: 8, borderRadius: 4 },
  magNom:        { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  magDetail:     { fontSize: 11, color: COLORS.textSecondary },
  magPct:        { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, minWidth: 32, textAlign: 'right' },
  emptyMag:      { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 8 },
  // Modal
  modalOverlay:  { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  input:         { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 14, color: COLORS.textPrimary, backgroundColor: COLORS.background },
  inputLabel:    { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  typeRow:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn:       { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText:   { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  typeBtnTextActive: { color: COLORS.card },
  modalActions:  { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel:     { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  btnCancelText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  btnPrimary:    { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
  btnPrimaryText:{ fontSize: 14, color: COLORS.card, fontWeight: '700' },
});
