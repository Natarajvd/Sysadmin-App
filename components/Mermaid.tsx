import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface Props {
  chart: string;
}

// Initialize mermaid once with custom "Terminal" theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  fontFamily: 'JetBrains Mono, monospace',
  themeVariables: {
    darkMode: true,
    background: '#0c0c0c', // Terminal Black
    
    // Node styling
    primaryColor: '#1a1a1a', // Dark Gray Node Background
    primaryTextColor: '#ffffff', // Pure White Text for max contrast
    primaryBorderColor: '#00ff41', // Neon Green Border
    
    // Edge/Link styling
    lineColor: '#00ff41', // Neon Green Links
    secondaryColor: '#00f0ff', // Cyan accents for secondary elements
    tertiaryColor: '#0d1117', // Subgraph background (darker)
    
    // Label styling
    edgeLabelBackground: '#0c0c0c', // Dark background for text on lines to prevent overlap
    
    // Font settings
    fontSize: '15px', // Slightly larger for readability
  },
  flowchart: {
    curve: 'basis', // Smoother curved lines
    htmlLabels: true,
    nodeSpacing: 50,
    rankSpacing: 50,
  }
});

export const Mermaid: React.FC<Props> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [chartId, setChartId] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [isAnimated, setIsAnimated] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    
    const renderChart = async () => {
      if (!chart) return;
      
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        if (isMounted) setChartId(id);
        
        const { svg } = await mermaid.render(id, chart);
        
        if (isMounted) {
          setSvg(svg);
          setError(false);
        }
      } catch (e) {
        console.debug('Mermaid render error (likely incomplete stream):', e);
        if (isMounted) setError(true);
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart]);

  const handleDownload = async (format: 'svg' | 'png') => {
    if (!svg) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `diagram-${timestamp}.${format}`;

    // Prepare styles for injection if animated
    const animationStyles = `
      <style>
        #${chartId} .edgePath .path, #${chartId} .flowchart-link {
          stroke-dasharray: 10 5 !important;
          animation: flow-${chartId} 1s linear infinite;
        }
        @keyframes flow-${chartId} {
          from { stroke-dashoffset: 15; }
          to { stroke-dashoffset: 0; }
        }
      </style>
    `;

    if (format === 'svg') {
      // Inject styles into SVG for download so it works externally
      let finalSvg = svg;
      if (isAnimated) {
        finalSvg = finalSvg.replace('</svg>', `${animationStyles}</svg>`);
      }

      const blob = new Blob([finalSvg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, 'image/svg+xml');
      const svgElement = doc.documentElement;
      
      // 1. Robustly determine dimensions from viewBox
      let width = 0;
      let height = 0;

      const viewBox = svgElement.getAttribute('viewBox');
      
      if (viewBox) {
          const parts = viewBox.split(/\s+|,/).filter(Boolean);
          if (parts.length >= 4) {
              width = parseFloat(parts[2]);
              height = parseFloat(parts[3]);
          }
      }

      // Fallback to width/height attributes if viewBox is missing
      if (!width || !height) {
          const w = svgElement.getAttribute('width');
          const h = svgElement.getAttribute('height');
          if (w && h) {
              width = parseFloat(w.replace('px', ''));
              height = parseFloat(h.replace('px', ''));
          }
      }

      // Final Fallback
      if (!width || !height) {
          width = 800;
          height = 600;
      }
      
      const scale = 3; // 3x for high quality output

      // 2. Set explicit dimensions on SVG for high-res rasterization
      svgElement.setAttribute('width', (width * scale).toString());
      svgElement.setAttribute('height', (height * scale).toString());

      const serializer = new XMLSerializer();
      let svgWithDimensions = serializer.serializeToString(svgElement);

      // Inject animation styles if needed (though PNG won't animate, it will show dashed lines)
      if (isAnimated) {
        svgWithDimensions = svgWithDimensions.replace('</svg>', `${animationStyles}</svg>`);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 3. Dark background for transparency (matches app theme - terminal black)
      ctx.fillStyle = '#0c0c0c'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      const blob = new Blob([svgWithDimensions], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
      
      img.onerror = (e) => {
        console.error("Failed to generate PNG", e);
        URL.revokeObjectURL(url);
      };

      img.src = url;
    }
  };

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 p-2 rounded text-xs text-red-400 overflow-x-auto font-mono whitespace-pre">
        {chart}
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden bg-white/5 border border-white/10 group relative shadow-lg">
      {/* Inject Styles for Animation if Active */}
      {isAnimated && (
        <style>{`
          #${chartId} .edgePath .path, #${chartId} .flowchart-link {
            stroke-dasharray: 10 5 !important;
            animation: flow-${chartId} 1s linear infinite;
          }
          @keyframes flow-${chartId} {
            from { stroke-dashoffset: 15; }
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      )}

      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs font-mono text-gray-500 uppercase">Mermaid Diagram</span>
        <div className="flex gap-2">
            <button 
                onClick={() => setIsAnimated(!isAnimated)}
                className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                  isAnimated 
                    ? 'bg-terminal-green/20 text-terminal-green hover:bg-terminal-green/30' 
                    : 'bg-black/20 text-gray-400 hover:bg-black/40 hover:text-white'
                }`}
                title="Toggle Animated Data Flow"
            >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Flow
            </button>
            <div className="w-px bg-white/10 mx-1"></div>
            <button 
                onClick={() => handleDownload('svg')}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-black/20 px-2 py-1 rounded hover:bg-black/40 transition-colors"
                title="Download as Scalable Vector Graphic"
            >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                SVG
            </button>
            <button 
                onClick={() => handleDownload('png')}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-black/20 px-2 py-1 rounded hover:bg-black/40 transition-colors"
                title="Download as PNG Image"
            >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                PNG
            </button>
        </div>
      </div>

      <div 
        className="mermaid-container p-4 overflow-x-auto flex justify-center bg-[#0c0c0c]"
        ref={containerRef}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
};