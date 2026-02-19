import { AppSettings } from './types';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const HUGGINGFACE_API = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3';

function buildSystemPrompt(): string {
  return `You are ZeroBuild AI, an expert mobile app code generator. When given an app description, generate a complete, working React Native (Expo) app.

Output ONLY valid code. Do not include explanations, markdown formatting, or code fences. The code should be a single App.js file that can run standalone in Expo Go.

Requirements:
- Use functional components with hooks
- Use StyleSheet for styling
- Use modern, clean UI design with proper spacing
- Include all necessary imports from react-native
- Handle basic state management with useState/useReducer
- Make the UI responsive and production-ready
- Use SafeAreaView for proper layout
- Include placeholder data if needed for demos`;
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
  const userPrompt = `Create a React Native Expo app based on this description:\n\n${prompt}\n\nGenerate the complete App.js code:`;
  const apiKey = getActiveApiKey(settings);

  if (settings.llmProvider === 'gemini' && apiKey) {
    return generateWithGemini(systemPrompt, userPrompt, apiKey);
  }

  if (settings.llmProvider === 'groq' && apiKey) {
    return generateWithGroq(systemPrompt, userPrompt, apiKey);
  }

  if (settings.llmProvider === 'huggingface' && apiKey) {
    return generateWithHuggingFace(systemPrompt, userPrompt, apiKey);
  }

  if (apiKey) {
    return generateWithGemini(systemPrompt, userPrompt, apiKey);
  }

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
  return `import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  FlatList,
} from 'react-native';

export default function App() {
  const [items, setItems] = useState([]);
  const [inputText, setInputText] = useState('');

  const addItem = () => {
    if (inputText.trim()) {
      setItems(prev => [...prev, {
        id: Date.now().toString(),
        text: inputText.trim(),
        done: false,
      }]);
      setInputText('');
    }
  };

  const toggleItem = (id) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, done: !item.done } : item
    ));
  };

  const deleteItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>${appName}</Text>
        <Text style={styles.subtitle}>Built with ZeroBuild AI</Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Add new item..."
          placeholderTextColor="#888"
        />
        <TouchableOpacity style={styles.addButton} onPress={addItem}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <TouchableOpacity
              style={styles.itemContent}
              onPress={() => toggleItem(item.id)}
            >
              <View style={[styles.checkbox, item.done && styles.checkboxDone]} />
              <Text style={[styles.itemText, item.done && styles.itemTextDone]}>
                {item.text}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteItem(item.id)}>
              <Text style={styles.deleteText}>X</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No items yet. Add one above!</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 24, paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#f1f5f9' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  inputRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  input: {
    flex: 1, height: 48, backgroundColor: '#1e293b', borderRadius: 12,
    paddingHorizontal: 16, color: '#f1f5f9', fontSize: 16,
  },
  addButton: {
    width: 48, height: 48, backgroundColor: '#00d4ff', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  addButtonText: { fontSize: 24, color: '#0f172a', fontWeight: '700' },
  list: { paddingHorizontal: 16 },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b',
    borderRadius: 12, padding: 16, marginBottom: 8,
  },
  itemContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#00d4ff',
  },
  checkboxDone: { backgroundColor: '#00d4ff' },
  itemText: { fontSize: 16, color: '#f1f5f9', flex: 1 },
  itemTextDone: { textDecorationLine: 'line-through', color: '#64748b' },
  deleteText: { color: '#ef4444', fontSize: 16, fontWeight: '600', padding: 4 },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#64748b', fontSize: 16 },
});
`;
}

function extractAppName(prompt: string): string {
  const words = prompt.split(' ').slice(0, 4);
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
