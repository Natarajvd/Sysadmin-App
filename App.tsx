import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveSession } from './hooks/useLiveSession';
import { ConnectionState, ChatMessage } from './types';
import { Visualizer } from './components/Visualizer';
import { TranscriptMessage } from './components/TranscriptMessage';
import { CommandPalette, Command } from './components/CommandPalette';

// Icons
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 1.5a3 3 0 00-3 3v1.5a3 3 0 006 0V4.5a3 3 0 00-3-3z" />
  </svg>
);

const MicOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);

const PowerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
  </svg>
);

const BrainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

const PaperClipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
  </svg>
);

const CloudArrowUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-12 h-12">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
  </svg>
);

const MonitorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
  </svg>
);

const StopMonitorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);


// Helper to convert text content to a terminal-styled image
const convertTextToImage = (text: string, filename: string): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');

  const lines = text.split('\n');
  const maxLines = 150; // Cap to prevent massive images
  const displayLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) displayLines.push(`... [Truncated ${lines.length - maxLines} lines]`);

  const lineHeight = 20;
  const padding = 24;
  const headerHeight = 48;
  const width = 1000;
  const height = (displayLines.length * lineHeight) + (padding * 2) + headerHeight;

  canvas.width = width;
  canvas.height = height;

  // Background
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(0, 0, width, height);

  // Header Bar
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, headerHeight);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight);
  ctx.lineTo(width, headerHeight);
  ctx.stroke();

  // Filename
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.fillText(filename, padding, 30);

  // Content
  ctx.fillStyle = '#00ff41'; // Terminal Green
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.textBaseline = 'top';
  
  displayLines.forEach((line, i) => {
    // Basic tab handling
    const safeLine = line.replace(/\t/g, '    ');
    ctx.fillText(safeLine, padding, headerHeight + padding + (i * lineHeight));
  });

  return canvas.toDataURL('image/png');
};

export default function App() {
  const {
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
  } = useLiveSession();

  const [committedHistory, setCommittedHistory] = useState<ChatMessage[]>([]);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (connectionState === ConnectionState.DISCONNECTED) {
      setCommittedHistory([]);
    }
  }, [connectionState]);

  // Hook up video preview when stream changes
  useEffect(() => {
    if (videoPreviewRef.current && videoStream) {
      videoPreviewRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  // Scroll to bottom on new text
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [latestUserTranscript, latestModelTranscript, committedHistory]);

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  // Command Palette Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Global Paste Listener for Images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isConnected) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processFile(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isConnected]);

  // Unified File Processor
  const processFile = async (file: File) => {
    try {
      const isImage = file.type.startsWith('image/');
      // List of text types we want to support rendering
      const isText = file.type.startsWith('text/') || 
                     file.name.match(/\.(json|yaml|yml|md|js|ts|py|sh|ps1|xml|log|env)$/i);

      if (!isImage && !isText) {
        alert("Unsupported file type. Please upload an image or a text/log file.");
        return;
      }

      const reader = new FileReader();

      if (isImage) {
        reader.onload = (ev) => {
          const result = ev.target?.result as string;
          if (result) {
            const base64Data = result.split(',')[1];
            sendImage(base64Data, file.type);
            
            const newMessage: ChatMessage = {
              id: Date.now().toString(),
              role: 'user',
              text: `[Uploaded Image: ${file.name}]`,
              image: result,
              isComplete: true,
              timestamp: Date.now(),
            };
            setCommittedHistory(prev => [...prev, newMessage]);
          }
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        reader.onload = (ev) => {
          const textContent = ev.target?.result as string;
          if (textContent) {
            // Render text to an image so the VLM can "read" it
            const dataUrl = convertTextToImage(textContent, file.name);
            const base64Data = dataUrl.split(',')[1];
            
            // Send as image/png
            sendImage(base64Data, 'image/png');

            const newMessage: ChatMessage = {
              id: Date.now().toString(),
              role: 'user',
              text: `[Uploaded File: ${file.name}]`,
              image: dataUrl,
              isComplete: true,
              timestamp: Date.now(),
            };
            setCommittedHistory(prev => [...prev, newMessage]);
          }
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error("File processing failed", err);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and Drop Handlers (flicker fix using counter)
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [isConnected]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (!isConnected) return;
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [isConnected]);

  // Define Commands for Palette
  const commands: Command[] = [
    {
      id: 'connect',
      label: 'Connect to System',
      shortcut: '⌘+Enter',
      icon: <PowerIcon />,
      action: () => connect(isThinkingMode),
      condition: () => !isConnected && !isConnecting
    },
    {
      id: 'disconnect',
      label: 'Disconnect System',
      shortcut: 'Esc',
      icon: <PowerIcon />,
      action: () => disconnect(),
      condition: () => isConnected
    },
    {
      id: 'toggle-mute',
      label: isMuted ? 'Unmute Microphone' : 'Mute Microphone',
      icon: isMuted ? <MicOffIcon /> : <MicIcon />,
      action: toggleMute,
      condition: () => isConnected
    },
    {
      id: 'enable-thinking',
      label: 'Enable Thinking Mode (Gemini 2.5 Flash)',
      icon: <BrainIcon />,
      action: () => setIsThinkingMode(true),
      condition: () => !isConnected && !isThinkingMode
    },
    {
      id: 'disable-thinking',
      label: 'Disable Thinking Mode',
      icon: <BrainIcon />,
      action: () => setIsThinkingMode(false),
      condition: () => !isConnected && isThinkingMode
    },
    {
      id: 'upload-file',
      label: 'Upload File / Screenshot',
      icon: <PaperClipIcon />,
      action: () => fileInputRef.current?.click(),
    },
    {
      id: 'start-screen-share',
      label: 'Share Screen / Window',
      icon: <MonitorIcon />,
      action: startScreenShare,
      condition: () => isConnected && !isScreenSharing
    },
    {
      id: 'stop-screen-share',
      label: 'Stop Screen Sharing',
      icon: <StopMonitorIcon />,
      action: stopScreenShare,
      condition: () => isConnected && isScreenSharing
    },
    {
      id: 'clear-logs',
      label: 'Clear Console Logs',
      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
      action: () => setCommittedHistory([]),
    }
  ];

  return (
    <div 
      className="flex flex-col h-screen bg-terminal-black font-sans text-gray-200"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
        commands={commands} 
      />

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept="image/*,.txt,.log,.md,.json,.yaml,.xml,.js,.ts,.py,.sh,.ps1"
        className="hidden" 
      />

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-terminal-black/90 backdrop-blur-sm border-4 border-dashed border-terminal-green m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
           <div className="text-terminal-green animate-bounce mb-4">
             <CloudArrowUpIcon />
           </div>
           <h2 className="text-2xl font-mono font-bold text-terminal-green tracking-widest">DROP FILE TO ANALYZE</h2>
           <p className="text-gray-400 mt-2 font-mono">Support: Images, Logs, Code, Configs</p>
        </div>
      )}

      {/* Header */}
      <header className="flex-none p-6 border-b border-terminal-border bg-terminal-black/90 backdrop-blur z-10 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] transition-colors duration-500 ${isConnected ? 'bg-terminal-green text-terminal-green animate-pulse' : 'bg-red-500 text-red-500'}`} />
          <h1 className="text-xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            SYS_ADMIN_<span className="text-terminal-green">AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
           {isConnected && isThinkingMode && (
             <span className="text-xs font-mono text-purple-400 border border-purple-400/30 px-2 py-1 rounded animate-pulse bg-purple-900/10">
               THINKING_MODE_ACTIVE
             </span>
           )}
           
           <button 
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 text-xs font-mono text-gray-500 border border-gray-800 px-3 py-1.5 rounded hover:border-gray-600 hover:text-gray-300 transition-colors"
           >
             <span>COMMANDS</span>
             <kbd className="bg-gray-800 px-1.5 rounded text-[10px] text-gray-400">Ctrl+K</kbd>
           </button>

           <div className="text-xs font-mono text-gray-500 uppercase tracking-widest border border-gray-800 px-2 py-1 rounded">
             {connectionState}
           </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-terminal-black to-terminal-black">
        
        {/* Chat / Transcript Log */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth" ref={scrollRef}>
          {committedHistory.map(msg => (
            <TranscriptMessage key={msg.id} message={msg} />
          ))}

          {/* Intro Message */}
          {committedHistory.length === 0 && !latestUserTranscript && !latestModelTranscript && (
            <div className="flex flex-col items-center justify-center h-full opacity-30 select-none pointer-events-none">
              <div className="w-24 h-24 border-2 border-terminal-green rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,255,65,0.2)] animate-pulse">
                 <svg className="w-10 h-10 text-terminal-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                 </svg>
              </div>
              <p className="font-mono text-center max-w-md text-terminal-green tracking-wide">
                SYSTEM ONLINE.<br/>INITIALIZE CONNECTION TO BEGIN DIAGNOSTICS.
              </p>
              <p className="font-mono text-xs text-center text-gray-600 mt-4">
                PASTE IMAGES • UPLOAD LOGS • SHARE SCREEN • ASK FOR DIAGRAMS
              </p>
            </div>
          )}
          
          {/* Active Transcripts */}
          {(latestUserTranscript || latestModelTranscript) && (
             <div className="space-y-6 pb-24">
               {latestUserTranscript && (
                 <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="max-w-[85%] bg-terminal-dim border border-terminal-green/30 p-4 rounded-lg rounded-tr-none shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                     <div className="text-xs text-terminal-green font-mono mb-1 opacity-70">USER_INPUT_STREAM</div>
                     <p className="font-mono text-sm whitespace-pre-wrap text-terminal-green drop-shadow-sm">{latestUserTranscript}</p>
                   </div>
                 </div>
               )}
               
               {latestModelTranscript && (
                 <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="max-w-[85%] bg-gray-900 border border-gray-700 p-4 rounded-lg rounded-tl-none shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
                      <div className="text-xs text-blue-400 font-mono mb-1 opacity-70">ROOT_RESPONSE_STREAM</div>
                      <p className="font-mono text-sm whitespace-pre-wrap text-gray-300">{latestModelTranscript}</p>
                   </div>
                 </div>
               )}
             </div>
          )}
        </div>

        {/* Live Screen Preview Window (Picture in Picture) */}
        {isScreenSharing && (
          <div className="absolute top-6 right-6 w-64 aspect-video bg-black border border-terminal-green shadow-[0_0_20px_rgba(0,255,65,0.2)] rounded-lg overflow-hidden z-20 animate-in slide-in-from-right-4 fade-in duration-500">
            <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-mono text-white bg-black/50 px-1 rounded">LIVE FEED</span>
            </div>
            <video ref={videoPreviewRef} autoPlay muted playsInline className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 border border-terminal-green/20 pointer-events-none" />
          </div>
        )}
        
        {/* Error Notification */}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-white px-6 py-3 rounded-lg text-sm font-mono shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-top-4">
            <svg className="w-5 h-5 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="font-semibold">{error}</span>
          </div>
        )}

      </main>

      {/* Persistent Footer Controls */}
      <footer className="flex-none bg-terminal-black border-t border-terminal-border p-6 relative overflow-hidden">
        {/* Visualizer Background in Footer */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Visualizer 
            isConnected={isConnected} 
            getAudioData={getAudioData}
            accentColor={isThinkingMode && isConnected ? '#a855f7' : '#00ff41'} 
          />
        </div>
        
        {/* Glass overlay for controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-terminal-black via-terminal-black/80 to-transparent pointer-events-none z-0"></div>

        <div className="max-w-5xl mx-auto flex items-center justify-between relative z-10 gap-6">
          
          <div className="flex items-center gap-4">
            {/* Connection Toggle */}
            <button
              onClick={() => isConnected ? disconnect() : connect(isThinkingMode)}
              disabled={isConnecting}
              className={`
                group flex items-center gap-3 px-6 py-4 rounded-xl font-mono font-bold uppercase tracking-wider transition-all duration-300
                ${isConnected 
                  ? 'bg-red-500/10 text-red-500 border border-red-500 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                  : isThinkingMode 
                    ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_40px_rgba(168,85,247,0.6)] hover:-translate-y-0.5'
                    : 'bg-terminal-green text-black hover:bg-[#00cc33] shadow-[0_0_30px_rgba(0,255,65,0.4)] hover:shadow-[0_0_40px_rgba(0,255,65,0.6)] hover:-translate-y-0.5'
                }
                ${isConnecting ? 'opacity-50 cursor-wait' : ''}
              `}
            >
              <PowerIcon />
              <span className="group-hover:tracking-widest transition-all">
                {isConnecting ? 'Initializing...' : isConnected ? 'Disconnect' : isThinkingMode ? 'Connect (Think)' : 'System Connect'}
              </span>
            </button>

            {/* Thinking Mode Toggle */}
            {!isConnected && !isConnecting && (
              <button
                onClick={() => setIsThinkingMode(!isThinkingMode)}
                className={`
                  flex items-center gap-2 px-4 py-4 rounded-xl font-mono font-bold uppercase tracking-wider transition-all border
                  ${isThinkingMode 
                    ? 'bg-purple-900/30 text-purple-400 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                    : 'bg-terminal-dim text-gray-500 border-gray-700 hover:text-gray-300 hover:bg-gray-800'
                  }
                `}
                title="Enable Thinking Mode (Gemini 2.5 Flash)"
              >
                <BrainIcon />
                <span className="hidden sm:inline">Thinking</span>
              </button>
            )}
          </div>

          {/* Right Controls: Screen Share, Upload & Mute */}
          <div className={`flex items-center gap-4 transition-all duration-500 ${isConnected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
             
             {/* Screen Share Button */}
             <button
               onClick={() => isScreenSharing ? stopScreenShare() : startScreenShare()}
               className={`
                 p-4 rounded-full border transition-all shadow-lg hover:-translate-y-0.5 active:scale-95
                 ${isScreenSharing 
                    ? 'bg-terminal-green text-black border-terminal-green hover:bg-[#00cc33]' 
                    : 'bg-terminal-dim text-gray-400 border-gray-600 hover:text-white hover:border-white hover:bg-gray-700'
                 }
               `}
               title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen/Window"}
             >
               {isScreenSharing ? <StopMonitorIcon /> : <MonitorIcon />}
             </button>

             {/* Upload Button */}
             <button
               onClick={() => fileInputRef.current?.click()}
               className="p-4 rounded-full border border-gray-600 bg-terminal-dim text-gray-400 hover:text-white hover:border-white hover:bg-gray-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
               title="Upload Image/Log (Drag & Drop supported)"
             >
               <PaperClipIcon />
             </button>

             {/* Mute Button */}
             <button
              onClick={toggleMute}
              className={`
                p-4 rounded-full border transition-all duration-300 shadow-lg hover:-translate-y-0.5 active:scale-95
                ${isMuted 
                  ? 'bg-red-500 text-white border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                  : 'bg-terminal-dim text-terminal-green border-terminal-green/50 hover:bg-terminal-dim/80 hover:shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                }
              `}
             >
               {isMuted ? <MicOffIcon /> : <MicIcon />}
             </button>
          </div>

        </div>
      </footer>
    </div>
  );
}