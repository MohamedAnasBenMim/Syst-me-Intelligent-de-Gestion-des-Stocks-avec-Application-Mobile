import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { getUtilisateurs, createUtilisateur, updateUtilisateur, deleteUtilisateur } from '../services/api';

const ROLES = ['admin', 'gestionnaire', 'operateur'];
const ROLE_CFG = {
  admin:        { label: 'Admin',        bg: '#FDECEA', text: '#E74C3C' },
  gestionnaire: { label: 'Gestionnaire', bg: '#EEF0FF', text: '#6C5CE7' },
  operateur:    { label: 'Opérateur',    bg: '#E6FAF6', text: '#00B894' },
};

// ── User Card ────────────────────────────────────────────────
function UserCard({ item, onEdit, onDelete }) {
  const role = ROLE_CFG[item.role] || ROLE_CFG.operateur;
  const initials = `${(item.prenom || '?')[0]}${(item.nom || '?')[0]}`.toUpperCase();

  return (
    <View style={[styles.card, !item.est_actif && styles.cardInactive]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.prenom} {item.nom}</Text>
        <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
        {item.salaire != null && (
          <Text style={styles.cardSalaire}>{item.salaire.toLocaleString('fr-TN')} TND/mois</Text>
        )}
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.roleBadge, { backgroundColor: role.bg }]}>
          <Text style={[styles.roleText, { color: role.text }]}>{role.label}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(item)}>
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FDECEA' }]} onPress={() => onDelete(item)}>
            <Ionicons name="trash-outline" size={16} color="#E74C3C" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Add User Modal ───────────────────────────────────────────
function AddModal({ visible, onClose, onAdded }) {
  const [nom, setNom]         = useState('');
  const [prenom, setPrenom]   = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [role, setRole]       = useState('operateur');
  const [salaire, setSalaire] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function reset() {
    setNom(''); setPrenom(''); setEmail(''); setPass('');
    setRole('operateur'); setSalaire('');
  }

  async function handleSubmit() {
    if (!nom.trim() || !prenom.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Champs requis', 'Nom, prénom, email et mot de passe sont obligatoires.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Mot de passe', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    try {
      await createUtilisateur({
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        role,
        salaire: salaire ? parseFloat(salaire) : undefined,
      });
      Alert.alert('Succès', 'Utilisateur créé avec succès !');
      reset(); onAdded(); onClose();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvel utilisateur</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {[
              { label: 'Prénom *', value: prenom, set: setPrenom, placeholder: 'Mohamed' },
              { label: 'Nom *',    value: nom,    set: setNom,    placeholder: 'Ben Ali' },
              { label: 'Email *',  value: email,  set: setEmail,  placeholder: 'user@sgs.tn', keyboard: 'email-address' },
              { label: 'Salaire (TND/mois)', value: salaire, set: setSalaire, placeholder: '1200', keyboard: 'numeric' },
            ].map(f => (
              <View key={f.label} style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput} value={f.value} onChangeText={f.set}
                  placeholder={f.placeholder} placeholderTextColor={COLORS.textMuted}
                  keyboardType={f.keyboard || 'default'} autoCapitalize="none"
                />
              </View>
            ))}

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Mot de passe * (min. 6 car.)</Text>
              <View style={styles.passRow}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1, borderRightWidth: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                  value={password} onChangeText={setPass}
                  secureTextEntry={!showPass}
                  placeholder="••••••" placeholderTextColor={COLORS.textMuted}
                />
                <TouchableOpacity
                  style={styles.passToggle}
                  onPress={() => setShowPass(v => !v)}
                >
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Role */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Rôle *</Text>
              <View style={styles.roleRow}>
                {ROLES.map(r => {
                  const cfg = ROLE_CFG[r];
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleBtn, role === r && { backgroundColor: cfg.text, borderColor: cfg.text }]}
                      onPress={() => setRole(r)}
                    >
                      <Text style={[styles.roleBtnText, role === r && { color: '#fff' }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.card} /> : <Text style={styles.submitText}>Créer l'utilisateur</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Edit User Modal ──────────────────────────────────────────
function EditModal({ visible, user, onClose, onSaved }) {
  const [nom, setNom]         = useState('');
  const [prenom, setPrenom]   = useState('');
  const [email, setEmail]     = useState('');
  const [role, setRole]       = useState('operateur');
  const [salaire, setSalaire] = useState('');
  const [actif, setActif]     = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setNom(user.nom || '');
      setPrenom(user.prenom || '');
      setEmail(user.email || '');
      setRole(user.role || 'operateur');
      setSalaire(user.salaire != null ? String(user.salaire) : '');
      setActif(user.est_actif !== false);
    }
  }, [user]);

  async function handleSave() {
    setLoading(true);
    try {
      await updateUtilisateur(user.id, {
        nom: nom.trim() || undefined,
        prenom: prenom.trim() || undefined,
        email: email.trim().toLowerCase() || undefined,
        role,
        salaire: salaire ? parseFloat(salaire) : undefined,
        est_actif: actif,
      });
      Alert.alert('Succès', 'Utilisateur mis à jour !');
      onSaved(); onClose();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier l'utilisateur</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {[
              { label: 'Prénom', value: prenom, set: setPrenom, placeholder: 'Prénom' },
              { label: 'Nom',    value: nom,    set: setNom,    placeholder: 'Nom' },
              { label: 'Email',  value: email,  set: setEmail,  placeholder: 'email@sgs.tn', keyboard: 'email-address' },
              { label: 'Salaire (TND/mois)', value: salaire, set: setSalaire, placeholder: '1200', keyboard: 'numeric' },
            ].map(f => (
              <View key={f.label} style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput} value={f.value} onChangeText={f.set}
                  placeholder={f.placeholder} placeholderTextColor={COLORS.textMuted}
                  keyboardType={f.keyboard || 'default'} autoCapitalize="none"
                />
              </View>
            ))}

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Rôle</Text>
              <View style={styles.roleRow}>
                {ROLES.map(r => {
                  const cfg = ROLE_CFG[r];
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleBtn, role === r && { backgroundColor: cfg.text, borderColor: cfg.text }]}
                      onPress={() => setRole(r)}
                    >
                      <Text style={[styles.roleBtnText, role === r && { color: '#fff' }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Actif toggle */}
            <TouchableOpacity style={styles.actifRow} onPress={() => setActif(v => !v)}>
              <Ionicons
                name={actif ? 'checkmark-circle' : 'close-circle'}
                size={22}
                color={actif ? '#00B894' : '#E74C3C'}
              />
              <Text style={[styles.actifText, { color: actif ? '#00B894' : '#E74C3C' }]}>
                Compte {actif ? 'actif' : 'désactivé'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={COLORS.card} /> : <Text style={styles.submitText}>Enregistrer les modifications</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────
export default function UsersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getUtilisateurs();
      const list = Array.isArray(data) ? data : [];
      setUsers(list);
    } catch { }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  function handleDelete(item) {
    Alert.alert(
      `Supprimer ${item.prenom} ${item.nom} ?`,
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              await deleteUtilisateur(item.id);
              setUsers(prev => prev.filter(u => u.id !== item.id));
            } catch (e) {
              Alert.alert('Erreur', e.message);
            }
          },
        },
      ]
    );
  }

  const filtered = users.filter(u =>
    `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const roleCount = (r) => users.filter(u => u.role === r).length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Utilisateurs</Text>
          <Text style={styles.subtitle}>{users.length} compte{users.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={22} color={COLORS.card} />
        </TouchableOpacity>
      </View>

      {/* Stats par rôle */}
      {users.length > 0 && (
        <View style={styles.statsRow}>
          {ROLES.map(r => {
            const cfg = ROLE_CFG[r];
            return (
              <View key={r} style={[styles.statBox, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.statValue, { color: cfg.text }]}>{roleCount(r)}</Text>
                <Text style={[styles.statLabel, { color: cfg.text }]}>{cfg.label}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un utilisateur…"
          placeholderTextColor={COLORS.textMuted}
          value={search} onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>{search ? 'Aucun résultat' : 'Aucun utilisateur'}</Text>
              {!search && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowAdd(true)}>
                  <Text style={styles.emptyBtnText}>+ Créer un utilisateur</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map(u => (
              <UserCard
                key={u.id} item={u}
                onEdit={setEditUser}
                onDelete={handleDelete}
              />
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <AddModal visible={showAdd} onClose={() => setShowAdd(false)} onAdded={load} />
      <EditModal
        visible={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: COLORS.background },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, gap: 12 },
  backBtn:      { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  title:        { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitle:     { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  addBtn:       { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', ...SHADOW.md },
  statsRow:     { flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 14 },
  statBox:      { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14 },
  statValue:    { fontSize: 20, fontWeight: '800' },
  statLabel:    { fontSize: 10, fontWeight: '600', marginTop: 2 },
  searchRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: COLORS.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14, ...SHADOW.sm },
  searchInput:  { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  list:         { paddingHorizontal: 20 },
  loader:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10, ...SHADOW.sm },
  cardInactive: { opacity: 0.55 },
  avatar:       { width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:   { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  cardInfo:     { flex: 1 },
  cardName:     { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  cardEmail:    { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cardSalaire:  { fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  cardRight:    { alignItems: 'flex-end', gap: 6 },
  roleBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleText:     { fontSize: 11, fontWeight: '700' },
  cardActions:  { flexDirection: 'row', gap: 6 },
  actionBtn:    { width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:    { fontSize: 15, color: COLORS.textSecondary },
  emptyBtn:     { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { color: COLORS.card, fontWeight: '700', fontSize: 14 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll:  { justifyContent: 'flex-end', flexGrow: 1 },
  modalCard:    { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  fieldWrap:    { marginBottom: 14 },
  fieldLabel:   { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  fieldInput:   { backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  passRow:      { flexDirection: 'row', alignItems: 'center' },
  passToggle:   { backgroundColor: COLORS.background, borderWidth: 1, borderLeftWidth: 0, borderColor: COLORS.border, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  roleRow:      { flexDirection: 'row', gap: 8 },
  roleBtn:      { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border },
  roleBtnText:  { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  actifRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, padding: 12, backgroundColor: COLORS.background, borderRadius: 12 },
  actifText:    { fontSize: 14, fontWeight: '600' },
  submitBtn:    { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitText:   { fontSize: 16, fontWeight: '700', color: COLORS.card },
});
