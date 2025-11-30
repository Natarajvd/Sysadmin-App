import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState } from '../types';
import { MODEL_NAME, THINKING_MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants';
import { base64ToUint8Array, decodeAudioData, float32To16kHzPcmBlob, resampleTo16kHZ } from '../utils/audioUtils';

// Audio constants
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;
const FFT_SIZE = 256; // 128 frequency bins

export interface UseLiveSessionReturn {
  connectionState: ConnectionState;
  connect: (enableThinkingMode?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  isMuted: boolean;
  toggleMute: () => void;
  error: string | null;
  latestUserTranscript: string;
  latestModelTranscript: string;
  getAudioData: () => Uint8Array;
  sendImage: (base64Data: string, mimeType: string) => void;
  isScreenSharing: boolean;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  videoStream: MediaStream | null;
}

export function useLiveSession(): UseLiveSessionReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [latestUserTranscript, setLatestUserTranscript] = useState('');
  const [latestModelTranscript, setLatestModelTranscript] = useState('');

  // Refs for audio handling to avoid re-renders
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  // Screen Share Refs
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Analysers for visualization
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataContainerRef = useRef<Uint8Array>(new Uint8Array(FFT_SIZE / 2));

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current) {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }
    if (inputAnalyserRef.current) {
      inputAnalyserRef.current.disconnect();
      inputAnalyserRef.current = null;
    }
    if (outputAnalyserRef.current) {
      outputAnalyserRef.current.disconnect();
      outputAnalyserRef.current = null;
    }
    
    // Stop all scheduled audio
    scheduledSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore already stopped */ }
    });
    scheduledSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const stopScreenShare = useCallback(() => {
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setVideoStream(null);
    setIsScreenSharing(false);
  }, []);

  const disconnect = useCallback(async () => {
    stopScreenShare();
    cleanupAudio();
    sessionPromiseRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
    setLatestUserTranscript('');
    setLatestModelTranscript('');
  }, [cleanupAudio, stopScreenShare]);

  const connect = useCallback(async (enableThinkingMode: boolean = false) => {
    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);

      // 1. Setup Audio Contexts
      // We do NOT force sampleRate here to allow broader browser compatibility.
      // We handle the specific 24000Hz playback in the decodeAudioData buffer creation.
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContext(); 
      const outputCtx = new AudioContext();

      // Vital: Resume if suspended (common in some browsers until user interaction)
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }
      
      inputContextRef.current = inputCtx;
      outputContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // 2. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 3. Setup Input Processing (Mic -> API) + Input Visualizer
      const source = inputCtx.createMediaStreamSource(stream);
      inputSourceRef.current = source;
      
      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = FFT_SIZE;
      inputAnalyser.smoothingTimeConstant = 0.85;
      inputAnalyserRef.current = inputAnalyser;
      
      // Fan-out: Source -> Analyser, Source -> Processor
      source.connect(inputAnalyser);

      const processor = inputCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMuted) return; // Don't send data if muted locally
        
        let inputData = e.inputBuffer.getChannelData(0);
        
        // CRITICAL: Resample to 16kHz if the system microphone is running at 44.1k/48k etc.
        // The API strictly expects 16000Hz. Mismatch results in "demon voice" or silence.
        if (inputCtx.sampleRate !== INPUT_SAMPLE_RATE) {
          inputData = resampleTo16kHZ(inputData, inputCtx.sampleRate);
        }

        // Create the PCM blob
        const pcmBlob = float32To16kHzPcmBlob(inputData);
        
        // Send to API
        if (sessionPromiseRef.current) {
          sessionPromiseRef.current.then((session: any) => {
             session.sendRealtimeInput({ media: pcmBlob });
          }).catch((err: any) => {
            // Ignore small send errors
          });
        }
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);

      // 4. Setup Output Visualizer
      const outputAnalyser = outputCtx.createAnalyser();
      outputAnalyser.fftSize = FFT_SIZE;
      outputAnalyser.smoothingTimeConstant = 0.85;
      outputAnalyserRef.current = outputAnalyser;

      // 5. Connect to Gemini Live API
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const model = enableThinkingMode ? THINKING_MODEL_NAME : MODEL_NAME;
      
      const config: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
        },
        systemInstruction: SYSTEM_INSTRUCTION,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      };

      if (enableThinkingMode) {
        // Max budget for Flash is 24576
        config.thinkingConfig = { thinkingBudget: 24576 };
      }

      // Create session
      const sessionPromise = ai.live.connect({
        model,
        config,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live API Connected');
            setConnectionState(ConnectionState.CONNECTED);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Audio Output
             const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData) {
               try {
                 const buffer = await decodeAudioData(
                   base64ToUint8Array(audioData),
                   outputContextRef.current!,
                   OUTPUT_SAMPLE_RATE
                 );
                 
                 const source = outputContextRef.current!.createBufferSource();
                 source.buffer = buffer;
                 
                 source.connect(outputAnalyser); // Vis
                 outputAnalyser.connect(outputContextRef.current!.destination); // Speaker

                 const currentTime = outputContextRef.current!.currentTime;
                 if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                 }
                 
                 source.start(nextStartTimeRef.current);
                 nextStartTimeRef.current += buffer.duration;
                 
                 scheduledSourcesRef.current.add(source);
                 source.onended = () => {
                   scheduledSourcesRef.current.delete(source);
                 };
               } catch (decErr) {
                 console.error("Audio decoding error", decErr);
               }
             }

             // Handle Interruption
             if (message.serverContent?.interrupted) {
               console.log("Model interrupted");
               scheduledSourcesRef.current.forEach(s => s.stop());
               scheduledSourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setLatestModelTranscript('');
             }

             // Handle Transcripts
             const inputTx = message.serverContent?.inputTranscription?.text;
             if (inputTx) {
               setLatestUserTranscript(prev => prev + inputTx);
             }

             const outputTx = message.serverContent?.outputTranscription?.text;
             if (outputTx) {
               setLatestModelTranscript(prev => prev + outputTx);
             }
          },
          onclose: () => {
            console.log('Gemini Live API Closed');
            setConnectionState(ConnectionState.DISCONNECTED);
          },
          onerror: (err: any) => {
            console.error('Gemini Live API Error', err);
            setError(err.message || "Connection error detected.");
            setConnectionState(ConnectionState.ERROR);
            cleanupAudio();
            stopScreenShare();
          }
        }
      });

      sessionPromise.catch((err: any) => {
          console.error("Failed to connect to Live API:", err);
          setError(err.message || "Network error. Please check your connection and API key.");
          setConnectionState(ConnectionState.ERROR);
          cleanupAudio();
          stopScreenShare();
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to audio service.");
      setConnectionState(ConnectionState.ERROR);
      cleanupAudio();
      stopScreenShare();
    }
  }, [isMuted, cleanupAudio, stopScreenShare]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const sendImage = useCallback((base64Data: string, mimeType: string) => {
    if (sessionPromiseRef.current) {
       sessionPromiseRef.current.then((session: any) => {
         session.sendRealtimeInput({
            media: {
              mimeType,
              data: base64Data
            }
         });
       }).catch(e => console.error("Failed to send image", e));
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      if (!sessionPromiseRef.current) {
        throw new Error("Must be connected to share screen");
      }
      
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 5 } // Low FPS is sufficient for looking at code/terminals
        }, 
        audio: false 
      });
      
      setVideoStream(stream);
      setIsScreenSharing(true);
      screenStreamRef.current = stream;

      // Handle user stopping share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      // Create internal video element to play the stream so we can draw it
      const videoEl = document.createElement('video');
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.play();

      // Setup processing loop
      if (!videoCanvasRef.current) {
        videoCanvasRef.current = document.createElement('canvas');
      }
      const canvas = videoCanvasRef.current;
      const ctx = canvas.getContext('2d');

      // Send a frame every 1000ms (1 FPS) to balance latency and token usage
      videoIntervalRef.current = window.setInterval(async () => {
        if (!ctx || videoEl.readyState < 2) return;

        // Resize to something reasonable for tokens
        const width = 800;
        const aspectRatio = videoEl.videoHeight / videoEl.videoWidth;
        const height = width * aspectRatio;

        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(videoEl, 0, 0, width, height);
        
        // Convert to standard JPEG base64
        const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        
        if (sessionPromiseRef.current) {
           sessionPromiseRef.current.then((session: any) => {
             session.sendRealtimeInput({
               media: {
                 mimeType: 'image/jpeg',
                 data: base64Data
               }
             });
           }).catch(e => console.error("Screen share send failed", e));
        }
      }, 1000);

    } catch (e: any) {
      console.error("Screen share failed", e);
      setError(e.message || "Failed to start screen share");
    }
  }, [stopScreenShare]);

  useEffect(() => {
    return () => {
      cleanupAudio();
      stopScreenShare();
    };
  }, [cleanupAudio, stopScreenShare]);

  // Combined Audio Data Getter
  const getAudioData = useCallback(() => {
    const binCount = FFT_SIZE / 2;
    const inputData = new Uint8Array(binCount);
    const outputData = new Uint8Array(binCount);
    
    if (inputAnalyserRef.current) {
      inputAnalyserRef.current.getByteFrequencyData(inputData);
    }
    
    if (outputAnalyserRef.current) {
      outputAnalyserRef.current.getByteFrequencyData(outputData);
    }
    
    // Merge data: Take the maximum value for each frequency bin
    const mergedData = audioDataContainerRef.current;
    for (let i = 0; i < binCount; i++) {
      mergedData[i] = Math.max(inputData[i], outputData[i]);
    }
    
    return mergedData;
  }, []);

  return {
    connectionState,
    connect,
    disconnect,
    isMuted,
    toggleMute,
    error,
    latestUserTranscript,
    latestModelTranscript,
    getAudioData,
    sendImage,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    videoStream
  };
}