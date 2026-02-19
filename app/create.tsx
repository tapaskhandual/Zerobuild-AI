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
  FlatList,
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
import { generateCode, generateClarifications, ClarifyQuestion } from '@/lib/ai-service';

const C = Colors.dark;

type Step = 'describe' | 'clarify' | 'generate';

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
  const [step, setStep] = useState<Step>('describe');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const promptRef = useRef<TextInput>(null);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleNext = async () => {
    if (!appName.trim() || !prompt.trim()) {
      setError('Please fill in both the app name and description');
      return;
    }
    setError('');
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const clarifications = await generateClarifications(prompt.trim(), settings);
      setQuestions(clarifications);
      setAnswers({});
      setStep('clarify');
    } catch (e: any) {
      setError(e.message || 'Failed to analyze your request.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (questionIndex: number, option: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnswers(prev => {
      if (prev[questionIndex] === option) {
        const next = { ...prev };
        delete next[questionIndex];
        return next;
      }
      return { ...prev, [questionIndex]: option };
    });
  };

  const handleGenerate = async () => {
    setError('');
    setIsLoading(true);
    setStep('generate');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const clarificationText = questions
      .map((q, i) => {
        const answer = answers[i];
        if (answer) return `${q.question} → ${answer}`;
        return null;
      })
      .filter(Boolean)
      .join('\n');

    const enrichedPrompt = clarificationText
      ? `${prompt.trim()}\n\nAdditional requirements:\n${clarificationText}`
      : prompt.trim();

    const projectId = Crypto.randomUUID();
    const now = Date.now();

    const project: Project = {
      id: projectId,
      name: appName.trim(),
      description: prompt.trim(),
      prompt: enrichedPrompt,
      status: 'generating',
      generatedCode: '',
      githubRepo: '',
      apkUrl: '',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const code = await generateCode(enrichedPrompt, settings);
      const completedProject: Project = {
        ...project,
        status: 'generated',
        generatedCode: code,
        updatedAt: Date.now(),
      };
      await addProject(completedProject);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/project/[id]', params: { id: projectId } });
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e.message || 'Failed to generate code.');
      setIsLoading(false);
      setStep('clarify');
    }
  };

  const handleSkipClarify = () => {
    handleGenerate();
  };

  const handleBack = () => {
    if (step === 'clarify') {
      setStep('describe');
      setQuestions([]);
      setAnswers({});
    } else {
      router.back();
    }
  };

  const selectTemplate = (template: typeof TEMPLATES[0]) => {
    setPrompt(template.prompt);
    if (!appName) setAppName(template.label);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const answeredCount = Object.keys(answers).length;
  const stepTitle = step === 'describe' ? 'New Project' : step === 'clarify' ? 'Refine Your Idea' : 'Generating...';

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.closeBtn}>
          <Ionicons name={step === 'clarify' ? 'arrow-back' : 'close'} size={24} color={C.textSecondary} />
        </Pressable>
        <Text style={styles.topTitle}>{stepTitle}</Text>
        <View style={{ width: 44 }} />
      </View>

      {step !== 'generate' && (
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step === 'describe' && styles.stepDotActive]} />
          <View style={[styles.stepLine, step === 'clarify' && styles.stepLineActive]} />
          <View style={[styles.stepDot, step === 'clarify' && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'describe' && (
          <>
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
                    <Text style={[styles.templateLabel, prompt === t.prompt && { color: C.accent }]}>
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {!settings.geminiApiKey && !settings.groqApiKey && !settings.huggingfaceApiKey && !settings.llmApiKey ? (
              <Pressable style={styles.warningBox} onPress={() => router.push('/settings')}>
                <Feather name="alert-triangle" size={16} color={C.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningText}>
                    You need an AI API key to generate apps. Without one, code generation won't work.
                  </Text>
                  <Text style={[styles.warningText, { color: C.accent, marginTop: 6 }]}>
                    Tap here to set up a free AI key (takes 2 min)
                  </Text>
                </View>
              </Pressable>
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
                (!appName.trim() || !prompt.trim() || isLoading) && styles.createBtnDisabled,
                pressed && { opacity: 0.9 },
              ]}
              onPress={handleNext}
              disabled={!appName.trim() || !prompt.trim() || isLoading}
            >
              <LinearGradient
                colors={isLoading ? [C.surfaceElevated, C.surfaceElevated] : ['#00D4FF', '#0099CC']}
                style={styles.createBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator size="small" color={C.accent} />
                    <Text style={[styles.createBtnText, { color: C.accent }]}>Analyzing...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="arrow-forward" size={20} color="#0A0E1A" />
                    <Text style={styles.createBtnText}>Next: Refine Details</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </>
        )}

        {step === 'clarify' && (
          <>
            <View style={styles.clarifyHeader}>
              <Feather name="help-circle" size={20} color={C.accent} />
              <Text style={styles.clarifyTitle}>Help us build exactly what you need</Text>
            </View>
            <Text style={styles.clarifySubtitle}>
              Answer these questions so the AI generates a better app. Tap to select, or skip if you're not sure.
            </Text>

            {questions.map((q, qIndex) => (
              <View key={qIndex} style={styles.questionCard}>
                <Text style={styles.questionText}>{q.question}</Text>
                <View style={styles.optionsGrid}>
                  {q.options.map((opt, oIndex) => {
                    const selected = answers[qIndex] === opt;
                    return (
                      <Pressable
                        key={oIndex}
                        style={({ pressed }) => [
                          styles.optionChip,
                          selected && styles.optionChipSelected,
                          pressed && { opacity: 0.7 },
                        ]}
                        onPress={() => handleSelectOption(qIndex, opt)}
                      >
                        {selected && <Ionicons name="checkmark-circle" size={16} color={C.accent} />}
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {error ? (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color={C.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.9 }]}
              onPress={handleGenerate}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#00D4FF', '#0099CC']}
                style={styles.createBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="flash" size={20} color="#0A0E1A" />
                <Text style={styles.createBtnText}>
                  {answeredCount > 0
                    ? `Generate App (${answeredCount} detail${answeredCount > 1 ? 's' : ''} added)`
                    : 'Generate App'}
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
              onPress={handleSkipClarify}
              disabled={isLoading}
            >
              <Text style={styles.skipBtnText}>Skip and generate with original description</Text>
            </Pressable>
          </>
        )}

        {step === 'generate' && (
          <View style={styles.generatingContainer}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.generatingTitle}>Building your app...</Text>
            <Text style={styles.generatingSubtitle}>
              The AI is writing code for "{appName}". This usually takes 15-30 seconds.
            </Text>
            <View style={styles.generatingDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="checkmark-circle" size={16} color={C.success} />
                <Text style={styles.detailText}>Requirements analyzed</Text>
              </View>
              {answeredCount > 0 && (
                <View style={styles.detailRow}>
                  <Ionicons name="checkmark-circle" size={16} color={C.success} />
                  <Text style={styles.detailText}>{answeredCount} preference{answeredCount > 1 ? 's' : ''} applied</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <ActivityIndicator size={14} color={C.accent} />
                <Text style={styles.detailText}>Generating code...</Text>
              </View>
            </View>
          </View>
        )}
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 0,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.border,
  },
  stepDotActive: {
    backgroundColor: C.accent,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: C.border,
  },
  stepLineActive: {
    backgroundColor: C.accent,
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
  clarifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  clarifyTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
  },
  clarifySubtitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  questionCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  questionText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.text,
    marginBottom: 14,
    lineHeight: 22,
  },
  optionsGrid: {
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  optionChipSelected: {
    borderColor: C.accent,
    backgroundColor: C.accentDim,
  },
  optionText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    flex: 1,
  },
  optionTextSelected: {
    color: C.accent,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    textDecorationLine: 'underline',
  },
  generatingContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  generatingTitle: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
    marginTop: 24,
  },
  generatingSubtitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  generatingDetails: {
    marginTop: 32,
    gap: 14,
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
  },
});
