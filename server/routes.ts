import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const PREVIEW_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>App Preview</title>
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
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/react-native-web@0.19.13/dist/react-native-web.umd.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.26.10/babel.min.js"></script>
<script>
window.onerror=function(msg,url,line,col,err){
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
      throw new Error('No App component found in generated code');
    }
  }catch(err){
    errorEl.style.display='block';
    errorEl.innerHTML='<h3>Preview Error</h3>'+err.message;
  }
}
</script>
</body>
</html>`;

export async function registerRoutes(app: Express): Promise<Server> {
  app.get('/api/preview', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(PREVIEW_HTML);
  });

  const httpServer = createServer(app);

  return httpServer;
}
