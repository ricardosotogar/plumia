// ============================================================================
// PLUMIA — synonyms-db.js
// Diccionario local de sinónimos, ortotipografía por regex, grupos de API
// Depende de: corrections-config.js (window.PLUMIA.CORRECTIONS)
// ============================================================================
(function() {
var CORRECTIONS = window.PLUMIA.CORRECTIONS; // alias para buildPrompt lambdas

// ── 1. DICCIONARIO LOCAL DE SINÓNIMOS ────────────────────────────────────────
window.PLUMIA.SYNONYMS_DB = {
  verbos: {
    'hacer':    ['realizar','efectuar','ejecutar','elaborar','producir','llevar a cabo'],
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
    'hizo una sonrisa': ['sonrió','esbozó una sonrisa','dibujó una sonrisa'],
    'hizo un gesto': ['gesticuló','señaló','indicó'],
    'hizo una pausa': ['hizo silencio','guardó silencio','se detuvo'],
    'puso los ojos': ['alzó los ojos','giró los ojos'],
    'puso el vaso': ['dejó el vaso','colocó el vaso','depositó el vaso'],
  },
  sustantivos: {
    'cosa':      ['objeto','elemento','asunto','cuestión','hecho','detalle'],
    'tema':      ['asunto','cuestión','materia','problema','punto'],
    'aspecto':   ['faceta','dimensión','elemento','característica','rasgo'],
    'situación': ['circunstancia','contexto','escenario','momento','coyuntura'],
    'elemento':  ['componente','parte','factor','ingrediente','pieza'],
    'algo':      ['cierto detalle','determinado objeto','un punto concreto'],
    'asunto':    ['cuestión','materia','problema','tema','punto'],
    'problema':  ['dificultad','conflicto','inconveniente','obstáculo','reto'],
    'hecho':     ['suceso','acontecimiento','evento','circunstancia'],
  },
  adverbios: {
    'lentamente':      ['despacio','con calma','poco a poco','pausadamente'],
    'rápidamente':     ['deprisa','a toda velocidad','con rapidez','velozmente'],
    'fijamente':       ['con la vista fija','sin apartar la mirada','clavando los ojos'],
    'tranquilamente':  ['con calma','sin prisa','serenamente','sosegadamente'],
    'finalmente':      ['al fin','por fin','al cabo','en definitiva','al final'],
    'realmente':       ['en realidad','de verdad','verdaderamente','de hecho'],
    'claramente':      ['con claridad','de forma clara','sin duda','evidentemente'],
    'simplemente':     ['solo','tan solo','sin más','a secas'],
    'absolutamente':   ['del todo','por completo','totalmente'],
    'obviamente':      ['claro está','por supuesto','evidentemente','sin duda'],
    'exactamente':     ['con exactitud','con precisión','justo','a la perfección'],
    'básicamente':     ['en esencia','fundamentalmente','en el fondo'],
    'totalmente':      ['por completo','del todo','enteramente'],
    'completamente':   ['del todo','por entero','íntegramente'],
    'profundamente':   ['con intensidad','en lo más hondo','hondamente'],
    'silenciosamente': ['en silencio','sin hacer ruido','sin emitir sonido'],
    'nerviosamente':   ['con los nervios a flor de piel','visiblemente tenso'],
    'suavemente':      ['con suavidad','delicadamente','con delicadeza'],
    'bruscamente':     ['de repente','abruptamente','de golpe'],
    'insistentemente': ['con insistencia','con empeño','una y otra vez'],
    'lentamente':      ['despacio','pausadamente','con parsimonia'],
    'cuidadosamente':  ['con cuidado','con esmero','meticulosamente'],
    'aparentemente':   ['al parecer','según parece','en apariencia'],
    'perfectamente':   ['a la perfección','sin fallo','impecablemente'],
    'interiormente':   ['en su interior','por dentro','en su fuero interno'],
    'difícilmente':    ['con dificultad','apenas','a duras penas'],
    'correctamente':   ['bien','de forma correcta','sin errores'],
    'pausadamente':    ['despacio','con calma','sin prisa'],
  },
  muletillas: {
    'en cierto modo':     ['de alguna forma','en cierta manera','hasta cierto punto'],
    'de alguna manera':   ['de algún modo','en cierta forma','de cierto modo'],
    'de repente':         ['de pronto','súbitamente','inesperadamente','de improviso'],
    'en ese momento':     ['entonces','en aquel instante','justo entonces'],
    'de hecho':           ['en realidad','lo cierto es que','realmente','en efecto'],
    'sin embargo':        ['pero','no obstante','aunque','a pesar de ello'],
    'por supuesto':       ['claro','naturalmente','desde luego','sin duda'],
    'en definitiva':      ['en resumen','en fin','al final','en conclusión'],
    'básicamente':        ['en esencia','fundamentalmente','en el fondo'],
    'claramente':         ['es evidente que','sin duda','a todas luces'],
  },
};

window.PLUMIA.enrichWithLocalSynonyms = function(findings, correctionId) {
  const DB = window.PLUMIA.SYNONYMS_DB;
  return findings.map(f => {
    let synonyms = [];
    const word = (f.word || f.verb || f.genericWord || f.expression || '').toLowerCase();
    if (correctionId === 'verbos_comedin') {
      synonyms = DB.verbos[word] || DB.verbos[(f.originalText||'').toLowerCase()] || [];
    } else if (correctionId === 'sustantivos_genericos') {
      synonyms = DB.sustantivos[word] || [];
    } else if (correctionId === 'adverbios_mente') {
      const adv = (f.adverbs||[f.originalText])[0]?.toLowerCase() || word;
      synonyms = DB.adverbios[adv] || [];
    } else if (correctionId === 'muletillas') {
      synonyms = DB.muletillas[word] || DB.muletillas[(f.expression||'').toLowerCase()] || [];
    }
    if (synonyms.length > 0) return { ...f, alternatives: synonyms, synonyms };
    return f;
  });
};

// ── 2. MOTOR LOCAL DE ORTOTIPOGRAFÍA ─────────────────────────────────────────
window.PLUMIA.runLocalOrtotypography = function(text) {
  const findings = [];
  const guionRegex = /(?:^|\n)[ \t]*-(?!\-)/gm;
  let m; const guionMatches = [];
  while ((m = guionRegex.exec(text)) !== null) {
    guionMatches.push(text.substring(Math.max(0,m.index), Math.min(text.length,m.index+30)).trim());
  }
  if (guionMatches.length > 0) {
    findings.push({ errorType:'guion', originalText:guionMatches[0],
      correction:guionMatches[0].replace(/^-/,'—'), isFirstOccurrence:true,
      explanation:`Se han detectado ${guionMatches.length} guión(es) corto(s) que deberían ser rayas (—) en los diálogos.`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }
  const comillasMatches = (text.match(/[""][^""]+[""]/g)||[]);
  if (comillasMatches.length > 0) {
    findings.push({ errorType:'comillas', originalText:comillasMatches[0],
      correction:comillasMatches[0].replace(/[""]/g,c=>(c==='\u201c'||c==='"')?'«':'»'),
      isFirstOccurrence:true,
      explanation:`Se han detectado ${comillasMatches.length} uso(s) de comillas tipográficas. En español se usan las angulares («»).`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }
  const asciiComillas = (text.match(/"/g)||[]).length;
  if (asciiComillas > 0) {
    findings.push({ errorType:'comillas', originalText:'"',
      correction:'«', isFirstOccurrence:true,
      explanation:`Se han detectado ${asciiComillas} uso(s) de comillas inglesas (" "). En español se usan las angulares («»).`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }
  const puntosMatches = (text.match(/\.{3}/g)||[]);
  if (puntosMatches.length > 0) {
    findings.push({ errorType:'puntos_suspensivos', originalText:'...',
      correction:'…', isFirstOccurrence:true,
      explanation:`Se han detectado ${puntosMatches.length} uso(s) de tres puntos (...). El carácter correcto es el punto suspensivo tipográfico (…).`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }
  const espacioMatches = (text.match(/ [,;:.!?]/g)||[]);
  if (espacioMatches.length > 0) {
    findings.push({ errorType:'espaciado', originalText:espacioMatches[0],
      correction:espacioMatches[0].trim(), isFirstOccurrence:true,
      explanation:`Se han detectado ${espacioMatches.length} espacio(s) antes de signo(s) de puntuación. Se eliminarán.`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }
  return findings;
};

// ── 3. GRUPOS DE CORRECCIONES PARA API ────────────────────────────────────────
// IMPORTANTE para todos los prompts: el texto puede contener encabezados de sección
// como "4. Verbos comodín" que NO son ejemplos didácticos sino simplemente títulos.
// El contenido narrativo a analizar es el texto que sigue a cada título.

const SISTEMA = `INSTRUCCIÓN CRÍTICA: Debes analizar el texto que te paso buscando errores reales de escritura. El texto contiene párrafos narrativos que TIENEN errores intencionados que debes detectar. Los títulos numerados como "1. Leísmos" o "4. Verbos comodín" son solo encabezados de sección — el texto que les sigue CONTIENE los errores que debes encontrar. Analiza TODO el texto y reporta TODOS los errores que encuentres.\n\n`;

window.PLUMIA.API_GROUPS = [
  {
    groupKey: 'pronouns',
    label: 'Pronombres',
    ids: ['leismo', 'ambiguedad_pronominal'],
    buildPrompt: (text) => SISTEMA + `Eres un corrector experto en español. Analiza el texto y devuelve DOS análisis:
1. "leismo": leísmos, laísmos y loísmos (uso incorrecto de le/la/lo). Ej: "La dije" es laísmo (debe ser "Le dije"). "Lo di un golpe" es loísmo (debe ser "Le di").
2. "ambiguedad": pronombres ambiguos donde el referente no queda claro. REQUISITO: debe haber 2 o más referentes posibles del MISMO GÉNERO GRAMATICAL en la misma frase o frase anterior. Si el pronombre es masculino (él, lo, le) solo puede ser ambiguo si hay 2+ referentes masculinos. Si el pronombre es femenino (ella, la, le) solo si hay 2+ referentes femeninos. EXCLUYE frases donde hay un único referente del género correcto aunque haya otros del género opuesto. EXCLUYE frases donde el error sea de leísmo/laísmo/loísmo — no confundas errores de pronombre con ambigüedad.

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"leismo":{"findings":[{"type":"leismo|laismo|loismo","originalText":"fragmento exacto del texto","correction":"forma correcta","explanation":"explicación"}]},"ambiguedad":{"findings":[{"originalText":"fragmento exacto","pronoun":"pronombre","possibleReferents":["ref1","ref2"],"explanation":"por qué","suggestion":"reformulación"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores: findings:[].`,
  },
  {
    groupKey: 'grammar',
    label: 'Gramática',
    ids: ['concordancia', 'dequeismo'],
    buildPrompt: (text) => SISTEMA + `Eres un corrector gramatical experto en español. Analiza el texto y devuelve DOS análisis:
1. "concordancia": errores de concordancia sujeto-verbo o sustantivo-adjetivo. Ej: "Los alumnos llegó" es error (debe ser "llegaron"). NO señales leísmos.
2. "dequeismo": dequeísmo ("pienso de que" → "pienso que") o queísmo ("seguro que" → "seguro de que")

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"concordancia":{"findings":[{"originalText":"fragmento exacto","errorType":"sujeto-verbo|sustantivo-adjetivo","explanation":"descripción","correction":"corrección"}]},"dequeismo":{"findings":[{"originalText":"fragmento exacto","errorType":"dequeismo|queismo","explanation":"explicación","correction":"corrección"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores: findings:[].`,
  },
  {
    groupKey: 'lexicon_a',
    label: 'Léxico — repeticiones y verbos',
    ids: ['repeticion_lexica', 'verbos_comedin', 'sustantivos_genericos'],
    buildPrompt: (text) => SISTEMA + `Eres un corrector de estilo experto en español. Analiza el texto y devuelve TRES análisis:
1. "repeticion": misma palabra de contenido repetida 3 o más veces DENTRO DEL MISMO PÁRRAFO o en párrafos inmediatamente consecutivos sin intención estilística. EXCLUYE: pronombres, artículos, preposiciones, conjunciones, adverbios. EXCLUYE palabras que aparecen solo 1-2 veces aunque estén cerca. Solo señala repeticiones realmente llamativas que empeoren el estilo.
2. "verbos": verbos claramente vagos donde existe uno más específico. Ej: "Hizo una sonrisa" → "Sonrió". "Puso los ojos en blanco" → "Alzó los ojos". EXCLUYE verbos comunes ya precisos: mirar, ver, decir, hablar, entrar, salir, llegar, estar, tener, ir, venir, saber. NO señales un verbo solo porque pueda sustituirse — señálalo solo si el original es notablemente genérico. Devuelve el fragmento EXACTO.
3. "sustantivos": sustantivos claramente vagos y sustituibles por términos concretos. Ej: "esa cosa" → "ese objeto". SOLO señala: cosa, tema, asunto, aspecto, elemento, situación cuando sean claramente intercambiables y empobrezcan el texto. EXCLUYE: palabras usadas en su sentido preciso, expresiones idiomáticas, frases hechas. Devuelve el fragmento EXACTO.

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"repeticion":{"findings":[{"word":"palabra base","occurrences":["frag1","frag2"],"explanation":"explicación"}]},"verbos":{"findings":[{"originalText":"fragmento exacto del texto","verb":"verbo comodín","explanation":"por qué"}]},"sustantivos":{"findings":[{"originalText":"fragmento exacto del texto","genericWord":"palabra","explanation":"por qué"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores en una categoría: findings:[].`,
  },
  {
    groupKey: 'lexicon_b',
    label: 'Léxico — muletillas y pleonasmos',
    ids: ['muletillas', 'pleonasmos'],
    buildPrompt: (text) => SISTEMA + `Eres un corrector de estilo experto en español. Analiza el texto y devuelve DOS análisis:
1. "muletillas": expresiones que se repiten sin aportar valor. Ej: "De repente" aparece 2 veces, "de alguna manera", "básicamente", "de hecho". EXCLUYE conjunciones y conectores gramaticales (aunque, pero, sin embargo, porque, cuando, si, que, como, mientras). Solo señala expresiones que el autor podría eliminar o sustituir sin perder significado gramatical. Devuelve el fragmento EXACTO donde aparece.
2. "pleonasmos": redundancias donde se repite información. Ej: "subió arriba" (arriba es redundante), "bajó abajo", "entró dentro", "salió fuera", "volvió a reincidir", "sus propios ojos". Devuelve el fragmento EXACTO.

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"muletillas":{"findings":[{"expression":"muletilla","occurrences":["fragmento exacto donde aparece"],"explanation":"por qué"}]},"pleonasmos":{"findings":[{"originalText":"fragmento exacto del pleonasmo","explanation":"por qué es redundante","correction":"versión corregida"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores en una categoría: findings:[].`,
  },
  {
    groupKey: 'style',
    label: 'Estilo y fluidez',
    ids: ['adverbios_mente', 'voz_pasiva', 'frases_largas', 'nombres_propios'],
    buildPrompt: (text) => SISTEMA + `Eres un corrector de estilo experto en español. Analiza el texto y devuelve CUATRO análisis:
1. "adverbios": adverbios terminados en "-mente". Evalúa cada uno: "Adecuado" si aporta valor literario, "Mejorable" si es débil o sustituible. Para los mejorables propone 2 alternativas sin adverbios (verbos precisos, acciones, recursos narrativos). No elimines los que funcionen bien.
2. "voz_pasiva": voz pasiva perifrástica real (con ser/estar + participio + agente explícito o implícito). Ej: "La carta fue escrita por Elena" → "Elena escribió la carta". EXCLUYE construcciones activas aunque tengan pronombres indirectos (como "alguien lo había avisado" — esto es activa). EXCLUYE frases que contienen leísmos/laísmos/loísmos — evalúa la estructura sintáctica ignorando el error de pronombre. Devuelve el fragmento EXACTO.
3. "frases_largas": frases de más de 40 palabras que dificulten la lectura.
4. "nombres": nombre propio que aparece 4 o más veces DENTRO DEL MISMO PÁRRAFO. Ej: "Carlos" aparece 5 veces en el mismo párrafo. EXCLUYE nombres que aparecen en párrafos distintos aunque sean cercanos — la repetición en distintos párrafos es menos llamativa.

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"adverbios":{"findings":[{"originalText":"fragmento exacto","adverb":"adverbio detectado","evaluation":"Adecuado|Mejorable","explanation":"por qué","alternatives":["alt1","alt2"]}]},"voz_pasiva":{"findings":[{"originalText":"fragmento exacto en pasiva","explanation":"por qué revisarlo","activeVersion":"versión activa"}]},"frases_largas":{"findings":[{"originalText":"frase completa exacta","wordCount":45,"explanation":"por qué","suggestion":"cómo dividir"}]},"nombres":{"findings":[{"name":"nombre","occurrences":["frag1","frag2"],"explanation":"por qué","suggestion":"cómo aligerar"}]}}
Devuelve MÁXIMO 10 hallazgos por categoría. Si no hay errores en una categoría: findings:[].`,
  },
  {
    groupKey: 'grammar2',
    label: 'Gramática',
    ids: ['gerundios', 'tiempos_verbales'],
    buildPrompt: (text) => SISTEMA + `Eres un corrector gramatical experto en español. Analiza el texto y devuelve DOS análisis:
1. "gerundios": gerundios incorrectos. Ej: "Salió de casa, encontrando a Juan" (posterioridad — incorrecto), "una ley regulando el tráfico" (especificativo — incorrecto). Devuelve el fragmento EXACTO.
2. "tiempos": mezclas de indefinido e imperfecto en la misma escena que parezcan descuido. Ej: "Entró y miraba" (mezcla no intencional).

Texto:
${text}

Responde ÚNICAMENTE con este JSON:
{"gerundios":{"findings":[{"originalText":"fragmento exacto","gerund":"gerundio","errorType":"posterioridad|especificativo|adjetivo","explanation":"por qué","correction":"corrección"}]},"tiempos":{"findings":[{"originalText":"fragmento exacto","verbsFound":["v1","v2"],"explanation":"por qué","suggestion":"cómo resolverlo"}]}}
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
