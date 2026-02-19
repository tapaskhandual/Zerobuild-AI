import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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
              <Pressable onPress={() => Linking.openURL('https://github.com/settings/tokens/new?scopes=repo&description=ZeroBuild+AI')}>
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
              Create a token with 'repo' scope. Tap the help icon above.
            </Text>
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="flash" size={20} color={C.accent} />
            <Text style={styles.sectionGroupTitle}>AI / LLM Providers</Text>
          </View>
          <Text style={styles.sectionHint}>
            All three are free. Select your preferred provider and add API keys.
          </Text>

          <Text style={styles.label}>Active Provider</Text>
          <View style={styles.providerRow}>
            <ProviderCard
              name="Gemini"
              desc="Most generous"
              icon={<MaterialCommunityIcons name="google" size={18} color={form.llmProvider === 'gemini' ? C.accent : C.textMuted} />}
              active={form.llmProvider === 'gemini'}
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
              onPress={() => {
                setForm(prev => ({ ...prev, llmProvider: 'groq' }));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            />
            <ProviderCard
              name="HF"
              desc="Open source"
              icon={<MaterialCommunityIcons name="robot-outline" size={18} color={form.llmProvider === 'huggingface' ? C.accent : C.textMuted} />}
              active={form.llmProvider === 'huggingface'}
              onPress={() => {
                setForm(prev => ({ ...prev, llmProvider: 'huggingface' }));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            />
          </View>

          <View style={styles.apiKeysContainer}>
            <ApiKeyField
              label="Google Gemini API Key"
              value={form.geminiApiKey}
              placeholder="AIzaSy..."
              helpUrl="https://aistudio.google.com/apikey"
              helpText="Free: 15 req/min, 1M tokens/day. Get key from Google AI Studio."
              isActive={form.llmProvider === 'gemini'}
              onChange={(t) => setForm(prev => ({ ...prev, geminiApiKey: t }))}
            />
            <ApiKeyField
              label="Groq API Key"
              value={form.groqApiKey}
              placeholder="gsk_..."
              helpUrl="https://console.groq.com/keys"
              helpText="Free: 30 req/min on Llama 3.3 70B. Fastest inference."
              isActive={form.llmProvider === 'groq'}
              onChange={(t) => setForm(prev => ({ ...prev, groqApiKey: t }))}
            />
            <ApiKeyField
              label="HuggingFace API Token"
              value={form.huggingfaceApiKey}
              placeholder="hf_..."
              helpUrl="https://huggingface.co/settings/tokens"
              helpText="Free with rate limits. Uses Mistral 7B open-source model."
              isActive={form.llmProvider === 'huggingface'}
              onChange={(t) => setForm(prev => ({ ...prev, huggingfaceApiKey: t }))}
            />
          </View>
        </View>

        <View style={styles.sectionGroup}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="information-circle-outline" size={20} color={C.textSecondary} />
            <Text style={styles.sectionGroupTitle}>How It Works</Text>
          </View>

          <View style={styles.stepsList}>
            <StepItem number="1" text="Describe your app idea in natural language" />
            <StepItem number="2" text="ZeroBuild AI generates React Native code using your chosen LLM" />
            <StepItem number="3" text="Code is pushed to your GitHub repository automatically" />
            <StepItem number="4" text="GitHub Actions builds the APK (free for public repos)" />
            <StepItem number="5" text="Download the APK from GitHub Actions artifacts" />
          </View>
        </View>

        <View style={styles.limitsSection}>
          <Text style={[styles.sectionGroupTitle, { marginBottom: 12 }]}>Free Tier Limits</Text>
          <LimitRow provider="Google Gemini" limit="15 req/min, 1M tokens/day" color="#4285F4" />
          <LimitRow provider="Groq" limit="30 req/min (Llama 3.3)" color="#F55036" />
          <LimitRow provider="HuggingFace" limit="Rate limited, queue-based" color="#FFD21E" />
          <LimitRow provider="GitHub Actions" limit="2,000 min/month (public repos)" color="#FFFFFF" />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ZeroBuild AI v1.0.0</Text>
          <Text style={styles.footerText}>Zero infrastructure cost</Text>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function ProviderCard({ name, desc, icon, active, onPress }: {
  name: string; desc: string; icon: React.ReactNode; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.providerCard, active && styles.providerCardActive]}
      onPress={onPress}
    >
      {icon}
      <Text style={[styles.providerName, active && styles.providerNameActive]}>{name}</Text>
      <Text style={styles.providerDesc}>{desc}</Text>
    </Pressable>
  );
}

function ApiKeyField({ label, value, placeholder, helpUrl, helpText, isActive, onChange }: {
  label: string; value: string; placeholder: string; helpUrl: string; helpText: string; isActive: boolean; onChange: (t: string) => void;
}) {
  return (
    <View style={[styles.apiKeyField, isActive && styles.apiKeyFieldActive]}>
      <View style={styles.labelRow}>
        <Text style={[styles.apiKeyLabel, isActive && { color: C.accent }]}>{label}</Text>
        <Pressable onPress={() => Linking.openURL(helpUrl)}>
          <Feather name="external-link" size={14} color={C.accent} />
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Text style={styles.fieldHint}>{helpText}</Text>
      {isActive && value ? (
        <View style={styles.activeTag}>
          <Ionicons name="checkmark-circle" size={14} color={C.success} />
          <Text style={styles.activeTagText}>Active</Text>
        </View>
      ) : null}
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

function LimitRow({ provider, limit, color }: { provider: string; limit: string; color: string }) {
  return (
    <View style={styles.limitRow}>
      <View style={[styles.limitDot, { backgroundColor: color }]} />
      <Text style={styles.limitProvider}>{provider}</Text>
      <Text style={styles.limitValue}>{limit}</Text>
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
    marginBottom: 10,
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
    borderWidth: 1,
    borderColor: C.border,
  },
  providerCardActive: {
    borderColor: C.accent,
    backgroundColor: C.accentDim,
  },
  providerName: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.textSecondary,
  },
  providerNameActive: {
    color: C.accent,
  },
  providerDesc: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
  },
  apiKeysContainer: {
    gap: 16,
  },
  apiKeyField: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  apiKeyFieldActive: {
    borderColor: C.accentGlow,
  },
  apiKeyLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  activeTagText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.success,
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
  limitsSection: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 32,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  limitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  limitProvider: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.text,
    width: 120,
  },
  limitValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    textAlign: 'right',
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
