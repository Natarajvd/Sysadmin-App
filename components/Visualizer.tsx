import React, { useRef, useEffect } from 'react';
import { AudioVisualizerProps } from '../types';

export const Visualizer: React.FC<AudioVisualizerProps> = ({ isConnected, accentColor = '#00ff41', getAudioData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    
    // Configuration
    const BAR_WIDTH = 4;
    const GAP = 2;
    // We expect ~128 bins from the hook
    
    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear with slight fade for trail effect? No, transparent is better for footer.
      ctx.clearRect(0, 0, width, height);

      if (!isConnected) {
        // Flatline logic
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      // Get real data (0-255)
      const data = getAudioData();
      const bufferLength = data.length;
      
      // Calculate layout
      const totalBarWidth = BAR_WIDTH + GAP;
      const maxBars = Math.floor(width / totalBarWidth);
      // We usually want to show the lower frequencies (left side of data) as they are most active for voice
      // Let's visualize the first ~60% of bins spread across the canvas
      const step = Math.floor(bufferLength / maxBars) || 1;

      ctx.fillStyle = accentColor;
      
      // Draw mirrored bars from center
      const centerY = height / 2;

      for (let i = 0; i < maxBars; i++) {
        // Grab data index roughly corresponding to the bar
        const dataIndex = Math.floor(i * (bufferLength / maxBars));
        // Safe check
        const value = data[dataIndex] || 0;
        
        // Scale value to height (0-255 -> 0 - height/2)
        // Add a little minimum height so it looks alive
        const barHeight = Math.max(2, (value / 255) * (height * 0.8)); 
        
        const x = i * totalBarWidth;
        
        // Top bar (growing up from center)
        // Opacity based on height for "glow" feel
        ctx.globalAlpha = 0.4 + (value / 255) * 0.6;
        
        // Draw centered bar
        ctx.fillRect(x, centerY - barHeight / 2, BAR_WIDTH, barHeight);
      }
      
      // Restore alpha
      ctx.globalAlpha = 1.0;

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isConnected, accentColor, getAudioData]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={100} 
      className="w-full h-full object-cover opacity-60 mix-blend-screen"
    />
  );
};
