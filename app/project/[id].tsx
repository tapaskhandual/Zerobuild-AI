import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { useProjects } from '@/lib/project-context';
import { generateCode } from '@/lib/ai-service';
import { createRepo, pushCode, getEasBuildUrl, getRepoUrl } from '@/lib/github-service';
import { Project, ProjectStatus } from '@/lib/types';

const C = Colors.dark;

function StatusBadge({ status }: { status: ProjectStatus }) {
  const configs: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
    drafting: { label: 'Draft', color: C.textMuted, bg: C.surfaceHighlight },
    generating: { label: 'Generating Code', color: C.warning, bg: C.warningDim },
    generated: { label: 'Code Ready', color: C.accent, bg: C.accentDim },
    pushing: { label: 'Pushing to GitHub', color: C.warning, bg: C.warningDim },
    building: { label: 'Building APK', color: C.purple, bg: C.purpleDim },
    ready: { label: 'APK Ready', color: C.success, bg: C.successDim },
    error: { label: 'Error', color: C.error, bg: C.errorDim },
  };
  const c = configs[status] || configs.drafting;

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: c.color }]} />
      <Text style={[styles.badgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { projects, settings, updateProject, removeProject } = useProjects();
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionLabel, setActionLabel] = useState('');
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const project = useMemo(() => projects.find(p => p.id === id), [projects, id]);

  const handleRegenerate = useCallback(async () => {
    if (!project) return;
    setIsProcessing(true);
    setActionLabel('Regenerating code...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const code = await generateCode(project.prompt, settings);
      await updateProject({
        ...project,
        status: 'generated',
        generatedCode: code,
        error: undefined,
        updatedAt: Date.now(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      await updateProject({
        ...project,
        status: 'error',
        error: e.message,
        updatedAt: Date.now(),
      });
    } finally {
      setIsProcessing(false);
      setActionLabel('');
    }
  }, [project, settings, updateProject]);

  const handlePushToGithub = useCallback(async () => {
    if (!project) return;

    if (!settings.githubToken || !settings.githubUsername) {
      Alert.alert('GitHub Not Configured', 'Please add your GitHub token and username in Settings first.', [
        { text: 'Cancel' },
        { text: 'Go to Settings', onPress: () => router.push('/settings') },
      ]);
      return;
    }

    setIsProcessing(true);
    setActionLabel('Creating repository...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await updateProject({ ...project, status: 'pushing', updatedAt: Date.now() });

      const slug = project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      let repoFullName = `${settings.githubUsername}/${slug}`;

      try {
        const repo = await createRepo(project.name, project.description, settings);
        repoFullName = repo.full_name;
      } catch (createErr: any) {
        if (createErr.message?.includes('already exists')) {
          setActionLabel('Repository exists, updating code...');
        } else {
          throw createErr;
        }
      }

      setActionLabel('Pushing code...');
      await pushCode(project.name, project.generatedCode, settings);

      const easUrl = getEasBuildUrl(settings.expoUsername || settings.githubUsername, project.name);

      await updateProject({
        ...project,
        status: 'ready',
        githubRepo: repoFullName,
        apkUrl: easUrl,
        updatedAt: Date.now(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      await updateProject({
        ...project,
        status: 'error',
        error: e.message,
        updatedAt: Date.now(),
      });
    } finally {
      setIsProcessing(false);
      setActionLabel('');
    }
  }, [project, settings, updateProject]);

  const handleCopyCode = useCallback(async () => {
    if (!project?.generatedCode) return;
    await Clipboard.setStringAsync(project.generatedCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS !== 'web') {
      Alert.alert('Copied', 'Code copied to clipboard');
    }
  }, [project]);

  const handleDelete = useCallback(async () => {
    if (!project) return;
    const doDelete = async () => {
      await removeProject(project.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      await doDelete();
    } else {
      Alert.alert('Delete Project', 'This action cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [project, removeProject]);

  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  if (!project) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Project not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={24} color={C.textSecondary} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{project.name}</Text>
        <Pressable onPress={handleDelete} style={styles.navBtn}>
          <Feather name="trash-2" size={20} color={C.error} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusSection}>
          <StatusBadge status={project.status} />
          <Text style={styles.projectDescription}>{project.description}</Text>
        </View>

        {project.error ? (
          <Pressable
            style={styles.errorBox}
            onPress={project.error.includes('token') || project.error.includes('permission') || project.error.includes('Settings')
              ? () => router.push('/settings')
              : undefined
            }
          >
            <Feather name="alert-circle" size={16} color={C.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorBoxText}>{project.error}</Text>
              {(project.error.includes('token') || project.error.includes('permission') || project.error.includes('Settings')) ? (
                <Text style={[styles.errorBoxText, { color: C.accent, marginTop: 8 }]}>
                  Tap here to fix your settings
                </Text>
              ) : null}
            </View>
          </Pressable>
        ) : null}

        {project.status === 'generating' ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loadingText}>AI is generating your app code...</Text>
          </View>
        ) : null}

        {isProcessing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loadingText}>{actionLabel}</Text>
          </View>
        ) : null}

        {project.generatedCode ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Generated Code</Text>
              <Pressable onPress={handleCopyCode} style={styles.copyBtn}>
                <Feather name="copy" size={16} color={C.accent} />
              </Pressable>
            </View>
            <View style={styles.codeBlock}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.codeText} selectable>
                  {project.generatedCode.slice(0, 2000)}
                  {project.generatedCode.length > 2000 ? '\n\n... (truncated - copy for full code)' : ''}
                </Text>
              </ScrollView>
            </View>
          </View>
        ) : null}

        {project.githubRepo ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>GitHub Repository</Text>
            <Pressable
              style={styles.linkCard}
              onPress={() => handleOpenLink(getRepoUrl(settings.githubUsername, project.name))}
            >
              <Ionicons name="logo-github" size={22} color={C.text} />
              <View style={styles.linkCardContent}>
                <Text style={styles.linkCardTitle}>{project.githubRepo}</Text>
                <Text style={styles.linkCardSub}>Tap to open repository</Text>
              </View>
              <Feather name="external-link" size={16} color={C.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {project.apkUrl ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Build with EAS</Text>
            <Pressable
              style={styles.linkCard}
              onPress={() => handleOpenLink(project.apkUrl)}
            >
              <Ionicons name="build-outline" size={22} color={C.success} />
              <View style={styles.linkCardContent}>
                <Text style={styles.linkCardTitle}>Expo EAS Build</Text>
                <Text style={styles.linkCardSub}>View builds and download APK</Text>
              </View>
              <Feather name="external-link" size={16} color={C.textMuted} />
            </Pressable>
            <Text style={styles.helpText}>
              To build automatically: add your EXPO_TOKEN as a secret in your GitHub repo settings. Or run "eas build --platform android --profile preview" locally with the EAS CLI.
            </Text>
          </View>
        ) : null}

        <View style={styles.actionsSection}>
          {(project.status === 'generated' || project.status === 'ready') && !isProcessing ? (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]}
              onPress={handlePushToGithub}
            >
              <LinearGradient
                colors={['#00D4FF', '#0099CC']}
                style={styles.actionBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="cloud-upload" size={20} color="#0A0E1A" />
                <Text style={styles.actionBtnPrimaryText}>
                  {project.githubRepo ? 'Update on GitHub' : 'Push to GitHub'}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : null}

          {(project.status === 'error' || project.status === 'generated' || project.status === 'ready') && !isProcessing ? (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
              onPress={handleRegenerate}
            >
              <Feather name="refresh-cw" size={18} color={C.accent} />
              <Text style={styles.secondaryBtnText}>Regenerate Code</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Created</Text>
            <Text style={styles.metaValue}>{new Date(project.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Last Updated</Text>
            <Text style={styles.metaValue}>{new Date(project.updatedAt).toLocaleDateString()}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Code Size</Text>
            <Text style={styles.metaValue}>
              {project.generatedCode ? `${(project.generatedCode.length / 1024).toFixed(1)} KB` : 'N/A'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  statusSection: {
    marginBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 14,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  projectDescription: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    lineHeight: 24,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.errorDim,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.error,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.textSecondary,
  },
  backLink: {
    padding: 12,
  },
  backLinkText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.accent,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 16,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 32,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  copyBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accentDim,
    borderRadius: 10,
    marginBottom: 10,
  },
  codeBlock: {
    backgroundColor: '#0D1117',
    borderRadius: 14,
    padding: 16,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: C.border,
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'JetBrainsMono_400Regular',
    color: '#C9D1D9',
    lineHeight: 20,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  linkCardContent: {
    flex: 1,
  },
  linkCardTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
  },
  linkCardSub: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    marginTop: 2,
  },
  helpText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    marginTop: 10,
    lineHeight: 18,
  },
  actionsSection: {
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  actionBtnPrimaryText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#0A0E1A',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.accent,
  },
  metaSection: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  metaLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
  },
  metaValue: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.text,
  },
});
