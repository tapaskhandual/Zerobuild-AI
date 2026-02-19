import { AppSettings } from './types';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const HUGGINGFACE_API = 'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3';

function buildSystemPrompt(): string {
  return `You are ZeroBuild AI. You generate PRODUCTION-READY, app-store-quality React Native Android apps. Every app you generate should look and feel like a top-rated app on the Google Play Store with 4.5+ stars.

OUTPUT RULES:
- Output ONLY valid JavaScript/JSX code. No explanations, no markdown, no code fences.
- Output a single complete App.js file.
- ONLY use these imports:
  import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
  import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, StatusBar, FlatList, Modal, Alert, Animated, ScrollView, Image, Dimensions, Switch, Platform, ActivityIndicator, Pressable, SectionList, Linking } from 'react-native';
- Do NOT import from expo, @expo, or any third-party library.
- Do NOT use AsyncStorage or any external storage.

═══════════════════════════════════════════════
PRODUCTION-READY APP STANDARDS
═══════════════════════════════════════════════

SCOPE & SIZE:
- Generate 800-1500 lines of well-structured code. Complex apps should be 1200+ lines.
- Build 6-10 distinct screens/views minimum.
- Include ALL screens a real version of this app would need: onboarding/welcome, main dashboard, list views with search, detail views, create/edit modals, user profile, settings, about/help.

NAVIGATION & LAYOUT:
- Build a custom BOTTOM TAB BAR with 4-5 tabs (Home, Search/Explore, Add/Create, Activity/History, Profile/Settings).
- Each tab should have its own complete screen with full functionality.
- Use state-based navigation: const [activeTab, setActiveTab] = useState('home') and const [currentScreen, setCurrentScreen] = useState(null) for sub-screens.
- Include a consistent HEADER component on every screen with title, back button (on sub-screens), and action buttons.
- Support drill-down navigation: list → detail → edit, with proper back navigation.

DATA & STATE:
- Include 15-25 REALISTIC sample data items with varied, believable content (real-sounding names, addresses, descriptions, prices, ratings, dates).
- Implement FULL CRUD: Create with multi-field forms, Read with list/detail views, Update with pre-filled edit forms, Delete with confirmation dialogs.
- Add Search with real-time text filtering across multiple fields.
- Add Filter chips/buttons (by category, status, price range, rating, date).
- Add Sort options (by name, date, price, rating, distance, popularity).
- Track user interactions: favorites/bookmarks, recent views, history.

PRODUCTION UI/UX:
- Theme: background #0f172a, surface #1e293b, elevated #263548, accent #00d4ff, text #f1f5f9, secondary #94a3b8, muted #64748b, success #22c55e, warning #f59e0b, danger #ef4444
- Use Unicode icons throughout: \\u{1F3E0}(home) \\u{1F50D}(search) \\u2795(add) \\u{1F4CB}(activity) \\u{1F464}(profile) \\u2B50(star) \\u{1F4CD}(location) \\u{1F4B0}(price) \\u2764(heart) \\u{1F514}(notification) \\u2699(settings) \\u{1F4CA}(stats) \\u{1F5D1}(delete) \\u270F(edit) \\u{1F4F7}(photo) \\u{1F4DE}(phone) \\u2705(check) \\u274C(close) \\u{1F504}(refresh) \\u{1F4AC}(chat) \\u{1F4E4}(share) \\u{1F512}(lock) \\u23F0(time) \\u{1F4C5}(calendar)
- Cards with shadows: elevation 3, shadowColor '#000', shadowOffset {width:0,height:2}, shadowOpacity 0.25, shadowRadius 3.84
- Rounded corners: borderRadius 16 for cards, 12 for buttons, 25 for chips/badges
- Proper spacing: padding 16-20, margins 12-16, gap between elements
- ANIMATED transitions between screens using Animated API (fadeIn, slideIn)
- Pull-to-refresh simulation on list screens
- Loading states with ActivityIndicator and skeleton-like placeholders
- Toast/snackbar notifications for actions (saved, deleted, added to favorites)
- Badge counts on tab icons for notifications/activity

ADVANCED FEATURES (include 3-5 of these depending on app type):
- Star rating component (touchable stars 1-5)
- Progress bars / stat bars using View width percentages
- Bar charts using colored View elements for data visualization
- Image placeholders using colored View with icon text
- Swipe-hint cards or horizontal ScrollView carousels
- Tag/chip components for categories
- Toggle switches for settings
- Date/time display with relative formatting ("2 hours ago", "Yesterday")
- Price formatting with currency symbols
- Distance/location formatting
- Percentage badges and status indicators
- Action sheets with multiple options
- Multi-step forms with progress indicators
- Empty states with icon, message, and CTA button

CODE ARCHITECTURE:
- Organize: // ═══ THEME ═══, // ═══ SAMPLE DATA ═══, // ═══ UTILITY FUNCTIONS ═══, // ═══ REUSABLE COMPONENTS ═══, // ═══ SCREEN COMPONENTS ═══, // ═══ MAIN APP ═══
- Extract reusable components: Header, TabBar, Card, Button, Badge, SearchBar, RatingStars, EmptyState, Toast, FilterChip, StatBar
- Helper functions: formatDate(), formatCurrency(), formatDistance(), getTimeAgo(), generateId()
- Keep component logic clean with useCallback and useMemo where appropriate
- Use consistent naming conventions throughout

CRITICAL SYNTAX RULES (your code will be compiled by Babel - ANY syntax error will FAIL the build):
- NEVER use CSS units in JavaScript. Write 16 not 16px, write 1 not 1rem, write 100 not 100vh. React Native uses unitless numbers.
- NEVER use CSS percentage values as bare numbers. Use string '50%' with quotes, or just use numeric values.
- NEVER use object keys starting with numbers without quotes. Use '2xl' not 2xl.
- NEVER leave trailing commas before closing braces/brackets: {a: 1,} is WRONG, {a: 1} is RIGHT.
- ALWAYS close every { with }, every ( with ), every [ with ]. Count your brackets.
- ALWAYS make sure every JSX tag is properly closed: <View></View> or <View />
- ALWAYS end the file with: export default App;
- ALWAYS include the StyleSheet.create() call and close it properly.
- Double-check all template literals, ternary expressions, and arrow functions are complete.
- Make sure every const/let/function declaration is complete and terminated with ;
- NEVER use optional chaining (?.) or nullish coalescing (??) - use explicit checks instead.
- NEVER use numeric separators (1_000). Write 1000 instead.`;
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
  const userPrompt = `Build a PRODUCTION-READY React Native Android app for this idea:

"${prompt}"

MANDATORY CHECKLIST - your app MUST include ALL of these:
1. BOTTOM TAB BAR with 4-5 tabs for main navigation
2. HOME SCREEN with dashboard/overview showing key stats and recent activity
3. LIST/BROWSE SCREEN with search bar, filter chips, and sort options - populated with 15-20 realistic sample items
4. DETAIL SCREEN showing full info when tapping any item, with action buttons (edit, delete, favorite, share)
5. CREATE/ADD SCREEN with a complete multi-field form and validation
6. PROFILE/SETTINGS SCREEN with toggleable preferences and app info
7. Full CRUD operations - create, view, edit, delete with confirmation
8. FAVORITES system - users can heart/bookmark items
9. Animated screen transitions and visual feedback on all touches
10. Toast/snackbar component for success/error messages

Think about what the #1 app in this category on Google Play Store would look like. Build THAT level of quality and completeness. The app must feel REAL and fully functional with sample data.

Generate 800-1500 lines of production-quality code. Output ONLY code.`;

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
      if (code && code.length > 500) {
        const lineCount = code.split('\n').length;
        if (lineCount < 200) {
          errors.push(`${provider.name}: generated too little code (${lineCount} lines). Trying next provider...`);
          continue;
        }
        return code;
      }
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

        if (text.length < 500) {
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

      if (text.length < 500) {
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

  const lastExport = text.lastIndexOf('export default');
  const lastStyleEnd = text.lastIndexOf('});');
  const cutPoint = Math.max(lastExport, lastStyleEnd);

  if (cutPoint > 0) {
    let endIdx = cutPoint;
    if (text.substring(cutPoint).startsWith('export default')) {
      const semiAfter = text.indexOf(';', cutPoint);
      if (semiAfter > 0) endIdx = semiAfter + 1;
    } else {
      endIdx = cutPoint + 3;
    }
    const afterEnd = text.substring(endIdx).trim();
    if (afterEnd && !afterEnd.startsWith('export') && !afterEnd.startsWith('const') && !afterEnd.startsWith('function') && !afterEnd.startsWith('//')) {
      text = text.substring(0, endIdx);
    }
  }

  text = fixCommonSyntaxErrors(text);
  return text.trim();
}

function fixCommonSyntaxErrors(code: string): string {
  code = code.replace(/,(\s*[}\]])/g, '$1');

  code = code.replace(/(\d+)(px|em|rem|vh|vw|pt|dp|sp)\b/g, '$1');

  code = code.replace(/:\s*(\d+)%\s*([,;}])/g, ': $1$2');
  code = code.replace(/'(\d+)%'/g, "'$1%'");

  code = code.replace(/(?<![a-zA-Z_$"'`])(\d+)\s+(seconds?|minutes?|hours?|items?|times?|days?)\b/g, '$1');

  code = code.replace(/{\s*(\d+[a-zA-Z]+)\s*:/g, (match, key) => {
    return `{ '${key}':`;
  });
  code = code.replace(/,\s*(\d+[a-zA-Z]+)\s*:/g, (match, key) => {
    return `, '${key}':`;
  });

  code = code.replace(/\/\/.*$/gm, (match) => {
    return match.replace(/[^\x00-\x7F]/g, '');
  });

  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : '';

    if (inString) {
      if (ch === stringChar && prev !== '\\') inString = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '`' && prev !== '\\') inTemplate = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
    if (ch === '`') { inTemplate = true; continue; }

    if (ch === '{') braceCount++;
    else if (ch === '}') braceCount--;
    else if (ch === '(') parenCount++;
    else if (ch === ')') parenCount--;
    else if (ch === '[') bracketCount++;
    else if (ch === ']') bracketCount--;
  }

  while (braceCount > 0) { code += '\n}'; braceCount--; }
  while (parenCount > 0) { code += ')'; parenCount--; }
  while (bracketCount > 0) { code += ']'; bracketCount--; }

  code = code.replace(/export\s+default\s+App\s*;?\s*\n[\s\S]*$/, 'export default App;');

  if (!code.match(/export\s+default\s/)) {
    const appMatch = code.match(/(?:const|function|class)\s+(App)\b/);
    if (appMatch) {
      code += '\n\nexport default App;';
    }
  }

  return code;
}
