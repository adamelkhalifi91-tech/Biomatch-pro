import React, { useState, useEffect, useRef } from 'react';
import { INTEGRITY_CONFIG } from '../config/constants.js';
import GazeDot from '../../components/proctoring/GazeDot.tsx';
import QualityBadge from '../../components/proctoring/QualityBadge.tsx';

const getRecordingMime = () => {
  const candidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  try {
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
  } catch (_) { return ''; }
};

const ScreenRecording = ({ c, stream, initialLog, onComplete, videoRef, setPoseHandler, addToLog, gazeModel, gazeRuntime }) => {
  const recorderRef  = useRef(null);
  const chunksRef    = useRef([]);
  const logRef       = useRef([...(initialLog || [])]);
  const timeLeftRef  = useRef(120);
  const awayStartRef = useRef(null);
  const openEvtRef   = useRef(null);
  const faceAbsStartRef   = useRef(null);
  const openFaceEvtRef    = useRef(null);
  const multiFaceStartRef = useRef(null);
  const openMultiRef      = useRef(null);
  const gazeOffStartRef   = useRef(null);
  const openGazeRef       = useRef(null);
  const blinkBufRef       = useRef([]);
  const lastBlinkTimeRef  = useRef(Date.now());
  const noBlinkStartRef   = useRef(null);
  const gazeHistoryRef    = useRef([]);
  const gazeEmaRef        = useRef(null);
  const glanceReturnRef   = useRef([]);
  const graceEndRef       = useRef(Date.now() + 5000);
  const irisStartRef      = useRef(null);
  const openIrisEvtRef    = useRef(null);
  const lastIrisCheckRef  = useRef(0);

  const [timeLeft, setTimeLeft] = useState(120);
  const [recDone,  setRecDone]  = useState(false);
  const [signalQuality, setSignalQuality] = useState('good');
  const [debugData, setDebugData] = useState({ absX: 0, absY: 0, deltaX: 0, deltaY: 0, saccades: 0 });
  const lastDebugUpdateRef = useRef(0);
  const lastConsoleLogRef  = useRef(0);

  useEffect(() => {
    if (videoRef?.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    if (!stream) return;
    const mime = getRecordingMime();
    const rec = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = rec;
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      onComplete(blob);
    };
    rec.onerror = (e) => {
      console.warn('[BioMatch] MediaRecorder error:', e.error?.name);
      try { if (rec.state === 'recording') rec.stop(); } catch(_) {}
    };

    try {
      rec.start(1000);
    } catch (startErr) {
      console.warn('[BioMatch] rec.start(1000) failed, retrying without timeslice:', startErr);
      try { rec.start(); } catch (fatalErr) {
        console.warn('[BioMatch] MediaRecorder could not start (fatal):', fatalErr);
      }
    }
    return () => { try { if (rec.state !== 'inactive') rec.stop(); } catch (_) {} };
  }, [stream]);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(p => {
      const next = p - 1;
      timeLeftRef.current = next;
      if (next <= 0) {
        clearInterval(t);
        setRecDone(true);
        try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); } catch (_) {}
        return 0;
      }
      return next;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const detectSaccades = (history) => {
      const now = Date.now();
      const SC = INTEGRITY_CONFIG.thresholds;
      const recent = history.filter(g => now - g.t < SC.saccade_window_ms);
      if (recent.length < 5) return 0;

      let saccadeSeqs = 0;
      let consecutiveSameDir = 0;
      let lastDir = 0;

      for (let i = 1; i < recent.length; i++) {
        const delta = recent[i].h - recent[i-1].h;
        if (Math.abs(delta) < SC.saccade_min_jump) continue;
        const dir = delta > 0 ? 1 : -1;
        if (dir === lastDir) {
          consecutiveSameDir++;
          if (consecutiveSameDir >= SC.saccade_same_dir) {
            saccadeSeqs++;
            consecutiveSameDir = 0;
          }
        } else {
          consecutiveSameDir = 1;
          lastDir = dir;
        }
      }
      return saccadeSeqs;
    };

    const irisClassify = (yaw, pitch, gazeH, gazeV, saccadeCount, personalT) => {
      const T = INTEGRITY_CONFIG.thresholds;
      const tLateral = personalT ? personalT.gaze_lateral : T.gaze_lateral;
      const tDown    = personalT ? personalT.gaze_down    : T.gaze_vertical;
      const tUp      = personalT ? personalT.gaze_up      : T.gaze_vertical;
      const normH    = personalT ? gazeH - personalT.center_h : gazeH;
      const normV    = personalT ? gazeV - personalT.center_v : gazeV;

      const gazeLateral = Math.abs(normH) > tLateral;
      const gazeDown    = normV >  tDown;
      const gazeUp      = normV < -tUp;
      const gazeVertical= gazeDown || gazeUp;
      const headRecta   = Math.abs(yaw) < T.yaw_primary;

      if (normV < -(tUp * 0.4) && saccadeCount >= 1 && headRecta)
        return { type: 'GAZE_VERTICAL_UP', pts: 15 };

      if (headRecta && gazeLateral && !gazeVertical)
        return { type: 'GAZE_LATERAL_HEAD_RECTA', pts: 15 };
      if (!headRecta && gazeLateral && (Math.sign(normH) !== Math.sign(yaw)))
        return { type: 'HEAD_GAZE_DISSOCIATION', pts: 18 };
      if (gazeDown && !gazeLateral && headRecta)
        return { type: 'GAZE_VERTICAL_DOWN', pts: 10 };
      if (gazeUp && !gazeLateral && headRecta)
        return { type: 'GAZE_VERTICAL_UP', pts: 10 };
      if (saccadeCount >= 2)
        return { type: 'SACCADE_HORIZONTAL', pts: 12 };
      return null;
    };

    const classifyPose = (yaw, pitch) => {
      const T = INTEGRITY_CONFIG.thresholds;
      if (Math.abs(yaw) > T.yaw_secondary)
        return { type: 'HEAD_TURN_SUSTAINED', pts: 8 };
      if (pitch < T.pitch_down)
        return { type: 'HEAD_TURN_SUSTAINED', pts: 4 };
      return { type: 'HEAD_DEVIATION', pts: 1 };
    };

    const fire = (type) => {
      const s  = 120 - timeLeftRef.current;
      const ts = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
      const evt = { timestamp: ts, type, duration: '0s', _start: Date.now() };
      logRef.current = [...logRef.current, evt];
      addToLog?.(evt);
      return evt;
    };

    setPoseHandler?.((data) => {
      const now = Date.now();
      if (now < graceEndRef.current) return;

      if (!data.hasFace) {
        if (!faceAbsStartRef.current) faceAbsStartRef.current = now;
        const absent = now - faceAbsStartRef.current;
        if (absent > 3000 && !openFaceEvtRef.current) {
          openFaceEvtRef.current = fire('FACE_NOT_DETECTED');
        }
        if (absent > 10000 && openFaceEvtRef.current && openFaceEvtRef.current.type === 'FACE_NOT_DETECTED') {
          const dur = Math.round((now - openFaceEvtRef.current._start) / 1000);
          openFaceEvtRef.current.duration = dur + 's';
          openFaceEvtRef.current = null;
          openFaceEvtRef.current = fire('EXTENDED_ABSENCE');
        }
        return;
      }
      if (faceAbsStartRef.current && openFaceEvtRef.current) {
        const dur = Math.round((now - openFaceEvtRef.current._start) / 1000);
        openFaceEvtRef.current.duration = dur + 's';
        faceAbsStartRef.current = null;
        openFaceEvtRef.current = null;
      } else {
        faceAbsStartRef.current = null;
      }

      const { yaw, pitch, gaze, ear, faceCount } = data;
      setSignalQuality(data.signalQuality ?? 'good');

      if (faceCount > 1) {
        if (!multiFaceStartRef.current) multiFaceStartRef.current = now;
        if (now - multiFaceStartRef.current > 2000 && !openMultiRef.current) {
          openMultiRef.current = fire('MULTIPLE_FACES');
        }
      } else if (multiFaceStartRef.current) {
        multiFaceStartRef.current = null;
      }

      if (gaze) {
      gazeHistoryRef.current.push({ h: gaze.h, v: gaze.v, t: now });
      if (gazeHistoryRef.current.length > 12) gazeHistoryRef.current.shift();

      // Light EMA on raw features for threshold logic only; the visible cursor
      // is driven by GazeRuntime's One Euro filter + GazeDot interpolation.
      const EMA_DET = 0.18;
      const prev = gazeEmaRef.current ?? { h: gaze.h, v: gaze.v };
      const smGaze = {
        h: EMA_DET * gaze.h + (1 - EMA_DET) * prev.h,
        v: EMA_DET * gaze.v + (1 - EMA_DET) * prev.v,
      };
      gazeEmaRef.current = smGaze;

      const _pT    = gazeModel?.thresholds ?? null;
      const _normH = _pT ? smGaze.h - _pT.center_h : smGaze.h;
      const _normV = _pT ? smGaze.v - _pT.center_v : smGaze.v;
      const _tLat  = _pT ? _pT.gaze_lateral : INTEGRITY_CONFIG.thresholds.gaze_lateral;
      const _tUp   = _pT ? _pT.gaze_up      : INTEGRITY_CONFIG.thresholds.gaze_vertical;
      const _tDown = _pT ? _pT.gaze_down     : INTEGRITY_CONFIG.thresholds.gaze_vertical;
      const gazeOff = Math.abs(_normH) > _tLat
                   || _normV < -_tUp
                   || _normV >  _tDown;

      const saccCount = detectSaccades(gazeHistoryRef.current);
      if (now - lastDebugUpdateRef.current > 100) {
        setDebugData({
          absX: _normH,
          absY: _normV,
          deltaX: smGaze.h - prev.h,
          deltaY: smGaze.v - prev.v,
          saccades: saccCount
        });
        lastDebugUpdateRef.current = now;
      }

      if (now - lastConsoleLogRef.current > 2500) {
        console.log(`[BioMatch Debug] Abs X: ${_normH.toFixed(4)}, Abs Y: ${_normV.toFixed(4)}, ΔX: ${(smGaze.h - prev.h).toFixed(4)}, Saccades: ${saccCount}`);
        lastConsoleLogRef.current = now;
      }

      // The visual cursor (data.dot) is produced by GazeRuntime and rendered by
      // GazeDot at 60 FPS — no per-frame predict call here. Integrity checks
      // below use the centred raw features (gazeOff), independent of the dot.

      if (gazeOff) {
        if (!gazeOffStartRef.current) gazeOffStartRef.current = now;
        const gazeDur = now - gazeOffStartRef.current;
        if (gazeDur > INTEGRITY_CONFIG.windows.gaze_off && !openGazeRef.current) {
          openGazeRef.current = fire('GAZE_OFF_SCREEN');
        }
        if (gazeDur > 5000 && openGazeRef.current && openGazeRef.current.type === 'GAZE_OFF_SCREEN') {
          const gazeDir = smGaze.h > 0 ? 'right' : 'left';
          const headAgrees = (gazeDir === 'right' && yaw > 15) || (gazeDir === 'left' && yaw < -15);
          if (headAgrees) {
            const dur = Math.round((now - openGazeRef.current._start) / 1000);
            openGazeRef.current.duration = dur + 's';
            openGazeRef.current = null;
            openGazeRef.current = fire('SUSTAINED_SCREEN_GAZE');
          }
        }
      } else {
        if (gazeOffStartRef.current && (now - gazeOffStartRef.current) > 1000 && (now - gazeOffStartRef.current) < 5000) {
          glanceReturnRef.current.push(now);
          if (glanceReturnRef.current.length > 10) glanceReturnRef.current.shift();
          const recent = glanceReturnRef.current.filter(t => now - t < 30000);
          if (recent.length >= 3) {
            let rapidCount = 0;
            for (let i = 1; i < recent.length; i++) {
              if (recent[i] - recent[i-1] < 1500) rapidCount++;
            }
            if (rapidCount >= 2) fire('RAPID_GLANCE_PATTERN');
          }
        }
        if (gazeOffStartRef.current && openGazeRef.current) {
          const dur = Math.round((now - openGazeRef.current._start) / 1000);
          openGazeRef.current.duration = dur + 's';
        }
        gazeOffStartRef.current = null;
        openGazeRef.current = null;
      }

      if (now - lastIrisCheckRef.current > INTEGRITY_CONFIG.windows.iris_check_interval) {
        lastIrisCheckRef.current = now;
        const personalT    = gazeModel?.thresholds ?? null;
        const irisHit      = irisClassify(yaw, pitch, smGaze.h, smGaze.v, saccCount, personalT);

        if (irisHit) {
          if (!irisStartRef.current) irisStartRef.current = now;
          const irisDur = now - irisStartRef.current;
          if (irisDur > 800 && !openIrisEvtRef.current) {
            openIrisEvtRef.current = fire(irisHit.type);
          }
        } else {
          if (openIrisEvtRef.current) {
            const dur = Math.round((now - openIrisEvtRef.current._start) / 1000);
            openIrisEvtRef.current.duration = dur + 's';
            openIrisEvtRef.current = null;
          }
          irisStartRef.current = null;
        }
      }
      } // end if (gaze) — blink and head-pose run regardless

      blinkBufRef.current.push(ear);
      if (blinkBufRef.current.length > 6) blinkBufRef.current.shift();
      const smoothEar = blinkBufRef.current.reduce((s,e) => s+e, 0) / blinkBufRef.current.length;
      if (smoothEar < 0.22) {
        lastBlinkTimeRef.current = now;
        noBlinkStartRef.current = null;
      } else if (!noBlinkStartRef.current) {
        noBlinkStartRef.current = now;
      }
      if (noBlinkStartRef.current && now - noBlinkStartRef.current > 35000) {
        if (now - lastBlinkTimeRef.current > 35000) {
          fire('NO_BLINK_DETECTED');
          lastBlinkTimeRef.current = now;
          noBlinkStartRef.current = now;
        }
      }

      const suspicious = Math.abs(yaw) > INTEGRITY_CONFIG.thresholds.yaw_primary || pitch > INTEGRITY_CONFIG.thresholds.pitch_up || pitch < INTEGRITY_CONFIG.thresholds.pitch_down;
      const clear      = Math.abs(yaw) < (INTEGRITY_CONFIG.thresholds.yaw_primary - 2) && pitch < (INTEGRITY_CONFIG.thresholds.pitch_up - 2) && pitch > (INTEGRITY_CONFIG.thresholds.pitch_down + 5);

      if (suspicious) {
        if (!awayStartRef.current) awayStartRef.current = now;
        if (now - awayStartRef.current > INTEGRITY_CONFIG.windows.head_turn && !openEvtRef.current) {
          const hit  = classifyPose(yaw, pitch);
          const type = hit ? hit.type : 'HEAD_DEVIATION';
          const s  = 120 - timeLeftRef.current;
          const ts = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
          openEvtRef.current = { timestamp: ts, type, _start: Date.now() };
        }
      }
      if (clear && awayStartRef.current) {
        if (openEvtRef.current) {
          const dur = Math.round((now - openEvtRef.current._start) / 1000);
          const evt = { timestamp: openEvtRef.current.timestamp, type: openEvtRef.current.type, duration: dur + 's' };
          logRef.current = [...logRef.current, evt];
          addToLog?.(evt);
          openEvtRef.current = null;
        }
        awayStartRef.current = null;
      }
    });

    return () => setPoseHandler?.(null);
  }, [setPoseHandler]);

        const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');

  return (
    <div style={{ position:'relative', width:'100%', height:'100%', background:'#000', overflow:'hidden', fontFamily:"'Inter',sans-serif" }}>

      <video ref={videoRef} autoPlay playsInline muted
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)', filter:'brightness(0.50) contrast(1.1) saturate(0.85)', zIndex:0 }}/>

      <div style={{ position:'absolute', inset:0, zIndex:5, pointerEvents:'none',
        boxShadow:'inset 0 0 0 2px rgba(220,40,40,0.35), inset 0 0 60px rgba(200,20,20,0.08)' }}/>

      {gazeModel && gazeRuntime && (
        <GazeDot getTarget={() => gazeRuntime.getDotTarget()} offScreenMarginPct={8} zIndex={9} />
      )}
      <QualityBadge quality={signalQuality} zIndex={20} />

      <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(180deg,rgba(0,8,8,.75) 0%,rgba(0,8,8,.15) 45%,rgba(0,8,8,.15) 60%,rgba(0,8,8,.90) 100%)' }}/>

      <div style={{
        position: 'absolute', bottom: 16, right: 16, zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(0, 255, 170, 0.5)',
        borderRadius: '8px', padding: '10px', color: '#00ffaa',
        fontFamily: 'monospace', fontSize: '11px',
        backdropFilter: 'blur(4px)', pointerEvents: 'none'
      }}>
        <div style={{ fontWeight: 800, marginBottom: 6, color: '#fff', borderBottom: '1px solid rgba(0, 255, 170, 0.5)', paddingBottom: 4 }}>
          ⚙️ DEBUG VISUAL
        </div>
        <div style={{ marginBottom: 3 }}>Abs X: {debugData.absX.toFixed(4)}</div>
        <div style={{ marginBottom: 3 }}>Abs Y: {debugData.absY.toFixed(4)}</div>
        <div style={{ marginBottom: 3 }}>ΔX: {debugData.deltaX.toFixed(4)}</div>
        <div style={{ marginBottom: 3 }}>ΔY: {debugData.deltaY.toFixed(4)}</div>
        <div>Saccades: {debugData.saccades}</div>
      </div>

      <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'0' }}>

        <div style={{ padding:'48px 18px 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'7px', background:'rgba(30,0,0,.65)', border:'0.5px solid rgba(220,50,50,.45)', borderRadius:'8px', padding:'6px 12px', backdropFilter:'blur(12px)' }}>
              <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#ff3030', boxShadow:'0 0 10px rgba(255,50,50,.9)', animation:'statusBlink 0.9s ease-in-out infinite' }}/>
              <span style={{ fontSize:'10px', fontWeight:700, letterSpacing:'.2px', color:'#ff6060', fontFamily:"'Inter',sans-serif" }}>LIVE · REC</span>
            </div>
            <span style={{ fontSize:'42px', fontWeight:700, letterSpacing:'-2px', color: timeLeft<=15?'#ff5050':timeLeft<=30?'#ffaa40':'#f0f0f0', fontFamily:"'Inter',sans-serif", textShadow: timeLeft<=15?'0 0 16px rgba(255,60,60,.3)':'none', transition:'color .5s' }}>
              {mins}:{secs}
            </span>
          </div>

          <div style={{ background:'rgba(0,0,0,0.58)', border:'0.5px solid rgba(0,100,200,0.18)', borderRadius:'18px', padding:'13px 16px', backdropFilter:'blur(20px)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
              <div style={{ width:22, height:22, borderRadius:'6px', background:c.logoColor+'33', border:`0.5px solid ${c.accentColor}55`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:'8px', fontWeight:800, color:c.accentColor }}>{c.logo}</span>
              </div>
              <span style={{ fontSize:'9px', color:'rgba(255,255,255,.5)', fontWeight:600, letterSpacing:'.8px', textTransform:'uppercase', fontFamily:"'Inter',sans-serif" }}>{c.company}</span>
            </div>
            <p style={{ fontSize:'13px', color:'rgba(225,248,248,.9)', lineHeight:1.65 }}>{c.challengeDesc}</p>
          </div>
        </div>

        <div style={{ padding:'0 18px 36px' }}>
          {!recDone && (
            <button onClick={() => {
                try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); } catch(_){}
                setRecDone(true);
              }}
              style={{ display:'block', width:'100%', marginBottom:12, padding:'11px', borderRadius:10, background:'rgba(160,25,10,.16)', border:'0.5px solid rgba(220,60,40,.4)', color:'rgba(255,130,110,.9)', fontSize:'11px', fontWeight:700, letterSpacing:'.2px', cursor:'pointer', fontFamily:"'Inter',sans-serif", backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)' }}>
              FINISH EARLY
            </button>
          )}
          {recDone && (
            <div style={{ textAlign:'center', marginBottom:'14px' }}>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,.6)', letterSpacing:'.2px', textTransform:'uppercase', fontFamily:"'Inter',sans-serif" }}>FINALIZING RECORDING…</p>
            </div>
          )}
          <div style={{ background:'rgba(0,0,0,0.55)', border:'0.5px solid rgba(200,50,50,0.2)', borderRadius:'18px', padding:'12px 16px', backdropFilter:'blur(18px)' }}>
            <div style={{ height:'2px', background:'rgba(255,255,255,.06)', borderRadius:'999px', overflow:'hidden', marginBottom:'10px' }}>
              <div style={{ height:'100%', borderRadius:'999px', width:`${((120-timeLeft)/120)*100}%`, background:'linear-gradient(90deg,#cc2020,#ff4040)', transition:'width 1s linear' }}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'10px', color:'rgba(255,120,120,.7)', fontWeight:600, fontFamily:"'Inter',sans-serif", letterSpacing:'.5px' }}>● RECORDING</span>
              <span style={{ fontSize:'10px', color:'rgba(140,180,180,.6)', fontFamily:"'Inter',sans-serif" }}>{c.match}% MATCH</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenRecording;
