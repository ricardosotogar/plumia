// ============================================================================
// PLUMIA — processor.js
// PlumiaProcessor: extracción de texto, chunking, llamadas API, análisis
// Depende de: corrections-config.js, synonyms-db.js
// ============================================================================
(function() {
// Aliases locales de los globals
var CORRECTIONS          = window.PLUMIA_CORRECTIONS;
var CONFIG               = window.PLUMIA_CONFIG;
var API_CORRECTION_GROUPS = window.PLUMIA_API_GROUPS;
var LOCAL_ONLY_IDS       = window.PLUMIA_LOCAL_IDS;
var enrichWithLocalSynonyms  = window.enrichWithLocalSynonyms;
var runLocalOrtotypography   = window.runLocalOrtotypography;

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const STORAGE_KEY_PROGRESS = 'plumia_analysis_progress';

window.PlumiaProcessor = class PlumiaProcessor {
  constructor(apiKey, selectedIds, outputMode, onProgress, onChunkComplete, onError) {
    this.apiKey = apiKey; this.selectedIds = selectedIds;
    this.outputMode = outputMode; this.onProgress = onProgress;
    this.onChunkComplete = onChunkComplete; this.onError = onError;
    this.aborted = false;
  }

  async extractTextFromDocument() {
    return new Promise((resolve, reject) => {
      Word.run(async (ctx) => {
        try {
          const sel = ctx.document.getSelection();
          sel.load('text'); await ctx.sync();
          const selectedText = sel.text.trim();
          if (selectedText && selectedText.length > 10 && !state.forceFullDoc) {
            resolve({ text: selectedText, isSelection: true, wordCount: this._countWords(selectedText) });
            return;
          }
          const body = ctx.document.body;
          body.load('paragraphs'); await ctx.sync();
          const items = body.paragraphs.items;
          items.forEach(p => p.load('text, style'));
          await ctx.sync();
          const extracted = []; let insideTOC = false;
          for (const para of items) {
            const style = (para.style || '').toLowerCase();
            const text  = (para.text  || '').trim();
            if (!text) continue;
            if (style.includes('toc') || style.includes('tabla de contenido') || style.includes('índice')) insideTOC = true;
            if (insideTOC && (style.includes('heading') || style.includes('normal') || style.includes('cuerpo'))) insideTOC = false;
            const excluded = insideTOC || style.includes('toc') || style.includes('header') ||
              style.includes('footer') || style.includes('encabezado') || style.includes('pie de p') ||
              style.includes('footnote') || style.includes('endnote') || style.includes('comment');
            if (!excluded) extracted.push(text);
          }
          const fullText = extracted.join('\n\n');
          resolve({ text: fullText, isSelection: false, wordCount: this._countWords(fullText) });
        } catch(e) { reject(new Error('Error al leer el documento: ' + e.message)); }
      });
    });
  }

  async _callAPI(prompt) {
    // Guardia: si el prompt es demasiado largo, truncarlo (~120k palabras = ~160k tokens input)
    const MAX_PROMPT_CHARS = 480000; // ~160k tokens de input a 3 chars/token aprox
    const safePrompt = prompt.length > MAX_PROMPT_CHARS
      ? prompt.substring(0, MAX_PROMPT_CHARS) + '\n\n[TEXTO TRUNCADO POR LONGITUD]\n\nResponde con el JSON solicitado basándote en lo analizado hasta aquí.'
      : prompt;

    const resp = await fetch(ANTHROPIC_API_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':this.apiKey,
        'anthropic-version':ANTHROPIC_VERSION,'anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({ model:CONFIG.model, max_tokens:CONFIG.maxTokens,
        messages:[{role:'user', content:safePrompt}] })
    });
    if (!resp.ok) {
      const d = await resp.json().catch(()=>({}));
      const msg = d.error?.message || `HTTP ${resp.status}`;
      if (resp.status===401) throw new Error('API_KEY_INVALID: '+msg);
      if (resp.status===429) throw new Error('RATE_LIMIT: '+msg);
      throw new Error('API_ERROR: '+msg);
    }
    const data = await resp.json();
    const raw  = data.content?.[0]?.text || '';

    // Extraer el bloque JSON aunque Claude añada texto extra antes o después
    const stripped = raw.replace(/```json\n?|\n?```/g,'').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    const clean = jsonMatch ? jsonMatch[0] : '{}';

    try {
      return JSON.parse(clean);
    } catch {
      // Último intento: reparar JSON roto (comillas sin cerrar, comas finales)
      try {
        const repaired = clean
          .replace(/,\s*([}\]])/g, '$1')   // comas finales
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":'); // claves sin comillas
        return JSON.parse(repaired);
      } catch {
        console.warn('Plumia: JSON inválido de la API, respuesta ignorada:', raw.substring(0,200));
        return {findings:[]};
      }
    }
  }

  _splitIntoChunks(text, size, overlap) {
    const words = text.split(/\s+/);
    if (words.length <= size) return [text];
    const chunks = []; let start = 0;
    while (start < words.length) {
      const end = Math.min(start + size, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start = end - overlap;
      if (start >= words.length) break;
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
    const selectedIds = this.selectedIds;
    const allResults  = [];

    // Garantía: si hay correcciones que requieren doc completo,
    // el texto debe ser el documento completo independientemente de la selección
    const hasFullDocRequired = selectedIds.some(id => {
      const c = CORRECTIONS.find(x => x.id === id);
      return c && c.requiresFullDoc;
    });
    if (hasFullDocRequired && isSelection) {
      // Forzar re-extracción del documento completo
      console.warn('Plumia: coherencia narrativa requiere doc completo — ignorando selección');
    }

    // ── PASO 1: Ortotipografía local (sin API, coste cero) ──────────────────
    if (selectedIds.includes('ortotipografia_pura')) {
      this.onProgress(2, 'Verificando ortotipografía (local, sin coste)…');
      const localFindings = runLocalOrtotypography(text);
      allResults.push({
        correctionId: 'ortotipografia_pura',
        label: 'Ortotipografía pura',
        groupId: 'orthotypo',
        colorId: null,
        findings: localFindings,
      });
      this.onChunkComplete(allResults);
    }

    // ── PASO 2: Coherencia narrativa (siempre individual, doc completo) ─────
    const coherenceIds = selectedIds.filter(id => {
      const c = CORRECTIONS.find(x => x.id === id);
      return c && c.requiresFullDoc;
    });

    const coherenceTotal = coherenceIds.length;
    for (let ci = 0; ci < coherenceIds.length; ci++) {
      if (this.aborted) break;
      const corr = CORRECTIONS.find(c => c.id === coherenceIds[ci]);
      const pct = Math.round(5 + (ci / Math.max(coherenceTotal, 1)) * 30);
      this.onProgress(pct, `Coherencia narrativa: ${corr.label}…`);
      try {
        const chunks = this._countWords(text) > CONFIG.coherenceChunkSizeWords
          ? this._splitByChapters(text)
          : [{ title: 'Documento', text }];
        let findings = [];
        for (const ch of chunks) {
          if (this.aborted) break;
          const r = await this._callAPI(corr.prompt.replace('{TEXT}', ch.text));
          (r.findings || []).forEach(f => findings.push({
            ...f, correctionId: corr.id, colorId: corr.colorId,
            label: corr.label, directFix: corr.directFix,
          }));
        }
        allResults.push({ correctionId: corr.id, label: corr.label, groupId: corr.groupId, colorId: corr.colorId, findings });
        this._saveProgress({ text: text.substring(0, 100), completedIndex: ci, results: allResults });
        this.onChunkComplete(allResults);
      } catch(err) {
        this._saveProgress({ text: text.substring(0, 100), completedIndex: ci - 1, results: allResults });
        this.onError(err, ci > 0, corr.label);
        return allResults;
      }
    }

    // ── PASO 3: Correcciones agrupadas (menos llamadas a la API) ────────────
    const nonCoherenceIds = selectedIds.filter(id => !LOCAL_ONLY_IDS.includes(id) && !coherenceIds.includes(id));
    const apiGroups = API_CORRECTION_GROUPS.filter(g =>
      g.ids.some(id => nonCoherenceIds.includes(id))
    );

    const groupTotal = apiGroups.length;
    for (let gi = 0; gi < apiGroups.length; gi++) {
      if (this.aborted) break;
      const group = apiGroups[gi];
      const activeIds = group.ids.filter(id => nonCoherenceIds.includes(id));
      const pct = Math.round(35 + (gi / Math.max(groupTotal, 1)) * 60);
      this.onProgress(pct, `Analizando: ${group.label}…`);

      try {
        const chunks = this._splitIntoChunks(text, CONFIG.chunkSizeWords, CONFIG.chunkOverlapWords);

        // Acumular resultados por correctionId
        const accumulated = {};
        activeIds.forEach(id => { accumulated[id] = []; });

        for (const chunk of chunks) {
          if (this.aborted) break;
          let response;

          if (group.ids.length === 1) {
            // Grupo de 1 → prompt individual
            const corr = CORRECTIONS.find(c => c.id === group.ids[0]);
            response = await this._callAPI(corr.prompt.replace('{TEXT}', chunk));
            const findings = (response.findings || []).map(f => ({
              ...f, correctionId: corr.id, colorId: corr.colorId,
              label: corr.label, directFix: corr.directFix,
            }));
            accumulated[corr.id].push(...findings);
          } else {
            // Prompt agrupado → parsear cada sección
            response = await this._callAPI(group.buildPrompt(chunk));
            this._parseGroupedResponse(response, group, activeIds, accumulated);
          }
        }

        // Añadir resultados a allResults, enriquecer con sinónimos locales
        for (const id of activeIds) {
          const corr = CORRECTIONS.find(c => c.id === id);
          let findings = this._dedupe(accumulated[id] || []);

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

        this._saveProgress({ text: text.substring(0, 100), completedIndex: gi + coherenceIds.length, results: allResults });
        this.onChunkComplete(allResults);

      } catch(err) {
        this._saveProgress({ text: text.substring(0, 100), completedIndex: gi - 1 + coherenceIds.length, results: allResults });
        this.onError(err, gi > 0 || coherenceIds.length > 0, group.label);
        return allResults;
      }
    }

    this._clearProgress();
    this.onProgress(100, 'Análisis completado.');
    return allResults;
  }

  _parseGroupedResponse(response, group, activeIds, accumulated) {
    // Mapeo de claves del JSON agrupado a correctionIds
    const keyMap = {
      // pronouns_grammar
      'leismo':       'leismo',
      'ambiguedad':   'ambiguedad_pronominal',
      'concordancia': 'concordancia',
      'dequeismo':    'dequeismo',
      // lexicon
      'repeticion':   'repeticion_lexica',
      'verbos':       'verbos_comedin',
      'sustantivos':  'sustantivos_genericos',
      'muletillas':   'muletillas',
      'pleonasmos':   'pleonasmos',
      // style
      'adverbios':    'adverbios_mente',
      'voz_pasiva':   'voz_pasiva',
      'frases_largas':'frases_largas',
      'nombres':      'nombres_propios',
      // grammar2
      'gerundios':    'gerundios',
      'tiempos':      'tiempos_verbales',
    };

    for (const [key, corrId] of Object.entries(keyMap)) {
      if (!activeIds.includes(corrId)) continue;
      const corr = CORRECTIONS.find(c => c.id === corrId);
      if (!corr) continue;
      const section = response[key];
      if (!section || !section.findings) continue;
      section.findings.forEach(f => {
        accumulated[corrId].push({
          ...f, correctionId: corrId, colorId: corr.colorId,
          label: corr.label, directFix: corr.directFix,
        });
      });
    }
  }

  abort() { this.aborted = true; }

  _dedupe(findings) {
    const seen = new Set();
    return findings.filter(f => {
      const k = (f.originalText||'').trim().substring(0,60);
      if (seen.has(k)) return false; seen.add(k); return true;
    });
  }

  resolveOverlaps(allResults) {
    const flat = [];
    for (const r of allResults) for (const f of r.findings) flat.push({...f, colorId:r.colorId});
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
        resolved.push({...colors[colors.length-1], mergedFindings:colors});
      } else {
        resolved.push({...colors[colors.length-1], mergedFindings:colors});
      }
    }
    return resolved;
  }

  _countWords(t) { return (t||'').trim().split(/\s+/).filter(Boolean).length; }
  _saveProgress(d) { try { localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(d)); } catch{} }
  _loadProgress() { try { const r=localStorage.getItem(STORAGE_KEY_PROGRESS); return r?JSON.parse(r):null; } catch{return null;} }
  _clearProgress() { try { localStorage.removeItem(STORAGE_KEY_PROGRESS); } catch{} }
  getSavedProgress() { return this._loadProgress(); }
  discardSavedProgress() { this._clearProgress(); }
}

})();
