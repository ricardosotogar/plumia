// ============================================================================
// PLUMIA — document-builder.js  v8.00
// FIX CRÍTICO: insertComment() falla con InvalidArgument sobre rangos
// devueltos por insertText(). Solución: tras insertar ◆ y hacer sync,
// buscar el ◆ con search() y llamar insertComment sobre el resultado.
//
// Patrón de cada finding (3 syncs):
//   Sync 1: insertar ◆ + estilizar
//   Sync 2: buscar ◆ con search() → obtener rango válido
//   Sync 3: insertComment sobre el rango de search() → confirmar
// ============================================================================
(function() {

window.PLUMIA.BUILDER_VERSION = '8.00';
console.log('📦 document-builder.js v8.00 cargado');

const SYMBOL_COLORS = {
  'leismo':                'FF0000',
  'adverbios_mente':       '2E7D00',
  'numeros_letras':        'B8860B',
  'repeticion_lexica':     'B8860B',
  'verbos_comedin':        'CC5500',
  'sustantivos_genericos': 'CC5500',
  'muletillas':            'CC5500',
  'pleonasmos':            'CC5500',
  'voz_pasiva':            '0097C8',
  'tiempos_verbales':      '0055A0',
  'nombres_propios':       '0055A0',
  'gerundios':             '0055A0',
  'aun_tilde':             '0055A0',
  'si_tilde':              '0055A0',
  'dequeismo':             '0055A0',
  'frases_largas':         'C0006A',
  'puntuacion_dialogo':    'C0006A',
  'ritmo_narrativo':       'C0006A',
  'concordancia':          'C0006A',
  'ambiguedad_pronominal': '5020A0',
  'coherencia_personajes': '6B2197',
  'coherencia_temporal':   '6B2197',
  'coherencia_objetos':    '6B2197',
  'coherencia_conocimiento':'6B2197',
  'tono_voz':              '6B2197',
  'nombres_inconsistentes':'6B2197',
  'pov':                   '6B2197',
};

const HIGHLIGHT = {
  'adverbios_mente':       'Green',
  'numeros_letras':        'Yellow',
  'repeticion_lexica':     'Yellow',
  'verbos_comedin':        'Orange',
  'sustantivos_genericos': 'Orange',
  'muletillas':            'Orange',
  'pleonasmos':            'Orange',
  'nombres_propios':       'Blue',
  'gerundios':             'Blue',
  'aun_tilde':             'Blue',
  'si_tilde':              'Blue',
  'dequeismo':             'Blue',
  'concordancia':          'Pink',
};

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
};
const buildCommentText = window.PLUMIA.buildCommentText;

function _singleComment(f) {
  switch(f.correctionId) {
    case 'leismo': case 'laismo': case 'loismo':
      return `${f.label||'Leísmo'}: la forma correcta es «${f.correction}».`;
    case 'ambiguedad_pronominal':
      return `Ambigüedad pronominal: «${f.pronoun}» puede referirse a ${(f.possibleReferents||[]).join(' o ')}. ${f.suggestion?'Posible revisión: '+f.suggestion:''}`;
    case 'repeticion_lexica':
      return `Repetición léxica: «${f.word}» aparece varias veces cerca. ${f.synonyms?.length?'Sinónimos: '+f.synonyms.join(', ')+'.':''}`;
    case 'verbos_comedin':
      return `Verbo comodín «${f.verb}»: ${f.explanation||''} ${(f.alternatives||[]).length?'Alternativas: '+(f.alternatives||[]).join(', ')+'.':''}`;
    case 'sustantivos_genericos':
      return `Sustantivo genérico «${f.genericWord}»: ${f.explanation||''} ${(f.alternatives||[]).length?'Alternativas: '+(f.alternatives||[]).join(', ')+'.':''}`;
    case 'muletillas':
      return `Muletilla «${f.expression}»: puede no estar aportando nada al texto. ${(f.alternatives||[]).filter(a=>a!=='eliminar').length?'Alternativas: '+(f.alternatives||[]).filter(a=>a!=='eliminar').join(', ')+'.':'Valora eliminarla.'}`;
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
    case 'numeros_letras':
      return f.isStartOfSentence
        ? `Número al inicio de frase: «${f.numStr}» debe escribirse con letras en texto literario → «${f.correctForm}».`
        : `Número en texto literario: «${f.numStr}» puede escribirse con letras → «${f.correctForm}». ${f.explanation||''}`;
    case 'aun_tilde': {
      const label = f.errorType === 'falta_tilde' ? 'Falta tilde' : 'Tilde sobrante';
      return `Tilde diacrítica (${label}): ${f.explanation||''} Forma sugerida: «${f.correctForm||''}».`;
    }
    case 'si_tilde': {
      const fn = f.function || '';
      const fnLabel = fn === 'adverbio_afirmacion'     ? 'adverbio de afirmación'
                    : fn === 'pronombre_reflexivo'      ? 'pronombre personal reflexivo'
                    : fn === 'sustantivo'               ? 'sustantivo (aprobación)'
                    : fn === 'condicional'              ? 'conjunción condicional'
                    : fn === 'interrogativa_indirecta'  ? 'interrogativa indirecta'
                    : fn;
      return `Tilde diacrítica: «${f.siForm||f.originalText}» debe escribirse «${f.correctForm||''}» (${fnLabel}). ${f.explanation||''}`;
    }
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
    default: {
      let c = `COHERENCIA — ${f.label||'Coherencia narrativa'}:\n`;
      if (f.occurrence1) c += `· ${f.occurrence1.location||'Primera mención'}: «${f.occurrence1.text}»\n`;
      if (f.occurrence2) c += `· ${f.occurrence2.location||'Segunda mención'}: «${f.occurrence2.text}»\n`;
      return (c + (f.explanation||'')).trim();
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

// Solo inserta el símbolo como texto — SIN operaciones de font.
// MOTIVO: Word JS API rechaza (InvalidArgument en ctx.sync) cualquier operación
// de font sobre rangos devueltos por insertText(). El estilizado se hace DESPUÉS
// del sync, sobre el rango devuelto por body.search(), en _styleAndComment().
function _insertSymbol(anchor, where, symbol) {
  anchor.insertText(symbol, where);
}

// Busca `searchPattern` en el body (toma el último resultado = el más reciente),
// aplica estilizado de font Y añade comentario sobre ese rango de search().
// Los rangos de search() SÍ aceptan font ops e insertComment sin InvalidArgument.
async function _styleAndComment(ctx, body, searchPattern, colorHex, commentText) {
  if (!searchPattern) return;
  try {
    const sr = body.search(searchPattern, {matchCase:true, matchWholeWord:false, matchWildcards:false});
    sr.load('items');
    await ctx.sync();
    console.log('[styleAndComment] search("' + searchPattern + '") → ' + sr.items.length + ' resultado(s)');
    if (!sr.items.length) {
      console.warn('[styleAndComment] ⚠ 0 resultados — símbolo no estilizado ni comentado');
      return;
    }
    const target = sr.items[sr.items.length - 1]; // último = más recientemente insertado
    // Buscar solo el ◆ DENTRO del rango → el estilado no afecta a la palabra adyacente
    const symSr = target.search('\u25C6', {matchCase:true, matchWholeWord:false, matchWildcards:false});
    symSr.load('items');
    await ctx.sync();
    if (symSr.items.length) {
      symSr.items[0].font.color = colorHex;
      symSr.items[0].font.bold  = true;
      if (commentText) symSr.items[0].insertComment(commentText.replace(/[\r\n]+/g, ' | ').substring(0, 400));
    }
    await ctx.sync();
    console.log('[styleAndComment] ✅ font + comentario OK sobre "' + searchPattern + '"');
  } catch(e) {
    console.warn('[styleAndComment] ❌ excepción:', e.message);
  }
}


// ── DOCUMENTBUILDER ───────────────────────────────────────────────────────────
window.PLUMIA.DocumentBuilder = class DocumentBuilder {
  constructor(outputMode) {
    this.outputMode = outputMode;
  }

  async getRevisionName(n) { return n.replace(/\s*REVISION\s*/i,'').trim() + ' REVISION'; }
  getStatsName(n)          { return n.replace('REVISION','ESTADISTICAS'); }

  _extractPronoun(f) {
    const origW = (f.originalText||'').split(/\s+/);
    const corrW = (f.correction   ||'').split(/\s+/);
    for (let i=0; i<origW.length && i<corrW.length; i++) {
      if (origW[i].toLowerCase() !== corrW[i].toLowerCase()) return origW[i];
    }
    const m = (f.originalText||'').match(/\b(la|le|lo|las|les|los)\b/i);
    return m ? m[1] : null;
  }

  _getKeyText(f) {
    switch(f.correctionId) {
      case 'numeros_letras':        return f.numStr || f.originalText;
      case 'adverbios_mente':       return ((f.adverbs||[]).concat([f.adverb]).filter(Boolean))[0] || f.originalText;
      case 'repeticion_lexica':     return (f.occurrences?.[0]) || f.word || f.originalText;
      case 'verbos_comedin':        return f.verb || f.originalText;
      case 'sustantivos_genericos': return f.genericWord || f.originalText;
      case 'muletillas':            return f.expression || f.originalText;
      case 'pleonasmos': {
        const orig = (f.originalText||'').split(/\s+/);
        const corr = (f.correction  ||'').split(/\s+/);
        return orig.find(w => !corr.some(c=>c.toLowerCase()===w.toLowerCase())) || f.originalText;
      }
      case 'nombres_propios':  return f.name || f.originalText;
      case 'gerundios':        return f.gerund || f.originalText;
      case 'dequeismo':        return f.errorType==='dequeismo' ? 'de que' : (f.originalText||'').split(/\s+/).slice(0,3).join(' ');
      case 'concordancia':     return (f.originalText||'').split(/\s+/).slice(0,2).join(' ');
      default:                 return f.originalText;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASADA ÚNICA — Cada método sigue el patrón:
  //   Fase 1: insertar ◆ + estilizar → sync (funciona, probado)
  //   Fase 2: buscar ◆ con search() → insertComment → sync
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Pronombre (leísmo) ───────────────────────────────────────────────────
  async _markPronoun(ctx, body, range, finding, colorHex, commentText) {
    const pronoun = this._extractPronoun(finding);
    if (!pronoun) {
      await this._markWord(ctx, body, range, finding, colorHex, commentText);
      return;
    }

    const para = range.paragraphs.getFirst();
    para.load('text'); await ctx.sync();
    const paraText  = para.text || '';
    const origLower = (finding.originalText||'').toLowerCase();
    const pLower    = pronoun.toLowerCase();
    const origPos   = paraText.toLowerCase().indexOf(origLower);

    let target;
    if (origPos === -1) {
      const psr2 = para.search(pronoun, {matchCase:false,matchWholeWord:true,matchWildcards:false});
      psr2.load('items'); await ctx.sync();
      if (!psr2.items.length) return;
      target = psr2.items[0];
    } else {
      const pInOrig = origLower.indexOf(pLower);
      const absPos  = origPos + pInOrig;
      const before  = paraText.substring(0, absPos);
      const nBefore = (before.match(new RegExp('\\b'+pLower+'\\b','gi'))||[]).length;
      const psr = para.search(pronoun, {matchCase:false,matchWholeWord:true,matchWildcards:false});
      psr.load('items'); await ctx.sync();
      if (!psr.items.length) return;
      target = psr.items[Math.min(nBefore, psr.items.length-1)];
    }

    // Fase 1: solo insertar ◆ (sin font ops — ver comentario en _insertSymbol)
    _insertSymbol(target.getRange('Start'), 'Before', '\u25C6');
    await ctx.sync();

    // Fase 2: buscar ◆+pronombre → aplicar font + comentario sobre rango de search()
    await _styleAndComment(ctx, body, '\u25C6' + pronoun, colorHex, commentText);
  }

  // ── Palabra clave ────────────────────────────────────────────────────────
  async _markWord(ctx, body, range, finding, colorHex, commentText) {
    const corrId  = finding.correctionId;
    const keyText = this._getKeyText(finding);
    if (!keyText || keyText.length < 2) return;

    const hl   = HIGHLIGHT[corrId];
    const para = range.paragraphs.getFirst();
    let items;
    try {
      const sr = para.search(keyText, {matchCase:false, matchWholeWord: corrId!=='muletillas'&&corrId!=='dequeismo', matchWildcards:false});
      sr.load('items'); await ctx.sync();
      items = sr.items;
    } catch(e) { items = []; }

    if (!items.length) {
      const sr2 = body.search(keyText, {matchCase:false,matchWholeWord:false,matchWildcards:false});
      sr2.load('items'); await ctx.sync();
      items = sr2.items;
    }
    if (!items.length) return;

    const target = items[0];

    // Fase 1: highlight sobre rango existente (OK) + solo insertar ◆
    if (hl) target.font.highlightColor = hl;
    _insertSymbol(target.getRange('Start'), 'Before', '\u25C6');
    await ctx.sync();

    // Fase 2: buscar ◆+primera_palabra → font + comentario
    const firstWord = keyText.split(/\s+/)[0] || keyText;
    await _styleAndComment(ctx, body, '\u25C6' + firstWord, colorHex, commentText);
  }

  // ── Brackets ─────────────────────────────────────────────────────────────
  async _markBrackets(ctx, body, range, finding, colorHex, commentText) {
    // Fase 1: insertar ◆² al final y ◆¹ al inicio — sin font ops
    range.getRange('End').insertText('\u25C6\u00B2', 'After');
    range.getRange('Start').insertText('\u25C6\u00B9', 'Before');
    await ctx.sync();

    // Fase 2: buscar ◆¹ → font + comentario
    await _styleAndComment(ctx, body, '\u25C6\u00B9', colorHex, commentText);
    // Fase 3: buscar ◆² → solo font (sin comentario duplicado)
    await _styleAndComment(ctx, body, '\u25C6\u00B2', colorHex, null);
  }

  // ── Aplicar un finding individual ─────────────────────────────────────────
  async _applyFinding(ctx, body, finding) {
    const corrId   = finding.correctionId;
    const colorHex = SYMBOL_COLORS[corrId] || '555555';
    const comment  = buildCommentText(finding.mergedFindings || [finding]);
    let search = (finding.originalText||'').replace(/[\r\n]+/g,' ').trim();
    if (!search || search.length < 3) return;

    if (search.length >= 70) {
      const cut = search.substring(0, 70);
      const lastSpace = cut.lastIndexOf(' ');
      search = lastSpace > 25 ? cut.substring(0, lastSpace).trimEnd() : cut;
    }

    const sr = body.search(search, {matchCase:false,matchWholeWord:false,matchWildcards:false});
    sr.load('items'); await ctx.sync();
    let range;
    if (sr.items.length) {
      range = sr.items[0];
    } else {
      let shorter = search.substring(0, 40);
      if (shorter.length < 5) return;
      const lastSp = shorter.lastIndexOf(' ');
      if (lastSp > 15) shorter = shorter.substring(0, lastSp).trimEnd();
      const sr2 = body.search(shorter, {matchCase:false,matchWholeWord:false,matchWildcards:false});
      sr2.load('items'); await ctx.sync();
      if (!sr2.items.length) return;
      range = sr2.items[0];
    }

    if (corrId === 'leismo')            await this._markPronoun (ctx, body, range, finding, colorHex, comment);
    else if (BRACKET_TYPES.has(corrId)) await this._markBrackets(ctx, body, range, finding, colorHex, comment);
    else                                await this._markWord    (ctx, body, range, finding, colorHex, comment);
  }

  // ── APPLY MARKINGS ────────────────────────────────────────────────────────
  async applyMarkings(resolvedFindings) {
    if (!resolvedFindings || !resolvedFindings.length) return;

    const ortotypo = resolvedFindings.filter(f => f.directFix);
    const others   = resolvedFindings.filter(f => !f.directFix && f.originalText);

    if (ortotypo.length) await this.applyOrtotypography();
    if (!others.length)  return;

    for (let i = 0; i < others.length; i++) {
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        try { await this._applyFinding(ctx, body, others[i]); }
        catch(e) { console.warn('Plumia v8.00 mark:', (others[i].originalText||'').substring(0,30), e.message); }
      });
    }
  }

  async highlightBrackets() { /* vacío */ }

  // ── ORTOTIPOGRAFÍA ────────────────────────────────────────────────────────
  async applyOrtotypography() {
    await Word.run(async (ctx) => {
      const body = ctx.document.body;
      body.load('paragraphs'); await ctx.sync();
      const paras = body.paragraphs.items;
      paras.forEach(p => p.load('text')); await ctx.sync();

      let firstDashDone = false;
      let firstExclDone = false;

      for (const para of paras) {
        const trimmed = (para.text||'').trimStart();
        if (/^-/.test(trimmed)) {
          try {
            const sr = para.search('-', {matchCase:true,matchWholeWord:false,matchWildcards:false});
            sr.load('items'); await ctx.sync();
            if (sr.items.length) {
              sr.items[0].insertText('\u2014','Replace'); sr.items[0].font.bold=true;
              if (!firstDashDone) {
                try { sr.items[0].insertComment('Ortotipograf\u00EDa: gui\u00F3n corto (-) corregido a raya (\u2014) en todo el documento.'); } catch(e){}
                firstDashDone = true;
              }
              for (let i=1;i<sr.items.length;i++) { sr.items[i].insertText('\u2014','Replace'); sr.items[i].font.bold=true; }
            }
            await ctx.sync();
          } catch(e) {}
        }
      }

      try {
        const isr = body.search(' -[a-zA-Z]', {matchCase:false,matchWholeWord:false,matchWildcards:true});
        isr.load('items'); await ctx.sync();
        for (const r of isr.items) {
          r.load('text'); await ctx.sync();
          const t = r.text||'';
          if (t.length>=3) { r.insertText(' \u2014'+t.charAt(t.length-1),'Replace'); r.font.bold=true; }
        }
        await ctx.sync();
      } catch(e) {}

      paras.forEach(p=>p.load('text')); await ctx.sync();
      for (const para of paras) {
        const m = (para.text||'').match(/(\w)(\u00A1)/);
        if (m) {
          try {
            const sr = para.search(m[1]+'\u00A1', {matchCase:true,matchWholeWord:false,matchWildcards:false});
            sr.load('items'); await ctx.sync();
            for (const r of sr.items) {
              r.insertText(m[1]+'!','Replace'); r.font.bold=true;
              if (!firstExclDone) {
                try { r.insertComment('Ortotipograf\u00EDa: signo de cierre \u00A1 corregido a !'); } catch(e){}
                firstExclDone=true;
              }
            }
            await ctx.sync();
          } catch(e) {}
        }
      }

      try {
        const qr = body.search('"', {matchCase:true,matchWholeWord:false,matchWildcards:false});
        qr.load('items'); await ctx.sync();
        for (let i=0;i<qr.items.length;i++) {
          qr.items[i].insertText(i%2===0?'\u00AB':'\u00BB','Replace'); qr.items[i].font.bold=true;
          if (i===0) { try { qr.items[i].insertComment('Ortotipograf\u00EDa: comillas inglesas corregidas a \u00AB\u00BB'); } catch(e){} }
        }
        await ctx.sync();
      } catch(e) {}

      for (const [s,r] of [['\u201c','\u00AB'],['\u201d','\u00BB'],['\u2018','\u00AB'],['\u2019','\u00BB']]) {
        try {
          const sr = body.search(s,{matchCase:true,matchWholeWord:false,matchWildcards:false});
          sr.load('items'); await ctx.sync();
          for (const item of sr.items) { item.insertText(r,'Replace'); item.font.bold=true; }
          await ctx.sync();
        } catch(e) {}
      }

      try {
        const dr = body.search('...',{matchCase:true,matchWholeWord:false,matchWildcards:false});
        dr.load('items'); await ctx.sync();
        for (const item of dr.items) { item.insertText('\u2026','Replace'); item.font.bold=true; }
        await ctx.sync();
      } catch(e) {}

      for (const sign of [' ,', ' ;', ' :', ' .']) {
        try {
          const sr = body.search(sign,{matchCase:true,matchWholeWord:false,matchWildcards:false});
          sr.load('items'); await ctx.sync();
          for (const item of sr.items) { item.insertText(sign.trim(),'Replace'); item.font.bold=true; }
          await ctx.sync();
        } catch(e) {}
      }

      // ── REGLAS DOS PUNTOS ────────────────────────────────────────────────────
      // Regla 1: añadir espacio tras ':' cuando falta (excluye dígitos y URLs)
      // Regla 4: comentar mayúscula inmediata tras ': ' (sin corrección automática)
      // Orden: Pasada 1 = Regla 4 sobre texto existente → Pasada 2 = Regla 1
      // Así ':Ana' (falta espacio + mayúscula) recibe solo el comentario combinado
      // y no se duplica con el comentario de Regla 4.
      try {
        const COMMENT_R1    = 'Ortotipografía: se han detectado dos puntos sin espacio posterior. Se ha añadido el espacio en todo el documento. Tras los dos puntos siempre debe ir un espacio antes del texto siguiente.';
        const COMMENT_R1_R4 = 'Ortotipografía: dos puntos sin espacio posterior corregidos en todo el documento. Además, la norma general es usar minúscula tras dos puntos (salvo citas textuales, saludos epistolares o listas formales estructuradas). Revise si corresponde cambiar a minúscula.';
        const COMMENT_R4    = 'Ortotipografía: la norma general en español es escribir en minúscula tras dos puntos. Solo se usa mayúscula en citas textuales, saludos epistolares o listas formales estructuradas. Revise si corresponde cambiar a minúscula.';

        body.load('paragraphs'); await ctx.sync();
        const dpParas = body.paragraphs.items;
        dpParas.forEach(p => p.load('text')); await ctx.sync();

        // ── PASADA 1: Regla 4 — comentar ': [A-Z]' ya existentes en el texto ──
        for (const para of dpParas) {
          const pt = para.text || '';
          const r4seqs = new Set();
          for (let i = 0; i < pt.length - 2; i++) {
            if (pt[i] === ':' && pt[i+1] === ' ' && /[A-ZÁÉÍÓÚÜÑ]/.test(pt[i+2]))
              r4seqs.add(': ' + pt[i+2]);
          }
          for (const seq of r4seqs) {
            try {
              const sr = para.search(seq, {matchCase:true,matchWholeWord:false,matchWildcards:false});
              sr.load('items'); await ctx.sync();
              for (const item of sr.items) { try { item.insertComment(COMMENT_R4); } catch(e){} }
              await ctx.sync();
            } catch(e) {}
          }
        }

        // ── PASADA 2: Regla 1 — añadir espacio en ':X' (sin espacio tras ':') ──
        dpParas.forEach(p => p.load('text')); await ctx.sync();
        let firstR1Done = false;
        for (const para of dpParas) {
          const pt = para.text || '';
          if (!pt.includes(':')) continue;
          const r1actions = {}; // seq → isUppercase
          for (let i = 0; i < pt.length - 1; i++) {
            if (pt[i] !== ':') continue;
            const prev = i > 0 ? pt[i-1] : '';
            const next = pt[i+1];
            if (/\d/.test(prev) || /[\s:\/\d]/.test(next)) continue; // excluir dígitos, URLs, ya espaciados
            r1actions[':' + next] = /[A-ZÁÉÍÓÚÜÑ]/.test(next);
          }
          for (const [seq, isUpper] of Object.entries(r1actions)) {
            try {
              const sr = para.search(seq, {matchCase:true,matchWholeWord:false,matchWildcards:false});
              sr.load('items'); await ctx.sync();
              for (const item of sr.items) {
                item.insertText(': ' + seq.charAt(1), 'Replace');
                if (!firstR1Done) {
                  try { item.insertComment(isUpper ? COMMENT_R1_R4 : COMMENT_R1); } catch(e) {}
                  firstR1Done = true;
                } else if (isUpper) {
                  // No es la primera corrección de espacio, pero hay mayúscula → aviso Regla 4
                  try { item.insertComment(COMMENT_R4); } catch(e) {}
                }
              }
              await ctx.sync();
            } catch(e) {}
          }
        }
      } catch(e) { console.warn('[ortotypo] dos_puntos:', e.message); }
    });
  }

  // ── MAPA DE PÁGINAS ───────────────────────────────────────────────────────
  async buildPageMap(findings) {
    const pageMap = {};
    const WPP = 250;
    try {
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        body.load('paragraphs'); await ctx.sync();
        const paras = body.paragraphs.items;
        paras.forEach(p=>p.load('text')); await ctx.sync();
        let wc = 0;
        const positions = paras.map(p => {
          const words = (p.text||'').trim().split(/\s+/).filter(Boolean).length;
          const start = wc; wc += words;
          return {text:(p.text||'').trim(), start};
        });
        for (const f of findings) {
          const st = (f.originalText||'').substring(0,60).toLowerCase();
          if (!st || st.length<3 || pageMap[f.originalText]) continue;
          const match = positions.find(p=>p.text.toLowerCase().includes(st));
          if (match) pageMap[f.originalText] = Math.max(1, Math.ceil((match.start+1)/WPP));
        }
      });
    } catch(e) {}
    return pageMap;
  }

  // ── INFORME DE ESTADÍSTICAS ───────────────────────────────────────────────
  async appendStatsReport(allResults, pageMap={}) {
    const total = allResults.reduce((s,r)=>s+r.findings.length,0);
    if (!total) return;

    await Word.run(async (ctx) => {
      const body = ctx.document.body;
      body.insertBreak('Page','End');

      const title = body.insertParagraph('INFORME DE INCIDENCIAS \u2014 PLUMIA','End');
      title.font.bold=true; title.font.size=14; title.font.color='1a1a2e';
      await ctx.sync();

      const rp0 = body.insertParagraph('','End'); rp0.font.size=12; rp0.font.bold=false;
      const h2a = body.insertParagraph('Resumen por categor\u00EDa','End'); h2a.font.bold=true; h2a.font.size=13; h2a.font.color='1a1a2e';

      for (const result of allResults) {
        if (!result.findings.length) continue;
        const bp = body.insertParagraph(`\u2022 ${result.label}: ${result.findings.length} incidencia${result.findings.length!==1?'s':''}`, 'End'); bp.font.size=12; bp.font.bold=false; bp.font.color='222222';
      }

      const tp = body.insertParagraph(`Total: ${total} incidencias detectadas`,'End'); tp.font.bold=true; tp.font.size=12; tp.font.color='1a1a2e';
      await ctx.sync();

      const rp1 = body.insertParagraph('','End'); rp1.font.size=12; rp1.font.bold=false;
      const h2b = body.insertParagraph('Detalle por categor\u00EDa','End'); h2b.font.bold=true; h2b.font.size=13; h2b.font.color='1a1a2e';

      for (const result of allResults) {
        if (!result.findings.length) continue;
        const ct = body.insertParagraph(`${result.label}  (${result.findings.length} incidencia${result.findings.length!==1?'s':''})`, 'End'); ct.font.bold=true; ct.font.size=13; ct.font.color='0f3460';

        for (let i=0; i<result.findings.length; i++) {
          const f = result.findings[i];
          let raw = f.originalText||'';
          if (!raw) {
            if (f.occurrences?.[0]) raw=f.occurrences[0];
            else if (f.occurrence1?.text) raw=f.occurrence1.text;
            else if (f.occurrence?.text)  raw=f.occurrence.text;
          }
          raw = raw.replace(/[\r\n]+/g,' ').trim();
          const preview = raw ? `\u00AB${raw.substring(0,100)}${raw.length>100?'\u2026':''}\u00BB` : '(sin texto)';
          const page    = pageMap[f.originalText];
          const suffix  = page ? `  \u2014 p\u00E1g. ${page}` : '';

          const np = body.insertParagraph(`${i+1}.  ${preview}${suffix}`,'End'); np.font.bold=true; np.font.size=12; np.font.italic=false; np.font.color='0f3460';

          const comment = buildCommentText([f]);
          if (comment) {
            const cp = body.insertParagraph(comment.replace(/[\r\n]+/g,'\n').substring(0,600),'End'); cp.font.size=11; cp.font.italic=false; cp.font.bold=false; cp.font.color='333333';
          }
          const sep = body.insertParagraph('','End'); sep.font.size=11; sep.font.bold=false;
        }

        const gap = body.insertParagraph('','End'); gap.font.size=12; gap.font.bold=false;
      }

      await ctx.sync();
    });
  }

  // ── BUILD OUTPUT ──────────────────────────────────────────────────────────
  async buildOutput(allResults, resolvedFindings, originalName, selectedIds) {
    const revisionName = await this.getRevisionName(originalName);
    const statsName    = this.getStatsName(revisionName);
    const allFindings  = allResults.flatMap(r=>r.findings);
    const pageMap      = await this.buildPageMap(allFindings);

    if (this.outputMode === 'marked') {
      await this.applyMarkings(resolvedFindings);
      await this.highlightBrackets();
      await this.appendStatsReport(allResults, pageMap);
      return {mode:'marked', revisionName, statsName, totalFindings:resolvedFindings.length};
    } else {
      await this.appendStatsReport(allResults, pageMap);
      return {mode:'report', revisionName, statsName, totalFindings:allResults.reduce((s,r)=>s+r.findings.length,0)};
    }
  }

  normalizeFindings(allResults) {
    return allResults.map(result => ({
      ...result,
      findings: result.findings.map(f => {
        let text = f.originalText||'';
        if (!text) {
          if (f.occurrences?.[0])       text=f.occurrences[0];
          else if (f.occurrence1?.text) text=f.occurrence1.text;
          else if (f.occurrence?.text)  text=f.occurrence.text;
          else if (f.frase)             text=f.frase;
        }
        text = text.replace(/[\r\n]+/g,' ').trim();
        if (text.length > 75) {
          const cut = text.substring(0, 75);
          const ls = cut.lastIndexOf(' ');
          text = ls > 30 ? cut.substring(0, ls).trimEnd() : cut;
        }
        return {...f, originalText:text};
      })
    }));
  }
};

})();
