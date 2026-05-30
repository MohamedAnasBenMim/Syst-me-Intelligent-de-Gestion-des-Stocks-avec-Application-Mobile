import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { COLORS, SHADOW } from '../constants/theme';
import { getMouvements } from '../services/api';

const SCREEN_W = Dimensions.get('window').width;
const CHART_H  = 140;
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// Build last 6 months buckets
function buildMonths() {
  const buckets = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key:      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label:    MONTHS_FR[d.getMonth()],
      entrees:  0,
      sorties:  0,
      transferts: 0,
    });
  }
  return buckets;
}

function aggregateMouvements(list) {
  const buckets = buildMonths();
  for (const m of list) {
    const raw = m.date_mouvement || m.created_at;
    if (!raw) continue;
    const d   = new Date(raw);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const b   = buckets.find(b => b.key === key);
    if (!b) continue;
    const t = (m.type_mouvement || '').toLowerCase();
    if (t === 'entree')    b.entrees    += m.quantite || 1;
    else if (t === 'sortie')    b.sorties    += m.quantite || 1;
    else if (t === 'transfert') b.transferts += m.quantite || 1;
  }
  return buckets;
}

// ── Bar chart : Entrées / Sorties / Transferts ───────────────
function BarChart({ data }) {
  const [selected, setSelected] = useState(data.length - 1);
  const maxVal = Math.max(...data.map(d => d.entrees + d.sorties + d.transferts), 1);

  function barH(val) {
    return Math.max((val / maxVal) * (CHART_H - 24), 3);
  }

  const sel = data[selected];

  return (
    <View>
      {/* Tooltip */}
      {sel && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{sel.label}</Text>
          <View style={styles.tooltipRow}>
            <View style={[styles.dot, { backgroundColor: '#2E7D32' }]} />
            <Text style={styles.tooltipItem}>Entrées : <Text style={styles.tooltipVal}>{sel.entrees}</Text></Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.dot, { backgroundColor: '#CC2222' }]} />
            <Text style={styles.tooltipItem}>Sorties : <Text style={styles.tooltipVal}>{sel.sorties}</Text></Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.dot, { backgroundColor: '#FF6600' }]} />
            <Text style={styles.tooltipItem}>Transferts : <Text style={styles.tooltipVal}>{sel.transferts}</Text></Text>
          </View>
        </View>
      )}

      {/* Bars */}
      <View style={[styles.chartArea, { height: CHART_H + 20 }]}>
        {data.map((d, i) => {
          const isSelected = i === selected;
          return (
            <TouchableOpacity key={d.key} style={styles.barGroup} onPress={() => setSelected(i)} activeOpacity={0.8}>
              <View style={[styles.barsWrap, { height: CHART_H - 20 }]}>
                <View style={[styles.bar, { height: barH(d.entrees),   backgroundColor: isSelected ? '#2E7D32' : '#A5D6A7' }]} />
                <View style={[styles.bar, { height: barH(d.sorties),   backgroundColor: isSelected ? '#CC2222' : '#FFCDD2' }]} />
                <View style={[styles.bar, { height: barH(d.transferts),backgroundColor: isSelected ? '#FF6600' : '#FFD9B3' }]} />
              </View>
              <Text style={[styles.barLabel, isSelected && styles.barLabelActive]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: '#2E7D32', label: 'Entrées' },
          { color: '#CC2222', label: 'Sorties' },
          { color: '#FF6600', label: 'Transferts' },
        ].map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Line chart SVG via absolute Views ────────────────────────
function LineChart({ data }) {
  const W = SCREEN_W - 80; // horizontal padding
  const H = 120;
  const PL = 32, PR = 8, PT = 12, PB = 24;
  const iW = W - PL - PR;
  const iH = H - PT - PB;

  const maxVal = Math.max(...data.flatMap(d => [d.entrees, d.sorties]), 1);
  const n = data.length;

  function toX(i) { return PL + (i / Math.max(n - 1, 1)) * iW; }
  function toY(v) { return PT + iH - (v / maxVal) * iH; }

  // Build polyline points as percentage positions
  const entreePoints  = data.map((d, i) => ({ x: toX(i), y: toY(d.entrees)  }));
  const sortiePoints  = data.map((d, i) => ({ x: toX(i), y: toY(d.sorties)  }));

  const ticks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <View style={{ height: H + 4, position: 'relative', marginTop: 8 }}>
      {/* Y-axis ticks */}
      {ticks.map((t, i) => {
        const y = toY(t);
        return (
          <View key={i} style={[styles.gridLine, { top: y, left: PL, right: PR }]}>
            <Text style={styles.gridLabel}>{t}</Text>
          </View>
        );
      })}

      {/* Entrées line segments */}
      {entreePoints.slice(0, -1).map((p, i) => {
        const next = entreePoints[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View key={`e${i}`} style={[styles.segment, {
            left: p.x, top: p.y,
            width: len, height: 2.5,
            backgroundColor: '#2E7D32',
            transform: [{ rotate: `${angle}deg` }],
            transformOrigin: '0 50%',
          }]} />
        );
      })}

      {/* Sorties line segments */}
      {sortiePoints.slice(0, -1).map((p, i) => {
        const next = sortiePoints[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View key={`s${i}`} style={[styles.segment, {
            left: p.x, top: p.y,
            width: len, height: 2.5,
            backgroundColor: '#CC2222',
            transform: [{ rotate: `${angle}deg` }],
            transformOrigin: '0 50%',
          }]} />
        );
      })}

      {/* Dots entrées */}
      {entreePoints.map((p, i) => (
        <View key={`de${i}`} style={[styles.dot2, { left: p.x - 4, top: p.y - 4, backgroundColor: '#2E7D32' }]} />
      ))}

      {/* Dots sorties */}
      {sortiePoints.map((p, i) => (
        <View key={`ds${i}`} style={[styles.dot2, { left: p.x - 4, top: p.y - 4, backgroundColor: '#CC2222' }]} />
      ))}

      {/* X labels */}
      {data.map((d, i) => (
        <Text key={d.key} style={[styles.xLabel, { left: toX(i) - 10, top: H - PB + 6 }]}>{d.label}</Text>
      ))}
    </View>
  );
}

// ── Main ChartCard ───────────────────────────────────────────
export default function ChartCard() {
  const [data, setData]     = useState(buildMonths());
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState('bar'); // 'bar' | 'line'

  useEffect(() => {
    getMouvements({ per_page: 500 })
      .then(res => {
        const list = Array.isArray(res) ? res : (res.mouvements ?? res.items ?? []);
        setData(aggregateMouvements(list));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mouvements de stock</Text>
          <Text style={styles.subtitle}>6 derniers mois</Text>
        </View>
        {loading
          ? <ActivityIndicator size="small" color={COLORS.primary} />
          : (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'bar' && styles.tabBtnActive]}
                onPress={() => setTab('bar')}
              >
                <Text style={[styles.tabText, tab === 'bar' && styles.tabTextActive]}>Barres</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'line' && styles.tabBtnActive]}
                onPress={() => setTab('line')}
              >
                <Text style={[styles.tabText, tab === 'line' && styles.tabTextActive]}>Courbe</Text>
              </TouchableOpacity>
            </View>
          )
        }
      </View>

      {loading ? (
        <View style={{ height: CHART_H + 40, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : tab === 'bar' ? (
        <BarChart data={data} />
      ) : (
        <LineChart data={data} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card:          { marginHorizontal: 20, marginBottom: 16, backgroundColor: COLORS.card, borderRadius: 18, padding: 16, ...SHADOW.sm },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title:         { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  subtitle:      { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  tabRow:        { flexDirection: 'row', backgroundColor: COLORS.border, borderRadius: 10, padding: 3 },
  tabBtn:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tabBtnActive:  { backgroundColor: COLORS.card },
  tabText:       { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },
  // Bar chart
  tooltip:       { backgroundColor: COLORS.background, borderRadius: 12, padding: 10, marginBottom: 10 },
  tooltipTitle:  { fontSize: 12, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  tooltipRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  dot:           { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  tooltipItem:   { fontSize: 11, color: COLORS.textSecondary },
  tooltipVal:    { fontWeight: '700', color: COLORS.textPrimary },
  chartArea:     { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 20 },
  barGroup:      { flex: 1, alignItems: 'center' },
  barsWrap:      { flexDirection: 'row', alignItems: 'flex-end', gap: 2, justifyContent: 'center' },
  bar:           { width: 7, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barLabel:      { fontSize: 9, color: COLORS.textMuted, marginTop: 5, fontWeight: '500' },
  barLabelActive:{ color: COLORS.primary, fontWeight: '700' },
  legend:        { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 6 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:     { width: 8, height: 8, borderRadius: 4 },
  legendText:    { fontSize: 10, color: COLORS.textSecondary, fontWeight: '500' },
  // Line chart
  gridLine:      { position: 'absolute', height: 1, backgroundColor: '#E5E7EB' },
  gridLabel:     { position: 'absolute', left: -30, fontSize: 9, color: COLORS.textMuted, top: -5 },
  segment:       { position: 'absolute', borderRadius: 2 },
  dot2:          { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: COLORS.card },
  xLabel:        { position: 'absolute', fontSize: 9, color: COLORS.textMuted, width: 24, textAlign: 'center' },
});
