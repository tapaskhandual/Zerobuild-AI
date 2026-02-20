import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useProjects } from '@/lib/project-context';
import { refineCode } from '@/lib/ai-service';
import { RefinementMessage } from '@/lib/types';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').default;
  } catch {}
}

const C = Colors.dark;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function PreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { projects, settings, updateProject } = useProjects();
  const [promptText, setPromptText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const webViewRef = useRef<any>(null);
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const project = projects.find(p => p.id === id);
  const refinements = project?.refinements || [];

  useEffect(() => {
    if (Platform.OS === 'web') {
      fetch('/api/preview')
        .then(r => r.text())
        .then(html => setPreviewHtml(html))
        .catch(() => {});
    }
  }, []);

  const sendCodeToPreview = useCallback((code: string) => {
    if (Platform.OS === 'web') {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'preview-code', code }, '*');
      }
    } else if (webViewRef.current) {
      const escaped = JSON.stringify(code);
      webViewRef.current.injectJavaScript(`
        try { renderPreview(${escaped}); } catch(e) { console.error(e); }
        true;
      `);
    }
  }, []);

  useEffect(() => {
    if (project?.generatedCode && showPreview) {
      const timer = setTimeout(() => {
        sendCodeToPreview(project.generatedCode);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [project?.generatedCode, showPreview, sendCodeToPreview]);

  const handleIframeLoad = useCallback(() => {
    if (project?.generatedCode) {
      setTimeout(() => sendCodeToPreview(project.generatedCode), 500);
    }
  }, [project?.generatedCode, sendCodeToPreview]);

  const handleWebViewLoad = useCallback(() => {
    if (project?.generatedCode) {
      setTimeout(() => sendCodeToPreview(project.generatedCode), 1000);
    }
  }, [project?.generatedCode, sendCodeToPreview]);

  const handleRefine = useCallback(async () => {
    if (!project || !promptText.trim() || isRefining) return;

    const userMessage: RefinementMessage = {
      id: generateId(),
      role: 'user',
      content: promptText.trim(),
      createdAt: Date.now(),
    };

    const currentRefinements = [...refinements, userMessage];
    setPromptText('');
    setIsRefining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await updateProject({
      ...project,
      refinements: currentRefinements,
      updatedAt: Date.now(),
    });

    try {
      const updatedCode = await refineCode(
        project.prompt,
        project.generatedCode,
        promptText.trim(),
        settings
      );

      const assistantMessage: RefinementMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Changes applied successfully.',
        createdAt: Date.now(),
      };

      await updateProject({
        ...project,
        generatedCode: updatedCode,
        refinements: [...currentRefinements, assistantMessage],
        updatedAt: Date.now(),
      });

      sendCodeToPreview(updatedCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const errorMessage: RefinementMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Failed to apply changes: ${e.message}`,
        createdAt: Date.now(),
      };

      await updateProject({
        ...project,
        refinements: [...currentRefinements, errorMessage],
        updatedAt: Date.now(),
      });
    } finally {
      setIsRefining(false);
    }
  }, [project, promptText, isRefining, refinements, settings, updateProject, sendCodeToPreview]);

  const handleBuild = useCallback(() => {
    if (project) {
      router.replace({ pathname: '/project/[id]', params: { id: project.id } });
    }
  }, [project]);

  if (!project) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Project not found</Text>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const renderMessage = ({ item }: { item: RefinementMessage }) => (
    <View style={[
      styles.messageRow,
      item.role === 'user' ? styles.userMessageRow : styles.assistantMessageRow,
    ]}>
      <View style={[
        styles.messageBubble,
        item.role === 'user' ? styles.userBubble : styles.assistantBubble,
      ]}>
        {item.role === 'assistant' && (
          <Feather
            name={item.content.startsWith('Failed') ? 'alert-circle' : 'check-circle'}
            size={14}
            color={item.content.startsWith('Failed') ? C.error : C.success}
            style={{ marginBottom: 4 }}
          />
        )}
        <Text style={[
          styles.messageText,
          item.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
        ]}>
          {item.content}
        </Text>
      </View>
    </View>
  );

  const renderPreviewContent = () => {
    if (Platform.OS === 'web' && previewHtml) {
      return (
        <iframe
          ref={(ref: any) => { iframeRef.current = ref; }}
          srcDoc={previewHtml}
          onLoad={handleIframeLoad}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: 16,
            backgroundColor: '#0f172a',
          } as any}
          sandbox="allow-scripts"
        />
      );
    }

    if (Platform.OS !== 'web' && WebView) {
      return (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: previewHtml || PREVIEW_HTML_FALLBACK }}
          onLoad={handleWebViewLoad}
          style={{ flex: 1, backgroundColor: '#0f172a', borderRadius: 16 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={true}
        />
      );
    }

    if (Platform.OS === 'web' && !previewHtml) {
      return (
        <View style={styles.previewPlaceholder}>
          <ActivityIndicator size="small" color={C.accent} />
          <Text style={styles.previewPlaceholderText}>Loading preview...</Text>
        </View>
      );
    }

    return (
      <View style={styles.previewPlaceholder}>
        <Feather name="smartphone" size={32} color={C.textMuted} />
        <Text style={styles.previewPlaceholderText}>
          Preview requires WebView
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={24} color={C.textSecondary} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>Preview & Refine</Text>
        <Pressable
          onPress={() => setShowPreview(!showPreview)}
          style={[styles.navBtn, { backgroundColor: showPreview ? C.accentDim : 'transparent' }]}
        >
          <Feather name={showPreview ? 'eye' : 'eye-off'} size={18} color={showPreview ? C.accent : C.textMuted} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        {showPreview && (
          <View style={styles.previewContainer}>
            <View style={styles.phoneMockup}>
              {renderPreviewContent()}
            </View>
          </View>
        )}

        <View style={[styles.chatSection, !showPreview && { flex: 1 }]}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Refinements</Text>
            {refinements.length > 0 && (
              <Text style={styles.chatCount}>{refinements.length} messages</Text>
            )}
          </View>

          {refinements.length === 0 && !isRefining ? (
            <View style={styles.emptyChat}>
              <Feather name="message-circle" size={28} color={C.textMuted} />
              <Text style={styles.emptyChatText}>
                Describe changes you'd like to make
              </Text>
              <Text style={styles.emptyChatHint}>
                e.g. "Change the color theme to blue" or "Add a search bar to the home screen"
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={refinements}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }}
            />
          )}

          {isRefining && (
            <View style={styles.refiningIndicator}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text style={styles.refiningText}>Applying changes...</Text>
            </View>
          )}
        </View>

        <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={promptText}
              onChangeText={setPromptText}
              placeholder="Describe changes..."
              placeholderTextColor={C.textMuted}
              multiline
              maxLength={1000}
              editable={!isRefining}
              onSubmitEditing={handleRefine}
              blurOnSubmit
            />
            <Pressable
              onPress={handleRefine}
              disabled={!promptText.trim() || isRefining}
              style={({ pressed }) => [
                styles.sendBtn,
                (!promptText.trim() || isRefining) && styles.sendBtnDisabled,
                pressed && { opacity: 0.7 },
              ]}
            >
              {isRefining ? (
                <ActivityIndicator size="small" color="#0A0E1A" />
              ) : (
                <Ionicons name="send" size={18} color="#0A0E1A" />
              )}
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.buildBtn, pressed && { opacity: 0.8 }]}
            onPress={handleBuild}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.buildBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="rocket" size={18} color="#fff" />
              <Text style={styles.buildBtnText}>Build This App</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const PREVIEW_HTML_FALLBACK = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;overflow:hidden;height:100vh;width:100vw}
#root{height:100vh;width:100vw;overflow:auto}
#error-display{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.95);color:#ef4444;padding:24px;overflow:auto;z-index:9999;font-family:monospace;font-size:13px;white-space:pre-wrap;line-height:1.6}
#error-display h3{color:#f87171;margin-bottom:12px;font-size:16px}
#loading{display:flex;align-items:center;justify-content:center;height:100vh;color:#94a3b8;font-size:14px}
</style>
</head>
<body>
<div id="root"><div id="loading">Loading preview...</div></div>
<div id="error-display"></div>
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"><\/script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"><\/script>
<script src="https://unpkg.com/react-native-web@0.19.13/dist/react-native-web.umd.js"><\/script>
<script src="https://unpkg.com/@babel/standalone@7.26.10/babel.min.js"><\/script>
<script>
window.onerror=function(msg,url,line){
  var el=document.getElementById('error-display');
  el.style.display='block';
  el.innerHTML='<h3>Preview Error</h3>'+msg+'\\n\\nLine: '+line;
};

window.addEventListener('message',function(e){
  if(e.data&&e.data.type==='preview-code'){
    renderPreview(e.data.code);
  }
},false);

function renderPreview(code){
  var errorEl=document.getElementById('error-display');
  errorEl.style.display='none';

  var mockModules={
    'expo-status-bar':{StatusBar:function(){return null}},
    'expo-location':{requestForegroundPermissionsAsync:function(){return Promise.resolve({status:'granted'})},getCurrentPositionAsync:function(){return Promise.resolve({coords:{latitude:37.78,longitude:-122.41}})}},
    'expo-haptics':{impactAsync:function(){},notificationAsync:function(){},selectionAsync:function(){},ImpactFeedbackStyle:{Light:'light',Medium:'medium',Heavy:'heavy'},NotificationFeedbackType:{Success:'success',Warning:'warning',Error:'error'}},
    'expo-linear-gradient':{LinearGradient:function(props){return React.createElement(ReactNativeWeb.View,{style:[{background:'linear-gradient(135deg, '+(props.colors||['#333','#666']).join(', ')+')'} ].concat(props.style||[])},props.children)}},
    'react-native-maps':{default:function(props){return React.createElement(ReactNativeWeb.View,{style:[{backgroundColor:'#1a2332',alignItems:'center',justifyContent:'center',borderRadius:12}].concat(props.style||[])},React.createElement(ReactNativeWeb.Text,{style:{color:'#64748b',fontSize:14}},'Map View'))},Marker:function(){return null}},
    '@react-native-async-storage/async-storage':{default:(function(){var store={};return{getItem:function(k){return Promise.resolve(store[k]||null)},setItem:function(k,v){store[k]=v;return Promise.resolve()},removeItem:function(k){delete store[k];return Promise.resolve()},getAllKeys:function(){return Promise.resolve(Object.keys(store))},clear:function(){store={};return Promise.resolve()}}})()}
  };

  var processedCode=code
    .replace(/import\\s+\\{[^}]*StatusBar[^}]*\\}\\s+from\\s+['"]expo-status-bar['"];?/g,'var StatusBar=function(){return null};')
    .replace(/import\\s+\\*\\s+as\\s+Location\\s+from\\s+['"]expo-location['"];?/g,'var Location=window.__mocks__["expo-location"];')
    .replace(/import\\s+\\*\\s+as\\s+Haptics\\s+from\\s+['"]expo-haptics['"];?/g,'var Haptics=window.__mocks__["expo-haptics"];')
    .replace(/import\\s+\\{\\s*LinearGradient\\s*\\}\\s+from\\s+['"]expo-linear-gradient['"];?/g,'var LinearGradient=window.__mocks__["expo-linear-gradient"].LinearGradient;')
    .replace(/import\\s+MapView[^;]*from\\s+['"]react-native-maps['"];?/g,'var MapView=window.__mocks__["react-native-maps"].default;var Marker=window.__mocks__["react-native-maps"].Marker;')
    .replace(/import\\s+AsyncStorage\\s+from\\s+['"]@react-native-async-storage\\/async-storage['"];?/g,'var AsyncStorage=window.__mocks__["@react-native-async-storage/async-storage"].default;')
    .replace(/import\\s+React[^;]*from\\s+['"]react['"];?/g,'')
    .replace(/import\\s+\\{([^}]*)\\}\\s+from\\s+['"]react-native['"];?/g,function(m,imports){
      var names=imports.split(',').map(function(s){return s.trim()}).filter(Boolean);
      return 'var '+names.map(function(n){return n+'=ReactNativeWeb.'+n}).join(',')+ ';';
    })
    .replace(/export\\s+default\\s+/,'window.__AppComponent__=');

  window.__mocks__=mockModules;

  try{
    var transformed=Babel.transform(processedCode,{presets:['react'],plugins:[]}).code;
    var fn=new Function('React','ReactNativeWeb',transformed);
    fn(React,ReactNativeWeb);

    var AppComp=window.__AppComponent__;
    if(AppComp){
      var root=document.getElementById('root');
      root.innerHTML='';
      ReactDOM.render(React.createElement(AppComp),root);
    }else{
      throw new Error('No App component found');
    }
  }catch(err){
    errorEl.style.display='block';
    errorEl.innerHTML='<h3>Preview Error</h3>'+err.message;
  }
}
<\/script>
</body>
</html>`;

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
  notFoundText: {
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  topTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.text,
    textAlign: 'center',
  },
  previewContainer: {
    height: 360,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  phoneMockup: {
    width: Math.min(SCREEN_WIDTH - 64, 320),
    height: '100%',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.borderLight,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  previewPlaceholderText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    textAlign: 'center',
  },
  chatSection: {
    flex: 1,
    minHeight: 100,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  chatTitle: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chatCount: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyChatText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.textSecondary,
    textAlign: 'center',
  },
  emptyChatHint: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  assistantMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: C.accent,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: C.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#0A0E1A',
  },
  assistantMessageText: {
    color: C.textSecondary,
  },
  refiningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  refiningText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: C.accent,
  },
  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.background,
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: C.text,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: C.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  buildBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buildBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  buildBtnText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#fff',
  },
});
