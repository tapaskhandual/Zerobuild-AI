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
      max_tokens: 4096,
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
  const lower = prompt.toLowerCase();

  if (lower.includes('note') || lower.includes('notepad') || lower.includes('memo')) {
    return generateNotepadFallback(appName);
  }
  if (lower.includes('calculator') || lower.includes('calc')) {
    return generateCalculatorFallback(appName);
  }
  return generateNotepadFallback(appName);
}

function generateNotepadFallback(appName: string): string {
  return `import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, StatusBar, FlatList, Modal, Alert, Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function App() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  const saveNote = () => {
    if (!title.trim() && !body.trim()) return;
    const now = new Date();
    const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    if (editing) {
      setNotes(prev => prev.map(n => n.id === editing ? { ...n, title: title.trim(), body: body.trim(), updated: timestamp } : n));
    } else {
      setNotes(prev => [{ id: Date.now().toString(), title: title.trim(), body: body.trim(), created: timestamp, updated: timestamp }, ...prev]);
    }
    closeEditor();
  };

  const closeEditor = () => { setShowEditor(false); setEditing(null); setTitle(''); setBody(''); };

  const openNote = (note) => { setEditing(note.id); setTitle(note.title); setBody(note.body); setShowEditor(true); };

  const deleteNote = (id) => {
    Alert.alert('Delete Note', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setNotes(prev => prev.filter(n => n.id !== id)) },
    ]);
  };

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.body.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={s.header}>
        <Text style={s.logo}>{appName}</Text>
        <Text style={s.count}>{notes.length} notes</Text>
      </View>
      <View style={s.searchRow}>
        <Text style={s.searchIcon}>\\u{1F50D}</Text>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search notes..." placeholderTextColor="#64748b" />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => openNote(item)} onLongPress={() => deleteNote(item.id)}>
            <Text style={s.cardTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
            <Text style={s.cardBody} numberOfLines={2}>{item.body || 'No content'}</Text>
            <Text style={s.cardDate}>{item.updated}</Text>
          </TouchableOpacity>
        )}
        numColumns={2}
        columnWrapperStyle={s.row}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyIcon}>\\u{1F4DD}</Text><Text style={s.emptyText}>No notes yet</Text><Text style={s.emptyHint}>Tap + to create your first note</Text></View>}
      />
      <TouchableOpacity style={s.fab} onPress={() => setShowEditor(true)}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
      <Modal visible={showEditor} animationType="slide" onRequestClose={closeEditor}>
        <SafeAreaView style={s.editor}>
          <View style={s.editorHeader}>
            <TouchableOpacity onPress={closeEditor}><Text style={s.editorCancel}>Cancel</Text></TouchableOpacity>
            <Text style={s.editorTitle}>{editing ? 'Edit Note' : 'New Note'}</Text>
            <TouchableOpacity onPress={saveNote}><Text style={s.editorSave}>Save</Text></TouchableOpacity>
          </View>
          <TextInput style={s.titleInput} value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor="#64748b" autoFocus />
          <TextInput style={s.bodyInput} value={body} onChangeText={setBody} placeholder="Start writing..." placeholderTextColor="#64748b" multiline textAlignVertical="top" />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 12 },
  logo: { fontSize: 26, fontWeight: '800', color: '#f1f5f9' },
  count: { fontSize: 14, color: '#64748b' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1e293b', borderRadius: 12, paddingHorizontal: 14, height: 44 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: '#f1f5f9', fontSize: 15 },
  list: { paddingHorizontal: 12, paddingBottom: 100 },
  row: { justifyContent: 'space-between' },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 12, width: (width - 44) / 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', marginBottom: 6 },
  cardBody: { fontSize: 13, color: '#94a3b8', marginBottom: 10, lineHeight: 18 },
  cardDate: { fontSize: 11, color: '#475569' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, color: '#64748b', fontWeight: '600' },
  emptyHint: { fontSize: 14, color: '#475569', marginTop: 4 },
  fab: { position: 'absolute', bottom: 30, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: '#00d4ff', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  fabText: { fontSize: 32, color: '#0f172a', fontWeight: '700', marginTop: -2 },
  editor: { flex: 1, backgroundColor: '#0f172a' },
  editorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  editorCancel: { fontSize: 16, color: '#ef4444' },
  editorTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9' },
  editorSave: { fontSize: 16, color: '#00d4ff', fontWeight: '700' },
  titleInput: { fontSize: 22, fontWeight: '700', color: '#f1f5f9', padding: 20, paddingBottom: 8 },
  bodyInput: { flex: 1, fontSize: 16, color: '#e2e8f0', padding: 20, paddingTop: 8, lineHeight: 24 },
});
`;
}

function generateCalculatorFallback(appName: string): string {
  return `import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, StatusBar, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const BTN = (width - 80) / 4;

export default function App() {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [reset, setReset] = useState(false);

  const tap = (val) => {
    if (reset) { setDisplay(val); setReset(false); return; }
    setDisplay(display === '0' ? val : display + val);
  };

  const decimal = () => { if (!display.includes('.')) setDisplay(display + '.'); };

  const operate = (nextOp) => {
    if (prev !== null && op) { calculate(); }
    setPrev(parseFloat(display));
    setOp(nextOp);
    setReset(true);
  };

  const calculate = () => {
    if (prev === null || !op) return;
    const curr = parseFloat(display);
    let result = 0;
    if (op === '+') result = prev + curr;
    else if (op === '-') result = prev - curr;
    else if (op === '*') result = prev * curr;
    else if (op === '/') result = curr !== 0 ? prev / curr : 0;
    setDisplay(String(parseFloat(result.toFixed(8))));
    setPrev(null);
    setOp(null);
    setReset(true);
  };

  const clear = () => { setDisplay('0'); setPrev(null); setOp(null); };
  const percent = () => setDisplay(String(parseFloat(display) / 100));
  const negate = () => setDisplay(String(parseFloat(display) * -1));

  const Btn = ({ label, onPress, style, textStyle }) => (
    <TouchableOpacity style={[s.btn, style]} onPress={onPress}>
      <Text style={[s.btnText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={s.displayBox}><Text style={s.display} numberOfLines={1} adjustsFontSizeToFit>{display}</Text></View>
      <View style={s.grid}>
        <View style={s.row}><Btn label="AC" onPress={clear} style={s.gray} textStyle={s.dark}/><Btn label="+/-" onPress={negate} style={s.gray} textStyle={s.dark}/><Btn label="%" onPress={percent} style={s.gray} textStyle={s.dark}/><Btn label="\\u00F7" onPress={()=>operate('/')} style={s.orange}/></View>
        <View style={s.row}><Btn label="7" onPress={()=>tap('7')}/><Btn label="8" onPress={()=>tap('8')}/><Btn label="9" onPress={()=>tap('9')}/><Btn label="\\u00D7" onPress={()=>operate('*')} style={s.orange}/></View>
        <View style={s.row}><Btn label="4" onPress={()=>tap('4')}/><Btn label="5" onPress={()=>tap('5')}/><Btn label="6" onPress={()=>tap('6')}/><Btn label="-" onPress={()=>operate('-')} style={s.orange}/></View>
        <View style={s.row}><Btn label="1" onPress={()=>tap('1')}/><Btn label="2" onPress={()=>tap('2')}/><Btn label="3" onPress={()=>tap('3')}/><Btn label="+" onPress={()=>operate('+')} style={s.orange}/></View>
        <View style={s.row}><Btn label="0" onPress={()=>tap('0')} style={{width:BTN*2+16}}/><Btn label="." onPress={decimal}/><Btn label="=" onPress={calculate} style={s.orange}/></View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end' },
  displayBox: { paddingHorizontal: 24, paddingBottom: 16, alignItems: 'flex-end' },
  display: { fontSize: 72, color: '#fff', fontWeight: '300' },
  grid: { paddingHorizontal: 16, paddingBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  btn: { width: BTN, height: BTN, borderRadius: BTN/2, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 28, color: '#fff', fontWeight: '500' },
  gray: { backgroundColor: '#a5a5a5' },
  dark: { color: '#000' },
  orange: { backgroundColor: '#ff9500' },
});
`;
}

function extractAppName(prompt: string): string {
  const words = prompt.split(' ').slice(0, 4);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
