// ============================================================================
// PLUMIA — synonyms-db.js  v8.00
// Diccionario local de sinónimos, ortotipografía por regex, grupos de API
// Depende de: corrections-config.js (window.PLUMIA.CORRECTIONS)
// ============================================================================
(function() {
window.PLUMIA.SYNONYMS_VERSION = '8.00';
console.log('📦 synonyms-db.js v8.00 cargado');
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
  // ── Regla 1: dos puntos sin espacio posterior ──────────────────────────────
  const dpNoEspacio = [];
  for (let _i = 0; _i < text.length - 1; _i++) {
    if (text[_i] !== ':') continue;
    const _prev = _i > 0 ? text[_i - 1] : '';
    const _next = text[_i + 1];
    if (/\d/.test(_prev) || /[\s:\/\d]/.test(_next)) continue;
    dpNoEspacio.push(text.substring(Math.max(0, _i - 5), Math.min(text.length, _i + 15)).trim());
  }
  if (dpNoEspacio.length > 0) {
    findings.push({ errorType:'dos_puntos_espacio', originalText:dpNoEspacio[0],
      correction:null, isFirstOccurrence:true,
      explanation:`Se han detectado ${dpNoEspacio.length} dos puntos sin espacio posterior. Se añadirá el espacio en todo el documento.`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }
  // ── Regla 4: mayúscula inmediata tras ': ' (advertencia, sin corrección auto) ─
  const dpMayus = [];
  for (let _i = 0; _i < text.length - 2; _i++) {
    if (text[_i] === ':' && text[_i + 1] === ' ' && /[A-ZÁÉÍÓÚÜÑ]/.test(text[_i + 2])) {
      dpMayus.push(text.substring(_i, Math.min(text.length, _i + 20)).trim());
    }
  }
  if (dpMayus.length > 0) {
    findings.push({ errorType:'dos_puntos_mayuscula', originalText:dpMayus[0],
      correction:null, isFirstOccurrence:true,
      explanation:`Se han detectado ${dpMayus.length} posible(s) mayúscula(s) tras dos puntos. La norma general es minúscula, salvo citas textuales, saludos epistolares o listas formales.`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }
  // ── Regla: en seguida → enseguida ────────────────────────────────────────────
  const ensegMatches = (text.match(/\ben\s+seguida\b/gi) || []);
  if (ensegMatches.length > 0) {
    findings.push({ errorType:'enseguida', originalText:ensegMatches[0],
      correction:'enseguida', isFirstOccurrence:true,
      explanation:`Se ha detectado «en seguida» en ${ensegMatches.length} ocasión(es). La forma correcta es la univerbada: «enseguida».`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }

  // ── Regla: prefijos sin guión (excluye ante mayúsculas: anti-OTAN) ──────────
  const PREF_RE = /\b(?:anti|ex|sub|pre|post|co|auto|inter|super|ultra|extra|sobre|vice|contra|semi|neo|pro|trans|bi|mono|multi|pseudo|cuasi|macro|micro)-[a-záéíóúüñ]/gi;
  const prefixMatches = [];
  let _pm;
  while ((_pm = PREF_RE.exec(text)) !== null) prefixMatches.push(_pm[0]);
  if (prefixMatches.length > 0) {
    findings.push({ errorType:'prefijo_guion', originalText:prefixMatches[0],
      correction:prefixMatches[0].replace('-',''), isFirstOccurrence:true,
      explanation:`Se han detectado ${prefixMatches.length} prefijo(s) con guión. Los prefijos van unidos sin guión salvo ante nombre propio o numeral.`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }

  // ── Regla: asignaturas en minúscula (fuera de inicio de oración) ─────────────
  const ASIG_LIST = [
    'Matemáticas','Matemática','Física','Química','Historia','Geografía',
    'Lengua','Literatura','Filosofía','Biología','Economía','Arte','Música',
    'Religión','Inglés','Francés','Alemán','Latín','Griego',
    'Tecnología','Informática','Plástica','Ética','Psicología','Sociología',
  ];
  const asigWrong = [];
  for (const _asig of ASIG_LIST) {
    let _pos = -1;
    while ((_pos = text.indexOf(_asig, _pos + 1)) !== -1) {
      if (_pos === 0) continue;
      const _before = text.substring(0, _pos);
      if (/[.?!\u2026\u2014]\s+$/.test(_before) || /\n\s*$/.test(_before)) continue;
      if (/[A-ZÁÉÍÓÚÜÑ]\w+\s+de\s+$/.test(_before)) continue; // "Ministerio de Economía" → skip
      asigWrong.push(text.substring(Math.max(0, _pos - 10), Math.min(text.length, _pos + _asig.length + 10)).trim());
    }
  }
  if (asigWrong.length > 0) {
    findings.push({ errorType:'asignatura_mayuscula', originalText:asigWrong[0],
      correction:null, isFirstOccurrence:true,
      explanation:`Se han detectado ${asigWrong.length} nombre(s) de asignatura(s) con mayúscula fuera de inicio de oración. Los nombres de asignaturas se escriben en minúscula.`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }

  // ── Regla: cargos públicos en minúscula (fuera de inicio de oración) ─────────
  // Excluye cuando el cargo va seguido de nombre propio: "el Rey Felipe" → skip
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
  const cargosWrong = [];
  for (const _cargo of CARGOS_LIST) {
    let _pos = -1;
    while ((_pos = text.indexOf(_cargo, _pos + 1)) !== -1) {
      if (_pos === 0) continue;
      const _before = text.substring(0, _pos);
      if (/[.?!\u2026\u2014]\s+$/.test(_before) || /\n\s*$/.test(_before)) continue;
      const _after = text.substring(_pos + _cargo.length);
      if (/^\s+[A-ZÁÉÍÓÚÜÑ]/.test(_after)) continue; // "el Rey Felipe" → skip
      cargosWrong.push(text.substring(Math.max(0, _pos - 10), Math.min(text.length, _pos + _cargo.length + 10)).trim());
    }
  }
  if (cargosWrong.length > 0) {
    findings.push({ errorType:'cargo_mayuscula', originalText:cargosWrong[0],
      correction:null, isFirstOccurrence:true,
      explanation:`Se han detectado ${cargosWrong.length} cargo(s) público(s) con mayúscula fuera de inicio de oración. Los cargos se escriben en minúscula según la RAE.`,
      correctionId:'ortotipografia_pura', colorId:null, label:'Ortotipografía pura', directFix:true });
  }

  return findings;
};

// ── 2b. DETECCIÓN LOCAL: tilde diacrítica sí/si ───────────────────────────────
// Detecta patrones SEGUROS donde 'si' sin tilde es inequívocamente incorrecto
// (pronombre reflexivo en construcciones fijas). La API cubre los casos ambiguos.
window.PLUMIA.runLocalSiTilde = function(text) {
  const findings = [];

  // ── Pronombre reflexivo (patrones inequívocos) ─────────────────────────────
  const reflexivePatterns = [
    { re: /\ben\s+si\b/gi,               hint: 'en sí'          },
    { re: /\bpara\s+si\b/gi,             hint: 'para sí'        },
    { re: /\bsobre\s+si\b/gi,            hint: 'sobre sí'       },
    { re: /\bfuera\s+de\s+si\b/gi,       hint: 'fuera de sí'    },
    { re: /\bde\s+si\s+mism[oa]s?\b/gi,  hint: 'de sí mismo/a'  },
    { re: /\bpor\s+si\s+mism[oa]s?\b/gi, hint: 'por sí mismo/a' },
    { re: /\bpor\s+si\s+sol[oa]s?\b/gi,  hint: 'por sí solo/a'  },
  ];
  for (const { re, hint } of reflexivePatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (/sí/i.test(m[0])) continue;
      const ctx = text.substring(Math.max(0, m.index - 10), Math.min(text.length, m.index + m[0].length + 10)).replace(/[\r\n]+/g, ' ').trim();
      findings.push({
        originalText: ctx, siForm: m[0], correctForm: hint,
        function: 'pronombre_reflexivo',
        explanation: `«${m[0]}»: el pronombre reflexivo «si» debe llevar tilde diacrítica → «${hint}».`,
        correctionId: 'si_tilde', colorId: 7, label: 'Uso de «sí» con tilde diacrítica', directFix: false,
      });
    }
  }

  // ── Adverbio de afirmación (patrones de alta confianza) ────────────────────
  // 'si no', 'como si', 'si bien', 'por si' se excluyen naturalmente porque
  // no encajan en estos patrones, o por la comprobación explícita de afterSi.
  // Falso positivo aceptado: 'Si, por alguna razón, X' (condicional parentético).
  const affirmativePatternsCompat = [
    { re: /(?:^|[.?!\u2014\n]\s*)([Ss]i),/gm,   hint: 'sí,', note: 'Parece adverbio de afirmación. Revise: si es afirmación → «sí»; si es condicional con pausa → «si».' },
    { re: /\u2014\s*([Ss]i)\s*[.!?]/g,           hint: 'sí',  note: 'Respuesta de diálogo: si es afirmación debe escribirse «sí».' },
    { re: /\u00BF([Ss]i)\s*\?/g,                 hint: '¿sí?',note: 'Pregunta eco: debe escribirse «¿sí?».' },
    { re: /,\s*([Ss]i)\s*,/g,                    hint: 'sí',  note: 'Si aparece aislado entre comas como afirmación, debe llevar tilde: «sí».' },
  ];

  for (const { re, hint, note } of affirmativePatternsCompat) {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (/sí/i.test(m[0])) continue; // ya tiene tilde
      // Excluir 'si no' y 'si bien' que podrían colisionar con el patrón de coma
      const afterSi = text.substring(m.index + m[0].length, m.index + m[0].length + 10);
      if (/^\s*(?:no|bien)\b/i.test(afterSi)) continue;
      const ctx = text.substring(Math.max(0, m.index - 5), Math.min(text.length, m.index + m[0].length + 15)).replace(/[\r\n]+/g, ' ').trim();
      findings.push({
        originalText: ctx, siForm: m[0].trim(), correctForm: hint,
        function: 'adverbio_afirmacion',
        explanation: note,
        correctionId: 'si_tilde', colorId: 7, label: 'Uso de «sí» con tilde diacrítica', directFix: false,
      });
    }
  }

  return findings;
};

// ── 2b3. DETECCIÓN LOCAL: tildes en interrogativos/exclamativos ───────────────
// Solo cubre el caso inequívoco: inmediatamente tras ¿ o ¡ siempre lleva tilde.
window.PLUMIA.runLocalInterrogativasTilde = function(text) {
  const findings = [];
  const WORDS = [
    { re: /[¿¡]\s*(que)\b/gi,    correct: 'qué'    },
    { re: /[¿¡]\s*(como)\b/gi,   correct: 'cómo'   },
    { re: /[¿¡]\s*(cuando)\b/gi, correct: 'cuándo' },
    { re: /[¿¡]\s*(quien)\b/gi,  correct: 'quién'  },
    { re: /[¿¡]\s*(quienes)\b/gi,correct: 'quiénes'},
    { re: /[¿¡]\s*(donde)\b/gi,  correct: 'dónde'  },
    { re: /[¿¡]\s*(cuanto)\b/gi, correct: 'cuánto' },
    { re: /[¿¡]\s*(cuanta)\b/gi, correct: 'cuánta' },
    { re: /[¿¡]\s*(cuantos)\b/gi,correct: 'cuántos'},
    { re: /[¿¡]\s*(cuantas)\b/gi,correct: 'cuántas'},
    { re: /[¿¡]\s*(cual)\b/gi,   correct: 'cuál'   },
    { re: /[¿¡]\s*(cuales)\b/gi, correct: 'cuáles' },
  ];
  for (const { re, correct } of WORDS) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const ctx = text.substring(Math.max(0, m.index - 5), Math.min(text.length, m.index + m[0].length + 20)).replace(/[\r\n]+/g, ' ').trim();
      findings.push({
        originalText: ctx, wordForm: m[1], correctForm: correct,
        errorType: 'falta_tilde',
        context: 'interrogativo_directo',
        explanation: `«${m[1]}»: tras signo de apertura interrogativo/exclamativo siempre lleva tilde → «${correct}».`,
        correctionId: 'interrogativas_tilde', colorId: 7, label: 'Tildes en interrogativos y exclamativos', directFix: false,
      });
    }
  }
  return findings;
};

// ── 2b4. DETECCIÓN LOCAL: tilde diacrítica tú/tu ──────────────────────────────
// Patrones seguros donde 'tu' sin tilde es inequívocamente pronombre.
window.PLUMIA.runLocalTuTilde = function(text) {
  const findings = [];

  // Patrón 1: inicio de párrafo/oración + tu + verbo conjugado
  // "Tu eres", "Tu sabes", "Tu puedes" → pronombre
  const reInicioVerbo = /(?:^|[.?!\u2026\u2014\n]\s*)(tu)\s+(?:eres|eras|fuiste|serás|has|habías|habrás|haces|hacías|harás|sabes|sabías|puedes|podías|podrás|quieres|querías|querrás|tienes|tenías|tendrás|debes|debías|deberás|vas|ibas|irás|vendrás|dices|decías|dirás)\b/gi;
  let m;
  while ((m = reInicioVerbo.exec(text)) !== null) {
    const ctx = text.substring(Math.max(0, m.index - 5), Math.min(text.length, m.index + m[0].length + 10)).replace(/[\r\n]+/g, ' ').trim();
    findings.push({
      originalText: ctx, tuForm: m[1], correctForm: 'tú',
      function: 'pronombre_personal',
      explanation: `«tu» ante verbo conjugado actúa como pronombre personal sujeto → debe llevar tilde: «tú».`,
      correctionId: 'tu_tilde', colorId: 7, label: 'Uso de «tú» con tilde diacrítica', directFix: false,
    });
  }

  // Patrón 2: que/como + tu + puntuación o fin → comparativo pronombre
  // "mejor que tu,", "tanto como tu." → pronombre
  const reCmpPunct = /\b(?:que|como)\s+(tu)\s*([,;:.!?])/gi;
  while ((m = reCmpPunct.exec(text)) !== null) {
    if (/tú/i.test(m[1])) continue;
    const ctx = text.substring(Math.max(0, m.index - 15), Math.min(text.length, m.index + m[0].length + 10)).replace(/[\r\n]+/g, ' ').trim();
    findings.push({
      originalText: ctx, tuForm: m[1], correctForm: 'tú',
      function: 'pronombre_personal',
      explanation: `«${m[0].split(m[1])[0].trim()} tu» seguido de puntuación indica pronombre personal → «tú».`,
      correctionId: 'tu_tilde', colorId: 7, label: 'Uso de «tú» con tilde diacrítica', directFix: false,
    });
  }

  // Patrón 3: verbo + tú al final de oración → pronombre pospuesto
  // "lo hiciste tu." "eres tu?" → pronombre
  const reVerbEnd = /\b(tú?)\s*[.!?]/gi;
  // Solo captura 'tu' (sin tilde) en esta posición
  const reVerbEndSafe = /\b(\w+(?:ste|steis|rás|rá|ría|iste|aron|eron|ió))\s+(tu)\s*[.!?]/gi;
  while ((m = reVerbEndSafe.exec(text)) !== null) {
    const ctx = text.substring(Math.max(0, m.index - 10), Math.min(text.length, m.index + m[0].length + 5)).replace(/[\r\n]+/g, ' ').trim();
    findings.push({
      originalText: ctx, tuForm: m[2], correctForm: 'tú',
      function: 'pronombre_personal',
      explanation: `«tu» tras verbo conjugado al final de frase es pronombre personal → debe llevar tilde: «tú».`,
      correctionId: 'tu_tilde', colorId: 7, label: 'Uso de «tú» con tilde diacrítica', directFix: false,
    });
  }

  return findings;
};

// ── 2b2. DETECCIÓN LOCAL: tilde diacrítica mí/mi ─────────────────────────────
// Detecta patrones SEGUROS donde 'mi' sin tilde tras preposición es pronombre
// (lo que sigue es puntuación o fin de oración — imposible que sea posesivo).
// La API cubre los casos ambiguos (para mi bien / para mí era difícil).
window.PLUMIA.runLocalMiTilde = function(text) {
  const findings = [];
  const PREPS = 'a|para|de|por|sin|sobre|hacia|ante|contra|tras|desde|en|entre';

  // Patrón 1: prep + mi + puntuación inmediata → pronombre seguro
  const rePunct = new RegExp(`\\b(${PREPS})\\s+(mi)\\s*([,;:.!?])`, 'gi');
  let m;
  while ((m = rePunct.exec(text)) !== null) {
    if (/mí/i.test(m[2])) continue; // ya tiene tilde
    const ctx = text.substring(Math.max(0, m.index - 15), Math.min(text.length, m.index + m[0].length + 10)).replace(/[\r\n]+/g, ' ').trim();
    findings.push({
      originalText: ctx, miForm: m[2], correctForm: 'mí',
      function: 'pronombre_personal',
      explanation: `«${m[1]} mi»: seguido de puntuación indica pronombre personal → debe llevar tilde: «${m[1]} mí».`,
      correctionId: 'mi_tilde', colorId: 7, label: 'Uso de «mí» con tilde diacrítica', directFix: false,
    });
  }

  // Patrón 2: prep + mi al final de línea o cadena → pronombre seguro
  const reEnd = new RegExp(`\\b(${PREPS})\\s+(mi)\\s*$`, 'gim');
  while ((m = reEnd.exec(text)) !== null) {
    if (/mí/i.test(m[2])) continue;
    const ctx = text.substring(Math.max(0, m.index - 15), Math.min(text.length, m.index + m[0].length + 5)).replace(/[\r\n]+/g, ' ').trim();
    findings.push({
      originalText: ctx, miForm: m[2], correctForm: 'mí',
      function: 'pronombre_personal',
      explanation: `«${m[1]} mi»: al final de la frase indica pronombre personal → debe llevar tilde: «${m[1]} mí».`,
      correctionId: 'mi_tilde', colorId: 7, label: 'Uso de «mí» con tilde diacrítica', directFix: false,
    });
  }

  return findings;
};

// ── 2c. DETECCIÓN LOCAL: tilde diacrítica aún/aun ─────────────────────────────
// Detecta patrones SEGUROS donde aún/aun se usa incorrectamente.
// Sin autocorrección: solo marca y comenta para revisión.
window.PLUMIA.runLocalAunTilde = function(text) {
  const findings = [];

  // Patrones donde falta la tilde: 'aun' → debería ser 'aún' (= todavía)
  const missingAccentPatterns = [
    {
      re: /\baun\s+no\b/gi,
      correctForm: 'aún no',
      explanation: '«aun no»: cuando equivale a «todavía no», debe llevar tilde → «aún no».',
    },
  ];

  for (const { re, correctForm, explanation } of missingAccentPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (/aún/i.test(m[0])) continue; // ya tiene tilde
      const ctx = text.substring(Math.max(0, m.index - 15), Math.min(text.length, m.index + m[0].length + 15)).replace(/[\r\n]+/g, ' ').trim();
      findings.push({
        originalText: ctx, aunForm: m[0], correctForm,
        errorType: 'falta_tilde',
        explanation,
        correctionId: 'aun_tilde', colorId: 7, label: 'Uso de «aún» con tilde diacrítica', directFix: false,
      });
    }
  }

  // Patrones donde sobra la tilde: 'aún' → debería ser 'aun' (= incluso/aunque)
  const extraAccentPatterns = [
    {
      re: /\baún\s+cuando\b/gi,
      correctForm: 'aun cuando',
      explanation: '«aún cuando»: como conjunción concesiva (= aunque/incluso cuando), no lleva tilde → «aun cuando».',
    },
    {
      re: /\baún\s+así\b/gi,
      correctForm: 'aun así',
      explanation: '«aún así»: como locución concesiva (= incluso así/con todo), no lleva tilde → «aun así».',
    },
    {
      re: /\bni\s+aún\b/gi,
      correctForm: 'ni aun',
      explanation: '«ni aún»: en la locución «ni aun» (= ni siquiera), no lleva tilde → «ni aun».',
    },
    {
      re: /\baún\s+\S+(?:ando|iendo|yendo)\b/gi,
      correctForm: 'aun + gerundio',
      explanation: '«aún» + gerundio: en construcción concesiva (= incluso + gerundio), no lleva tilde → «aun».',
    },
  ];

  for (const { re, correctForm, explanation } of extraAccentPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const ctx = text.substring(Math.max(0, m.index - 15), Math.min(text.length, m.index + m[0].length + 15)).replace(/[\r\n]+/g, ' ').trim();
      findings.push({
        originalText: ctx, aunForm: m[0], correctForm,
        errorType: 'tilde_sobrante',
        explanation,
        correctionId: 'aun_tilde', colorId: 7, label: 'Uso de «aún» con tilde diacrítica', directFix: false,
      });
    }
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
1. "leismo": leísmos, laísmos y loísmos — uso de la/lo donde debe ir le (o viceversa).
Regla: le = complemento indirecto (CI). la/lo = complemento directo (CD).
Ejemplos de LAÍSMO (la/las como CI — incorrecto): "La dije que viniera" → "Le dije". "Su madre la llamó" → "Su madre le llamó". "La contó la historia" → "Le contó".
Ejemplos de LOÍSMO (lo/los como CI — incorrecto): "Lo avisé del problema" → "Le avisé". "Lo dijeron la verdad" → "Les dijeron".
Ejemplos de LEÍSMO (le/les como CD masculino — incorrecto): "Le vi ayer" → "Lo vi ayer".
ATENCIÓN: "llamar a alguien" toma CI en España → "le llamé" (correcto), "la llamé" (laísmo si el referente es femenino el sujeto es ella). Analiza cada caso con cuidado.
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
2. "verbos": verbos comodín donde el verbo es claramente vago y existe uno más específico y expresivo. Ej: "Hizo una sonrisa" → "Sonrió". "Puso los ojos en blanco" → "Alzó los ojos". "Hizo un gesto" → "Gesticuló". CRITERIO: señala solo verbos genéricos como hacer, poner, tener, dar, coger usados donde podría ir un verbo más preciso. NO señales verbos que ya son específicos para la acción descrita. Devuelve el fragmento EXACTO.
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
    groupKey: 'interrogativas_tilde',
    label: 'Tildes en interrogativos/exclamativos',
    ids: ['interrogativas_tilde'],
    buildPrompt: (text) => CORRECTIONS.find(c=>c.id==='interrogativas_tilde').prompt.replace('{TEXT}', text),
  },
  {
    groupKey: 'tu_tilde',
    label: 'Tilde diacrítica tú/tu',
    ids: ['tu_tilde'],
    buildPrompt: (text) => CORRECTIONS.find(c=>c.id==='tu_tilde').prompt.replace('{TEXT}', text),
  },
  {
    groupKey: 'mi_tilde',
    label: 'Tilde diacrítica mí/mi',
    ids: ['mi_tilde'],
    buildPrompt: (text) => CORRECTIONS.find(c=>c.id==='mi_tilde').prompt.replace('{TEXT}', text),
  },
  {
    groupKey: 'si_tilde',
    label: 'Tilde diacrítica sí/si',
    ids: ['si_tilde'],
    buildPrompt: (text) => CORRECTIONS.find(c=>c.id==='si_tilde').prompt.replace('{TEXT}', text),
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
// ── 2c. DETECCIÓN LOCAL: números que deben escribirse con letras ──────────────
window.PLUMIA.runLocalNumerosLetras = function(text) {
  const NUM_TO_WORD = {
    0:'cero',1:'uno',2:'dos',3:'tres',4:'cuatro',5:'cinco',6:'seis',
    7:'siete',8:'ocho',9:'nueve',10:'diez',11:'once',12:'doce',
    13:'trece',14:'catorce',15:'quince',16:'dieciséis',17:'diecisiete',
    18:'dieciocho',19:'diecinueve',20:'veinte',21:'veintiuno',
    22:'veintidós',23:'veintitrés',24:'veinticuatro',25:'veinticinco',
    26:'veintiséis',27:'veintisiete',28:'veintiocho',29:'veintinueve',
    30:'treinta',31:'treinta y uno',32:'treinta y dos',33:'treinta y tres',
    34:'treinta y cuatro',35:'treinta y cinco',36:'treinta y seis',
    37:'treinta y siete',38:'treinta y ocho',39:'treinta y nueve',
    40:'cuarenta',41:'cuarenta y uno',42:'cuarenta y dos',43:'cuarenta y tres',
    44:'cuarenta y cuatro',45:'cuarenta y cinco',46:'cuarenta y seis',
    47:'cuarenta y siete',48:'cuarenta y ocho',49:'cuarenta y nueve',
    50:'cincuenta',51:'cincuenta y uno',52:'cincuenta y dos',53:'cincuenta y tres',
    54:'cincuenta y cuatro',55:'cincuenta y cinco',56:'cincuenta y seis',
    57:'cincuenta y siete',58:'cincuenta y ocho',59:'cincuenta y nueve',
    60:'sesenta',61:'sesenta y uno',62:'sesenta y dos',63:'sesenta y tres',
    64:'sesenta y cuatro',65:'sesenta y cinco',66:'sesenta y seis',
    67:'sesenta y siete',68:'sesenta y ocho',69:'sesenta y nueve',
    70:'setenta',71:'setenta y uno',72:'setenta y dos',73:'setenta y tres',
    74:'setenta y cuatro',75:'setenta y cinco',76:'setenta y seis',
    77:'setenta y siete',78:'setenta y ocho',79:'setenta y nueve',
    80:'ochenta',81:'ochenta y uno',82:'ochenta y dos',83:'ochenta y tres',
    84:'ochenta y cuatro',85:'ochenta y cinco',86:'ochenta y seis',
    87:'ochenta y siete',88:'ochenta y ocho',89:'ochenta y nueve',
    90:'noventa',91:'noventa y uno',92:'noventa y dos',93:'noventa y tres',
    94:'noventa y cuatro',95:'noventa y cinco',96:'noventa y seis',
    97:'noventa y siete',98:'noventa y ocho',99:'noventa y nueve',
  };
  const UNITS_RE   = /^[ \t]*(kg|km|cm|mm|m|g|l|ml|cl|dl|lb|oz|t|ha|%|°C|°F|mph|kph|rpm|h|min)\b/i;
  const SECTION_RE = /\b(cap[íi]tulo|p[aá]gina|p[aá]g\.?|art[íi]culo|secci[oó]n|apartado|anexo|cuadro|tabla|figura|n[uú]mero|n[oº]\.?)\s*$/i;
  const MONTHS_RE  = /^[ \t]*de[ \t]+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i;

  const findings = [];
  const numRe = /\b([0-9]{1,2})\b/g;
  let m;

  while ((m = numRe.exec(text)) !== null) {
    const numStr = m[1];
    const num    = parseInt(numStr, 10);
    const pos    = m.index;

    if (num > 99) continue;

    const cBefore = pos > 0                           ? text[pos - 1]             : '';
    const cAfter  = pos + numStr.length < text.length ? text[pos + numStr.length] : '';

    // F1: código con letra pegada (BH88, 3A)
    if (/[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]/.test(cBefore) || /[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]/.test(cAfter)) continue;
    // F2: decimal (3.5 / 2,75)
    if (cBefore === '.' || cBefore === ',' || cAfter === '.' || cAfter === ',') continue;
    // F3: hora (14:30)
    if (cAfter === ':') continue;
    if (/:\d?$/.test(text.substring(Math.max(0, pos - 3), pos))) continue;
    // F4: fecha con / o —
    if (cBefore === '/' || cAfter === '/' || cBefore === '-' || cAfter === '-') continue;

    const afterNum  = text.substring(pos + numStr.length, pos + numStr.length + 25);
    const beforeNum = text.substring(Math.max(0, pos - 40), pos);

    // F5: fecha (12 de marzo)
    if (MONTHS_RE.test(afterNum)) continue;
    // F6: unidad de medida (5 kg)
    if (UNITS_RE.test(afterNum)) continue;
    // F7: capítulo/página/sección antes del número
    if (SECTION_RE.test(beforeNum)) continue;

    // F8: enumeración densa (≥2 números en la misma oración)
    const sStart = Math.max(
      text.lastIndexOf('.', pos - 1) + 1,
      text.lastIndexOf('?', pos - 1) + 1,
      text.lastIndexOf('!', pos - 1) + 1,
      text.lastIndexOf('\n', pos - 1) + 1,
      0
    );
    const sEndRel = text.substring(pos + numStr.length).search(/[.?!\n]/);
    const sEnd    = sEndRel === -1 ? text.length : pos + numStr.length + sEndRel + 1;
    if ((text.substring(sStart, sEnd).match(/\b\d+\b/g) || []).length >= 2) continue;

    // Detectar inicio de frase (error directo según la norma)
    const isStartOfSentence = text.substring(sStart, pos).trim().length === 0;

    const ctx  = text.substring(Math.max(0, pos - 15), Math.min(text.length, pos + numStr.length + 15)).replace(/[\r\n]+/g, ' ').trim();
    const word = NUM_TO_WORD[num];

    findings.push({
      originalText: ctx, numStr, correctForm: word, isStartOfSentence,
      explanation: isStartOfSentence
        ? `El número «${numStr}» inicia frase. La norma en textos literarios exige escribirlo con letras: «${word}».`
        : `En textos literarios, los números del 0 al 99 se escriben con letras. «${numStr}» puede escribirse como «${word}».`,
      correctionId: 'numeros_letras', colorId: 3,
      label: 'Números en letra', directFix: false,
    });
  }
  return findings;
};

window.PLUMIA.LOCAL_IDS = ['ortotipografia_pura', 'numeros_letras', 'aun_tilde'];

})();
