import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useProjects } from '@/lib/project-context';
import { AppSettings } from '@/lib/types';

const C = Colors.dark;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useProjects();
  const [form, setForm] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    await updateSettings(form);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleGuide = (key: string) => {
    setExpandedGuide(prev => prev === key ? null : key);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const hasGithub = !!(form.githubUsername && form.githubToken);
  const hasAnyKey = !!(form.geminiApiKey || form.groqApiKey || form.huggingfaceApiKey);
  const setupProgress = (hasGithub ? 1 : 0) + (hasAnyKey ? 1 : 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={C.textSecondary} />
        </Pressable>
        <Text style={styles.topTitle}>Setup</Text>
        <Pressable onPress={handleSave} style={styles.saveBtn}>
          {saved ? (
            <Ionicons name="checkmark" size={22} color={C.success} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Setup Progress</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(setupProgress / 2) * 100}%` }]} />
          </View>
          <View style={styles.checklistRow}>
            <View style={styles.checkItem}>
              <Ionicons
                name={hasAnyKey ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={hasAnyKey ? C.success : C.textMuted}
              />
              <Text style={[styles.checkLabel, hasAnyKey && styles.checkLabelDone]}>
                AI Key Added
              </Text>
            </View>
            <View style={styles.checkItem}>
              <Ionicons
                name={hasGithub ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={hasGithub ? C.success : C.textMuted}
              />
              <Text style={[styles.checkLabel, hasGithub && styles.checkLabelDone]}>
                GitHub Connected
              </Text>
            </View>
          </View>
          {setupProgress < 2 && (
            <Text style={styles.progressHint}>
              {setupProgress === 0
                ? 'Follow the guides below to get started. It only takes a few minutes!'
                : hasAnyKey
                  ? 'Almost done! Connect GitHub to push code and build APKs.'
                  : 'Almost done! Add an AI key to start generating apps.'}
            </Text>
          )}
          {setupProgress === 2 && (
            <Text style={[styles.progressHint, { color: C.success }]}>
              All set! You're ready to generate apps.
            </Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Step 1: Choose an AI Provider</Text>
        <Text style={styles.sectionDesc}>
          Pick any one below. All are 100% free. We recommend Google Gemini (most generous free tier).
        </Text>

        <View style={styles.providerRow}>
          <ProviderCard
            name="Gemini"
            desc="Best free tier"
            icon={<MaterialCommunityIcons name="google" size={18} color={form.llmProvider === 'gemini' ? C.accent : C.textMuted} />}
            active={form.llmProvider === 'gemini'}
            hasKey={!!form.geminiApiKey}
            onPress={() => {
              setForm(prev => ({ ...prev, llmProvider: 'gemini' }));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
          <ProviderCard
            name="Groq"
            desc="Fastest"
            icon={<Ionicons name="flash-outline" size={18} color={form.llmProvider === 'groq' ? C.accent : C.textMuted} />}
            active={form.llmProvider === 'groq'}
            hasKey={!!form.groqApiKey}
            onPress={() => {
              setForm(prev => ({ ...prev, llmProvider: 'groq' }));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
          <ProviderCard
            name="HuggingFace"
            desc="Open source"
            icon={<MaterialCommunityIcons name="robot-outline" size={18} color={form.llmProvider === 'huggingface' ? C.accent : C.textMuted} />}
            active={form.llmProvider === 'huggingface'}
            hasKey={!!form.huggingfaceApiKey}
            onPress={() => {
              setForm(prev => ({ ...prev, llmProvider: 'huggingface' }));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
        </View>

        {form.llmProvider === 'gemini' && (
          <View style={styles.keySection}>
            <GuideAccordion
              title="How to get a free Gemini API key"
              isExpanded={expandedGuide === 'gemini'}
              onToggle={() => toggleGuide('gemini')}
              steps={[
                'Open Google AI Studio in your browser',
                'Sign in with your Google account (Gmail)',
                'Click "Get API Key" in the top left menu',
                'Click "Create API Key"',
                'Copy the key that starts with "AIza..."',
                'Paste it in the field below',
              ]}
              linkLabel="Open Google AI Studio"
              linkUrl="https://aistudio.google.com/apikey"
              tip="Free: 15 requests per minute, 1 million tokens per day. No credit card needed."
            />
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gemini API Key</Text>
              <TextInput
                style={styles.input}
                value={form.geminiApiKey}
                onChangeText={(t) => setForm(prev => ({ ...prev, geminiApiKey: t }))}
                placeholder="Paste your key here (starts with AIza...)"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              {form.geminiApiKey ? (
                <View style={styles.keyStatus}>
                  <Ionicons name="checkmark-circle" size={16} color={C.success} />
                  <Text style={styles.keyStatusText}>Key saved</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {form.llmProvider === 'groq' && (
          <View style={styles.keySection}>
            <GuideAccordion
              title="How to get a free Groq API key"
              isExpanded={expandedGuide === 'groq'}
              onToggle={() => toggleGuide('groq')}
              steps={[
                'Go to console.groq.com',
                'Sign up for a free account (or sign in with Google)',
                'Click "API Keys" in the left sidebar',
                'Click "Create API Key"',
                'Give it a name (e.g., "ZeroBuild")',
                'Copy the key that starts with "gsk_..."',
                'Paste it in the field below',
              ]}
              linkLabel="Open Groq Console"
              linkUrl="https://console.groq.com/keys"
              tip="Free: 30 requests per minute using Llama 3.3 70B. Fastest inference available."
            />
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Groq API Key</Text>
              <TextInput
                style={styles.input}
                value={form.groqApiKey}
                onChangeText={(t) => setForm(prev => ({ ...prev, groqApiKey: t }))}
                placeholder="Paste your key here (starts with gsk_...)"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              {form.groqApiKey ? (
                <View style={styles.keyStatus}>
                  <Ionicons name="checkmark-circle" size={16} color={C.success} />
                  <Text style={styles.keyStatusText}>Key saved</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {form.llmProvider === 'huggingface' && (
          <View style={styles.keySection}>
            <GuideAccordion
              title="How to get a free HuggingFace token"
              isExpanded={expandedGuide === 'huggingface'}
              onToggle={() => toggleGuide('huggingface')}
              steps={[
                'Go to huggingface.co',
                'Click "Sign Up" and create a free account',
                'Click your profile icon (top right)',
                'Go to "Settings" then "Access Tokens"',
                'Click "New token"',
                'Set role to "Read" and click "Generate"',
                'Copy the token that starts with "hf_..."',
                'Paste it in the field below',
              ]}
              linkLabel="Open HuggingFace Tokens"
              linkUrl="https://huggingface.co/settings/tokens"
              tip="Free with rate limits. Uses the open-source Mistral 7B model."
            />
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>HuggingFace Token</Text>
              <TextInput
                style={styles.input}
                value={form.huggingfaceApiKey}
                onChangeText={(t) => setForm(prev => ({ ...prev, huggingfaceApiKey: t }))}
                placeholder="Paste your token here (starts with hf_...)"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              {form.huggingfaceApiKey ? (
                <View style={styles.keyStatus}>
                  <Ionicons name="checkmark-circle" size={16} color={C.success} />
                  <Text style={styles.keyStatusText}>Key saved</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Step 2: Connect GitHub & Expo</Text>
        <Text style={styles.sectionDesc}>
          Needed to save your generated code and build APKs using EAS Build. You need a free GitHub account and a free Expo account.
        </Text>

        <GuideAccordion
          title="How to set up Expo for building APKs"
          isExpanded={expandedGuide === 'expo'}
          onToggle={() => toggleGuide('expo')}
          steps={[
            'Go to expo.dev and click "Sign Up" (it\'s free)',
            'Create an account with your email or GitHub',
            'Note your username (shown in your profile)',
            'Enter your Expo username in the field below',
            'Next, create an Expo access token: go to expo.dev/settings/access-tokens',
            'Click "Create Token", name it "ZeroBuild", and copy the token',
            'Paste the token in the "Expo Access Token" field below',
            'Also add the same token as EXPO_TOKEN in your GitHub repo secrets (Settings > Secrets > Actions)',
            'Now when you push code, EAS Build will automatically create your APK!',
          ]}
          linkLabel="Sign up for Expo (free)"
          linkUrl="https://expo.dev/signup"
          tip="EAS Build gives you 30 free Android builds per month. No credit card needed. You can also run builds manually using the EAS CLI."
        />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Expo Username</Text>
          <TextInput
            style={styles.input}
            value={form.expoUsername}
            onChangeText={(t) => setForm(prev => ({ ...prev, expoUsername: t }))}
            placeholder="Your Expo account username"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.fieldHint}>
            Your username from expo.dev. Used to link your builds.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Expo Access Token</Text>
          <TextInput
            style={styles.input}
            value={form.expoToken}
            onChangeText={(t) => setForm(prev => ({ ...prev, expoToken: t }))}
            placeholder="Paste your Expo access token"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.fieldHint}>
            From expo.dev/settings/access-tokens. Used to set up your project for EAS builds.
          </Text>
          {form.expoToken ? (
            <View style={styles.keyStatus}>
              <Ionicons name="checkmark-circle" size={16} color={C.success} />
              <Text style={styles.keyStatusText}>Token saved</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>GitHub Username</Text>
          <TextInput
            style={styles.input}
            value={form.githubUsername}
            onChangeText={(t) => setForm(prev => ({ ...prev, githubUsername: t }))}
            placeholder="Your GitHub username"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <GuideAccordion
          title="How to create a GitHub access token"
          isExpanded={expandedGuide === 'github'}
          onToggle={() => toggleGuide('github')}
          steps={[
            'Tap the button below - it opens GitHub with everything pre-filled for you',
            'Sign in to your GitHub account (or create one free)',
            'You\'ll see "New personal access token (classic)" page',
            'The name and permissions are already filled in for you',
            'Just set "Expiration" to 90 days (or No expiration)',
            'Scroll down and click the green "Generate token" button',
            'Copy the token that starts with "ghp_..."',
            'Paste it in the field below and tap Save',
          ]}
          linkLabel="Create Token (one-click setup)"
          linkUrl="https://github.com/settings/tokens/new?scopes=repo,workflow&description=ZeroBuild+AI"
          tip='This link pre-fills everything for you! If you already have a Fine-grained token, you need to also add "Administration: Read and Write" permission to it, or just create a Classic token using this link instead.'
        />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Personal Access Token</Text>
          <View style={styles.tokenInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={form.githubToken}
              onChangeText={(t) => setForm(prev => ({ ...prev, githubToken: t }))}
              placeholder="Paste your token here (starts with ghp_...)"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showGithubToken}
            />
            <Pressable onPress={() => setShowGithubToken(!showGithubToken)} style={styles.eyeBtn}>
              <Ionicons name={showGithubToken ? 'eye-off' : 'eye'} size={20} color={C.textMuted} />
            </Pressable>
          </View>
          {form.githubToken ? (
            <View style={styles.keyStatus}>
              <Ionicons name="checkmark-circle" size={16} color={C.success} />
              <Text style={styles.keyStatusText}>Token saved</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>How ZeroBuild AI Works</Text>
          <View style={styles.stepsList}>
            <StepItem number="1" text="You describe the app you want to build" />
            <StepItem number="2" text="AI generates the complete app code for you" />
            <StepItem number="3" text="Code is pushed as an Expo project to GitHub" />
            <StepItem number="4" text="EAS Build creates the APK in the cloud" />
            <StepItem number="5" text="Download and install the APK on any Android phone" />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.9 }]}
          onPress={handleSave}
        >
          <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={20} color="#0A0E1A" />
          <Text style={styles.saveButtonText}>{saved ? 'Saved!' : 'Save Settings'}</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ZeroBuild AI v1.0</Text>
          <Text style={styles.footerText}>100% free, zero infrastructure cost</Text>
          <Text style={styles.footerText}>Your keys are stored only on your device</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function ProviderCard({ name, desc, icon, active, hasKey, onPress }: {
  name: string; desc: string; icon: React.ReactNode; active: boolean; hasKey: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.providerCard, active && styles.providerCardActive]}
      onPress={onPress}
    >
      <View style={styles.providerTop}>
        {icon}
        {hasKey && <Ionicons name="checkmark-circle" size={14} color={C.success} />}
      </View>
      <Text style={[styles.providerName, active && styles.providerNameActive]}>{name}</Text>
      <Text style={styles.providerDesc}>{desc}</Text>
      {active && <View style={styles.activeDot} />}
    </Pressable>
  );
}

function GuideAccordion({ title, isExpanded, onToggle, steps, linkLabel, linkUrl, tip }: {
  title: string; isExpanded: boolean; onToggle: () => void; steps: string[]; linkLabel: string; linkUrl: string; tip: string;
}) {
  return (
    <View style={styles.guideContainer}>
      <Pressable style={styles.guideHeader} onPress={onToggle}>
        <Ionicons name="book-outline" size={18} color={C.accent} />
        <Text style={styles.guideTitle}>{title}</Text>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.textMuted} />
      </Pressable>

      {isExpanded && (
        <View style={styles.guideBody}>
          <Pressable
            style={styles.guideLinkBtn}
            onPress={() => Linking.openURL(linkUrl)}
          >
            <Feather name="external-link" size={16} color="#0A0E1A" />
            <Text style={styles.guideLinkText}>{linkLabel}</Text>
          </Pressable>

          <View style={styles.guideSteps}>
            {steps.map((step, i) => (
              <View key={i} style={styles.guideStep}>
                <View style={styles.guideStepNum}>
                  <Text style={styles.guideStepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.guideStepText}>{step}</Text>
              </View>
            ))}
          </View>

          <View style={styles.guideTip}>
            <Ionicons name="information-circle" size={16} color={C.accent} />
            <Text style={styles.guideTipText}>{tip}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function StepItem({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.stepItem}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
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
  saveBtn: {
    width: 60,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.accent,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  progressCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: C.border,
  },
  progressTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
    marginBottom: 14,
  },
  progressBar: {
    height: 6,
    backgroundColor: C.surfaceHighlight,
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 3,
  },
  checklistRow: {
    flexDirection: 'row',
    gap: 20,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
  },
  checkLabelDone: {
    color: C.success,
  },
  progressHint: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    marginTop: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    lineHeight: 22,
    marginBottom: 18,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  providerCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  providerCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentDim,
  },
  providerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerName: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.textSecondary,
    marginTop: 2,
  },
  providerNameActive: {
    color: C.accent,
  },
  providerDesc: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
    marginTop: 4,
  },
  keySection: {
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
  },
  tokenInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeBtn: {
    width: 44,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  keyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  fieldHint: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },
  keyStatusText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.success,
  },
  guideContainer: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
  },
  guideTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.accent,
  },
  guideBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 16,
  },
  guideLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  guideLinkText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#0A0E1A',
  },
  guideSteps: {
    gap: 12,
    marginBottom: 16,
  },
  guideStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  guideStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepNumText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.textSecondary,
  },
  guideStepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.text,
    lineHeight: 22,
    paddingTop: 1,
  },
  guideTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.accentDim,
    borderRadius: 10,
    padding: 12,
  },
  guideTipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.accent,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 24,
  },
  howItWorks: {
    marginBottom: 28,
  },
  stepsList: {
    gap: 14,
    marginTop: 14,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: C.accent,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    lineHeight: 22,
    paddingTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 20,
  },
  saveButtonText: {
    fontSize: 17,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#0A0E1A',
  },
  footer: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 12,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
  },
});
