import React from 'react';
import { ChatMessage } from '../types';
import { Mermaid } from './Mermaid';
import { CodeBlock } from './CodeBlock';

interface Props {
  message: ChatMessage;
}

export const TranscriptMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  
  const renderContent = (text: string) => {
    const parts = text.split(/```(\w*)\n([\s\S]*?)```/g);

    if (parts.length === 1) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }

    return (
      <div className="flex flex-col gap-4">
        {parts.map((part, index) => {
          if (index % 3 === 0) {
            if (!part) return null;
            return <div key={index} className="whitespace-pre-wrap">{part}</div>;
          }
          if (index % 3 === 1) return null;
          if (index % 3 === 2) {
            const language = parts[index - 1] || 'text';
            const code = part;
            if (language.toLowerCase() === 'mermaid') {
              return <Mermaid key={index} chart={code} />;
            }
            return <CodeBlock key={index} code={code} language={language} />;
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className={`flex w-full mb-8 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      <div 
        className={`max-w-[85%] md:max-w-[75%] p-6 rounded-2xl backdrop-blur-md border shadow-xl transition-all hover:shadow-2xl ${
          isUser 
            ? 'bg-terminal-green/5 border-terminal-green/20 text-gray-100 rounded-tr-sm' 
            : 'bg-white/5 border-white/10 text-gray-200 rounded-tl-sm'
        }`}
      >
        <div className="flex items-center gap-3 mb-4 border-b border-white/5 pb-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUser ? 'bg-terminal-green/20 text-terminal-green' : 'bg-blue-500/20 text-blue-400'}`}>
             {isUser ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
             ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
             )}
          </div>
          <div className="flex flex-col">
             <span className="text-xs font-bold tracking-widest uppercase font-mono text-gray-400">
               {isUser ? 'User_Command' : 'System_Response'}
             </span>
             <span className="text-[10px] text-gray-600 font-mono">
               {new Date(message.timestamp).toLocaleTimeString()}
             </span>
          </div>
        </div>
        
        {message.image && (
          <div className="mb-6 rounded-lg overflow-hidden border border-white/10 shadow-lg relative group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <img src={message.image} alt="Attachment" className="max-w-full h-auto max-h-[400px] object-contain bg-black/40" />
          </div>
        )}

        <div className="text-base leading-7 font-light tracking-wide font-sans">
          {renderContent(message.text)}
        </div>
      </div>
    </div>
  );
};