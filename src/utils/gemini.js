import { GEMINI_API_KEY, GEMINI_MODELS, DEMO_SCORES } from '../config/constants.js';

const _buildBiometricSection = (log = []) => {
  if (!log || log.length === 0) {
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BIOMETRIC AUDIT (real-time gaze tracking)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STATUS: CLEAN — No behavioral anomalies detected. The candidate maintained consistent eye contact and head position throughout the 120-second recording. This is a positive signal for knowledge internalization.`;
  }

  const critical = log.filter(e => ['MULTIPLE_FACES','EXTENDED_ABSENCE','FACE_NOT_DETECTED'].includes(e.type));
  const reading  = log.filter(e => ['SACCADE_HORIZONTAL','GAZE_VERTICAL_UP','GAZE_LATERAL_HEAD_RECTA','HEAD_GAZE_DISSOCIATION','RAPID_GLANCE_PATTERN'].includes(e.type));
  const head     = log.filter(e => ['HEAD_TURN_SUSTAINED','GAZE_OUT_OF_BOUNDS','GAZE_OFF_SCREEN','SUSTAINED_SCREEN_GAZE'].includes(e.type));

  const lines = log.slice(0, 10).map(e => `  • [${e.timestamp}] ${e.type.replace(/_/g,' ')} — duration: ${e.duration}`).join('\n');
  const overflow = log.length > 10 ? `\n  • ... and ${log.length - 10} additional events` : '';

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BIOMETRIC AUDIT (real-time gaze tracking)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STATUS: ${critical.length > 0 ? 'CRITICAL' : log.length > 3 ? 'FLAGGED' : 'WARNING'} — ${log.length} behavioral event(s) detected:
${lines}${overflow}

INTERPRETATION GUIDE — apply these rules mechanically:
${critical.length > 0 ? '⛔ CRITICAL: MULTIPLE_FACES or EXTENDED_ABSENCE detected. This indicates a third party may have assisted. Set confidence_score = 0 and state this explicitly in feedback_summary.' : ''}
${reading.length >= 2 ? `⚠ SCRIPT READING SIGNALS: ${reading.length} reading-pattern event(s) detected (${reading.map(e=>e.type).join(', ')}). If the delivery in the video is unnaturally fluent or linear at these moments, APPLY the script-reading cap: confidence_score ≤ 10.` : reading.length === 1 ? `⚠ POSSIBLE READING: 1 reading-pattern event detected. Cross-reference with video delivery. If suspicious fluency, reduce confidence_score by 20–30 points.` : ''}
${head.length > 0 ? `⚠ DISTRACTION: ${head.length} head/gaze deviation event(s). Candidate looked away from the camera. If sustained, this suggests external reference material. Reduce confidence_score accordingly.` : ''}
${log.length <= 2 ? 'ℹ LOW EVENT COUNT: 1–2 events is within normal range (natural micro-movements). Do not penalize unless video evidence supports it.' : ''}`;
};

const _buildPrompt = (challenge, integrityLog = []) => `You are a Chief Scientific Officer (CSO) with 20+ years in biotechnology recruitment. You are conducting a high-stakes evaluation of a candidate applying for the role of "${challenge.role}" at ${challenge.company}.

THE CHALLENGE PRESENTED TO THE CANDIDATE WAS:
"${challenge.challengeDesc}"

YOUR MANDATE — READ CAREFULLY:
You are the last line of defense against "paper geniuses": candidates who sound impressive but cannot execute. Your job is NOT to be encouraging. Your job is to be accurate. A score above 70 must be EARNED, not given. The biotechnology field does not tolerate inflated assessments — a wrong hire at this level costs millions and lives.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORING RUBRIC (60/40 SPLIT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[A] TECHNICAL PROFICIENCY — 60% of final score
Evaluate: scientific accuracy, methodological rigor, correct use of terminology, validity of the proposed solution, awareness of real-world constraints (regulatory, safety, scalability).

Score anchors:
  90–100 → Publication-ready thinking. Specific, novel, methodologically sound. Anticipates failure modes.
  75–89  → Strong practitioner. Correct approach, minor gaps. Would perform well in a real lab.
  60–74  → Competent but generic. Uses correct terms but proposes standard solutions without depth.
  40–59  → Surface-level. Knows vocabulary but lacks mechanistic understanding. Would need supervision.
  20–39  → Significant errors. Misapplies concepts or conflates techniques.
  0–19   → Dangerous. Would cause experimental failure or safety incidents.

⚠ HALLUCINATION CAP: If the candidate invents data, fabricates study citations, claims results that don't exist, or uses a technique in a context where it is scientifically invalid — AUTOMATICALLY cap technical_score at 30. Flag this in feedback_summary. This is non-negotiable.

[B] COMMUNICATION VECTORS — 40% of final score (three sub-scores, averaged)

B1. SYNTHESIS (synthesis_score) — Narrative logic and clarity
  Does the candidate structure their answer with a clear beginning (problem framing), middle (proposed solution with rationale), and end (expected outcome or limitation)?
  90–100 → Clear, layered, no filler. Every sentence advances the argument.
  60–89  → Mostly structured, minor digressions.
  30–59  → Disorganized or superficial. Hard to follow the scientific thread.
  0–29   → Stream of consciousness. No discernible structure.

B2. CONFIDENCE (confidence_score) — Vocal security and fluency
  Does the candidate speak with the authority of someone who has done this work?
  Listen for: steady pacing, use of first-person ownership ("I would…", "In my experience…"), absence of excessive hedging.
  90–100 → Commands the room. Speaks as a peer to a scientific board.
  60–89  → Generally confident, occasional hesitation on specifics.
  30–59  → Noticeable uncertainty. Over-qualifies basic claims.
  0–29   → Visibly anxious or disengaged. Undermines scientific credibility.

B3. RISK MANAGEMENT (risk_mgmt_score) — Scientific intellectual honesty
  Does the candidate proactively acknowledge limitations, regulatory hurdles, failure modes, or ethical considerations? This is a POSITIVE signal, not a weakness.
  90–100 → Identifies 2+ specific risks and proposes mitigation. Cites regulatory context (FDA, EMA, GLP) if relevant.
  60–89  → Acknowledges 1 meaningful risk with partial mitigation.
  30–59  → Vague acknowledgment of risk ("there could be issues") without specifics.
  0–29   → Ignores risk entirely or claims the solution is straightforward when it isn't.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTI-FRAUD DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ SCRIPT READING DETECTION: Analyze the cadence and phrasing of the response. If the delivery is unnaturally linear — perfect sentence structure, zero self-corrections, no thinking pauses, no natural discourse markers ("actually", "so", "what I mean is") — this is a strong signal the candidate is reading from a prepared script or AI-generated text.
If scriptReadingDetected: AUTOMATICALLY set confidence_score to a maximum of 10 and note it in feedback_summary. A candidate who cannot speak without a script has not internalized the knowledge.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL SCORE CALCULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

final_score = round( (technical_score × 0.60) + ( (synthesis_score + confidence_score + risk_mgmt_score) / 3 × 0.40 ) )

Do NOT round up out of sympathy. Do NOT inflate scores because the candidate "tried hard". Calculate mechanically and report honestly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FEEDBACK REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

feedback_summary: 2–3 sentences. Be direct and specific. Name the exact scientific gap or communication failure. Do not use generic phrases like "good effort" or "shows potential". If hallucination or script reading was detected, state it explicitly.

strengths: 2 items maximum. Only genuine technical or communication strengths that were demonstrated, not implied.

improvements: 2–3 items. Specific, actionable, scientific. Not "study more" — instead: "Candidate did not address off-target editing risk in non-dividing cells, which is the central challenge of this prompt."

${_buildBiometricSection(integrityLog)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — STRICT JSON ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respond ONLY with this exact JSON structure. No preamble, no explanation, no markdown fences:
{"technical_score":<0-100>,"synthesis_score":<0-100>,"confidence_score":<0-100>,"risk_mgmt_score":<0-100>,"final_score":<0-100>,"scientific_field":"<confirm or correct the scientific field of this challenge — one of: Genómica & Edición Génica, Bioinformática & Genómica Computacional, Biología Molecular & GLP, Terapia Celular & Inmunología, Regulatory Affairs & Calidad, Proteómica & Ingeniería de Proteínas, Microbioma & Biología de Sistemas, Bioestadística & Datos Clínicos, Biología Celular & Células Madre, Biología Sintética & Metabolismo, Química Médica & Descubrimiento de Fármacos, Epidemiología & Salud Pública>","feedback_summary":"<2-3 brutally honest sentences>","strengths":["<specific strength 1>","<specific strength 2>"],"improvements":["<specific gap 1>","<specific gap 2>","<specific gap 3>"]}`;

const _parseGeminiResult = (rawText) => {
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v)) || 0));

  let text = rawText || '';

  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

  const braceStart = text.indexOf('{');
  const braceEnd   = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    text = text.slice(braceStart, braceEnd + 1);
  }

  text = text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');

  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    try {
      const sanitized = text.replace(/[\x00-\x1F\x7F]/g, ' ');
      parsed = JSON.parse(sanitized);
    } catch (e2) {
      const num = (k) => { const m = text.match(new RegExp('"' + k + '"' + '\\s*:\\s*(\\d+)')); return m ? parseInt(m[1]) : 0; };
      const str = (k) => { const m = text.match(new RegExp('"' + k + '"' + '\\s*:\\s*"([^"]*)"')); return m ? m[1] : ''; };
      const arr = (k) => { const m = text.match(new RegExp('"' + k + '"' + '\\s*:\\s*\\[([^\\]]*)\\]')); if (!m) return []; return (m[1].match(/"([^"]*)"/g)||[]).map(s=>s.slice(1,-1)); };
      parsed = {
        technical_score: num('technical_score'), synthesis_score: num('synthesis_score'),
        confidence_score: num('confidence_score'), risk_mgmt_score: num('risk_mgmt_score'),
        final_score: num('final_score'), scientific_field: str('scientific_field'),
        feedback_summary: str('feedback_summary'), strengths: arr('strengths'), improvements: arr('improvements'),
      };
      console.warn('[BioMatch] parser used regex fallback:', e.message);
    }
  }

  return {
    technical_score:  clamp(parsed.technical_score),
    synthesis_score:  clamp(parsed.synthesis_score),
    confidence_score: clamp(parsed.confidence_score),
    risk_mgmt_score:  clamp(parsed.risk_mgmt_score),
    final_score:      clamp(parsed.final_score),
    scientific_field: String(parsed.scientific_field || ''),
    feedback_summary: String(parsed.feedback_summary || ''),
    strengths:        Array.isArray(parsed.strengths)    ? parsed.strengths    : [],
    improvements:     Array.isArray(parsed.improvements) ? parsed.improvements : [],
  };
};

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result.split(',')[1]);
  reader.onerror  = reject;
  reader.readAsDataURL(blob);
});

const waitForFile = async (fileName) => {
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`);
      if (r.status === 429) { await new Promise(res => setTimeout(res, 6000)); continue; }
      const d = await r.json();
      if (d.state === 'ACTIVE') return true;
      if (d.state === 'FAILED') throw new Error('File processing failed');
    } catch(e) { throw e; }
  }
  throw new Error('File processing timeout');
};

let _geminiInFlight = false;
let _geminiLastCallTs = 0;
const GEMINI_MIN_INTERVAL = 4000;

export const resetGeminiMutex = () => { _geminiInFlight = false; };

const fetchWithRetry = async (url, opts, maxRetries = 3) => {
  let delay = 3000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, opts);
    if (res.status === 429 || res.status === 503) {
      if (attempt === maxRetries) return res;
      const retryAfter = parseInt(res.headers.get('Retry-After') || '0', 10);
      const jitter = delay * (0.7 + Math.random() * 0.6);
      const wait  = retryAfter > 0 ? retryAfter * 1000 : jitter;
      console.warn(`[BioMatch] ${res.status} — retrying in ${(wait/1000).toFixed(1)}s (attempt ${attempt+1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, wait));
      delay = Math.min(delay * 2, 16000);
      continue;
    }
    return res;
  }
};

const generateWithFallback = async (bodyObj) => {
  for (let mi = 0; mi < GEMINI_MODELS.length; mi++) {
    const model = GEMINI_MODELS[mi];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    console.info(`[BioMatch] trying model ${model} (${mi+1}/${GEMINI_MODELS.length})`);
    try {
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      }, 2);
      if (res.status === 429) {
        console.warn(`[BioMatch] ${model} quota exhausted — trying next model`);
        continue;
      }
      return res;
    } catch(e) {
      console.warn(`[BioMatch] ${model} fetch error:`, e.message);
      if (mi === GEMINI_MODELS.length - 1) throw e;
    }
  }
  throw new Error('429: Todos los modelos de Gemini están en cuota. Espera 1 minuto e intenta de nuevo.');
};

export const analyzeWithGemini = async (blob, challenge, integrityLog = []) => {
  if (_geminiInFlight) {
    console.warn('[BioMatch] analyzeWithGemini already in flight — ignoring duplicate call');
    await new Promise(r => setTimeout(r, 3000));
    return DEMO_SCORES;
  }
  _geminiInFlight = true;

  const sinceLastCall = Date.now() - _geminiLastCallTs;
  if (sinceLastCall < GEMINI_MIN_INTERVAL) {
    const cooldown = GEMINI_MIN_INTERVAL - sinceLastCall;
    await new Promise(r => setTimeout(r, cooldown));
  }
  _geminiLastCallTs = Date.now();

  if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('YOUR')) {
    await new Promise(r => setTimeout(r, 3000));
    _geminiInFlight = false;
    return DEMO_SCORES;
  }
  const mimeType = blob.type || 'video/webm';
  try {
    const initRes = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
      { method: 'POST', headers: {
          'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(blob.size),
          'X-Goog-Upload-Header-Content-Type': mimeType, 'Content-Type': 'application/json',
        }, body: JSON.stringify({ file: { displayName: 'biomatch_response.webm' } }),
      }
    );
    const uploadUrl = initRes.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) throw new Error('No upload URL returned');

    const uploadRes = await fetchWithRetry(uploadUrl, {
      method: 'POST',
      headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'Content-Type': mimeType },
      body: blob,
    });
    const fileData = await uploadRes.json();
    const fileUri  = fileData.file?.uri;
    const fileName = fileData.file?.name;
    if (!fileUri) throw new Error('File URI missing after upload');

    await waitForFile(fileName);

    const genRes = await generateWithFallback({
      contents: [{ parts: [
        { fileData: { mimeType, fileUri } },
        { text: _buildPrompt(challenge, integrityLog) },
      ]}],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 2048 },
    });

    if (!genRes.ok) {
      const errBody = await genRes.text().catch(() => '');
      throw new Error(`Gemini ${genRes.status}: ${errBody.slice(0, 120)}`);
    }
    const genData = await genRes.json();
    if (genData.error) throw new Error(`Gemini API: ${genData.error.message}`);
    const rawText = genData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const result = _parseGeminiResult(rawText);
    _geminiInFlight = false;
    return result;

  } catch (err) {
    _geminiInFlight = false;
    console.warn('[BioMatch] Gemini error:', err.message);
    return { ...DEMO_SCORES, feedback_summary: 'Evaluation error: ' + err.message };
  }
};
