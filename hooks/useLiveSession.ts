
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { ConnectionState, ChatMessage } from '../types';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants';
import { base64ToUint8Array, decodeAudioData, float32To16kHzPcmBlob, resampleTo16kHZ } from '../utils/audioUtils';

// Audio constants
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;
const FFT_SIZE = 256; // 128 frequency bins

// Tool Definitions
const renderDiagramTool: FunctionDeclaration = {
  name: "render_diagram",
  description: "Render a visual diagram using Mermaid.js code. Use this whenever the user asks for a visualization, architecture, or flow chart.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: {
        type: Type.STRING,
        description: "The Mermaid.js code to render. Do not include markdown backticks."
      }
    },
    required: ["code"]
  }
};

export interface UseLiveSessionReturn {
  connectionState: ConnectionState;
  connect: (history?: ChatMessage[]) => Promise<void>;
  disconnect: () => Promise<void>;
  isMuted: boolean;
  toggleMute: () => void;
  error: string | null;
  latestUserTranscript: string;
  latestModelTranscript: string;
  getAudioData: () => Uint8Array;
  sendImage: (base64Data: string, mimeType: string) => void;
  sendText: (text: string) => Promise<boolean>;
  currentVoice: string;
  changeVoice: (voiceName: string, history: ChatMessage[]) => Promise<void>;
}

interface UseLiveSessionProps {
  onSaveTranscript?: (userTranscript: string, modelTranscript: string) => void;
}

export function useLiveSession({ onSaveTranscript }: UseLiveSessionProps = {}): UseLiveSessionReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  // UI States for rendering
  const [latestUserTranscript, setLatestUserTranscript] = useState('');
  const [latestModelTranscript, setLatestModelTranscript] = useState('');
  
  // Refs to track transcripts synchronously (Source of Truth for Logic)
  // This avoids stale state issues inside the WebSocket callbacks
  const transcriptUserRef = useRef('');
  const transcriptModelRef = useRef('');

  // Voice State: 'Charon' (Male) or 'Aoede' (Female)
  const [currentVoice, setCurrentVoice] = useState<string>('Charon');
  const currentVoiceRef = useRef<string>('Charon'); // Ref to track voice synchronously for reconnects

  // Refs for audio handling to avoid re-renders
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const isMutedRef = useRef(false);
  
  // Analysers for visualization
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataContainerRef = useRef<Uint8Array>(new Uint8Array(FFT_SIZE / 2));

  // Sync refs
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

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

  const commitCurrentTranscript = useCallback(() => {
    if (onSaveTranscript) {
      const userText = transcriptUserRef.current;
      const modelText = transcriptModelRef.current;
      
      if (userText.trim() || modelText.trim()) {
        onSaveTranscript(userText, modelText);
        
        // Clear local buffers after commit
        transcriptUserRef.current = '';
        transcriptModelRef.current = '';
        setLatestUserTranscript('');
        setLatestModelTranscript('');
      }
    }
  }, [onSaveTranscript]);

  const disconnect = useCallback(async () => {
    // Commit any remaining transcript data before disconnecting
    commitCurrentTranscript();

    cleanupAudio();
    if (sessionPromiseRef.current) {
       // Best effort close
       sessionPromiseRef.current.then(session => {
         try { session.close(); } catch(e) {}
       }).catch(() => {});
    }
    sessionPromiseRef.current = null;
    setConnectionState(ConnectionState.DISCONNECTED);
  }, [cleanupAudio, commitCurrentTranscript]);

  const connect = useCallback(async (history: ChatMessage[] = []) => {
    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);

      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found in environment variables. Connection aborted.");
      }

      // 1. Setup Audio Contexts
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContext(); 
      const outputCtx = new AudioContext();

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
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          throw new Error("Microphone access denied. Please allow permission.");
        }
        throw err;
      }
      streamRef.current = stream;

      // 3. Setup Input Processing
      const source = inputCtx.createMediaStreamSource(stream);
      inputSourceRef.current = source;
      
      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = FFT_SIZE;
      inputAnalyser.smoothingTimeConstant = 0.85;
      inputAnalyserRef.current = inputAnalyser;
      
      source.connect(inputAnalyser);

      const processor = inputCtx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current) return; 
        
        let inputData = e.inputBuffer.getChannelData(0);
        
        if (inputCtx.sampleRate !== INPUT_SAMPLE_RATE) {
          inputData = resampleTo16kHZ(inputData, inputCtx.sampleRate);
        }

        const pcmBlob = float32To16kHzPcmBlob(inputData);
        
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
      const ai = new GoogleGenAI({ apiKey });
      const model = MODEL_NAME;
      
      const config: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: currentVoiceRef.current } }
        },
        systemInstruction: SYSTEM_INSTRUCTION,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: [renderDiagramTool] }],
      };

      const sessionPromise = ai.live.connect({
        model,
        config,
        callbacks: {
          onopen: () => {
            console.log('Gemini Live API Connected');
            setConnectionState(ConnectionState.CONNECTED);
          },
          onmessage: async (message: LiveServerMessage) => {
             // 1. Handle Audio Output (Primary Modality)
             const parts = message.serverContent?.modelTurn?.parts;
             if (parts) {
               for (const part of parts) {
                 // Audio
                 if (part.inlineData && part.inlineData.data) {
                    const audioData = part.inlineData.data;
                    if (!outputContextRef.current) return;

                    try {
                      const buffer = await decodeAudioData(
                        base64ToUint8Array(audioData),
                        outputContextRef.current,
                        OUTPUT_SAMPLE_RATE
                      );
                      
                      if (!outputContextRef.current) return;

                      const source = outputContextRef.current.createBufferSource();
                      source.buffer = buffer;
                      
                      if (outputAnalyserRef.current) {
                          source.connect(outputAnalyserRef.current);
                          outputAnalyserRef.current.connect(outputContextRef.current.destination);
                      } else {
                          source.connect(outputContextRef.current.destination);
                      }

                      const currentTime = outputContextRef.current.currentTime;
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
                 
                 // Text accumulation
                 if (part.text) {
                   transcriptModelRef.current += part.text;
                   setLatestModelTranscript(transcriptModelRef.current);
                 }
               }
             }

             // Handle Interruptions
             if (message.serverContent?.interrupted) {
               console.log("Model interrupted");
               scheduledSourcesRef.current.forEach(s => s.stop());
               scheduledSourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               
               // Commit partial transcript on interruption
               commitCurrentTranscript();
             }

             // Handle Turn Completion (Model finished speaking)
             if (message.serverContent?.turnComplete) {
                // Commit full transcript for this turn
                commitCurrentTranscript();
             }

             // Accumulate Transcriptions
             const inputTx = message.serverContent?.inputTranscription?.text;
             if (inputTx) {
               transcriptUserRef.current += inputTx;
               setLatestUserTranscript(transcriptUserRef.current);
             }

             const outputTx = message.serverContent?.outputTranscription?.text;
             if (outputTx) {
               transcriptModelRef.current += outputTx;
               setLatestModelTranscript(transcriptModelRef.current);
             }

             // Handle Tool Calls
             if (message.toolCall) {
              console.log("Tool Call Received:", message.toolCall);
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'render_diagram') {
                  const args = fc.args as any;
                  const code = args.code;
                  
                  const markdown = `\n\`\`\`mermaid\n${code}\n\`\`\`\n`;
                  
                  // Append to model ref and trigger update
                  transcriptModelRef.current += markdown;
                  setLatestModelTranscript(transcriptModelRef.current);

                  if (sessionPromiseRef.current) {
                    sessionPromiseRef.current.then((session: any) => {
                      session.sendToolResponse({
                        functionResponses: [
                          {
                            id: fc.id,
                            name: fc.name,
                            response: { result: { success: true } }
                          }
                        ]
                      });
                    });
                  }
                }
              }
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
          }
        }
      });

      sessionPromise.catch((err: any) => {
          console.error("Failed to connect to Live API:", err);
          setError(err.message || "Network error. Please check your connection and API key.");
          setConnectionState(ConnectionState.ERROR);
          cleanupAudio();
      });

      sessionPromise.then(session => {
        if (history && history.length > 0) {
            // Restore last 20 messages for context
            const recent = history.slice(-20);
            const contextText = recent.map(msg => 
                `${msg.role === 'user' ? 'USER' : 'AI'}: ${msg.text}`
            ).join('\n');
            
            if (typeof session.send === 'function') {
              session.send({
                  clientContent: {
                      turns: [{
                          role: 'user',
                          parts: [{ text: `[SYSTEM: RESTORING SESSION CONTEXT. DO NOT READ OUT LOUD. JUST CONFIRM READINESS.]\n\nPREVIOUS CHAT HISTORY:\n${contextText}\n\n[END HISTORY]` }]
                      }],
                      turnComplete: true
                  }
              });
            } else {
               console.warn("Session context restoration skipped: session.send unavailable.");
            }
        }
      });

      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to audio service.");
      setConnectionState(ConnectionState.ERROR);
      cleanupAudio();
    }
  }, [cleanupAudio, commitCurrentTranscript]);

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

  const sendText = useCallback(async (text: string): Promise<boolean> => {
    if (!sessionPromiseRef.current) return false;
    
    try {
      const session = await sessionPromiseRef.current;
      if (typeof session.send === 'function') {
        session.send({
          clientContent: {
            turns: [{
              role: 'user',
              parts: [{ text }]
            }],
            turnComplete: true
          }
        });
        return true;
      } else {
        return false;
      }
    } catch (e) {
      console.error("Failed to send text", e);
      return false;
    }
  }, []);

  const changeVoice = useCallback(async (voiceName: string, history: ChatMessage[]) => {
    console.log("Switching voice to:", voiceName);
    setCurrentVoice(voiceName);
    currentVoiceRef.current = voiceName;
    
    if (connectionState === ConnectionState.CONNECTED) {
      await disconnect();
      setTimeout(() => {
        connect(history);
      }, 500);
    }
  }, [connectionState, disconnect, connect]);

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

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
    sendText,
    currentVoice,
    changeVoice
  };
}
