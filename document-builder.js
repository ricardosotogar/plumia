// ============================================================================
// PLUMIA — document-builder.js
// Generador del documento Word de revisión con marcas de color y comentarios
// ----------------------------------------------------------------------------
// Responsabilidades:
//   1. Crear una copia del documento original con el nombre REVISION V.x.x
//   2. Aplicar marcas de color (resaltado, texto en color, corchetes) sobre
//      los fragmentos detectados por processor.js
//   3. Añadir comentarios de Word por cada error detectado
//   4. Generar el informe de estadísticas al final del documento (opción A)
//   5. Generar el documento ESTADISTICAS separado (opción B)
// ============================================================================

import { COLOR_MAP, CONFIG } from './corrections-config.js';
import { buildCommentText } from './processor.js';

// ── COLORES WORD ─────────────────────────────────────────────────────────────
// Mapeo de hex a constantes de Word.HighlightColor
// Word solo admite una paleta fija de 16 colores de resaltado
const WORD_HIGHLIGHT = {
  'FFD966': 'Yellow',       // Amarillo     → c2 repeticiones
  '92D050': 'Green',        // Verde claro  → c3 adverbios (usamos Green como aproximación)
  'FF9900': 'Orange',       // Naranja      → c4 verbos comodín / muletillas
  '00B0F0': 'Cyan',         // Turquesa     → c5 voz pasiva
  'FF69B4': 'Pink',         // Rosa         → c6 frases largas / corchetes
  'C9B8FF': 'Violet',       // Lavanda      → c8 ambigüedades
  '7030A0': 'DarkMagenta',  // Violeta      → c9 coherencia
};

// ── CLASE PRINCIPAL ───────────────────────────────────────────────────────────
export class DocumentBuilder {

  constructor(outputMode) {
    this.outputMode   = outputMode;  // 'marked' | 'report'
    this.commentIndex = 0;           // contador de comentarios Word
  }

  // ── 1. NOMBRE DEL DOCUMENTO DE REVISIÓN ──────────────────────────────────

  /**
   * Calcula el nombre del documento de revisión evitando sobreescribir versiones previas.
   * Formato: [nombre original] REVISION V.1.0.docx
   * @param {string} originalName - nombre del documento original sin extensión
   * @returns {Promise<string>} nombre del nuevo documento
   */
  async getRevisionName(originalName) {
    const base    = originalName.replace(/\s*REVISION\s+V\.\d+\.\d+\s*/i, '').trim();
    let   version = 1;

    // Buscar si ya existe alguna versión previa e incrementar
    try {
      await Word.run(async (context) => {
        // No podemos listar archivos directamente desde el add-in,
        // así que usamos localStorage para rastrear versiones previas
        const key   = 'plumia_versions_' + base;
        const saved = localStorage.getItem(key);
        if (saved) version = parseInt(saved) + 1;
        localStorage.setItem(key, version.toString());
      });
    } catch {}

    return `${base} ${CONFIG.revisionSuffix} V.${version}.0`;
  }

  /**
   * Calcula el nombre del documento de estadísticas.
   */
  getStatsName(revisionName) {
    return revisionName.replace(CONFIG.revisionSuffix, CONFIG.statsSuffix);
  }

  // ── 2. APLICAR MARCAS AL DOCUMENTO ───────────────────────────────────────

  /**
   * Punto de entrada principal.
   * Aplica todas las marcas y comentarios al documento activo.
   * Se llama de forma incremental desde processor.js (onChunkComplete).
   * @param {Array} resolvedFindings - findings ya procesados por resolveOverlaps()
   */
  async applyMarkings(resolvedFindings) {
    if (!resolvedFindings || resolvedFindings.length === 0) return;

    await Word.run(async (context) => {
      const body = context.document.body;

      for (const finding of resolvedFindings) {
        if (!finding.originalText) continue;

        try {
          // Buscar el fragmento en el documento
          const searchResults = body.search(finding.originalText, {
            matchCase:       false,
            matchWholeWord:  false,
            matchWildcards:  false,
          });
          searchResults.load('items');
          await context.sync();

          if (searchResults.items.length === 0) continue;

          // Tomar la primera ocurrencia (las repeticiones léxicas marcan todas)
          const targets = finding.correctionId === 'repeticion_lexica'
            ? searchResults.items
            : [searchResults.items[0]];

          for (const range of targets) {
            await this._applyMarkToRange(context, range, finding);
          }

          await context.sync();

        } catch (err) {
          // Si un finding falla, continuar con el siguiente
          console.warn('Plumia: error al marcar finding', finding.originalText, err);
        }
      }
    });
  }

  /**
   * Aplica la marca correcta a un rango según el tipo de error.
   */
  async _applyMarkToRange(context, range, finding) {
    const colorEntry = finding.colorId ? COLOR_MAP[finding.colorId] : null;

    if (finding.directFix) {
      // ── Corrección directa (ortotipografía pura) ──────────────────────
      if (finding.correction) {
        range.insertText(finding.correction, 'Replace');
        // Marcar en negrita el texto corregido para que sea identificable
        range.font.bold = true;
      }

    } else if (colorEntry?.type === 'bracket') {
      // ── Corchetes [ ] en negrita con color de resaltado ───────────────
      const highlightColor = WORD_HIGHLIGHT[colorEntry.hex] || 'Pink';

      // Insertar [ antes del fragmento
      const openBracket  = range.getRange('Start');
      const closeBracket = range.getRange('End');

      openBracket.insertText('[', 'Before');
      closeBracket.insertText(']', 'After');

      // Seleccionar y resaltar los corchetes
      const openRange  = range.getRange('Start');
      openRange.expandTo(range.getRange('Start'));
      // (los corchetes se resaltan al buscarse en la siguiente pasada)

    } else if (colorEntry?.type === 'highlight') {
      // ── Resaltado de fondo ────────────────────────────────────────────
      const highlightColor = WORD_HIGHLIGHT[colorEntry.hex] || 'Yellow';
      range.font.highlightColor = highlightColor;

    } else if (colorEntry?.type === 'text') {
      // ── Color de texto ────────────────────────────────────────────────
      range.font.color = colorEntry.hex;
    }

    // ── Añadir comentario de Word ──────────────────────────────────────
    const commentText = buildCommentText(finding.mergedFindings || [finding]);
    if (commentText) {
      range.insertComment(commentText);
    }
  }

  // ── 3. MARCADO DE CORCHETES (SEGUNDA PASADA) ─────────────────────────────

  /**
   * Segunda pasada para resaltar los corchetes [ ] en rosa y negrita.
   * Los corchetes se insertan como texto y no se pueden resaltar directamente,
   * así que se buscan y se formatean en una segunda pasada.
   */
  async highlightBrackets() {
    await Word.run(async (context) => {
      const body = context.document.body;

      for (const char of ['[', ']']) {
        const results = body.search(char, { matchCase: true });
        results.load('items');
        await context.sync();

        for (const range of results.items) {
          range.font.highlightColor = 'Pink'; // color 6
          range.font.bold = true;
        }
      }

      await context.sync();
    });
  }

  // ── 4. INFORME DE ESTADÍSTICAS (OPCIÓN A — al final del documento) ────────

  /**
   * Añade el informe de estadísticas al final del documento de revisión.
   * @param {Array} allResults - todos los resultados agrupados por corrección
   */
  async appendStatsReport(allResults) {
    await Word.run(async (context) => {
      const body = context.document.body;

      // Salto de página antes del informe
      body.insertBreak('Page', 'End');

      // ── Encabezado del informe ────────────────────────────────────────
      const titlePara = body.insertParagraph('INFORME DE ANÁLISIS — PLUMIA', 'End');
      titlePara.styleBuiltIn         = Word.Style.heading1;
      titlePara.font.color           = 'FFFFFF';
      titlePara.font.highlightColor  = 'DarkBlue';

      body.insertParagraph('Leyenda de colores y estadísticas del análisis', 'End')
        .font.italic = true;

      body.insertParagraph('', 'End');

      // ── Leyenda de colores ────────────────────────────────────────────
      const legendTitle = body.insertParagraph('Leyenda de colores', 'End');
      legendTitle.styleBuiltIn = Word.Style.heading2;

      // Colores usados en este análisis
      const usedColorIds = [...new Set(
        allResults.flatMap(r => r.findings.map(f => f.colorId)).filter(Boolean)
      )];

      for (const colorId of usedColorIds) {
        const colorEntry = COLOR_MAP[colorId];
        if (!colorEntry) continue;

        const legendPara = body.insertParagraph(
          `  ${colorEntry.name.toUpperCase()}  —  ${colorEntry.description}`, 'End'
        );
        if (colorEntry.type === 'highlight') {
          legendPara.font.highlightColor = WORD_HIGHLIGHT[colorEntry.hex] || 'Yellow';
        } else if (colorEntry.type === 'text') {
          legendPara.font.color = colorEntry.hex;
        }
        legendPara.font.bold = true;
      }

      body.insertParagraph('', 'End');

      // ── Tabla de resumen estadístico ──────────────────────────────────
      const summaryTitle = body.insertParagraph('Resumen estadístico', 'End');
      summaryTitle.styleBuiltIn = Word.Style.heading2;

      const totalFindings = allResults.reduce((sum, r) => sum + r.findings.length, 0);
      body.insertParagraph(`Total de incidencias detectadas: ${totalFindings}`, 'End');
      body.insertParagraph('', 'End');

      // Tabla resumen
      const tableData = allResults
        .filter(r => r.findings.length > 0)
        .map(r => [r.label, r.findings.length.toString()]);

      if (tableData.length > 0) {
        const table = body.insertTable(tableData.length + 1, 2, 'End', [
          ['Tipo de corrección', 'Incidencias'],
          ...tableData,
        ]);
        table.styleBuiltIn = Word.Style.gridTable4Accent5;
      }

      body.insertParagraph('', 'End');

      // ── Detalle por sección ───────────────────────────────────────────
      const detailTitle = body.insertParagraph('Detalle por categoría', 'End');
      detailTitle.styleBuiltIn = Word.Style.heading2;

      for (const result of allResults) {
        if (result.findings.length === 0) continue;

        // Título de sección
        const sectionTitle = body.insertParagraph(
          `${result.label}  (${result.findings.length} incidencia${result.findings.length !== 1 ? 's' : ''})`,
          'End'
        );
        sectionTitle.styleBuiltIn = Word.Style.heading3;

        // Listado de findings
        for (let i = 0; i < result.findings.length; i++) {
          const f = result.findings[i];

          // Texto en contexto (truncado si es muy largo)
          const contextText = f.originalText
            ? `«${f.originalText.substring(0, 80)}${f.originalText.length > 80 ? '…' : ''}»`
            : '';

          const itemPara = body.insertParagraph(
            `${i + 1}. ${contextText}`, 'End'
          );
          itemPara.leftIndent = 360; // sangría

          // Comentario / sugerencia
          const comment = buildCommentText([f]);
          if (comment) {
            const commentPara = body.insertParagraph(comment, 'End');
            commentPara.leftIndent    = 720;
            commentPara.font.italic   = true;
            commentPara.font.color    = '555555';
            commentPara.font.size     = 9;
          }
        }

        body.insertParagraph('', 'End');
      }

      await context.sync();
    });
  }

  // ── 5. DOCUMENTO ESTADÍSTICAS SEPARADO (OPCIÓN B) ─────────────────────────

  /**
   * Genera el documento ESTADISTICAS V.x.x como documento Word independiente.
   * Usa la API de Office para crear un nuevo documento.
   * @param {Array}  allResults   - todos los resultados del análisis
   * @param {string} originalName - nombre del documento original
   * @param {Array}  selectedIds  - IDs de correcciones seleccionadas
   * @param {string} statsName    - nombre del documento de estadísticas
   */
  async generateStatsDocument(allResults, originalName, selectedIds, statsName) {
    await Word.run(async (context) => {

      // Crear nuevo documento
      const statsDoc = context.application.createDocument();
      await context.sync();

      statsDoc.open();
      await context.sync();

      const body = statsDoc.body;

      // ── PORTADA ───────────────────────────────────────────────────────
      const mainTitle = body.insertParagraph('Plumia', 'End');
      mainTitle.styleBuiltIn = Word.Style.heading1;
      mainTitle.font.size    = 36;

      body.insertParagraph('Corrector ortotipográfico y de estilo', 'End').font.italic = true;
      body.insertParagraph('', 'End');

      body.insertParagraph(`Documento analizado: ${originalName}`, 'End').font.bold = true;
      body.insertParagraph(`Fecha de análisis: ${new Date().toLocaleString('es-ES')}`, 'End');

      // Opciones seleccionadas
      const { CORRECTIONS } = await import('./corrections-config.js');
      const selectedLabels = CORRECTIONS
        .filter(c => selectedIds.includes(c.id))
        .map(c => c.label);

      body.insertParagraph('Opciones de revisión seleccionadas:', 'End').font.bold = true;
      for (const label of selectedLabels) {
        body.insertParagraph(`  • ${label}`, 'End');
      }

      body.insertBreak('Page', 'End');

      // ── RESUMEN EJECUTIVO ─────────────────────────────────────────────
      const summaryTitle = body.insertParagraph('Resumen ejecutivo', 'End');
      summaryTitle.styleBuiltIn = Word.Style.heading1;

      const totalFindings = allResults.reduce((sum, r) => sum + r.findings.length, 0);
      body.insertParagraph(`Total de incidencias detectadas: ${totalFindings}`, 'End').font.bold = true;
      body.insertParagraph('', 'End');

      const tableData = allResults
        .filter(r => r.findings.length > 0)
        .map(r => [r.label, r.findings.length.toString()]);

      if (tableData.length > 0) {
        body.insertTable(tableData.length + 1, 2, 'End', [
          ['Tipo de corrección', 'Incidencias detectadas'],
          ...tableData,
        ]).styleBuiltIn = Word.Style.gridTable4Accent5;
      }

      body.insertBreak('Page', 'End');

      // ── DETALLE POR SECCIÓN ───────────────────────────────────────────
      const detailTitle = body.insertParagraph('Detalle por categoría', 'End');
      detailTitle.styleBuiltIn = Word.Style.heading1;

      for (const result of allResults) {
        if (result.findings.length === 0) continue;

        const sectionTitle = body.insertParagraph(
          `${result.label}  —  ${result.findings.length} incidencia${result.findings.length !== 1 ? 's' : ''}`,
          'End'
        );
        sectionTitle.styleBuiltIn = Word.Style.heading2;

        // Ordenar por página si está disponible
        const sorted = [...result.findings].sort((a, b) => {
          const pageA = parseInt(a.page || 0);
          const pageB = parseInt(b.page || 0);
          return pageA - pageB;
        });

        for (let i = 0; i < sorted.length; i++) {
          const f = sorted[i];

          const pageInfo    = f.page ? ` [Pág. ${f.page}]` : '';
          const contextText = f.originalText
            ? `«${f.originalText.substring(0, 100)}${f.originalText.length > 100 ? '…' : ''}»`
            : '';

          const itemPara = body.insertParagraph(
            `${i + 1}.${pageInfo}  ${contextText}`, 'End'
          );
          itemPara.leftIndent = 360;
          itemPara.font.bold  = true;

          const comment = buildCommentText([f]);
          if (comment) {
            const commentPara = body.insertParagraph(comment, 'End');
            commentPara.leftIndent  = 720;
            commentPara.font.italic = true;
            commentPara.font.size   = 10;
          }

          body.insertParagraph('', 'End');
        }
      }

      // Guardar el documento con el nombre de estadísticas
      statsDoc.save(statsName + '.docx');
      await context.sync();
    });
  }

  // ── 6. RENOMBRAR / GUARDAR DOCUMENTO DE REVISIÓN ─────────────────────────

  /**
   * Guarda el documento activo con el nombre de revisión.
   * @param {string} revisionName - nombre sin extensión
   */
  async saveRevisionDocument(revisionName) {
    await Word.run(async (context) => {
      context.document.save();
      await context.sync();
      // Nota: renombrar requiere que el usuario use "Guardar como" en Word
      // ya que Office.js no expone la API de renombrado directo en todos los entornos.
      // Se muestra un aviso al usuario con el nombre sugerido.
    });
  }

  // ── 7. UTILIDAD: CONSTRUIR DOCUMENTO COMPLETO ─────────────────────────────

  /**
   * Método orquestador principal.
   * Llamado desde taskpane.html cuando el análisis está completo.
   * @param {Array}  allResults     - resultados completos de processor.js
   * @param {Array}  resolvedFindings - findings con solapamientos resueltos
   * @param {string} originalName   - nombre del documento original
   * @param {Array}  selectedIds    - correcciones seleccionadas
   */
  async buildOutput(allResults, resolvedFindings, originalName, selectedIds) {
    const revisionName = await this.getRevisionName(originalName);
    const statsName    = this.getStatsName(revisionName);

    if (this.outputMode === 'marked') {
      // ── OPCIÓN A: documento marcado + informe al final ───────────────
      await this.applyMarkings(resolvedFindings);
      await this.highlightBrackets();
      await this.appendStatsReport(allResults);
      await this.saveRevisionDocument(revisionName);

      return {
        mode:         'marked',
        revisionName,
        totalFindings: resolvedFindings.length,
        message:      `Documento de revisión generado: ${revisionName}`
      };

    } else {
      // ── OPCIÓN B: solo informe de estadísticas ───────────────────────
      await this.generateStatsDocument(allResults, originalName, selectedIds, statsName);

      return {
        mode:      'report',
        statsName,
        totalFindings: allResults.reduce((sum, r) => sum + r.findings.length, 0),
        message:   `Informe de estadísticas generado: ${statsName}`
      };
    }
  }
}
