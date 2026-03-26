// ============================================================================
// PLUMIA — document-builder.js
// buildCommentText, DocumentBuilder: marcas en Word, informe de incidencias
// Depende de: corrections-config.js (COLOR_MAP, CONFIG)
// ============================================================================
(function() {
var COLOR_MAP  = window.PLUMIA.COLOR_MAP;
var CONFIG     = window.PLUMIA.CONFIG;

var WORD_HIGHLIGHT = {
  'FFD966':'Yellow','92D050':'Green','FF9900':'Orange','00B0F0':'Cyan',
  'FF69B4':'Pink','C9B8FF':'Violet','7030A0':'DarkMagenta',
};

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
      return `Verbo comodín «${f.verb}»: ${f.explanation} Alternativas: ${(f.alternatives||[]).join(', ')}.`;
    case 'sustantivos_genericos':
      return `Sustantivo genérico «${f.genericWord}»: ${f.explanation} Alternativas: ${(f.alternatives||[]).join(', ')}.`;
    case 'muletillas':
      return `Muletilla «${f.expression}»: aparece repetidamente. ${f.alternatives?.filter(a=>a!=='eliminar').length?'Alternativas: '+f.alternatives.join(', ')+'.':'Valora eliminarla.'}`;
    case 'pleonasmos':
      return `Pleonasmo: ${f.explanation} Corrección: «${f.correction}».`;
    case 'adverbios_mente':
      return `Adverbio -mente: ${f.explanation} ${f.alternatives?.length?'Alternativas: '+f.alternatives.join(', ')+'.':''}`;
    case 'voz_pasiva':
      return `Voz pasiva: ${f.explanation} Posible versión activa: «${f.activeVersion}».`;
    case 'frases_largas':
      return `Frase larga (${f.wordCount} palabras): ${f.explanation} ${f.suggestion?'Sugerencia: '+f.suggestion:''}`;
    case 'nombres_propios':
      return `Exceso de nombres propios: «${f.name}» se repite varias veces cerca. ${f.suggestion||''}`;
    case 'ritmo_narrativo':
      return `Ritmo narrativo: ${f.issue} ${f.suggestion?'Sugerencia: '+f.suggestion:''}`;
    case 'gerundios':
      return `Gerundio incorrecto (${f.errorType}): ${f.explanation} Corrección: «${f.correction}».`;
    case 'dequeismo':
      return `${f.errorType==='dequeismo'?'Dequeísmo':'Queísmo'}: ${f.explanation} Corrección: «${f.correction}».`;
    case 'concordancia':
      return `Concordancia (${f.errorType}): ${f.explanation} Corrección: «${f.correction}».`;
    case 'tiempos_verbales':
      return `Tiempo verbal: ${f.explanation} ${f.suggestion?'Sugerencia: '+f.suggestion:''}`;
    case 'ortotipografia_pura':
      return f.isFirstOccurrence ? `Ortotipografía corregida en todo el documento: ${f.explanation}` : null;
    case 'puntuacion_dialogo':
      return `Puntuación de diálogo (${f.errorType}): ${f.explanation} Corrección: «${f.correction}».`;
    case 'coherencia_personajes': case 'coherencia_temporal': case 'coherencia_objetos':
    case 'coherencia_conocimiento': case 'tono_voz': case 'nombres_inconsistentes': case 'pov':
      return _coherenceComment(f);
    default:
      return `${label}: ${f.explanation||''}`;
  }
}

function _coherenceComment(f) {
  let c = `COHERENCIA — ${f.label||'Coherencia narrativa'}:\n`;
  if (f.occurrence1) c += `· ${f.occurrence1.location||'Primera mención'}: «${f.occurrence1.text}»\n`;
  if (f.occurrence2) c += `· ${f.occurrence2.location||'Segunda mención'}: «${f.occurrence2.text}»\n`;
  return (c + (f.explanation||'')).trim();
}


window.PLUMIA.DocumentBuilder = class DocumentBuilder {
  constructor(outputMode) { this.outputMode = outputMode; }

  async getRevisionName(originalName) {
    const base = originalName.replace(/\s*REVISION\s*/i, '').trim();
    return `${base} REVISION`;
  }

  getStatsName(revisionName) {
    return revisionName.replace('REVISION', 'ESTADISTICAS');
  }

  async applyMarkings(resolvedFindings) {
    if (!resolvedFindings || !resolvedFindings.length) return;

    // Separar ortotipografía del resto
    const ortotypoFindings = resolvedFindings.filter(f => f.directFix);
    const otherFindings    = resolvedFindings.filter(f => !f.directFix && f.originalText);

    if (ortotypoFindings.length > 0) {
      await this.applyOrtotypography();
    }

    if (otherFindings.length === 0) return;

    // Aplicar marcas en lotes de 10 para evitar timeouts de Word
    const BATCH = 10;
    for (let i = 0; i < otherFindings.length; i += BATCH) {
      const batch = otherFindings.slice(i, i + BATCH);
      await Word.run(async (ctx) => {
        const body = ctx.document.body;
        for (const finding of batch) {
          // Limpiar: quitar saltos de línea, colapsar espacios, limitar a 80 chars
          const rawText = (finding.originalText || '').replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
          const searchText = rawText.substring(0, 80).trim();
          if (!searchText || searchText.length < 3) continue;
          try {
            const sr = body.search(searchText, {matchCase:false, matchWholeWord:false, matchWildcards:false});
            sr.load('items'); await ctx.sync();
            if (!sr.items.length) {
              // Si no encontró el texto exacto, intentar con los primeros 40 chars
              const shorter = searchText.substring(0, 40);
              if (shorter !== searchText && shorter.length >= 5) {
                const sr2 = body.search(shorter, {matchCase:false, matchWholeWord:false, matchWildcards:false});
                sr2.load('items'); await ctx.sync();
                if (sr2.items.length) {
                  await this._applyMark(ctx, sr2.items[0], finding);
                }
              }
              continue;
            }

            // Para repeticiones léxicas, marcar todas las ocurrencias
            if (finding.correctionId === 'repeticion_lexica') {
              const toMark = finding.mergedFindings?.[0]?.occurrences || [];
              // Marcar hasta 3 ocurrencias para evitar sobrecargar el documento
              const limit = Math.min(sr.items.length, 3);
              for (let j = 0; j < limit; j++) {
                await this._applyMark(ctx, sr.items[j], finding);
              }
            } else {
              await this._applyMark(ctx, sr.items[0], finding);
            }
            await ctx.sync();
          } catch(e) {
            console.warn('Plumia: error marcando «' + searchText.substring(0,30) + '»:', e.message);
          }
        }
      });
    }
  }

  // Aplica correcciones ortotipográficas globalmente usando search-replace de Word
  async applyOrtotypography() {
    await Word.run(async (ctx) => {
      const body = ctx.document.body;


      // ── 1. GUIONES DE DIÁLOGO ─────────────────────────────────────────────
      // Sustituir guión corto de diálogo (-) por raya (—)
      // Casos: párrafo que empieza con - (inicio de intervención)
      //        y - seguido de espacio en mitad del párrafo (acotación: -dijo-)
      body.load('paragraphs'); await ctx.sync();
      const paras = body.paragraphs.items;
      paras.forEach(p => p.load('text')); await ctx.sync();

      let firstDashCommentDone = false;

      for (const para of paras) {
        const text    = (para.text || '');
        const trimmed = text.trimStart();

        // Caso A: párrafo que empieza con guión (cualquier carácter tras él)
        // Cubre: "-hola", "- hola", "-¡Estoy"
        if (/^-/.test(trimmed)) {
          try {
            const sr = para.search('-', {matchCase:true, matchWholeWord:false, matchWildcards:false});
            sr.load('items'); await ctx.sync();
            if (sr.items.length > 0) {
              // Reemplazar todos los guiones del párrafo que preceden un espacio o están al inicio
              // Primero el guión inicial
              sr.items[0].insertText('—', 'Replace');
              sr.items[0].font.bold = true;
              if (!firstDashCommentDone) {
                try { sr.items[0].insertComment('Ortotipografía: guión corto (-) corregido a raya de diálogo (—) en todos los párrafos de diálogo.'); } catch(ce) {}
                firstDashCommentDone = true;
              }
              // Caso B: guiones internos del mismo párrafo (acotaciones: " -dijo ")
              // Buscar patrones " -letra" dentro del párrafo
              for (let i = 1; i < sr.items.length; i++) {
                sr.items[i].load('text'); await ctx.sync();
                // Solo sustituir si el guión va precedido de espacio (acotación de diálogo)
                // No podemos acceder al carácter anterior directamente, así que
                // buscamos el patrón " -" en el texto para validar
                const fullText = para.text || '';
                // Heurística: si hay más de un guión en el párrafo, todos son de diálogo
                sr.items[i].insertText('—', 'Replace');
                sr.items[i].font.bold = true;
              }
            }
            await ctx.sync();
          } catch(e) { console.warn('Plumia ortotypo guion:', e); }
        }
      }

      // ── 1b. SIGNO DE CIERRE ¡ INCORRECTO ──────────────────────────────────
      // Detectar ¡ usado como cierre (debería ser !)
      // Patrón: cualquier texto seguido de ¡ que NO sea inicio de frase
      try {
        const excResults = body.search('¡', {matchCase:true, matchWholeWord:false, matchWildcards:false});
        excResults.load('items'); await ctx.sync();
        for (const r of excResults.items) {
          r.load('text'); await ctx.sync();
          // Buscar ¡ precedida de letra o número (cierre incorrecto)
          // Expandir el contexto para ver el carácter anterior
          const expanded = r.getRange('Whole');
          expanded.load('text'); await ctx.sync();
          // Si encontramos ¡ que no es el primer carácter del párrafo,
          // verificar si debería ser !
          // Estrategia: buscar el patrón [a-záéíóúüñA-Z0-9]¡ directamente
        }
        await ctx.sync();
      } catch(e) {}

      // Búsqueda directa del patrón ¡ al final (cierre incorrecto)
      // Word no soporta regex en search, así que buscamos párrafos que terminen en ¡
      for (const para of paras) {
        const text = (para.text || '').trimEnd();
        if (text.endsWith('¡') && !text.startsWith('¡')) {
          // Este párrafo termina con ¡ incorrecto → reemplazar la última ¡ por !
          try {
            const sr = para.search('¡', {matchCase:true, matchWholeWord:false, matchWildcards:false});
            sr.load('items'); await ctx.sync();
            if (sr.items.length > 0) {
              // Tomar el ÚLTIMO resultado (el del cierre incorrecto)
              const last = sr.items[sr.items.length - 1];
              last.insertText('!', 'Replace');
              last.font.bold = true;
              try { last.insertComment('Ortotipografía: signo de cierre ¡ incorrecto, corregido a !'); } catch(ce) {}
            }
            await ctx.sync();
          } catch(e) { console.warn('Plumia ortotypo signo cierre:', e); }
        }
      }

      // ── 2. COMILLAS ASCII RECTAS → ESPAÑOLAS ──────────────────────────────
      try {
        const results = body.search('"', {matchCase:true, matchWholeWord:false, matchWildcards:false});
        results.load('items'); await ctx.sync();
        for (let i = 0; i < results.items.length; i++) {
          const replacement = (i % 2 === 0) ? '«' : '»';
          results.items[i].insertText(replacement, 'Replace');
          results.items[i].font.bold = true;
          // Comentario explicativo solo en la primera ocurrencia
          if (i === 0) {
            try { results.items[i].insertComment('Ortotipografía: comillas inglesas (" ") corregidas a españolas («»). Cambio aplicado en todo el documento.'); } catch(ce) {}
          }
        }
        await ctx.sync();
      } catch(e) { console.warn('Plumia ortotypo comillas rectas:', e); }

      // Comillas tipográficas curvas → españolas
      for (const [search, replacement] of [['\u201c','«'],['\u201d','»'],['\u2018','«'],['\u2019','»']]) {
        try {
          const results = body.search(search, {matchCase:true, matchWholeWord:false, matchWildcards:false});
          results.load('items'); await ctx.sync();
          for (const r of results.items) {
            r.insertText(replacement, 'Replace');
            r.font.bold = true;
          }
          await ctx.sync();
        } catch(e) {}
      }

      // ── 3. TRES PUNTOS → PUNTOS SUSPENSIVOS ──────────────────────────────
      try {
        const results = body.search('...', {matchCase:true, matchWholeWord:false, matchWildcards:false});
        results.load('items'); await ctx.sync();
        for (const r of results.items) {
          r.insertText('…', 'Replace');
          r.font.bold = true;
        }
        await ctx.sync();
      } catch(e) {}

      // ── 4. ESPACIO ANTES DE SIGNOS DE PUNTUACIÓN ─────────────────────────
      for (const sign of [' ,', ' ;', ' :', ' .']) {
        try {
          const results = body.search(sign, {matchCase:true, matchWholeWord:false, matchWildcards:false});
          results.load('items'); await ctx.sync();
          for (const r of results.items) {
            r.insertText(sign.trim(), 'Replace');
            r.font.bold = true;
          }
          await ctx.sync();
        } catch(e) {}
      }

    });
  }

  async _applyMark(ctx, range, finding) {
    const colorEntry = finding.colorId ? COLOR_MAP[finding.colorId] : null;
    if (finding.directFix) {
      if (finding.correction) { range.insertText(finding.correction, 'Replace'); range.font.bold = true; }
    } else if (colorEntry?.type === 'bracket') {
      range.getRange('Start').insertText('[', 'Before');
      range.getRange('End').insertText(']', 'After');
    } else if (colorEntry?.type === 'highlight') {
      range.font.highlightColor = WORD_HIGHLIGHT[colorEntry.hex] || 'Yellow';
    } else if (colorEntry?.type === 'text') {
      range.font.color = colorEntry.hex;
    }
    const commentText = buildCommentText(finding.mergedFindings || [finding]);
    if (commentText) { try { range.insertComment(commentText); } catch(e) {} }
  }

  async highlightBrackets() {
    await Word.run(async (ctx) => {
      for (const char of ['[',']']) {
        const results = ctx.document.body.search(char, {matchCase:true});
        results.load('items'); await ctx.sync();
        for (const r of results.items) { r.font.highlightColor = 'Pink'; r.font.bold = true; }
      }
      await ctx.sync();
    });
  }

  async appendStatsReport(allResults) {
    const total = allResults.reduce((s,r)=>s+r.findings.length,0);
    if (total === 0) return; // nada que añadir

    await Word.run(async (ctx) => {
      const body = ctx.document.body;
      body.insertBreak('Page', 'End');

      // Título principal
      const title = body.insertParagraph('INFORME DE INCIDENCIAS — PLUMIA', 'End');
      title.styleBuiltIn = Word.Style.heading1;

      // Resumen por categoría
      body.insertParagraph('Resumen por categoría', 'End').styleBuiltIn = Word.Style.heading2;
      for (const result of allResults) {
        if (!result.findings.length) continue;
        body.insertParagraph(
          `• ${result.label}: ${result.findings.length} incidencia${result.findings.length!==1?'s':''}`,
          'End'
        );
      }
      const totalPara = body.insertParagraph(`Total: ${total} incidencias detectadas`, 'End');
      totalPara.font.bold = true;

      body.insertParagraph('', 'End');

      // Detalle por categoría
      body.insertParagraph('Detalle por categoría', 'End').styleBuiltIn = Word.Style.heading2;

      for (const result of allResults) {
        if (!result.findings.length) continue;

        // Cabecera de categoría
        const catTitle = body.insertParagraph(
          `${result.label}  (${result.findings.length} incidencia${result.findings.length!==1?'s':''})`,
          'End'
        );
        catTitle.styleBuiltIn = Word.Style.heading3;

        for (let i = 0; i < result.findings.length; i++) {
          const f = result.findings[i];
          // Normalizar originalText para el informe (mismo proceso que en normalizeFindings)
          let rawText = f.originalText || '';
          if (!rawText) {
            if (f.occurrences?.[0]) rawText = f.occurrences[0];
            else if (f.occurrence1?.text) rawText = f.occurrence1.text;
            else if (f.occurrence?.text) rawText = f.occurrence.text;
          }
          rawText = rawText.replace(/[\r\n]+/g, ' ').trim();
          const preview = rawText
            ? `«${rawText.substring(0,100)}${rawText.length>100?'…':''}»`
            : '(sin texto de referencia)';

          // Línea del hallazgo con tamaño fijo para evitar herencia del heading3
          const numPara = body.insertParagraph(`${i+1}.  ${preview}`, 'End');
          numPara.font.bold = true;
          numPara.font.size = 11;
          numPara.font.italic = false;

          // Comentario
          const comment = buildCommentText([f]);
          if (comment) {
            const comPara = body.insertParagraph(comment, 'End');
            comPara.font.size = 10;
            comPara.font.italic = false;
            comPara.font.bold = false;
          }
        }
        body.insertParagraph('', 'End');
      }

      await ctx.sync();
    });
  }

  async buildOutput(allResults, resolvedFindings, originalName, selectedIds) {
    const revisionName = await this.getRevisionName(originalName);
    const statsName    = this.getStatsName(revisionName);
    if (this.outputMode === 'marked') {
      // Modo A: marcas + comentarios + resumen al final
      // NO guardamos automáticamente — el usuario usa "Guardar como" con el nombre sugerido
      await this.applyMarkings(resolvedFindings);
      await this.highlightBrackets();
      await this.appendStatsReport(allResults, false);
      return { mode:'marked', revisionName, statsName, totalFindings:resolvedFindings.length };
    } else {
      // Modo B: solo informe al final
      // NO guardamos automáticamente — el usuario usa "Guardar como"
      await this.appendStatsReport(allResults, false);
      return { mode:'report', revisionName, statsName,
        totalFindings: allResults.reduce((s,r)=>s+r.findings.length,0) };
    }
  }
}

})();
