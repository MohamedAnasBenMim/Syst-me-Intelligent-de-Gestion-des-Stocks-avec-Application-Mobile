import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SHADOW } from '../../constants/theme';
import { forgotPassword } from '../../services/api';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState('login'); // 'login' | 'forgot'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Champs requis', 'Veuillez remplir email et mot de passe.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      Alert.alert('Erreur de connexion', e.message || 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) {
      Alert.alert('Email requis', 'Entrez votre adresse email.');
      return;
    }
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
      Alert.alert(
        'Email envoyé',
        'Si ce compte existe, vous recevrez un email de réinitialisation.',
        [{ text: 'OK', onPress: () => setTab('login') }]
      );
    } catch (e) {
      Alert.alert('Erreur', e.message || 'Impossible d\'envoyer l\'email.');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>SGS</Text>
          </View>
          <Text style={styles.appName}>Stock Management</Text>
          <Text style={styles.appSub}>Système de Gestion des Stocks</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>

          {tab === 'login' ? (
            <>
              <Text style={styles.cardTitle}>Connexion</Text>
              <Text style={styles.cardSub}>Bienvenue ! Connectez-vous à votre compte.</Text>

              {/* Email */}
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="admin@sgs.tn"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* Password */}
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPwd}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Mot de passe oublié */}
              <TouchableOpacity onPress={() => setTab('forgot')} style={styles.forgotRow}>
                <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              {/* Bouton connexion */}
              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.card} />
                  : <Text style={styles.loginBtnText}>Se connecter</Text>
                }
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>ou continuer avec</Text>
                <View style={styles.divider} />
              </View>

              {/* Google OAuth */}
              <TouchableOpacity
                style={styles.googleBtn}
                activeOpacity={0.85}
                onPress={() => Alert.alert(
                  'Google OAuth',
                  'La connexion Google utilise Clerk. Connectez-vous via email/mot de passe ou utilisez le compte démo ci-dessous.',
                  [{ text: 'OK' }]
                )}
              >
                <View style={styles.googleIcon}>
                  <Text style={styles.googleG}>G</Text>
                </View>
                <Text style={styles.googleText}>Continuer avec Google</Text>
              </TouchableOpacity>

              {/* Compte démo */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={15} color={COLORS.primary} />
                <Text style={styles.infoText}>  Compte démo : admin@sgs.tn / 123456</Text>
              </View>
            </>
          ) : (
            <>
              {/* Mot de passe oublié */}
              <TouchableOpacity onPress={() => setTab('login')} style={styles.backRow}>
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
                <Text style={styles.backText}>Retour à la connexion</Text>
              </TouchableOpacity>

              <Text style={styles.cardTitle}>Mot de passe oublié</Text>
              <Text style={styles.cardSub}>
                Entrez votre email. Vous recevrez un code OTP par email.
              </Text>

              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="votre@email.com"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                />
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, forgotLoading && styles.btnDisabled]}
                onPress={handleForgotPassword}
                activeOpacity={0.85}
                disabled={forgotLoading}
              >
                {forgotLoading
                  ? <ActivityIndicator color={COLORS.card} />
                  : <Text style={styles.loginBtnText}>Envoyer le code OTP</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>SGS Platform © 2025 — Tous droits réservés</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: COLORS.background },
  scroll:         { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoWrap:       { alignItems: 'center', marginBottom: 32 },
  logoBox:        { width: 72, height: 72, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...SHADOW.md },
  logoText:       { fontSize: 26, fontWeight: '900', color: COLORS.card },
  appName:        { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  appSub:         { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  card:           { backgroundColor: COLORS.card, borderRadius: 22, padding: 24, ...SHADOW.sm },
  cardTitle:      { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  cardSub:        { fontSize: 13, color: COLORS.textSecondary, marginBottom: 24 },
  label:          { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  inputRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  inputIcon:      { marginRight: 10 },
  input:          { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  eyeBtn:         { padding: 2 },
  forgotRow:      { alignSelf: 'flex-end', marginTop: -8, marginBottom: 20 },
  forgotText:     { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  loginBtn:       { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 20, ...SHADOW.md },
  btnDisabled:    { opacity: 0.7 },
  loginBtnText:   { fontSize: 16, fontWeight: '700', color: COLORS.card },
  dividerRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  divider:        { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText:    { fontSize: 12, color: COLORS.textSecondary, marginHorizontal: 12 },
  googleBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 16, paddingVertical: 13, marginBottom: 20, backgroundColor: COLORS.card, gap: 10 },
  googleIcon:     { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EA4335', alignItems: 'center', justifyContent: 'center' },
  googleG:        { fontSize: 13, fontWeight: '900', color: '#fff' },
  googleText:     { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  infoBox:        { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 12 },
  infoText:       { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  backRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText:       { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  footer:         { textAlign: 'center', fontSize: 11, color: COLORS.textMuted, marginTop: 32 },
});
