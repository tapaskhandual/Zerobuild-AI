import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import Colors from '@/constants/colors';
import { useProjects } from '@/lib/project-context';
import { AppSettings } from '@/lib/types';

const C = Colors.dark;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useProjects();
  const [form, setForm] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);
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

  const handleOpenGithubTokenHelp = () => {
    Linking.openURL('https://github.com/settings/tokens/new?scopes=repo&description=ZeroBuild+AI');
  };

  const handleOpenGroqHelp = () => {
    Linking.openURL('https://console.groq.com/keys');
  };

  const handleOpenHuggingFaceHelp = () => {
    Linking.openURL('https://huggingface.co/settings/tokens');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={C.textSecondary} />
        </Pressable>
        <Text style={styles.topTitle}>Settings</Text>
        <Pressable onPress={handleSave} style={styles.saveBtn}>
          {saved ? (
            <Ionicons name="checkmark" size={22} color={C.success} />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20 }]}
        bottomOffset={20}
      >
        <View style={styles.sectionGroup}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="logo-github" size={20} color={C.text} />
            <Text style={styles.sectionGroupTitle}>GitHub Configuration</Text>
          </View>
          <Text style={styles.sectionHint}>
            Required for pushing generated code and building APKs
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>GitHub Username</Text>
            <TextInput
              style={styles.input}
              value={form.githubUsername}
              onChangeText={(t) => setForm(prev => ({ ...prev, githubUsername: t }))}
              placeholder="your-username"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Personal Access Token</Text>
              <Pressable onPress={handleOpenGithubTokenHelp}>
                <Feather name="help-circle" size={16} color={C.accent} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={form.githubToken}
              onChangeText={(t) => setForm(prev => ({ ...prev, githubToken: t }))}
              placeholder="ghp_xxxxxxxxxxxx"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.fieldHint}>
              Create a token with 'repo' scope. Tap the help icon to generate one.
            </Text>
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="flash" size={20} color={C.accent} />
            <Text style={styles.sectionGroupTitle}>AI / LLM Configuration</Text>
          </View>
          <Text style={styles.sectionHint}>
            Choose a free LLM provider for code generation
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Provider</Text>
            <View style={styles.providerRow}>
              <Pressable
                style={[
                  styles.providerCard,
                  form.llmProvider === 'groq' && styles.providerCardActive,
                ]}
                onPress={() => {
                  setForm(prev => ({ ...prev, llmProvider: 'groq' }));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.providerName, form.llmProvider === 'groq' && styles.providerNameActive]}>
                  Groq
                </Text>
                <Text style={styles.providerDesc}>Free tier</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.providerCard,
                  form.llmProvider === 'huggingface' && styles.providerCardActive,
                ]}
                onPress={() => {
                  setForm(prev => ({ ...prev, llmProvider: 'huggingface' }));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.providerName, form.llmProvider === 'huggingface' && styles.providerNameActive]}>
                  HuggingFace
                </Text>
                <Text style={styles.providerDesc}>Free inference</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>API Key</Text>
              <Pressable onPress={form.llmProvider === 'groq' ? handleOpenGroqHelp : handleOpenHuggingFaceHelp}>
                <Feather name="help-circle" size={16} color={C.accent} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={form.llmApiKey}
              onChangeText={(t) => setForm(prev => ({ ...prev, llmApiKey: t }))}
              placeholder={form.llmProvider === 'groq' ? 'gsk_xxxxxxxxx' : 'hf_xxxxxxxxx'}
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.fieldHint}>
              {form.llmProvider === 'groq'
                ? 'Get a free API key from console.groq.com (recommended - fastest)'
                : 'Get a free API token from huggingface.co/settings/tokens'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="information-circle-outline" size={20} color={C.textSecondary} />
            <Text style={styles.sectionGroupTitle}>How It Works</Text>
          </View>

          <View style={styles.stepsList}>
            <StepItem number="1" text="Describe your app idea in natural language" />
            <StepItem number="2" text="ZeroBuild AI generates complete React Native code using your chosen LLM" />
            <StepItem number="3" text="Code is pushed to your GitHub repository automatically" />
            <StepItem number="4" text="GitHub Actions builds the APK (free for public repos)" />
            <StepItem number="5" text="Download the APK from GitHub Actions artifacts" />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ZeroBuild AI v1.0.0</Text>
          <Text style={styles.footerText}>Zero infrastructure cost</Text>
        </View>
      </KeyboardAwareScrollViewCompat>
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
  sectionGroup: {
    marginBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  sectionGroupTitle: {
    fontSize: 17,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  fieldHint: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  providerCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  providerCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentDim,
  },
  providerName: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.textSecondary,
    marginBottom: 4,
  },
  providerNameActive: {
    color: C.accent,
  },
  providerDesc: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
  },
  stepsList: {
    gap: 14,
    marginTop: 8,
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
  footer: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 20,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
  },
});
