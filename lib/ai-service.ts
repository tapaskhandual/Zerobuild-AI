import { AppSettings } from './types';

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
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
            generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
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
          max_tokens: 8192,
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
