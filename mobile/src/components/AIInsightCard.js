import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOW } from '../constants/theme';

export default function AIInsightCard({ navigation }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrapper}>
          <Ionicons name="sparkles" size={15} color={COLORS.card} />
        </View>
        <Text style={styles.title}>IA Insight</Text>
        <View style={styles.newBadge}>
          <Text style={styles.newText}>NEW</Text>
        </View>
      </View>
      <Text style={styles.body}>
        Posez vos questions sur le stock, les entrepôts et les mouvements à{' '}
        <Text style={styles.highlight}>l'assistant IA RAG</Text>
        {' '}— propulsé par Groq et ChromaDB.
      </Text>
      <TouchableOpacity activeOpacity={0.7} onPress={() => navigation?.navigate('IAChat')}>
        <Text style={styles.link}>Ouvrir l'IA ↗</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    ...SHADOW.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  highlight: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  link: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
