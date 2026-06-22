import React, { useState, useEffect, useRef } from 'react';
import { INTEGRITY_CONFIG } from '../config/constants.js';
import GazeDot from '../../components/proctoring/GazeDot.tsx';
import QualityBadge from '../../components/proctoring/QualityBadge.tsx';

const ScreenPrep = ({ c, onAbort, onRecordingStart, videoRef, setPoseHandler, addToLog, gazeModel, gazeRuntime }) => {

  const streamRef      = useRef(null);
  const handingOffRef  = useRef(false);
  const timeLeftRef    = useRef(60);
  const awayStartRef   = useRef(null);
  const openEventRef   = useRef(null);
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

  const [timeLeft,      setTimeLeft]      = useState(60);
  const [poseState,     setPoseState]     = useState('ok');
  const [gazeState,     setGazeState]     = useState('center');
  const [signalQuality, setSignalQuality] = useState('good');
  const [faceCountState,setFaceCountState] = useState(1);
  const [integrityLog,  setIntegrityLog]  = useState([]);
  const [recordingMsg, setRecordingMsg] = useState(false);
  const [scanPulse,    setScanPulse]    = useState(false);
  const [cameraState,  setCameraState]  = useState('requesting');
  const [cameraError,  setCameraError]  = useState('');
  const [showErrModal, setShowErrModal] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setScanPulse(p => !p), 1200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } catch (err) {
        if (!mounted) return;
        setCameraState('denied');
        setCameraError('Camera unavailable or permission denied.');
        setShowErrModal(true);
        return;
      }
      if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (e) {}
      }
      setCameraState('active');
    };

    startCamera();

    return () => {
      mounted = false;
      if (!handingOffRef.current) {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (recordingMsg && onRecordingStart) {
      handingOffRef.current = true;
      setTimeout(() => {
        onRecordingStart(streamRef.current, window.biomatchIntegrityLog ?? []);
      }, 700);
    }
  }, [recordingMsg]);

  useEffect(() => {
    if (recordingMsg) return;
    const t = setInterval(() => setTimeLeft(p => {
      if (p <= 1) { clearInterval(t); setRecordingMsg(true); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [recordingMsg]);

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
      const s  = 60 - timeLeftRef.current;
      const ts = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
      const evt = { timestamp: ts, type, duration: '0s', _start: Date.now() };
      addToLog?.(evt);
      setIntegrityLog(prev => [...prev, evt]);
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
          setPoseState('critical');
        }
        if (absent > 10000 && openFaceEvtRef.current && openFaceEvtRef.current.type === 'FACE_NOT_DETECTED') {
          const dur = Math.round((now - openFaceEvtRef.current._start) / 1000);
          openFaceEvtRef.current.duration = dur + 's';
          openFaceEvtRef.current = null;
          openFaceEvtRef.current = fire('EXTENDED_ABSENCE');
          setPoseState('critical');
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
      setFaceCountState(faceCount);
      setSignalQuality(data.signalQuality ?? 'good');

      if (faceCount > 1) {
        if (!multiFaceStartRef.current) multiFaceStartRef.current = now;
        if (now - multiFaceStartRef.current > 2000 && !openMultiRef.current) {
          openMultiRef.current = fire('MULTIPLE_FACES');
          setPoseState('critical');
        }
      } else if (multiFaceStartRef.current) {
        multiFaceStartRef.current = null;
      }

      if (gaze) {
      gazeHistoryRef.current.push({ h: gaze.h, v: gaze.v, t: now });
      if (gazeHistoryRef.current.length > 12) gazeHistoryRef.current.shift();

      // Light extra EMA on the raw features for the threshold logic only. The
      // visible cursor is driven separately by GazeRuntime's One Euro filter +
      // GazeDot's 60 FPS interpolation, so no second dot smoothing is needed.
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
      setGazeState(gazeOff ? 'off' : 'center');

      // Off-screen check uses the smoothed dot target from GazeRuntime (already
      // One Euro filtered), not a per-frame raw prediction — so a single noisy
      // sample can no longer trip GAZE_OUT_OF_BOUNDS.
      const dot = data.dot;
      if (dot) {
        const oob = dot.x < 8 || dot.x > 92 || dot.y < 8 || dot.y > 92;
        if (oob) {
          if (!gazeOffStartRef.current) gazeOffStartRef.current = now;
          if (now - gazeOffStartRef.current > INTEGRITY_CONFIG.windows.gaze_off && !openGazeRef.current) {
            openGazeRef.current = fire('GAZE_OUT_OF_BOUNDS');
            setPoseState('critical');
          }
        } else if (!gazeOff) {
          if (gazeOffStartRef.current && openGazeRef.current) {
            const dur = Math.round((now - openGazeRef.current._start) / 1000);
            openGazeRef.current.duration = dur + 's';
          }
          gazeOffStartRef.current = null; openGazeRef.current = null;
        }
      }

      if (gazeOff) {
        if (!gazeOffStartRef.current) gazeOffStartRef.current = now;
        const gazeDur = now - gazeOffStartRef.current;
        if (gazeDur > INTEGRITY_CONFIG.windows.gaze_off && !openGazeRef.current) {
          openGazeRef.current = fire('GAZE_OFF_SCREEN');
          setPoseState('critical');
        }
        if (gazeDur > 5000 && openGazeRef.current && openGazeRef.current.type === 'GAZE_OFF_SCREEN') {
          const gazeDir = smGaze.h > 0 ? 'right' : 'left';
          const headAgrees = (gazeDir === 'right' && yaw > 15) || (gazeDir === 'left' && yaw < -15);
          if (headAgrees) {
            const dur = Math.round((now - openGazeRef.current._start) / 1000);
            openGazeRef.current.duration = dur + 's';
            openGazeRef.current = null;
            openGazeRef.current = fire('SUSTAINED_SCREEN_GAZE');
            setPoseState('critical');
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
        const saccCount    = detectSaccades(gazeHistoryRef.current);
        const personalT    = gazeModel?.thresholds ?? null;
        const irisHit      = irisClassify(yaw, pitch, smGaze.h, smGaze.v, saccCount, personalT);

        if (irisHit) {
          if (!irisStartRef.current) irisStartRef.current = now;
          const irisDur = now - irisStartRef.current;
          if (irisDur > 800 && !openIrisEvtRef.current) {
            openIrisEvtRef.current = fire(irisHit.type);
            setPoseState('warning');
          }
        } else {
          if (openIrisEvtRef.current) {
            const dur = Math.round((now - openIrisEvtRef.current._start) / 1000);
            openIrisEvtRef.current.duration = dur + 's';
            openIrisEvtRef.current = null;
          }
          irisStartRef.current = null;
          if (poseState === 'warning') setPoseState('ok');
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
        if (now - awayStartRef.current > INTEGRITY_CONFIG.windows.head_turn && !openEventRef.current) {
          const hit  = classifyPose(yaw, pitch);
          const type = hit ? hit.type : 'HEAD_DEVIATION';
          const s  = 60 - timeLeftRef.current;
          const ts = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
          openEventRef.current = { timestamp: ts, type, _start: Date.now() };
          setPoseState('warning');
        }
      }
      if (clear && awayStartRef.current) {
        if (openEventRef.current) {
          const dur = Math.round((now - openEventRef.current._start) / 1000);
          const evt = { timestamp: openEventRef.current.timestamp, type: openEventRef.current.type, duration: dur + 's' };
          addToLog?.(evt);
          setIntegrityLog(prev => [...prev, evt]);
          openEventRef.current = null;
        }
        awayStartRef.current = null;
        if (poseState !== 'critical') setPoseState('ok');
      }
    });

    return () => setPoseHandler?.(null);
  }, [setPoseHandler]);

        const pct  = (timeLeft / 60) * 100;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');

  return (
    <div data-prep-root style={{ position:'relative', width:'100%', height:'100%', background:'#000', overflow:'hidden', fontFamily:"'Inter',sans-serif" }}>

      <video ref={videoRef} autoPlay playsInline muted style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)', filter:'brightness(0.52) contrast(1.1) saturate(0.85)', zIndex:0 }}/>

      <div style={{
        position:'absolute', inset:0, zIndex:5, pointerEvents:'none',
        boxShadow: poseState === 'critical'
          ? 'inset 0 0 0 3px rgba(255,50,50,0.7), inset 0 0 60px rgba(255,40,40,0.15)'
          : poseState === 'warning'
          ? 'inset 0 0 0 2.5px rgba(255,150,0,0.55), inset 0 0 55px rgba(255,130,0,0.12)'
          : 'inset 0 0 0 1.5px rgba(0,113,227,0.18)',
        transition:'box-shadow 0.7s ease',
      }}/>

      <div style={{ position:'absolute', inset:0, zIndex:1, background:'linear-gradient(180deg,rgba(0,8,8,.75) 0%,rgba(0,8,8,.25) 40%,rgba(0,8,8,.25) 62%,rgba(0,8,8,.90) 100%)' }}/>
      <div style={{ position:'absolute', inset:0, zIndex:1, background:'transparent', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', left:0, right:0, height:'2px', background:'linear-gradient(90deg,transparent,rgba(0,113,227,.15),rgba(0,255,255,.95),rgba(0,113,227,.15),transparent)', boxShadow:'none', animation:'scanSweep 2.4s ease-in-out infinite', zIndex:2, pointerEvents:'none' }}/>

      <div style={{ position:'absolute', inset:0, zIndex:2, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
        <div style={{ width:'186px', height:'226px', position:'relative', opacity: scanPulse ? 1 : 0.4, transition:'opacity 0.85s ease' }}>
          {[{top:0,left:0,borderTop:'1.5px solid #0071e3',borderLeft:'1.5px solid #0071e3',borderTopLeftRadius:'8px'},
            {top:0,right:0,borderTop:'1.5px solid #0071e3',borderRight:'1.5px solid #0071e3',borderTopRightRadius:'8px'},
            {bottom:0,left:0,borderBottom:'1.5px solid #0071e3',borderLeft:'1.5px solid #0071e3',borderBottomLeftRadius:'8px'},
            {bottom:0,right:0,borderBottom:'1.5px solid #0071e3',borderRight:'1.5px solid #0071e3',borderBottomRightRadius:'8px'}
          ].map((s,i) => <div key={i} style={{ position:'absolute', width:'22px', height:'22px', ...s }}/>)}
        </div>
      </div>

      {gazeModel && gazeRuntime && (
        <GazeDot getTarget={() => gazeRuntime.getDotTarget()} offScreenMarginPct={8} zIndex={9} />
      )}

      <QualityBadge quality={signalQuality} zIndex={20} />

      <div style={{ position:'absolute', inset:0, zIndex:3, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>

        <div style={{ padding:'48px 18px 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', marginBottom:'12px' }}>
            <button onClick={onAbort} style={{ background:'rgba(180,40,20,.18)', border:'0.5px solid rgba(220,80,60,.45)', borderRadius:'8px', padding:'6px 11px', color:'rgba(255,140,120,.9)', fontSize:'10px', fontWeight:700, letterSpacing:'.2px', cursor:'pointer', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', fontFamily:"'Inter',sans-serif" }}>ABORT</button>
          </div>

          <div style={{ background:'rgba(0,0,0,0.58)', border:'0.5px solid rgba(0,113,227,0.2)', borderRadius:'20px', padding:'15px 17px', backdropFilter:'blur(22px)', WebkitBackdropFilter:'blur(22px)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
              <div style={{ width:30, height:30, borderRadius:'8px', background:c.logoColor+'33', border:`0.5px solid ${c.accentColor}55`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'10px', fontWeight:800, color:c.accentColor }}>{c.logo}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:'10px', color:'rgba(255,255,255,.55)', fontWeight:600, letterSpacing:'.5px', textTransform:'uppercase', fontFamily:"'Inter',sans-serif" }}>{c.company}</p>
                <p style={{ fontSize:'11px', color:'rgba(200,240,240,.6)', marginTop:'1px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.challengeTitle}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(0,113,227,0.12)', border:'0.5px solid rgba(0,113,227,.35)', borderRadius:'6px', padding:'3px 7px' }}>
                <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#00ffaa', animation:'statusBlink 1.4s ease-in-out infinite' }}/>
                <span style={{ fontSize:'9px', fontWeight:700, color:'#00ffaa', letterSpacing:'.8px', fontFamily:"'Inter',sans-serif" }}>LIVE</span>
              </div>
            </div>
            <p style={{ fontSize:'13px', color:'rgba(230,250,250,.92)', lineHeight:1.7 }}>{c.challengeDesc}</p>
          </div>
        </div>

        <div style={{ padding:'0 18px 36px' }}>
          {!recordingMsg ? (
            <div style={{ textAlign:'center', marginBottom:'14px' }}>
              <p style={{ fontSize:'10px', color:'rgba(255,255,255,.45)', letterSpacing:'.2px', textTransform:'uppercase', fontFamily:"'Inter',sans-serif", marginBottom:'4px' }}>PREPARATION WINDOW</p>
              <span style={{ fontSize:'72px', lineHeight:1, fontWeight:700, letterSpacing:'-3px', color: timeLeft<=10?'#ff6060':timeLeft<=20?'#ffaa40':'#f0f0f0', fontFamily:"'Inter',sans-serif", textShadow: timeLeft<=10?'0 0 18px rgba(255,80,80,.3)':'none', transition:'color .5s', display:'block' }}>{mins}:{secs}</span>
            </div>
          ) : (
            <div style={{ textAlign:'center', background:'rgba(0,0,0,0.68)', border:'0.5px solid rgba(0,100,200,0.28)', borderRadius:'22px', padding:'26px 20px', backdropFilter:'blur(22px)', WebkitBackdropFilter:'blur(22px)' }}>
              <p style={{ fontSize:'10px', color:'rgba(255,255,255,.5)', letterSpacing:'.2px', textTransform:'uppercase', fontFamily:"'Inter',sans-serif", marginBottom:'8px' }}>PREPARATION COMPLETE</p>
              <p style={{ fontSize:'24px', fontWeight:700, color:'#f0f0f0', fontFamily:"'Inter',sans-serif" }}>REC STARTING...</p>
            </div>
          )}

          <div style={{ background:'rgba(0,0,0,0.55)', border:'0.5px solid rgba(0,100,200,0.18)', borderRadius:'18px', padding:'13px 16px', backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)' }}>
            <div style={{ height:'2px', background:'rgba(255,255,255,.06)', borderRadius:'999px', overflow:'hidden', marginBottom:'10px' }}>
              <div style={{ height:'100%', borderRadius:'999px', width:`${pct}%`, background:"linear-gradient(90deg,#0050a0,#0071e3)", transition:'width 1s linear' }}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background: cameraState==='active'?'#00ffaa':'#ffaa40' }}/>
                <span style={{ fontSize:'10px', color:'rgba(160,200,200,.8)', fontWeight:600, fontFamily:"'Inter',sans-serif", letterSpacing:'.5px' }}>{cameraState==='active'?'CAM LIVE':'CAM OFF'}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                {integrityLog.length > 0 && (
                  <span style={{
                    fontSize:'9px', fontWeight:700, color:'rgba(200,220,255,0.85)',
                    fontFamily:"'Inter',sans-serif", letterSpacing:'.5px',
                    background:'rgba(255,130,0,.1)', border:'0.5px solid rgba(255,130,0,.35)',
                    borderRadius:'5px', padding:'2px 6px',
                  }}>
                    ⚑ {integrityLog.length} EVENT{integrityLog.length > 1 ? 'S' : ''}
                  </span>
                )}
                {faceCountState > 1 && (
                  <span style={{ fontSize:'9px', fontWeight:700, color:'rgba(255,60,60,.9)',
                    background:'rgba(255,40,40,.15)', border:'0.5px solid rgba(255,40,40,.4)',
                    borderRadius:'5px', padding:'2px 6px' }}>
                    ⚠ {faceCountState} FACES
                  </span>
                )}
                <span style={{
                  fontSize:'9px', fontWeight:700, letterSpacing:'.5px',
                  color: gazeState === 'center' ? 'rgba(0,220,130,.7)' : 'rgba(255,100,100,.85)',
                }}>
                  {gazeState === 'center' ? '● GAZE OK' : '● GAZE OFF'}
                </span>
                <span style={{
                  fontSize:'10px', fontFamily:"'Inter',sans-serif",
                  color: poseState === 'critical' ? 'rgba(255,80,80,.9)' : poseState === 'warning' ? 'rgba(255,160,60,.85)' : 'rgba(0,220,130,.7)',
                  transition:'color .5s',
                }}>
                  {poseState === 'critical' ? '⛔ ALERT' : poseState === 'warning' ? '⚠ FOCUS' : `${c.match}% MATCH`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showErrModal && (
        <div style={{ position:'absolute', inset:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.62)', backdropFilter:'blur(6px)', padding:'32px' }}>
          <div style={{ width:'100%', maxWidth:'320px', background:'rgba(5,5,5,0.97)', border:'1px solid rgba(0,100,200,0.22)', borderRadius:'24px', padding:'24px' }}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,.8)', letterSpacing:'.2px', textTransform:'uppercase', fontFamily:"'Inter',sans-serif", marginBottom:'10px' }}>BIOMETRIC FEED OFFLINE</p>
            <p style={{ fontSize:'13px', color:'rgba(200,230,230,.8)', lineHeight:1.7, marginBottom:'16px' }}>{cameraError}</p>
            <button onClick={() => setShowErrModal(false)} style={{ width:'100%', padding:'10px', borderRadius:'9px', background:'rgba(0,113,227,0.12)', border:'0.5px solid rgba(0,113,227,.35)', color:'#e8e8e8', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>UNDERSTOOD — CONTINUE</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScreenPrep;
