import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { recentScans } from '../data/mockData';

const CORNER = 28;
const BORDER = 3;

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const [scanning, setScanning] = useState(false);

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Scanner</Text>
          <Text style={styles.subtitle}>Scan product barcode or QR code</Text>
        </View>
        <TouchableOpacity style={styles.torchBtn} activeOpacity={0.8}>
          <Ionicons name="flashlight-outline" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.viewfinderWrapper}>
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          <View style={styles.reticle}>
            <View style={styles.reticleBar} />
          </View>
        </View>
        <Text style={styles.prompt}>Position barcode within the frame</Text>
      </View>

      <TouchableOpacity
        style={[styles.scanBtn, scanning && styles.scanBtnStop]}
        onPress={() => setScanning(!scanning)}
        activeOpacity={0.85}
      >
        <Ionicons name="camera-outline" size={20} color={COLORS.card} />
        <Text style={styles.scanBtnText}>
          {scanning ? 'Stop Scanning' : 'Start Scanning'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.recentTitle}>Recent Scans</Text>
      <View style={styles.recentCard}>
        {recentScans.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.recentItem,
              index < recentScans.length - 1 && styles.recentBorder,
            ]}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.recentName}>{item.name}</Text>
              <Text style={styles.recentSku}>{item.sku}</Text>
            </View>
            <Text style={styles.recentTime}>{item.time}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:            { flex: 1, backgroundColor: COLORS.background },
  content:           { paddingBottom: 16 },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  title:             { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary },
  subtitle:          { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  torchBtn:          { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  viewfinderWrapper: { marginHorizontal: 20, marginBottom: 20, backgroundColor: COLORS.primaryLight, borderRadius: 20, paddingVertical: 32, alignItems: 'center' },
  viewfinder:        { width: 230, height: 230, alignItems: 'center', justifyContent: 'center' },
  corner:            { position: 'absolute', width: CORNER, height: CORNER, borderColor: COLORS.primary },
  tl:                { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderTopLeftRadius: 6 },
  tr:                { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER, borderTopRightRadius: 6 },
  bl:                { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER, borderBottomLeftRadius: 6 },
  br:                { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderBottomRightRadius: 6 },
  reticle:           { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: `${COLORS.primary}55`, borderRadius: 10 },
  reticleBar:        { width: 22, height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
  prompt:            { marginTop: 22, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  scanBtn:           { marginHorizontal: 20, backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28, ...SHADOW.md },
  scanBtnStop:       { backgroundColor: COLORS.danger },
  scanBtnText:       { fontSize: 16, fontWeight: '700', color: COLORS.card, marginLeft: 10 },
  recentTitle:       { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: 20, marginBottom: 10 },
  recentCard:        { marginHorizontal: 20, backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden', ...SHADOW.sm },
  recentItem:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  recentBorder:      { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  recentName:        { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  recentSku:         { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  recentTime:        { fontSize: 12, color: COLORS.textSecondary },
});
