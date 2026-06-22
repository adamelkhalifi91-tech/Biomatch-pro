import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_MODE, INTEGRITY_CONFIG } from '../config/constants.js';

export const getSupabase = (() => {
  let _db = null;
  return () => {
    if (_db) return _db;
    if (SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_ANON_KEY.startsWith('YOUR_')) {
      console.warn('[BioMatch] Supabase keys not set — running DEMO_MODE only');
      return null;
    }
    try { _db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
    catch(e) { console.warn('[BioMatch] Supabase init:', e.message); }
    return _db;
  };
})();

export const computeIntegrity = (log = []) => {
  const pts = INTEGRITY_CONFIG.points;

  // Duration-weighted scoring: sustained violations score proportionally more.
  // A HEAD_TURN_SUSTAINED of 8s scores 8× the base penalty (capped at 4×).
  const score = log.reduce((acc, ev) => {
    const base = pts[ev.type] ?? 2;
    const durSec = ev.duration ? parseFloat(ev.duration) : 0;
    const durationMultiplier = durSec > 1 ? Math.min(4, durSec) : 1;
    return acc + base * durationMultiplier;
  }, 0);

  const { clean, warning } = INTEGRITY_CONFIG.score_bands;
  const status = score <= clean ? 'clean' : score <= warning ? 'warning' : 'review_required';

  const mult = INTEGRITY_CONFIG.integrity_multipliers[status];
  return { score: Math.round(score), status, multiplier: mult };
};

export const saveCandidateResult = async ({ captureData, challenge, scores }) => {
  if (DEMO_MODE) {
    console.info('[BioMatch] DEMO_MODE: saveCandidateResult simulado (sin llamada real)');
    return { ok: true, demo: true };
  }
  const db = getSupabase();
  if (!db) return { ok: false, error: 'Supabase not configured' };

  const log    = captureData?.log || [];
  const blobKb = captureData?.blob ? +(captureData.blob.size / 1024).toFixed(1) : null;
  const { score: integrityScore, status: integrityStatus } = computeIntegrity(log);
  const sessionId = scores._sessionId || crypto.randomUUID();

  try {
    const { error } = await db.from('candidates').insert({
      session_id:       sessionId,
      challenge_title:  challenge?.title  || 'Unknown',
      final_score:      scores.final,
      technical_score:  scores.tech,
      comm_avg:         scores.commAvg,
      comm_synthesis:   scores.synthesis,
      comm_confidence:  scores.confidence,
      comm_risk_mgmt:   scores.riskMgmt,
      integrity_status: integrityStatus,
      integrity_events: log,
      integrity_count:  log.length,
      integrity_score:  integrityScore,
      blob_size_kb:     blobKb,
      ai_feedback:      scores.ai_feedback      || null,
      ai_strengths:     scores.ai_strengths     || null,
      ai_improvements:  scores.ai_improvements  || null,
      scientific_field: scores.scientific_field || challenge?.scientificField || null,
    });
    if (error) throw error;
    return { ok: true, sessionId };
  } catch(err) {
    console.warn('[BioMatch] saveCandidateResult:', err.message);
    return { ok: false, error: err.message };
  }
};
