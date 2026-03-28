// ============================================================================
// PLUMIA — document-builder.js
// buildCommentText, DocumentBuilder: marcas en Word, informe de incidencias
// Depende de: corrections-config.js (COLOR_MAP, CONFIG)
// ============================================================================
(function() {
var COLOR_MAP  = window.PLUMIA.COLOR_MAP;
var CONFIG     = window.PLUMIA.CONFIG;

// ── Colores de símbolo ◆ por correctionId ─────────────────────────────────────
const SYMBOL_COLORS = {
  'leismo':                'FF0000',  // rojo
  'adverbios_mente':       '2E7D00',  // verde oscuro
  'repeticion_lexica':     'B8860B',  // amarillo oscuro
  'verbos_comedin':        'CC5500',  // naranja
  'sustantivos_genericos': 'CC5500',
  'muletillas':            'CC5500',
  'pleonasmos':            'CC5500',
  'voz_pasiva':            '0097C8',  // turquesa
  'tiempos_verbales':      '0055A0',  // azul
  'nombres_propios':       '0055A0',
  'gerundios':             '0055A0',
  'dequeismo':             '0055A0',
  'frases_largas':         'C0006A',  // rosa
  'puntuacion_dialogo':    'C0006A',
  'ritmo_narrativo':       'C0006A',
  'concordancia':          'C0006A',
  'ambiguedad_pronominal': '5020A0',  // lavanda
  'coherencia_personajes': '6B2197',  // violeta
  'coherencia_temporal':   '6B2197',
  'coherencia_objetos':    '6B2197',
  'coherencia_conocimiento':'6B2197',
  'tono_voz':              '6B2197',
  'nombres_inconsistentes':'6B2197',
  'pov':                   '6B2197',
};

// ── Colores de resaltado Word por correctionId ────────────────────────────────
const HIGHLIGHT = {
  'adverbios_mente':       'Green',
  'repeticion_lexica':     'Yellow',
  'verbos_comedin':        'Orange',
  'sustantivos_genericos': 'Orange',
  'muletillas':            'Orange',
  'pleonasmos':            'Orange',
  'nombres_propios':       'Blue',
  'gerundios':             'Blue',
  'dequeismo':             'Blue',
  'concordancia':          'Pink',
};

// ── Estrategia de marcado por correctionId ────────────────────────────────────
const BRACKET_TYPES = new Set([
  'voz_pasiva','tiempos_verbales','frases_largas','puntuacion_dialogo',
  'ritmo_narrativo','ambiguedad_pronominal',
  'coherencia_personajes','coherencia_temporal','coherencia_objetos',
  'coherencia_conocimiento','tono_voz','nombres_inconsistentes','pov',
]);

// ── COMENTARIOS ───────────────────────────────────────────────────────────────
window.PLUMIA.buildCommentText = function buildCommentText(mergedFindings) {
  if (!mergedFindings || !mergedFindings.length) return '';
  if (mergedFindings.length === 1) return _singleComment(mergedFindings[0]);
  return mergedFindings.map((f,i) => `${i+1}) ${_singleComment(f)}`).join('\n');
}

function _singleComment(f) {
  const label = f.label || f.correctionId || 'Error';
  switch(f.correctionId) {
    case 'leismo': case 'laismo': case 'loismo':
      return `${label}: la forma correcta es «${f.correction}».`;
    case 'ambiguedad_pronominal':
      return `Ambigüedad pronominal: el pronombre «${f.pronoun}» puede referirse a ${(f.possibleReferents||[]).join(' o ')}. ${f.suggestion?'Posible revisión: '+f.suggestion:''}`;
    case 'repeticion_lexica':
      return `Repetición léxica: «${f.word}» aparece varias veces cerca. ${f.synonyms?.length?'Sinónimos: '+f.synonyms.join(', ')+'.':''}`;
    case 'verbos_comedin':
      return `Verbo comodín «${f.verb}»: ${f.explanation||''} ${(f.alternatives||[]).length?'Alternativas: '+(f.alternatives||[]).join(', ')+'.':''}`;
    case 'sustantivos_genericos':
      return `Sustantivo genérico «${f.genericWord}»: ${f.explanation||''} ${(f.alternatives||[]).length?'Alternativas: '+(f.alternatives||[]).join(', ')+'.':''}`;
    case 'muletillas':
      return `Muletilla «${f.expression}»: puede no estar aportando nada al texto. ${f.explanation?f.explanation+' ':''} ${(f.alternatives||[]).filter(a=>a!=='eliminar').length?'Alternativas: '+(f.alternatives||[]).filter(a=>a!=='eliminar').join(', ')+'.':'Valora eliminarla.'}`;
    case 'pleonasmos':
      return `Pleonasmo: ${f.explanation||''} Corrección: «${f.correction||''}».`;
    case 'adverbios_mente': {
      const adv = (f.adverbs||[f.adverb]).filter(Boolean).join(', ');
      const ev  = (f.evaluation||f.explanation||'').toLowerCase().includes('adecuad') ? 'Adecuado' : 'Mejorable';
      const alts = (f.alternatives||f.synonyms||[]).filter(Boolean);
      let c = `Adverbio en -mente${adv?' «'+adv+'»':''}: ${ev}.`;
      if (f.explanation) c += ' ' + f.explanation;
      if (alts.length && ev === 'Mejorable') c += ' Alternativas: ' + alts.join('; ') + '.';
      return c;
    }
    case 'voz_pasiva':
      return `Voz pasiva: ${f.explanation||''} Posible versión activa: «${f.activeVersion||''}».`;
    case 'frases_largas':
      return `Frase larga (${f.wordCount||'?'} palabras): ${f.explanation||''} ${f.suggestion?'Sugerencia: '+f.suggestion:''}`;
    case 'nombres_propios':
      return `Exceso de nombres propios: «${f.name}» se repite varias veces cerca. ${f.suggestion||''}`;
    case 'ritmo_narrativo':
      return `Ritmo narrativo: ${f.issue||f.explanation||''} ${f.suggestion?'Sugerencia: '+f.suggestion:''}`;
    case 'gerundios':
      return `Gerundio incorrecto (${f.errorType||''}): ${f.explanation||''} Corrección: «${f.correction||''}».`;
    case 'dequeismo':
      return `${f.errorType==='dequeismo'?'Dequeísmo':'Queísmo'}: ${f.explanation||''} Corrección: «${f.correction||''}».`;
    case 'concordancia':
      return `Concordancia (${f.errorType||''}): ${f.explanation||''} Corrección: «${f.correction||''}».`;
    case 'tiempos_verbales':
      return `Tiempo verbal: ${f.explanation||''} ${f.suggestion?'Sugerencia: '+f.suggestion:''}`;
    case 'ortotipografia_pura':
      return f.isFirstOccurrence ? `Ortotipografía corregida en todo el documento: ${f.explanation}` : null;
    case 'puntuacion_dialogo':
      return `Puntuación de diálogo (${f.errorType||''}): ${f.explanation||''} Corrección: «${f.correction||''}».`;
    default:
      return _coherenceComment(f);
  }
}

function _coherenceComment(f) {
  let c = `COHERENCIA — ${f.label||'Coherencia narrativa'}:\n`;
  if (f.occurrence1) c += `· ${f.occurrence1.location||'Primera mención'}: «${f.occurrence1.text}»\n`;
  if (f.occurrence2) c += `· ${f.occurrence2.location||'Segunda mención'}: «${f.occurrence2.text}»\n`;
  return (c + (f.explanation||'')).trim();
}

const buildCommentText = window.PLUMIA.buildCommentText;

// ── DOCUMENTBUILDER ───────────────────────────────────────────────────────────
window.PLUMIA.DocumentBuilder = class DocumentBuilder {
  constructor(outputMode) {
    this.outputMode   = outputMode;
    this._markerIdx   = 0; // contador único para marcadores temporales
  }

  async getRevisionName(originalName) {
    const base = originalName.replace(/\s*REVISION\s*/i, '').trim();
    return `${base} REVISION`;
  }

  getStatsName(revisionName) {
    return revisionName.replace('REVISION', 'ESTADISTICAS');
  }

  // ── EXTRACCIÓN DE TEXTOS CLAVE POR TIPO ────────────────────────────────────

  _extractPronoun(finding) {
    // Comparar originalText con correction para encontrar el pronombre erróneo
    const origW = (finding.originalText || '').split(/\s+/);
    const corrW = (finding.correction   || '').split(/\s+/);
    for (let i = 0; i < origW.length && i < corrW.length; i++) {
      if (origW[i].toLowerCase() !== corrW[i].toLowerCase()) return origW[i];
    }
    // Fallback: buscar la/le/lo/las/les/los en el texto original
    const m = (finding.originalText || '').match(/\b(la|le|lo|las|les|los)\b/i);
    return m ? m[1] : null;
  }

  _getKeyText(finding) {
    const corrId = finding.correctionId;
    switch(corrId) {
      case 'adverbios_mente':
        return ((finding.adverbs||[]).concat([finding.adverb]).filter(Boolean))[0] || finding.originalText;
      case 'repeticion_lexica':
        return finding.word || finding.originalText;
      case 'verbos_comedin':
        return finding.verb || finding.originalText;
      case 'sustantivos_genericos':
        return finding.genericWord || finding.originalText;
      case 'muletillas':
        return finding.expression || finding.originalText;
      case 'pleonasmos': {
        // Encontrar la palabra redundante comparando original con corrección
        const orig = (finding.originalText||'').split(/\s+/);
        const corr = (finding.correction  ||'').split(/\s+/);
        const redundant = orig.find(w => !corr.some(c => c.toLowerCase() === w.toLowerCase()));
        return redundant || finding.originalText;
      }
      case 'nombres_propios':
        return finding.name || finding.originalText;
      case 'gerundios':
        return finding.gerund || finding.originalText;
      case 'dequeismo':
        return finding.errorType === 'dequeismo' ? 'de que' :
               (finding.originalText||'').split(/\s+/).slice(0,3).join(' ');
      case 'concordancia':
        return (finding.originalText||'').split(/\s+/).slice(0,2).join(' ');
      default:
        return finding.originalText;
    }
  }

  // ── INSERCIÓN DE ◆ CON COLOR ───────────────────────────────────────────────

  // Inserta un marcador temporal, lo encuentra y lo reemplaza con ◆ estilizado.
  // insertFn: función que hace el insertText (para poder reutilizar en start/end)
  // ── DOS PASADAS ─────────────────────────────────────────────────────────────
  //
  // El problema fundamental de la API de Word JS: body.search() dentro de un
  // Word.run, después de múltiples ctx.sync(), falla silenciosamente porque el
  // índice interno de búsqueda queda stale tras modificaciones.
  //
  // Solución: arquitectura de dos pasadas separadas en Word.run distintos:
  //  PASADA 1: insertar marcadores de texto únicos en el documento (sin reemplazar nada)
  //  PASADA 2: buscar y reemplazar cada marcador con el ◆ estilizado + comentario
  //
  // Los comentarios van anclados al párrafo (no al range del ◆) para mayor fiabilidad.

  // Paso 1A: Insertar marcador de texto en el documento
  // Retorna el texto del marcador para poder buscarlo en la pasada 2.
  async _insertMarker(ctx, body, insertPoint, insertLocation, markerText) {
    insertPoint.insertText(markerText, insertLocation);
    await ctx.sync();
    return markerText;
  }

  // Paso 2: Buscar un marcador y reemplazarlo con ◆ estilizado + comentario opcional
  async _replaceMarkerWithDiamond(diamondText, colorHex, commentText) {
    // Buscar en un Word.run fresco para evitar contextos stale
    await Word.run(async (ctx) => {
      const body = ctx.document.body;
      // Buscar el marcador exacto
      const mr = body.search(diamondText.marker, {matchCase:true, matchWholeWord:false, matchWildcards:false});
      mr.load('items'); await ctx.sync();
      if (!mr.items.length) return;

      const d = mr.items[0];

      // Reemplazar marcador por símbolo ◆ con superíndice si aplica
      const symbol = diamondText.superscript
        ? ('\u25C6' + diamondText.superscript)
        : '\u25C6';
      d.insertText(symbol, 'Replace');
      d.font.color          = colorHex;
      d.font.bold           = true;
      d.font.highlightColor = 'None';
      d.font.size           = 18; // 9pt
      await ctx.sync();

      // Comentario: anclar al párrafo que contiene el ◆
      if (commentText) {
        const safe = commentText.replace(/[\r\n]+/g, ' | ').substring(0, 400);
        try {
          const para = d.paragraphs.getFirst();
          para.load('isNullObject'); await ctx.sync();
          para.getRange('Start').insertComment(safe);
          await ctx.sync();
        } catch(e) {
          try { d.insertComment(safe); await ctx.sync(); } catch(e2) {}
        }
      }
    });
  }

  // Estrategia de marcado por tipo: genera marcadores y los registra para la pasada 2
  async _applyPronounMark(ctx, body, range, finding, colorHex, commentText) {
    const pronoun = this._extractPronoun(finding);
    if (!pronoun) return;

    const para = range.paragraphs.getFirst();
    para.load('text'); await ctx.sync();
    const paraText = para.text || '';
    const origLower    = (finding.originalText||'').toLowerCase();
    const pronounLower = pronoun.toLowerCase();
    const origPos      = paraText.toLowerCase().indexOf(origLower);
    if (origPos === -1) return;
    const pronounInOrig = origLower.indexOf(pronounLower);
    const absolutePos   = origPos + pronounInOrig;
    const textBefore    = paraText.substring(0, absolutePos);
    const countBefore   = (textBefore.match(new RegExp('\\b' + pronounLower + '\\b', 'gi')) || []).length;

    const pronounResults = para.search(pronoun, {matchCase:false, matchWholeWord:true, matchWildcards:false});
    pronounResults.load('items'); await ctx.sync();
    if (pronounResults.items.length <= countBefore) return;

    const target = pronounResults.items[countBefore];
    target.font.color = colorHex; // color rojo sobre el pronombre

    // Insertar marcador antes del pronombre (pasada 1)
    const m = 'PLMs' + (this._markerIdx++) + 'PLMs';
    target.getRange('Start').insertText(m, 'Before');
    await ctx.sync();

    // Registrar para pasada 2
    this._pendingDiamonds.push({ marker:m, superscript:null, colorHex, commentText });
  }

  async _applyWordMark(ctx, body, range, finding, colorHex, commentText) {
    const corrId  = finding.correctionId;
    const keyText = this._getKeyText(finding);
    if (!keyText || keyText.length < 2) return;

    const highlight = HIGHLIGHT[corrId];

    const para = range.paragraphs.getFirst();
    let results;
    try {
      results = para.search(keyText, {matchCase:false, matchWholeWord: corrId !== 'muletillas' && corrId !== 'dequeismo', matchWildcards:false});
      results.load('items'); await ctx.sync();
    } catch(e) { return; }

    let target;
    if (results && results.items.length > 0) {
      target = results.items[0];
    } else {
      const gr = body.search(keyText, {matchCase:false, matchWholeWord:false, matchWildcards:false});
      gr.load('items'); await ctx.sync();
      if (!gr.items.length) return;
      target = gr.items[0];
    }

    if (highlight) target.font.highlightColor = highlight;

    const m = 'PLMs' + (this._markerIdx++) + 'PLMs';
    target.getRange('Start').insertText(m, 'Before');
    await ctx.sync();

    this._pendingDiamonds.push({ marker:m, superscript:null, colorHex, commentText });
  }

  async _applyBracketsMark(ctx, body, range, finding, colorHex, commentText) {
    const ms = 'PLMs' + (this._markerIdx++) + 'PLMs'; // marcador inicio
    const me = 'PLMe' + (this._markerIdx++) + 'PLMe'; // marcador fin

    // ATÓMICO: insertar ambos en la misma cola antes de cualquier sync
    // Fin primero para que la inserción del inicio no desplace la posición del fin
    range.getRange('End').insertText(me, 'After');
    range.getRange('Start').insertText(ms, 'Before');
    await ctx.sync();

    // Registrar para pasada 2
    this._pendingDiamonds.push({ marker:ms, superscript:'\u00B9', colorHex, commentText });
    this._pendingDiamonds.push({ marker:me, superscript:'\u00B2', colorHex, commentText:null });
  }

  // ── ENTRY POINT DE MARCADO ────────────────────────────────────────────────

  async _applyFinding(ctx, body, finding) {
    const corrId   = finding.correctionId;
    const colorHex = SYMBOL_COLORS[corrId] || '555555';
    const comment  = buildCommentText(finding.mergedFindings || [finding]);

    const searchText = (finding.originalText || '').replace(/[\r\n]+/g, ' ').trim();
    if (!searchText || searchText.length < 3) return;

    const sr = body.search(searchText.substring(0, 80), {matchCase:false, matchWholeWord:false, matchWildcards:false});
    sr.load('items'); await ctx.sync();

    let range;
    if (sr.items.length > 0) {
      range = sr.items[0];
    } else {
      const shorter = searchText.substring(0, 40);
      if (shorter.length < 5) return;
      const sr2 = body.search(shorter, {matchCase:false, matchWholeWord:false, matchWildcards:false});
      sr2.load('items'); await ctx.sync();
      if (!sr2.items.length) return;
      range = sr2.items[0];
    }

    if (corrId === 'leismo') {
      await this._applyPronounMark(ctx, body, range, finding, colorHex, comment);
    } else if (BRACKET_TYPES.has(corrId)) {
      await this._applyBracketsMark(ctx, body, range, finding, colorHex, comment);
    } else {
      await this._applyWordMark(ctx, body, range, finding, colorHex, comment);
    }
  }

  // ── APLICAR TODAS LAS MARCAS ───────────────────────────────────────────────

  async applyMarkings(resolvedFindings) {
    if (!resolvedFindings || !resolvedFindings.length) return;

    const ortotypoFindings = resolvedFindings.filter(f => f.directFix);
    const otherFindings    = resolvedFindings.filter(f => !f.directFix && f.originalText);

    if (ortotypoFindings.length > 0) await this.applyOrtotypography();
    if (otherFindings.length === 0)  return;

    this._markerIdx       = 0;
    this._pendingDiamonds = []; // acumula {marker, superscript, colorHex, commentText}

    // ── PASADA 1: insertar marcadores de texto ──────────────────────────────
    // Lotes de 8: solo inserciones de texto, rápidas y fiables
    const BATCH = 8;
    for (let i = 0; i < otherFindings.length; i += BATCH) {
      const batch = otherFindings.slice(i, i + BATCH);
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        for (const finding of batch) {
          try {
            await this._applyFinding(ctx, body, finding);
          } catch(e) {
            console.warn('Plumia marcador:', (finding.originalText||'').substring(0,30), e.message);
          }
        }
      });
    }

    // ── PASADA 2: reemplazar marcadores por ◆ estilizados + comentarios ─────
    // Cada marcador en su propio Word.run fresco para evitar contextos stale
    for (const pending of this._pendingDiamonds) {
      try {
        await this._replaceMarkerWithDiamond(pending, pending.colorHex, pending.commentText);
      } catch(e) {
        console.warn('Plumia reemplazo ◆:', pending.marker, e.message);
      }
    }
  }

    async highlightBrackets() {
    // Ya no se usan corchetes — vacío por compatibilidad
  }

  // ── ORTOTIPOGRAFÍA ─────────────────────────────────────────────────────────

  async applyOrtotypography() {
    await Word.run(async (ctx) => {
      const body = ctx.document.body;

      body.load('paragraphs'); await ctx.sync();
      const paras = body.paragraphs.items;
      paras.forEach(p => p.load('text')); await ctx.sync();

      let firstDashComment = false;
      let firstExclComment = false;

      // ── 1. GUIONES DE DIÁLOGO ──────────────────────────────────────────────
      for (const para of paras) {
        const text    = (para.text || '');
        const trimmed = text.trimStart();

        // Caso A: párrafo que empieza con guión → raya
        if (/^-/.test(trimmed)) {
          try {
            const sr = para.search('-', {matchCase:true, matchWholeWord:false, matchWildcards:false});
            sr.load('items'); await ctx.sync();
            if (sr.items.length > 0) {
              sr.items[0].insertText('—', 'Replace');
              sr.items[0].font.bold = true;
              if (!firstDashComment) {
                try { sr.items[0].insertComment('Ortotipografía: guión corto (-) corregido a raya de diálogo (—) en todo el documento.'); } catch(ce) {}
                firstDashComment = true;
              }
              // Guiones internos del mismo párrafo (acotaciones)
              for (let i = 1; i < sr.items.length; i++) {
                sr.items[i].insertText('—', 'Replace');
                sr.items[i].font.bold = true;
              }
            }
            await ctx.sync();
          } catch(e) {}
        }
      }

      // Caso B: guiones internos en párrafos que NO empiezan con - (ej: ¡Harto¡ -dijo)
      // Buscar patrón: espacio + guión + letra minúscula usando wildcards
      try {
        const internalSr = body.search(' -[a-zA-Z]', {matchCase:false, matchWholeWord:false, matchWildcards:true});
        internalSr.load('items'); await ctx.sync();
        for (const r of internalSr.items) {
          r.load('text'); await ctx.sync();
          const orig = r.text || '';
          // Reemplazar espacio+guión+letra por espacio+raya+letra
          if (orig.length >= 3) {
            r.insertText(' —' + orig.charAt(orig.length - 1), 'Replace');
            r.font.bold = true;
          }
        }
        await ctx.sync();
      } catch(e) { console.warn('Plumia: internal dash:', e); }

      // ── 1b. SIGNO ¡ USADO COMO CIERRE ─────────────────────────────────────
      // Detectar patrón: letra + ¡ (signo de cierre incorrecto)
      // Word no soporta regex, así que recorremos párrafos con JS
      paras.forEach(p => p.load('text')); await ctx.sync();

      for (const para of paras) {
        const text = para.text || '';
        // Buscar ¡ precedida de carácter de palabra (no de espacio/inicio)
        const match = text.match(/(\w)(¡)/);
        if (match) {
          try {
            const searchStr = match[1] + '¡'; // ej: "o¡"
            const replacement = match[1] + '!';
            const sr = para.search(searchStr, {matchCase:true, matchWholeWord:false, matchWildcards:false});
            sr.load('items'); await ctx.sync();
            for (const r of sr.items) {
              r.insertText(replacement, 'Replace');
              r.font.bold = true;
              if (!firstExclComment) {
                try { r.insertComment('Ortotipografía: signo de cierre ¡ incorrecto, corregido a !'); } catch(ce) {}
                firstExclComment = true;
              }
            }
            await ctx.sync();
          } catch(e) {}
        }
      }

      // ── 2. COMILLAS ASCII RECTAS → ESPAÑOLAS ──────────────────────────────
      try {
        const results = body.search('"', {matchCase:true, matchWholeWord:false, matchWildcards:false});
        results.load('items'); await ctx.sync();
        for (let i = 0; i < results.items.length; i++) {
          const replacement = (i % 2 === 0) ? '\u00AB' : '\u00BB'; // « »
          results.items[i].insertText(replacement, 'Replace');
          results.items[i].font.bold = true;
          if (i === 0) {
            try { results.items[i].insertComment('Ortotipografía: comillas inglesas (" ") corregidas a españolas («»). Cambio en todo el documento.'); } catch(ce) {}
          }
        }
        await ctx.sync();
      } catch(e) {}

      // Comillas tipográficas curvas → españolas
      for (const [search, repl] of [['\u201c','\u00AB'],['\u201d','\u00BB'],['\u2018','\u00AB'],['\u2019','\u00BB']]) {
        try {
          const r = body.search(search, {matchCase:true, matchWholeWord:false, matchWildcards:false});
          r.load('items'); await ctx.sync();
          for (const item of r.items) { item.insertText(repl, 'Replace'); item.font.bold = true; }
          await ctx.sync();
        } catch(e) {}
      }

      // ── 3. TRES PUNTOS → PUNTOS SUSPENSIVOS ───────────────────────────────
      try {
        const r = body.search('...', {matchCase:true, matchWholeWord:false, matchWildcards:false});
        r.load('items'); await ctx.sync();
        for (const item of r.items) { item.insertText('\u2026', 'Replace'); item.font.bold = true; }
        await ctx.sync();
      } catch(e) {}

      // ── 4. ESPACIO ANTES DE SIGNO DE PUNTUACIÓN ───────────────────────────
      for (const sign of [' ,', ' ;', ' :', ' .']) {
        try {
          const r = body.search(sign, {matchCase:true, matchWholeWord:false, matchWildcards:false});
          r.load('items'); await ctx.sync();
          for (const item of r.items) { item.insertText(sign.trim(), 'Replace'); item.font.bold = true; }
          await ctx.sync();
        } catch(e) {}
      }
    });
  }

  // ── MAPA DE PÁGINAS ────────────────────────────────────────────────────────

  async buildPageMap(findings) {
    const pageMap = {};
    const WORDS_PER_PAGE = 250;
    try {
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        body.load('paragraphs'); await ctx.sync();
        const paras = body.paragraphs.items;
        paras.forEach(p => p.load('text')); await ctx.sync();

        let wordCount = 0;
        const paraPositions = paras.map(p => {
          const words = (p.text || '').trim().split(/\s+/).filter(Boolean).length;
          const startWord = wordCount;
          wordCount += words;
          return { text: (p.text || '').trim(), startWord };
        });

        for (const f of findings) {
          const searchText = (f.originalText || '').substring(0, 60).toLowerCase();
          if (!searchText || searchText.length < 3 || pageMap[f.originalText]) continue;
          const match = paraPositions.find(p => p.text.toLowerCase().includes(searchText));
          if (match) pageMap[f.originalText] = Math.max(1, Math.ceil((match.startWord + 1) / WORDS_PER_PAGE));
        }
      });
    } catch(e) {}
    return pageMap;
  }

  // ── INFORME DE ESTADÍSTICAS ────────────────────────────────────────────────

  async appendStatsReport(allResults, pageMap = {}) {
    const total = allResults.reduce((s,r) => s + r.findings.length, 0);
    if (total === 0) return;

    await Word.run(async (ctx) => {
      const body = ctx.document.body;
      body.insertBreak('Page', 'End');

      const title = body.insertParagraph('INFORME DE INCIDENCIAS \u2014 PLUMIA', 'End');
      title.font.bold = true;
      title.font.size = 28;
      title.font.color = '1a1a2e';
      await ctx.sync(); // cortar herencia de tamaño

      // Párrafo reset después del título para cortar herencia de 28pt
      const rp0 = body.insertParagraph('', 'End');
      rp0.font.size = 22; rp0.font.bold = false;

      const h2a = body.insertParagraph('Resumen por categor\u00EDa', 'End');
      h2a.font.bold = true; h2a.font.size = 24; h2a.font.color = '1a1a2e';
      for (const result of allResults) {
        if (!result.findings.length) continue;
        const bp = body.insertParagraph(
          `\u2022 ${result.label}: ${result.findings.length} incidencia${result.findings.length!==1?'s':''}`,
          'End'
        );
        bp.font.size = 22; bp.font.bold = false; bp.font.color = '222222';
      }
      const totalPara = body.insertParagraph(`Total: ${total} incidencias detectadas`, 'End');
      totalPara.font.bold = true; totalPara.font.size = 22; totalPara.font.color = '1a1a2e';

      const rp1 = body.insertParagraph('', 'End');
      rp1.font.size = 22; rp1.font.bold = false;
      const h2b = body.insertParagraph('Detalle por categor\u00EDa', 'End');
      h2b.font.bold = true; h2b.font.size = 24; h2b.font.color = '1a1a2e';

      for (const result of allResults) {
        if (!result.findings.length) continue;
        const catTitle = body.insertParagraph(
          `${result.label}  (${result.findings.length} incidencia${result.findings.length!==1?'s':''})`, 'End'
        );
        catTitle.font.bold = true; catTitle.font.size = 22; catTitle.font.color = '0f3460';

        for (let i = 0; i < result.findings.length; i++) {
          const f = result.findings[i];
          let rawText = f.originalText || '';
          if (!rawText) {
            if (f.occurrences?.[0]) rawText = f.occurrences[0];
            else if (f.occurrence1?.text) rawText = f.occurrence1.text;
            else if (f.occurrence?.text)  rawText = f.occurrence.text;
          }
          rawText = rawText.replace(/[\r\n]+/g, ' ').trim();
          const preview = rawText
            ? `\u00AB${rawText.substring(0,100)}${rawText.length>100?'\u2026':''}\u00BB`
            : '(sin texto de referencia)';

          const pageNum   = pageMap[f.originalText];
          const pageSuffix = pageNum ? `  \u2014 p\u00E1g. ${pageNum}` : '';

          const numPara = body.insertParagraph(`${i+1}.  ${preview}${pageSuffix}`, 'End');
          numPara.font.bold   = true;
          numPara.font.size   = 22;
          numPara.font.italic = false;
          numPara.font.color  = '0f3460';

          const comment = buildCommentText([f]);
          if (comment) {
            const comPara = body.insertParagraph(comment.replace(/[\r\n]+/g, '\n').substring(0, 600), 'End');
            comPara.font.size   = 20;
            comPara.font.italic = false;
            comPara.font.bold   = false;
            comPara.font.color  = '0f3460';
          }
          // Reset para cortar herencia de tamaño al siguiente párrafo
          const sep = body.insertParagraph('', 'End');
          sep.font.size = 20; sep.font.bold = false;
        }
        body.insertParagraph('', 'End');
      }

      await ctx.sync();
    });
  }

  // ── BUILD OUTPUT ───────────────────────────────────────────────────────────

  async buildOutput(allResults, resolvedFindings, originalName, selectedIds) {
    const revisionName = await this.getRevisionName(originalName);
    const statsName    = this.getStatsName(revisionName);

    const allFindings = allResults.flatMap(r => r.findings);
    const pageMap     = await this.buildPageMap(allFindings);

    if (this.outputMode === 'marked') {
      await this.applyMarkings(resolvedFindings);
      await this.highlightBrackets();
      await this.appendStatsReport(allResults, pageMap);
      return { mode:'marked', revisionName, statsName, totalFindings:resolvedFindings.length };
    } else {
      await this.appendStatsReport(allResults, pageMap);
      return { mode:'report', revisionName, statsName,
        totalFindings: allResults.reduce((s,r) => s+r.findings.length, 0) };
    }
  }

  // Normaliza todos los findings para que tengan originalText consistente
  normalizeFindings(allResults) {
    return allResults.map(result => ({
      ...result,
      findings: result.findings.map(f => {
        let text = f.originalText || '';
        if (!text) {
          if (f.occurrences?.[0])       text = f.occurrences[0];
          else if (f.occurrence1?.text) text = f.occurrence1.text;
          else if (f.occurrence?.text)  text = f.occurrence.text;
          else if (f.frase)             text = f.frase;
        }
        text = text.replace(/[\r\n]+/g, ' ').trim();
        if (text.length > 100) {
          const cut = text.substring(0, 100);
          const lastSpace = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf(','), cut.lastIndexOf('.'));
          text = lastSpace > 60 ? cut.substring(0, lastSpace).trimEnd() : cut;
        }
        return { ...f, originalText: text };
      })
    }));
  }
}

})();
