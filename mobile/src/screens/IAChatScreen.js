import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../constants/theme';
import { askQuestion } from '../services/api';

const SUGGESTIONS = [
  'Quels produits sont en rupture de stock ?',
  'Quel est le taux de rotation des stocks ?',
  'Quels entrepôts ont les meilleurs taux ?',
  'Y a-t-il des produits proches de la péremption ?',
];

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.botAvatar}>
          <Ionicons name="sparkles" size={14} color={COLORS.card} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {msg.content}
        </Text>
        {msg.sources?.length > 0 && (
          <Text style={styles.sources}>
            Sources : {msg.sources.slice(0, 3).join(', ')}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function IAChatScreen({ navigation }) {
  const insets   = useSafeAreaInsets();
  const flatRef  = useRef(null);
  const [messages, setMessages] = useState([
    {
      id: '0',
      role: 'assistant',
      content: 'Bonjour ! Je suis l\'assistant IA de SGS. Posez-moi vos questions sur votre stock, vos entrepôts ou vos mouvements.',
    },
  ]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);

  const send = useCallback(async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;
    setInput('');

    const userMsg = { id: Date.now().toString(), role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);

    setLoading(true);
    try {
      const data = await askQuestion(question);
      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reponse || data.response || 'Réponse reçue.',
        sources: data.sources ?? [],
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Erreur : ${e.message}. Vérifiez que le service IA est démarré.`,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.aiDot} />
          <View>
            <Text style={styles.title}>Assistant IA</Text>
            <Text style={styles.subtitle}>Powered by Groq / RAG</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <MessageBubble msg={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Suggestions */}
      {messages.length === 1 && (
        <View style={styles.suggestWrap}>
          {SUGGESTIONS.map(s => (
            <TouchableOpacity key={s} style={styles.suggestBtn} onPress={() => send(s)}>
              <Text style={styles.suggestText} numberOfLines={2}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Loader */}
      {loading && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.typingText}>  L'IA réfléchit...</Text>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder="Posez votre question..."
          placeholderTextColor={COLORS.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => send()}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send()}
          disabled={!input.trim() || loading}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color={COLORS.card} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: COLORS.background },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  backBtn:        { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
  headerCenter:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiDot:          { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  title:          { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  subtitle:       { fontSize: 12, color: COLORS.textSecondary },
  listContent:    { paddingHorizontal: 16, paddingVertical: 12 },
  bubbleRow:      { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  bubbleRowUser:  { justifyContent: 'flex-end' },
  botAvatar:      { width: 28, height: 28, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bubble:         { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleBot:      { backgroundColor: COLORS.card, borderBottomLeftRadius: 4, ...SHADOW.sm },
  bubbleUser:     { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleText:     { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  bubbleTextUser: { color: COLORS.card },
  sources:        { fontSize: 10, color: COLORS.textMuted, marginTop: 6, fontStyle: 'italic' },
  suggestWrap:    { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  suggestBtn:     { backgroundColor: COLORS.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border, maxWidth: '48%' },
  suggestText:    { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  typingRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  typingText:     { fontSize: 13, color: COLORS.textSecondary },
  inputBar:       { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 10, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  input:          { flex: 1, backgroundColor: COLORS.background, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.textPrimary, maxHeight: 100, marginRight: 10 },
  sendBtn:        { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ opacity: 0.4 },
});
