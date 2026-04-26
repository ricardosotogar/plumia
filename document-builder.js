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

window.PLUMIA.BUILDER_VERSION = '9.33';
console.log('📦 document-builder.js v10.01 cargado');

// ── Flag global de debug ──────────────────────────────────────────────────────
// Para activar logs: window.PLUMIA_DEBUG = true  (en la consola del navegador)
// Para desactivar:  window.PLUMIA_DEBUG = false
if (typeof window.PLUMIA_DEBUG === 'undefined') window.PLUMIA_DEBUG = false;
const dbg = (...args) => { if (window.PLUMIA_DEBUG) console.log('[PLUMIA]', ...args); };

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
  'interrogativas_tilde':  '0055A0',
  'tu_tilde':              '0055A0',
  'mi_tilde':              '0055A0',
  'aun_tilde':             '0055A0',
  'si_tilde':              '0055A0',
  'dequeismo':             '0055A0',
  'frases_largas':         'C0006A',
  'puntuacion_dialogo':    'C0006A',
  'ritmo_narrativo':       'C0006A',
  'concordancia':          'FF69B4',
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
  'interrogativas_tilde':  'Blue',
  'tu_tilde':              'Blue',
  'mi_tilde':              'Blue',
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
  // Deduplicar: si varios findings tienen la misma wordForm→correctForm
  // (p.ej. detección local + API de «mi»→«mí»), eliminar duplicados.
  // También deduplicar por correction/explanation para hallazgos de puntuación
  // que no usan wordForm pero pueden ser detectados por dos reglas distintas.
  const seenKey = new Set();
  const seenCorrection = new Set();
  const unique = mergedFindings.filter(f => {
    const w = (f.miForm || f.siForm || f.tuForm || f.aunForm || f.wordForm || f.verb || '').toLowerCase().trim();
    const c = (f.correctForm || '').toLowerCase().trim();
    const k = `${f.correctionId}|${w}|${c}`;
    if (seenKey.has(k)) return false;
    seenKey.add(k);
    // Para findings sin wordForm (puntuación, etc.), deduplicar por correction
    if (!w && !c) {
      const corrText = (f.correction || '').toLowerCase().trim().substring(0, 60);
      if (corrText && seenCorrection.has(corrText)) return false;
      if (corrText) seenCorrection.add(corrText);
    }
    return true;
  });
  if (unique.length === 1) return _singleComment(unique[0]);
  return unique.map((f,i) => `${i+1}) ${_singleComment(f)}`).join('\n');
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
    case 'muletillas': {
      const known = window.PLUMIA._knownMuletillas || new Set();
      const alts = (f.alternatives || []).filter(a => {
        const aLow = (a || '').toLowerCase().trim();
        return aLow && aLow !== 'eliminar' && !known.has(aLow);
      });
      const altStr = alts.length ? ` Alternativas: ${alts.join(', ')}.` : '';
      return `Muletilla «${f.expression}»: ${f.explanation||'puede no estar aportando nada al texto.'} Valora eliminarla.${altStr}`;
    }
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
    case 'interrogativas_tilde': {
      const errTypeInt = f.errorType === 'falta_tilde' ? 'Falta tilde' : 'Tilde sobrante';
      const ctxInt = f.context ? ` (${f.context.replace(/_/g,' ')})` : '';
      return `Interrogativo/exclamativo (${errTypeInt}): «${f.wordForm||f.originalText}» debe escribirse «${f.correctForm||''}»${ctxInt}. ${f.explanation||''}`;
    }
    case 'tu_tilde': {
      const fnTu = f.function || '';
      const fnTuLabel = fnTu === 'pronombre_personal' ? 'pronombre personal sujeto'
                      : fnTu === 'posesivo'           ? 'posesivo (ante sustantivo)'
                      : fnTu;
      return `Tilde diacrítica: «${f.tuForm||f.originalText}» debe escribirse «${f.correctForm||''}» (${fnTuLabel}). ${f.explanation||''}`;
    }
    case 'mi_tilde': {
      const fnMi = f.function || '';
      const fnMiLabel = fnMi === 'pronombre_personal' ? 'pronombre personal (tras preposición)'
                      : fnMi === 'posesivo'           ? 'posesivo (ante sustantivo)'
                      : fnMi;
      return `Tilde diacrítica: «${f.miForm||f.originalText}» debe escribirse «${f.correctForm||''}» (${fnMiLabel}). ${f.explanation||''}`;
    }
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
    case 'palabras_sobrantes':
      return `Palabra sobrante: ${f.explanation||''} Corrección: «${f.correction||''}».`;
    case 'tiempos_verbales':
      return `Tiempo verbal: ${f.explanation||''} ${f.suggestion?'Sugerencia: '+f.suggestion:''}`;
    case 'ortotipografia_pura':
      return f.isFirstOccurrence ? `Ortotipografía corregida en todo el documento: ${f.explanation}` : null;
    case 'puntuacion_prosa':
      return `Puntuación en prosa (${f.errorType||''}): ${f.explanation||''} Corrección: «${f.correction||''}».`;
    case 'puntuacion_dialogo':
      return `Puntuación de diálogo (${f.errorType||''}): ${f.explanation||''} Corrección: «${f.correction||''}».`;
    case 'ritmo_narrativo':
      return `Ritmo narrativo (${f.sceneType||''}): ${f.issue||f.explanation||''} ${f.suggestion?'Sugerencia: '+f.suggestion:''}`.trim();
    case 'voz_pasiva':
      return `Voz pasiva: ${f.explanation||''} ${f.activeVersion?'Forma activa: «'+f.activeVersion+'»':''}`.trim();
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
// commentOnly=true: solo inserta comentario, sin cambiar font.color ni bold
// (usado cuando una corrección de palabra colisiona con un bracket existente:
//  el bracket conserva su color y la corrección de palabra añade solo su comentario)
async function _styleAndComment(ctx, body, searchPattern, colorHex, commentText, commentOnly = false) {
  if (!searchPattern) return;
  try {
    let sr = body.search(searchPattern, {matchCase:true, matchWholeWord:false, matchWildcards:false});
    sr.load('items');
    await ctx.sync();
    if (!sr.items.length) {
      // Fallback: matchCase:false para cubrir diferencias de capitalización
      // (p.ej. API devuelve "aparentemente" pero el documento tiene "Aparentemente")
      sr = body.search(searchPattern, {matchCase:false, matchWholeWord:false, matchWildcards:false});
      sr.load('items');
      await ctx.sync();
    }
    console.log('[styleAndComment] search("' + searchPattern + '") → ' + sr.items.length + ' resultado(s)');
    if (!sr.items.length) {
      console.warn('[styleAndComment] ⚠ 0 resultados — símbolo no estilizado ni comentado');
      return;
    }
    const target = sr.items[0]; // back-to-front: el más reciente es el primero en el doc
    // Buscar solo el ◆ DENTRO del rango → el estilado no afecta a la palabra adyacente
    const symSr = target.search('\u25C6', {matchCase:true, matchWholeWord:false, matchWildcards:false});
    symSr.load('items');
    await ctx.sync();
    if (symSr.items.length) {
      if (!commentOnly) {
        symSr.items[0].font.color = colorHex;
        symSr.items[0].font.bold  = true;
      }
      if (commentText) symSr.items[0].insertComment(commentText.replace(/[\r\n]+/g, ' | ').substring(0, 1500));
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
      case 'adverbios_mente': {
        // Validar que el adverbio devuelto por la API realmente termina en -mente.
        // Si el modelo devuelve la raíz ("absorbente") o una palabra relacionada
        // ("improviso"), se ignora y se busca el -mente en originalText directamente.
        const candidates = (f.adverbs||[]).concat([f.adverb]).filter(Boolean);
        const validAdv = candidates.find(a => /mente$/i.test(a));
        if (validAdv) return validAdv;
        // Fallback: extraer la primera palabra terminada en -mente del originalText
        const m = (f.originalText||'').match(/\b\w+mente\b/i);
        return m ? m[0] : f.originalText;
      }
      case 'repeticion_lexica':     return (f.occurrences?.[0]) || f.word || f.originalText;
      case 'verbos_comedin':        return f.verb || f.originalText;
      case 'sustantivos_genericos': return f.genericWord || f.originalText;
      case 'nombres_propios':       return f.name || f.originalText;
      case 'muletillas':            return f.expression || f.originalText;
      case 'aun_tilde': {
        // Verificar que aunForm sea realmente «aun» o «aún» (3-4 chars, sin espacios).
        // Si no es así (API sin campo, firstWord erróneo, etc.), extraer del originalText.
        const af = (f.aunForm||'').trim();
        if (/^a[u\u00FA]n$/i.test(af)) return af;
        const am = (f.originalText||'').match(/\ba[u\u00FA]n\b/i);
        if (am) return am[0];
        return f.originalText;
      }
      case 'si_tilde':              return f.siForm  || f.originalText;
      case 'mi_tilde':              return f.miForm  || f.originalText;
      case 'tu_tilde':              return f.tuForm  || f.originalText;
      case 'interrogativas_tilde':  return f.wordForm || f.originalText;
      case 'pleonasmos': {
        const orig = (f.originalText||'').split(/\s+/);
        const corr = (f.correction  ||'').split(/\s+/);
        const unique = orig.filter(w => w.replace(/[^a-z\u00C0-\u024F]/gi,'').length > 3 &&
                                        !corr.some(c => c.toLowerCase() === w.toLowerCase()));
        if (unique.length) return unique.reduce((a,b) => a.length >= b.length ? a : b);
        return orig.find(w => !corr.some(c=>c.toLowerCase()===w.toLowerCase())) || f.originalText;
      }
      case 'gerundios':        return f.gerund || f.originalText;
      case 'palabras_sobrantes': return f.originalText;
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
    // aun_tilde usa mww:false porque mww:true lanza ItemNotFound en Office JS
    // cuando la palabra está al inicio del párrafo (sin carácter previo para el límite).
    const mww  = corrId!=='muletillas' && corrId!=='dequeismo' && corrId!=='aun_tilde';
    let items;
    let hadBracketCollision = false;

    // Batch: buscar keyText dentro del rango + (para corrId no-tilde) comprobar colisión bracket.
    //
    // Los pronombres/adverbios de tilde (mi/si/tu/aun) se excluyen del bracketSr:
    // — Son palabras de 2-3 letras que nunca son la primera palabra de un bracket de
    //   frases_largas/voz_pasiva, así que una colisión real ◆¹+keyText es prácticamente
    //   imposible en la práctica.
    // — El bracketSr con ◆¹ (U+25C6 + U+00B9) produce falsos positivos sistemáticos
    //   con matchCase:false (aun≡Aún, mi en misma) y lanza error en ctx.sync() con
    //   matchCase:true o matchWholeWord:true, cancelando también el sr del mismo batch.
    // — Si en algún caso extremo un bracket coincide con la misma posición, el resultado
    //   visual sería ◆◆¹palabra (dos símbolos), aceptable y sin pérdida de información.
    const skipBracketSr = corrId === 'aun_tilde' || corrId === 'mi_tilde'
                       || corrId === 'si_tilde'  || corrId === 'tu_tilde';
    dbg(`_markWord ENTER corrId="${corrId}" keyText="${keyText}" mww=${mww} skip=${skipBracketSr}`);
    if (corrId === 'nombres_propios') console.log(`[NP] _markWord ENTER keyText="${keyText}"`);
    try {
      if (!skipBracketSr) {
        // Buscar ◆¹+keyText SOLO dentro del rango actual (no en todo el body):
        // si se busca en body, un ◆¹Albert en otro párrafo dispara falsa colisión.
        const bracketSr = range.search('\u25C6\u00B9' + keyText, {matchCase:false, matchWholeWord:false, matchWildcards:false});
        bracketSr.load('items');
        const sr = range.search(keyText, {matchCase:false, matchWholeWord:mww, matchWildcards:false});
        sr.load('items');
        await ctx.sync();
        dbg(`_markWord L1 bracketSr=${bracketSr.items.length} sr=${sr.items.length}`);
        if (corrId === 'nombres_propios') console.log(`[NP] _markWord L1 bracketSr=${bracketSr.items.length} sr=${sr.items.length}`);
        if (bracketSr.items.length) { hadBracketCollision = true; }
        else { items = sr.items; }
      } else {
        const sr = range.search(keyText, {matchCase:false, matchWholeWord:mww, matchWildcards:false});
        sr.load('items');
        await ctx.sync();
        dbg(`_markWord L1-skip sr=${sr.items.length}`);
        items = sr.items;
      }
    } catch(e) { dbg(`_markWord L1 CATCH: ${e.message}`); items = []; }

    // Si ya existe ◆¹+keyText: la corrección bracket ya marcó esta posición.
    // body.search('◆¹'+keyText) falla porque Word no indexa U+00B9 como literal.
    // Solución: para.search('◆¹') dentro del párrafo del rango (igual que _markBrackets).
    if (hadBracketCollision) {
      try {
        const colPara = range.paragraphs.getFirst();
        const colOpenSr = colPara.search('\u25C6\u00B9', {matchCase:false, matchWholeWord:false, matchWildcards:false});
        colOpenSr.load('items'); await ctx.sync();
        if (colOpenSr.items.length) {
          const colSym = colOpenSr.items[colOpenSr.items.length - 1];
          // Comentario sobre el ◆ (sin cambiar color del bracket)
          const colSymSr = colSym.search('\u25C6', {matchCase:true, matchWholeWord:false, matchWildcards:false});
          colSymSr.load('items'); await ctx.sync();
          if (colSymSr.items.length && commentText) {
            colSymSr.items[0].insertComment(commentText.replace(/[\r\n]+/g, ' | ').substring(0, 1500));
          }
          // Colorear keyText dentro del párrafo
          const colWordSr = colPara.search(keyText, {matchCase:false, matchWholeWord:false, matchWildcards:false});
          colWordSr.load('items'); await ctx.sync();
          if (colWordSr.items.length) {
            colWordSr.items[0].font.color = colorHex;
            if (hl) colWordSr.items[0].font.highlightColor = hl;
          }
          await ctx.sync();
        }
      } catch(e) {}
      return;
    }

    if (!items || !items.length) {
      try {
        const para = range.paragraphs.getFirst();
        const sr2 = para.search(keyText, {matchCase:false, matchWholeWord:mww, matchWildcards:false});
        sr2.load('items'); await ctx.sync();
        items = sr2.items;
        dbg(`_markWord L2 para mww=${mww} found=${items.length}`);
      } catch(e) { dbg(`_markWord L2 CATCH: ${e.message}`); items = []; }
    }

    if (!items.length) {
      try {
        const para3 = range.paragraphs.getFirst();
        const sr3 = para3.search(keyText, {matchCase:false, matchWholeWord:false, matchWildcards:false});
        sr3.load('items'); await ctx.sync();
        items = sr3.items;
        dbg(`_markWord L3 para mww=false found=${items.length}`);
      } catch(e) { dbg(`_markWord L3 CATCH: ${e.message}`); }
    }
    dbg(`_markWord items final=${items.length} hadCollision=${hadBracketCollision}`);
    if (corrId === 'nombres_propios') console.log(`[NP] _markWord items final=${items && items.length} hadCollision=${hadBracketCollision}`);
    if (!items.length) return;

    const target = items[0];

    // Anti-duplicado: SOLO para pronombres (mi/si/tu) donde local + API pueden generar
    // dos findings para el mismo pronombre en el mismo contexto. Si ◆+keyText ya existe
    // en el párrafo → otro finding ya lo marcó → añadir comentario y salir.
    // NO aplicar a aun_tilde ni interrogativas_tilde: en esos casos el mismo keyText
    // puede aparecer varias veces en el párrafo y todas deben marcarse.
    if (corrId === 'mi_tilde' || corrId === 'si_tilde' || corrId === 'tu_tilde') {
      try {
        const dupPara = range.paragraphs.getFirst();
        const dupSr = dupPara.search('\u25C6' + keyText, {matchCase:false, matchWholeWord:false, matchWildcards:false});
        dupSr.load('items'); await ctx.sync();
        dbg(`_markWord anti-dup ◆${keyText} found=${dupSr.items.length}`);
        if (dupSr.items.length > 0) {
          dbg(`_markWord anti-dup HIT → skip insert`);
          if (commentText) {
            const symSr = dupSr.items[0].search('\u25C6', {matchCase:true, matchWholeWord:false, matchWildcards:false});
            symSr.load('items'); await ctx.sync();
            if (symSr.items.length) {
              symSr.items[0].insertComment(commentText.replace(/[\r\n]+/g, ' | ').substring(0, 1500));
              await ctx.sync();
            }
          }
          return;
        }
      } catch(e) {}
    }

    // Fase 1: highlight sobre rango existente (OK) + solo insertar ◆
    dbg(`_markWord INSERTING ◆ before "${keyText}"`);
    if (hl) target.font.highlightColor = hl;
    _insertSymbol(target.getRange('Start'), 'Before', '\u25C6');
    await ctx.sync();
    dbg(`_markWord ◆ inserted OK`);

    // Fase 2: buscar ◆+keyText dentro del párrafo (matchCase:false, items[0] = back-to-front).
    // NO usar body.search con matchCase:true: si hay dos ocurrencias del mismo verbo en el
    // mismo párrafo con distinta capitalización (ej. "Hizo" y "hizo"), f.verb siempre viene
    // en minúscula del AI → matchCase:true no encuentra la versión en mayúscula.
    // Usando para.search + matchCase:false + items[0] resolvemos ambos casos a la vez.
    try {
      const para = range.paragraphs.getFirst();
      const openSr = para.search('\u25C6' + keyText, {matchCase:false, matchWholeWord:false, matchWildcards:false});
      openSr.load('items'); await ctx.sync();
      if (openSr.items.length) {
        const symSr = openSr.items[0].search('\u25C6', {matchCase:true, matchWholeWord:false, matchWildcards:false});
        symSr.load('items'); await ctx.sync();
        if (symSr.items.length) {
          symSr.items[0].font.color = colorHex;
          symSr.items[0].font.bold  = true;
          if (commentText) symSr.items[0].insertComment(commentText.replace(/[\r\n]+/g, ' | ').substring(0, 1500));
          await ctx.sync();
        }
      } else {
        await _styleAndComment(ctx, body, '\u25C6' + keyText, colorHex, commentText);
      }
    } catch(e) {
      await _styleAndComment(ctx, body, '\u25C6' + keyText, colorHex, commentText);
    }
  }

  // ── Brackets ─────────────────────────────────────────────────────────────
  async _markBrackets(ctx, body, range, finding, colorHex, commentText) {
    // Ver comentario de corrId/needsCaseB más abajo para la lógica de bifurcación.
    // Word Win32 lanza ItemNotFound para búsquedas que contengan U+25C6 (◆),
    // así que ninguna cadena de búsqueda contiene ◆.
    // Orden: primero ◆² (al End) y luego ◆¹ (al Start), para que la inserción de
    // ◆¹ no desplace el End del range antes de insertar ◆².

    const corrId        = finding.correctionId;
    const origText      = (finding.originalText || '').replace(/[\r\n]+/g, ' ').trim();
    const endsWithPunct = /[.!?:;\u2026]$/.test(origText);

    // Cuándo necesitamos buscar el final real en el párrafo (Case B):
    //
    // 1) origText.length >= 70: _applyFinding truncó el search → range cubre sólo el inicio.
    //
    // 2) frases_largas o ritmo_narrativo SIN puntuación de cierre: el API devolvió el bloque
    //    truncado (p. ej. "Cuando por fin llegaron...dos horas de"). Para estos tipos de
    //    corrección los bloques son largos y el API puede abreviarlos.
    //
    // Para el resto de tipos de bracket (voz_pasiva, tiempos_verbales, puntuacion_dialogo,
    // ambiguedad_pronominal, etc.): origText SÍ es la frase completa aunque no incluya el
    // punto final — el API devuelve la frase sin punto. El range cubre exactamente esa frase,
    // y range.getRange('End') queda justo antes del punto del documento → posición correcta
    // para ◆². Además, este Case A es el único que funciona correctamente cuando hay
    // múltiples findings del mismo tipo en el mismo párrafo.
    const TRUNCATION_TYPES = new Set(['frases_largas', 'ritmo_narrativo']);
    const needsCaseB = origText.length >= 70 ||
                       (!endsWithPunct && TRUNCATION_TYPES.has(corrId));

    let endInserted = false;

    if (!needsCaseB) {
      // ── Case A: range cubre la frase completa → End es exacto ────────────────
      try {
        const ins2 = range.getRange('End').insertText('\u25C6\u00B2', 'After');
        ins2.font.color = colorHex;
        ins2.font.bold  = true;
        ins2.font.name  = 'Cambria Math';
        await ctx.sync();
        endInserted = true;
      } catch(e) { dbg(`_markBrackets CaseA ◆²: ${e.message}`); }
    } else {
      // ── Case B: buscar el final real del bloque/frase en el párrafo ──────────
      // Siempre cargamos el párrafo que contiene el range — evita buscar en el
      // body completo (lo que causaría coger la primera ocurrencia del ancla en
      // todo el documento en vez de la del párrafo correcto).
      try {
        let searchAnchor = '';
        const para = range.paragraphs.getFirst();
        para.load('text');
        await ctx.sync();
        const paraClean = (para.text || '')
                          .replace(/[\r\n]+/g, ' ')
                          .replace(/\u25C6[\u00B9\u00B2]?/g, '');

        if (!endsWithPunct) {
          // origText truncado: localizar origText en el párrafo, buscar la
          // siguiente puntuación de cierre y extraer ancla con las últimas palabras.
          const origStart = paraClean.toLowerCase().indexOf(origText.toLowerCase());
          if (origStart >= 0) {
            const origEnd  = origStart + origText.length;
            const rest     = paraClean.substring(origEnd);
            // Prioridad: puntuaci\u00f3n fuerte (.!?\u2026) primero; solo si no hay,
            // usar puntuaci\u00f3n secundaria (:;) para no parar en mitad de frase.
            let punctIdx = rest.search(/[.!?\u2026]/);
            if (punctIdx < 0) punctIdx = rest.search(/[:;]/);
            if (punctIdx >= 0) {
              const punctChar = rest[punctIdx];
              const zone  = paraClean.substring(Math.max(0, origEnd + punctIdx - 30), origEnd + punctIdx);
              const words = zone.trim().split(/\s+/).filter(w => w.length > 0);
              searchAnchor = words.slice(-3).join(' ').trim() + punctChar;
            }
          }
        } else {
          // origText completo con puntuación final: ancla = últimas 3 palabras + signo de cierre.
          // Incluir el signo hace el ancla única (no aparece antes en el párrafo).
          const lastPunct = origText.trim().slice(-1);
          const withoutPunct = origText.trim().slice(0, -1).trim();
          const words = withoutPunct.split(/\s+/);
          searchAnchor = words.slice(-3).join(' ') + lastPunct;
        }

        dbg(`_markBrackets CaseB anchor="${searchAnchor}"`);
        if (searchAnchor.length >= 4) {
          // Buscar en el párrafo específico, no en body, para evitar colisiones
          // con otras ocurrencias del ancla en el resto del documento.
          const endSr = para.search(searchAnchor, {matchCase:false, matchWholeWord:false, matchWildcards:false});
          endSr.load('items');
          await ctx.sync();
          dbg(`_markBrackets CaseB items=${endSr.items.length}`);
          if (endSr.items.length) {
            const ins2 = endSr.items[endSr.items.length - 1].getRange('End').insertText('\u25C6\u00B2', 'After');
            ins2.font.color = colorHex;
            ins2.font.bold  = true;
            ins2.font.name  = 'Cambria Math';
            await ctx.sync();
            endInserted = true;
          }
        }
      } catch(e) { console.warn(`_markBrackets CaseB ◆²: ${e.message}`); }
    }

    // ── Último recurso ────────────────────────────────────────────────────────
    if (!endInserted) {
      console.warn(`_markBrackets lastResort ◆²: "${origText.substring(0,60)}"`);
      try {
        const ins2 = range.getRange('End').insertText('\u25C6\u00B2', 'After');
        ins2.font.color = colorHex;
        ins2.font.bold  = true;
        ins2.font.name  = 'Cambria Math';
        await ctx.sync();
      } catch(e) { console.warn(`_markBrackets lastResort ◆² catch: ${e.message}`); }
    }

    // ── ◆¹ al inicio + estilizado + comentario ────────────────────────────────
    try {
      const ins1 = range.getRange('Start').insertText('\u25C6\u00B9', 'Before');
      ins1.font.color = colorHex;
      ins1.font.bold  = true;
      ins1.font.name  = 'Cambria Math';
      if (commentText) ins1.insertComment(commentText.replace(/[\r\n]+/g, ' | ').substring(0, 1500));
      await ctx.sync();
    } catch(e) { dbg(`_markBrackets ◆¹: ${e.message}`); }
  }

  // ── Aplicar un finding individual ─────────────────────────────────────────
  async _applyFinding(ctx, body, finding) {
    const corrId   = finding.correctionId;
    dbg(`_applyFinding corrId=${corrId} orig="${(finding.originalText||'').substring(0,40)}" paraIdx=${finding._paraIdx}`);
    const colorHex = SYMBOL_COLORS[corrId] || '555555';
    const comment  = buildCommentText(finding.mergedFindings || [finding]);
    // Normalizar espacios: reemplazar saltos de línea y espacios Unicode especiales
    // (nbsp U+00A0, thin-space U+2009, etc.) por espacio normal, para que body.search()
    // y los indexOf(' ') de los fallbacks funcionen correctamente.
    let search = (finding.originalText||'')
      .replace(/[\r\n]+/g,' ')
      .replace(/[\u00A0\u2009\u202F\u2060\u200B]/g,' ')
      .trim();
    if (!search || search.length < 3) return;

    if (search.length >= 70) {
      const cut = search.substring(0, 70);
      const lastSpace = cut.lastIndexOf(' ');
      search = lastSpace > 25 ? cut.substring(0, lastSpace).trimEnd() : cut;
    }

    const sr = body.search(search, {matchCase:false,matchWholeWord:false,matchWildcards:false});
    sr.load('items'); await ctx.sync();
    if (corrId === 'nombres_propios') {
      console.log(`[NP] corrId=${corrId} name="${finding.name}" originalText="${(finding.originalText||'').substring(0,60)}" search="${search.substring(0,60)}" sr.items=${sr.items.length} _paraIdx=${finding._paraIdx}`);
    }
    let range;
    if (sr.items.length === 1) {
      range = sr.items[0];
    } else if (sr.items.length > 1) {
      // Múltiples ocurrencias: usar _paraIdx (que apunta a la PRIMERA ocurrencia
      // según _resolvePositions) para buscar en el párrafo correcto y no tomar
      // ciegamente items[0] que es la ÚLTIMA ocurrencia (orden back-to-front de Word).
      const pi = finding._paraIdx;
      if (pi !== undefined) {
        try {
          body.load('paragraphs');
          await ctx.sync();
          const targetPara = body.paragraphs.items[pi];
          if (targetPara) {
            const psr = targetPara.search(search, {matchCase:false,matchWholeWord:false,matchWildcards:false});
            psr.load('items');
            await ctx.sync();
            if (psr.items.length) range = psr.items[0];
          }
        } catch(e) { dbg(`_applyFinding multi-disambig catch: ${e.message}`); }
      }
      if (!range) range = sr.items[0]; // fallback: última ocurrencia (back-to-front)
    } else {
      let shorter = search.substring(0, 40);
      if (shorter.length < 5) return;
      const lastSp = shorter.lastIndexOf(' ');
      if (lastSp > 15) shorter = shorter.substring(0, lastSp).trimEnd();
      const sr2 = body.search(shorter, {matchCase:false,matchWholeWord:false,matchWildcards:false});
      sr2.load('items'); await ctx.sync();
      if (sr2.items.length) {
        range = sr2.items[0];
      } else {
        // Último recurso: buscar solo la primera palabra del término en el párrafo correcto.
        // Útil cuando otro ◆ ya insertado queda entre dos palabras del originalText
        // (ej. «aun no» → RS insertó ◆ antes de «no» → buscar «aun» suelto).
        // IMPORTANTE: usar el párrafo específico (_paraIdx) en vez de body.search para
        // evitar marcar una instancia fuera del rango seleccionado (items[0] del body
        // sería el primer «aun» del documento, no necesariamente el del párrafo correcto).
        const spIdx = search.indexOf(' ');
        // Buscar el keyText del finding directamente en el párrafo correcto (_paraIdx).
        // Usar matchWholeWord:false para evitar el bug de Office JS donde matchWholeWord:true
        // falla cuando la palabra está al inicio del párrafo (no hay límite de palabra previo).
        // El keyText es lo que _markWord va a buscar de todos modos, así que es el ancla ideal.
        const pi = finding._paraIdx;
        const keyTextFallback = this._getKeyText(finding) || '';
        if (pi !== undefined && keyTextFallback.length >= 2) {
          try {
            body.load('paragraphs');
            await ctx.sync();
            const targetPara = body.paragraphs.items[pi];
            if (targetPara) {
              // Leer el texto REAL del párrafo (ya incluye los ◆ insertados por findings anteriores).
              // Construir frase de búsqueda mapeando keyText sobre el texto con símbolos:
              // 1) stripear ◆ del texto real → paraClean
              // 2) localizar keyText en paraClean → ktPosClean
              // 3) mapear ktPosClean al texto real contando los ◆ insertados antes → ktPosReal
              // 4) tomar ventana de ~15 chars antes + keyText del texto real (con ◆ si los hay)
              // Así, si verbos_comedin ya insertó ◆ antes de "hice" → texto real = "para ◆mi" →
              // body.search("para ◆mi") encuentra exactamente ese rango.
              targetPara.load('text');
              await ctx.sync();
              const paraReal  = targetPara.text || '';
              const DIAMOND   = '\u25C6';
              const paraClean = paraReal.replace(/\u25C6[\u00B9\u00B2]?/g, ''); // strip ◆ ◆¹ ◆²
              const ktLower   = keyTextFallback.toLowerCase();
              const ktPosClean = paraClean.toLowerCase().indexOf(ktLower);

              let searchPhrase = keyTextFallback; // fallback si no encontramos posición
              if (ktPosClean >= 0) {
                // Mapear posición clean → posición real (cada ◆ insertado antes suma 1-2 chars)
                let cleanIdx = 0, realIdx = 0;
                while (cleanIdx < ktPosClean && realIdx < paraReal.length) {
                  const ch = paraReal[realIdx];
                  if (ch === DIAMOND) {
                    // ◆ o ◆¹/◆²: avanzar en real sin avanzar en clean
                    realIdx++;
                    if (realIdx < paraReal.length && (paraReal[realIdx] === '\u00B9' || paraReal[realIdx] === '\u00B2')) realIdx++;
                  } else {
                    cleanIdx++; realIdx++;
                  }
                }
                // Avanzar realIdx más allá de cualquier ◆ que preceda al carácter limpio en
                // esta posición (caso frecuente: ktPosClean=0 y el párrafo empieza con ◆¹Aun).
                while (realIdx < paraReal.length && paraReal[realIdx] === DIAMOND) {
                  realIdx++;
                  if (realIdx < paraReal.length && (paraReal[realIdx] === '\u00B9' || paraReal[realIdx] === '\u00B2')) realIdx++;
                }
                const ktPosReal = realIdx;
                // Extraer ventana contextual: hasta 15 chars antes (en texto real) + keyText
                const windowStart = Math.max(0, ktPosReal - 15);
                const windowRaw   = paraReal.substring(windowStart, ktPosReal + keyTextFallback.length);
                // Quitar puntuación/espacios al inicio de la ventana hasta primera letra o ◆
                const trimmedWindow = windowRaw.replace(/^[^a-zA-Z\u00C0-\u024F\u25C6]+/, '');
                if (trimmedWindow.length >= keyTextFallback.length) searchPhrase = trimmedWindow;
              }

              dbg(`_applyFinding keyText fallback phrase="${searchPhrase}" pi=${pi}`);

              // sr3: búsqueda con frase contextual. Si searchPhrase contiene ◆ (U+25C6),
              // Word Win32 lanza ItemNotFound → try-catch propio para no bloquear sr4.
              if (!range) {
                try {
                  const sr3 = targetPara.search(searchPhrase, {matchCase:false,matchWholeWord:false,matchWildcards:false});
                  sr3.load('items'); await ctx.sync();
                  dbg(`_applyFinding keyText sr3 found=${sr3.items.length}`);
                  if (sr3.items.length) range = sr3.items[0];
                } catch(e) { dbg(`_applyFinding keyText sr3 catch: ${e.message}`); }
              }

              // sr4: búsqueda solo con keyText (sin contexto). Se ejecuta siempre que range
              // sea null — ya sea porque sr3 lanzó, devolvió 0, o searchPhrase === keyText.
              if (!range) {
                try {
                  const sr4 = targetPara.search(keyTextFallback, {matchCase:false,matchWholeWord:false,matchWildcards:false});
                  sr4.load('items'); await ctx.sync();
                  dbg(`_applyFinding keyText sr4 found=${sr4.items.length}`);
                  if (sr4.items.length) range = sr4.items[0];
                } catch(e) { dbg(`_applyFinding keyText sr4 catch: ${e.message}`); }
              }
            }
          } catch(e) { dbg(`_applyFinding keyText fallback catch: ${e.message}`); }
        }
        if (!range) { dbg(`_applyFinding FAIL: no range`); return; }
      }
    }

    if (corrId === 'leismo')            await this._markPronoun (ctx, body, range, finding, colorHex, comment);
    else if (BRACKET_TYPES.has(corrId)) await this._markBrackets(ctx, body, range, finding, colorHex, comment);
    else                                await this._markWord    (ctx, body, range, finding, colorHex, comment);
  }

  // ── APPLY MARKINGS ────────────────────────────────────────────────────────
  async applyMarkings(resolvedFindings, selectionText = '') {
    if (!resolvedFindings || !resolvedFindings.length) return;

    const ortotypo = resolvedFindings.filter(f => f.directFix);
    const others   = resolvedFindings.filter(f => !f.directFix && f.originalText);

    // Ortotipografía: en modo selección se omite para evitar dos problemas:
    // 1) body.load('paragraphs') sobre documentos de 150+ hojas mata el WebView.
    // 2) Las correcciones automáticas (guiones, comillas, etc.) se aplicarían
    //    a TODO el documento, no solo al fragmento seleccionado.
    // Los hallazgos de ortotipografía siguen apareciendo en el informe de estadísticas.
    if (ortotypo.length) {
      if (selectionText) {
        console.log('[PLUMIA] applyMarkings: ortotipografía omitida en modo selección (evita crash en doc grande)');
      } else {
        await this.applyOrtotypography();
      }
    }
    if (!others.length)  return;

    // Registrar todas las muletillas detectadas para filtrar alternativas en comentarios
    const _muletillaSet = new Set();
    for (const rf of resolvedFindings) {
      for (const mf of (rf.mergedFindings || [rf])) {
        if (mf.correctionId === 'muletillas' && mf.expression) {
          _muletillaSet.add(mf.expression.toLowerCase().trim());
        }
      }
    }
    window.PLUMIA._knownMuletillas = _muletillaSet;

    // ── Paso 1: resolver posiciones ───────────────────────────────────────────
    // Si hay selectionText: cálculo en JS puro (sin Word.run, sin cargar párrafos).
    // Si no: Word.run con body.load('paragraphs') sobre el documento completo.
    const positions = await this._resolvePositions(others, selectionText);

    // ── Paso 2: ordenar de atrás hacia adelante ───────────────────────────────
    // BRACKETS PRIMERO (globalmente), luego WORD MARKERS.
    // Dentro de cada grupo, orden back-to-front (párrafo mayor → char mayor).
    //
    // Razón: un word marker inserta ◆ dentro del texto (p.ej. antes de "que"),
    // lo que rompe el body.search() del bracket cuyo anchor text incluye esa
    // palabra. Procesando brackets primero, su anchor se encuentra intacto y
    // los ◆ de word markers se insertan después, dentro del span ya bracketado.
    // Si un word marker coincide exactamente con el inicio del bracket, la
    // comprobación bracketSr en _markWord detecta ◆¹+keyText y entra en modo
    // commentOnly (comportamiento correcto: el bracket ya ocupa esa posición).
    const mapped = others.map((f, i) => ({
      ...f,
      _paraIdx:    positions[i][0],
      _charIdx:    positions[i][1],
      _isBracket:  BRACKET_TYPES.has(f.correctionId) ? 0 : 1, // 0=bracket primero
    }));
    const ordered = mapped.sort((a, b) => {
      // 1) brackets antes que word markers
      if (a._isBracket !== b._isBracket) return a._isBracket - b._isBracket;
      // 2) dentro del mismo tipo: back-to-front
      if (b._paraIdx !== a._paraIdx) return b._paraIdx - a._paraIdx;
      return b._charIdx - a._charIdx;
    });

    // ── Paso 3: aplicar en el orden calculado ────────────────────────────────
    for (let i = 0; i < ordered.length; i++) {
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        try { await this._applyFinding(ctx, body, ordered[i]); }
        catch(e) { console.warn('Plumia mark:', (ordered[i].originalText||'').substring(0,30), e.message); }
      });
    }
  }

  // ── Resolver posición de cada finding en el documento ────────────────────
  // selectionText: si se pasa, calcula posiciones desde el string JS (sin Word.run).
  // Esto evita body.load('paragraphs') que mata el WebView en documentos de 150+ hojas.
  async _resolvePositions(findings, selectionText = '') {
    // ── FAST PATH: selección activa → cálculo en JS puro ─────────────────────
    if (selectionText) {
      const sl = selectionText.toLowerCase();
      return findings.map(f => {
        let search = (f.originalText || '').replace(/[\r\n]+/g, ' ').trim().toLowerCase();
        if (search.length >= 70) {
          const cut = search.substring(0, 70);
          const lastSpace = cut.lastIndexOf(' ');
          search = lastSpace > 25 ? cut.substring(0, lastSpace).trimEnd() : cut;
        }
        if (!search || search.length < 3) return [0, 0];
        const idx = sl.indexOf(search);
        if (idx !== -1) return [0, idx];
        // Fallback: tramo final del texto (puede cruzar párrafos)
        if (search.length > 15) {
          const tail = search.substring(search.length - 25);
          const tailClean = tail.indexOf(' ') > 0 ? tail.substring(tail.indexOf(' ')).trim() : tail;
          if (tailClean.length >= 5) {
            const tidx = sl.indexOf(tailClean);
            if (tidx !== -1) return [0, tidx];
          }
        }
        return [0, 0];
      });
    }

    // ── SLOW PATH: documento completo → Word.run con body.load('paragraphs') ──
    const positions = findings.map(() => [0, 0]);
    try {
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        body.load('paragraphs');
        await ctx.sync();
        const paras = body.paragraphs.items;
        paras.forEach(p => p.load('text'));
        await ctx.sync();

        for (let fi = 0; fi < findings.length; fi++) {
          let search = (findings[fi].originalText || '').replace(/[\r\n]+/g, ' ').trim();
          if (search.length >= 70) {
            const cut = search.substring(0, 70);
            const lastSpace = cut.lastIndexOf(' ');
            search = lastSpace > 25 ? cut.substring(0, lastSpace).trimEnd() : cut;
          }
          if (!search || search.length < 3) continue;
          const sl = search.toLowerCase();
          let found = false;
          for (let pi = 0; pi < paras.length; pi++) {
            const idx = (paras[pi].text || '').toLowerCase().indexOf(sl);
            if (idx !== -1) { positions[fi] = [pi, idx]; found = true; break; }
          }
          // Fallback: el originalText puede cruzar párrafos (chunks unen párrafos con espacio).
          // Intentar con el tramo final del texto (últimas ~25 chars sin palabra parcial),
          // que con más probabilidad cabe dentro de un único párrafo.
          if (!found && sl.length > 15) {
            const tail = sl.substring(sl.length - 25);
            const tailClean = tail.indexOf(' ') > 0 ? tail.substring(tail.indexOf(' ')).trim() : tail;
            if (tailClean.length >= 5) {
              for (let pi = 0; pi < paras.length; pi++) {
                const idx = (paras[pi].text || '').toLowerCase().indexOf(tailClean);
                if (idx !== -1) { positions[fi] = [pi, idx]; break; }
              }
            }
          }
        }
      });
    } catch(e) {
      console.warn('Plumia _resolvePositions:', e.message);
    }
    return positions;
  }

  async highlightBrackets() { /* vacío */ }

  // ── ORTOTIPOGRAFÍA ────────────────────────────────────────────────────────
  async applyOrtotypography() {
    await Word.run(async (ctx) => {
      const body = ctx.document.body;
      body.load('paragraphs'); await ctx.sync();
      const paras = body.paragraphs.items;
      paras.forEach(p => p.load('text')); await ctx.sync();

      const SYMCOL = '008B8B'; // color ◆ para correcciones automáticas

      // ── 1. Guión de diálogo (párrafo que empieza con -) ──────────────────
      let firstDashDone = false;
      const COMMENT_DASH = 'Ortotipograf\u00EDa: gui\u00F3n corto (-) corregido a raya (\u2014) en todo el documento.';
      for (const para of paras) {
        const trimmed = (para.text||'').trimStart();
        if (/^-/.test(trimmed)) {
          try {
            const sr = para.search('-', {matchCase:true,matchWholeWord:false,matchWildcards:false});
            sr.load('items'); await ctx.sync();
            if (sr.items.length) {
              if (!firstDashDone) {
                sr.items[0].insertText('\u25C6\u2014','Replace'); // ◆—
                firstDashDone = true;
              } else {
                sr.items[0].insertText('\u2014','Replace');
              }
              for (let i=1;i<sr.items.length;i++) sr.items[i].insertText('\u2014','Replace');
              await ctx.sync();
            }
          } catch(e) {}
        }
      }
      if (firstDashDone) await _styleAndComment(ctx, body, '\u25C6\u2014', SYMCOL, COMMENT_DASH);

      // ── 2. Guión interior ( -X → —X, cubierto por el comentario anterior) ─
      try {
        const isr = body.search(' -[a-zA-Z]', {matchCase:false,matchWholeWord:false,matchWildcards:true});
        isr.load('items'); await ctx.sync();
        for (const r of isr.items) {
          r.load('text'); await ctx.sync();
          const t = r.text||'';
          if (t.length>=3) r.insertText(' \u2014'+t.charAt(t.length-1),'Replace');
        }
        await ctx.sync();
      } catch(e) {}

      // ── 3. Exclamación incorrecta (word¡ → word◆!) ───────────────────────
      let firstExclDone = false;
      const COMMENT_EXCL = 'Ortotipograf\u00EDa: signo de cierre \u00A1 corregido a !';
      paras.forEach(p=>p.load('text')); await ctx.sync();
      for (const para of paras) {
        const m = (para.text||'').match(/(\w)(\u00A1)/);
        if (m) {
          try {
            const sr = para.search(m[1]+'\u00A1', {matchCase:true,matchWholeWord:false,matchWildcards:false});
            sr.load('items'); await ctx.sync();
            for (const r of sr.items) {
              if (!firstExclDone) {
                r.insertText(m[1]+'\u25C6!','Replace'); // word◆!
                firstExclDone = true;
              } else {
                r.insertText(m[1]+'!','Replace');
              }
            }
            await ctx.sync();
          } catch(e) {}
        }
      }
      if (firstExclDone) await _styleAndComment(ctx, body, '\u25C6!', SYMCOL, COMMENT_EXCL);

      // ── 4. Comillas inglesas (" → ◆«») ────────────────────────────────────
      let firstQuoteDone = false;
      const COMMENT_QUOTES = 'Ortotipograf\u00EDa: comillas inglesas corregidas a \u00AB\u00BB';
      try {
        const qr = body.search('"', {matchCase:true,matchWholeWord:false,matchWildcards:false});
        qr.load('items'); await ctx.sync();
        for (let i=0;i<qr.items.length;i++) {
          if (i===0 && !firstQuoteDone) {
            qr.items[i].insertText('\u25C6\u00AB','Replace'); // ◆«
            firstQuoteDone = true;
          } else {
            qr.items[i].insertText(i%2===0?'\u00AB':'\u00BB','Replace');
          }
        }
        await ctx.sync();
      } catch(e) {}
      if (firstQuoteDone) await _styleAndComment(ctx, body, '\u25C6\u00AB', SYMCOL, COMMENT_QUOTES);

      // ── 5. Comillas curvas (" " ' ' → «») ─────────────────────────────────
      for (const [s,r] of [['\u201c','\u00AB'],['\u201d','\u00BB'],['\u2018','\u00AB'],['\u2019','\u00BB']]) {
        try {
          const sr = body.search(s,{matchCase:true,matchWholeWord:false,matchWildcards:false});
          sr.load('items'); await ctx.sync();
          for (const item of sr.items) item.insertText(r,'Replace');
          await ctx.sync();
        } catch(e) {}
      }

      // ── 6. Puntos suspensivos (... → ◆…) ──────────────────────────────────
      let firstDotsDone = false;
      const COMMENT_DOTS = 'Ortotipograf\u00EDa: tres puntos seguidos (...) corregidos a puntos suspensivos (\u2026) en todo el documento.';
      try {
        const dr = body.search('...',{matchCase:true,matchWholeWord:false,matchWildcards:false});
        dr.load('items'); await ctx.sync();
        for (const item of dr.items) {
          if (!firstDotsDone) {
            item.insertText('\u25C6\u2026','Replace'); // ◆…
            firstDotsDone = true;
          } else {
            item.insertText('\u2026','Replace');
          }
        }
        await ctx.sync();
      } catch(e) {}
      if (firstDotsDone) await _styleAndComment(ctx, body, '\u25C6\u2026', SYMCOL, COMMENT_DOTS);

      // ── 7. Espacio antes de puntuación ────────────────────────────────────
      for (const sign of [' ,', ' ;', ' :', ' .']) {
        try {
          const sr = body.search(sign,{matchCase:true,matchWholeWord:false,matchWildcards:false});
          sr.load('items'); await ctx.sync();
          for (const item of sr.items) item.insertText(sign.trim(),'Replace');
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

      // ── REGLAS: enseguida · prefijos sin guión · asignaturas · cargos ─────────
      try {
        // ── enseguida ──────────────────────────────────────────────────────────
        const COMMENT_ENSEG = 'Ortotipograf\u00EDa: \u00ABen seguida\u00BB se escribe en una sola palabra: \u00ABenseguida\u00BB. Corregido en todo el documento.';
        let firstEnsegDone = false;
        let firstEnsegPattern = null;
        for (const [from, to] of [['En seguida','Enseguida'],['en seguida','enseguida']]) {
          try {
            const esr = body.search(from, {matchCase:true, matchWholeWord:false, matchWildcards:false});
            esr.load('items'); await ctx.sync();
            for (const item of esr.items) {
              if (!firstEnsegDone) {
                item.insertText('\u25C6' + to, 'Replace'); // ◆Enseguida / ◆enseguida
                firstEnsegPattern = '\u25C6' + to;
                firstEnsegDone = true;
              } else {
                item.insertText(to, 'Replace');
              }
            }
            await ctx.sync();
          } catch(e) {}
        }
        if (firstEnsegPattern) await _styleAndComment(ctx, body, firstEnsegPattern, SYMCOL, COMMENT_ENSEG);

        // ── Cargar párrafos para las reglas con detección JS ──────────────────
        body.load('paragraphs'); await ctx.sync();
        const rParas = body.paragraphs.items;
        rParas.forEach(p => p.load('text')); await ctx.sync();

        // ── Prefijos sin guión (excluye ante mayúsculas: anti-OTAN) ───────────
        const COMMENT_PREF = 'Ortotipografía: los prefijos (anti-, ex-, sub-, pre-, post-…) van unidos sin guión, salvo ante nombre propio o numeral. Corregido en todo el documento.';
        const PREFIJOS = ['anti','ex','sub','pre','post','co','auto','inter','super',
                          'ultra','extra','sobre','vice','contra','semi','neo','pro',
                          'trans','bi','mono','multi','pseudo','cuasi','macro','micro'];
        let firstPrefDone = false;
        let firstPrefPattern = null;
        for (const para of rParas) {
          const pt = para.text || '';
          if (!pt.includes('-')) continue;
          const reps = new Map();
          for (const pref of PREFIJOS) {
            const re = new RegExp(`\\b(${pref})(-[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc\u00f1])`, 'gi');
            let m;
            while ((m = re.exec(pt)) !== null) {
              const frm = m[0], rep = m[1] + m[2].charAt(1);
              if (!reps.has(frm)) reps.set(frm, rep);
            }
          }
          for (const [frm, rep] of reps) {
            try {
              const sr = para.search(frm, {matchCase:true, matchWholeWord:false, matchWildcards:false});
              sr.load('items'); await ctx.sync();
              for (const item of sr.items) {
                if (!firstPrefDone) {
                  item.insertText('\u25C6' + rep, 'Replace'); // ◆antidrogas
                  firstPrefPattern = '\u25C6' + rep.substring(0, Math.min(rep.length, 6));
                  firstPrefDone = true;
                } else {
                  item.insertText(rep, 'Replace');
                }
              }
              await ctx.sync();
            } catch(e) {}
          }
        }
        if (firstPrefPattern) await _styleAndComment(ctx, body, firstPrefPattern, SYMCOL, COMMENT_PREF);

        // ── Asignaturas en minúscula (fuera de inicio de oración) ─────────────
        const COMMENT_ASIG = 'Ortotipografía: los nombres de asignaturas se escriben en minúscula fuera de inicio de oración (p. ej., «matemáticas», «historia»). Corregido en todo el documento.';
        const ASIG_LIST = [
          'Matemáticas','Matemática','Física','Química','Historia','Geografía',
          'Lengua','Literatura','Filosofía','Biología','Economía','Arte','Música',
          'Religión','Inglés','Francés','Alemán','Latín','Griego',
          'Tecnología','Informática','Plástica','Ética','Psicología','Sociología',
        ];
        let firstAsigDone = false;
        let firstAsigPattern = null;
        for (const para of rParas) {
          const pt = para.text || '';
          const reps = new Map(); // frm → {rep, asigLower}
          for (const asig of ASIG_LIST) {
            let pos = -1;
            while ((pos = pt.indexOf(asig, pos + 1)) !== -1) {
              if (pos === 0) continue;
              const before = pt.substring(0, pos);
              if (/[.?!\u2026\u2014]\s+$/.test(before)) continue;
              if (/[A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00DC\u00D1]\w+\s+de\s+$/.test(before)) continue;
              const prevChar = pt[pos - 1];
              const frm = prevChar + asig;
              const asigLower = asig.charAt(0).toLowerCase() + asig.slice(1);
              const rep = prevChar + asigLower;
              if (!reps.has(frm)) reps.set(frm, {rep, asigLower});
            }
          }
          for (const [frm, {rep, asigLower}] of reps) {
            try {
              const sr = para.search(frm, {matchCase:true, matchWholeWord:false, matchWildcards:false});
              sr.load('items'); await ctx.sync();
              for (const item of sr.items) {
                if (!firstAsigDone) {
                  // Insertar ◆ entre prevChar y la palabra corregida
                  const prevChar = frm.charAt(0);
                  item.insertText(prevChar + '\u25C6' + asigLower, 'Replace');
                  firstAsigPattern = '\u25C6' + asigLower.substring(0, Math.min(asigLower.length, 5));
                  firstAsigDone = true;
                } else {
                  item.insertText(rep, 'Replace');
                }
              }
              await ctx.sync();
            } catch(e) {}
          }
        }
        if (firstAsigPattern) await _styleAndComment(ctx, body, firstAsigPattern, SYMCOL, COMMENT_ASIG);

        // ── Cargos públicos en minúscula (fuera de inicio de oración) ─────────
        // Excluye cuando al cargo le sigue nombre propio: "el Rey Felipe" → skip
        const COMMENT_CARGOS = 'Ortotipografía: los cargos e instituciones se escriben en minúscula (p. ej., «el rey», «la presidenta», «el ministro»). Corregido en todo el documento.';
        const CARGOS_LIST = [
          'Rey','Reyes','Reina','Reinas',
          'Príncipe','Príncipes','Princesa','Princesas',
          'Presidente','Presidentes','Presidenta','Presidentas',
          'Ministro','Ministros','Ministra','Ministras',
          'Alcalde','Alcaldes','Alcaldesa','Alcaldesas',
          'Gobernador','Gobernadores','Gobernadora','Gobernadoras',
          'Senador','Senadores','Senadora','Senadoras',
          'Diputado','Diputados','Diputada','Diputadas',
          'Embajador','Embajadores','Embajadora','Embajadoras',
          'Rector','Rectores','Rectora','Rectoras',
        ];
        let firstCargosDone = false;
        let firstCargosPattern = null;
        for (const para of rParas) {
          const pt = para.text || '';
          const reps = new Map(); // frm → {rep, cargoLower}
          for (const cargo of CARGOS_LIST) {
            let pos = -1;
            while ((pos = pt.indexOf(cargo, pos + 1)) !== -1) {
              if (pos === 0) continue;
              const before = pt.substring(0, pos);
              if (/[.?!\u2026\u2014]\s+$/.test(before)) continue;
              const after = pt.substring(pos + cargo.length);
              if (/^\s+[A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00DC\u00D1]/.test(after)) continue;
              const prevChar = pt[pos - 1];
              const frm = prevChar + cargo;
              const cargoLower = cargo.charAt(0).toLowerCase() + cargo.slice(1);
              const rep = prevChar + cargoLower;
              if (!reps.has(frm)) reps.set(frm, {rep, cargoLower});
            }
          }
          for (const [frm, {rep, cargoLower}] of reps) {
            try {
              const sr = para.search(frm, {matchCase:true, matchWholeWord:false, matchWildcards:false});
              sr.load('items'); await ctx.sync();
              for (const item of sr.items) {
                if (!firstCargosDone) {
                  const prevChar = frm.charAt(0);
                  item.insertText(prevChar + '\u25C6' + cargoLower, 'Replace');
                  firstCargosPattern = '\u25C6' + cargoLower.substring(0, Math.min(cargoLower.length, 5));
                  firstCargosDone = true;
                } else {
                  item.insertText(rep, 'Replace');
                }
              }
              await ctx.sync();
            } catch(e) {}
          }
        }
        if (firstCargosPattern) await _styleAndComment(ctx, body, firstCargosPattern, SYMCOL, COMMENT_CARGOS);
      } catch(e) { console.warn('[ortotypo] reglas nuevas:', e.message); }
    });
  }

  // ── MAPA DE PÁGINAS ───────────────────────────────────────────────────────
  async buildPageMap(findings, selectionText = '') {
    const pageMap = {};
    const WPP = 424;
    console.log('[PAGEMAP] selectionText length=', selectionText ? selectionText.length : 0);
    if (selectionText) {
      const normSel = selectionText.replace(/\r\n?/g, '\n');
      const lowerSel = normSel.toLowerCase();
      let hits = 0, misses = 0;
      for (const f of findings) {
        const raw = (f.originalText||'').replace(/[\r\n]+/g,' ').trim();
        const st = raw.substring(0,60).toLowerCase();
        if (!st || st.length < 3 || pageMap[f.originalText]) continue;
        const charPos = lowerSel.indexOf(st);
        if (charPos >= 0) {
          const wordsBefore = normSel.substring(0, charPos).split(/\s+/).filter(Boolean).length;
          pageMap[f.originalText] = Math.max(1, Math.ceil((wordsBefore + 1) / WPP));
          hits++;
        } else { misses++; }
      }
      console.log('[PAGEMAP] hits=', hits, 'misses=', misses, 'entries=', Object.keys(pageMap).length);
      return pageMap;
    }
    try {
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        body.load('paragraphs'); await ctx.sync();
        const paras = body.paragraphs.items;
        paras.forEach(p=>p.load('text')); await ctx.sync();
        console.log('[PAGEMAP-FB] párrafos=', paras.length);
        if (paras.length > 0) console.log('[PAGEMAP-FB] primer párrafo=', (paras[0].text||'').substring(0,80));
        let wc = 0;
        const positions = paras.map(p => {
          const words = (p.text||'').trim().split(/\s+/).filter(Boolean).length;
          const start = wc; wc += words;
          return {text:(p.text||'').trim(), start};
        });
        const totalWords = wc;
        console.log('[PAGEMAP-FB] total words en doc=', totalWords);
        for (const f of findings) {
          const st = (f.originalText||'').substring(0,60).toLowerCase();
          if (!st || st.length<3 || pageMap[f.originalText]) continue;
          const match = positions.find(p=>p.text.toLowerCase().includes(st));
          if (match) pageMap[f.originalText] = Math.max(1, Math.ceil((match.start+1)/WPP));
        }
        console.log('[PAGEMAP-FB] pageMap entries=', Object.keys(pageMap).length);
      });
    } catch(e) { console.log('[PAGEMAP-FB] error=', e.message); }
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
      const h2b = body.insertParagraph('Detalle de errores por orden de aparici\u00F3n','End'); h2b.font.bold=true; h2b.font.size=13; h2b.font.color='1a1a2e';

      // Flatten all findings with their category label, then sort by page
      const allFlat = [];
      for (const result of allResults) {
        for (const f of result.findings) {
          allFlat.push({ f, label: result.label });
        }
      }
      allFlat.sort((a, b) => {
        const pa = pageMap[a.f.originalText] || 9999;
        const pb = pageMap[b.f.originalText] || 9999;
        return pa - pb;
      });

      for (let i=0; i<allFlat.length; i++) {
        const { f, label } = allFlat[i];
        let raw = f.originalText||'';
        if (!raw) {
          if (f.occurrences?.[0]) raw=f.occurrences[0];
          else if (f.occurrence1?.text) raw=f.occurrence1.text;
          else if (f.occurrence?.text)  raw=f.occurrence.text;
        }
        raw = raw.replace(/[\r\n]+/g,' ').trim();
        const preview = raw ? `\u00AB${raw.substring(0,100)}${raw.length>100?'\u2026':''}\u00BB` : '(sin texto)';

        const np = body.insertParagraph(`${i+1}.  ${preview}`,'End'); np.font.bold=true; np.font.size=12; np.font.italic=false; np.font.color='0f3460';

        const catP = body.insertParagraph(`[${label}]`,'End'); catP.font.size=10; catP.font.bold=false; catP.font.italic=true; catP.font.color='666666';

        const comment = buildCommentText([f]);
        if (comment) {
          const cp = body.insertParagraph(comment.replace(/[\r\n]+/g,'\n').substring(0,600),'End'); cp.font.size=11; cp.font.italic=false; cp.font.bold=false; cp.font.color='333333';
        }
        const sep = body.insertParagraph('','End'); sep.font.size=11; sep.font.bold=false;
      }

      await ctx.sync();
    });
  }

  // ── BUILD OUTPUT ──────────────────────────────────────────────────────────
  async buildOutput(allResults, resolvedFindings, originalName, selectedIds, selectionText = '', includeSummary = true) {
    const revisionName = await this.getRevisionName(originalName);
    const statsName    = this.getStatsName(revisionName);
    const allFindings  = allResults.flatMap(r=>r.findings);
    const pageMap      = await this.buildPageMap(allFindings, selectionText);

    if (this.outputMode === 'marked') {
      await this.applyMarkings(resolvedFindings, selectionText);
      await this.highlightBrackets();
      if (includeSummary) await this.appendStatsReport(allResults, pageMap);
      return {mode:'marked', revisionName, statsName, totalFindings:resolvedFindings.length, includeSummary};
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
