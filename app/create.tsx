import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import Colors from '@/constants/colors';
import { useProjects } from '@/lib/project-context';
import { Project } from '@/lib/types';
import { generateCode } from '@/lib/ai-service';

const C = Colors.dark;

const TEMPLATES = [
  { label: 'Todo App', icon: 'checkbox-outline' as const, prompt: 'A modern todo list app with categories, priority levels, and a clean dark interface' },
  { label: 'Weather', icon: 'partly-sunny-outline' as const, prompt: 'A weather dashboard app showing current conditions, hourly forecast, and 5-day forecast with animated icons' },
  { label: 'Notes', icon: 'document-text-outline' as const, prompt: 'A note-taking app with rich text support, categories, search functionality, and a clean minimal design' },
  { label: 'Fitness', icon: 'fitness-outline' as const, prompt: 'A fitness tracker app with workout logging, exercise timer, progress charts, and daily goals' },
  { label: 'Chat UI', icon: 'chatbubbles-outline' as const, prompt: 'A messaging app UI with chat list, message bubbles, typing indicators, and contact profiles' },
  { label: 'Finance', icon: 'wallet-outline' as const, prompt: 'A personal finance tracker with transaction history, budget categories, spending charts, and account balances' },
];

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const { settings, addProject } = useProjects();
  const [appName, setAppName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const promptRef = useRef<TextInput>(null);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleCreate = async () => {
    if (!appName.trim() || !prompt.trim()) {
      setError('Please fill in both the app name and description');
      return;
    }

    setError('');
    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const projectId = Crypto.randomUUID();
    const now = Date.now();

    const project: Project = {
      id: projectId,
      name: appName.trim(),
      description: prompt.trim(),
      prompt: prompt.trim(),
      status: 'generating',
      generatedCode: '',
      githubRepo: '',
      apkUrl: '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      await addProject(project);

      const code = await generateCode(prompt.trim(), settings);

      const updatedProject: Project = {
        ...project,
        status: 'generated',
        generatedCode: code,
        updatedAt: Date.now(),
      };

      await addProject(updatedProject);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/project/[id]', params: { id: projectId } });
    } catch (e: any) {
      const errorProject: Project = {
        ...project,
        status: 'error',
        error: e.message || 'Code generation failed',
        updatedAt: Date.now(),
      };
      await addProject(errorProject);
      setError(e.message || 'Failed to generate code. Check your API settings.');
      setIsGenerating(false);
    }
  };

  const selectTemplate = (template: typeof TEMPLATES[0]) => {
    setPrompt(template.prompt);
    if (!appName) setAppName(template.label);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={C.textSecondary} />
        </Pressable>
        <Text style={styles.topTitle}>New Project</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.label}>App Name</Text>
          <TextInput
            style={styles.input}
            value={appName}
            onChangeText={setAppName}
            placeholder="My Awesome App"
            placeholderTextColor={C.textMuted}
            returnKeyType="next"
            onSubmitEditing={() => promptRef.current?.focus()}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Describe Your App</Text>
          <TextInput
            ref={promptRef}
            style={[styles.input, styles.textArea]}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Describe the app you want to build. Be specific about features, design, and functionality..."
            placeholderTextColor={C.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Quick Templates</Text>
          <View style={styles.templateGrid}>
            {TEMPLATES.map((t) => (
              <Pressable
                key={t.label}
                style={({ pressed }) => [
                  styles.templateCard,
                  prompt === t.prompt && styles.templateCardActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => selectTemplate(t)}
              >
                <Ionicons
                  name={t.icon}
                  size={20}
                  color={prompt === t.prompt ? C.accent : C.textSecondary}
                />
                <Text
                  style={[
                    styles.templateLabel,
                    prompt === t.prompt && { color: C.accent },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {!settings.llmApiKey ? (
          <View style={styles.warningBox}>
            <Feather name="info" size={16} color={C.warning} />
            <Text style={styles.warningText}>
              No AI API key configured. A template app will be generated. Add your Groq or HuggingFace API key in Settings for AI-powered code generation.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.createBtn,
            (!appName.trim() || !prompt.trim() || isGenerating) && styles.createBtnDisabled,
            pressed && { opacity: 0.9 },
          ]}
          onPress={handleCreate}
          disabled={!appName.trim() || !prompt.trim() || isGenerating}
        >
          <LinearGradient
            colors={isGenerating ? [C.surfaceElevated, C.surfaceElevated] : ['#00D4FF', '#0099CC']}
            style={styles.createBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {isGenerating ? (
              <>
                <ActivityIndicator size="small" color={C.accent} />
                <Text style={[styles.createBtnText, { color: C.accent }]}>Generating Code...</Text>
              </>
            ) : (
              <>
                <Ionicons name="flash" size={20} color="#0A0E1A" />
                <Text style={styles.createBtnText}>Generate App</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 17,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  textArea: {
    height: 140,
    paddingTop: 16,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  templateCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentDim,
  },
  templateLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.textSecondary,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.warningDim,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.warning,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.errorDim,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.error,
    lineHeight: 20,
  },
  createBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
  },
  createBtnText: {
    fontSize: 17,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#0A0E1A',
  },
});
