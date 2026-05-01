// ============================================================================
// PLUMIA — processor.js  v10.08
// PlumiaProcessor: extracción de texto, chunking, llamadas API, análisis
// Depende de: corrections-config.js, synonyms-db.js
// ============================================================================
(function() {
// Aliases locales de los globals
var CORRECTIONS          = window.PLUMIA.CORRECTIONS;
var CONFIG               = window.PLUMIA.CONFIG;
var API_CORRECTION_GROUPS = window.PLUMIA.API_GROUPS;
var LOCAL_ONLY_IDS       = window.PLUMIA.LOCAL_IDS;
var enrichWithLocalSynonyms  = window.PLUMIA.enrichWithLocalSynonyms;
var runLocalOrtotypography   = window.PLUMIA.runLocalOrtotypography;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const STORAGE_KEY_PROGRESS = 'plumia_analysis_progress';

window.PLUMIA.PlumiaProcessor = class PlumiaProcessor {
  constructor(apiKey, selectedIds, outputMode, onProgress, onChunkComplete, onError) {
    this.apiKey = apiKey; this.selectedIds = selectedIds;
    this.outputMode = outputMode; this.onProgress = onProgress;
    this.onChunkComplete = onChunkComplete; this.onError = onError;
    this.aborted = false;
    this.errored = false; // true si el análisis se interrumpió por error
    // Acumulador de tokens reales para calcular el coste final exacto
    this.totalUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
  }

  // Calcula el coste real en USD a partir del uso acumulado
  getRealCostUSD() {
    const INPUT_PRICE         = 0.000003;   // $3 / 1M tokens
    const OUTPUT_PRICE        = 0.000015;   // $15 / 1M tokens
    const CACHE_WRITE_PRICE   = 0.00000375; // $3.75 / 1M tokens (crear caché)
    const CACHE_READ_PRICE    = 0.0000003;  // $0.30 / 1M tokens (leer caché = 90% dto)

    return (
      this.totalUsage.input_tokens               * INPUT_PRICE +
      this.totalUsage.output_tokens              * OUTPUT_PRICE +
      this.totalUsage.cache_creation_input_tokens * CACHE_WRITE_PRICE +
      this.totalUsage.cache_read_input_tokens    * CACHE_READ_PRICE
    );
  }

  async extractTextFromDocument(forceFullDoc = false) {
    console.log('[DBG-EXT1] extractTextFromDocument: forceFullDoc=', forceFullDoc, 'state.forceFullDoc=', state.forceFullDoc);
    // Prioridad 1: texto capturado antes de que el panel robe el foco (sin Word.run)
    if (!forceFullDoc && !state.forceFullDoc) {
      const captured = state.capturedSelectionText;
      console.log('[DBG-EXT2] capturedSelectionText=', captured ? 'SET('+captured.length+')' : 'null');
      if (captured && captured.length > 10) {
        console.log('[DBG-EXT3] retornando capturedSelectionText');
        return { text: captured, isSelection: true, wordCount: this._countWords(captured) };
      }
      // Fallback: intentar leer la selección activa en su propio Word.run
      console.log('[DBG-EXT4] intentando selección activa…');
      try {
        const selectedText = await Word.run(async ctx => {
          const sel = ctx.document.getSelection();
          sel.load('text'); await ctx.sync();
          return (sel.text || '').trim();
        });
        console.log('[DBG-EXT5] selección activa longitud=', selectedText.length);
        if (selectedText && selectedText.length > 10) {
          return { text: selectedText, isSelection: true, wordCount: this._countWords(selectedText) };
        }
      } catch(eS) { console.warn('[DBG-EXT5b] selección no disponible:', eS.message); }
    }

    // Documento completo: body.text directo (seguro para cualquier tamaño de documento).
    // NOTA: body.load('paragraphs') se eliminó porque en documentos de 150+ hojas
    // genera miles de proxies Office JS y revienta el WebView sin lanzar excepción JS.
    console.log('[DBG-EXT6] iniciando body.load(text)…');
    try {
      const fullText = await Word.run(async ctx => {
        const body = ctx.document.body;
        body.load('text'); await ctx.sync();
        console.log('[DBG-EXT7] body.text cargado, longitud=', (body.text||'').length);
        return (body.text || '').trim();
      });
      console.log('[DBG-EXT8] body.text OK, wordCount=', this._countWords(fullText));
      return { text: fullText, isSelection: false, wordCount: this._countWords(fullText) };
    } catch(eB) {
      console.warn('[DBG-EXT9] body.text falló:', eB.message);
      throw new Error('Error al leer el documento: ' + eB.message);
    }
  }

  // Realiza una llamada a la API de Anthropic y devuelve el JSON parseado.
  // Trunca el prompt si es demasiado largo para evitar errores de contexto.
  //
  // ── MODO MOCK / CAPTURE ───────────────────────────────────────────────────────
  //
  // mock_responses.json admite dos formatos:
  //
  //   Formato MULTI-TEST (recomendado):
  //     {
  //       "test1": { "desc": "descripción opcional", "responses": [...] },
  //       "test2": { "desc": "...", "responses": [...] }
  //     }
  //
  //   Formato SIMPLE / legacy (array plano, retrocompatible):
  //     [ {findings:[...]}, {findings:[...]}, ... ]
  //
  // window.PLUMIA_MOCK = 'test1'  → usa el test llamado "test1"
  // window.PLUMIA_MOCK = true     → usa el primer test disponible (o el array si es legacy)
  //
  // window.PLUMIA_CAPTURE = 'test1'  → graba las respuestas bajo la clave "test1"
  // window.PLUMIA_CAPTURE = true     → graba bajo la clave "capture" (nombre por defecto)
  //
  // Para exportar todo el fichero tras capturar:
  //   copy(localStorage.getItem('PLUMIA_MOCK_RESPONSES'))
  // ─────────────────────────────────────────────────────────────────────────────

  // Devuelve el array de respuestas del test seleccionado desde el almacén raw.
  _resolveTestResponses(raw) {
    if (!raw) return [];
    // Formato legacy: array plano
    if (Array.isArray(raw)) return raw;
    // Formato multi-test: objeto con claves
    const key = typeof window.PLUMIA_MOCK === 'string' ? window.PLUMIA_MOCK : null;
    if (key && raw[key]) return raw[key].responses || [];
    // PLUMIA_MOCK = true → último test capturado (más reciente, ignorando "test1" de dev)
    const keys = Object.keys(raw).filter(k => k !== 'test1');
    const fallbackKey = keys.length ? keys[keys.length - 1] : Object.keys(raw).slice(-1)[0];
    if (fallbackKey) return raw[fallbackKey].responses || [];
    return [];
  }

  async _callAPI(prompt, _retryCount = 0) {

    // ── MODO MOCK: devolver respuesta guardada sin llamar a la API ────────────
    if (window.PLUMIA_MOCK) {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem('PLUMIA_MOCK_RESPONSES') || 'null'); } catch(e) {}
      const stored = this._resolveTestResponses(raw);
      const idx = this._mockCallIndex || 0;
      this._mockCallIndex = idx + 1;
      const saved = stored[idx];
      const testName = typeof window.PLUMIA_MOCK === 'string' ? window.PLUMIA_MOCK : (() => { const ks = Object.keys(raw||{}).filter(k=>k!=='test1'); return ks.length ? ks[ks.length-1] : Object.keys(raw||{}).slice(-1)[0] || 'legacy'; })();
      if (saved !== undefined) {
        console.log(`[PLUMIA MOCK "${testName}"] llamada ${idx + 1}/${stored.length} → respuesta guardada`);
        return saved;
      }
      console.warn(`[PLUMIA MOCK "${testName}"] llamada ${idx + 1}: no hay respuesta guardada (solo hay ${stored.length})`);
      return { findings: [] };
    }

    // ── Delay entre llamadas para evitar rate limit (1s entre requests) ────────
    if (this._lastCallTime) {
      const elapsed = Date.now() - this._lastCallTime;
      if (elapsed < 1000) await new Promise(r => setTimeout(r, 1000 - elapsed));
    }
    this._lastCallTime = Date.now();

    const MAX_CHARS = 480000;
    const safePrompt = prompt.length > MAX_CHARS
      ? prompt.substring(0, MAX_CHARS) + '\n\n[TEXTO TRUNCADO]\n\nResponde con el JSON solicitado basándote en lo analizado hasta aquí.'
      : prompt;

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        messages: [{ role: 'user', content: safePrompt }],
      }),
    });

    if (!resp.ok) {
      const d = await resp.json().catch(() => ({}));
      if (d.usage) {
        this.totalUsage.input_tokens  += d.usage.input_tokens  || 0;
        this.totalUsage.output_tokens += d.usage.output_tokens || 0;
      }
      const msg = d.error?.message || `HTTP ${resp.status}`;
      if (resp.status === 401) throw new Error('API_KEY_INVALID: ' + msg);
      if (resp.status === 429) {
        if (_retryCount < 2) {
          const wait = ((_retryCount + 1) * 30000); // 30s primer retry, 60s segundo
          console.warn(`[PLUMIA] Rate limit (429) — reintento ${_retryCount + 1}/2 en ${wait/1000}s…`);
          await new Promise(r => setTimeout(r, wait));
          return this._callAPI(prompt, _retryCount + 1);
        }
        throw new Error('RATE_LIMIT: ' + msg);
      }
      if (resp.status === 402 || msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('balance') || msg.toLowerCase().includes('insufficient')) {
        throw new Error('INSUFFICIENT_CREDITS: ' + msg);
      }
      throw new Error('API_ERROR: ' + msg);
    }

    const data = await resp.json();

    // Acumular uso real de tokens
    if (data.usage) {
      this.totalUsage.input_tokens  += data.usage.input_tokens  || 0;
      this.totalUsage.output_tokens += data.usage.output_tokens || 0;
    }

    const raw = data.content?.[0]?.text || '';

    // Extraer el ÚLTIMO bloque JSON (el modelo a veces razona y da un segundo JSON corregido)
    const stripped = raw.replace(/```json\n?|\n?```/g, '').trim();
    let clean = '{}';
    const lastClose = stripped.lastIndexOf('}');
    if (lastClose >= 0) {
      let depth = 0;
      for (let i = lastClose; i >= 0; i--) {
        if (stripped[i] === '}') depth++;
        else if (stripped[i] === '{') { if (--depth === 0) { clean = stripped.substring(i, lastClose + 1); break; } }
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      try {
        const repaired = clean
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":');
        parsed = JSON.parse(repaired);
      } catch {
        try {
          // Reparar comillas sin escapar y saltos de línea literales dentro de valores de cadena
          let fixed = '', inStr = false, i = 0;
          while (i < clean.length) {
            const c = clean[i];
            if (c === '\\' && inStr) { fixed += c + (clean[i+1]||''); i+=2; continue; }
            if (inStr && (c === '\n' || c === '\r')) { fixed += c === '\n' ? '\\n' : '\\r'; i++; continue; }
            if (c === '"') {
              if (!inStr) { inStr = true; fixed += c; }
              else {
                let j = i+1;
                while (j < clean.length && clean[j] === ' ') j++;
                const nx = clean[j];
                if (!nx || nx===':'||nx===','||nx==='}'||nx===']'||nx==='\n'||nx==='\r') { inStr=false; fixed+=c; }
                else { fixed += '\\"'; }
              }
            } else { fixed += c; }
            i++;
          }
          parsed = JSON.parse(fixed);
        } catch {
          console.warn('Plumia: JSON inválido de la API [stop_reason=' + (data.stop_reason || '?') + '] len=' + raw.length + ':\n' + raw);
          parsed = { findings: [] };
        }
      }
    }

    // ── MODO CAPTURE: guardar respuesta en localStorage ───────────────────────
    if (window.PLUMIA_CAPTURE) {
      const captureKey = typeof window.PLUMIA_CAPTURE === 'string' ? window.PLUMIA_CAPTURE : 'capture';
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem('PLUMIA_MOCK_RESPONSES') || 'null'); } catch(e) {}
      // Normalizar a formato multi-test si era legacy o vacío
      if (!raw || Array.isArray(raw)) raw = {};
      if (!raw[captureKey]) raw[captureKey] = { desc: '', responses: [] };
      raw[captureKey].responses.push(parsed);
      localStorage.setItem('PLUMIA_MOCK_RESPONSES', JSON.stringify(raw));
      const n = raw[captureKey].responses.length;
      // Contar findings: puede estar en parsed.findings (simple) o en parsed.X.findings (agrupado)
      const totalFindings = (parsed.findings || []).length ||
        Object.values(parsed)
          .filter(v => v && typeof v === 'object' && Array.isArray(v.findings))
          .reduce((sum, v) => sum + v.findings.length, 0);
      console.log(`[PLUMIA CAPTURE "${captureKey}"] respuesta ${n} guardada (findings: ${totalFindings})`);
    }

    return parsed;
  }

  _splitIntoChunks(text, size, overlap) {
    const words = text.split(/\s+/);
    if (words.length <= size) return [text];
    const chunks = []; let start = 0;
    while (start < words.length) {
      const end = Math.min(start + size, words.length);
      chunks.push(words.slice(start, end).join(' '));
      if (end >= words.length) break; // fin del texto, no hay más chunks
      start = end - overlap;
    }
    return chunks;
  }

  _splitByChapters(text) {
    const pat = /^(cap[íi]tulo\s+\d+|chapter\s+\d+|parte\s+\d+|\d+\.\s+[A-ZÁÉÍÓÚ])/im;
    const lines = text.split('\n'); const chapters = [];
    let title = 'Inicio', curr = [];
    for (const line of lines) {
      if (pat.test(line.trim())) {
        if (curr.length) chapters.push({title, text:curr.join('\n')});
        title = line.trim(); curr = [];
      } else { curr.push(line); }
    }
    if (curr.length) chapters.push({title, text:curr.join('\n')});
    return chapters.length > 1 ? chapters : [{title:'Documento completo', text}];
  }

  async analyze(text, isSelection) {
    console.log('[A1] analyze: start, textLen=', text.length, 'isSelection=', isSelection);
    this._mockCallIndex = 0; // reset contador de mock al inicio de cada análisis

    // ── Pre-carga de respuestas mock ─────────────────────────────────────────
    // Si PLUMIA_MOCK está activo, intentar cargar mock_responses.json del servidor.
    // Si el fichero no existe, usar lo que haya en localStorage como fallback.
    if (window.PLUMIA_MOCK) {
      try {
        const r = await fetch('./mock_responses.json?_=' + Date.now());
        if (r.ok) {
          const data = await r.json();
          localStorage.setItem('PLUMIA_MOCK_RESPONSES', JSON.stringify(data));
          // Mostrar tests disponibles y cuál se usará
          if (Array.isArray(data)) {
            console.log(`[PLUMIA MOCK] mock_responses.json cargado — formato legacy (${data.length} respuestas)`);
          } else {
            const tests = Object.keys(data);
            const nonDevKeys = tests.filter(k => k !== 'test1');
            const active = typeof window.PLUMIA_MOCK === 'string' ? window.PLUMIA_MOCK
              : (nonDevKeys.length ? nonDevKeys[nonDevKeys.length - 1] : tests[tests.length - 1]);
            const n = data[active]?.responses?.length ?? 0;
            console.log(`[PLUMIA MOCK] mock_responses.json cargado — tests disponibles: [${tests.join(', ')}]`);
            console.log(`[PLUMIA MOCK] usando test "${active}" (${n} respuestas)`);
          }
        }
      } catch(e) {
        console.log('[PLUMIA MOCK] mock_responses.json no disponible, usando localStorage');
      }
    }
    console.log('[A2] selectedIds=', [...this.selectedIds].join(','));
    const selectedIds = this.selectedIds;

    // ── REANUDACIÓN tras error de rate-limit ─────────────────────────────────
    const saved = this._isResuming ? this._loadProgress() : null;
    const resumeFromIndex = (saved && Array.isArray(saved.results)) ? saved.completedIndex : -1;
    const allResults = (saved && Array.isArray(saved.results)) ? [...saved.results] : [];
    const cappedGroups = new Set();
    if (saved && saved.selectedIds && this.selectedIds.size === 0) {
      this.selectedIds = new Set(saved.selectedIds);
    }
    this._isResuming = false;
    if (resumeFromIndex >= 0) {
      console.log('[RESUME] reanudando desde índice', resumeFromIndex, '— grupos ya completados:', allResults.length);
    }

    // ── Preservar texto de selección original ────────────────────────────────
    // Si el usuario seleccionó un fragmento, las correcciones normales deben
    // ejecutarse SOLO sobre ese fragmento. La coherencia narrativa necesita el
    // documento completo, pero no debe contaminar el texto para el resto.
    const selectionText      = text;
    const selectionIsPartial = isSelection;
    let coherenceText        = text; // por defecto = lo mismo

    // ── GARANTÍA requiresFullDoc ──────────────────────────────────────────────
    const hasFullDocRequired = selectedIds.some(id => {
      const c = CORRECTIONS.find(x => x.id === id);
      return c && c.requiresFullDoc;
    });
    console.log('[A3] hasFullDocRequired=', hasFullDocRequired);

    if (hasFullDocRequired && isSelection) {
      // No intentamos cargar el documento completo: body.load('text') sobre documentos
      // de 150+ hojas mata el WebView sin lanzar excepción JS capturable.
      // La coherencia se analiza sobre el fragmento seleccionado.
      coherenceText = text;
      console.log('[PLUMIA] coherencia: usando fragmento seleccionado (doc grande, no se carga doc completo)');
    }

    // ── PASO 1: Ortotipografía local (sin API, coste cero) ──────────────────
    if (selectedIds.includes('ortotipografia_pura')) {
      this.onProgress(2, 'Verificando ortotipografía (local, sin coste)…');
      const localFindings = runLocalOrtotypography(selectionText);
      allResults.push({
        correctionId: 'ortotipografia_pura',
        label: 'Ortotipografía pura',
        groupId: 'orthotypo',
        colorId: null,
        findings: localFindings,
      });
      this.onChunkComplete(allResults);
    }

    // ── PASO 1b: Números en letra (local, sin API, coste cero) ─────────────
    if (selectedIds.includes('numeros_letras')) {
      this.onProgress(3, 'Verificando números en letra (local, sin coste)…');
      const numFindings = window.PLUMIA.runLocalNumerosLetras(selectionText);
      allResults.push({
        correctionId: 'numeros_letras',
        label: 'Números en letra',
        groupId: 'style',
        colorId: 3,
        findings: numFindings,
      });
      this.onChunkComplete(allResults);
    }

    // ── PASO 1c: Aún/aun con tilde (local, sin API, coste cero) ──────────────
    if (selectedIds.includes('aun_tilde')) {
      this.onProgress(4, 'Verificando «aún/aun» con tilde (local, sin coste)…');
      const aunFindings = window.PLUMIA.runLocalAunTilde(selectionText);
      allResults.push({
        correctionId: 'aun_tilde',
        label: 'Uso de «aún» con tilde diacrítica',
        groupId: 'grammar',
        colorId: 7,
        findings: aunFindings,
      });
      this.onChunkComplete(allResults);
    }

    // ── PASO 2: Coherencia narrativa (llamada única agrupada, doc completo) ──
    const coherenceIds = selectedIds.filter(id => {
      const c = CORRECTIONS.find(x => x.id === id);
      return c && c.requiresFullDoc;
    });

    if (coherenceIds.length > 0 && !this.aborted && resumeFromIndex < coherenceIds.length - 1) {
      const activeCoherenceCorrs = coherenceIds.map(id => CORRECTIONS.find(c => c.id === id)).filter(Boolean);
      this.onProgress(5, 'Analizando coherencia narrativa…');
      const accumulated = {};
      activeCoherenceCorrs.forEach(c => { accumulated[c.id] = []; });
      try {
        const chunks = this._countWords(coherenceText) > CONFIG.coherenceChunkSizeWords
          ? this._splitByChapters(coherenceText)
          : [{ title: 'Documento', text: coherenceText }];
        for (const ch of chunks) {
          if (this.aborted) break;
          const prompt = this._buildCoherenceGroupedPrompt(activeCoherenceCorrs, ch.text);
          const response = await this._callAPI(prompt);
          for (const corr of activeCoherenceCorrs) {
            const section = response[corr.id];
            if (!section || !Array.isArray(section.findings)) continue;
            section.findings.forEach(f => {
              const originalText = this._extractOriginalText(f);
              if (!originalText) return;
              accumulated[corr.id].push({ ...f, originalText, correctionId: corr.id,
                colorId: corr.colorId, label: corr.label, directFix: corr.directFix });
            });
          }
        }
        for (const corr of activeCoherenceCorrs) {
          allResults.push({ correctionId: corr.id, label: corr.label, groupId: corr.groupId,
            colorId: corr.colorId, findings: accumulated[corr.id] });
        }
        this._saveProgress({ text: coherenceText.substring(0, 100), completedIndex: coherenceIds.length - 1, results: allResults });
        this.onChunkComplete(allResults);
      } catch(err) {
        this._saveProgress({ text: coherenceText.substring(0, 100), completedIndex: -1, results: allResults });
        this.errored = true;
        this.onError(err, false, 'Coherencia narrativa');
        return { results: allResults, cappedGroups: [...cappedGroups] };
      }
    }

    // ── PASO 3: Correcciones agrupadas (menos llamadas a la API) ────────────
    const nonCoherenceIds = selectedIds.filter(id => !LOCAL_ONLY_IDS.includes(id) && !coherenceIds.includes(id));
    const apiGroups = API_CORRECTION_GROUPS.filter(g =>
      g.ids.some(id => nonCoherenceIds.includes(id))
    );
    console.log('[A4] grupos API=', apiGroups.length, 'nonCoherenceIds=', nonCoherenceIds.join(','));

    const groupTotal = apiGroups.length;
    for (let gi = 0; gi < apiGroups.length; gi++) {
      if (this.aborted) break;
      if (gi + coherenceIds.length <= resumeFromIndex) {
        console.log('[RESUME] saltando grupo ya completado:', apiGroups[gi].label);
        continue;
      }
      const group = apiGroups[gi];
      const activeIds = group.ids.filter(id => nonCoherenceIds.includes(id));
      const pct = Math.round(35 + (gi / Math.max(groupTotal, 1)) * 60);
      this.onProgress(pct, `Analizando: ${group.label}…`);

      // accumulated se declara FUERA del try para que el catch pueda salvar
      // los resultados parciales si un chunk posterior falla (ej: HTTP 529)
      const accumulated = {};
      activeIds.forEach(id => { accumulated[id] = []; });

      try {
        const chunks = this._splitIntoChunks(selectionText, CONFIG.chunkSizeWords, CONFIG.chunkOverlapWords);

        for (const ch of chunks) {
          if (this.aborted) break;
          let response;
          console.log('[A5] llamando API, grupo=', group.label, 'chunkLen=', ch.length);
          const chunkWords = ch.split(/\s+/).filter(Boolean).length;
          const maxFindings = Math.max(8, Math.round(chunkWords / 120));

          if (group.ids.length === 1) {
            const corr = CORRECTIONS.find(c => c.id === group.ids[0]);
            response = await this._callAPI(corr.prompt.replace('{TEXT}', ch).replace('{MAX_FINDINGS}', String(maxFindings)));
            console.log('[A6] API respondió, grupo=', group.label);
            if ((response.total_found || 0) > maxFindings && (response.findings || []).length >= maxFindings) {
              cappedGroups.add(corr.label);
            }
            const chLower = ch.toLowerCase();
            const findings = (response.findings || []).map(f => {
              const originalText = this._extractOriginalText(f);
              if (!originalText) return null;
              // Filtrar hallucinations: el texto debe existir en el chunk analizado
              // En modo mock no se filtra: los findings son de confianza (capturados del texto real)
              if (!window.PLUMIA_MOCK) {
                const check = originalText.toLowerCase().substring(0, Math.min(originalText.length, 40));
                if (check.length > 5 && !chLower.includes(check)) return null;
              }
              // Filtrar correcciones nulas: wordForm === correctForm (alucinación sin error real).
              // IMPORTANTE: comparar SIN eliminar diacríticos — "como"→"cómo" es corrección válida;
              // solo se filtra cuando son literalmente idénticos (ej: "Cuando"→"Cuando").
              if (f.wordForm && f.correctForm) {
                if (f.wordForm.toLowerCase().trim() === f.correctForm.toLowerCase().trim()) return null;
              }
              // Filtrar findings que el modelo marcó explícitamente como descartes
              const expl = (f.explanation || f.correction || '').toLowerCase();
              if (expl.includes('descar') || expl.includes('no incluir') || expl.includes('no es error') ||
                  expl.includes('no se señala') || expl.includes('no aplica') || expl.includes('dentro del límite') ||
                  expl.includes('no procede') || expl.includes('no es un error')) return null;
              return { ...f, originalText, correctionId: corr.id, colorId: corr.colorId,
                label: corr.label, directFix: corr.directFix };
            }).filter(Boolean);
            accumulated[corr.id].push(...findings);
            // Opción C: fusionar detecciones locales con la respuesta API (sin coste extra)
            if (corr.id === 'si_tilde') {
              const localF = window.PLUMIA.runLocalSiTilde(ch);
              accumulated['si_tilde'].push(...localF);
            }
            if (corr.id === 'mi_tilde') {
              const localF = window.PLUMIA.runLocalMiTilde(ch);
              accumulated['mi_tilde'].push(...localF);
            }
            if (corr.id === 'interrogativas_tilde') {
              const localF = window.PLUMIA.runLocalInterrogativasTilde(ch);
              accumulated['interrogativas_tilde'].push(...localF);
            }
            if (corr.id === 'tu_tilde') {
              const localF = window.PLUMIA.runLocalTuTilde(ch);
              accumulated['tu_tilde'].push(...localF);
            }
          } else {
            // Prompt agrupado
            response = await this._callAPI(group.buildPrompt(ch).replace('{MAX_FINDINGS}', String(maxFindings)));
            this._parseGroupedResponse(response, group, activeIds, accumulated, ch);
            // Detectar cap en grupos agrupados (la respuesta tiene claves por correction id)
            for (const id of activeIds) {
              const section = response[id] || response;
              if ((section.total_found || 0) > maxFindings && (section.findings || []).length >= maxFindings) {
                const corr = CORRECTIONS.find(c => c.id === id);
                if (corr) cappedGroups.add(corr.label);
              }
            }
          }
        }

        // Añadir resultados a allResults, enriquecer con sinónimos locales
        for (const id of activeIds) {
          const corr = CORRECTIONS.find(c => c.id === id);
          let findings = this._dedupe(accumulated[id] || []);

          // Filtro post-proceso: descartar falsos positivos
          if (id === 'voz_pasiva')         findings = this._filterVozPasiva(findings);
          if (id === 'dequeismo')          findings = this._filterDequeismo(findings);
          if (id === 'verbos_comedin')     findings = this._filterVerbosComedin(findings);
          if (id === 'interrogativas_tilde') findings = this._filterInterrogativasTilde(findings);

          // Enriquecer con sinónimos del diccionario local
          if (['verbos_comedin','sustantivos_genericos','adverbios_mente','muletillas'].includes(id)) {
            findings = enrichWithLocalSynonyms(findings, id);
          }

          allResults.push({
            correctionId: id, label: corr.label,
            groupId: corr.groupId, colorId: corr.colorId,
            findings,
          });
        }

        this._saveProgress({ text: selectionText.substring(0, 100), completedIndex: gi + coherenceIds.length, results: allResults });
        this.onChunkComplete(allResults);

      } catch(err) {
        // Guardar resultados parciales del/los chunks que ya completaron antes del fallo
        for (const id of activeIds) {
          const corr = CORRECTIONS.find(c => c.id === id);
          if (!corr) continue;
          let partialFindings = this._dedupe(accumulated[id] || []);
          if (id === 'voz_pasiva')          partialFindings = this._filterVozPasiva(partialFindings);
          if (id === 'dequeismo')           partialFindings = this._filterDequeismo(partialFindings);
          if (id === 'verbos_comedin')      partialFindings = this._filterVerbosComedin(partialFindings);
          if (id === 'interrogativas_tilde') partialFindings = this._filterInterrogativasTilde(partialFindings);
          if (partialFindings.length > 0 && !allResults.find(r => r.correctionId === id)) {
            if (['verbos_comedin','sustantivos_genericos','adverbios_mente','muletillas'].includes(id)) {
              partialFindings = enrichWithLocalSynonyms(partialFindings, id);
            }
            allResults.push({
              correctionId: id, label: corr.label,
              groupId: corr.groupId, colorId: corr.colorId,
              findings: partialFindings,
            });
            console.warn('[PLUMIA] grupo parcial salvado:', id, '→', partialFindings.length, 'findings');
          }
        }
        this._saveProgress({ text: selectionText.substring(0, 100), completedIndex: gi - 1 + coherenceIds.length, results: allResults });
        // Errores fatales (autenticación, rate limit) → parar todo
        if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('RATE_LIMIT') || err.message?.includes('INSUFFICIENT_CREDITS')) {
          this.errored = true;
          this.onError(err, gi > 0 || coherenceIds.length > 0, group.label);
          return { results: allResults, cappedGroups: [...cappedGroups] };
        }
        // Otros errores (JSON inválido, timeout, etc.) → avisar y continuar con el siguiente grupo
        console.warn('Plumia: grupo fallido, continuando:', group.label, err.message);
        this.onProgress(
          Math.round(35 + (gi / Math.max(groupTotal, 1)) * 60),
          `⚠ ${group.label}: respuesta inválida, se omite. Continuando…`
        );
      }
    }

    this._clearProgress();
    this.onProgress(100, 'Análisis completado.');

    // Validación local de proximidad para repeticion_lexica:
    // descarta findings donde las dos ocurrencias estén a >40 palabras en el texto real
    const cleanedResults = allResults.map(r => {
      let findings = r.findings;

      // Filtro REGLA ABSOLUTA: descarta findings cuya explanation indica que no hay error real
      const NO_ERROR_RE = /\bse omite\b|\bno (hay|presenta|existe|contiene) error\b|\bno es un error\b|\bsin error real\b|\bel fragmento (está bien|es correcto)\b|\bno (hay|presenta) error real\b|\b(sin error|anulado|descartado|ninguno)\b|\buso aceptable\b|\bes aceptable\b|\bpuede aceptarse\b|\bse puede dejar\b|\bobservaci[oó]n menor\b|\bno es (el )?error m[aá]s grave\b|\bno constituye (un )?error\b|\bse mantiene como\b|\bse descarta\b|\bno es (un )?pleonasmo\b|\bno es propiamente\b|\bno aplica\b|\bfuera de categor[ií]a\b/i;
      const before0 = findings.length;
      findings = findings.filter(f => !NO_ERROR_RE.test(f.explanation || ''));
      if (findings.length < before0) console.log(`[ABSOLUTA] ${r.correctionId}: ${before0 - findings.length} finding(s) descartados por explanation inválida`);

      // Filtro corrección idéntica: si correction == originalText (ignorando «» y espacios),
      // el finding no propone ningún cambio real y se descarta
      const norm = s => (s || '').replace(/[«»]/g, '').trim();
      const before00 = findings.length;
      findings = findings.filter(f => norm(f.correction) !== norm(f.originalText));
      if (findings.length < before00) console.log(`[NOCAMBIO] ${r.correctionId}: ${before00 - findings.length} finding(s) descartados por corrección idéntica al original`);

      // Filtro corrección vacía: si el campo correction existe pero está vacío tras normalizar,
      // el modelo reconoció implícitamente que no hay corrección real → descartar
      const NEEDS_CORRECTION = new Set(['pleonasmos','palabras_sobrantes','concordancia','gerundios','dequeismo','voz_pasiva','puntuacion_prosa','puntuacion_dialogo','ortotipografia_pura']);
      if (NEEDS_CORRECTION.has(r.correctionId)) {
        const before000 = findings.length;
        findings = findings.filter(f => norm(f.correction || '').length > 0);
        if (findings.length < before000) console.log(`[VACÍO] ${r.correctionId}: ${before000 - findings.length} finding(s) descartados por corrección vacía`);
      }

      if (r.correctionId === 'repeticion_lexica') {
        const before = findings.length;
        findings = findings.filter(f => this._repeticionIsCloseOccurrences(f, f._chunkText || selectionText, 40));
        if (findings.length < before) console.log(`[REPLEX] ${before - findings.length} finding(s) descartados por distancia real >40 palabras`);
      }

      if (r.correctionId === 'puntuacion_prosa') {
        const before = findings.length;
        findings = findings.filter(f => !this._isInDialogueLine(f.originalText, selectionText));
        if (findings.length < before) console.log(`[PROSA] ${before - findings.length} finding(s) descartados por estar en línea de diálogo`);
      }

      // Deduplicación por solapamiento de chunks: si dos findings del mismo correctionId
      // comparten los primeros 40 chars de originalText, se considera duplicado y se queda
      // solo el que tiene el originalText más largo (más contexto).
      // Pass 1: deduplicar por prefijo de originalText
      const seen = new Map();
      const deduped = [];
      for (const f of findings) {
        const key = (f.originalText || '').substring(0, 40).toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, deduped.length);
          deduped.push(f);
        } else {
          const idx = seen.get(key);
          if ((f.originalText || '').length > (deduped[idx].originalText || '').length) {
            deduped[idx] = f;
          }
        }
      }
      // Pass 2: deduplicar por prefijo de correction (mismo error, distinto originalText por chunk overlap)
      const seen2 = new Map();
      const deduped2 = [];
      for (const f of deduped) {
        const key2 = (f.correction || f.correctedForm || '').substring(0, 40).toLowerCase();
        if (!key2 || !seen2.has(key2)) {
          if (key2) seen2.set(key2, true);
          deduped2.push(f);
        }
      }
      if (deduped2.length < findings.length) console.log(`[DEDUP] ${r.correctionId}: ${findings.length - deduped2.length} duplicado(s) eliminados`);

      return { ...r, findings: deduped2 };
    });

    return { results: cleanedResults, cappedGroups: [...cappedGroups] };
  }

  // Devuelve true si originalText aparece dentro de una línea de diálogo (que empieza con —)
  _isInDialogueLine(originalText, text) {
    if (!originalText || !text) return false;
    const snippet = originalText.substring(0, 50).trim();
    if (snippet.length < 5) return false;
    let searchFrom = 0;
    while (true) {
      const idx = text.indexOf(snippet, searchFrom);
      if (idx < 0) break;
      const lineStart = Math.max(text.lastIndexOf('\n', idx - 1), text.lastIndexOf('\r', idx - 1)) + 1;
      const linePrefix = text.substring(lineStart, idx);
      if (/^\s*(?:◆[¹²³]?\s*)*—/.test(linePrefix)) return true;
      searchFrom = idx + 1;
    }
    return false;
  }

  _repeticionIsClose(word, text, maxDistance) {
    if (!word || !text) return true;
    const wordLower = word.toLowerCase().trim();
    const tokens = text.toLowerCase().split(/\s+/);
    const positions = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].replace(/^[^a-záéíóúüñ]+|[^a-záéíóúüñ]+$/gi, '');
      if (t === wordLower) positions.push(i);
    }
    if (positions.length < 2) return false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] - positions[i - 1] <= maxDistance) return true;
    }
    return false;
  }

  // Valida la distancia entre las dos ocurrencias ESPECÍFICAS que citó el modelo
  // (f.occurrences[0] y f.occurrences[1]), no cualquier par del texto.
  // Fallback a _repeticionIsClose si los fragmentos no se localizan.
  _repeticionIsCloseOccurrences(f, text, maxDistance) {
    const word = (f.word || '').toLowerCase().trim();
    if (!word || !text) return true;
    const occs = Array.isArray(f.occurrences) ? f.occurrences : [];
    if (occs.length >= 2) {
      const textLower = text.toLowerCase();
      let searchFrom = 0;
      const tokenPositions = [];
      for (let k = 0; k < 2; k++) {
        const occLower = (occs[k] || '').toLowerCase().trim().substring(0, 50);
        if (occLower.length < 5) continue;
        const occIdx = textLower.indexOf(occLower, searchFrom);
        if (occIdx < 0) continue;
        const wordInOcc = occLower.indexOf(word);
        if (wordInOcc < 0) continue;
        const charPos = occIdx + wordInOcc;
        tokenPositions.push(text.substring(0, charPos).split(/\s+/).length);
        searchFrom = occIdx + 1;
      }
      if (tokenPositions.length === 2) {
        const dist = tokenPositions[1] - tokenPositions[0];
        console.log(`[REPLEX] '${word}' distancia específica=${dist} palabras`);
        return dist <= maxDistance;
      }
    }
    return this._repeticionIsClose(word, text, maxDistance);
  }

  // Extrae originalText de cualquier estructura de finding (normalización temprana)
  _extractOriginalText(f) {
    let text = f.originalText || '';
    if (!text) {
      // nombres_propios: usar occ[0] como texto ancla (es la ocurrencia más representativa
      // del cluster detectado por el modelo). Solo buscar otra si el nombre aparece más
      // allá del char 55 en occ[0] (quedaría cortado por el truncado a 75 chars).
      if (f.name && Array.isArray(f.occurrences) && f.occurrences.length > 0) {
        const nameLower = f.name.toLowerCase();
        let chosen = f.occurrences[0];
        const pos0 = chosen.toLowerCase().indexOf(nameLower);
        if (pos0 === -1 || pos0 > 55) {
          // occ[0] no sirve: buscar la primera ocurrencia donde el nombre esté antes del char 55
          for (const occ of f.occurrences) {
            const p = occ.toLowerCase().indexOf(nameLower);
            if (p !== -1 && p <= 55) { chosen = occ; break; }
          }
        }
        text = chosen;
        console.log(`[NP] _extractOriginalText name="${f.name}" chosen="${text.substring(0,70)}" pos0=${pos0}`);
      } else if (f.occurrences?.[0]) text = f.occurrences[0];
      else if (f.occurrence1?.text)  text = f.occurrence1.text;
      else if (f.occurrence?.text)   text = f.occurrence.text;
      else if (f.frase)              text = f.frase;
    }
    // Limpiar saltos de línea
    text = text.replace(/[\r\n]+/g, ' ').trim();
    // Truncar a ~75 chars en frontera de palabra (Word no busca newlines)
    if (text.length > 75) {
      const cut = text.substring(0, 75);
      const lastSpace = cut.lastIndexOf(' ');
      text = lastSpace > 30 ? cut.substring(0, lastSpace).trimEnd() : cut;
    }
    return text;
  }

  _buildCoherenceGroupedPrompt(activeCorrs, text) {
    const sections = activeCorrs.map((corr, i) => {
      // Extrae solo las instrucciones, descarta la parte del JSON de respuesta
      const core = corr.prompt
        .replace(/\n\nTexto a analizar:\\n\{TEXT\}[\s\S]*$/, '')
        .replace(/\n\nTexto a analizar:\n\{TEXT\}[\s\S]*$/, '')
        .trim();
      return `=== ${i + 1}. CLAVE "${corr.id}" — ${corr.label} ===\n${core}`;
    }).join('\n\n');

    const jsonTemplate = '{' + activeCorrs.map(c =>
      `"${c.id}":{"findings":[]}`
    ).join(',') + '}';

    return `Eres un editor literario experto en español. Analiza el texto para los siguientes ${activeCorrs.length} aspectos narrativos y devuelve UN ÚNICO JSON con una clave por aspecto.\n\nREGLA ABSOLUTA: Si no encuentras ningún problema en una categoría, devuelve findings:[] para esa clave. Nunca omitas una clave del JSON.\n\n${sections}\n\nTexto a analizar:\n${text}\n\nResponde ÚNICAMENTE con este JSON (exactamente estas claves, sin texto adicional):\n${jsonTemplate}`;
  }

  _parseGroupedResponse(response, group, activeIds, accumulated, chunkText) {
    const keyMap = {
      'leismo':'leismo','ambiguedad':'ambiguedad_pronominal',
      'concordancia':'concordancia','dequeismo':'dequeismo',
      'repeticion':'repeticion_lexica','verbos':'verbos_comedin','sustantivos':'sustantivos_genericos',
      'muletillas':'muletillas','pleonasmos':'pleonasmos',
      'adverbios':'adverbios_mente','voz_pasiva':'voz_pasiva','frases_largas':'frases_largas','nombres':'nombres_propios',
      'gerundios':'gerundios','tiempos':'tiempos_verbales',
    };

    const chunkLower = chunkText ? chunkText.toLowerCase() : null;

    for (const [key, corrId] of Object.entries(keyMap)) {
      if (!activeIds.includes(corrId)) continue;
      const corr = CORRECTIONS.find(c => c.id === corrId);
      if (!corr) continue;
      const section = response[key];
      if (!section || !Array.isArray(section.findings)) continue;
      section.findings.forEach(f => {
        // frases_largas: descartar si el texto RAW cruza un punto de cierre + mayúscula
        // (el modelo construyó una "frase" que abarca varias oraciones distintas).
        // Hay que comprobarlo ANTES de truncar, porque el truncado a 75 chars elimina el punto.
        if (corrId === 'frases_largas') {
          const raw = (f.originalText || '').replace(/[\r\n]+/g, ' ').trim();
          if (/[.!?…]\s+[A-ZÁÉÍÓÚÜÑ]/.test(raw)) {
            console.log(`[FRASES] descartado por cruce de oración: "${raw.substring(0, 60)}…"`);
            return;
          }
          const wordCount = raw.split(/\s+/).filter(w => w.length > 0).length;
          if (wordCount < 40) {
            console.log(`[FRASES] descartado por menos de 40 palabras (${wordCount}): "${raw.substring(0, 60)}…"`);
            return;
          }
        }
        // Normalizar originalText AQUÍ, antes de deduplicar
        const originalText = this._extractOriginalText(f);
        if (!originalText) return; // descartar findings sin texto localizable
        // Filtrar hallucinations: el texto debe existir en el chunk analizado
        // En modo mock no se filtra: los findings son de confianza (capturados del texto real)
        if (chunkLower && !window.PLUMIA_MOCK) {
          const check = originalText.toLowerCase().substring(0, Math.min(originalText.length, 40));
          if (check.length > 5 && !chunkLower.includes(check)) return;
        }
        // adverbios_mente: descartar si ni el campo adverb ni originalText contienen
        // una palabra real terminada en -mente (evita que la raíz "absorbente" se marque).
        if (corrId === 'adverbios_mente') {
          const candidates = (f.adverbs||[]).concat([f.adverb, originalText]).filter(Boolean);
          const hasMente = candidates.some(a => /mente\b/i.test(a));
          if (!hasMente) return;
        }
        const expl = (f.explanation || f.correction || '').toLowerCase();
        if (expl.includes('descarte') || expl.includes('no incluir') || expl.includes('no es error') ||
            expl.includes('no se señala') || expl.includes('no aplica') || expl.includes('dentro del límite') ||
            expl.includes('no procede') || expl.includes('no es un error')) return;
        accumulated[corrId].push({
          ...f,
          originalText,
          correctionId: corrId,
          colorId:      corr.colorId,
          label:        corr.label,
          directFix:    corr.directFix,
          ...(corrId === 'repeticion_lexica' && chunkText ? { _chunkText: chunkText } : {}),
        });
      });
    }
  }

  abort() { this.aborted = true; }

  // Descarta findings de voz_pasiva que son construcciones copulativas, no pasivas reales.
  // Patrón falso positivo: ser/estar conjugado + artículo/determinante + sustantivo + adjetivo-participio.
  // La prueba estructural: si tras la forma de ser/estar viene inmediatamente un artículo o
  // determinante, ser es copulativo (no auxiliar de pasiva) y el finding debe descartarse.
  _filterVozPasiva(findings) {
    // Formas conjugadas de ser/estar que pueden actuar como copulativas
    const serFormas = 'fue|es|era|será|son|eran|fueron|fuera|sea|sean|fuesen|fueran|sido|estar[aá]|estuvo|estaba|estará|está|están|estaban|estuvieron';
    // Determinantes/artículos que siguen a ser copulativo
    const det = 'el|la|los|las|un|una|unos|unas|este|esta|estos|estas|ese|esa|esos|esas|aquel|aquella|aquellos|aquellas|mi|tu|su|sus|mis|tus|nuestro|nuestra|nuestros|nuestras|su|sus';
    const reCopulative = new RegExp(
      `\\b(?:${serFormas})\\s+(?:${det})\\b`,
      'i'
    );
    // Palabras en la explicación que indican que el modelo sabe que NO es pasiva real
    const reAutoDescarte = /no\s+(es|voz)\s+pasiva|participio\s+adjetival|copulat|no\s+hay\s+agente|sin\s+agente/i;

    return findings.filter(f => {
      const text = (f.originalText || '').trim();
      const expl = (f.explanation || '').trim();
      const active = (f.activeVersion || '').trim();

      // Descartar si activeVersion está vacío (el modelo no pudo dar versión activa → no es pasiva real)
      if (!active) {
        console.log(`[VOZ_PASIVA] Descartado por activeVersion vacío: "${text.substring(0, 80)}"`);
        return false;
      }

      // Descartar si la explicación reconoce que no es pasiva real
      if (reAutoDescarte.test(expl)) {
        console.log(`[VOZ_PASIVA] Descartado por auto-reconocimiento en explicación: "${text.substring(0, 80)}"`);
        return false;
      }

      // Descartar construcciones copulativas (ser/estar + artículo + sustantivo)
      if (reCopulative.test(text)) {
        console.log(`[VOZ_PASIVA] Descartado por copulativo: "${text.substring(0, 80)}"`);
        return false;
      }

      return true;
    });
  }

  // Descarta findings de dequeismo donde el modelo reconoce que la construcción es correcta
  // (correction = "Correcto" o similar) — violación de REGLA ABSOLUTA del prompt.
  // Descarta findings de verbos_comedin donde "decir" funciona como acotación de diálogo.
  // "dijo al entrar", "dijo en voz baja", etc. son tags narrativos estándar, no comodines.
  // Descarta falsos positivos de interrogativas_tilde donde el modelo propone añadir tilde
  // a "que" cuando en realidad es conjunción subordinante tras verbo de conocimiento/volición.
  // Prueba: "saber/pensar/creer/querer... que [cláusula declarativa]" → conjunción, sin tilde.
  _filterInterrogativasTilde(findings) {
    // Verbos de conocimiento, emoción y volición que rigen conjunción "que" (sin tilde)
    const verbosConocimiento = /\b(sab[eií]a[ns]?|sab[eé]n?|sup[oe]|supieron|supe|conoc[eií]a[ns]?|pens[aáe]ba[ns]?|piensan?|cre[eií]a[ns]?|creen?|dec[íi]a[ns]?|dijeron|dijo|dije|quer[íi]a[ns]?|quieren?|entend[íi]a[ns]?|entienden?|imaginab[a]n?|temía[ns]?|esperaba[ns]?|afirmab[a]n?)\s+que\b/i;
    return findings.filter(f => {
      // Solo nos interesa cuando el modelo propone añadir tilde a "que" → "qué"
      if ((f.wordForm || '').toLowerCase() === 'que' && (f.correctForm || '').toLowerCase() === 'qué') {
        const text = (f.originalText || '');
        if (verbosConocimiento.test(text)) {
          console.log(`[INTERROG_TILDE] Descartado "que" conjunción tras verbo conocimiento: "${text.substring(0,80)}"`);
          return false;
        }
      }
      return true;
    });
  }

  _filterVerbosComedin(findings) {
    const formasDecir = /\b(dij[oe]|dijeron|dije|dec[ií]a|dec[ií]an|dice|dicen|dir[aá]|dir[aá]n)\b/i;
    // Locuciones fijas con "hacer" que no son comodines
    const locucionesFijas = /\bhac[eéií](r|ndo)?\s+(ruido|caso|falta|gracia|daño|bien|mal|fr[íi]o|calor|efecto|tiempo|sitio|las\s+paces|la\s+vista\s+gorda)\b/i;
    return findings.filter(f => {
      const verb = (f.verb || '').toLowerCase().trim();
      const text  = (f.originalText || '');
      const expl  = (f.explanation || '');

      // Descartar "decir" como tag de diálogo
      if (verb === 'decir' || formasDecir.test(verb)) {
        if (/—|«|»|"/.test(text) || formasDecir.test(text)) {
          console.log(`[VERBOS_COMEDIN] Descartado "decir" en diálogo: "${text.substring(0,80)}"`);
          return false;
        }
      }

      // Descartar locuciones fijas con "hacer"
      if (locucionesFijas.test(text)) {
        console.log(`[VERBOS_COMEDIN] Descartado locución fija "hacer": "${text.substring(0,80)}"`);
        return false;
      }

      // Descartar alucinaciones: la explicación menciona una frase que no aparece en el originalText
      // (el modelo comenta algo que no está en el texto analizado)
      const phraseInExpl = expl.match(/'([^']{6,40})'/);
      if (phraseInExpl) {
        const cited = phraseInExpl[1].toLowerCase().trim();
        if (!text.toLowerCase().includes(cited)) {
          console.log(`[VERBOS_COMEDIN] Posible alucinación — explicación cita "${cited}" pero no está en el texto: "${text.substring(0,80)}"`);
          return false;
        }
      }

      return true;
    });
  }

  _filterDequeismo(findings) {
    return findings.filter(f => {
      const corr = (f.correction || '').trim().toLowerCase();
      // Descartar si el modelo mismo dice que es correcto
      if (corr === 'correcto' || corr.startsWith('correcto')) {
        console.log(`[DEQUEISMO] Descartado auto-correcto: "${(f.originalText||'').substring(0,80)}"`);
        return false;
      }
      // Queísmo falso: el patrón queísta requiere que el verbo vaya seguido de "que"
      // SIN la preposición. Si el verbo termina la frase (punto, coma...) sin ningún
      // "que" a continuación, no hay subordinada y no puede haber queísmo.
      if (f.errorType === 'queismo') {
        const text = (f.originalText || '').toLowerCase();
        // Extraer la palabra-ancla de la corrección: "[ancla] de que" → ancla
        const m = (f.correction || '').toLowerCase().match(/\b(\w{4,})\s+de\s+que\b/);
        if (m) {
          const anchor = m[1]; // ej. "cuenta", "seguro", "enterado"
          if (!text.includes(anchor + ' que')) {
            console.log(`[DEQUEISMO] Queísmo falso ("${anchor} que" no aparece): "${text.substring(0,80)}"`);
            return false;
          }
        }
      }
      return true;
    });
  }

  _dedupe(findings) {
    const seen = new Set();
    return findings.filter(f => {
      // nombres_propios: deduplicar por nombre — chunks solapados pueden producir el mismo
      // nombre con distinto originalText (variaciones de puntuación en la cita)
      const k = f.name ? ('name:' + f.name.toLowerCase().trim()) : (f.originalText||'').trim().toLowerCase();
      if (seen.has(k)) return false; seen.add(k); return true;
    });
  }

  // Normaliza todos los findings para que tengan originalText consistente
  normalizeFindings(allResults) {
    return allResults.map(result => ({
      ...result,
      findings: result.findings.map(f => {
        let text = f.originalText || '';

        // Tipos con estructura distinta
        if (!text) {
          if (f.occurrences && f.occurrences.length > 0) {
            // repeticion_lexica, muletillas: primer fragmento
            // nombres_propios: usar occ[0] (más representativo del cluster); fallback si nombre > char 55
            if (f.name) {
              const nameLower = f.name.toLowerCase();
              let chosen = f.occurrences[0];
              const pos0 = chosen.toLowerCase().indexOf(nameLower);
              if (pos0 === -1 || pos0 > 55) {
                for (const occ of f.occurrences) {
                  const p = occ.toLowerCase().indexOf(nameLower);
                  if (p !== -1 && p <= 55) { chosen = occ; break; }
                }
              }
              text = chosen;
            } else {
              text = f.occurrences[0];
            }
          } else if (f.occurrence1 && f.occurrence1.text) {
            // coherencia: occurrence1.text
            text = f.occurrence1.text;
          } else if (f.occurrence && f.occurrence.text) {
            // tono_voz, pov: occurrence.text
            text = f.occurrence.text;
          } else if (f.frase) {
            text = f.frase;
          }
        }

        // Limpiar: quitar saltos de línea y truncar a 80 chars (Word no busca newlines)
        text = (text || '').replace(/[\r\n]+/g, ' ').trim();
        if (text.length > 80) text = text.substring(0, 80);

        return { ...f, originalText: text };
      })
    }));
  }

  // Devuelve la palabra-ancla específica de un finding (la palabra concreta marcada).
  // Si dos findings comparten originalText pero tienen anclas distintas, son errores
  // independientes y deben recibir cada uno su propio marcador ◆.
  _findingAnchor(f) {
    return (
      f.word || f.verb ||
      (Array.isArray(f.adverbs) ? f.adverbs[0] : f.adverb) ||
      f.expression || f.genericWord || f.name ||
      f.wordForm || f.miForm || f.siForm || f.tuForm || f.aunForm ||
      ''
    ).toLowerCase().trim();
  }

  resolveOverlaps(allResults) {
    // Normalizar primero para garantizar originalText en todos los findings
    const normalized = this.normalizeFindings(allResults);

    const flat = [];
    for (const r of normalized) for (const f of r.findings) flat.push({...f, colorId:r.colorId, label:r.label});
    const grouped = {};
    for (const f of flat) {
      const k = (f.originalText||'').trim(); if (!k) continue;
      if (!grouped[k]) grouped[k] = []; grouped[k].push(f);
    }
    const resolved = [];
    for (const [, findings] of Object.entries(grouped)) {
      if (findings.length === 1) { resolved.push({...findings[0], mergedFindings:[findings[0]]}); continue; }
      const brackets = findings.filter(f => COLOR_MAP[f.colorId]?.type === 'bracket');
      const colors   = findings.filter(f => COLOR_MAP[f.colorId]?.type !== 'bracket');
      if (brackets.length && !colors.length) {
        const outer = brackets.reduce((a,b) => a.colorId<=b.colorId?a:b);
        resolved.push({...outer, mergedFindings:brackets});
      } else if (brackets.length && colors.length) {
        brackets.forEach(b => resolved.push({...b, mergedFindings:[b]}));
        // Los color-findings se agrupan por ancla (palabra concreta marcada).
        // Si tienen anclas distintas → marcadores independientes.
        const colorsByAnchor = {};
        for (const c of colors) {
          const ak = this._findingAnchor(c) || '__none__';
          if (!colorsByAnchor[ak]) colorsByAnchor[ak] = [];
          colorsByAnchor[ak].push(c);
        }
        for (const group of Object.values(colorsByAnchor)) {
          const primary = group.find(f => f.correctionId === 'nombres_propios') || group[group.length-1];
          resolved.push({...primary, mergedFindings:group});
        }
      } else {
        // Solo color-findings: agrupar por ancla
        const colorsByAnchor = {};
        for (const c of colors) {
          const ak = this._findingAnchor(c) || '__none__';
          if (!colorsByAnchor[ak]) colorsByAnchor[ak] = [];
          colorsByAnchor[ak].push(c);
        }
        for (const group of Object.values(colorsByAnchor)) {
          const primary = group.find(f => f.correctionId === 'nombres_propios') || group[group.length-1];
          resolved.push({...primary, mergedFindings:group});
        }
      }
    }
    return resolved;
  }

  _countWords(t) { return (t||'').trim().split(/\s+/).filter(Boolean).length; }
  _saveProgress(d) { try { localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify({ ...d, selectedIds: [...this.selectedIds] })); } catch{} }
  _loadProgress() { try { const r=localStorage.getItem(STORAGE_KEY_PROGRESS); return r?JSON.parse(r):null; } catch{return null;} }
  _clearProgress() { try { localStorage.removeItem(STORAGE_KEY_PROGRESS); } catch{} }
  getSavedProgress() { return this._loadProgress(); }
  discardSavedProgress() { this._clearProgress(); }
}

// ── Utilidad de exportación de mock (llamar desde consola) ──────────────────
// Uso: PLUMIA.exportMock()              → descarga mock_responses.json completo
//      PLUMIA.exportMock('test1')       → descarga solo el test indicado
//      PLUMIA.exportMock('test1','mi fichero.json') → nombre de fichero personalizado
window.PLUMIA.exportMock = function(testKey, filename) {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem('PLUMIA_MOCK_RESPONSES') || 'null'); } catch(e) {}
  if (!raw) { console.warn('[PLUMIA] No hay datos en PLUMIA_MOCK_RESPONSES'); return; }

  let dataToExport = raw;
  if (testKey) {
    if (!raw[testKey]) { console.warn(`[PLUMIA] No existe el test "${testKey}"`); return; }
    dataToExport = { [testKey]: raw[testKey] };
  }

  const json     = JSON.stringify(dataToExport, null, 2);
  const blob     = new Blob([json], { type: 'application/json' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = filename || 'mock_responses.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const tests   = Array.isArray(dataToExport) ? ['(legacy)'] : Object.keys(dataToExport);
  const total   = Array.isArray(dataToExport)
    ? dataToExport.length
    : tests.reduce((s, k) => s + (dataToExport[k]?.responses?.length || 0), 0);
  console.log(`[PLUMIA] Descargando "${a.download}" — tests: [${tests.join(', ')}], ${total} respuestas, ${(json.length/1024).toFixed(1)} KB`);
};

// Uso: PLUMIA.clearCapture('PT cap4-5-6-7')  → borra solo ese test de localStorage
//      PLUMIA.clearCapture()                  → borra todos los datos de captura
window.PLUMIA.clearCapture = function(testKey) {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem('PLUMIA_MOCK_RESPONSES') || 'null'); } catch(e) {}
  if (!raw) { console.log('[PLUMIA] No hay datos de captura en localStorage'); return; }
  if (testKey) {
    if (!raw[testKey]) { console.warn(`[PLUMIA] No existe el test "${testKey}"`); return; }
    delete raw[testKey];
    localStorage.setItem('PLUMIA_MOCK_RESPONSES', JSON.stringify(raw));
    console.log(`[PLUMIA] Captura "${testKey}" eliminada de localStorage`);
  } else {
    localStorage.removeItem('PLUMIA_MOCK_RESPONSES');
    console.log('[PLUMIA] Todos los datos de captura eliminados de localStorage');
  }
};

})();
