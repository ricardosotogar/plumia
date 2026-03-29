// ============================================================================
// PLUMIA — document-builder.js  v5
// Arquitectura de DOS PASADAS para marcado fiable en Word JS API:
//   Pasada 1: inserta marcadores de texto únicos en el documento
//   Pasada 2: reemplaza cada marcador con ◆ en un Word.run fresco
// ============================================================================
(function() {

const SYMBOL_COLORS = {
  'leismo':                'FF0000',
  'adverbios_mente':       '2E7D00',
  'repeticion_lexica':     'B8860B',
  'verbos_comedin':        'CC5500',
  'sustantivos_genericos': 'CC5500',
  'muletillas':            'CC5500',
  'pleonasmos':            'CC5500',
  'voz_pasiva':            '0097C8',
  'tiempos_verbales':      '0055A0',
  'nombres_propios':       '0055A0',
  'gerundios':             '0055A0',
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

// ── DOCUMENTBUILDER ───────────────────────────────────────────────────────────
window.PLUMIA.DocumentBuilder = class DocumentBuilder {
  constructor(outputMode) {
    this.outputMode      = outputMode;
    this._markerIdx      = 0;
    this._pendingMarkers = []; // {marker, superscript, colorHex, commentText, isEnd}
  }

  async getRevisionName(n) { return n.replace(/\s*REVISION\s*/i,'').trim() + ' REVISION'; }
  getStatsName(n)          { return n.replace('REVISION','ESTADISTICAS'); }

  // ── Extraer pronombre erróneo ─────────────────────────────────────────────
  _extractPronoun(f) {
    const origW = (f.originalText||'').split(/\s+/);
    const corrW = (f.correction   ||'').split(/\s+/);
    for (let i=0; i<origW.length && i<corrW.length; i++) {
      if (origW[i].toLowerCase() !== corrW[i].toLowerCase()) return origW[i];
    }
    const m = (f.originalText||'').match(/\b(la|le|lo|las|les|los)\b/i);
    return m ? m[1] : null;
  }

  // ── Extraer palabra clave por tipo ────────────────────────────────────────
  _getKeyText(f) {
    switch(f.correctionId) {
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

  // ── PASADA 1A: insertar marcador antes del pronombre ─────────────────────
  async _markPronoun(ctx, body, range, finding, colorHex, commentText) {
    const pronoun = this._extractPronoun(finding);

    // Si no podemos aislar el pronombre, marcar la frase completa como word mark
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

    if (origPos === -1) {
      // Fallback: buscar el pronombre directamente en el párrafo
      const psr2 = para.search(pronoun, {matchCase:false,matchWholeWord:true,matchWildcards:false});
      psr2.load('items'); await ctx.sync();
      if (!psr2.items.length) return;
      const target = psr2.items[0];
      target.font.color = colorHex;
      const idxFb = this._markerIdx++;
      const mkFb  = `PLMX${idxFb}X`;
      const mkcFb = commentText ? `PLMK${idxFb}K` : null;
      if (mkcFb) target.getRange('Start').insertText(mkcFb, 'Before');
      target.getRange('Start').insertText(mkFb, 'Before');
      await ctx.sync();
      this._pendingMarkers.push({markerSymbol:mkFb, markerComment:mkcFb, superscript:null, colorHex, commentText});
      return;
    }

    const pInOrig    = origLower.indexOf(pLower);
    const absPos     = origPos + pInOrig;
    const before     = paraText.substring(0, absPos);
    const nBefore    = (before.match(new RegExp('\\b'+pLower+'\\b','gi'))||[]).length;
    const psr = para.search(pronoun, {matchCase:false,matchWholeWord:true,matchWildcards:false});
    psr.load('items'); await ctx.sync();
    if (!psr.items.length) return;
    const target = psr.items[Math.min(nBefore, psr.items.length-1)];
    target.font.color = colorHex;
    const idx = this._markerIdx++;
    const mks = `PLMX${idx}X`;
    const mkc = commentText ? `PLMK${idx}K` : null;
    // Insertar PLMX + PLMK (comment anchor) juntos antes del pronombre
    if (mkc) target.getRange('Start').insertText(mkc, 'Before');
    target.getRange('Start').insertText(mks, 'Before');
    await ctx.sync();
    this._pendingMarkers.push({markerSymbol:mks, markerComment:mkc, superscript:null, colorHex, commentText});
  }

  // ── PASADA 1B: insertar marcador antes de palabra clave ──────────────────
  async _markWord(ctx, body, range, finding, colorHex, commentText) {
    const corrId  = finding.correctionId;
    const keyText = this._getKeyText(finding);
    if (!keyText || keyText.length < 2) return;
    const hl = HIGHLIGHT[corrId];
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
    if (hl) target.font.highlightColor = hl;
    const idx = this._markerIdx++;
    const mks = `PLMX${idx}X`;
    const mkc = commentText ? `PLMK${idx}K` : null;
    if (mkc) target.getRange('Start').insertText(mkc, 'Before');
    target.getRange('Start').insertText(mks, 'Before');
    await ctx.sync();
    this._pendingMarkers.push({markerSymbol:mks, markerComment:mkc, superscript:null, colorHex, commentText});
  }

  // ── PASADA 1C: insertar marcadores de inicio y fin ────────────────────────
  async _markBrackets(ctx, body, range, finding, colorHex, commentText) {
    const idxs = this._markerIdx++;
    const idxe = this._markerIdx++;
    const mks  = `PLMX${idxs}X`; // inicio → ◆¹
    const mke  = `PLMX${idxe}X`; // fin    → ◆²
    const mkc  = commentText ? `PLMK${idxs}K` : null; // ancla de comentario

    // ATÓMICO: fin primero, luego inicio + ancla comentario — un solo sync
    range.getRange('End').insertText(mke, 'After');
    if (mkc) range.getRange('Start').insertText(mkc, 'Before');
    range.getRange('Start').insertText(mks, 'Before');
    await ctx.sync();

    this._pendingMarkers.push({markerSymbol:mks, markerComment:mkc, superscript:'\u00B9', colorHex, commentText});
    this._pendingMarkers.push({markerSymbol:mke, markerComment:null, superscript:'\u00B2', colorHex, commentText:null});
  }

  // ── PASADA 1: aplicar un finding ─────────────────────────────────────────
  async _applyFinding(ctx, body, finding) {
    const corrId   = finding.correctionId;
    const colorHex = SYMBOL_COLORS[corrId] || '555555';
    const comment  = buildCommentText(finding.mergedFindings || [finding]);
    const search   = (finding.originalText||'').replace(/[\r\n]+/g,' ').trim();
    if (!search || search.length < 3) return;

    const sr = body.search(search.substring(0,80), {matchCase:false,matchWholeWord:false,matchWildcards:false});
    sr.load('items'); await ctx.sync();
    let range;
    if (sr.items.length) {
      range = sr.items[0];
    } else {
      const shorter = search.substring(0,40);
      if (shorter.length < 5) return;
      const sr2 = body.search(shorter, {matchCase:false,matchWholeWord:false,matchWildcards:false});
      sr2.load('items'); await ctx.sync();
      if (!sr2.items.length) return;
      range = sr2.items[0];
    }

    if (corrId === 'leismo')            await this._markPronoun (ctx, body, range, finding, colorHex, comment);
    else if (BRACKET_TYPES.has(corrId)) await this._markBrackets(ctx, body, range, finding, colorHex, comment);
    else                                await this._markWord    (ctx, body, range, finding, colorHex, comment);
  }

  // ── PASADA 2: reemplazar UN marcador con ◆ en Word.run fresco ────────────
  // Estrategia: cada ◆ que lleva comentario tiene DOS marcadores en el documento:
  //   PLMX14X → se reemplaza por ◆ (símbolo visual)
  //   PLMK14K → se usa para anclar el comentario y luego se borra
  // Los marcadores de ◆² solo tienen PLMX, nunca PLMK.
  async _replaceSingleMarker(pending) {
    const {markerSymbol, markerComment, superscript, colorHex, commentText} = pending;
    const symbol = '\u25C6' + (superscript || '');

    // Word.run 1: reemplazar PLMX → ◆
    await Word.run(async (ctx) => {
      const body = ctx.document.body;
      const sr = body.search(markerSymbol, {matchCase:true,matchWholeWord:false,matchWildcards:false});
      sr.load('items'); await ctx.sync();
      if (!sr.items.length) { console.warn('Plumia: no encontrado:', markerSymbol); return; }
      const d = sr.items[0];
      d.insertText(symbol, 'Replace');
      d.font.color = colorHex; d.font.bold = true;
      d.font.highlightColor = 'None'; d.font.size = 18;
      await ctx.sync();
    });

    // Word.run 2: insertar comentario en PLMK y borrarlo
    if (markerComment && commentText) {
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        const sr = body.search(markerComment, {matchCase:true,matchWholeWord:false,matchWildcards:false});
        sr.load('items'); await ctx.sync();
        if (!sr.items.length) return;
        const d = sr.items[0];
        const safe = commentText.replace(/[\r\n]+/g,' | ').substring(0, 400);
        try { d.insertComment(safe); } catch(e) { console.warn('Plumia comment:', e.message); }
        // Borrar el marcador de comentario (reemplazar por texto vacío)
        d.insertText('', 'Replace');
        await ctx.sync();
      });
    }
  }

  // ── APPLY MARKINGS ────────────────────────────────────────────────────────
  async applyMarkings(resolvedFindings) {
    if (!resolvedFindings || !resolvedFindings.length) return;

    const ortotypo = resolvedFindings.filter(f => f.directFix);
    const others   = resolvedFindings.filter(f => !f.directFix && f.originalText);

    if (ortotypo.length) await this.applyOrtotypography();
    if (!others.length)  return;

    this._markerIdx      = 0;
    this._pendingMarkers = [];

    // ── PASADA 1: insertar todos los marcadores de texto ───────────────────
    // BATCH=1: cada finding en su propio Word.run para evitar que inserciones
    // simultáneas desplacen marcadores de otros findings del mismo lote.
    const BATCH = 1;
    for (let i = 0; i < others.length; i += BATCH) {
      const batch = others.slice(i, i + BATCH);
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        for (const f of batch) {
          try { await this._applyFinding(ctx, body, f); }
          catch(e) { console.warn('Plumia P1:', (f.originalText||'').substring(0,30), e.message); }
        }
      });
    }

    // ── PASADA 2: reemplazar cada marcador con ◆ en Word.run fresco ────────
    for (const pending of this._pendingMarkers) {
      try { await this._replaceSingleMarker(pending); }
      catch(e) { console.warn('Plumia P2:', pending.marker, e.message); }
    }
  }

  async highlightBrackets() { /* vacío — ya no hay corchetes */ }

  // ── ORTOTIPOGRAFÍA ────────────────────────────────────────────────────────
  async applyOrtotypography() {
    await Word.run(async (ctx) => {
      const body = ctx.document.body;
      body.load('paragraphs'); await ctx.sync();
      const paras = body.paragraphs.items;
      paras.forEach(p => p.load('text')); await ctx.sync();

      let firstDashDone = false;
      let firstExclDone = false;

      // 1. Guiones al inicio de párrafo → raya
      for (const para of paras) {
        const trimmed = (para.text||'').trimStart();
        if (/^-/.test(trimmed)) {
          try {
            const sr = para.search('-', {matchCase:true,matchWholeWord:false,matchWildcards:false});
            sr.load('items'); await ctx.sync();
            if (sr.items.length) {
              sr.items[0].insertText('—','Replace'); sr.items[0].font.bold=true;
              if (!firstDashDone) {
                try { sr.items[0].insertComment('Ortotipografía: guión corto (-) corregido a raya (—) en todo el documento.'); } catch(e){}
                firstDashDone = true;
              }
              for (let i=1;i<sr.items.length;i++) { sr.items[i].insertText('—','Replace'); sr.items[i].font.bold=true; }
            }
            await ctx.sync();
          } catch(e) {}
        }
      }

      // 2. Guiones internos (" -letra") → raya
      try {
        const isr = body.search(' -[a-zA-Z]', {matchCase:false,matchWholeWord:false,matchWildcards:true});
        isr.load('items'); await ctx.sync();
        for (const r of isr.items) {
          r.load('text'); await ctx.sync();
          const t = r.text||'';
          if (t.length>=3) { r.insertText(' —'+t.charAt(t.length-1),'Replace'); r.font.bold=true; }
        }
        await ctx.sync();
      } catch(e) {}

      // 3. ¡ usado como cierre (letra+¡)
      paras.forEach(p=>p.load('text')); await ctx.sync();
      for (const para of paras) {
        const m = (para.text||'').match(/(\w)(¡)/);
        if (m) {
          try {
            const sr = para.search(m[1]+'¡', {matchCase:true,matchWholeWord:false,matchWildcards:false});
            sr.load('items'); await ctx.sync();
            for (const r of sr.items) {
              r.insertText(m[1]+'!','Replace'); r.font.bold=true;
              if (!firstExclDone) {
                try { r.insertComment('Ortotipografía: signo de cierre ¡ corregido a !'); } catch(e){}
                firstExclDone=true;
              }
            }
            await ctx.sync();
          } catch(e) {}
        }
      }

      // 4. Comillas rectas → españolas
      try {
        const qr = body.search('"', {matchCase:true,matchWholeWord:false,matchWildcards:false});
        qr.load('items'); await ctx.sync();
        for (let i=0;i<qr.items.length;i++) {
          qr.items[i].insertText(i%2===0?'\u00AB':'\u00BB','Replace'); qr.items[i].font.bold=true;
          if (i===0) { try { qr.items[i].insertComment('Ortotipografía: comillas inglesas corregidas a «»'); } catch(e){} }
        }
        await ctx.sync();
      } catch(e) {}

      // 5. Comillas tipográficas curvas → españolas
      for (const [s,r] of [['\u201c','\u00AB'],['\u201d','\u00BB'],['\u2018','\u00AB'],['\u2019','\u00BB']]) {
        try {
          const sr = body.search(s,{matchCase:true,matchWholeWord:false,matchWildcards:false});
          sr.load('items'); await ctx.sync();
          for (const item of sr.items) { item.insertText(r,'Replace'); item.font.bold=true; }
          await ctx.sync();
        } catch(e) {}
      }

      // 6. Tres puntos → puntos suspensivos
      try {
        const dr = body.search('...',{matchCase:true,matchWholeWord:false,matchWildcards:false});
        dr.load('items'); await ctx.sync();
        for (const item of dr.items) { item.insertText('\u2026','Replace'); item.font.bold=true; }
        await ctx.sync();
      } catch(e) {}

      // 7. Espacio antes de puntuación
      for (const sign of [' ,', ' ;', ' :', ' .']) {
        try {
          const sr = body.search(sign,{matchCase:true,matchWholeWord:false,matchWildcards:false});
          sr.load('items'); await ctx.sync();
          for (const item of sr.items) { item.insertText(sign.trim(),'Replace'); item.font.bold=true; }
          await ctx.sync();
        } catch(e) {}
      }
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

      // Título — sync inmediato para cortar herencia de tamaño
      const title = body.insertParagraph('INFORME DE INCIDENCIAS \u2014 PLUMIA','End');
      title.font.bold=true; title.font.size=28; title.font.color='1a1a2e';
      await ctx.sync();

      // Reset explícito
      const rp0 = body.insertParagraph('','End'); rp0.font.size=22; rp0.font.bold=false;

      // Resumen
      const h2a = body.insertParagraph('Resumen por categor\u00EDa','End'); h2a.font.bold=true; h2a.font.size=24; h2a.font.color='1a1a2e';

      for (const result of allResults) {
        if (!result.findings.length) continue;
        const bp = body.insertParagraph(`\u2022 ${result.label}: ${result.findings.length} incidencia${result.findings.length!==1?'s':''}`, 'End'); bp.font.size=22; bp.font.bold=false; bp.font.color='222222';
      }

      const tp = body.insertParagraph(`Total: ${total} incidencias detectadas`,'End'); tp.font.bold=true; tp.font.size=22; tp.font.color='1a1a2e';

      await ctx.sync(); // sync antes del detalle

      const rp1 = body.insertParagraph('','End'); rp1.font.size=22; rp1.font.bold=false;

      const h2b = body.insertParagraph('Detalle por categor\u00EDa','End'); h2b.font.bold=true; h2b.font.size=24; h2b.font.color='1a1a2e';

      for (const result of allResults) {
        if (!result.findings.length) continue;
        const ct = body.insertParagraph(`${result.label}  (${result.findings.length} incidencia${result.findings.length!==1?'s':''})`, 'End'); ct.font.bold=true; ct.font.size=22; ct.font.color='0f3460';

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

          const np = body.insertParagraph(`${i+1}.  ${preview}${suffix}`,'End'); np.font.bold=true; np.font.size=22; np.font.italic=false; np.font.color='0f3460';

          const comment = buildCommentText([f]);
          if (comment) {
            const cp = body.insertParagraph(comment.replace(/[\r\n]+/g,'\n').substring(0,600),'End'); cp.font.size=20; cp.font.italic=false; cp.font.bold=false; cp.font.color='333333';
          }
          const sep = body.insertParagraph('','End'); sep.font.size=20; sep.font.bold=false;
        }

        const gap = body.insertParagraph('','End'); gap.font.size=22; gap.font.bold=false;
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
        if (text.length>100) {
          const cut=text.substring(0,100);
          const ls=Math.max(cut.lastIndexOf(' '),cut.lastIndexOf(','),cut.lastIndexOf('.'));
          text = ls>60 ? cut.substring(0,ls).trimEnd() : cut;
        }
        return {...f, originalText:text};
      })
    }));
  }
};

})();
