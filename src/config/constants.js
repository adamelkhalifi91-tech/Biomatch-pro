export const DEMO_MODE = false;  // production — Supabase writes enabled

export const SUPABASE_URL      = 'https://wszwlssjibkowiluijxs.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzendsc3NqaWJrb3dpbHVpanhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5Mjg1NDQsImV4cCI6MjA5MTUwNDU0NH0.-0icyn61kMtJ1aA7nI6sPkablmFyNJe08o1mO3hC4jE';

export const EMA_ALPHA   = 0.2;    // smoothing factor for EMA
export const RIDGE_LAMBDA = 0.001; // ridge regularization
export const SENS_LAT    = 0.38;   // lateral sensitivity
export const SENS_UP     = 0.45;   // up sensitivity
export const SENS_DOWN   = 0.75;   // down sensitivity
export const DEAD_ZONE   = 0.20;   // dead zone around centre

export const INTEGRITY_CONFIG = {
  thresholds: {
    yaw_primary:    12,
    yaw_secondary:  20,
    pitch_up:       10,
    pitch_down:    -15,
    gaze_lateral:  0.14,
    gaze_vertical: 0.15,
    ear_blink:     0.22,
    no_blink_sec:   30,
    saccade_min_jump:  0.015,
    saccade_same_dir:  2,
    saccade_window_ms: 5000,
  },
  windows: {
    head_turn:      2500,
    gaze_off:       1800,
    sustained_gaze: 5000,
    face_absence:   3000,
    multi_face:     2000,
    iris_check_interval: 500,
  },
  points: {
    SACCADE_HORIZONTAL:      12,
    GAZE_LATERAL_HEAD_RECTA: 15,
    HEAD_GAZE_DISSOCIATION:  18,
    GAZE_VERTICAL_DOWN:      10,
    GAZE_VERTICAL_UP:        10,
    HEAD_TURN_SUSTAINED:      8,
    GAZE_OFF_CAMERA:         10,
    RAPID_GLANCE_PATTERN:     6,
    NO_BLINK_DETECTED:        5,
    FACE_NOT_DETECTED:        3,
    MULTIPLE_FACES:        9999,
    EXTENDED_ABSENCE:      9999,
    HEAD_TURN_RIGHT:          2,
    HEAD_TURN_LEFT:           2,
    HEAD_DEVIATION:           1,
    SUSPECTED_READING:        5,
    SUSPECTED_PHONE:          8,
    GAZE_OFF_SCREEN:          4,
    SUSTAINED_SCREEN_GAZE:   10,
  },
  // Bands calibrated for a 120s session at 4FPS with natural movement noise.
  // clean ≤ 20: no suspicious events (occasional HEAD_DEVIATION is normal)
  // warning ≤ 55: some flags, candidate gets benefit of the doubt
  // review_required > 55: systematic pattern of suspicious behavior
  score_bands: { clean: 20, warning: 55 },

  // Integrity multiplier applied to the final composite score.
  // Makes the biometric audit a load-bearing part of the Scientific Trust Standard.
  integrity_multipliers: { clean: 1.00, warning: 0.92, review_required: 0.68 },
};

export const INTEGRITY_WEIGHTS = INTEGRITY_CONFIG.points;

export const GEMINI_API_KEY = 'AIzaSyBAp6zgRyrzaWPY4xzd38ws5FMVP5CjMVU';

export const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];
export const GEMINI_MODEL = GEMINI_MODELS[0];

export const DEMO_SCORES = {
  technical_score: 82, synthesis_score: 78,
  confidence_score: 85, risk_mgmt_score: 74,
  final_score: 80,
  feedback_summary: 'Demo mode — agrega tu GEMINI_API_KEY para evaluación real con IA.',
  strengths: ['Respuesta estructurada', 'Claridad conceptual'],
  improvements: ['Incluye ejemplos más específicos'],
};

// Phase 1 — 4 extreme corners to measure iris range per person
export const RANGE_POINTS = [
  { x: 5, y: 5 }, { x: 95, y: 5 }, { x: 5, y: 95 }, { x: 95, y: 95 },
];

// Phase 2 — full 9-point calibration
export const CALIB_POINTS = [
  { x:  5, y:  5 }, { x: 50, y:  5 }, { x: 95, y:  5 },
  { x:  5, y: 50 }, { x: 50, y: 50 }, { x: 95, y: 50 },
  { x:  5, y: 95 }, { x: 50, y: 95 }, { x: 95, y: 95 },
];
