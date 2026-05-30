import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOW } from '../constants/theme';

export default function Header({ hasNotification = true, user }) {
  const name = user ? (user.prenom ?? user.email?.split('@')[0] ?? 'Alex') : 'Alex';
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.appName}>SGS</Text>
        <Text style={styles.subtitle}>Bonjour, {name} 👋</Text>
      </View>
      <TouchableOpacity style={styles.bellWrapper} activeOpacity={0.75}>
        <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
        {hasNotification && <View style={styles.dot} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  bellWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.sm,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5,
    borderColor: COLORS.card,
  },
});
