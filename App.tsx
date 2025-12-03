
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useLiveSession } from './hooks/useLiveSession';
import { ConnectionState, ChatMessage, ChatSession } from './types';
import { Visualizer } from './components/Visualizer';
import { TranscriptMessage } from './components/TranscriptMessage';
import { Sidebar } from './components/Sidebar';
import { SYSTEM_INSTRUCTION } from './constants';

// --- ICONS ---
const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 1.5a3 3 0 00-3 3v1.5a3 3 0 006 0V4.5a3 3 0 00-3-3z" />
  </svg>
);

const MicOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);

const PowerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
  </svg>
);

const PaperClipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
  </svg>
);

const DocumentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const CloudIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
  </svg>
);

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSessions = localStorage.getItem('sysadmin_ai_sessions');
        if (savedSessions) return JSON.parse(savedSessions);
      } catch (e) { return []; }
    }
    return [];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const isAutoScrollingRef = useRef(false);

  // Initialization & Migration
  useEffect(() => {
    // If no active session, select latest or create one
    if (!activeSessionId) {
      if (sessions.length > 0) {
        setActiveSessionId(sessions[0].id);
      } else {
        // Migration check for old single-history format
        const oldHistory = localStorage.getItem('sysadmin_ai_history');
        if (oldHistory) {
          try {
            const parsed = JSON.parse(oldHistory);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const newSession: ChatSession = {
                id: Date.now().toString(),
                title: 'Recovered Session',
                timestamp: Date.now(),
                messages: parsed
              };
              setSessions([newSession]);
              setActiveSessionId(newSession.id);
              localStorage.removeItem('sysadmin_ai_history'); // Clean up old data
              return;
            }
          } catch(e) {}
        }
        
        // Default new session
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'New Session',
          timestamp: Date.now(),
          messages: []
        };
        setSessions([newSession]);
        setActiveSessionId(newSession.id);
      }
    }
  }, [sessions, activeSessionId]);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem('sysadmin_ai_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.error("Failed to save sessions", e);
    }
  }, [sessions]);

  // Derived state
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const committedHistory = activeSession?.messages || [];

  // Callbacks
  const updateActiveSessionMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    if (!activeSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const newMessages = updater(s.messages);
        // Auto-title if it's generic
        let newTitle = s.title;
        if (s.title === 'New Session' && newMessages.length > 0) {
          const firstUserMsg = newMessages.find(m => m.role === 'user');
          if (firstUserMsg) {
            newTitle = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
          }
        }
        return { ...s, messages: newMessages, title: newTitle };
      }
      return s;
    }));
  }, [activeSessionId]);

  const saveTranscriptToHistory = useCallback((userText: string, modelText: string) => {
    if (!activeSessionId) return;
    if (!userText.trim() && !modelText.trim()) return;
    
    const newMessages: ChatMessage[] = [];
    const timestamp = Date.now();

    if (userText.trim()) {
      newMessages.push({
        id: `u-${timestamp}`,
        role: 'user',
        text: userText,
        isComplete: true,
        timestamp: timestamp
      });
    }

    if (modelText.trim()) {
      newMessages.push({
        id: `m-${timestamp}`,
        role: 'model',
        text: modelText,
        isComplete: true,
        timestamp: timestamp + 1
      });
    }

    if (newMessages.length > 0) {
      updateActiveSessionMessages(prev => [...prev, ...newMessages]);
    }
  }, [activeSessionId, updateActiveSessionMessages]);

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
    sendText,
    currentVoice,
    changeVoice
  } = useLiveSession({ 
    onSaveTranscript: saveTranscriptToHistory
  });

  const handleNewSession = async () => {
    if (connectionState === ConnectionState.CONNECTED) {
      await disconnect();
    }
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Session',
      timestamp: Date.now(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (id: string, e?: React.MouseEvent) => {
    // Determine if we are deleting the active session before removing it
    const isDeletingActive = id === activeSessionId;
    
    // Update Sessions List Synchronously using functional update
    setSessions(prevSessions => {
      const updated = prevSessions.filter(s => s.id !== id);
      return updated;
    });

    // Handle Connection & Selection Logic
    if (isDeletingActive) {
      if (connectionState === ConnectionState.CONNECTED) {
        disconnect().catch(err => console.error("Silent disconnect error:", err));
      }
      
      // Calculate what the new ID should be based on current sessions (pre-filtered logic)
      const remaining = sessions.filter(s => s.id !== id);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      } else {
        setActiveSessionId(null); // This triggers the useEffect to create a new session
      }
    }
  };

  const handleSwitchSession = async (id: string) => {
    if (activeSessionId === id) return;
    if (connectionState === ConnectionState.CONNECTED) {
      await disconnect();
    }
    setActiveSessionId(id);
  };

  const handleGenerateRCA = useCallback(async () => {
    // Require history to generate report
    if (committedHistory.length === 0) {
       alert("No session history available to generate a report.");
       return;
    }
    
    // 1. Visual Feedback - User Command
    const timestamp = Date.now();
    const commandMessage: ChatMessage = {
      id: `sys-${timestamp}`,
      role: 'user',
      text: "⚡ GENERATE RCA REPORT",
      isComplete: true,
      timestamp: timestamp
    };
    updateActiveSessionMessages(prev => [...prev, commandMessage]);

    // 2. Visual Feedback - Loading Placeholder
    const loadingId = `rca-loading-${timestamp}`;
    updateActiveSessionMessages(prev => [...prev, {
      id: loadingId,
      role: 'model',
      text: "Generating Root Cause Analysis Report based on session logs...",
      isComplete: false,
      timestamp: timestamp + 1
    }]);

    try {
        // 3. Call REST API (Separate from Live Session)
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const transcript = committedHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
        
        const prompt = `${SYSTEM_INSTRUCTION}\n\n[TASK]\nBased on the following transcript, generate a formal Root Cause Analysis (RCA) report following the "REPORT GENERATION PROTOCOLS". Output strictly markdown.\n\n[TRANSCRIPT]\n${transcript}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        
        const reportText = response.text;

        // 4. Update the placeholder with real content
        updateActiveSessionMessages(prev => prev.map(msg => 
            msg.id === loadingId 
            ? { ...msg, text: reportText, isComplete: true } 
            : msg
        ));

    } catch (e: any) {
        console.error("RCA Generation failed", e);
         updateActiveSessionMessages(prev => prev.map(msg => 
            msg.id === loadingId 
            ? { ...msg, text: "⚠️ **RCA Generation Failed**: " + (e.message || "Unknown error"), isComplete: true } 
            : msg
        ));
    }
  }, [committedHistory, updateActiveSessionMessages]);

  // Smart Auto-Scroll Logic
  const scrollToBottom = () => {
    if (scrollRef.current) {
      isAutoScrollingRef.current = true;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setTimeout(() => { isAutoScrollingRef.current = false; }, 100);
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current || isAutoScrollingRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setShowScrollButton(!isAtBottom);
  };

  useEffect(() => {
    if (!showScrollButton) {
      scrollToBottom();
    }
  }, [latestUserTranscript, latestModelTranscript, committedHistory]);

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isConnected) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processFile(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isConnected]);

  const processFile = async (file: File) => {
    try {
      const isImage = file.type.startsWith('image/');
      const isText = file.type.startsWith('text/') || 
                     file.name.match(/\.(json|yaml|yml|md|js|ts|py|sh|ps1|xml|log|env|txt|tf)$/i);

      if (!isImage && !isText) {
        alert("Unsupported file. Use Image or Text.");
        return;
      }

      if (isImage) {
        const reader = new FileReader();
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
            updateActiveSessionMessages(prev => [...prev, newMessage]);
          }
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        // Native Text Handling - Reads file as text and sends it as a prompt context
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const textContent = ev.target?.result as string;
          if (textContent) {
            // Send to AI as text context
            const success = await sendText(`[SYSTEM: USER UPLOADED FILE "${file.name}"]\n\`\`\`\n${textContent}\n\`\`\``);
            
            // Add to Chat Log as a code block
            const newMessage: ChatMessage = {
              id: Date.now().toString(),
              role: 'user',
              text: `Uploaded File: **${file.name}**\n\`\`\`${file.name.split('.').pop() || 'text'}\n${textContent.slice(0, 2000)}${textContent.length > 2000 ? '\n...(truncated in UI)...' : ''}\n\`\`\``,
              isComplete: true,
              timestamp: Date.now(),
            };
            updateActiveSessionMessages(prev => [...prev, newMessage]);

            if (!success) {
               updateActiveSessionMessages(prev => [...prev, {
                  id: `sys-err-${Date.now()}`,
                  role: 'model',
                  text: "⚠️ **Upload Warning**: The file content could not be sent to the AI because text commands are unavailable. Please describe the file verbally.",
                  isComplete: true,
                  timestamp: Date.now() + 1
               }]);
            }
          }
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isConnected) return;
    dragCounterRef.current += 1;
    if (e.dataTransfer.items.length > 0) setIsDragging(true);
  }, [isConnected]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (!isConnected) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [isConnected]);

  return (
    <div 
      className="flex flex-col h-screen bg-terminal-black text-gray-100 font-sans relative overflow-hidden"
      onDragEnter={handleDragEnter} onDragOver={e => e.preventDefault()} onDragLeave={handleDragLeave} onDrop={handleDrop}
    >
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none z-0"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-terminal-green/5 via-terminal-black/50 to-terminal-black pointer-events-none z-0"></div>

      <input type="file" ref={fileInputRef} onChange={e => { if(e.target.files?.[0]) processFile(e.target.files[0]); if(fileInputRef.current) fileInputRef.current.value=''; }} className="hidden" />

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-4 z-50 bg-terminal-black/80 backdrop-blur-md border border-terminal-green/50 rounded-3xl flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200">
           <div className="text-terminal-green animate-bounce mb-6"><CloudIcon /></div>
           <h2 className="text-3xl font-mono font-bold text-white tracking-widest text-shadow-[0_0_15px_rgba(0,255,65,0.5)]">INITIATE UPLOAD</h2>
           <p className="text-gray-400 mt-2 font-mono uppercase tracking-widest text-sm">Release file to transmit</p>
        </div>
      )}
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionSelect={handleSwitchSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
      />

      {/* HUD Header */}
      <header className="flex-none pt-6 pb-2 px-8 z-20 flex justify-between items-center pointer-events-none select-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <button 
             onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
             className="text-gray-400 hover:text-white transition-colors p-2 -ml-2 rounded-lg hover:bg-white/5"
             title="Toggle History Sidebar"
          >
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
          </button>
          
          <div className="relative">
             <div className={`w-3 h-3 rounded-full transition-all duration-500 ${isConnected ? 'bg-terminal-green shadow-[0_0_15px_#00ff41]' : 'bg-red-500 shadow-[0_0_10px_red]'}`} />
             {isConnected && <div className="absolute inset-0 rounded-full bg-terminal-green animate-ping opacity-75"></div>}
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-[0.2em] text-white font-mono leading-none">
              SYS<span className="text-terminal-green">ADMIN</span>_OS
            </h1>
            <span className="text-[10px] text-gray-500 font-mono mt-1 tracking-widest">V2.5 // LIVE_LINK_ESTABLISHED</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6 pointer-events-auto">
           <div className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border ${
             isConnected ? 'border-terminal-green/30 text-terminal-green bg-terminal-green/5' : 
             connectionState === ConnectionState.ERROR ? 'border-red-500/30 text-red-500 bg-red-500/5' : 'border-gray-700 text-gray-600'
           }`}>
             {connectionState}
           </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col z-10 transition-all duration-300">
        <div 
          className={`flex-1 overflow-y-auto p-4 md:p-8 space-y-2 scroll-smooth ${isSidebarOpen ? 'md:ml-72' : ''}`} 
          ref={scrollRef}
          onScroll={handleScroll}
        >
          {/* Empty State Hero */}
          {committedHistory.length === 0 && !latestUserTranscript && !latestModelTranscript && (
            <div className="flex flex-col items-center justify-center h-full select-none pointer-events-none">
              <div className="relative w-64 h-64 flex items-center justify-center">
                 <div className="absolute inset-0 border border-terminal-green/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                 <div className="absolute inset-4 border border-terminal-green/10 rounded-full animate-[spin_15s_linear_infinite_reverse]"></div>
                 <div className="w-32 h-32 bg-terminal-green/5 rounded-full backdrop-blur-xl border border-terminal-green/30 flex items-center justify-center shadow-[0_0_40px_rgba(0,255,65,0.1)] animate-pulse-slow">
                   <svg className="w-12 h-12 text-terminal-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                   </svg>
                 </div>
              </div>
              <h2 className="text-2xl font-mono text-white tracking-[0.3em] mt-8 font-light">SYSTEM READY</h2>
              <p className="text-terminal-green/60 font-mono text-xs mt-3 tracking-widest">
                SESSION: {activeSession?.title.toUpperCase()}
              </p>
            </div>
          )}

          {committedHistory.map(msg => <TranscriptMessage key={msg.id} message={msg} />)}
          
          {/* Live Transcripts */}
          {(latestUserTranscript || latestModelTranscript) && (
             <div className="space-y-8 pb-32">
               {latestUserTranscript && (
                 <div className="flex justify-end animate-in fade-in slide-in-from-bottom-4 duration-300">
                   <div className="max-w-[80%] backdrop-blur-sm bg-white/5 border border-white/10 p-4 rounded-xl rounded-tr-none">
                     <p className="font-mono text-xs text-terminal-green mb-2 opacity-50">BUFFER_STREAM</p>
                     <p className="text-gray-300 text-lg font-light leading-relaxed">{latestUserTranscript}</p>
                   </div>
                 </div>
               )}
               {latestModelTranscript && (
                 <TranscriptMessage
                   message={{ id: 'live', role: 'model', text: latestModelTranscript, isComplete: false, timestamp: Date.now() }}
                 />
               )}
             </div>
          )}
        </div>
        
        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <button 
            onClick={scrollToBottom}
            className="absolute bottom-32 right-8 z-40 bg-terminal-green/20 text-terminal-green p-3 rounded-full border border-terminal-green/50 shadow-lg hover:bg-terminal-green/30 transition-all animate-bounce"
            title="Scroll to Bottom"
          >
            <ArrowDownIcon />
          </button>
        )}
      </main>

      {/* Footer Control Deck */}
      <footer className={`flex-none p-6 z-30 flex justify-center items-end pointer-events-none transition-all duration-300 ${isSidebarOpen ? 'md:ml-72' : ''}`}>
         <div className="pointer-events-auto bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center gap-2 relative overflow-hidden group hover:border-white/20 transition-all duration-500">
            
            {/* Visualizer Background within Control Deck */}
            <div className="absolute inset-0 opacity-40 pointer-events-none mix-blend-screen">
               <Visualizer isConnected={isConnected} getAudioData={getAudioData} accentColor="#00ff41" />
            </div>

            {/* Buttons */}
            <div className="relative z-10 flex items-center gap-1">
               <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all" title="Upload File (Image/Text/Log)">
                 <PaperClipIcon />
               </button>
               
               {/* RCA Button: Enabled always (even offline) as long as history exists */}
               <button 
                 onClick={handleGenerateRCA} 
                 className="w-12 h-12 flex items-center justify-center rounded-xl text-gray-400 hover:text-terminal-green hover:bg-terminal-green/10 transition-all" 
                 title="Generate RCA Report"
               >
                 <DocumentIcon />
               </button>

               <div className="w-px h-8 bg-white/10 mx-1"></div>

               <button 
                  onClick={() => changeVoice(currentVoice === 'Charon' ? 'Aoede' : 'Charon', committedHistory)}
                  className="px-4 h-12 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all flex flex-col justify-center items-center"
                  title="Switch Voice"
               >
                 <span className="text-[10px] font-mono tracking-widest uppercase opacity-50">Voice</span>
                 <span className="text-xs font-bold font-mono text-terminal-green">{currentVoice === 'Charon' ? 'MALE' : 'FEMALE'}</span>
               </button>

               <div className="w-px h-8 bg-white/10 mx-1"></div>

               {/* Main Toggle */}
               <button
                  onClick={() => isConnected ? toggleMute() : connect(committedHistory)}
                  disabled={isConnecting}
                  className={`
                    h-12 px-6 rounded-xl flex items-center gap-3 font-mono text-sm font-bold tracking-wide transition-all duration-300
                    ${isConnected 
                      ? isMuted 
                        ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30' 
                        : 'bg-terminal-green/10 text-terminal-green border border-terminal-green/30 hover:bg-terminal-green/20 hover:shadow-[0_0_20px_rgba(0,255,65,0.2)]'
                      : 'bg-white text-black hover:bg-gray-200 hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                    }
                  `}
               >
                  {isConnecting ? (
                    <span className="animate-pulse">CONNECTING...</span>
                  ) : isConnected ? (
                    <>
                      {isMuted ? <MicOffIcon /> : <MicIcon />}
                      <span>{isMuted ? 'MUTED' : 'LISTENING (EN)'}</span>
                    </>
                  ) : (
                    <>
                      <PowerIcon />
                      <span>INITIALIZE</span>
                    </>
                  )}
               </button>

               {isConnected && (
                 <button onClick={() => disconnect()} className="w-12 h-12 flex items-center justify-center rounded-xl text-red-400 hover:text-red-200 hover:bg-red-500/20 transition-all ml-1" title="Abort / Disconnect">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
               )}
            </div>
         </div>
      </footer>

      {/* Error Toast */}
      {error && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-950/90 backdrop-blur border border-red-500/50 text-red-200 px-6 py-4 rounded-xl shadow-2xl z-50 animate-in slide-in-from-top-4 flex items-center gap-4 max-w-md">
           <div className="p-2 bg-red-500/20 rounded-full"><svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
           <div>
             <h3 className="font-bold font-mono text-sm tracking-wide">SYSTEM ERROR</h3>
             <p className="text-xs opacity-80 mt-1">{error}</p>
           </div>
        </div>
      )}
    </div>
  );
}
