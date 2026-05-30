import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOW } from '../constants/theme';

const CARD_WIDTH = (Dimensions.get('window').width - 20 * 2 - 12) / 2;

export default function KPICard({ item }) {
  return (
    <View style={[styles.card, { backgroundColor: item.bgColor, width: CARD_WIDTH }]}>
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: `${item.iconColor}22` }]}>
          <Ionicons name={item.icon} size={18} color={item.iconColor} />
        </View>
        {item.change ? (
          <Text style={[styles.change, { color: item.iconColor }]}>{item.change}</Text>
        ) : item.badge ? (
          <View style={[styles.badge, { backgroundColor: `${item.iconColor}22` }]}>
            <Text style={[styles.badgeText, { color: item.iconColor }]}>{item.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.value}>{item.value}</Text>
      <Text style={styles.label}>{item.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    ...SHADOW.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  change: {
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
});
