import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useProjects } from '@/lib/project-context';
import { Project, ProjectStatus } from '@/lib/types';

const C = Colors.dark;

function getStatusConfig(status: ProjectStatus) {
  switch (status) {
    case 'drafting': return { label: 'Draft', color: C.textMuted, icon: 'create-outline' as const };
    case 'generating': return { label: 'Generating', color: C.warning, icon: 'flash-outline' as const };
    case 'generated': return { label: 'Code Ready', color: C.accent, icon: 'code-slash-outline' as const };
    case 'pushing': return { label: 'Pushing', color: C.warning, icon: 'cloud-upload-outline' as const };
    case 'building': return { label: 'Building', color: C.purple, icon: 'hammer-outline' as const };
    case 'ready': return { label: 'APK Ready', color: C.success, icon: 'checkmark-circle-outline' as const };
    case 'error': return { label: 'Error', color: C.error, icon: 'alert-circle-outline' as const };
    default: return { label: 'Unknown', color: C.textMuted, icon: 'help-circle-outline' as const };
  }
}

function ProjectCard({ item, index }: { item: Project; index: number }) {
  const statusConfig = getStatusConfig(item.status);
  const timeAgo = getTimeAgo(item.updatedAt);

  return (
    <Animated.View entering={Platform.OS !== 'web' ? FadeInDown.delay(index * 80).springify() : undefined}>
      <Pressable
        style={({ pressed }) => [styles.projectCard, pressed && styles.cardPressed]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/project/[id]', params: { id: item.id } });
        }}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          <Text style={styles.timeText}>{timeAgo}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description || item.prompt}</Text>
        <View style={styles.cardFooter}>
          {item.githubRepo ? (
            <View style={styles.repoTag}>
              <Ionicons name="logo-github" size={12} color={C.textSecondary} />
              <Text style={styles.repoText} numberOfLines={1}>{item.githubRepo}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SetupBanner() {
  return (
    <Pressable
      style={styles.setupBanner}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/settings');
      }}
    >
      <View style={styles.setupBannerIcon}>
        <Ionicons name="key-outline" size={22} color={C.accent} />
      </View>
      <View style={styles.setupBannerContent}>
        <Text style={styles.setupBannerTitle}>Get Started in 2 Minutes</Text>
        <Text style={styles.setupBannerDesc}>
          Tap here to set up your free AI key and GitHub. We'll walk you through every step.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.textMuted} />
    </Pressable>
  );
}

function EmptyState({ needsSetup }: { needsSetup: boolean }) {
  return (
    <View style={styles.emptyContainer}>
      {needsSetup && <SetupBanner />}
      <View style={styles.emptyIconBg}>
        <Ionicons name="rocket-outline" size={40} color={C.accent} />
      </View>
      <Text style={styles.emptyTitle}>No projects yet</Text>
      <Text style={styles.emptySubtitle}>
        {needsSetup
          ? 'Set up your free API key above, then tap + to create your first app!'
          : 'Tap + to describe your app idea and ZeroBuild AI will generate the code, push it to GitHub, and build your APK'}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { projects, isLoading, removeProject, settings } = useProjects();
  const needsSetup = !(settings.geminiApiKey || settings.groqApiKey || settings.huggingfaceApiKey || settings.llmApiKey);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const handleDelete = useCallback((project: Project) => {
    if (Platform.OS === 'web') {
      removeProject(project.id);
      return;
    }
    Alert.alert('Delete Project', `Remove "${project.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeProject(project.id) },
    ]);
  }, [removeProject]);

  const renderItem = useCallback(({ item, index }: { item: Project; index: number }) => (
    <ProjectCard item={item} index={index} />
  ), []);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0, 212, 255, 0.08)', 'transparent']}
        style={[styles.headerGradient, { paddingTop: insets.top + webTopInset + 16 }]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>ZeroBuild</Text>
            <Text style={styles.logoSub}>AI App Generator</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
            style={styles.settingsBtn}
          >
            <Feather name="settings" size={22} color={C.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{projects.length}</Text>
            <Text style={styles.statLabel}>Projects</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{projects.filter(p => p.status === 'ready').length}</Text>
            <Text style={styles.statLabel}>Built</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{projects.filter(p => p.status === 'generating' || p.status === 'building').length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={projects}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 100 },
        ]}
        ListEmptyComponent={() => <EmptyState needsSetup={needsSetup} />}
        ListHeaderComponent={needsSetup && projects.length > 0 ? SetupBanner : undefined}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) + 24 },
          pressed && styles.fabPressed,
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/create');
        }}
      >
        <LinearGradient
          colors={['#00D4FF', '#0099CC']}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="add" size={28} color="#0A0E1A" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: {
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: C.text,
    letterSpacing: -0.5,
  },
  logoSub: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.accent,
    marginTop: 2,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: C.text,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: C.border,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  projectCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardPressed: {
    backgroundColor: C.surfaceElevated,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    marginLeft: 'auto',
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  repoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  repoText: {
    fontSize: 12,
    fontFamily: 'JetBrainsMono_400Regular',
    color: C.textSecondary,
    flex: 1,
  },
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accentDim,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.accent,
    gap: 12,
  },
  setupBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupBannerContent: {
    flex: 1,
  },
  setupBannerTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.accent,
    marginBottom: 4,
  },
  setupBannerDesc: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    lineHeight: 19,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 24,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
