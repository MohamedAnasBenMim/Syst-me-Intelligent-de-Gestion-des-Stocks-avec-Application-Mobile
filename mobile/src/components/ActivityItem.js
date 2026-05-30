import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function ActivityItem({ item }) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.iconName} size={20} color={item.iconColor} />
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={11} color={COLORS.textMuted} />
            <Text style={styles.time}> {item.time}</Text>
          </View>
        </View>
        <Text style={styles.description}>{item.description}</Text>
        <View style={[styles.badge, { backgroundColor: item.badgeColor }]}>
          <Text style={[styles.badgeText, { color: item.badgeText }]}>{item.badge}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  description: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 17,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
