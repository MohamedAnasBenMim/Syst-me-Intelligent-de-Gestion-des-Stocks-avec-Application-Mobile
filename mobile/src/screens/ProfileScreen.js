import {
  View, Text, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  admin:       'Administrateur',
  gestionnaire: 'Gestionnaire',
  operateur:   'Opérateur',
};

export default function ProfileScreen({ navigation }) {
  const insets      = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const initial = user ? (user.prenom?.[0] ?? user.email?.[0] ?? 'U').toUpperCase() : 'U';
  const fullName = user ? `${user.prenom ?? ''} ${user.nom ?? ''}`.trim() || user.email : 'Utilisateur';
  const role = ROLE_LABELS[user?.role] || user?.role || 'Utilisateur';

  const MENU_SECTIONS = [
    {
      label: 'NAVIGATION',
      items: [
        { icon: 'business-outline',      title: 'Entrepôts',       onPress: () => navigation.navigate('Warehouses') },
        { icon: 'swap-horizontal-outline', title: 'Mouvements',    onPress: () => navigation.navigate('Movements') },
        { icon: 'bar-chart-outline',     title: 'Reporting',        onPress: () => navigation.navigate('Reporting') },
        { icon: 'sparkles-outline',      title: 'Assistant IA',     onPress: () => navigation.navigate('IAChat') },
        { icon: 'notifications-outline', title: 'Notifications',    onPress: () => navigation.navigate('Notifications') },
        { icon: 'pricetag-outline',      title: 'Promotions',       onPress: () => navigation.navigate('Promotions') },
        { icon: 'people-outline',        title: 'Utilisateurs',     onPress: () => navigation.navigate('Users') },
      ],
    },
    {
      label: 'COMPTE',
      items: [
        { icon: 'person-outline',        title: 'Mon profil',       subtitle: user?.email },
        { icon: 'shield-checkmark-outline', title: 'Sécurité',      subtitle: 'Mot de passe & auth' },
      ],
    },
    {
      label: 'SESSION',
      items: [
        {
          icon: 'log-out-outline',
          title: 'Se déconnecter',
          danger: true,
          onPress: () => {
            Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Déconnecter', style: 'destructive', onPress: signOut },
            ]);
          },
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.pageTitle}>Profil</Text>
      <Text style={styles.pageSubtitle}>Gérez votre compte</Text>

      {/* Avatar card */}
      <View style={styles.avatarCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>{initial}</Text>
        </View>
        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role}</Text>
        </View>
      </View>

      {/* Menu sections */}
      {MENU_SECTIONS.map(section => (
        <View key={section.label} style={styles.section}>
          <Text style={styles.sectionLabel}>{section.label}</Text>
          <View style={styles.sectionCard}>
            {section.items.map((item, index) => (
              <TouchableOpacity
                key={item.title}
                style={[styles.menuItem, index < section.items.length - 1 && styles.menuBorder]}
                activeOpacity={0.75}
                onPress={item.onPress}
              >
                <View style={[styles.menuIcon, item.danger && styles.menuIconDanger]}>
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.danger ? COLORS.danger : COLORS.primary}
                  />
                </View>
                <View style={styles.menuContent}>
                  <Text style={[styles.menuTitle, item.danger && { color: COLORS.danger }]}>
                    {item.title}
                  </Text>
                  {!!item.subtitle && (
                    <Text style={styles.menuSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                  )}
                </View>
                {!item.danger && (
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: COLORS.background },
  content:       { paddingBottom: 16 },
  pageTitle:     { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, paddingHorizontal: 20, paddingTop: 16 },
  pageSubtitle:  { fontSize: 13, color: COLORS.textSecondary, paddingHorizontal: 20, marginBottom: 20 },
  avatarCard:    { marginHorizontal: 20, marginBottom: 24, backgroundColor: COLORS.primaryLight, borderRadius: 20, padding: 24, alignItems: 'center', ...SHADOW.sm },
  avatar:        { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarLetter:  { fontSize: 32, fontWeight: '800', color: COLORS.card },
  name:          { fontSize: 19, fontWeight: '800', color: COLORS.textPrimary },
  email:         { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  roleBadge:     { marginTop: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: `${COLORS.primary}44`, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  roleText:      { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  section:       { marginHorizontal: 20, marginBottom: 18 },
  sectionLabel:  { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 8 },
  sectionCard:   { backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', ...SHADOW.sm },
  menuItem:      { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuBorder:    { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuIcon:      { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  menuIconDanger:{ backgroundColor: COLORS.dangerLight },
  menuContent:   { flex: 1 },
  menuTitle:     { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  menuSubtitle:  { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
