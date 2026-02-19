import { AppSettings } from './types';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const HUGGINGFACE_API = 'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3';

function buildSystemPrompt(): string {
  return `You are ZeroBuild AI, an expert Android app code generator. You generate complete, production-quality React Native apps. The user describes ANY kind of app and you build EXACTLY what they ask for.

Output ONLY valid JavaScript/JSX code. No explanations, no markdown, no code fences (\`\`\`). Output a single complete App.js file.

IMPORTS - ONLY use these:
- import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
- import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, StatusBar, FlatList, Modal, Alert, Animated, ScrollView, Image, Dimensions, Switch, Platform, ActivityIndicator, Pressable, SectionList, Linking } from 'react-native';
- Do NOT import from expo, @expo, or any third-party library
- Do NOT use AsyncStorage or any external storage

APP DESIGN RULES:
1. Build EXACTLY what the user describes. Understand the core purpose of their app and deliver that specific functionality.
2. Design it like a top-rated app on the Google Play Store - polished, intuitive, professional.
3. Use a modern dark theme: background #0f172a, cards #1e293b, accent #00d4ff, text #f1f5f9, muted #64748b
4. Use Unicode symbols for icons (e.g., \\u2795 for +, \\u{1F50D} for search, \\u2699 for settings, \\u2764 for heart, \\u{1F4DD} for note, \\u2705 for check)
5. Include proper navigation between screens using state (e.g., const [screen, setScreen] = useState('home'))
6. Add FAB (floating action button) for primary actions where appropriate
7. Use cards, proper spacing (padding 16-24), rounded corners (borderRadius 12-16), subtle shadows
8. Include search/filter functionality where relevant
9. Add empty states with helpful messages when lists are empty
10. Use Animated API for smooth transitions between screens
11. Make all interactive elements have clear visual feedback
12. Generate at least 250 lines of well-structured code
13. Add timestamps, categories, or tags where they make sense for the app type
14. Include CRUD operations (create, read, update, delete) for data-driven apps
15. Use FlatList for any lists, with proper keyExtractor and separators`;
}

function getActiveApiKey(settings: AppSettings): string {
  switch (settings.llmProvider) {
    case 'gemini': return settings.geminiApiKey || settings.llmApiKey;
    case 'groq': return settings.groqApiKey || settings.llmApiKey;
    case 'huggingface': return settings.huggingfaceApiKey || settings.llmApiKey;
    default: return settings.llmApiKey;
  }
}

export async function generateCode(prompt: string, settings: AppSettings): Promise<string> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = `Build a React Native Android app for the following idea. Understand what kind of app this is and deliver exactly that - with all the features a real user would expect from this type of app.

App idea: "${prompt}"

Think about what screens, features, and interactions this specific app needs. Then generate the complete App.js code. Remember: output ONLY code, no explanations.`;

  const providers: { name: string; key: string; fn: (s: string, u: string, k: string) => Promise<string> }[] = [];

  if (settings.geminiApiKey) providers.push({ name: 'Gemini', key: settings.geminiApiKey, fn: generateWithGemini });
  if (settings.groqApiKey) providers.push({ name: 'Groq', key: settings.groqApiKey, fn: generateWithGroq });
  if (settings.huggingfaceApiKey) providers.push({ name: 'HuggingFace', key: settings.huggingfaceApiKey, fn: generateWithHuggingFace });
  if (settings.llmApiKey && providers.length === 0) {
    providers.push({ name: 'Gemini', key: settings.llmApiKey, fn: generateWithGemini });
  }

  const preferred = settings.llmProvider;
  providers.sort((a, b) => {
    if (a.name.toLowerCase() === preferred) return -1;
    if (b.name.toLowerCase() === preferred) return 1;
    return 0;
  });

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      return await provider.fn(systemPrompt, userPrompt, provider.key);
    } catch (err: any) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }

  if (providers.length === 0) {
    return generateFallback(prompt);
  }

  console.warn('All AI providers failed, using template. Errors:', errors);
  return generateFallback(prompt);
}

async function generateWithGemini(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      throw new Error('Gemini free quota exceeded. Please wait a minute and try again, or switch to Groq/HuggingFace in Settings.');
    }
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  text = text.replace(/^```(?:javascript|jsx|js|tsx)?\n?/gm, '').replace(/```\s*$/gm, '').trim();

  return text;
}

async function generateWithGroq(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const response = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 8192,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let text = data.choices?.[0]?.message?.content || '';
  text = text.replace(/^```(?:javascript|jsx|js|tsx)?\n?/gm, '').replace(/```\s*$/gm, '').trim();
  return text;
}

async function generateWithHuggingFace(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const fullPrompt = `<s>[INST] ${systemPrompt}\n\n${userPrompt} [/INST]`;

  const response = await fetch(HUGGINGFACE_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: fullPrompt,
      parameters: {
        max_new_tokens: 4096,
        temperature: 0.7,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 410 || response.status === 404) {
      throw new Error('HuggingFace model is temporarily unavailable. Please try again later or switch to Gemini/Groq in Settings.');
    }
    throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && data[0]?.generated_text) {
    let text = data[0].generated_text;
    text = text.replace(/^```(?:javascript|jsx|js|tsx)?\n?/gm, '').replace(/```\s*$/gm, '').trim();
    return text;
  }
  throw new Error('Unexpected response format from HuggingFace');
}

function generateFallback(prompt: string): string {
  const appName = extractAppName(prompt);
  const description = prompt.trim();
  return `import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, StatusBar, FlatList, Modal, Alert, Dimensions, ScrollView,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function App() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [screen, setScreen] = useState('home');

  const getTimestamp = () => {
    const now = new Date();
    return now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const saveItem = () => {
    if (!title.trim() && !body.trim()) return;
    const timestamp = getTimestamp();
    if (editing) {
      setItems(prev => prev.map(n => n.id === editing
        ? { ...n, title: title.trim(), body: body.trim(), updated: timestamp }
        : n
      ));
    } else {
      setItems(prev => [{
        id: Date.now().toString(),
        title: title.trim(),
        body: body.trim(),
        created: timestamp,
        updated: timestamp,
        category: 'General',
      }, ...prev]);
    }
    closeEditor();
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditing(null);
    setTitle('');
    setBody('');
  };

  const openItem = (item) => {
    setEditing(item.id);
    setTitle(item.title);
    setBody(item.body);
    setShowEditor(true);
  };

  const deleteItem = (id) => {
    Alert.alert('Delete', 'Are you sure you want to delete this?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setItems(prev => prev.filter(n => n.id !== id)) },
    ]);
  };

  const filtered = items.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.body.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={s.header}>
        <View>
          <Text style={s.logo}>${appName}</Text>
          <Text style={s.subtitle}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={() => {
          Alert.alert('About', '${description}\\n\\nBuilt with ZeroBuild AI');
        }}>
          <Text style={s.headerBtnText}>\\u2139</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <Text style={s.searchIcon}>\\u{1F50D}</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search..."
          placeholderTextColor="#64748b"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={s.clearSearch}>\\u2715</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => openItem(item)}
            onLongPress={() => deleteItem(item.id)}
          >
            <View style={s.cardHeader}>
              <Text style={s.cardCategory}>{item.category}</Text>
              <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                <Text style={s.deleteIcon}>\\u{1F5D1}</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.cardTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
            <Text style={s.cardBody} numberOfLines={3}>{item.body || 'No content'}</Text>
            <View style={s.cardFooter}>
              <Text style={s.cardDate}>\\u{1F552} {item.updated}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>\\u{1F4E6}</Text>
            <Text style={s.emptyText}>Nothing here yet</Text>
            <Text style={s.emptyHint}>Tap the + button to get started</Text>
          </View>
        }
      />

      <TouchableOpacity style={s.fab} onPress={() => setShowEditor(true)} activeOpacity={0.8}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showEditor} animationType="slide" onRequestClose={closeEditor}>
        <SafeAreaView style={s.editor}>
          <View style={s.editorHeader}>
            <TouchableOpacity onPress={closeEditor}>
              <Text style={s.editorCancel}>\\u2715 Cancel</Text>
            </TouchableOpacity>
            <Text style={s.editorHeaderTitle}>{editing ? 'Edit' : 'Create New'}</Text>
            <TouchableOpacity onPress={saveItem}>
              <Text style={s.editorSave}>\\u2713 Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.editorBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>Title</Text>
            <TextInput
              style={s.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter a title..."
              placeholderTextColor="#64748b"
              autoFocus
            />
            <Text style={s.fieldLabel}>Details</Text>
            <TextInput
              style={s.bodyInput}
              value={body}
              onChangeText={setBody}
              placeholder="Enter details..."
              placeholderTextColor="#64748b"
              multiline
              textAlignVertical="top"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  logo: { fontSize: 26, fontWeight: '800', color: '#f1f5f9' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: 18, color: '#00d4ff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 14, backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 14, height: 46 },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, color: '#f1f5f9', fontSize: 15 },
  clearSearch: { color: '#64748b', fontSize: 16, padding: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 18, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#00d4ff' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCategory: { fontSize: 11, color: '#00d4ff', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  deleteIcon: { fontSize: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 6 },
  cardBody: { fontSize: 14, color: '#94a3b8', lineHeight: 20, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  cardDate: { fontSize: 12, color: '#475569' },
  empty: { alignItems: 'center', paddingTop: 100 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 20, color: '#64748b', fontWeight: '700' },
  emptyHint: { fontSize: 14, color: '#475569', marginTop: 6 },
  fab: { position: 'absolute', bottom: 30, right: 24, width: 62, height: 62, borderRadius: 31, backgroundColor: '#00d4ff', alignItems: 'center', justifyContent: 'center', elevation: 10, shadowColor: '#00d4ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  fabText: { fontSize: 32, color: '#0f172a', fontWeight: '800', marginTop: -2 },
  editor: { flex: 1, backgroundColor: '#0f172a' },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  editorCancel: { fontSize: 15, color: '#ef4444', fontWeight: '600' },
  editorHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  editorSave: { fontSize: 15, color: '#00d4ff', fontWeight: '700' },
  editorBody: { flex: 1, padding: 20 },
  fieldLabel: { fontSize: 13, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  titleInput: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  bodyInput: { fontSize: 16, color: '#e2e8f0', backgroundColor: '#1e293b', borderRadius: 12, padding: 16, minHeight: 200, lineHeight: 24 },
});
`;
}

function extractAppName(prompt: string): string {
  const words = prompt.split(' ').slice(0, 4);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
