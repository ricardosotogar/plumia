// ============================================================================
// PLUMIA — processor.js
// Preprocesador de texto y gestor de llamadas a la API de Claude
// ----------------------------------------------------------------------------
// Responsabilidades:
//   1. Extraer el texto del documento Word (excluyendo índice, encabezados, etc.)
//   2. Dividir el texto en fragmentos manejables (chunks)
//   3. Calcular el coste estimado antes de enviar
//   4. Gestionar las llamadas a la API con guardado parcial progresivo
//   5. Manejar errores y permitir reanudar desde donde se quedó
// ============================================================================

import { CORRECTIONS, GROUPS, CONFIG, COLOR_MAP } from './corrections-config.js';

// ── CONSTANTES ───────────────────────────────────────────────────────────────
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const STORAGE_KEY_PROGRESS = 'plumia_analysis_progress';
const STORAGE_KEY_RESULTS  = 'plumia_analysis_results';

// ── CLASE PRINCIPAL ───────────────────────────────────────────────────────────
export class PlumiaProcessor {

  constructor(apiKey, selectedCorrectionIds, outputMode, onProgress, onChunkComplete, onError) {
    this.apiKey              = apiKey;
    this.selectedIds         = selectedCorrectionIds; // array de IDs de corrections-config
    this.outputMode          = outputMode;            // 'marked' | 'report'
    this.onProgress          = onProgress;            // callback(percent, message)
    this.onChunkComplete     = onChunkComplete;       // callback(results) — guardado parcial
    this.onError             = onError;               // callback(error, canResume)
    this.aborted             = false;
  }

  // ── 1. EXTRACCIÓN DE TEXTO ─────────────────────────────────────────────────

  /**
   * Extrae el texto del documento Word activo, excluyendo los elementos
   * que no deben analizarse: índice, encabezados, pies de página, notas al pie
   * y comentarios existentes.
   * Si hay texto seleccionado, devuelve solo ese fragmento.
   * @returns {Promise<{text: string, isSelection: boolean, wordCount: number}>}
   */
  async extractTextFromDocument() {
    return new Promise((resolve, reject) => {
      Word.run(async (context) => {
        try {
          // ── Comprobar si hay selección ──────────────────────────────────
          const selection = context.document.getSelection();
          selection.load('text');
          await context.sync();

          const selectedText = selection.text.trim();

          if (selectedText && selectedText.length > 10) {
            resolve({
              text: selectedText,
              isSelection: true,
              wordCount: this._countWords(selectedText),
              paragraphMap: [{ text: selectedText, index: 0 }]
            });
            return;
          }

          // ── Documento completo ──────────────────────────────────────────
          const body = context.document.body;
          body.load('paragraphs');
          await context.sync();

          const paragraphs = body.paragraphs;
          paragraphs.load('items');
          await context.sync();

          const paragraphItems = paragraphs.items;
          const extracted = [];
          const paragraphMap = []; // mapa para relación párrafo → posición

          // Cargar estilo y texto de cada párrafo
          for (let i = 0; i < paragraphItems.length; i++) {
            paragraphItems[i].load('text, style');
          }
          await context.sync();

          let insideTOC = false;

          for (let i = 0; i < paragraphItems.length; i++) {
            const para = paragraphItems[i];
            const style = (para.style || '').toLowerCase();
            const text  = (para.text || '').trim();

            if (!text) continue;

            // Detectar inicio de tabla de contenidos / índice
            if (style.includes('toc') || style.includes('table of contents') ||
                style.includes('tabla de contenido') || style.includes('índice')) {
              insideTOC = true;
            }

            // Detectar fin de TOC (cuando aparece un estilo normal tras el TOC)
            if (insideTOC && (style.includes('heading') || style.includes('normal') ||
                style.includes('título') || style.includes('cuerpo'))) {
              insideTOC = false;
            }

            // Excluir estilos que no deben analizarse
            const excluded =
              insideTOC ||
              style.includes('toc') ||
              style.includes('header') ||
              style.includes('footer') ||
              style.includes('encabezado') ||
              style.includes('pie de p') ||
              style.includes('footnote') ||
              style.includes('endnote') ||
              style.includes('nota al pie') ||
              style.includes('comment');

            if (!excluded) {
              extracted.push(text);
              paragraphMap.push({ text, index: i, style });
            }
          }

          const fullText = extracted.join('\n\n');
          resolve({
            text: fullText,
            isSelection: false,
            wordCount: this._countWords(fullText),
            paragraphMap
          });

        } catch (err) {
          reject(new Error('Error al leer el documento: ' + err.message));
        }
      });
    });
  }

  // ── 2. ESTIMACIÓN DE COSTE ─────────────────────────────────────────────────

  /**
   * Calcula el coste estimado de un análisis antes de enviarlo.
   * @param {number} wordCount - número de palabras a analizar
   * @param {string[]} selectedIds - IDs de correcciones seleccionadas
   * @param {number} eurUsdRate - tasa de cambio EUR/USD actual
   * @returns {object} estimación de coste desglosada
   */
  estimateCost(wordCount, selectedIds, eurUsdRate = 1.08) {
    const corrections = CORRECTIONS.filter(c => selectedIds.includes(c.id));
    const hasCoherence = corrections.some(c => c.groupId === 'coherence');

    // Tokens de entrada: texto + prompt de cada corrección
    const textTokens      = Math.ceil(wordCount / CONFIG.wordsPerToken);
    const promptTokensAvg = 300; // tokens medios por prompt
    const inputTokens     = corrections.length * (textTokens + promptTokensAvg);

    // Tokens de salida: respuesta JSON estimada (más pequeña que la entrada)
    const outputTokensPerCall = Math.ceil(textTokens * 0.15); // ~15% del input
    const outputTokens        = corrections.length * outputTokensPerCall;

    // Multiplicador para coherencia narrativa (análisis más largo)
    const coherenceMultiplier = hasCoherence ? 1.8 : 1.0;

    const inputCostUSD  = inputTokens  * CONFIG.inputPricePerToken  * coherenceMultiplier;
    const outputCostUSD = outputTokens * CONFIG.outputPricePerToken * coherenceMultiplier;
    const totalCostUSD  = inputCostUSD + outputCostUSD;
    const totalCostEUR  = totalCostUSD / eurUsdRate;

    return {
      wordCount,
      corrections: corrections.length,
      hasCoherence,
      inputTokens:  Math.ceil(inputTokens  * coherenceMultiplier),
      outputTokens: Math.ceil(outputTokens * coherenceMultiplier),
      totalTokens:  Math.ceil((inputTokens + outputTokens) * coherenceMultiplier),
      costUSD: parseFloat(totalCostUSD.toFixed(4)),
      costEUR: parseFloat(totalCostEUR.toFixed(4)),
      costUSDFormatted: '$' + totalCostUSD.toFixed(4),
      costEURFormatted: totalCostEUR.toFixed(4) + ' €',
    };
  }

  /**
   * Obtiene la tasa de cambio EUR/USD en tiempo real.
   * Si falla, devuelve un valor por defecto.
   */
  async getEurUsdRate() {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      return data.rates?.EUR || 1.08;
    } catch {
      return 1.08; // valor por defecto si no hay conexión
    }
  }

  // ── 3. DIVISIÓN EN FRAGMENTOS (CHUNKING) ──────────────────────────────────

  /**
   * Divide un texto largo en fragmentos con overlap para no perder contexto.
   * @param {string} text - texto a dividir
   * @param {number} chunkSizeWords - tamaño máximo de cada fragmento en palabras
   * @param {number} overlapWords - palabras de solapamiento entre fragmentos
   * @returns {string[]} array de fragmentos
   */
  _splitIntoChunks(text, chunkSizeWords, overlapWords) {
    const words = text.split(/\s+/);
    if (words.length <= chunkSizeWords) return [text];

    const chunks = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + chunkSizeWords, words.length);
      chunks.push(words.slice(start, end).join(' '));

      // Avanzar con overlap
      start = end - overlapWords;
      if (start >= words.length) break;
    }

    return chunks;
  }

  /**
   * Divide un documento en capítulos para el análisis de coherencia.
   * Busca los encabezados de capítulo para hacer los cortes.
   * @param {string} text - texto completo
   * @returns {Array<{title: string, text: string}>}
   */
  _splitByChapters(text) {
    // Patrones comunes de inicio de capítulo
    const chapterPattern = /^(cap[íi]tulo\s+\d+|chapter\s+\d+|parte\s+\d+|\d+\.\s+[A-ZÁÉÍÓÚ])/im;
    const lines = text.split('\n');
    const chapters = [];
    let currentTitle = 'Inicio';
    let currentLines = [];

    for (const line of lines) {
      if (chapterPattern.test(line.trim())) {
        if (currentLines.length > 0) {
          chapters.push({ title: currentTitle, text: currentLines.join('\n') });
        }
        currentTitle = line.trim();
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      chapters.push({ title: currentTitle, text: currentLines.join('\n') });
    }

    return chapters.length > 1 ? chapters : [{ title: 'Documento completo', text }];
  }

  // ── 4. LLAMADA A LA API ────────────────────────────────────────────────────

  /**
   * Realiza una llamada a la API de Claude con un prompt y texto dados.
   * @param {string} prompt - prompt completo con {TEXT} ya sustituido
   * @returns {Promise<object>} respuesta JSON parseada de Claude
   */
  async _callAPI(prompt) {
    const response = await fetch(ANTHROPIC_API_URL, {
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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || `HTTP ${response.status}`;

      if (response.status === 401) throw new Error('API_KEY_INVALID: ' + msg);
      if (response.status === 429) throw new Error('RATE_LIMIT: ' + msg);
      if (response.status === 529) throw new Error('API_OVERLOADED: ' + msg);
      throw new Error('API_ERROR: ' + msg);
    }

    const data = await response.json();
    const raw  = data.content?.[0]?.text || '';

    // Limpiar posibles bloques markdown antes de parsear
    const clean = raw.replace(/```json\n?|\n?```/g, '').trim();

    try {
      return JSON.parse(clean);
    } catch {
      // Si Claude devolvió texto no JSON, devolver findings vacío
      console.warn('Plumia: respuesta no JSON de la API', raw);
      return { findings: [] };
    }
  }

  // ── 5. ANÁLISIS PRINCIPAL ─────────────────────────────────────────────────

  /**
   * Ejecuta el análisis completo del documento.
   * Gestiona el progreso, el guardado parcial y la posibilidad de reanudar.
   * @param {string} text - texto a analizar
   * @param {boolean} isSelection - si es un fragmento seleccionado
   * @returns {Promise<Array>} array de resultados de todas las correcciones
   */
  async analyze(text, isSelection) {
    const corrections = CORRECTIONS.filter(c => this.selectedIds.includes(c.id));
    const hasCoherence = corrections.some(c => c.groupId === 'coherence');

    // Verificar si hay un análisis previo interrumpido
    const savedProgress = this._loadProgress();
    let startFromIndex  = 0;
    let allResults      = [];

    if (savedProgress && savedProgress.text === text.substring(0, 100)) {
      // Hay un análisis previo compatible — ofrecer reanudar
      startFromIndex = savedProgress.completedIndex + 1;
      allResults     = savedProgress.results || [];
      this.onProgress(
        Math.round((startFromIndex / corrections.length) * 100),
        `Reanudando análisis desde «${corrections[startFromIndex - 1]?.label || ''}»…`
      );
    }

    for (let i = startFromIndex; i < corrections.length; i++) {
      if (this.aborted) break;

      const correction = corrections[i];
      const percent    = Math.round((i / corrections.length) * 100);

      this.onProgress(percent, `Analizando: ${correction.label}…`);

      try {
        let correctionResults = [];

        if (correction.requiresFullDoc) {
          // ── Análisis de coherencia: procesar por capítulos si es largo ──
          if (this._countWords(text) > CONFIG.coherenceChunkSizeWords) {
            const chapters = this._splitByChapters(text);
            for (const chapter of chapters) {
              if (this.aborted) break;
              const prompt   = correction.prompt.replace('{TEXT}', chapter.text);
              const response = await this._callAPI(prompt);
              const findings = (response.findings || []).map(f => ({
                ...f,
                correctionId: correction.id,
                colorId:      correction.colorId,
                label:        correction.label,
                includesSynonyms: correction.includesSynonyms,
                directFix:    correction.directFix,
                chapterTitle: chapter.title,
              }));
              correctionResults.push(...findings);
            }
          } else {
            const prompt   = correction.prompt.replace('{TEXT}', text);
            const response = await this._callAPI(prompt);
            correctionResults = (response.findings || []).map(f => ({
              ...f,
              correctionId: correction.id,
              colorId:      correction.colorId,
              label:        correction.label,
              includesSynonyms: correction.includesSynonyms,
              directFix:    correction.directFix,
            }));
          }
        } else {
          // ── Análisis estándar: dividir en chunks si es necesario ──────
          const chunks = this._splitIntoChunks(
            text,
            CONFIG.chunkSizeWords,
            CONFIG.chunkOverlapWords
          );

          for (const chunk of chunks) {
            if (this.aborted) break;
            const prompt   = correction.prompt.replace('{TEXT}', chunk);
            const response = await this._callAPI(prompt);
            const findings = (response.findings || []).map(f => ({
              ...f,
              correctionId: correction.id,
              colorId:      correction.colorId,
              label:        correction.label,
              includesSynonyms: correction.includesSynonyms,
              directFix:    correction.directFix,
            }));
            correctionResults.push(...findings);
          }

          // Deduplicar resultados solapados entre chunks
          correctionResults = this._deduplicateFindings(correctionResults);
        }

        // Guardar progreso parcial
        allResults.push({
          correctionId: correction.id,
          label:        correction.label,
          groupId:      correction.groupId,
          colorId:      correction.colorId,
          findings:     correctionResults,
        });

        this._saveProgress({
          text:           text.substring(0, 100),
          completedIndex: i,
          results:        allResults,
        });

        // Notificar al document-builder para ir aplicando cambios en tiempo real
        this.onChunkComplete(allResults);

      } catch (err) {
        // Guardar el progreso antes de propagar el error
        this._saveProgress({
          text:           text.substring(0, 100),
          completedIndex: i - 1,
          results:        allResults,
        });

        const canResume = i > 0;
        this.onError(err, canResume, correction.label);
        return allResults; // devolver lo que hay hasta el momento
      }
    }

    // Análisis completado — limpiar el progreso guardado
    this._clearProgress();
    this.onProgress(100, 'Análisis completado.');

    return allResults;
  }

  /**
   * Aborta el análisis en curso.
   */
  abort() {
    this.aborted = true;
  }

  // ── 6. DEDUPLICACIÓN ─────────────────────────────────────────────────────

  /**
   * Elimina findings duplicados que pueden aparecer por el overlap entre chunks.
   * Dos findings son duplicados si su originalText es idéntico o casi idéntico.
   */
  _deduplicateFindings(findings) {
    const seen = new Set();
    return findings.filter(f => {
      const key = (f.originalText || '').trim().substring(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ── 7. GESTIÓN DE SOLAPAMIENTOS DE COLOR ─────────────────────────────────

  /**
   * Resuelve conflictos cuando dos errores afectan al mismo fragmento de texto.
   * Sigue las reglas definidas en el spec:
   * - Corchetes (tipo bracket) + cualquier color: coexisten sin conflicto
   * - Dos errores de color sobre el mismo fragmento: gana el último color,
   *   pero ambos se incluyen en el comentario
   * @param {Array} allResults - todos los resultados del análisis
   * @returns {Array} resultados con solapamientos resueltos
   */
  resolveOverlaps(allResults) {
    // Aplanar todos los findings en un solo array con su colorId
    const allFindings = [];
    for (const result of allResults) {
      for (const finding of result.findings) {
        allFindings.push({ ...finding, colorId: result.colorId });
      }
    }

    // Agrupar por originalText para detectar solapamientos
    const grouped = {};
    for (const finding of allFindings) {
      const key = (finding.originalText || '').trim();
      if (!key) continue;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(finding);
    }

    // Resolver conflictos
    const resolved = [];
    for (const [text, findings] of Object.entries(grouped)) {
      if (findings.length === 1) {
        resolved.push({ ...findings[0], mergedFindings: [findings[0]] });
        continue;
      }

      const hasBracket    = findings.some(f => COLOR_MAP[f.colorId]?.type === 'bracket');
      const nonBrackets   = findings.filter(f => COLOR_MAP[f.colorId]?.type !== 'bracket');
      const bracketItems  = findings.filter(f => COLOR_MAP[f.colorId]?.type === 'bracket');

      if (hasBracket && nonBrackets.length === 0) {
        // Solo corchetes: si hay dos tipos de corchetes, usar el externo (menor colorId)
        const outer = bracketItems.reduce((a,b) => a.colorId <= b.colorId ? a : b);
        resolved.push({ ...outer, mergedFindings: bracketItems });
      } else if (hasBracket && nonBrackets.length > 0) {
        // Corchetes + colores: coexisten
        resolved.push(...bracketItems.map(b => ({ ...b, mergedFindings: [b] })));
        // Para los de color: último gana
        const lastColor = nonBrackets[nonBrackets.length - 1];
        resolved.push({ ...lastColor, mergedFindings: nonBrackets });
      } else {
        // Solo colores: último gana
        const last = nonBrackets[nonBrackets.length - 1];
        resolved.push({ ...last, mergedFindings: nonBrackets });
      }
    }

    return resolved;
  }

  // ── 8. UTILIDADES ────────────────────────────────────────────────────────

  _countWords(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  _saveProgress(data) {
    try {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(data));
    } catch {}
  }

  _loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _clearProgress() {
    try {
      localStorage.removeItem(STORAGE_KEY_PROGRESS);
      localStorage.removeItem(STORAGE_KEY_RESULTS);
    } catch {}
  }

  /**
   * Comprueba si hay un análisis interrumpido guardado.
   * @returns {object|null} datos del análisis interrumpido o null
   */
  getSavedProgress() {
    return this._loadProgress();
  }

  /**
   * Descarta el análisis interrumpido guardado.
   */
  discardSavedProgress() {
    this._clearProgress();
  }
}

// ── FUNCIÓN DE AYUDA: CONSTRUIR TEXTO DE COMENTARIO ──────────────────────────
/**
 * Genera el texto del comentario de Word para un finding (o grupo de findings solapados).
 * @param {Array} mergedFindings - findings solapados sobre el mismo fragmento
 * @returns {string} texto del comentario
 */
export function buildCommentText(mergedFindings) {
  if (!mergedFindings || mergedFindings.length === 0) return '';

  if (mergedFindings.length === 1) {
    return _singleFindingComment(mergedFindings[0]);
  }

  // Múltiples errores solapados: numerar cada uno
  return mergedFindings
    .map((f, i) => `${i + 1}) ${_singleFindingComment(f)}`)
    .join('\n');
}

function _singleFindingComment(finding) {
  const label = finding.label || finding.correctionId || 'Error';

  switch (finding.correctionId) {
    case 'leismo':
    case 'laismo':
    case 'loismo':
      return `${label}: la forma correcta es «${finding.correction}».`;

    case 'ambiguedad_pronominal':
      return `Ambigüedad pronominal: el pronombre «${finding.pronoun}» puede referirse a ${finding.possibleReferents?.join(' o ')}. ${finding.suggestion ? 'Posible revisión: ' + finding.suggestion : ''}`;

    case 'repeticion_lexica':
      return `Repetición léxica: «${finding.word}» aparece varias veces cerca. ${finding.synonyms?.length ? 'Posibles sinónimos: ' + finding.synonyms.join(', ') + '.' : ''}`;

    case 'verbos_comedin':
      return `Verbo comodín «${finding.verb}»: ${finding.explanation} Alternativas: ${finding.alternatives?.join(', ') || ''}.`;

    case 'sustantivos_genericos':
      return `Sustantivo genérico «${finding.genericWord}»: ${finding.explanation} Alternativas: ${finding.alternatives?.join(', ') || ''}.`;

    case 'muletillas':
      return `Muletilla «${finding.expression}»: aparece repetidamente. ${finding.alternatives?.filter(a=>a!=='eliminar').length ? 'Alternativas: ' + finding.alternatives.join(', ') + '.' : 'Valora eliminarla.'}`;

    case 'pleonasmos':
      return `Pleonasmo: ${finding.explanation} Corrección: «${finding.correction}».`;

    case 'adverbios_mente':
      return `Adverbio -mente: ${finding.explanation} ${finding.alternatives?.length ? 'Alternativas: ' + finding.alternatives.join(', ') + '.' : ''}`;

    case 'voz_pasiva':
      return `Voz pasiva: ${finding.explanation} Posible versión activa: «${finding.activeVersion}».`;

    case 'frases_largas':
      return `Frase larga (${finding.wordCount} palabras): ${finding.explanation} ${finding.suggestion ? 'Sugerencia: ' + finding.suggestion : ''}`;

    case 'nombres_propios':
      return `Exceso de nombres propios: «${finding.name}» se repite varias veces cerca. ${finding.suggestion}`;

    case 'ritmo_narrativo':
      return `Ritmo narrativo: ${finding.issue} ${finding.suggestion ? 'Sugerencia: ' + finding.suggestion : ''}`;

    case 'gerundios':
      return `Gerundio incorrecto (${finding.errorType}): ${finding.explanation} Corrección: «${finding.correction}».`;

    case 'dequeismo':
      return `${finding.errorType === 'dequeismo' ? 'Dequeísmo' : 'Queísmo'}: ${finding.explanation} Corrección: «${finding.correction}».`;

    case 'concordancia':
      return `Concordancia (${finding.errorType}): ${finding.explanation} Corrección: «${finding.correction}».`;

    case 'tiempos_verbales':
      return `Tiempo verbal: ${finding.explanation} ${finding.suggestion ? 'Sugerencia: ' + finding.suggestion : ''}`;

    case 'ortotipografia_pura':
      if (finding.isFirstOccurrence) {
        return `Ortotipografía corregida en todo el documento: ${finding.explanation}`;
      }
      return null; // sin comentario para ocurrencias posteriores

    case 'puntuacion_dialogo':
      return `Puntuación de diálogo (${finding.errorType}): ${finding.explanation} Corrección: «${finding.correction}».`;

    case 'coherencia_personajes':
    case 'coherencia_temporal':
    case 'coherencia_objetos':
    case 'coherencia_conocimiento':
    case 'tono_voz':
    case 'nombres_inconsistentes':
    case 'pov':
      return _coherenceComment(finding);

    default:
      return `${label}: ${finding.explanation || ''}`;
  }
}

function _coherenceComment(finding) {
  const label = finding.label || 'Coherencia narrativa';
  let comment = `COHERENCIA — ${label}:\n`;
  if (finding.occurrence1) {
    comment += `· ${finding.occurrence1.location || 'Primera mención'}: «${finding.occurrence1.text}»\n`;
  }
  if (finding.occurrence2) {
    comment += `· ${finding.occurrence2.location || 'Segunda mención'}: «${finding.occurrence2.text}»\n`;
  }
  comment += finding.explanation || '';
  return comment.trim();
}
