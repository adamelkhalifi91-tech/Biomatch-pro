/* global FaceMesh */
import React, { useState, useEffect, useRef } from 'react';
import { DEMO_SCORES } from './config/constants.js';
import { resetGeminiMutex } from './utils/gemini.js';
import { GazeRuntime, DETECTOR_INTERVAL_MS } from '../lib/gaze/gazeRuntime.ts';

import ScreenLanding      from './components/ScreenLanding.jsx';
import ScreenList         from './components/ScreenList.jsx';
import ScreenGateway      from './components/ScreenGateway.jsx';
import ScreenBriefing     from './components/ScreenBriefing.jsx';
import ScreenCalibration  from './components/ScreenCalibration.jsx';
import ScreenPrep         from './components/ScreenPrep.jsx';
import ScreenRecording    from './components/ScreenRecording.jsx';
import ScreenUpload       from './components/ScreenUpload.jsx';
import ScreenResults      from './components/ScreenResults.jsx';
import ScreenPassport     from './components/ScreenPassport.jsx';
import ScreenCEODashboard from './components/ScreenCEODashboard.jsx';

const App = () => {
  const _urlPassport = new URLSearchParams(window.location.search).get('passport');
  const [view,              setView]             = useState(_urlPassport ? 'passport' : 'landing');
  const [passportRouteId]                        = useState(_urlPassport);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [activeTab,         setActiveTab]        = useState('home');
  const [animClass,         setAnimClass]        = useState('active');
  const [captureData,       setCaptureData]      = useState({ blob: null, log: [] });
  const [gazeModel,         setGazeModel]        = useState(null);
  const [aiScores,          setAiScores]         = useState(null);

  const navRafRef       = useRef(null);
  const timeoutRef      = useRef(null);
  const sharedStreamRef = useRef(null);
  const sharedLogRef    = useRef([]);

  const sharedVideoRef = useRef(null);
  const fmEngineRef    = useRef(null);
  const fmRafRef       = useRef(null);
  const analyzingRef   = useRef(false);
  const lastSendRef    = useRef(0);
  const poseHandlerRef = useRef(null);
  // Single shared gaze pipeline (quality gate → blink → features → polynomial →
  // One Euro). Owns the smoothed dot target the 60 FPS GazeDot reads.
  const gazeRuntimeRef = useRef(new GazeRuntime());

  useEffect(() => {
    let alive = true;

    const initEngine = async () => {
      await new Promise(res => {
        const poll = () => typeof FaceMesh !== 'undefined' ? res() : setTimeout(poll, 200);
        poll();
      });
      if (!alive) return;

      const fm = new FaceMesh({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
      });
      fm.setOptions({
        maxNumFaces:            4,
        refineLandmarks:        true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence:  0.5,
      });

      fm.onResults(results => {
        analyzingRef.current = false;
        const now   = Date.now();
        const faces = results.multiFaceLandmarks ?? [];
        const lm    = faces[0];

        // All feature math, blink detection, quality gating, the calibration
        // polynomial and the One Euro filter now live in the typed lib/gaze
        // pipeline. We just hand it the raw landmarks (canonical non-mirrored
        // space) and forward the enriched frame. `data.gaze` carries the new
        // fx,fy features; `data.dot` is the smoothed screen-% cursor target.
        const frame = gazeRuntimeRef.current.ingest({
          hasFace:   faces.length > 0,
          faceCount: faces.length,
          landmarks: lm,
          eyeLuminance: null, // light gate disabled until pixel readback is wired
          ts: now,
        });
        poseHandlerRef.current?.({ ...frame, landmarks: lm });
      });

      fmEngineRef.current = fm;

      const loop = () => {
        if (!alive) return;
        const now = performance.now();
        if (!analyzingRef.current && poseHandlerRef.current && now - lastSendRef.current >= DETECTOR_INTERVAL_MS) {
          const vid = sharedVideoRef.current;
          if (vid && vid.readyState >= 2) {
            analyzingRef.current = true;
            lastSendRef.current  = now;
            fmEngineRef.current.send({ image: vid })
              .catch(() => { analyzingRef.current = false; });
          }
        }
        fmRafRef.current = requestAnimationFrame(loop);
      };
      fmRafRef.current = requestAnimationFrame(loop);
    };

    initEngine();

    return () => {
      alive = false;
      cancelAnimationFrame(fmRafRef.current);
      try { fmEngineRef.current?.close(); } catch (_) {}
    };
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(navRafRef.current);
    clearTimeout(timeoutRef.current);
  }, []);

  const navigate = (nextView, data=null) => {
    setAnimClass('exit');
    clearTimeout(timeoutRef.current);
    poseHandlerRef.current = null;
    timeoutRef.current = setTimeout(() => {
      if (data) setSelectedChallenge(data);
      setView(nextView);
      setAnimClass('enter');
      cancelAnimationFrame(navRafRef.current);
      navRafRef.current = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimClass('active'))
      );
    }, 260);
  };

  const goGateway   = (data) => navigate('gateway', data);
  const goBriefing  = ()     => navigate('briefing');
  const goPrep      = ()     => { sharedLogRef.current = []; setCaptureData({ blob:null, log:[] }); setGazeModel(null); gazeRuntimeRef.current.reset(); gazeRuntimeRef.current.setModel(null); navigate('calibration'); };
  const goCalibDone  = (model) => { setGazeModel(model); gazeRuntimeRef.current.setModel(model); navigate('prep'); };
  const goList      = ()     => {
    sharedStreamRef.current?.getTracks().forEach(t => t.stop());
    sharedStreamRef.current = null;
    navigate('list');
  };
  const goLanding   = ()     => navigate('landing');
  const handleRoleSelection = (role) => {
    if (role === 'candidate') navigate('list');
    else navigate('ceo-dashboard');
  };
  const abortPrep   = ()     => navigate('gateway');
  const goRecording = (stream, log) => {
    sharedStreamRef.current = stream;
    if (log?.length) {
      sharedLogRef.current = [...log];
      window.biomatchIntegrityLog = sharedLogRef.current;
      setCaptureData(prev => ({ ...prev, log: sharedLogRef.current }));
    }
    navigate('recording');
  };
  const addToLog = (evt) => {
    sharedLogRef.current = [...sharedLogRef.current, evt];
    window.biomatchIntegrityLog = sharedLogRef.current;
    setCaptureData(prev => ({ ...prev, log: sharedLogRef.current }));
  };

  const goUpload = (blob) => {
    setCaptureData({ blob, log: [...sharedLogRef.current] });
    navigate('upload');
  };
  const goResults = (scores) => { setAiScores(scores || DEMO_SCORES); navigate('results'); };
  const resetSession = () => {
    sharedStreamRef.current?.getTracks().forEach(t => t.stop());
    sharedStreamRef.current = null;
    sharedLogRef.current = [];
    setCaptureData({ blob: null, log: [] });
    gazeRuntimeRef.current.reset();
    gazeRuntimeRef.current.setModel(null);
    resetGeminiMutex();
    navigate('list');
  };
  const setPoseHandler = (fn) => { poseHandlerRef.current = fn; };

  return (
    <div style={{minHeight:"100dvh",background:"#1d1d1f",display:"flex",justifyContent:"center"}}>
      <div style={{width:"100%",maxWidth:"420px",height:"100dvh",background:"#1d1d1f",position:"relative",overflow:"hidden",borderLeft:"1px solid rgba(255,255,255,.04)",borderRight:"1px solid rgba(255,255,255,.04)"}}>
        <div className={`screen-anim ${animClass}`}>
          <video ref={sharedVideoRef} style={{ display:'none' }}/>
          {view==="passport"   && passportRouteId && <ScreenPassport sessionId={passportRouteId}/>}
          {view==="landing"    && <ScreenLanding   onSelectRole={handleRoleSelection}/>}
          {view==="list"      && <ScreenList      onEnter={goGateway} activeTab={activeTab} setActiveTab={setActiveTab}/>}
          {view==="ceo-dashboard" && <ScreenCEODashboard onBack={goLanding}/>}
          {view==="gateway"   && selectedChallenge && <ScreenGateway   c={selectedChallenge} onBack={goList} onStart={goBriefing}/>}
          {view==="briefing"    && selectedChallenge && <ScreenBriefing c={selectedChallenge} onContinue={goPrep} onBack={()=>navigate('gateway')}/>}
          {view==="calibration" && <ScreenCalibration videoRef={sharedVideoRef} setPoseHandler={setPoseHandler} onComplete={goCalibDone}/>}
          {view==="prep"      && selectedChallenge && <ScreenPrep      c={selectedChallenge} onAbort={abortPrep} onRecordingStart={goRecording} videoRef={sharedVideoRef} setPoseHandler={setPoseHandler} addToLog={addToLog} gazeModel={gazeModel} gazeRuntime={gazeRuntimeRef.current}/>}
          {view==="recording" && selectedChallenge && <ScreenRecording c={selectedChallenge} stream={sharedStreamRef.current} initialLog={captureData.log} onComplete={goUpload} videoRef={sharedVideoRef} setPoseHandler={setPoseHandler} addToLog={addToLog} gazeModel={gazeModel} gazeRuntime={gazeRuntimeRef.current}/>}
          {view==="results"   && selectedChallenge && captureData && <ScreenResults c={selectedChallenge} captureData={captureData} aiScores={aiScores || DEMO_SCORES} onReset={resetSession}/>}
          {view==="upload"    && selectedChallenge && captureData && <ScreenUpload c={selectedChallenge} blob={captureData.blob} log={captureData.log} onFinish={goResults}/>}
        </div>
      </div>
    </div>
  );
};

export default App;
