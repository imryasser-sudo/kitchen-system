"use client";

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY > 0 && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY;
      
      if (distance > 0) {
        setPullDistance(Math.min(distance, 80)); 
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      setIsRefreshing(true);
      setPullDistance(0);
      
      if (typeof window !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50); // اهتزاز عند التحديث
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      window.location.reload(); 
      
      setIsRefreshing(false);
    } else {
      setPullDistance(0);
    }
    setStartY(0);
  };

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-full"
    >
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg z-50 transition-all duration-200"
        style={{ 
          top: `${pullDistance - 50}px`,
          transform: `rotate(${pullDistance * 3}deg)`,
          opacity: pullDistance / 60 
        }}
      >
        <RefreshCw className={`w-5 h-5 text-indigo-600 dark:text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} />
      </div>

      <div 
        className="transition-transform duration-200"
        style={{ transform: `translateY(${isRefreshing ? 50 : pullDistance * 0.4}px)` }}
      >
        {children}
      </div>
    </div>
  );
}