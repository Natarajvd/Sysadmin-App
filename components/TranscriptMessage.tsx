import React from 'react';
import { ChatMessage } from '../types';
import { Mermaid } from './Mermaid';
import { CodeBlock } from './CodeBlock';

interface Props {
  message: ChatMessage;
}

export const TranscriptMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  
  // Simple parser to split text by markdown code blocks ```lang ... ```
  const renderContent = (text: string) => {
    // Regex to find code blocks: ```(lang)?\n(content)\n```
    // We split by the regex to get alternating parts of [text, lang, code, text, ...]
    const parts = text.split(/```(\w*)\n([\s\S]*?)```/g);

    if (parts.length === 1) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }

    return (
      <div className="flex flex-col">
        {parts.map((part, index) => {
          // The split results in:
          // index 0: text before
          // index 1: language
          // index 2: code
          // index 3: text after (or next before)
          // ... and so on
          
          // Modulo logic to identify parts
          // The pattern repeats every 3 items after the first one (which is index 0)
          
          if (index % 3 === 0) {
            // This is regular text
            if (!part) return null;
            return <div key={index} className="whitespace-pre-wrap">{part}</div>;
          }
          
          if (index % 3 === 1) {
            // This is the language tag, we skip rendering it directly, 
            // it will be used by the next iteration (the code block)
            return null;
          }

          if (index % 3 === 2) {
            // This is the code content
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
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div 
        className={`max-w-[80%] p-4 rounded-lg font-mono text-sm leading-relaxed border shadow-lg ${
          isUser 
            ? 'bg-terminal-dim border-terminal-green/30 text-terminal-green rounded-tr-none' 
            : 'bg-terminal-dim border-gray-700 text-gray-300 rounded-tl-none'
        }`}
      >
        <div className="flex items-center gap-2 mb-2 opacity-50 text-xs uppercase tracking-wider select-none">
          <span className={`w-2 h-2 rounded-full ${isUser ? 'bg-terminal-green' : 'bg-blue-500'}`}></span>
          {isUser ? 'SYS_ADMIN_USER' : 'AI_ASSISTANT_ROOT'}
        </div>
        
        {/* Optional Image Attachment */}
        {message.image && (
          <div className="mb-3 rounded overflow-hidden border border-white/10">
            <img src={message.image} alt="User Upload" className="max-w-full h-auto max-h-64 object-contain bg-black/50" />
          </div>
        )}

        {renderContent(message.text)}
      </div>
    </div>
  );
};