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
    const BAR_WIDTH = 6;
    const GAP = 4;
    
    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      
      ctx.clearRect(0, 0, width, height);

      // Add Glow Effect
      ctx.shadowBlur = 15;
      ctx.shadowColor = accentColor;

      if (!isConnected) {
        // Subtle breathing line when idle
        const time = Date.now() / 1000;
        const opacity = 0.2 + Math.sin(time * 2) * 0.1;
        
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#fff';
        ctx.stroke();
        
        animationId = requestAnimationFrame(draw);
        return;
      }

      const data = getAudioData();
      const bufferLength = data.length;
      
      const totalBarWidth = BAR_WIDTH + GAP;
      const maxBars = Math.floor(width / totalBarWidth);
      const step = Math.floor(bufferLength / maxBars) || 1;

      const centerY = height / 2;

      for (let i = 0; i < maxBars; i++) {
        const dataIndex = Math.floor(i * (bufferLength / maxBars));
        const value = data[dataIndex] || 0;
        
        // Non-linear scaling for better visuals
        const percent = value / 255;
        const barHeight = Math.max(4, Math.pow(percent, 1.5) * (height * 0.8)); 
        
        const x = i * totalBarWidth + (width - (maxBars * totalBarWidth)) / 2; // Center the group
        
        // Gradient Color
        const gradient = ctx.createLinearGradient(0, centerY - barHeight/2, 0, centerY + barHeight/2);
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(0.5, '#ffffff');
        gradient.addColorStop(1, accentColor);

        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.3 + (percent * 0.7);
        
        // Rounded caps
        ctx.beginPath();
        ctx.roundRect(x, centerY - barHeight / 2, BAR_WIDTH, barHeight, 4);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0; // Reset

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
      width={800} 
      height={120} 
      className="w-full h-full object-contain"
    />
  );
};