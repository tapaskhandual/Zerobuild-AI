import { AppSettings } from './types';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const HUGGINGFACE_API = 'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3';

function buildSystemPrompt(): string {
  return `You are ZeroBuild AI, a world-class Android app code generator. You create LARGE, feature-rich, production-quality React Native apps. You build EXACTLY what the user asks for with ALL the features a real user would expect.

Output ONLY valid JavaScript/JSX code. No explanations, no markdown, no code fences (\`\`\`). Output a single complete App.js file.

IMPORTS - ONLY use these:
- import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
- import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, StatusBar, FlatList, Modal, Alert, Animated, ScrollView, Image, Dimensions, Switch, Platform, ActivityIndicator, Pressable, SectionList, Linking } from 'react-native';
- Do NOT import from expo, @expo, or any third-party library
- Do NOT use AsyncStorage or any external storage

CRITICAL APP QUALITY RULES:
1. BUILD A COMPLETE APP with at least 5-8 distinct screens/views. Think about EVERY screen a real version of this app would have: home, detail views, create/edit forms, settings, profiles, search results, etc.
2. Generate AT LEAST 500-800 lines of well-structured code. More complex apps should be 800-1200+ lines. NEVER generate less than 400 lines.
3. Design it like a TOP-RATED app on Google Play Store - polished, intuitive, professional, with smooth user flows.
4. Include a proper BOTTOM TAB BAR or NAVIGATION DRAWER for main sections. Don't just use a single screen.
5. Every data-driven app needs: Create, Read, Update, Delete, Search, Filter, Sort capabilities.
6. Include REALISTIC sample data (10-20 items) that demonstrates the app working. Use realistic names, descriptions, prices, dates, etc.
7. Add a SETTINGS screen with relevant options for the app type.
8. Include STATISTICS/DASHBOARD views where appropriate (counts, charts using View-based bar charts, totals, averages).
9. Add proper FORM VALIDATION for all user inputs with error messages.
10. Include CONFIRMATION DIALOGS for destructive actions (delete, cancel, etc.).

UI/UX RULES:
11. Use a modern dark theme: background #0f172a, cards #1e293b, accent #00d4ff, text #f1f5f9, muted #64748b, success #22c55e, warning #f59e0b, danger #ef4444
12. Use Unicode symbols for icons: \\u2795 (+), \\u{1F50D} (search), \\u2699 (settings), \\u2764 (heart), \\u{1F4DD} (note), \\u2705 (check), \\u{1F4CD} (pin), \\u{1F4B0} (money), \\u{1F4CA} (chart), \\u{1F464} (person), \\u{1F514} (bell), \\u2B50 (star), \\u{1F3E0} (home), \\u{1F504} (refresh)
13. Use proper screen navigation with state: const [screen, setScreen] = useState('home')
14. Build a BOTTOM TAB BAR component with 3-5 tabs for main navigation
15. Add pull-to-refresh behavior, loading states, and smooth transitions using Animated API
16. Use cards with proper spacing (padding 16-20), rounded corners (borderRadius 12-16), subtle elevation shadows
17. Include search bars with real-time filtering on list screens
18. Add empty states with helpful messages and action buttons
19. Make all interactive elements have visual feedback (opacity changes, color changes)
20. Include a STATUS BAR setup and SafeAreaView wrapping

ARCHITECTURE:
21. Organize code with clear sections: // --- CONSTANTS ---, // --- COMPONENTS ---, // --- SCREENS ---, // --- MAIN APP ---
22. Extract reusable components (Card, Button, Header, TabBar, Badge, etc.)
23. Use proper state management with useState for all interactive features
24. Add helper functions for formatting (dates, currency, distances, etc.)
25. Include proper TypeScript-compatible patterns (even though it's JS)`;
}

function getActiveApiKey(settings: AppSettings): string {
  switch (settings.llmProvider) {
    case 'gemini': return settings.geminiApiKey || settings.llmApiKey;
    case 'groq': return settings.groqApiKey || settings.llmApiKey;
    case 'huggingface': return settings.huggingfaceApiKey || settings.llmApiKey;
    default: return settings.llmApiKey;
  }
}

export interface ClarifyQuestion {
  question: string;
  options: string[];
}

export async function generateClarifications(prompt: string, settings: AppSettings): Promise<ClarifyQuestion[]> {
  const systemPrompt = `You are a senior product manager analyzing a mobile app idea. Ask 3-4 smart, SPECIFIC follow-up questions to understand exactly what features and screens the app needs. Each question must have 3-4 concrete answer options.

Return ONLY a valid JSON array. No markdown, no code fences, no explanation. Example format:
[{"question":"What should the home screen show first?","options":["Interactive map with pins","Scrollable list of nearby spots","Dashboard with statistics and quick actions"]},{"question":"How should users find what they need?","options":["Search by name or address","Filter by category, price, and distance","Both search and smart filters"]}]

RULES FOR GOOD QUESTIONS:
- Ask about SPECIFIC features the user probably hasn't thought of yet (notifications, favorites, history, profiles, sharing)
- Ask about the PRIMARY USER FLOW - what's the main thing users do step by step?
- Ask about DATA - what information should each item show? What details matter?
- Ask about SPECIAL FEATURES that would make this app stand out (ratings, reviews, maps, charts, export, social features)
- Make options CONCRETE and DIFFERENT from each other - each option should lead to a meaningfully different app
- Don't ask generic questions like "what color theme?" or "how many screens?" - ask about FUNCTIONALITY`;

  const userPrompt = `App idea: "${prompt}"\n\nGenerate 3-4 clarifying questions with options. Return ONLY the JSON array.`;

  const providers: { name: string; key: string; fn: (s: string, u: string, k: string) => Promise<string> }[] = [];

  if (settings.geminiApiKey) providers.push({ name: 'Gemini', key: settings.geminiApiKey, fn: generateWithGeminiLite });
  if (settings.groqApiKey) providers.push({ name: 'Groq', key: settings.groqApiKey, fn: generateWithGroqFast });
  if (settings.huggingfaceApiKey) providers.push({ name: 'HuggingFace', key: settings.huggingfaceApiKey, fn: generateWithHuggingFace });
  if (settings.llmApiKey && providers.length === 0) {
    providers.push({ name: 'Gemini', key: settings.llmApiKey, fn: generateWithGeminiLite });
  }

  const preferred = settings.llmProvider;
  providers.sort((a, b) => {
    if (a.name.toLowerCase() === preferred) return -1;
    if (b.name.toLowerCase() === preferred) return 1;
    return 0;
  });

  if (providers.length === 0) {
    throw new Error('No AI API keys configured. Go to Settings and add at least one API key.');
  }

  for (const provider of providers) {
    try {
      const raw = await provider.fn(systemPrompt, userPrompt, provider.key);
      const cleaned = raw.replace(/^```(?:json)?\s*\n?/gm, '').replace(/```\s*$/gm, '').trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length >= 2 && parsed[0].question && parsed[0].options) {
        return parsed.slice(0, 4).map((q: any) => ({
          question: String(q.question),
          options: (q.options || []).slice(0, 4).map(String),
        }));
      }
    } catch (err: any) {
      console.warn(`Clarification from ${provider.name} failed:`, err.message);
    }
  }

  return getDefaultClarifications(prompt);
}

function getDefaultClarifications(prompt: string): ClarifyQuestion[] {
  return [
    {
      question: 'What should users see on the home screen?',
      options: ['List of items with search', 'Dashboard with stats and quick actions', 'Feed with cards and filters', 'Map or visual overview'],
    },
    {
      question: 'What key features should the app include?',
      options: ['Favorites, ratings, and reviews', 'Booking or scheduling system', 'Categories with filtering and sorting', 'History tracking and analytics'],
    },
    {
      question: 'What extra features would make this app stand out?',
      options: ['Price comparison and deals', 'User profiles with activity history', 'Notifications and reminders', 'Social sharing and recommendations'],
    },
  ];
}

async function generateWithGeminiLite(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const url = `${GEMINI_BASE}/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });
  if (!response.ok) throw new Error(`Gemini Lite: HTTP ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generateWithGroqFast(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
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
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });
  if (!response.ok) throw new Error(`Groq: HTTP ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function generateCode(prompt: string, settings: AppSettings): Promise<string> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = `Build a COMPLETE, LARGE React Native Android app for the following idea. This must be a full-featured app with multiple screens, navigation, and all the functionality a real user would expect.

App idea: "${prompt}"

REQUIREMENTS:
- Build ALL screens this type of app needs (at minimum: home/dashboard, list views, detail views, create/edit forms, settings)
- Include a bottom tab bar with 3-5 main sections
- Add realistic sample data (15-20 items) so the app looks populated and functional
- Include search, filter, and sort on list screens
- Add statistics/summary dashboard where it makes sense
- Make it 500-1000+ lines of well-organized code
- Every feature should be fully interactive and working

Think about what a REAL version of this app on the Google Play Store would look like. Build that. Output ONLY code, no explanations.`;

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

  if (providers.length === 0) {
    throw new Error('No AI API keys configured. Go to Settings and add at least one API key (Gemini, Groq, or HuggingFace). All are free!');
  }

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const code = await provider.fn(systemPrompt, userPrompt, provider.key);
      if (code && code.length > 100) return code;
      errors.push(`${provider.name}: returned insufficient code`);
    } catch (err: any) {
      console.warn(`${provider.name} failed:`, err.message);
      errors.push(`${provider.name}: ${err.message}`);
    }
  }

  const errorSummary = errors.join('\n');
  
  if (errorSummary.includes('quota exceeded') || errorSummary.includes('rate limit') || errorSummary.includes('429')) {
    throw new Error(
      'AI rate limit reached. Options:\n\n' +
      '1. Wait 1-2 minutes and try again\n' +
      '2. Add another free AI key in Settings (Groq is fastest)\n' +
      '3. If using Gemini, the free tier allows ~10 requests/minute'
    );
  }

  if (errorSummary.includes('invalid') || errorSummary.includes('401') || errorSummary.includes('403')) {
    throw new Error(
      'Your AI API key appears to be invalid or expired.\n\n' +
      'Go to Settings and check your API key. Make sure you copied the full key.'
    );
  }

  throw new Error(
    'Code generation failed. Details:\n' + errors.map(e => `- ${e}`).join('\n') +
    '\n\nTry again, or add another AI provider key in Settings.'
  );
}

async function generateWithGemini(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  let lastError = '';

  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 32768 },
          }),
        });

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000 * (attempt + 1);
          lastError = `Rate limited on ${model}`;
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 15000)));
            continue;
          }
          break;
        }

        if (response.status === 400) {
          let errorMsg = '';
          try {
            const errorText = await response.text();
            const errJson = JSON.parse(errorText);
            errorMsg = errJson?.error?.message || errorText;
          } catch {}
          lastError = `Bad request on ${model}: ${errorMsg}`;
          break;
        }

        if (response.status === 403) {
          throw new Error('Gemini API key is invalid or doesn\'t have access. Check your key in Settings.');
        }

        if (response.status === 401) {
          throw new Error('Gemini API key is invalid. Please get a new key from ai.google.dev');
        }

        if (!response.ok) {
          lastError = `Gemini ${model} error: HTTP ${response.status}`;
          break;
        }

        const data = await response.json();

        if (data.error) {
          lastError = `Gemini error: ${data.error.message || JSON.stringify(data.error)}`;
          break;
        }

        const candidate = data.candidates?.[0];
        if (!candidate) {
          const blockReason = data.promptFeedback?.blockReason;
          if (blockReason) {
            throw new Error(`Gemini blocked this request (${blockReason}). Try rephrasing your app description.`);
          }
          lastError = `${model} returned no candidates`;
          break;
        }

        if (candidate.finishReason === 'SAFETY') {
          throw new Error('Gemini blocked this for safety reasons. Try rephrasing your app idea.');
        }

        let text = candidate.content?.parts?.[0]?.text || '';
        text = cleanCodeResponse(text);

        if (text.length < 100) {
          lastError = `${model} returned too little code (${text.length} chars)`;
          break;
        }

        return text;
      } catch (e: any) {
        if (e.message?.includes('invalid') || e.message?.includes('blocked') || e.message?.includes('safety')) {
          throw e;
        }
        lastError = e.message || 'Unknown error';
        if (attempt < 2) continue;
      }
    }
  }

  throw new Error(lastError || 'Gemini failed on all models');
}

async function generateWithGroq(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
  let lastError = '';

  for (const model of models) {
    try {
      const response = await fetch(GROQ_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 32768,
          temperature: 0.7,
        }),
      });

      if (response.status === 429) {
        lastError = 'Groq rate limit hit';
        await new Promise(resolve => setTimeout(resolve, 3000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new Error('Groq API key is invalid. Get a free key at console.groq.com');
        }
        lastError = `Groq ${model}: HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();
      let text = data.choices?.[0]?.message?.content || '';
      text = cleanCodeResponse(text);

      if (text.length < 100) {
        lastError = `Groq ${model}: response too short`;
        continue;
      }

      return text;
    } catch (e: any) {
      if (e.message?.includes('invalid')) throw e;
      lastError = e.message || 'Unknown error';
    }
  }

  throw new Error(lastError || 'Groq failed on all models');
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
    if (response.status === 401) {
      throw new Error('HuggingFace API key is invalid. Get a free key at huggingface.co/settings/tokens');
    }
    if (response.status === 429) {
      throw new Error('HuggingFace rate limit hit. Wait a minute and try again.');
    }
    if (response.status === 410 || response.status === 404 || response.status === 503) {
      throw new Error('HuggingFace model is loading or unavailable. Try again in 30 seconds.');
    }
    const errorText = await response.text();
    throw new Error(`HuggingFace error: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && data[0]?.generated_text) {
    let text = data[0].generated_text;
    text = cleanCodeResponse(text);
    if (text.length < 100) {
      throw new Error('HuggingFace returned too little code. This model may be too small for complex apps.');
    }
    return text;
  }
  throw new Error('Unexpected response format from HuggingFace');
}

function cleanCodeResponse(text: string): string {
  text = text.replace(/^```(?:javascript|jsx|js|tsx|react)?\s*\n?/gm, '');
  text = text.replace(/```\s*$/gm, '');
  text = text.replace(/^[\s\S]*?(import\s+React)/m, '$1');
  const lastBrace = text.lastIndexOf('});');
  if (lastBrace > 0) {
    const afterBrace = text.substring(lastBrace + 3).trim();
    if (afterBrace && !afterBrace.startsWith('export') && !afterBrace.startsWith('const') && !afterBrace.startsWith('function')) {
      text = text.substring(0, lastBrace + 3);
    }
  }
  return text.trim();
}
