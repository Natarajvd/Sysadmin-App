import React, { useState, useEffect, useRef } from 'react';

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  condition?: () => boolean;
  icon?: React.ReactNode;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands
  const filteredCommands = commands.filter(cmd => {
    const isVisible = cmd.condition ? cmd.condition() : true;
    const matchesQuery = cmd.label.toLowerCase().includes(query.toLowerCase());
    return isVisible && matchesQuery;
  });

  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure render before focus
      setTimeout(() => inputRef.current?.focus(), 10);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Ensure selected index stays within bounds when list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && filteredCommands.length > 0) {
      const activeItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredCommands.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-[#0c0c0c] border border-gray-800 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[60vh]">
        {/* Header/Input */}
        <div className="flex items-center border-b border-gray-800 px-4 py-3 bg-white/5">
          <svg className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-gray-200 placeholder-gray-500 font-mono text-sm"
            placeholder="Type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold text-gray-400 border border-gray-700 rounded bg-gray-900 font-sans tracking-wide">ESC</kbd>
          </div>
        </div>

        {/* List */}
        <div ref={listRef} className="overflow-y-auto flex-1 py-2 custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500 font-mono text-center">
              No matching commands found.
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                className={`w-full text-left px-4 py-3 flex items-center justify-between font-mono text-sm transition-all duration-75 group ${
                  index === selectedIndex 
                    ? 'bg-terminal-green/10 text-terminal-green border-l-2 border-terminal-green pl-[14px]' 
                    : 'text-gray-400 hover:bg-white/5 border-l-2 border-transparent'
                }`}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center gap-3">
                  {cmd.icon && <span className={`opacity-70 ${index === selectedIndex ? 'text-terminal-green' : 'text-gray-500'}`}>{cmd.icon}</span>}
                  <span>{cmd.label}</span>
                </div>
                {cmd.shortcut && (
                  <span className={`text-xs opacity-50 ${index === selectedIndex ? 'text-terminal-green' : 'text-gray-600'}`}>
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-black border-t border-gray-800 text-[10px] text-gray-600 flex justify-between font-mono select-none">
           <div className="flex gap-4">
             <span><strong className="text-gray-500">↑↓</strong> to navigate</span>
             <span><strong className="text-gray-500">↵</strong> to select</span>
           </div>
           <div>SYS_ADMIN_OS v2.5</div>
        </div>
      </div>
    </div>
  );
};