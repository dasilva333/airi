export interface WidgetIframeOptions {
  id?: string
  path: string
  sourcePath?: string
  code: string
  title?: string
  state?: any
}

export async function buildWidgetIframeSrcdoc(
  widget: WidgetIframeOptions,
  readFileFn?: (path: string) => Promise<string>,
): Promise<string> {
  let sessionData: any = {}
  let telemetryData: any = {}
  let cognitionData: any = {}

  if (readFileFn) {
    try {
      const rawSession = await readFileFn('/workspace/.airi/session.json')
      sessionData = JSON.parse(rawSession)
    }
    catch {}

    try {
      const rawTelemetry = await readFileFn('/workspace/.airi/telemetry.json')
      telemetryData = JSON.parse(rawTelemetry)
    }
    catch {}

    try {
      const rawCognition = await readFileFn('/workspace/.airi/cognition.json')
      cognitionData = JSON.parse(rawCognition)
    }
    catch {}
  }

  // High-resilience normalization for Telemetry
  const cpu1m = Array.isArray(telemetryData.cpuLoad) ? telemetryData.cpuLoad[0] : (telemetryData.cpuLoad?.['1m'] ?? 0)
  const cpu5m = Array.isArray(telemetryData.cpuLoad) ? telemetryData.cpuLoad[1] : (telemetryData.cpuLoad?.['5m'] ?? 0)
  const cpu15m = Array.isArray(telemetryData.cpuLoad) ? telemetryData.cpuLoad[2] : (telemetryData.cpuLoad?.['15m'] ?? 0)

  const normalizedCpuLoad = Object.assign([cpu1m, cpu5m, cpu15m], {
    '1m': cpu1m,
    '5m': cpu5m,
    '15m': cpu15m,
  })

  const normalizedTelemetry = {
    ...telemetryData,
    idleSeconds: telemetryData.idleTimeSec ?? telemetryData.idleSeconds ?? 0,
    idleTimeSec: telemetryData.idleTimeSec ?? telemetryData.idleSeconds ?? 0,
    activeApp: telemetryData.activeProgram || telemetryData.activeWindowTitle || 'AIRI',
    activeProgram: telemetryData.activeProgram || telemetryData.activeWindowTitle || 'AIRI',
    activeWindowTitle: telemetryData.activeWindowTitle || telemetryData.activeProgram || 'AIRI',
    isAfk: (telemetryData.idleTimeSec ?? 0) > 60,
    cpuLoad: normalizedCpuLoad,
  }

  // High-resilience normalization for Cognition
  const normalizedCognition = {
    ...cognitionData,
    emotion: cognitionData.emotion || 'focused',
    valence: cognitionData.valence ?? 0.8,
    energy: cognitionData.energy ?? 0.85,
    somaticState: cognitionData.somaticState || 'engaged',
    characterName: cognitionData.character?.name || sessionData.characterName || 'AIRI',
    provider: cognitionData.consciousness?.activeProvider || 'local',
    model: cognitionData.consciousness?.activeModel || 'default',
  }

  // High-resilience normalization for Session
  const normalizedSession = {
    ...sessionData,
    id: sessionData.activeSessionId || sessionData.id || 'default',
    activeSessionId: sessionData.activeSessionId || sessionData.id || 'default',
    activeCardName: sessionData.characterName || sessionData.activeCardName || 'AIRI',
    messageCount: sessionData.messageCount ?? 0,
    lastUserMessageAt: sessionData.lastMessageAt || sessionData.lastUserMessageAt || new Date().toISOString(),
    hoursSinceLastMessage: sessionData.hoursSinceLastMessage ?? 0,
  }

  const sidecar = {
    session: normalizedSession,
    telemetry: normalizedTelemetry,
    cognition: normalizedCognition,
  }

  // Preload lazy sidecar state if exists
  const statePath = (widget.sourcePath || widget.path).replace(/\.(ts|js|html)$/, '.json')
  let initialState = widget.state || {}
  if (readFileFn && (!widget.state || Object.keys(widget.state).length === 0)) {
    try {
      const rawState = await readFileFn(statePath)
      if (rawState && rawState.trim()) {
        initialState = JSON.parse(rawState)
      }
    }
    catch {}
  }

  if (widget.path.endsWith('.html')) {
    return `<!DOCTYPE html>
<html class="dark" style="background: transparent !important; color-scheme: dark;">
<head>
  <meta charset="UTF-8">
  <${'script'} src="https://cdn.tailwindcss.com"></${'script'}>
  <style>
    * { box-sizing: border-box; }
    html, body {
      background: transparent !important;
      color: #f8fafc;
      font-family: ui-sans-serif, system-ui, sans-serif;
      margin: 0;
      padding: 0;
      width: 100%;
      height: auto;
      min-height: 0;
      overflow-x: hidden;
    }
    #root {
      width: 100%;
      height: auto;
      min-height: 0;
      display: block;
    }
  </style>
</head>
<body class="antialiased">
  <div id="root" class="w-full">${widget.code}</div>
  <${'script'}>
    const widgetId = ${JSON.stringify(widget.id || '')};
    const widgetPath = ${JSON.stringify(widget.path)};
    let widgetState = ${JSON.stringify(initialState)};
    const root = document.getElementById('root');
    let lastH = 0;
    function reportH() {
      if (!root) return;
      let h = root.scrollHeight || document.body.scrollHeight || 0;
      if (root.firstElementChild) {
        const child = root.firstElementChild;
        h = Math.max(h, child.scrollHeight, child.offsetHeight);
      }
      h = Math.ceil(h);
      if (h > 0 && Math.abs(h - lastH) > 2) {
        lastH = h;
        window.parent.postMessage({ type: 'widget-resize', height: h }, '*');
      }
    }
    window.addEventListener('load', () => setTimeout(reportH, 20));
    if (window.ResizeObserver && root) new ResizeObserver(reportH).observe(root);
  </${'script'}>
</body>
</html>`
  }

  // ES Module (.js / .ts output)
  return `<!DOCTYPE html>
<html class="dark" style="background: transparent !important; color-scheme: dark;">
<head>
  <meta charset="UTF-8">
  <${'script'} src="https://cdn.tailwindcss.com"></${'script'}>
  <style>
    * { box-sizing: border-box; }
    html, body {
      background: transparent !important;
      color: #f8fafc;
      font-family: ui-sans-serif, system-ui, sans-serif;
      margin: 0;
      padding: 0;
      width: 100%;
      height: auto;
      min-height: 0;
      overflow-x: hidden;
    }
    #root {
      width: 100%;
      height: auto;
      min-height: 0;
      display: block;
    }
  </style>
</head>
<body class="antialiased">
  <div id="root" class="w-full"></div>
  <${'script'} type="module">
    const widgetId = ${JSON.stringify(widget.id || '')};
    const widgetPath = ${JSON.stringify(widget.path)};
    const sidecarData = ${JSON.stringify(sidecar)};
    let widgetState = ${JSON.stringify(initialState)};
    const stateListeners = [];

    const root = document.getElementById('root');

    let lastH = 0;
    function reportH() {
      if (!root) return;
      let h = root.scrollHeight || document.body.scrollHeight || 0;
      if (root.firstElementChild) {
        const child = root.firstElementChild;
        h = Math.max(h, child.scrollHeight, child.offsetHeight);
      }
      h = Math.ceil(h);
      if (h > 0 && Math.abs(h - lastH) > 2) {
        lastH = h;
        window.parent.postMessage({ type: 'widget-resize', height: h }, '*');
      }
    }
    window.addEventListener('load', () => setTimeout(reportH, 20));
    if (window.ResizeObserver && root) new ResizeObserver(reportH).observe(root);

    function setState(val) {
      if (typeof val === 'function') {
        widgetState = val(widgetState);
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        widgetState = { ...widgetState, ...val };
      } else {
        widgetState = val;
      }
      window.parent.postMessage({
        type: 'widget-state-update',
        id: widgetId,
        path: widgetPath,
        state: widgetState,
      }, '*');
      for (const cb of stateListeners) {
        try { cb(widgetState); } catch (e) { console.error(e); }
      }
    }

    function onStateChange(cb) {
      if (typeof cb === 'function') {
        stateListeners.push(cb);
        return () => {
          const idx = stateListeners.indexOf(cb);
          if (idx !== -1) stateListeners.splice(idx, 1);
        };
      }
      return () => {};
    }

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'widget-state-sync') {
        if (!widgetId || !e.data.id || e.data.id === widgetId || e.data.path === widgetPath) {
          widgetState = e.data.state;
          for (const cb of stateListeners) {
            try { cb(widgetState); } catch (err) { console.error(err); }
          }
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i')) {
        window.parent.postMessage({ type: 'open-devtools' }, '*');
      }
    });

    const baseContext = {
      container: root,
      sidecar: sidecarData,
      data: sidecarData,
      get state() { return widgetState; },
      setState,
      onStateChange,
      onUpdate: (cb) => {
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'sidecar-update') cb(e.data.sidecar);
        });
        return () => {};
      },
      callMcpTool: (name, args) => {
        return new Promise((resolve, reject) => {
          const reqId = 'mcp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
          function onMsg(e) {
            if (e.data && e.data.type === 'mcp-call-result' && e.data.id === reqId) {
              window.removeEventListener('message', onMsg);
              if (e.data.error) reject(new Error(e.data.error));
              else resolve(e.data.result);
            }
          }
          window.addEventListener('message', onMsg);
          window.parent.postMessage({ type: 'mcp-call', id: reqId, name, args }, '*');
        });
      }
    };

    // Proxy so context acts seamlessly as both AiriWidgetContext and HTMLElement container
    const context = new Proxy(baseContext, {
      get(target, prop, receiver) {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        if (prop === 'querySelector') {
          return (selector) => {
            let el = root.querySelector(selector);
            if (!el && typeof selector === 'string' && !selector.startsWith('#') && !selector.startsWith('.') && !selector.includes('[') && !selector.includes(':') && !selector.includes(' ') && !selector.includes('>')) {
              el = root.querySelector('#' + selector);
            }
            return el;
          };
        }
        if (prop === 'getElementById') {
          return (id) => root.querySelector('#' + id);
        }
        const val = Reflect.get(root, prop);
        if (typeof val === 'function') {
          return val.bind(root);
        }
        return val;
      },
      set(target, prop, value, receiver) {
        if (prop in target) {
          return Reflect.set(target, prop, value, receiver);
        }
        const res = Reflect.set(root, prop, value);
        if (prop === 'innerHTML' || prop === 'style') {
          setTimeout(reportH, 50);
        }
        return res;
      }
    });

    try {
      const code = ${JSON.stringify(widget.code)};
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const mod = await import(blobUrl);
      URL.revokeObjectURL(blobUrl);

      // Resolve mount/init/render function across all standard ESM and object export patterns
      let mountFn = null;
      let renderFn = null;

      if (typeof mod.default === 'function') {
        mountFn = mod.default;
      } else if (mod.default && typeof mod.default === 'object') {
        if (typeof mod.default.init === 'function') mountFn = mod.default.init;
        else if (typeof mod.default.mount === 'function') mountFn = mod.default.mount;
        else if (typeof mod.default.render === 'function') renderFn = mod.default.render;
        else if (typeof mod.default.default === 'function') mountFn = mod.default.default;
      }

      if (!mountFn && !renderFn) {
        if (typeof mod.mount === 'function') mountFn = mod.mount;
        else if (typeof mod.init === 'function') mountFn = mod.init;
        else if (typeof mod.render === 'function') renderFn = mod.render;
      }

      if (mountFn) {
        const res = mountFn(context, context.sidecar);
        if (typeof res === 'string') root.innerHTML = res;
      } else if (renderFn) {
        const res = renderFn(context, context.sidecar);
        if (typeof res === 'string') root.innerHTML = res;
      } else {
        throw new Error('No valid entrypoint found in widget module. Expected default function, { init }, { mount }, or render() export.');
      }
      setTimeout(reportH, 100);
    } catch (err) {
      console.error('[GenerativeWidget] Execution Error:', err);
      root.innerHTML = \`
        <div class="rounded-xl border border-rose-800/80 bg-rose-950/70 p-3 text-rose-200 w-full text-xs space-y-1 shadow-lg">
          <div class="font-bold flex items-center gap-1.5 text-rose-300">
            <span>⚠️ Widget Execution Error</span>
          </div>
          <pre class="mt-1 text-[11px] font-mono whitespace-pre-wrap text-rose-300 overflow-x-auto">\${err.stack || err.message}</pre>
        </div>
      \`;
      setTimeout(reportH, 50);
    }
  </${'script'}>
</body>
</html>`
}
