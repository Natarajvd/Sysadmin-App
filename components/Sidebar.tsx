
import React from 'react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession
}) => {
  
  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0a0a] border-r border-white/10 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h2 className="text-xs font-mono font-bold tracking-widest text-gray-400 uppercase">Server Logs</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
            aria-label="Close Sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button 
            onClick={() => { onNewSession(); if (window.innerWidth < 768) onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-terminal-green/10 text-terminal-green border border-terminal-green/30 hover:bg-terminal-green/20 transition-all font-mono text-xs font-bold tracking-wider group"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            NEW_SESSION
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {sessions.length === 0 && (
            <div className="text-center py-8 text-gray-600 font-mono text-xs">
              NO_LOGS_FOUND
            </div>
          )}
          {sessions.map(session => (
            <div 
              key={session.id}
              className={`flex items-center gap-1 p-1 rounded-lg transition-all border ${
                activeSessionId === session.id 
                  ? 'bg-white/10 border-terminal-green/30' 
                  : 'hover:bg-white/5 border-transparent'
              }`}
            >
              {/* Select Button - Main Area */}
              <button
                onClick={() => { onSessionSelect(session.id); if (window.innerWidth < 768) onClose(); }}
                className="flex-1 min-w-0 flex items-center gap-3 p-2 text-left outline-none group"
              >
                <svg className={`w-4 h-4 flex-shrink-0 ${activeSessionId === session.id ? 'text-terminal-green' : 'text-gray-600 group-hover:text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                
                <div className="min-w-0">
                  <h3 className={`font-mono text-xs truncate font-medium ${activeSessionId === session.id ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                    {session.title || 'Untitled Session'}
                  </h3>
                  <p className="font-mono text-[10px] opacity-60 truncate mt-0.5 text-gray-600">
                    {new Date(session.timestamp).toLocaleDateString()} {new Date(session.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </button>

              {/* Delete Button - Independent Sibling */}
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault(); 
                  onDeleteSession(session.id, e);
                }}
                className="shrink-0 p-2 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors z-10"
                title="Delete Session"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3 opacity-60">
            <div className="w-2 h-2 rounded-full bg-terminal-green animate-pulse"></div>
            <span className="font-mono text-[10px] tracking-widest text-terminal-green">SYSTEM_ONLINE</span>
          </div>
        </div>
      </div>
    </>
  );
};
