// ============================================================================
// PLUMIA — synonyms-db.js
// Diccionario local de sinónimos, ortotipografía por regex, grupos de API
// Depende de: corrections-config.js (window.PLUMIA.CORRECTIONS)
// ============================================================================
(function() {
var CORRECTIONS = window.PLUMIA.CORRECTIONS; // alias para buildPrompt lambdas
// REDUCCIÓN DE COSTES — 3 estrategias
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. DICCIONARIO LOCAL DE SINÓNIMOS ────────────────────────────────────────
// Claude solo detecta la palabra problemática. Los sinónimos se añaden aquí
// localmente, sin coste de tokens de salida.
window.PLUMIA.SYNONYMS_DB = {
  // Verbos comodín → alternativas más precisas
  verbos: {
    'hacer':    ['realizar','efectuar','ejecutar','llevar a cabo','elaborar','producir'],
    'poner':    ['colocar','depositar','situar','ubicar','instalar','fijar'],
    'tener':    ['poseer','contar con','disponer de','mantener','albergar'],
    'dar':      ['entregar','ofrecer','proporcionar','facilitar','ceder','aportar'],
    'decir':    ['afirmar','señalar','indicar','comentar','sostener','revelar','susurrar','gritar','musitar'],
    'ver':      ['observar','contemplar','advertir','percibir','distinguir','divisar'],
    'ir':       ['dirigirse','encaminarse','acudir','trasladarse','avanzar'],
    'venir':    ['llegar','acercarse','aproximarse','aparecer','presentarse'],
    'coger':    ['tomar','agarrar','asir','sostener','sujetar','recoger'],
    'haber':    ['existir','encontrarse','hallarse','presentarse'],
    'quedar':   ['permanecer','mantenerse','quedarse','persistir','continuar'],
    'poner los ojos en blanco': ['alzar los ojos con desdén','girar los ojos'],
    'hizo una sonrisa': ['sonrió','esbozó una sonrisa','dibujó una sonrisa'],
    'hacer un movimiento': ['moverse','agitarse','gesticular'],
    'hacer una pregunta': ['preguntar','inquirir','interrogar','cuestionar'],
    'hacer un gesto': ['gesticular','señalar','indicar'],
  },
  // Sustantivos genéricos → alternativas más concretas
  sustantivos: {
    'cosa':      ['objeto','elemento','asunto','cuestión','hecho','detalle'],
    'tema':      ['asunto','cuestión','materia','problema','punto'],
    'aspecto':   ['faceta','dimensión','elemento','característica','rasgo'],
    'situación': ['circunstancia','contexto','escenario','momento','coyuntura'],
    'elemento':  ['componente','parte','factor','ingrediente','pieza'],
    'algo':      ['cierta cosa','determinado objeto','un detalle','algo concreto'],
    'asunto':    ['cuestión','materia','problema','tema','punto'],
    'problema':  ['dificultad','conflicto','inconveniente','obstáculo','reto'],
    'hecho':     ['suceso','acontecimiento','evento','circunstancia'],
  },
  // Adverbios en -mente → construcciones alternativas
  adverbios: {
    'lentamente':      ['despacio','con calma','poco a poco','pausadamente','con parsimonia'],
    'rápidamente':     ['deprisa','a toda velocidad','con rapidez','velozmente','enseguida'],
    'fijamente':       ['con la vista fija','sin apartar la mirada','clavando los ojos'],
    'tranquilamente':  ['con calma','sin prisa','serenamente','sosegadamente'],
    'finalmente':      ['al fin','por fin','al cabo','en definitiva','al final'],
    'realmente':       ['en realidad','de verdad','verdaderamente','de hecho'],
    'claramente':      ['con claridad','de forma clara','sin duda','evidentemente'],
    'simplemente':     ['solo','tan solo','sin más','a secas'],
    'absolutamente':   ['del todo','por completo','totalmente','en absoluto'],
    'obviamente':      ['claro está','por supuesto','evidentemente','sin duda'],
    'exactamente':     ['con exactitud','con precisión','justo','a la perfección'],
    'básicamente':     ['en esencia','fundamentalmente','en el fondo','principalmente'],
    'totalmente':      ['por completo','del todo','enteramente','completamente'],
    'completamente':   ['del todo','por entero','íntegramente','en su totalidad'],
    'profundamente':   ['con intensidad','en lo más hondo','hondamente','de raíz'],
    'silenciosamente': ['en silencio','sin hacer ruido','sin emitir sonido'],
    'nerviosamente':   ['con los nervios a flor de piel','visiblemente tenso','inquieto'],
    'suavemente':      ['con suavidad','delicadamente','con delicadeza','con tiento'],
    'bruscamente':     ['de repente','abruptamente','de golpe','sin previo aviso'],
    'insistentemente': ['con insistencia','con empeño','una y otra vez','sin tregua'],
  },
  // Muletillas → alternativas o eliminar
  muletillas: {
    'en cierto modo':     ['de alguna forma','en cierta manera','de cierto modo','hasta cierto punto'],
    'de alguna manera':   ['de algún modo','en cierta forma','de cierto modo'],
    'de repente':         ['de pronto','súbitamente','inesperadamente','de improviso'],
    'en ese momento':     ['entonces','en aquel instante','en ese instante','justo entonces'],
    'de hecho':           ['en realidad','lo cierto es que','realmente','en efecto'],
    'sin embargo':        ['pero','no obstante','aunque','a pesar de ello','con todo'],
    'a pesar de todo':    ['aun así','con todo','no obstante'],
    'por supuesto':       ['claro','naturalmente','desde luego','sin duda'],
    'en definitiva':      ['en resumen','en fin','al final','en conclusión'],
    'al fin y al cabo':   ['en definitiva','al final','después de todo'],
    'básicamente':        ['en esencia','fundamentalmente','en el fondo'],
    'claramente':         ['es evidente que','sin duda','a todas luces'],
  },
};

// Función para enriquecer findings con sinónimos del diccionario local
window.PLUMIA.enrichWithLocalSynonyms = function(findings, correctionId) {
  return findings.map(f => {
    let synonyms = [];
    const word = (f.word || f.verb || f.genericWord || f.expression || '').toLowerCase();

    if (correctionId === 'verbos_comedin') {
      synonyms = SYNONYMS_DB.verbos[word] || SYNONYMS_DB.verbos[(f.originalText||'').toLowerCase()] || [];
    } else if (correctionId === 'sustantivos_genericos') {
      synonyms = SYNONYMS_DB.sustantivos[word] || [];
    } else if (correctionId === 'adverbios_mente') {
      const adv = (f.adverbs||[f.originalText])[0]?.toLowerCase() || word;
      synonyms = SYNONYMS_DB.adverbios[adv] || [];
    } else if (correctionId === 'muletillas') {
      synonyms = SYNONYMS_DB.muletillas[word] || SYNONYMS_DB.muletillas[(f.expression||'').toLowerCase()] || [];
    }

    if (synonyms.length > 0) {
      return { ...f, alternatives: synonyms, synonyms };
    }
    return f;
  });
}

// ── 2. MOTOR LOCAL DE ORTOTIPOGRAFÍA (sin llamada a la API) ─────────────────
// Detecta y corrige errores tipográficos mecánicos con regex, a coste cero.
window.PLUMIA.runLocalOrtotypography = function(text) {
  const findings = [];

  // Guiones de diálogo: guion corto al inicio de línea o tras salto
  const guionRegex = /(?:^|\n)[ \t]*-(?!\-)/gm;
  let m;
  const guionMatches = [];
  while ((m = guionRegex.exec(text)) !== null) {
    const fragment = text.substring(Math.max(0, m.index), Math.min(text.length, m.index + 30));
    guionMatches.push(fragment.trim());
  }
  if (guionMatches.length > 0) {
    findings.push({
      errorType: 'guion',
      originalText: guionMatches[0],
      correction: guionMatches[0].replace(/^-/, '—'),
      isFirstOccurrence: true,
      explanation: `Se han detectado ${guionMatches.length} guión(es) corto(s) que deberían ser rayas (—) en los diálogos.`,
      correctionId: 'ortotipografia_pura', colorId: null, label: 'Ortotipografía pura', directFix: true,
    });
  }

  // Comillas inglesas
  const comillasRegex = /[""][^""]+[""]/g;
  const comillasMatches = [];
  while ((m = comillasRegex.exec(text)) !== null) comillasMatches.push(m[0]);
  if (comillasMatches.length > 0) {
    findings.push({
      errorType: 'comillas',
      originalText: comillasMatches[0],
      correction: comillasMatches[0].replace(/[""]/g, (c) => c === '\u201c' || c === '"' ? '«' : '»'),
      isFirstOccurrence: true,
      explanation: `Se han detectado ${comillasMatches.length} uso(s) de comillas inglesas (""). En español se usan las angulares («»).`,
      correctionId: 'ortotipografia_pura', colorId: null, label: 'Ortotipografía pura', directFix: true,
    });
  }

  // Puntos suspensivos: tres puntos separados
  const puntosMatches = (text.match(/\.{3}/g) || []);
  if (puntosMatches.length > 0) {
    findings.push({
      errorType: 'puntos_suspensivos',
      originalText: '...',
      correction: '…',
      isFirstOccurrence: true,
      explanation: `Se han detectado ${puntosMatches.length} uso(s) de tres puntos separados (...). El carácter correcto es el punto suspensivo tipográfico (…).`,
      correctionId: 'ortotipografia_pura', colorId: null, label: 'Ortotipografía pura', directFix: true,
    });
  }

  // Espacio antes de signos de puntuación
  const espacioRegex = / [,;:.!?]/g;
  const espacioMatches = (text.match(espacioRegex) || []);
  if (espacioMatches.length > 0) {
    findings.push({
      errorType: 'espaciado',
      originalText: espacioMatches[0],
      correction: espacioMatches[0].trim(),
      isFirstOccurrence: true,
      explanation: `Se han detectado ${espacioMatches.length} espacio(s) antes de signo(s) de puntuación. Se eliminarán.`,
      correctionId: 'ortotipografia_pura', colorId: null, label: 'Ortotipografía pura', directFix: true,
    });
  }

  // Interrogación o exclamación sin apertura
  const aperturaRegex = /(?<![¿¡])\b[A-ZÁÉÍÓÚÜÑ][^.!?]*[?!]/g;
  const aperturaMatches = [];
  while ((m = aperturaRegex.exec(text)) !== null) {
    if (!m[0].startsWith('¿') && !m[0].startsWith('¡')) {
      aperturaMatches.push(m[0].substring(0, 40));
    }
  }
  if (aperturaMatches.length > 0) {
    const isQ = aperturaMatches[0].endsWith('?');
    findings.push({
      errorType: 'signo_apertura',
      originalText: aperturaMatches[0],
      correction: (isQ ? '¿' : '¡') + aperturaMatches[0],
      isFirstOccurrence: true,
      explanation: `Se han detectado ${aperturaMatches.length} frase(s) interrogativa(s) o exclamativa(s) sin signo de apertura (¿ o ¡).`,
      correctionId: 'ortotipografia_pura', colorId: null, label: 'Ortotipografía pura', directFix: true,
    });
  }

  return findings;
}

// ── 3. GRUPOS DE CORRECCIONES PARA API (reduce llamadas) ─────────────────────
// En lugar de 1 llamada por corrección, agrupamos varias en 1 sola llamada.
// Ahorro estimado: 40-60% en número de llamadas (y tokens de prompt).
window.PLUMIA.API_GROUPS = [
  {
    groupKey: 'pronouns',
    label: 'Pronombres',
    ids: ['leismo', 'ambiguedad_pronominal'],
    buildPrompt: (text) => `Eres un corrector experto en español. Analiza el texto y devuelve DOS análisis:
1. "leismo": leísmos, laísmos y loísmos (uso incorrecto de le/la/lo como complemento directo o indirecto)
2. "ambiguedad": pronombres ambiguos (referente poco claro, solo cuando haya 2+ personajes en la misma frase)

IMPORTANTE: Solo señala errores reales en el texto. Ignora los ejemplos didácticos etiquetados como "Correcto:" o "Incorrecto:". Devuelve MÁXIMO 10 hallazgos por categoría.

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"leismo":{"findings":[{"type":"leismo|laismo|loismo","originalText":"fragmento exacto","correction":"corrección","explanation":"explicación"}]},"ambiguedad":{"findings":[{"originalText":"fragmento exacto","pronoun":"pronombre","possibleReferents":["ref1","ref2"],"explanation":"por qué","suggestion":"reformulación"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores en una categoría: findings:[].`,
  },
  {
    groupKey: 'grammar',
    label: 'Gramática',
    ids: ['concordancia', 'dequeismo'],
    buildPrompt: (text) => `Eres un corrector gramatical experto en español. Analiza el texto y devuelve DOS análisis:
1. "concordancia": errores de concordancia sujeto-verbo o sustantivo-adjetivo. NO señales leísmos ni laísmos como concordancia.
2. "dequeismo": dequeísmo (de que de más) o queísmo (de que faltante)

IMPORTANTE: Un laísmo como "La dije" NO es concordancia. Solo señala errores gramaticales estrictos.

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"concordancia":{"findings":[{"originalText":"fragmento exacto","errorType":"sujeto-verbo|sustantivo-adjetivo","explanation":"descripción","correction":"corrección"}]},"dequeismo":{"findings":[{"originalText":"fragmento exacto","errorType":"dequeismo|queismo","explanation":"explicación","correction":"corrección"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores en una categoría: findings:[].`,
  },
  {
    groupKey: 'lexicon_a',
    label: 'Léxico — repeticiones y verbos',
    ids: ['repeticion_lexica', 'verbos_comedin', 'sustantivos_genericos'],
    buildPrompt: (text) => `Eres un corrector de estilo experto en español. Analiza el texto y devuelve TRES análisis:
1. "repeticion": misma palabra repetida en radio de 3-5 líneas sin intención estilística (excluye artículos, preposiciones, conjunciones).
2. "verbos": verbos comodín donde podría usarse uno más específico (hacer, poner, tener, dar, decir, ver, ir, venir). Solo devuelve la palabra, NO sinónimos.
3. "sustantivos": sustantivos genéricos (cosa, tema, aspecto, situación, elemento, algo). Solo devuelve la palabra, NO sinónimos.

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"repeticion":{"findings":[{"word":"palabra base","occurrences":["frag1","frag2"],"explanation":"explicación"}]},"verbos":{"findings":[{"originalText":"fragmento exacto","verb":"verbo comodín","explanation":"por qué"}]},"sustantivos":{"findings":[{"originalText":"fragmento exacto","genericWord":"palabra","explanation":"por qué"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores en una categoría: findings:[].`,
  },
  {
    groupKey: 'lexicon_b',
    label: 'Léxico — muletillas y pleonasmos',
    ids: ['muletillas', 'pleonasmos'],
    buildPrompt: (text) => `Eres un corrector de estilo experto en español. Analiza el texto y devuelve DOS análisis:
1. "muletillas": expresiones repetidas sin valor (en cierto modo, de alguna manera, de repente repetido, entonces abusivo…). Solo devuelve la expresión, NO alternativas.
2. "pleonasmos": redundancias (subir arriba, entrar dentro, salir fuera, bajar abajo…)

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"muletillas":{"findings":[{"expression":"muletilla","occurrences":["frag1","frag2"],"explanation":"por qué"}]},"pleonasmos":{"findings":[{"originalText":"fragmento exacto","explanation":"por qué","correction":"corrección"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores en una categoría: findings:[].`,
  },
  {
    groupKey: 'style',
    label: 'Estilo y fluidez',
    ids: ['adverbios_mente', 'voz_pasiva', 'frases_largas', 'nombres_propios'],
    buildPrompt: (text) => `Eres un corrector de estilo experto en español. Analiza el texto y devuelve CUATRO análisis:
1. "adverbios": palabras que TERMINEN LITERALMENTE en "-mente" y sean excesivas o sustituibles. Solo incluye palabras que EXISTAN en el texto. Si no hay ninguna, devuelve findings:[]. Solo devuelve el adverbio, NO alternativas.
2. "voz_pasiva": voz pasiva que podría ser activa (NO señales leísmos ni otros errores gramaticales)
3. "frases_largas": frases de más de 40 palabras que dificulten la lectura
4. "nombres": nombres propios repetidos excesivamente en un fragmento corto

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"adverbios":{"findings":[{"originalText":"fragmento","adverbs":["adv1"],"explanation":"por qué"}]},"voz_pasiva":{"findings":[{"originalText":"fragmento","explanation":"por qué","activeVersion":"versión activa"}]},"frases_largas":{"findings":[{"originalText":"frase completa","wordCount":45,"explanation":"por qué","suggestion":"cómo dividir"}]},"nombres":{"findings":[{"name":"nombre","occurrences":["frag1","frag2"],"explanation":"por qué","suggestion":"cómo aligerar"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores en una categoría: findings:[].`,
  },
  {
    groupKey: 'grammar2',
    label: 'Gramática',
    ids: ['gerundios', 'tiempos_verbales'],
    buildPrompt: (text) => `Eres un corrector gramatical experto en español. Analiza el texto y devuelve DOS análisis:
1. "gerundios": gerundios incorrectos (posterioridad, especificativo, adjetivo). NO señales leísmos ni otros errores.
2. "tiempos": mezclas no intencionales de indefinido e imperfecto. Solo señala descuidos claros. NO señales leísmos ni errores gramaticales de otro tipo.

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"gerundios":{"findings":[{"originalText":"fragmento","gerund":"gerundio","errorType":"posterioridad|especificativo|adjetivo","explanation":"por qué","correction":"corrección"}]},"tiempos":{"findings":[{"originalText":"fragmento","verbsFound":["v1","v2"],"explanation":"por qué","suggestion":"cómo resolverlo"}]}}
Si no hay errores: findings:[].`,
  },
  {
    groupKey: 'dialogo',
    label: 'Diálogo',
    ids: ['puntuacion_dialogo'],
    buildPrompt: (text) => CORRECTIONS.find(c=>c.id==='puntuacion_dialogo').prompt.replace('{TEXT}', text),
  },
  {
    groupKey: 'ritmo',
    label: 'Ritmo narrativo',
    ids: ['ritmo_narrativo'],
    buildPrompt: (text) => CORRECTIONS.find(c=>c.id==='ritmo_narrativo').prompt.replace('{TEXT}', text),
  },
];

// IDs que se procesan localmente sin llamar a la API
window.PLUMIA.LOCAL_IDS = ['ortotipografia_pura'];

})();
