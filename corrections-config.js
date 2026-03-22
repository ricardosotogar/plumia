// ============================================================================
// PLUMIA — corrections-config.js
// Fichero de configuración de correcciones ortotipográficas y de estilo
// ----------------------------------------------------------------------------
// Para añadir una nueva corrección:
//   1. Añade un nuevo objeto al array CORRECTIONS siguiendo la misma estructura
//   2. Si es un grupo nuevo, añádelo también a GROUPS
//   3. Asigna un colorId existente o define uno nuevo en COLOR_MAP
//   No es necesario modificar ningún otro fichero.
// ============================================================================

// ── MAPA DE COLORES ──────────────────────────────────────────────────────────
// Cada color define cómo se marca el error en el documento Word de revisión.
// type: "highlight" = resaltado de fondo | "text" = color de letra | "bracket" = corchetes [ ]
export const COLOR_MAP = {
  1: { name: "Rojo",        hex: "FF0000", type: "text",      description: "Leísmos" },
  2: { name: "Amarillo",    hex: "FFD966", type: "highlight",  description: "Repeticiones léxicas" },
  3: { name: "Verde claro", hex: "92D050", type: "highlight",  description: "Adverbios -mente" },
  4: { name: "Naranja",     hex: "FF9900", type: "highlight",  description: "Verbos comodín / Sustantivos / Muletillas / Pleonasmos" },
  5: { name: "Turquesa",    hex: "00B0F0", type: "highlight",  description: "Voz pasiva / Tiempos verbales" },
  6: { name: "Rosa",        hex: "FF69B4", type: "bracket",    description: "Frases largas / Puntuación diálogo" },
  7: { name: "Azul",        hex: "0070C0", type: "text",       description: "Nombres propios / Gramática" },
  8: { name: "Lavanda",     hex: "C9B8FF", type: "highlight",  description: "Ambigüedades pronominales" },
  9: { name: "Violeta",     hex: "7030A0", type: "highlight",  description: "Coherencia narrativa" },
};

// ── GRUPOS ───────────────────────────────────────────────────────────────────
export const GROUPS = [
  { id: "pronouns",    label: "Pronombres y deixis" },
  { id: "lexicon",     label: "Léxico y vocabulario" },
  { id: "style",       label: "Estilo y fluidez" },
  { id: "grammar",     label: "Gramática" },
  { id: "orthotypo",   label: "Ortotipografía" },
  { id: "coherence",   label: "Coherencia narrativa",
    requiresFullDoc: true,  // fuerza análisis de documento completo
    costWarning: "El análisis de coherencia requiere leer el documento completo y puede ser entre 3 y 5 veces más caro que las correcciones ortotipográficas." },
];

// ── CORRECCIONES ─────────────────────────────────────────────────────────────
// Cada corrección tiene:
//   id          — identificador único interno
//   groupId     — grupo al que pertenece (debe existir en GROUPS)
//   label       — nombre mostrado en el formulario
//   description — descripción corta mostrada como tooltip
//   colorId     — color asignado (debe existir en COLOR_MAP)
//   includesSynonyms — si el comentario debe incluir sinónimos
//   directFix   — si el error se corrige directamente sin marcar (ortotipografía pura)
//   prompt      — instrucción para Claude. Usar {TEXT} como placeholder del texto a analizar.
//                 Claude debe responder SIEMPRE en JSON con el formato especificado al final.
export const CORRECTIONS = [

  // ── GRUPO 1: PRONOMBRES ────────────────────────────────────────────────────
  {
    id: "leismo",
    groupId: "pronouns",
    label: "Leísmos, laísmos y loísmos",
    description: "Uso incorrecto de le, la, lo como complemento",
    colorId: 1,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector experto en español. Analiza el siguiente texto en busca de leísmos, laísmos y loísmos: usos incorrectos de los pronombres le, la y lo.
Recuerda:
- "lo/la" son complemento directo (CD)
- "le" es complemento indirecto (CI)
- Leísmo: usar "le" donde corresponde "lo/la" (CD). Ej: "Le vi ayer" (incorrecto) → "Lo vi ayer"
- Laísmo: usar "la" donde corresponde "le" (CI). Ej: "La dije que viniera" → "Le dije que viniera"
- Loísmo: usar "lo" donde corresponde "le" (CI). Ej: "Lo di el libro" → "Le di el libro"
Ignora el leísmo de persona masculina singular si es el único caso, ya que tiene cierta aceptación.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido con este formato exacto, sin texto adicional:
{
  "findings": [
    {
      "type": "leismo|laismo|loismo",
      "originalText": "fragmento exacto del texto con el error",
      "correction": "forma correcta",
      "explanation": "explicación breve en una línea de por qué es incorrecto y cómo debe quedar"
    }
  ]
}
Si no encuentras ningún error, devuelve: {"findings": []}`
  },

  {
    id: "ambiguedad_pronominal",
    groupId: "pronouns",
    label: "Ambigüedades pronominales",
    description: "Pronombres con referente poco claro",
    colorId: 8,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector experto en español. Analiza el siguiente texto en busca de ambigüedades pronominales: casos en que pronombres como él, ella, lo, la, le, se, su no tienen un referente claro porque puede aplicarse a más de un personaje o elemento.
Presta especial atención a escenas con varios personajes.
Solo señala casos genuinamente ambiguos, no los que son claros por contexto.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con la ambigüedad",
      "pronoun": "pronombre ambiguo",
      "possibleReferents": ["referente 1", "referente 2"],
      "explanation": "explicación breve de por qué es ambiguo",
      "suggestion": "posible reformulación para eliminar la ambigüedad"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  // ── GRUPO 2: LÉXICO ────────────────────────────────────────────────────────
  {
    id: "repeticion_lexica",
    groupId: "lexicon",
    label: "Repeticiones léxicas cercanas",
    description: "Misma palabra repetida en corta distancia",
    colorId: 2,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector de estilo experto en español. Analiza el siguiente texto en busca de repeticiones léxicas cercanas: la misma palabra (o su raíz) repetida en un radio de 3-5 líneas, cuando no parece un recurso estilístico intencional.
No señales:
- Artículos, preposiciones, conjunciones o pronombres
- Repeticiones claramente intencionadas con valor expresivo
- Términos técnicos o nombres propios

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "word": "palabra repetida (en su forma base)",
      "occurrences": ["fragmento con primera aparición", "fragmento con segunda aparición"],
      "explanation": "breve explicación del problema",
      "synonyms": ["sinónimo1", "sinónimo2", "sinónimo3"]
    }
  ]
}
Si no encuentras ninguna: {"findings": []}`
  },

  {
    id: "verbos_comedin",
    groupId: "lexicon",
    label: "Verbos comodín",
    description: "Abuso de hacer, poner, tener, dar, haber…",
    colorId: 4,
    includesSynonyms: true,
    directFix: false,
    prompt: `Eres un corrector de estilo experto en español. Analiza el siguiente texto en busca de verbos comodín usados en exceso: hacer, poner, tener, dar, haber, decir, ver, ir, venir, coger, cuando podría emplearse un verbo más preciso y expresivo.
Solo señala casos donde el verbo comodín empobrezca claramente el estilo. No los señales cuando sean la opción más natural o en diálogos coloquiales.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el verbo comodín",
      "verb": "verbo comodín usado",
      "explanation": "por qué es mejorable",
      "alternatives": ["alternativa más precisa 1", "alternativa 2", "alternativa 3"]
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  {
    id: "sustantivos_genericos",
    groupId: "lexicon",
    label: "Sustantivos genéricos",
    description: "Abuso de cosa, tema, aspecto, situación…",
    colorId: 4,
    includesSynonyms: true,
    directFix: false,
    prompt: `Eres un corrector de estilo experto en español. Analiza el siguiente texto en busca de sustantivos genéricos o vagos usados donde podría emplearse un término más concreto y preciso: cosa, tema, aspecto, situación, elemento, cuestión, problema, algo, asunto, hecho.
Solo señala casos donde el término vago empobrezca la precisión del texto.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el sustantivo genérico",
      "genericWord": "palabra genérica",
      "explanation": "por qué es mejorable en este contexto",
      "alternatives": ["término más concreto 1", "término 2", "término 3"]
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  {
    id: "muletillas",
    groupId: "lexicon",
    label: "Muletillas narrativas",
    description: "Expresiones repetidas que no aportan valor",
    colorId: 4,
    includesSynonyms: true,
    directFix: false,
    prompt: `Eres un corrector de estilo experto en español. Analiza el siguiente texto en busca de muletillas narrativas: palabras o expresiones que aparecen con demasiada frecuencia de forma aparentemente inconsciente y que no aportan información nueva. Ejemplos: "en cierto modo", "de alguna manera", "de repente" repetido, "entonces", "en ese momento", "de hecho", "sin embargo" abusivo, "básicamente", "realmente".
Solo señala las que aparezcan al menos 2 veces en el texto o que sean claramente innecesarias.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "expression": "muletilla detectada",
      "occurrences": ["fragmento con primera aparición", "fragmento con segunda aparición"],
      "explanation": "por qué es una muletilla en este contexto",
      "alternatives": ["alternativa 1", "alternativa 2", "eliminar"]
    }
  ]
}
Si no encuentras ninguna: {"findings": []}`
  },

  {
    id: "pleonasmos",
    groupId: "lexicon",
    label: "Pleonasmos",
    description: "Palabras innecesarias que repiten información",
    colorId: 4,
    includesSynonyms: true,
    directFix: false,
    prompt: `Eres un corrector experto en español. Analiza el siguiente texto en busca de pleonasmos: construcciones en que se añaden palabras innecesarias porque repiten información ya contenida en otro término. Ejemplos: "subir arriba", "bajar abajo", "entrar dentro", "salir fuera", "ver con mis propios ojos", "volver a reincidir", "previamente antes", "colaborar juntos", "casi a punto de".

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el pleonasmo",
      "explanation": "por qué es redundante",
      "correction": "forma corregida sin la redundancia"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  // ── GRUPO 3: ESTILO ────────────────────────────────────────────────────────
  {
    id: "adverbios_mente",
    groupId: "style",
    label: "Abuso de adverbios en -mente",
    description: "Acumulación de adverbios terminados en -mente",
    colorId: 3,
    includesSynonyms: true,
    directFix: false,
    prompt: `Eres un corrector de estilo experto en español. Analiza el siguiente texto en busca de un uso excesivo de adverbios terminados en -mente. Señala:
1. Acumulaciones de dos o más adverbios en -mente cercanos
2. Adverbios en -mente que podrían sustituirse por una construcción más elegante o un verbo más preciso
No señales adverbios en -mente que sean la mejor opción en su contexto.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el/los adverbio/s",
      "adverbs": ["adverbio1", "adverbio2"],
      "explanation": "por qué conviene revisarlo",
      "alternatives": ["construcción alternativa 1", "alternativa 2", "alternativa 3"]
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  {
    id: "voz_pasiva",
    groupId: "style",
    label: "Voz pasiva innecesaria",
    description: "Construcciones pasivas que podrían ser activas",
    colorId: 5,
    includesSynonyms: true,
    directFix: false,
    prompt: `Eres un corrector de estilo experto en español. Analiza el siguiente texto en busca de construcciones en voz pasiva que resultarían más naturales y directas en voz activa. Señala tanto la pasiva perifrástica ("fue abierto por") como la pasiva refleja ("se abrió") cuando sea innecesaria.
No señales la voz pasiva cuando sea la opción más natural o cuando no haya un agente claro.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto en voz pasiva",
      "explanation": "por qué conviene revisarlo",
      "activeVersion": "reformulación propuesta en voz activa"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  {
    id: "frases_largas",
    groupId: "style",
    label: "Frases demasiado largas",
    description: "Oraciones de más de 40 palabras que dificultan la lectura",
    colorId: 6,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector de estilo experto en español. Analiza el siguiente texto en busca de frases excesivamente largas (más de 40 palabras, o más cortas pero con una estructura subordinada muy compleja) que dificulten la comprensión o rompan el ritmo de la narración.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "frase completa exacta tal como aparece en el texto",
      "wordCount": 45,
      "explanation": "por qué dificulta la lectura",
      "suggestion": "cómo podría dividirse o simplificarse"
    }
  ]
}
Si no encuentras ninguna: {"findings": []}`
  },

  {
    id: "nombres_propios",
    groupId: "style",
    label: "Exceso de nombres propios",
    description: "Repetición excesiva de nombres propios cercanos",
    colorId: 7,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector de estilo experto en español. Analiza el siguiente texto en busca de nombres propios (de personajes o lugares) que se repiten con demasiada frecuencia en un fragmento corto, cuando podrían sustituirse por pronombres u otras referencias sin perder claridad.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "name": "nombre propio repetido",
      "occurrences": ["fragmento con primera aparición", "fragmento con segunda aparición"],
      "explanation": "por qué resulta excesivo",
      "suggestion": "cómo podría aligerarse usando pronombres u otras referencias"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  {
    id: "ritmo_narrativo",
    groupId: "style",
    label: "Ritmo narrativo",
    description: "Desequilibrios de ritmo entre el tipo de escena y la longitud de frases",
    colorId: 7,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un editor literario experto en español. Analiza el siguiente texto en busca de desequilibrios de ritmo narrativo:
1. Frases largas y complejas en escenas de acción, tensión o urgencia (frenan el ritmo cuando debería acelerarse)
2. Frases muy cortas y entrecortadas en escenas descriptivas o de atmósfera (rompen la cadencia cuando debería ser fluida)
3. Párrafos con densidad muy desigual sin aparente intención estilística
Solo señala casos donde el desequilibrio sea claro y perjudicial para la lectura.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el desequilibrio",
      "sceneType": "acción|descripción|diálogo|reflexión",
      "issue": "descripción del desequilibrio detectado",
      "suggestion": "cómo podría mejorarse el ritmo"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  // ── GRUPO 4: GRAMÁTICA ─────────────────────────────────────────────────────
  {
    id: "gerundios",
    groupId: "grammar",
    label: "Gerundios incorrectos",
    description: "Gerundio de posterioridad y otros usos incorrectos",
    colorId: 7,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector gramatical experto en español. Analiza el siguiente texto en busca de gerundios incorrectos, especialmente:
1. Gerundio de posterioridad: expresa una acción posterior a la principal (incorrecto). Ej: "Salió de casa, encontrando a Juan" → la acción de encontrar es posterior a salir.
2. Gerundio especificativo con sustantivo: "Una ley regulando el tráfico" → "Una ley que regula el tráfico"
3. Gerundio como adjetivo: "Una caja conteniendo libros" → "Una caja que contiene libros"

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el gerundio incorrecto",
      "gerund": "gerundio problemático",
      "errorType": "posterioridad|especificativo|adjetivo",
      "explanation": "por qué es incorrecto",
      "correction": "reformulación correcta"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  {
    id: "dequeismo",
    groupId: "grammar",
    label: "Dequeísmo y queísmo",
    description: "Uso incorrecto de 'de que' / omisión incorrecta",
    colorId: 7,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector gramatical experto en español. Analiza el siguiente texto en busca de:
1. Dequeísmo: usar "de que" donde solo corresponde "que". Ej: "Pienso de que..." → "Pienso que..."
2. Queísmo: omitir "de" donde es necesaria. Ej: "Estoy seguro que..." → "Estoy seguro de que..."
Truco: si puedes sustituir la cláusula por "eso" y la preposición es necesaria, hay queísmo. Si no es necesaria, hay dequeísmo.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el error",
      "errorType": "dequeismo|queismo",
      "explanation": "explicación breve",
      "correction": "forma correcta"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  {
    id: "concordancia",
    groupId: "grammar",
    label: "Concordancia de género y número",
    description: "Errores de concordancia sujeto-verbo o sustantivo-adjetivo",
    colorId: 7,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector gramatical experto en español. Analiza el siguiente texto en busca de errores de concordancia:
1. Sujeto-verbo: el verbo no concuerda en número con el sujeto
2. Sustantivo-adjetivo: el adjetivo no concuerda en género o número con el sustantivo
3. Sujeto tácito: el verbo no concuerda con el sujeto implícito
Ignora casos de sujeto compuesto o colectivo donde la concordancia es flexible.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el error",
      "errorType": "sujeto-verbo|sustantivo-adjetivo",
      "explanation": "descripción del error",
      "correction": "forma correcta"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  {
    id: "tiempos_verbales",
    groupId: "grammar",
    label: "Inconsistencia de tiempos verbales",
    description: "Mezcla no intencional de indefinido e imperfecto",
    colorId: 5,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector literario experto en español. Analiza el siguiente texto en busca de posibles inconsistencias en el uso de tiempos verbales del pasado, especialmente mezclas no intencionales de pretérito indefinido (canté) y pretérito imperfecto (cantaba) dentro de una misma escena que puedan indicar un descuido estilístico.
Recuerda: el indefinido se usa para acciones puntuales y completadas; el imperfecto para estados, acciones durativas o descripciones. Algunos cambios son intencionales.
Solo señala los que parezcan descuidos, no los cambios claramente intencionales.

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el posible cambio inconsistente",
      "verbsFound": ["verbo en indefinido", "verbo en imperfecto cercano"],
      "explanation": "por qué podría ser un descuido",
      "suggestion": "cómo podría resolverse"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  // ── GRUPO 5: ORTOTIPOGRAFÍA ────────────────────────────────────────────────
  {
    id: "ortotipografia_pura",
    groupId: "orthotypo",
    label: "Ortotipografía pura",
    description: "Guiones, comillas, puntos suspensivos, mayúsculas, signos ¿¡, espaciado",
    colorId: null,   // se corrige directamente, no se resalta
    includesSynonyms: false,
    directFix: true, // corrección directa en el documento
    prompt: `Eres un corrector ortotipográfico experto en español. Analiza el siguiente texto en busca de errores ortotipográficos para corregirlos directamente. Detecta:
1. Guiones de diálogo: guion corto (-) en lugar de raya (—)
2. Comillas: comillas inglesas ("") en lugar de españolas («»)
3. Puntos suspensivos: tres puntos separados (...) en lugar del carácter tipográfico único (…)
4. Signos de apertura: interrogación (?) o exclamación (!) sin su signo de apertura (¿ ¡)
5. Espaciado: espacio antes de coma, punto, punto y coma, dos puntos, cierre de interrogación o exclamación
6. Mayúsculas: falta de mayúscula tras punto, minúscula indebida al inicio de párrafo

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "errorType": "guion|comillas|puntos_suspensivos|signo_apertura|espaciado|mayusculas",
      "originalText": "fragmento exacto con el error",
      "correction": "fragmento corregido",
      "isFirstOccurrence": true,
      "explanation": "solo si isFirstOccurrence es true: explicación breve para el comentario de Word"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  {
    id: "puntuacion_dialogo",
    groupId: "orthotypo",
    label: "Problemas de puntuación en diálogo",
    description: "Errores de puntuación en intervenciones y acotaciones",
    colorId: 6,
    includesSynonyms: false,
    directFix: false,
    prompt: `Eres un corrector ortotipográfico experto en español. Analiza el siguiente texto en busca de errores de puntuación en los diálogos. Reglas a verificar:
1. Falta de raya antes de la acotación del narrador: —Hola. dijo → —Hola —dijo
2. Punto incorrecto antes de la acotación: —Hola. —dijo → —Hola —dijo
3. Coma innecesaria antes de la raya de cierre: —Hola, —dijo → —Hola —dijo
4. Mayúscula incorrecta en el verbo de acotación: —Hola —Dijo → —Hola —dijo
5. Punto y coma después de interrogación/exclamación: —¿Vienes?. → —¿Vienes?
6. Falta de punto tras la acotación cuando el diálogo continúa: —¿Vienes? —dijo Marta— Vamos → —¿Vienes? —dijo Marta—. Vamos
7. Coma innecesaria después de interrogación: —¿Vienes?, —dijo → —¿Vienes? —dijo

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "originalText": "fragmento exacto con el error de puntuación",
      "errorType": "descripción breve del tipo de error",
      "correction": "fragmento corregido",
      "explanation": "explicación breve de la regla"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

  // ── GRUPO 6: COHERENCIA NARRATIVA ─────────────────────────────────────────
  // IMPORTANTE: estas correcciones requieren el documento completo.
  // Se procesan en llamadas separadas con contexto extendido.
  {
    id: "coherencia_personajes",
    groupId: "coherence",
    label: "Coherencia de personajes",
    description: "Contradicciones en experiencias, habilidades o rasgos físicos",
    colorId: 9,
    includesSynonyms: false,
    directFix: false,
    requiresFullDoc: true,
    prompt: `Eres un editor literario experto. Analiza el siguiente texto narrativo completo en busca de contradicciones en la caracterización de los personajes:
1. Experiencias que se contradicen: un personaje afirma que es la primera vez que hace algo, pero ya lo hizo antes en el texto
2. Habilidades que aparecen y desaparecen sin explicación
3. Rasgos físicos que cambian sin justificación (color de ojos, altura, cicatrices…)
4. Conocimiento que un personaje no debería tener según lo narrado

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "characterName": "nombre del personaje afectado",
      "contradictionType": "experiencia|habilidad|rasgo_fisico|conocimiento",
      "occurrence1": { "text": "fragmento exacto de la primera mención", "location": "Cap. X / descripción de ubicación" },
      "occurrence2": { "text": "fragmento exacto de la segunda mención contradictoria", "location": "Cap. X / descripción de ubicación" },
      "explanation": "descripción clara de la contradicción"
    }
  ]
}
Si no encuentras ninguna: {"findings": []}`
  },

  {
    id: "coherencia_temporal",
    groupId: "coherence",
    label: "Coherencia temporal",
    description: "Inconsistencias en la línea de tiempo del relato",
    colorId: 9,
    includesSynonyms: false,
    directFix: false,
    requiresFullDoc: true,
    prompt: `Eres un editor literario experto. Analiza el siguiente texto narrativo completo en busca de inconsistencias temporales:
1. Referencias temporales contradictorias ("hace tres días" que no cuadran con los eventos)
2. Edades de los personajes que no encajan con las fechas o eventos mencionados
3. Estaciones del año o condiciones climáticas contradictorias en el mismo período
4. Eventos que ocurren en orden imposible según la cronología establecida

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "inconsistencyType": "referencia_temporal|edad|estacion|orden_eventos",
      "occurrence1": { "text": "fragmento exacto", "location": "ubicación en el texto" },
      "occurrence2": { "text": "fragmento exacto contradictorio", "location": "ubicación en el texto" },
      "explanation": "descripción clara de la inconsistencia temporal"
    }
  ]
}
Si no encuentras ninguna: {"findings": []}`
  },

  {
    id: "coherencia_objetos",
    groupId: "coherence",
    label: "Coherencia de objetos y espacios",
    description: "Objetos que desaparecen o espacios que cambian sin explicación",
    colorId: 9,
    includesSynonyms: false,
    directFix: false,
    requiresFullDoc: true,
    prompt: `Eres un editor literario experto. Analiza el siguiente texto narrativo completo en busca de inconsistencias en objetos o espacios:
1. Un objeto importante mencionado que desaparece sin explicación
2. Un personaje usa o menciona un objeto que no podía tener en ese momento
3. La distribución de un espacio (habitación, edificio, ciudad) cambia entre escenas sin justificación
4. Un personaje lleva algo que olvidó, perdió o entregó antes

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "itemOrSpace": "nombre del objeto o espacio afectado",
      "inconsistencyType": "objeto_desaparece|objeto_imposible|espacio_cambia",
      "occurrence1": { "text": "fragmento exacto de la primera mención", "location": "ubicación" },
      "occurrence2": { "text": "fragmento exacto contradictorio", "location": "ubicación" },
      "explanation": "descripción de la inconsistencia"
    }
  ]
}
Si no encuentras ninguna: {"findings": []}`
  },

  {
    id: "coherencia_conocimiento",
    groupId: "coherence",
    label: "Coherencia de conocimiento",
    description: "Personajes que saben cosas que no deberían saber aún",
    colorId: 9,
    includesSynonyms: false,
    directFix: false,
    requiresFullDoc: true,
    prompt: `Eres un editor literario experto. Analiza el siguiente texto narrativo en busca de inconsistencias en el conocimiento de los personajes:
1. Un personaje sabe algo que aún no le han contado o que no pudo presenciar
2. Un personaje actúa como si no supiera algo que vivió directamente
3. El narrador revela información que el personaje focal no podría conocer (ruptura de focalización)

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "characterName": "personaje afectado",
      "knowledgeIssue": "descripción de qué sabe o no sabe incorrectamente",
      "occurrence1": { "text": "fragmento donde se establece lo que sabe/no sabe", "location": "ubicación" },
      "occurrence2": { "text": "fragmento contradictorio", "location": "ubicación" },
      "explanation": "descripción clara de la inconsistencia"
    }
  ]
}
Si no encuentras ninguna: {"findings": []}`
  },

  {
    id: "tono_voz",
    groupId: "coherence",
    label: "Tono y voz narrativa",
    description: "Cambios bruscos de registro o ruptura del punto de vista",
    colorId: 9,
    includesSynonyms: false,
    directFix: false,
    requiresFullDoc: true,
    prompt: `Eres un editor literario experto. Analiza el siguiente texto narrativo completo en busca de inconsistencias en el tono y la voz narrativa:
1. Cambios bruscos de registro sin justificación: de formal a coloquial, de culto a vulgar
2. El narrador rompe el punto de vista establecido (ej: narrador omnisciente que de repente dice "no sé lo que pensaba el personaje")
3. Cambios de persona narrativa no justificados (de tercera a primera o segunda persona)
4. Intrusiones del autor que rompen la ficción sin ser un recurso metanarrativo intencional

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "issueType": "cambio_registro|ruptura_pov|cambio_persona|intrusion_autor",
      "establishedTone": "descripción del tono/voz establecido",
      "occurrence": { "text": "fragmento exacto con la ruptura", "location": "ubicación" },
      "explanation": "descripción de la inconsistencia"
    }
  ]
}
Si no encuentras ninguna: {"findings": []}`
  },

  {
    id: "nombres_inconsistentes",
    groupId: "coherence",
    label: "Inconsistencia de nombres propios",
    description: "El mismo nombre escrito de formas distintas",
    colorId: 9,
    includesSynonyms: false,
    directFix: false,
    requiresFullDoc: true,
    prompt: `Eres un corrector experto en español. Analiza el siguiente texto en busca de inconsistencias en la grafía de nombres propios de personajes y lugares: el mismo nombre escrito de formas distintas a lo largo del texto (con o sin tilde, mayúsculas/minúsculas, distintas grafías).

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "name": "nombre afectado",
      "variants": ["variante 1", "variante 2"],
      "occurrences": [
        { "text": "fragmento con variante 1", "location": "ubicación" },
        { "text": "fragmento con variante 2", "location": "ubicación" }
      ],
      "recommendedForm": "forma recomendada",
      "explanation": "descripción de la inconsistencia"
    }
  ]
}
Si no encuentras ninguna: {"findings": []}`
  },

  {
    id: "pov",
    groupId: "coherence",
    label: "Cambios de punto de vista (POV)",
    description: "Saltos entre perspectivas sin transición clara",
    colorId: 9,
    includesSynonyms: false,
    directFix: false,
    requiresFullDoc: true,
    prompt: `Eres un editor literario experto. Analiza el siguiente texto narrativo en busca de cambios no controlados de punto de vista (POV):
1. En narración con focalización fija (seguimos a un personaje), saltar a los pensamientos o percepciones de otro sin transición
2. En narración en tercera persona limitada, el narrador accede a información que el personaje focal no puede saber
3. Cabeza-hopping: cambiar de POV varias veces dentro de una misma escena sin separación clara

Texto a analizar:
{TEXT}

Responde ÚNICAMENTE con un JSON válido:
{
  "findings": [
    {
      "focalCharacter": "personaje cuyo POV se estaba usando",
      "intrudingCharacter": "personaje cuyo POV irrumpe",
      "occurrence": { "text": "fragmento exacto con el cambio de POV", "location": "ubicación" },
      "explanation": "descripción del problema de POV"
    }
  ]
}
Si no encuentras ninguno: {"findings": []}`
  },

];

// ── CONFIGURACIÓN GLOBAL ─────────────────────────────────────────────────────
export const CONFIG = {
  // Modelo de Claude a utilizar
  model: "claude-sonnet-4-20250514",

  // Máximo de tokens por respuesta
  maxTokens: 2048,

  // Número aproximado de palabras por token (para estimación de coste)
  wordsPerToken: 0.75,

  // Precio por token en USD (Claude Sonnet)
  inputPricePerToken:  0.000003,   // $3 por millón de tokens de entrada
  outputPricePerToken: 0.000015,   // $15 por millón de tokens de salida

  // Tamaño máximo de fragmento para análisis (en palabras)
  // Los documentos más largos se dividen en fragmentos de este tamaño
  chunkSizeWords: 1500,

  // Overlap entre fragmentos (en palabras) para no perder contexto en los bordes
  chunkOverlapWords: 150,

  // Para coherencia narrativa: tamaño máximo antes de dividir por capítulos
  coherenceChunkSizeWords: 80000,

  // Versión del formato de nombre del documento de revisión
  revisionSuffix: "REVISION",
  statsSuffix: "ESTADISTICAS",
};
