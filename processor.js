// ============================================================================
// PLUMIA — processor.js  v8.00
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
    return new Promise((resolve, reject) => {
      Word.run(async (ctx) => {
        try {
          // Comprobar selección solo si no se fuerza doc completo
          if (!forceFullDoc && !state.forceFullDoc) {
            const sel = ctx.document.getSelection();
            sel.load('text'); await ctx.sync();
            const selectedText = sel.text.trim();
            if (selectedText && selectedText.length > 10) {
              resolve({ text: selectedText, isSelection: true, wordCount: this._countWords(selectedText) });
              return;
            }
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

  // Realiza una llamada a la API de Anthropic y devuelve el JSON parseado.
  // Trunca el prompt si es demasiado largo para evitar errores de contexto.
  async _callAPI(prompt) {
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
      if (resp.status === 429) throw new Error('RATE_LIMIT: ' + msg);
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

    // Extraer bloque JSON aunque Claude añada texto extra
    const stripped = raw.replace(/```json\n?|\n?```/g, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    const clean = jsonMatch ? jsonMatch[0] : '{}';

    try {
      return JSON.parse(clean);
    } catch {
      try {
        const repaired = clean
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":');
        return JSON.parse(repaired);
      } catch {
        console.warn('Plumia: JSON inválido de la API:', raw.substring(0, 200));
        return { findings: [] };
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

    if (hasFullDocRequired && isSelection) {
      this.onProgress(1, 'Coherencia narrativa requiere el documento completo. Extrayendo…');
      try {
        const fullDoc = await this.extractTextFromDocument(true);
        coherenceText = fullDoc.text; // solo para coherencia
      } catch(e) {
        throw new Error('No se pudo extraer el documento completo para el análisis de coherencia: ' + e.message);
      }
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
        const chunks = this._countWords(coherenceText) > CONFIG.coherenceChunkSizeWords
          ? this._splitByChapters(coherenceText)
          : [{ title: 'Documento', text: coherenceText }];
        let findings = [];
        for (const ch of chunks) {
          if (this.aborted) break;
          const r = await this._callAPI(corr.prompt.replace('{TEXT}', ch.text));
          (r.findings || []).forEach(f => {
            const originalText = this._extractOriginalText(f);
            if (!originalText) return;
            findings.push({ ...f, originalText, correctionId: corr.id, colorId: corr.colorId,
              label: corr.label, directFix: corr.directFix });
          });
        }
        allResults.push({ correctionId: corr.id, label: corr.label, groupId: corr.groupId, colorId: corr.colorId, findings });
        this._saveProgress({ text: coherenceText.substring(0, 100), completedIndex: ci, results: allResults });
        this.onChunkComplete(allResults);
      } catch(err) {
        this._saveProgress({ text: coherenceText.substring(0, 100), completedIndex: ci - 1, results: allResults });
        this.errored = true;
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
        const chunks = this._splitIntoChunks(selectionText, CONFIG.chunkSizeWords, CONFIG.chunkOverlapWords);

        // Acumular resultados por correctionId
        const accumulated = {};
        activeIds.forEach(id => { accumulated[id] = []; });

        for (const ch of chunks) {
          if (this.aborted) break;
          let response;

          if (group.ids.length === 1) {
            const corr = CORRECTIONS.find(c => c.id === group.ids[0]);
            response = await this._callAPI(corr.prompt.replace('{TEXT}', ch));
            const chLower = ch.toLowerCase();
            const findings = (response.findings || []).map(f => {
              const originalText = this._extractOriginalText(f);
              if (!originalText) return null;
              // Filtrar hallucinations: el texto debe existir en el chunk analizado
              const check = originalText.toLowerCase().substring(0, Math.min(originalText.length, 40));
              if (check.length > 5 && !chLower.includes(check)) return null;
              // Filtrar correcciones nulas: wordForm === correctForm (alucinación sin error real).
              // IMPORTANTE: comparar SIN eliminar diacríticos — "como"→"cómo" es corrección válida;
              // solo se filtra cuando son literalmente idénticos (ej: "Cuando"→"Cuando").
              if (f.wordForm && f.correctForm) {
                if (f.wordForm.toLowerCase().trim() === f.correctForm.toLowerCase().trim()) return null;
              }
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
            response = await this._callAPI(group.buildPrompt(ch));
            this._parseGroupedResponse(response, group, activeIds, accumulated, ch);
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

        this._saveProgress({ text: selectionText.substring(0, 100), completedIndex: gi + coherenceIds.length, results: allResults });
        this.onChunkComplete(allResults);

      } catch(err) {
        this._saveProgress({ text: selectionText.substring(0, 100), completedIndex: gi - 1 + coherenceIds.length, results: allResults });
        // Errores fatales (autenticación, rate limit) → parar todo
        if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('RATE_LIMIT') || err.message?.includes('INSUFFICIENT_CREDITS')) {
          this.errored = true;
          this.onError(err, gi > 0 || coherenceIds.length > 0, group.label);
          return allResults;
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
    return allResults;
  }

  // Extrae originalText de cualquier estructura de finding (normalización temprana)
  _extractOriginalText(f) {
    let text = f.originalText || '';
    if (!text) {
      if (f.occurrences?.[0])       text = f.occurrences[0];
      else if (f.occurrence1?.text) text = f.occurrence1.text;
      else if (f.occurrence?.text)  text = f.occurrence.text;
      else if (f.frase)             text = f.frase;
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
        // Normalizar originalText AQUÍ, antes de deduplicar
        const originalText = this._extractOriginalText(f);
        if (!originalText) return; // descartar findings sin texto localizable
        // Filtrar hallucinations: el texto debe existir en el chunk analizado
        if (chunkLower) {
          const check = originalText.toLowerCase().substring(0, Math.min(originalText.length, 40));
          if (check.length > 5 && !chunkLower.includes(check)) return;
        }
        accumulated[corrId].push({
          ...f,
          originalText,
          correctionId: corrId,
          colorId:      corr.colorId,
          label:        corr.label,
          directFix:    corr.directFix,
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

  // Normaliza todos los findings para que tengan originalText consistente
  normalizeFindings(allResults) {
    return allResults.map(result => ({
      ...result,
      findings: result.findings.map(f => {
        let text = f.originalText || '';

        // Tipos con estructura distinta
        if (!text) {
          if (f.occurrences && f.occurrences.length > 0) {
            // repeticion_lexica, muletillas, nombres_propios: tiene occurrences[]
            text = f.occurrences[0];
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
        resolved.push({...colors[colors.length-1], mergedFindings:colors});
      } else {
        // nombres_propios tiene prioridad sobre repeticion_lexica cuando coexisten
        const primary = colors.find(f => f.correctionId === 'nombres_propios')
                     || colors[colors.length-1];
        resolved.push({...primary, mergedFindings:colors});
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
