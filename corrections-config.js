// ============================================================================
// PLUMIA — corrections-config.js
// COLOR_MAP, CONFIG, GROUPS, CORRECTIONS (con prompts completos)
// Expuesto como window.PLUMIA_* para compatibilidad con Office Add-in
// ============================================================================
(function() {
window.PLUMIA_COLOR_MAP = {
  1:{name:"Rojo",hex:"FF0000",type:"text"},
  2:{name:"Amarillo",hex:"FFD966",type:"highlight"},
  3:{name:"Verde claro",hex:"92D050",type:"highlight"},
  4:{name:"Naranja",hex:"FF9900",type:"highlight"},
  5:{name:"Turquesa",hex:"00B0F0",type:"highlight"},
  6:{name:"Rosa",hex:"FF69B4",type:"bracket"},
  7:{name:"Azul",hex:"0070C0",type:"text"},
  8:{name:"Lavanda",hex:"C9B8FF",type:"highlight"},
  9:{name:"Violeta",hex:"7030A0",type:"highlight"},
};

window.PLUMIA_CONFIG = {
  model:"claude-sonnet-4-20250514",
  maxTokens:4096,
  wordsPerToken:0.75,
  inputPricePerToken:0.000003,
  outputPricePerToken:0.000015,
  chunkSizeWords:1500,
  chunkOverlapWords:150,
  coherenceChunkSizeWords:80000,
  revisionSuffix:"REVISION",
  statsSuffix:"ESTADISTICAS",
};

window.PLUMIA_GROUPS = [
  {id:"pronouns",  label:"Pronombres y deixis"},
  {id:"lexicon",   label:"Léxico y vocabulario"},
  {id:"style",     label:"Estilo y fluidez"},
  {id:"grammar",   label:"Gramática"},
  {id:"orthotypo", label:"Ortotipografía"},
  {id:"coherence", label:"Coherencia narrativa", requiresFullDoc:true},
];

window.PLUMIA_CORRECTIONS = [
  {id:"leismo", groupId:"pronouns", label:"Leísmos, laísmos y loísmos", desc:"Uso incorrecto de le, la, lo como complemento", colorId:1, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector experto en español. Analiza el siguiente texto en busca de leísmos, laísmos y loísmos: usos incorrectos de los pronombres le, la y lo.\nRecuerda:\n- "lo/la" son complemento directo (CD)\n- "le" es complemento indirecto (CI)\n- Leísmo: usar "le" donde corresponde "lo/la". Ej: "Le vi ayer" → "Lo vi ayer"\n- Laísmo: usar "la" donde corresponde "le". Ej: "La dije que viniera" → "Le dije que viniera"\n- Loísmo: usar "lo" donde corresponde "le". Ej: "Lo di el libro" → "Le di el libro"\nIgnora el leísmo de persona masculina singular si es el único caso.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"type":"leismo|laismo|loismo","originalText":"fragmento exacto","correction":"forma correcta","explanation":"explicación breve"}]}\nSi no encuentras ningún error: {"findings":[]}`},

  {id:"ambiguedad_pronominal", groupId:"pronouns", label:"Ambigüedades pronominales", desc:"Pronombres con referente poco claro", colorId:8, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector experto en español. Analiza el texto en busca de ambigüedades pronominales: casos en que pronombres como él, ella, lo, la, le, se, su no tienen un referente claro porque pueden aplicarse a más de un personaje o elemento en la misma frase o párrafo.\nPresta atención a escenas con varios personajes. Solo señala casos genuinamente ambiguos donde el lector no pueda saber a quién se refiere el pronombre.\nNO señales:\n- Pronombres cuyo referente es claro por contexto\n- Errores de leísmo, laísmo o loísmo (eso lo analiza otra categoría)\n- Frases donde el sujeto es obvio\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","pronoun":"pronombre ambiguo","possibleReferents":["ref1","ref2"],"explanation":"por qué es ambiguo","suggestion":"posible reformulación"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"repeticion_lexica", groupId:"lexicon", label:"Repeticiones léxicas cercanas", desc:"Misma palabra repetida en corta distancia", colorId:2, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector de estilo experto en español. Analiza el texto en busca de repeticiones léxicas cercanas: la misma palabra (o su raíz) repetida en un radio de 3-5 líneas, sin intención estilística. No señales artículos, preposiciones, conjunciones, ni repeticiones deliberadas.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"word":"palabra base","occurrences":["fragmento 1","fragmento 2"],"explanation":"breve explicación","synonyms":["sin1","sin2","sin3"]}]}\nSi no encuentras ninguna: {"findings":[]}`},

  {id:"verbos_comedin", groupId:"lexicon", label:"Verbos comodín", desc:"Abuso de hacer, poner, tener, dar, haber…", colorId:4, includesSynonyms:true, directFix:false,
   prompt:`Eres un corrector de estilo experto en español. Analiza el texto en busca de verbos comodín usados en exceso: hacer, poner, tener, dar, haber, decir, ver, ir, venir, coger, cuando podría usarse un verbo más preciso. Solo señala casos donde empobrezca claramente el estilo.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","verb":"verbo comodín","explanation":"por qué es mejorable","alternatives":["alt1","alt2","alt3"]}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"sustantivos_genericos", groupId:"lexicon", label:"Sustantivos genéricos", desc:"Abuso de cosa, tema, aspecto, situación…", colorId:4, includesSynonyms:true, directFix:false,
   prompt:`Eres un corrector de estilo experto en español. Analiza el texto en busca de sustantivos genéricos: cosa, tema, aspecto, situación, elemento, cuestión, problema, algo, asunto, hecho, usados donde podría emplearse un término más concreto.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","genericWord":"palabra genérica","explanation":"por qué es mejorable","alternatives":["alt1","alt2","alt3"]}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"muletillas", groupId:"lexicon", label:"Muletillas narrativas", desc:"Expresiones repetidas que no aportan valor", colorId:4, includesSynonyms:true, directFix:false,
   prompt:`Eres un corrector de estilo experto en español. Analiza el texto en busca de muletillas: palabras o expresiones que aparecen con demasiada frecuencia y no aportan información nueva. Ej: "en cierto modo", "de alguna manera", "de repente" repetido, "entonces", "básicamente", "realmente". Solo señala las que aparezcan al menos 2 veces o sean claramente innecesarias.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"expression":"muletilla","occurrences":["fragmento 1","fragmento 2"],"explanation":"por qué es muletilla","alternatives":["alt1","alt2","eliminar"]}]}\nSi no encuentras ninguna: {"findings":[]}`},

  {id:"pleonasmos", groupId:"lexicon", label:"Pleonasmos", desc:"Palabras innecesarias que repiten información", colorId:4, includesSynonyms:true, directFix:false,
   prompt:`Eres un corrector experto en español. Analiza el texto en busca de pleonasmos: palabras innecesarias que repiten información ya contenida. Ej: "subir arriba", "bajar abajo", "entrar dentro", "salir fuera", "ver con mis propios ojos", "volver a reincidir".\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","explanation":"por qué es redundante","correction":"forma sin redundancia"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"adverbios_mente", groupId:"style", label:"Abuso de adverbios en -mente", desc:"Acumulación de adverbios terminados en -mente", colorId:3, includesSynonyms:true, directFix:false,
   prompt:`Eres un corrector de estilo experto en español. Analiza el texto en busca de uso excesivo de adverbios en -mente.\nIMPORTANTE: Solo señala palabras que TERMINEN LITERALMENTE en "-mente" y que EXISTAN en el texto analizado. Si el texto no contiene ninguna palabra que termine en -mente, devuelve findings:[]. NO inventes adverbios, NO señales otras construcciones.\nSeñala: 1) Acumulaciones de dos o más adverbios en -mente cercanos. 2) Adverbios en -mente concretos que podrían sustituirse por una construcción más elegante. No señales los que sean la mejor opción en su contexto.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto que contiene el adverbio en -mente","adverbs":["adverbio_que_termina_en_mente"],"explanation":"por qué revisarlo"}]}\nSi no encuentras ningún adverbio en -mente en el texto: {"findings":[]}`},

  {id:"voz_pasiva", groupId:"style", label:"Voz pasiva innecesaria", desc:"Construcciones pasivas que podrían ser activas", colorId:5, includesSynonyms:true, directFix:false,
   prompt:`Eres un corrector de estilo experto en español. Analiza el texto en busca de construcciones en voz pasiva que resultarían más naturales en voz activa. Señala tanto la pasiva perifrástica ("fue abierto por") como la pasiva refleja innecesaria ("se abrió"). No señales cuando sea la opción más natural o sin agente claro.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento en voz pasiva","explanation":"por qué revisarlo","activeVersion":"reformulación en voz activa"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"frases_largas", groupId:"style", label:"Frases demasiado largas", desc:"Oraciones de +40 palabras que dificultan la lectura", colorId:6, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector de estilo experto en español. Analiza el texto en busca de frases excesivamente largas (más de 40 palabras, o más cortas pero con estructura subordinada muy compleja) que dificulten la comprensión o rompan el ritmo.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"frase completa exacta","wordCount":45,"explanation":"por qué dificulta la lectura","suggestion":"cómo dividirla o simplificarla"}]}\nSi no encuentras ninguna: {"findings":[]}`},

  {id:"nombres_propios", groupId:"style", label:"Exceso de nombres propios", desc:"Repetición excesiva de nombres propios cercanos", colorId:7, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector de estilo experto en español. Analiza el texto en busca de nombres propios que se repiten con demasiada frecuencia en un fragmento corto, cuando podrían sustituirse por pronombres u otras referencias.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"name":"nombre propio","occurrences":["fragmento 1","fragmento 2"],"explanation":"por qué resulta excesivo","suggestion":"cómo aligerarlo"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"ritmo_narrativo", groupId:"style", label:"Ritmo narrativo", desc:"Desequilibrios de ritmo entre escena y longitud de frases", colorId:7, includesSynonyms:false, directFix:false,
   prompt:`Eres un editor literario experto en español. Analiza el texto en busca de desequilibrios de ritmo: 1) Frases largas en escenas de acción/tensión. 2) Frases muy cortas en escenas descriptivas/de atmósfera. 3) Párrafos con densidad muy desigual sin intención estilística.\nNO señales:\n- Textos muy breves (menos de 100 palabras) donde no hay suficiente contexto para evaluar el ritmo\n- Errores gramaticales como leísmos que no tienen que ver con el ritmo\n- Frases cortas que son perfectamente válidas estilísticamente\n- Textos que no tienen suficiente extensión para determinar si hay un desequilibrio real\nSolo señala casos donde el desequilibrio sea CLARO, EVIDENTE y PERJUDICIAL para la lectura.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","sceneType":"acción|descripción|diálogo|reflexión","issue":"descripción del desequilibrio","suggestion":"cómo mejorar el ritmo"}]}\nSi no encuentras ninguno o el texto es demasiado corto para evaluarlo: {"findings":[]}`},

  {id:"gerundios", groupId:"grammar", label:"Gerundios incorrectos", desc:"Gerundio de posterioridad y otros usos incorrectos", colorId:7, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector gramatical experto en español. Analiza el texto en busca de gerundios incorrectos: 1) Gerundio de posterioridad: acción posterior a la principal. Ej: "Salió de casa, encontrando a Juan". 2) Gerundio especificativo: "Una ley regulando el tráfico" → "que regula". 3) Gerundio como adjetivo: "Una caja conteniendo libros".\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","gerund":"gerundio problemático","errorType":"posterioridad|especificativo|adjetivo","explanation":"por qué es incorrecto","correction":"reformulación correcta"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"dequeismo", groupId:"grammar", label:"Dequeísmo y queísmo", desc:"Uso incorrecto de 'de que' / omisión incorrecta", colorId:7, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector gramatical experto en español. Analiza el texto en busca de: 1) Dequeísmo: "de que" donde solo corresponde "que". Ej: "Pienso de que..." → "Pienso que...". 2) Queísmo: omitir "de" donde es necesaria. Ej: "Estoy seguro que..." → "Estoy seguro de que...".\nNO señales:\n- Errores de leísmo, laísmo o loísmo (eso lo analiza otra categoría)\n- Usos correctos de "de que" después de verbos que lo requieren\n- Frases que contienen errores de otro tipo pero no dequeísmo ni queísmo\nSolo señala si encuentras exactamente una construcción "de que" incorrecta o una omisión incorrecta de "de".\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","errorType":"dequeismo|queismo","explanation":"explicación breve","correction":"forma correcta"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"concordancia", groupId:"grammar", label:"Concordancia de género y número", desc:"Errores de concordancia sujeto-verbo o sustantivo-adjetivo", colorId:7, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector gramatical experto en español. Analiza el texto en busca de errores de concordancia: 1) Sujeto-verbo: el verbo no concuerda en número con el sujeto. 2) Sustantivo-adjetivo: el adjetivo no concuerda en género o número. Ignora sujetos compuestos o colectivos con concordancia flexible.\nNO señales:\n- Errores de leísmo, laísmo o loísmo (eso lo analiza otra categoría). Por ejemplo, "La dije" es un laísmo, NO un error de concordancia.\n- Errores de otro tipo que no sean estrictamente de concordancia entre sujeto-verbo o sustantivo-adjetivo\n- Cualquier frase que simplemente te parezca incorrecta por otros motivos\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","errorType":"sujeto-verbo|sustantivo-adjetivo","explanation":"descripción del error","correction":"forma correcta"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"tiempos_verbales", groupId:"grammar", label:"Inconsistencia de tiempos verbales", desc:"Mezcla no intencional de indefinido e imperfecto", colorId:5, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector literario experto en español. Analiza el texto en busca de posibles inconsistencias en tiempos verbales del pasado: mezclas no intencionales de pretérito indefinido (canté) e imperfecto (cantaba) dentro de una misma escena. Solo señala los que parezcan descuidos, no los cambios intencionales.\nNO señales:\n- Errores de leísmo, laísmo o loísmo (eso lo analiza otra categoría)\n- Frases con otros tipos de errores gramaticales que no sean de tiempo verbal\n- Cambios de tiempo verbal que son correctos y habituales (descripción en imperfecto + acción en indefinido)\nSolo marca si hay un cambio de tiempo verbal que rompa la coherencia temporal de la escena.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","verbsFound":["verbo indefinido","verbo imperfecto"],"explanation":"por qué podría ser descuido","suggestion":"cómo resolverlo"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"ortotipografia_pura", groupId:"orthotypo", label:"Ortotipografía pura", desc:"Guiones, comillas, puntos suspensivos, mayúsculas, signos ¿¡, espaciado", colorId:null, includesSynonyms:false, directFix:true,
   prompt:`Eres un corrector ortotipográfico experto en español. Analiza el texto ÚNICAMENTE en busca de errores tipográficos y ortotipográficos. Corrige:\n1. Guiones de diálogo: guion corto (-) en lugar de raya (—)\n2. Comillas inglesas ("") en lugar de españolas («»)\n3. Tres puntos separados (...) en lugar del carácter tipográfico (…)\n4. Signos de apertura omitidos (¿ ¡)\n5. Espacio ANTES de coma, punto, punto y coma, dos puntos (NO después)\n6. Falta de mayúscula al inicio de párrafo o tras punto final\nNO corrijas NUNCA:\n- Errores gramaticales como leísmos, laísmos o loísmos. Por ejemplo, "La dije" es un laísmo gramatical, NO un error ortotipográfico. NO lo corrijas aquí.\n- Errores de concordancia, dequeísmo, gerundios ni ningún otro error gramatical\n- Estilo, vocabulario o estructura de las frases\nSolo señala y corrige errores puramente tipográficos.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"errorType":"guion|comillas|puntos_suspensivos|signo_apertura|espaciado|mayusculas","originalText":"fragmento exacto","correction":"fragmento corregido","isFirstOccurrence":true,"explanation":"solo si isFirstOccurrence: explicación breve"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"puntuacion_dialogo", groupId:"orthotypo", label:"Problemas de puntuación en diálogo", desc:"Errores de puntuación en intervenciones y acotaciones", colorId:6, includesSynonyms:false, directFix:false,
   prompt:`Eres un corrector ortotipográfico experto en español. Analiza el texto en busca de errores de puntuación en diálogos: 1) Falta de raya antes de la acotación: —Hola. dijo → —Hola —dijo. 2) Punto incorrecto antes de acotación. 3) Coma innecesaria antes de raya de cierre. 4) Mayúscula incorrecta en verbo de acotación. 5) Punto tras interrogación/exclamación: —¿Vienes?. → —¿Vienes? 6) Falta de punto tras acotación cuando el diálogo continúa. 7) Coma innecesaria después de interrogación.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"originalText":"fragmento exacto","errorType":"descripción breve del error","correction":"fragmento corregido","explanation":"explicación breve de la regla"}]}\nSi no encuentras ninguno: {"findings":[]}`},

  {id:"coherencia_personajes", groupId:"coherence", label:"Coherencia de personajes", desc:"Contradicciones en experiencias, habilidades o rasgos físicos", colorId:9, includesSynonyms:false, directFix:false, requiresFullDoc:true,
   prompt:`Eres un editor literario experto. Analiza el texto narrativo en busca de contradicciones en la caracterización de personajes: 1) Experiencias que se contradicen (afirma que es la primera vez pero ya lo hizo antes). 2) Habilidades que aparecen y desaparecen sin explicación. 3) Rasgos físicos que cambian sin justificación. 4) Conocimiento que un personaje no debería tener.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"characterName":"nombre del personaje","contradictionType":"experiencia|habilidad|rasgo_fisico|conocimiento","occurrence1":{"text":"fragmento exacto","location":"ubicación"},"occurrence2":{"text":"fragmento contradictorio","location":"ubicación"},"explanation":"descripción de la contradicción"}]}\nSi no encuentras ninguna: {"findings":[]}`},

  {id:"coherencia_temporal", groupId:"coherence", label:"Coherencia temporal", desc:"Inconsistencias en la línea de tiempo del relato", colorId:9, includesSynonyms:false, directFix:false, requiresFullDoc:true,
   prompt:`Eres un editor literario experto. Analiza el texto en busca de inconsistencias temporales: 1) Referencias temporales contradictorias. 2) Edades que no encajan con fechas mencionadas. 3) Estaciones del año contradictorias en el mismo período. 4) Eventos en orden imposible.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"inconsistencyType":"referencia_temporal|edad|estacion|orden_eventos","occurrence1":{"text":"fragmento exacto","location":"ubicación"},"occurrence2":{"text":"fragmento contradictorio","location":"ubicación"},"explanation":"descripción de la inconsistencia"}]}\nSi no encuentras ninguna: {"findings":[]}`},

  {id:"coherencia_objetos", groupId:"coherence", label:"Coherencia de objetos y espacios", desc:"Objetos que desaparecen o espacios que cambian sin explicación", colorId:9, includesSynonyms:false, directFix:false, requiresFullDoc:true,
   prompt:`Eres un editor literario experto. Analiza el texto en busca de inconsistencias en objetos o espacios: 1) Objeto importante que desaparece sin explicación. 2) Personaje usa un objeto que no podía tener. 3) Distribución de espacios que cambia entre escenas. 4) Personaje lleva algo que olvidó, perdió o entregó antes.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"itemOrSpace":"nombre del objeto/espacio","inconsistencyType":"objeto_desaparece|objeto_imposible|espacio_cambia","occurrence1":{"text":"fragmento exacto","location":"ubicación"},"occurrence2":{"text":"fragmento contradictorio","location":"ubicación"},"explanation":"descripción"}]}\nSi no encuentras ninguna: {"findings":[]}`},

  {id:"coherencia_conocimiento", groupId:"coherence", label:"Coherencia de conocimiento", desc:"Personajes que saben cosas que no deberían saber aún", colorId:9, includesSynonyms:false, directFix:false, requiresFullDoc:true,
   prompt:`Eres un editor literario experto. Analiza el texto en busca de inconsistencias en el conocimiento de personajes: 1) Un personaje sabe algo que aún no le han contado. 2) Un personaje actúa como si no supiera algo que vivió. 3) El narrador revela información que el personaje focal no podría conocer.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"characterName":"personaje","knowledgeIssue":"descripción","occurrence1":{"text":"fragmento","location":"ubicación"},"occurrence2":{"text":"fragmento contradictorio","location":"ubicación"},"explanation":"descripción"}]}\nSi no encuentras ninguna: {"findings":[]}`},

  {id:"tono_voz", groupId:"coherence", label:"Tono y voz narrativa", desc:"Cambios bruscos de registro o ruptura del punto de vista", colorId:9, includesSynonyms:false, directFix:false, requiresFullDoc:true,
   prompt:`Eres un editor literario experto. Analiza el texto en busca de inconsistencias CLARAS en tono y voz narrativa: 1) Cambios bruscos e injustificados de registro (de formal a muy coloquial). 2) El narrador rompe explícitamente el punto de vista establecido. 3) Cambios de persona narrativa no justificados. 4) Intrusiones del autor que rompen la ficción.\nNO señales:\n- Textos breves (menos de 200 palabras) donde es imposible evaluar el tono con fiabilidad\n- Errores gramaticales como leísmos que no tienen que ver con el tono\n- Variaciones de tono que podrían ser intencionales\n- Textos sin contexto suficiente para determinar el tono establecido\nSolo señala inconsistencias MUY CLARAS Y EVIDENTES.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"issueType":"cambio_registro|ruptura_pov|cambio_persona|intrusion_autor","establishedTone":"descripción del tono establecido","occurrence":{"text":"fragmento con la ruptura","location":"ubicación"},"explanation":"descripción"}]}\nSi no encuentras ninguna inconsistencia CLARA: {"findings":[]}`},

  {id:"nombres_inconsistentes", groupId:"coherence", label:"Inconsistencia de nombres propios", desc:"El mismo nombre escrito de formas distintas", colorId:9, includesSynonyms:false, directFix:false, requiresFullDoc:true,
   prompt:`Eres un corrector experto en español. Analiza el texto en busca de inconsistencias en la grafía de nombres propios: el mismo nombre escrito de formas distintas (con o sin tilde, mayúsculas/minúsculas, grafías diferentes).\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"name":"nombre afectado","variants":["variante1","variante2"],"occurrences":[{"text":"fragmento","location":"ubicación"},{"text":"fragmento","location":"ubicación"}],"recommendedForm":"forma recomendada","explanation":"descripción"}]}\nSi no encuentras ninguna: {"findings":[]}`},

  {id:"pov", groupId:"coherence", label:"Cambios de punto de vista (POV)", desc:"Saltos entre perspectivas sin transición clara", colorId:9, includesSynonyms:false, directFix:false, requiresFullDoc:true,
   prompt:`Eres un editor literario experto. Analiza el texto en busca de cambios no controlados de punto de vista (POV): 1) En focalización fija, saltar a pensamientos de otro personaje sin transición. 2) En tercera persona limitada, el narrador accede a info que el personaje focal no puede saber. 3) Cabeza-hopping: cambiar de POV varias veces dentro de una escena.\nNO señales:\n- Textos breves (menos de 200 palabras) donde no hay suficiente contexto para determinar el POV establecido\n- Errores gramaticales como leísmos que no tienen que ver con el POV\n- Narrador omnisciente, que por definición puede acceder a todos los personajes\n- Casos donde el POV no está claramente establecido\nSolo señala cambios de POV MUY CLAROS Y EVIDENTES en textos suficientemente largos.\n\nTexto a analizar:\n{TEXT}\n\nResponde ÚNICAMENTE con un JSON válido:\n{"findings":[{"focalCharacter":"personaje cuyo POV se usaba","intrudingCharacter":"personaje cuyo POV irrumpe","occurrence":{"text":"fragmento con el cambio","location":"ubicación"},"explanation":"descripción del problema"}]}\nSi no encuentras ninguno: {"findings":[]}`},
];

// ── ESTADO ───────────────────────────────────────────────────────────────────
const state = {
  apiKey:           '',
  selectedIds:      new Set(),
  outputFormat:     'marked',
  currentScreen:    'welcome',
  processor:        null,
  wordCount:        0,
  isResuming:       false,
  hasSelection:     false,
  forceFullDoc:     false,
  coherenceAnswered: false,  // true cuando el usuario ha respondido al aviso de coherencia
  coherenceAccepted: false,  // true si respondió Sí
  completedChecks:  0,
  totalChecks:      0,
  estimatedCostUSD: 0,
  estimatedCostEUR: 0,
};

// ── INICIALIZACIÓN ────────────────────────────────────────────────────────────
Office.onReady(() => {
  buildManualContent();
  buildCorrectionsList();
  checkSavedApiKey();
  checkSavedProgress();
});

// ── CONSTRUCCIÓN DEL MANUAL ───────────────────────────────────────────────────
function buildManualContent() {
  const html = getManualHTML();
  document.getElementById('welcome-manual').innerHTML = html;
  document.getElementById('helpBody').innerHTML = html;
}

function getManualHTML() {
  return `
  <div class="welcome-section">
    <div class="ws-title">A — ¿Qué verifica Plumia?</div>
    <div class="ws-body">
      <p><strong>Plumia</strong> es un corrector ortotipográfico y de estilo para textos en español. Analiza tu escritura en seis áreas y señala con precisión los puntos que merece la pena revisar. <strong>No corrige ni reescribe tu texto</strong>: te indica qué mirar y por qué, respetando siempre tu voz como escritor.</p>
    </div>

    <div class="corr-group-title">Grupo 1 · Pronombres y deixis</div>
    <div class="corr-entry">
      <div class="corr-entry-name">Leísmos, laísmos y loísmos</div>
      <div class="corr-entry-desc">Los usos incorrectos de le, la y lo pueden generar incorrecciones que distraen al lector. En la norma general del español, lo y la son complemento directo; le, indirecto.</div>
      <div class="example-box"><span class="ex-bad">La dije que viniera.</span><br><span class="ex-ok">Le dije que viniera.</span></div>
    </div>
    <div class="corr-entry">
      <div class="corr-entry-name">Ambigüedades pronominales</div>
      <div class="corr-entry-desc">Pronombres como él, ella, lo, la cuyo referente no queda claro por la presencia de varios personajes cercanos.</div>
      <div class="example-box"><span class="ex-bad">Juan habló con Pedro cuando él salió.</span><br><span class="ex-ok">Juan habló con Pedro cuando Pedro salió.</span></div>
    </div>

    <div class="corr-group-title">Grupo 2 · Léxico y vocabulario</div>
    <div class="corr-entry">
      <div class="corr-entry-name">Repeticiones léxicas cercanas</div>
      <div class="corr-entry-desc">La misma palabra repetida en pocas líneas sin intención estilística produce sensación de descuido.</div>
      <div class="example-box"><span class="ex-bad">Abrió la puerta y miró el pasillo. Miró a ambos lados.</span><br><span class="ex-ok">Abrió la puerta y observó el pasillo. Miró a ambos lados.</span></div>
    </div>
    <div class="corr-entry">
      <div class="corr-entry-name">Verbos comodín · Sustantivos genéricos · Muletillas · Pleonasmos</div>
      <div class="corr-entry-desc">Verbos vagos (hacer, poner), sustantivos difusos (cosa, tema), expresiones repetidas sin valor y redundancias (subir arriba) que empobrecen el estilo.</div>
      <div class="example-box"><span class="ex-bad">Hizo una sonrisa. / Subir arriba.</span><br><span class="ex-ok">Sonrió. / Subir.</span></div>
    </div>

    <div class="corr-group-title">Grupo 3 · Estilo y fluidez</div>
    <div class="corr-entry">
      <div class="corr-entry-name">Adverbios en -mente · Voz pasiva · Frases largas · Exceso de nombres · Ritmo</div>
      <div class="corr-entry-desc">Acumulaciones que vuelven la prosa pesada, estructuras que frenan el ritmo o desequilibrios entre el tipo de escena y la longitud de las frases.</div>
      <div class="example-box"><span class="ex-bad">La puerta fue abierta por Carlos.</span><br><span class="ex-ok">Carlos abrió la puerta.</span></div>
    </div>

    <div class="corr-group-title">Grupo 4 · Gramática</div>
    <div class="corr-entry">
      <div class="corr-entry-name">Gerundios · Dequeísmo · Concordancia · Tiempos verbales</div>
      <div class="corr-entry-desc">Errores gramaticales frecuentes: gerundio de posterioridad, preposición de sobra o ausente ante que, falta de acuerdo entre sujeto y verbo, y mezclas no intencionales de tiempos del pasado.</div>
      <div class="example-box"><span class="ex-bad">Salió de casa, encontrando a Juan.</span><br><span class="ex-ok">Salió de casa y encontró a Juan.</span></div>
    </div>

    <div class="corr-group-title">Grupo 5 · Ortotipografía</div>
    <div class="corr-entry">
      <div class="corr-entry-name">Guiones · Comillas · Puntos suspensivos · Mayúsculas · Signos ¿¡ · Espaciado · Puntuación de diálogo</div>
      <div class="corr-entry-desc">Errores tipográficos que se corrigen directamente en el documento. Los cambios quedan marcados en negrita para que puedas identificarlos.</div>
      <div class="example-box"><span class="ex-bad">-No voy - dijo Juan. / "Buenos días"</span><br><span class="ex-ok">—No voy —dijo Juan. / «Buenos días»</span></div>
    </div>

    <div class="corr-group-title">Grupo 6 · Coherencia narrativa <span class="tag coherence">Documento completo</span></div>
    <div class="corr-entry">
      <div class="corr-entry-name">Personajes · Temporal · Objetos · Conocimiento · Tono · Nombres · POV</div>
      <div class="corr-entry-desc">Detecta contradicciones entre capítulos: un personaje que sabe algo que aún no debería saber, un objeto que desaparece sin explicación, cambios de registro bruscos o saltos de punto de vista.</div>
      <div class="example-box"><span class="ex-bad">Cap.1: «Era la primera vez que tocaba un muerto.»<br>Cap.14: «Es la primera vez que toco un muerto.»</span></div>
    </div>
    <div class="note-box">⚠ Las opciones de coherencia narrativa requieren analizar el documento completo y pueden ser hasta 5× más costosas que el resto.</div>
  </div>

  <div class="welcome-section">
    <div class="ws-title">B — Cómo funciona</div>
    <div class="ws-body">
      <p>Plumia envía tu texto a la API de <strong>Claude Sonnet</strong> (Anthropic), un modelo de IA con comprensión profunda del español. El análisis se realiza de forma segura: el texto se transmite cifrado y no se almacena ni se usa para entrenar ningún modelo.</p>
      <p><strong>¿Qué texto se analiza?</strong> Si seleccionas texto antes de lanzar el análisis, solo se envía ese fragmento. Si no hay nada seleccionado, se analiza el documento completo excluyendo el índice, encabezados, pies de página y notas al pie.</p>
      <p>El coste aproximado es de <strong>$0,001 por página</strong>. Antes de cada análisis se muestra una estimación del coste para que puedas decidir.</p>
    </div>
  </div>

  <div class="welcome-section">
    <div class="ws-title">C — Plumia no reescribe tu texto</div>
    <div class="note-box">Plumia señala, no corrige. Tu voz como escritor es intocable.</div>
    <div class="ws-body">
      <p>Plumia no propone cambios automáticos ni altera tu estilo. Señala exactamente dónde hay un posible problema y explica por qué conviene revisarlo. Para algunos tipos de error (adverbios, verbos comodín, voz pasiva) ofrece alternativas orientativas como punto de partida, no como imposición.</p>
    </div>
  </div>

  <div class="welcome-section">
    <div class="ws-title">D — Resultados</div>
    <div class="ws-body">
      <p>Al finalizar el análisis se genera un documento Word nuevo con el nombre del original más <strong>REVISION V.1.0</strong>. Puedes elegir entre:</p>
      <p><strong>Opción A:</strong> Documento marcado con colores y comentarios de Word explicando cada incidencia, más un informe de estadísticas al final.</p>
      <p><strong>Opción B:</strong> Solo un informe de estadísticas (<strong>ESTADISTICAS V.1.0</strong>) con el listado de incidencias por categoría, página y sugerencia.</p>
    </div>
  </div>`;
}

// ── CONSTRUCCIÓN DE LA LISTA DE CORRECCIONES ──────────────────────────────────
function buildCorrectionsList() {
  const container = document.getElementById('corrections-list');
  let html = '';

  for (const group of GROUPS) {
    const groupCorrections = CORRECTIONS.filter(c => c.groupId === group.id);
    const isCoherence = group.id === 'coherence';

    html += `<div class="group-block">
      <div class="group-header">
        ${group.label}
        <span class="group-badge ${isCoherence ? 'coherence-badge' : ''}">
          ${isCoherence ? 'Doc. completo' : groupCorrections.length + ' opciones'}
        </span>
      </div>`;

    for (const corr of groupCorrections) {
      html += `
      <div class="corr-check" id="check-${corr.id}" onclick="toggleCorrection('${corr.id}')">
        <div class="cb-box"></div>
        <div class="cb-text">
          <div class="cb-label">${corr.label}</div>
          <div class="cb-desc">${corr.desc}</div>
        </div>
      </div>`;
    }

    html += `</div>`;
  }

  container.innerHTML = html;
}

// ── NAVEGACIÓN ────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  state.currentScreen = id;

  // Steps bar
  const stepsBar = document.getElementById('steps-bar');
  if (id === 'welcome') {
    stepsBar.style.display = 'none';
  } else {
    stepsBar.style.display = 'flex';
    updateSteps(id);
  }
}

function updateSteps(screenId) {
  const map = { apikey:1, options:2, progress:3, done:3 };
  const current = map[screenId] || 0;
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('step-' + i);
    el.className = 'step' + (i === current ? ' active' : i < current ? ' done' : '');
    if (i < current) el.querySelector('.step-num').textContent = '';
    else el.querySelector('.step-num').textContent = i;
  }
}

function goToApiKey() {
  showScreen('apikey');
  // Pre-rellenar si ya hay clave guardada
  const saved = localStorage.getItem('plumia_api_key');
  if (saved) {
    document.getElementById('apiKeyInput').value = saved;
    state.apiKey = saved;
    setApiStatus('ok', 'Clave guardada ✓');
    document.getElementById('btnContinueApi').disabled = false;
  }
}

function resetCoherenceState() {
  state.forceFullDoc      = false;
  state.coherenceAnswered = false;
  state.coherenceAccepted = false;
  const warning = document.getElementById('coherenceWarning');
  if (warning) {
    warning.classList.remove('visible');
    document.getElementById('coherenceDismissed').classList.remove('visible');
    warning.querySelector('.coherence-warning-btns').style.display = 'flex';
  }
}

function goToOptions() {
  resetCoherenceState();
  state.hasSelection = false; // resetear hasta que detectSelection() confirme
  showScreen('options');
  checkSavedProgress();
  updateAnalyzeButton();
  detectSelection();
}

async function detectSelection() {
  try {
    await Word.run(async ctx => {
      const sel = ctx.document.getSelection();
      sel.load('text');
      await ctx.sync();
      const txt = (sel.text || '').trim();
      const newHasSelection = txt.length > 10;

      // Si cambió el estado de selección, resetear respuesta de coherencia
      if (newHasSelection !== state.hasSelection) {
        state.coherenceAnswered = false;
        state.coherenceAccepted = false;
        state.forceFullDoc      = false;
      }

      state.hasSelection = newHasSelection;
      updateSelectionContext();
      updateCoherenceState();
      updateAnalyzeButton();
    });
  } catch {
    state.hasSelection = false;
    updateSelectionContext();
    updateAnalyzeButton();
  }
}

function updateSelectionContext() {
  const el   = document.getElementById('selectionContext');
  const text = document.getElementById('selectionContextText');
  if (state.hasSelection && !state.forceFullDoc) {
    el.className = 'selection-context';
    text.textContent = '✂️ La revisión se realizará solo sobre el texto que has seleccionado.';
  } else if (state.hasSelection && state.forceFullDoc) {
    el.className = 'selection-context full-doc';
    text.textContent = '📋 La revisión se realizará sobre el documento completo (requerido por coherencia narrativa).';
  } else {
    el.className = 'selection-context full-doc';
    text.textContent = '📋 La revisión se realizará sobre todo el documento. Si solo quieres revisar una parte, selecciona el texto con el ratón antes de lanzar Plumia.';
  }
}

function goBack(to) {
  showScreen(to);
}

// ── API KEY ───────────────────────────────────────────────────────────────────
function validateKeyFormat() {
  const val = document.getElementById('apiKeyInput').value.trim();
  const valid = val.startsWith('sk-ant-') && val.length > 20;
  document.getElementById('btnContinueApi').disabled = !valid;
  if (val.length > 5 && !valid) {
    setApiStatus('err', 'La clave debe empezar por sk-ant-…');
  } else if (valid) {
    setApiStatus('ok', 'Formato correcto');
  } else {
    setApiStatus('', 'Introduce tu clave de API');
  }
}

function setApiStatus(type, msg) {
  const el = document.getElementById('apiStatus');
  el.className = 'api-status' + (type ? ' ' + type : '');
  document.getElementById('apiStatusText').textContent = msg;
}

function toggleKeyVisibility() {
  const input = document.getElementById('apiKeyInput');
  const btn   = document.getElementById('toggleBtn');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Ocultar';
  } else {
    input.type = 'password';
    btn.textContent = 'Ver';
  }
}

function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key.startsWith('sk-ant-')) {
    showApiError('La clave debe empezar por sk-ant-');
    return;
  }
  localStorage.setItem('plumia_api_key', key);
  state.apiKey = key;
  hideApiError();
  goToOptions();
}

function checkSavedApiKey() {
  const saved = localStorage.getItem('plumia_api_key');
  if (saved) {
    state.apiKey = saved;
    buildCorrectionsList();
    checkSavedProgress();
    resetCoherenceState();
    showScreen('options');
    updateAnalyzeButton();
    setTimeout(() => detectSelection(), 300);
  }
}

function showApiError(msg) {
  const el = document.getElementById('apiError');
  document.getElementById('apiErrorText').textContent = msg;
  el.classList.add('visible');
}
function hideApiError() {
  document.getElementById('apiError').classList.remove('visible');
}

// ── CORRECCIONES ──────────────────────────────────────────────────────────────
function toggleCorrection(id) {
  const el = document.getElementById('check-' + id);
  if (el.classList.contains('disabled')) return;

  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
    el.classList.remove('checked');
  } else {
    state.selectedIds.add(id);
    el.classList.add('checked');
  }

  // Resetear respuesta si el usuario cambia las opciones
  state.coherenceAnswered = false;
  state.coherenceAccepted = false;
  document.getElementById('coherenceDismissed').classList.remove('visible');

  updateCoherenceState();
  updateAnalyzeButton();
}

function selectAll(checked) {
  CORRECTIONS.forEach(c => {
    const el = document.getElementById('check-' + c.id);
    if (!el || el.classList.contains('disabled')) return;
    if (checked) {
      state.selectedIds.add(c.id);
      el.classList.add('checked');
    } else {
      state.selectedIds.delete(c.id);
      el.classList.remove('checked');
    }
  });

  // Resetear respuesta al cambiar la selección
  state.coherenceAnswered = false;
  state.coherenceAccepted = false;
  document.getElementById('coherenceDismissed').classList.remove('visible');

  updateCoherenceState();
  updateAnalyzeButton();
}

function updateCoherenceState() {
  const hasAny = state.selectedIds.size > 0;
  const hasCoherence = [...state.selectedIds].some(id => {
    const c = CORRECTIONS.find(x => x.id === id);
    return c && c.requiresFullDoc;
  });

  const warning   = document.getElementById('coherenceWarning');
  const dismissed = document.getElementById('coherenceDismissed');
  const warnText  = warning.querySelector('.coherence-warning-text');
  const warnBtns  = warning.querySelector('.coherence-warning-btns');

  // Si ya respondió, no volver a mostrar
  if (state.coherenceAnswered) return;

  // Sin ninguna opción marcada → ocultar todo
  if (!hasAny) {
    warning.classList.remove('visible');
    dismissed.classList.remove('visible');
    return;
  }

  if (!state.hasSelection) {
    // CASO A: No hay selección → confirmar análisis de documento completo
    // Se muestra siempre que haya al menos una opción marcada
    warnText.innerHTML = `📋 Se va a analizar todo el documento. ¿Estás de acuerdo?`;
    warnBtns.style.display = 'flex';
    warnBtns.innerHTML = `
      <button class="btn-coherence-yes" onclick="acceptCoherenceFullDoc()">Sí</button>
      <button class="btn-coherence-no" onclick="rejectCoherenceNoSelection()">No</button>`;
    dismissed.classList.remove('visible');
    warning.classList.add('visible');

  } else if (hasCoherence) {
    // CASO B: Hay selección + coherencia → preguntar si quiere analizar todo
    warnText.innerHTML = `⚠ Las opciones de coherencia narrativa solo pueden revisarse si se analiza el documento completo. ¿Quieres que se analice todo el documento?<br>
      <em style="font-size:10.5px;opacity:.8">(El análisis puede tardar más y ser más costoso.)</em>`;
    warnBtns.style.display = 'flex';
    warnBtns.innerHTML = `
      <button class="btn-coherence-yes" onclick="acceptCoherenceFullDoc()">Sí, analizar todo</button>
      <button class="btn-coherence-no" onclick="rejectCoherenceFullDoc()">No</button>`;
    dismissed.classList.remove('visible');
    warning.classList.add('visible');

  } else {
    // CASO C: Hay selección + sin coherencia → sin aviso, todo OK
    warning.classList.remove('visible');
    dismissed.classList.remove('visible');
  }
}

function acceptCoherenceFullDoc() {
  state.forceFullDoc      = true;
  state.coherenceAnswered = true;
  state.coherenceAccepted = true;
  document.getElementById('coherenceWarning').classList.remove('visible');
  document.getElementById('coherenceDismissed').classList.remove('visible');
  updateSelectionContext();
  updateAnalyzeButton();
}

function rejectCoherenceFullDoc() {
  // Con selección → desmarcar coherencia
  _uncheckCoherenceItems();
  state.coherenceAnswered = false;
  state.coherenceAccepted = false;
  state.forceFullDoc      = false;

  document.getElementById('coherenceWarning').querySelector('.coherence-warning-btns').style.display = 'none';
  document.getElementById('coherenceDismissed').textContent = 'Checks de coherencia narrativa desmarcados.';
  document.getElementById('coherenceDismissed').classList.add('visible');

  setTimeout(() => {
    document.getElementById('coherenceWarning').classList.remove('visible');
    document.getElementById('coherenceDismissed').classList.remove('visible');
  }, 3000);

  updateAnalyzeButton();
}

function rejectCoherenceNoSelection() {
  // Sin selección → deshabilitar botón y mostrar instrucción
  state.coherenceAnswered = true;
  state.coherenceAccepted = false;

  document.getElementById('coherenceWarning').querySelector('.coherence-warning-btns').style.display = 'none';
  document.getElementById('coherenceDismissed').textContent = 'Pulsa Cancelar y selecciona el texto que quieres revisar.';
  document.getElementById('coherenceDismissed').classList.add('visible');

  updateAnalyzeButton();
}

function _uncheckCoherenceItems() {
  const coherenceIds = CORRECTIONS.filter(c => c.requiresFullDoc).map(c => c.id);
  for (const id of coherenceIds) {
    state.selectedIds.delete(id);
    const el = document.getElementById('check-' + id);
    if (el) el.classList.remove('checked');
  }
}

function updateAnalyzeButton() {
  const hasAny = state.selectedIds.size > 0;
  const hasCoherence = [...state.selectedIds].some(id => {
    const c = CORRECTIONS.find(x => x.id === id);
    return c && c.requiresFullDoc;
  });

  // Necesita confirmación si:
  // A) No hay selección → siempre debe confirmar analizar todo
  // B) Hay selección + coherencia → debe confirmar analizar todo
  const needsConfirmation =
    hasAny && (
      (!state.hasSelection) ||
      (state.hasSelection && hasCoherence)
    );

  const coherenceBlocking =
    needsConfirmation && (
      !state.coherenceAnswered ||
      (state.coherenceAnswered && !state.coherenceAccepted)
    );

  const enabled = hasAny && !coherenceBlocking;
  document.getElementById('btnAnalyze').disabled = !enabled;

  let hint = '';
  if (!hasAny) {
    hint = 'Selecciona al menos una opción';
  } else if (coherenceBlocking && state.coherenceAnswered && !state.coherenceAccepted) {
    hint = 'Pulsa Cancelar o selecciona texto para revisar solo una parte';
  } else if (coherenceBlocking) {
    hint = 'Responde al aviso para continuar';
  } else {
    hint = `${state.selectedIds.size} opción${state.selectedIds.size !== 1 ? 'es' : ''} seleccionada${state.selectedIds.size !== 1 ? 's' : ''}`;
  }
  document.getElementById('selectionHint').textContent = hint;
}

function selectFormat(fmt) {
  state.outputFormat = fmt;
  document.getElementById('format-marked').classList.toggle('selected', fmt === 'marked');
  document.getElementById('format-report').classList.toggle('selected', fmt === 'report');
}

// ── CÁLCULO DE COSTE ──────────────────────────────────────────────────────────
async function requestCostEstimate() {
  // Obtener número de palabras según si hay selección o no
  try {
    await Word.run(async ctx => {
      if (state.hasSelection && !state.forceFullDoc) {
        // Contar solo las palabras seleccionadas
        const sel = ctx.document.getSelection();
        sel.load('text'); await ctx.sync();
        state.wordCount = (sel.text || '').trim().split(/\s+/).filter(Boolean).length;
      } else {
        // Contar todo el documento
        const body = ctx.document.body;
        body.load('text'); await ctx.sync();
        state.wordCount = (body.text || '').trim().split(/\s+/).filter(Boolean).length;
      }
    });
  } catch {
    state.wordCount = 500;
  }

  const hasCoherence = [...state.selectedIds].some(id => {
    const c = CORRECTIONS.find(x => x.id === id);
    return c && c.requiresFullDoc;
  });

  // Obtener tasa EUR/USD
  let eurRate = 1.08;
  try {
    const res  = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    eurRate = data.rates?.EUR || 1.08;
  } catch {}

  // Calcular coste
  const wordsPerToken    = 0.75;
  const inputPrice       = 0.000003;
  const outputPrice      = 0.000015;
  const textTokens       = Math.ceil(state.wordCount / wordsPerToken);
  const promptTokensAvg  = 300;
  const numCorrections   = state.selectedIds.size;
  const inputTokens      = numCorrections * (textTokens + promptTokensAvg);
  const outputTokens     = numCorrections * Math.ceil(textTokens * 0.15);
  const multiplier       = hasCoherence ? 1.8 : 1.0;
  const totalUSD         = ((inputTokens * inputPrice) + (outputTokens * outputPrice)) * multiplier;
  const totalEUR         = totalUSD / eurRate;
  const totalTokens      = Math.ceil((inputTokens + outputTokens) * multiplier);

  // Guardar en state para mostrar en pantalla de resultados
  state.estimatedCostUSD = totalUSD;
  state.estimatedCostEUR = totalEUR;

  // Mostrar popup
  document.getElementById('costWords').textContent   = state.wordCount.toLocaleString('es-ES');
  document.getElementById('costChecks').textContent  = numCorrections;
  document.getElementById('costUSD').textContent     = '$' + totalUSD.toFixed(4);
  document.getElementById('costEUR').textContent     = totalEUR.toFixed(4) + ' €';
  document.getElementById('costTokens').textContent  = totalTokens.toLocaleString('es-ES') + ' tokens';
  document.getElementById('coherenceCostNote').classList.add('visible');
  document.getElementById('costOverlay').classList.add('visible');
}

function closeCostPopup(e) {
  if (!e || e.target === document.getElementById('costOverlay')) {
    document.getElementById('costOverlay').classList.remove('visible');
  }
}

// ── ANÁLISIS ──────────────────────────────────────────────────────────────────
async function confirmAndAnalyze() {
  closeCostPopup();
  showScreen('progress');
  hideAnalysisError();

  updateProgress(0, 'Extrayendo texto del documento…');

  try {
    // Importar processor dinámicamente (en producción se importaría como módulo)
    // Para el add-in se incluirá el código inline o mediante script tag
    await runAnalysis();
  } catch (err) {
    handleAnalysisError(err, false);
  }
}

async function runAnalysis() {
  // Llamada a processor.js (PlumiaProcessor)
  // En el add-in final esto usará import() o tendrá el código inline
  const { PlumiaProcessor } = await getProcessor();

  const proc = new PlumiaProcessor(
    state.apiKey,
    [...state.selectedIds],
    state.outputFormat,
    (pct, msg) => {
      updateProgress(pct, msg);
      // Actualizar contadores para el popup de detener
      state.totalChecks = state.selectedIds.size;
      state.completedChecks = Math.round((pct / 100) * state.totalChecks);
    },
    (partialResults) => {
      // Guardado parcial progresivo
    },
    (err, canResume, corrLabel) => handleAnalysisError(err, canResume, corrLabel)
  );

  state.processor = proc;

  // Extraer texto
  updateProgress(2, 'Leyendo el documento…');
  const { text, isSelection, wordCount } = await proc.extractTextFromDocument();

  // Análisis
  const allResults = await proc.analyze(text, isSelection);

  // Construir output
  updateProgress(98, 'Generando documento de revisión…');
  const { DocumentBuilder } = await getDocumentBuilder();
  const builder = new DocumentBuilder(state.outputFormat);

  const resolved = proc.resolveOverlaps(allResults);
  const originalName = await getDocumentName();
  const output = await builder.buildOutput(allResults, resolved, originalName, [...state.selectedIds]);

  showDoneScreen(output, allResults);
}

function updateProgress(pct, msg) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = pct + '%';
  document.getElementById('progressStepLabel').textContent = msg || '';
  if (pct > 5) {
    document.getElementById('progressSubtitle').textContent = 'Analizando tu texto con Claude…';
  }
}

function showStopPopup() {
  document.getElementById('stopCompletedCount').textContent = state.completedChecks;
  document.getElementById('stopTotalCount').textContent     = state.totalChecks || state.selectedIds.size;
  document.getElementById('stopAnalysisPopup').classList.add('visible');
}

function closeStopPopup() {
  document.getElementById('stopAnalysisPopup').classList.remove('visible');
}

function confirmStopAnalysis() {
  closeStopPopup();
  if (state.processor) state.processor.abort();
  showScreen('options');
}

function abortAnalysis() {
  showStopPopup();
}

function handleAnalysisError(err, canResume, corrLabel) {
  const errEl    = document.getElementById('analysisError');
  const titleEl  = document.getElementById('analysisErrorTitle');
  const textEl   = document.getElementById('analysisErrorText');
  const resumeEl = document.getElementById('btnResumeAnalysis');

  let title = 'Error en el análisis';
  let text  = err.message || 'Error desconocido';

  if (err.message?.includes('API_KEY_INVALID')) {
    title = 'Clave de API inválida';
    text  = 'Revisa tu clave en console.anthropic.com';
  } else if (err.message?.includes('RATE_LIMIT')) {
    title = 'Límite de uso alcanzado';
    text  = 'Espera unos segundos e inténtalo de nuevo';
  } else if (corrLabel) {
    text = `El análisis se interrumpió en «${corrLabel}». ${canResume ? 'Puedes retomar desde este punto.' : ''}`;
  }

  titleEl.textContent = title;
  textEl.textContent  = text;
  resumeEl.style.display = canResume ? 'inline-block' : 'none';
  errEl.classList.add('visible');

  if (state.currentScreen === 'progress') showScreen('options');
}

function hideAnalysisError() {
  document.getElementById('analysisError').classList.remove('visible');
}

function resumeFromError() {
  confirmAndAnalyze();
}

// ── PANTALLA DE COMPLETADO ────────────────────────────────────────────────────
function showDoneScreen(output, allResults) {
  const totalFindings = allResults.reduce((sum, r) => sum + r.findings.length, 0);

  // Mostrar coste estimado
  const costText = `$${state.estimatedCostUSD.toFixed(4)}  /  ${state.estimatedCostEUR.toFixed(4)} €`;
  document.getElementById('doneCost').textContent = costText;

  if (output.mode === 'marked') {
    document.getElementById('doneDesc').textContent =
      `Se han aplicado ${totalFindings} marcas al documento con comentarios y resumen al final.`;
    document.getElementById('saveAsInstructions').style.display = 'block';
    document.getElementById('saveAsName').textContent = output.revisionName + '.docx';
  } else {
    document.getElementById('doneDesc').textContent =
      `Se ha añadido el informe de incidencias al final del documento.`;
    document.getElementById('saveAsInstructions').style.display = 'block';
    document.getElementById('saveAsName').textContent = output.statsName + '.docx';
  }

  const statsHTML = allResults
    .filter(r => r.findings.length > 0)
    .map(r => `<div class="done-stat-row">
      <span class="done-stat-label">${r.label}</span>
      <span class="done-stat-value">${r.findings.length}</span>
    </div>`)
    .join('');

  document.getElementById('doneStats').innerHTML = `
    <div class="done-stat-row">
      <span class="done-stat-label"><strong>Total incidencias</strong></span>
      <span class="done-stat-value"><strong>${totalFindings}</strong></span>
    </div>
    ${statsHTML}`;

  showScreen('done');
}

// ── PROGRESO INTERRUMPIDO ─────────────────────────────────────────────────────
function checkSavedProgress() {
  const saved = localStorage.getItem('plumia_analysis_progress');
  if (saved) {
    document.getElementById('resumeBanner').classList.add('visible');
  } else {
    document.getElementById('resumeBanner').classList.remove('visible');
  }
}

function resumeAnalysis() {
  state.isResuming = true;
  document.getElementById('resumeBanner').classList.remove('visible');
  confirmAndAnalyze();
}

function discardAndStart() {
  localStorage.removeItem('plumia_analysis_progress');
  localStorage.removeItem('plumia_analysis_results');
  document.getElementById('resumeBanner').classList.remove('visible');
}

// ── AYUDA ─────────────────────────────────────────────────────────────────────
function openHelp() {
  document.getElementById('helpOverlay').classList.add('visible');
  document.getElementById('helpPanel').classList.add('visible');
}
function closeHelp() {
  document.getElementById('helpOverlay').classList.remove('visible');
  document.getElementById('helpPanel').classList.remove('visible');
}

// ── UTILIDADES ────────────────────────────────────────────────────────────────
async function getDocumentName() {
  return new Promise(resolve => {
    Word.run(async ctx => {
      const props = ctx.document.properties;
      props.load('title');
      await ctx.sync();
      resolve(props.title || 'Documento');
    }).catch(() => resolve('Documento'));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
})();
