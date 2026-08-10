"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom'; 
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Search, ClipboardList, Plus, Minus, Loader2, AlertCircle, Store, CalendarClock, 
  RotateCcw, Send, Edit, X, Package, AlertTriangle, Gift, CalendarRange, Hash,
  Check, Trash2, ListChecks, Clock, ChevronDown, ChevronUp, Layers, ArrowRightLeft, 
  Wifi, WifiOff, Soup, Sandwich, UtensilsCrossed, Beef, CupSoda, Pizza, Sparkles, Building2, LayoutGrid,
  Eye, EyeOff, ChevronRight, ChevronLeft, List, LogOut, PackageOpen, Drumstick, Bird, Bone, Wheat, Flame, Thermometer, Timer, Scale, ShieldCheck, Fish, Egg, Carrot, Leaf, Apple, Cherry, Citrus, Grape, Croissant, Cookie, Cake, IceCream, Milk, Snowflake, Coffee, GlassWater, CookingPot, ChefHat, Utensils, ShoppingCart, Droplets, Droplet, Box, Truck
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useTheme } from '@/components/ThemeProvider'; 

dayjs.locale('ar');

// خريطة الأيقونات الموحدة
const allIconsMap: Record<string, any> = {
  Layers, Drumstick, Sandwich, Droplets, Droplet, Pizza, Beef, Fish, Bird, Bone, Wheat, Soup, Egg, Milk, Carrot, Leaf, Apple, Citrus, Cherry, Grape, Croissant, Cake, Cookie, IceCream, CupSoda, Coffee, GlassWater, Flame, Snowflake, Box, Store, Utensils, CookingPot, Truck, Sparkles, Package, PackageOpen, ChefHat, ShoppingCart, UtensilsCrossed, Scale, Thermometer, Timer, ShieldCheck
};

type PickerTarget = 'orderDate';
const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const ORDER_TYPES = [
  { id: 'طلبية يومية', label: 'يومية', icon: <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/20', border: 'border-violet-200 dark:border-violet-500/30' },
  { id: 'طارئ / سد نقص', label: 'سد نقص', icon: <AlertTriangle className="w-3 h-3 md:w-3.5 md:h-3.5" />, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/20', border: 'border-rose-200 dark:border-rose-500/30' },
  { id: 'تعويض / استرجاع', label: 'استرجاع', icon: <RotateCcw className="w-3 h-3 md:w-3.5 md:h-3.5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20', border: 'border-amber-200 dark:border-amber-500/30' },
  { id: 'تحويل من فرع', label: 'تحويل', icon: <ArrowRightLeft className="w-3 h-3 md:w-3.5 md:h-3.5" />, color: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/20', border: 'border-fuchsia-200 dark:border-fuchsia-500/30' },
  { id: 'دعم / ترويج', label: 'دعم', icon: <Gift className="w-3 h-3 md:w-3.5 md:h-3.5" />, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-500/20', border: 'border-teal-200 dark:border-teal-500/30' },
  { id: 'تجهيز مسبق / مناسبات', label: 'مسبق', icon: <CalendarRange className="w-3 h-3 md:w-3.5 md:h-3.5" />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/20', border: 'border-indigo-200 dark:border-indigo-500/30' },
];

const getItemEmoji = (name: string) => {
  if (!name) return '✨';
  const lowerName = name.toLowerCase();
  if (lowerName.includes('ثوم') || lowerName.includes('ثومية')) return '🧄';
  if (lowerName.includes('سبايسي') || lowerName.includes('حار') || lowerName.includes('نار')) return '🔥';
  if (lowerName.includes('هني') || lowerName.includes('عسل')) return '🍯';
  if (lowerName.includes('مدخن') || lowerName.includes('باربيكيو')) return '🪵';
  if (lowerName.includes('جبن') || lowerName.includes('شيدر') || lowerName.includes('موزريلا')) return '🧀';
  if (lowerName.includes('صوص')) return '🏺';
  if (lowerName.includes('دجاج') || lowerName.includes('زنكر') || lowerName.includes('تندر') || lowerName.includes('كنتاكي')) return '🍗';
  if (lowerName.includes('لحم') || lowerName.includes('بقر') || lowerName.includes('ستيك')) return '🥩';
  if (lowerName.includes('بركر') || lowerName.includes('برجر') || lowerName.includes('سماش')) return '🍔';
  if (lowerName.includes('رول') || lowerName.includes('صاج') || lowerName.includes('شاورما') || lowerName.includes('راب')) return '🌯';
  if (lowerName.includes('فنكر') || lowerName.includes('فرايز') || lowerName.includes('بطاطا')) return '🍟';
  if (lowerName.includes('بوب') || lowerName.includes('بشار')) return '🍿';
  if (lowerName.includes('صمون') || lowerName.includes('خبز') || lowerName.includes('تورتيلا')) return '🥖';
  if (lowerName.includes('بيبسي') || lowerName.includes('سفن') || lowerName.includes('كولا')) return '🥤';
  if (lowerName.includes('علب') || lowerName.includes('تغليف') || lowerName.includes('سفري')) return '🛍️';
  return '✨';
};

// 💡 هندسة البروز 💡
const getQtyColors = (qty: number, isFocused: boolean) => {
  const baseTransition = "transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]";
  
  if (qty === 0) return {
     wrapper: isFocused 
        ? `bg-indigo-50/40 dark:bg-[#1a1a2e] border-2 border-indigo-600 dark:border-indigo-400 shadow-[0_25px_60px_-12px_rgba(99,102,241,0.6)] dark:shadow-[0_25px_60px_-12px_rgba(99,102,241,0.8)] scale-[1.05] md:scale-[1.08] -translate-y-2 md:-translate-y-3 z-50 ring-[5px] ring-indigo-500/30 dark:ring-indigo-400/20 ${baseTransition}` 
        : `bg-white dark:bg-[#121214] shadow-sm border border-slate-200 dark:border-white/5 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-[#161622] hover:scale-[1.02] md:hover:scale-[1.04] hover:-translate-y-1 hover:shadow-[0_15px_35px_-10px_rgba(99,102,241,0.4)] hover:z-40 ${baseTransition}`,
     capsuleBg: isFocused 
        ? "bg-white/90 dark:bg-[#050505] border-2 border-indigo-300 dark:border-indigo-500/50 shadow-md" 
        : "bg-slate-50 dark:bg-[#050505] border border-transparent group-hover:border-indigo-200/80 dark:group-hover:border-indigo-500/30 group-hover:bg-white dark:group-hover:bg-[#0a0a0c] transition-all duration-200",
     input: isFocused ? "text-indigo-700 dark:text-white font-black text-xl md:text-2xl scale-110 drop-shadow-md" : "text-slate-600 dark:text-slate-400 font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-300 group-hover:scale-110 transition-all duration-200",
     btnText: isFocused ? "text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-white/10" : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-white/5 transition-colors duration-200",
     title: isFocused ? "text-indigo-800 dark:text-white font-black scale-105 md:scale-110 origin-right drop-shadow-sm" : "text-slate-800 dark:text-white/90 font-bold group-hover:text-indigo-700 dark:group-hover:text-indigo-300 group-hover:scale-[1.02] md:group-hover:scale-105 origin-right transition-all duration-200",
     subtitle: isFocused ? "text-indigo-600 dark:text-indigo-300 font-bold" : "text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400/80 transition-colors duration-200",
     iconBg: isFocused 
        ? "bg-indigo-600 dark:bg-indigo-500 text-white rounded-[0.8rem] shadow-[0_8px_20px_rgba(99,102,241,0.6)] border border-indigo-400 scale-110 md:scale-[1.15] rotate-6" 
        : "bg-slate-50 dark:bg-[#050505] grayscale-[0.4] group-hover:grayscale-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 rounded-[0.8rem] border border-slate-200 dark:border-white/5 group-hover:border-indigo-200 dark:group-hover:border-indigo-500/30 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-200",
  };
  
  if (qty <= 10) return { 
     wrapper: `bg-teal-50/60 dark:bg-[#112a28] border-2 ${isFocused ? 'border-teal-500 shadow-[0_25px_60px_-12px_rgba(20,184,166,0.6)] scale-[1.05] md:scale-[1.08] -translate-y-2 md:-translate-y-3 z-50 ring-[5px] ring-teal-500/40' : 'border-teal-400 dark:border-teal-500/50 shadow-[0_8px_25px_-8px_rgba(20,184,166,0.3)] hover:shadow-[0_15px_35px_-10px_rgba(20,184,166,0.5)] hover:scale-[1.02] md:hover:scale-[1.04] hover:-translate-y-1 hover:border-teal-500 z-40'} ${baseTransition}`, 
     capsuleBg: isFocused ? "bg-white/90 dark:bg-[#050505] border-2 border-teal-400 dark:border-teal-500/60 shadow-md" : "bg-white dark:bg-[#050505] border border-teal-200 dark:border-teal-500/30 shadow-inner", 
     input: isFocused ? "text-teal-800 dark:text-teal-200 font-black text-xl md:text-2xl scale-110 drop-shadow-md" : "text-teal-700 dark:text-teal-300 font-black group-hover:scale-110 transition-all",
     btnText: "text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors", 
     title: `font-black drop-shadow-sm transition-all origin-right ${isFocused ? 'text-teal-900 dark:text-white scale-105 md:scale-110' : 'text-teal-800 dark:text-teal-200 group-hover:scale-[1.02] md:group-hover:scale-105 group-hover:text-teal-700 dark:group-hover:text-white'}`, 
     subtitle: "text-teal-600 dark:text-teal-400 font-bold transition-colors", 
     iconBg: `rounded-[0.8rem] transition-all ${isFocused ? 'bg-teal-600 dark:bg-teal-500 shadow-[0_8px_20px_rgba(20,184,166,0.6)] border border-teal-400 text-white scale-110 md:scale-[1.15] rotate-6' : 'bg-teal-100 dark:bg-teal-500/20 border border-teal-300 dark:border-teal-500/30 shadow-sm text-teal-600 dark:text-teal-400 group-hover:scale-110 group-hover:rotate-3'}`,
  };

  if (qty <= 50) return { 
     wrapper: `bg-violet-50/60 dark:bg-[#1a1528] border-2 ${isFocused ? 'border-violet-500 shadow-[0_25px_60px_-12px_rgba(139,92,246,0.6)] scale-[1.05] md:scale-[1.08] -translate-y-2 md:-translate-y-3 z-50 ring-[5px] ring-violet-500/40' : 'border-violet-400 dark:border-violet-500/50 shadow-[0_8px_25px_-8px_rgba(139,92,246,0.3)] hover:shadow-[0_15px_35px_-10px_rgba(139,92,246,0.5)] hover:scale-[1.02] md:hover:scale-[1.04] hover:-translate-y-1 hover:border-violet-500 z-40'} ${baseTransition}`, 
     capsuleBg: isFocused ? "bg-white/90 dark:bg-[#050505] border-2 border-violet-400 dark:border-violet-500/60 shadow-md" : "bg-white dark:bg-[#050505] border border-violet-200 dark:border-violet-500/30 shadow-inner", 
     input: isFocused ? "text-violet-800 dark:text-violet-200 font-black text-xl md:text-2xl scale-110 drop-shadow-md" : "text-violet-700 dark:text-violet-300 font-black group-hover:scale-110 transition-all",
     btnText: "text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition-colors", 
     title: `font-black drop-shadow-sm transition-all origin-right ${isFocused ? 'text-violet-900 dark:text-white scale-105 md:scale-110' : 'text-violet-800 dark:text-violet-200 group-hover:scale-[1.02] md:group-hover:scale-105 group-hover:text-violet-700 dark:group-hover:text-white'}`, 
     subtitle: "text-violet-600 dark:text-violet-400 font-bold transition-colors", 
     iconBg: `rounded-[0.8rem] transition-all ${isFocused ? 'bg-violet-600 dark:bg-violet-500 shadow-[0_8px_20px_rgba(139,92,246,0.6)] border border-violet-400 text-white scale-110 md:scale-[1.15] rotate-6' : 'bg-violet-100 dark:bg-violet-500/20 border border-violet-300 dark:border-violet-500/30 shadow-sm text-violet-600 dark:text-violet-400 group-hover:scale-110 group-hover:rotate-3'}`,
  };

  if (qty <= 100) return { 
     wrapper: `bg-amber-50/60 dark:bg-[#281d11] border-2 ${isFocused ? 'border-amber-500 shadow-[0_25px_60px_-12px_rgba(245,158,11,0.6)] scale-[1.05] md:scale-[1.08] -translate-y-2 md:-translate-y-3 z-50 ring-[5px] ring-amber-500/40' : 'border-amber-400 dark:border-amber-500/50 shadow-[0_8px_25px_-8px_rgba(245,158,11,0.3)] hover:shadow-[0_15px_35px_-10px_rgba(245,158,11,0.5)] hover:scale-[1.02] md:hover:scale-[1.04] hover:-translate-y-1 hover:border-amber-500 z-40'} ${baseTransition}`, 
     capsuleBg: isFocused ? "bg-white/90 dark:bg-[#050505] border-2 border-amber-400 dark:border-amber-500/60 shadow-md" : "bg-white dark:bg-[#050505] border border-amber-200 dark:border-amber-500/30 shadow-inner", 
     input: isFocused ? "text-amber-800 dark:text-amber-200 font-black text-xl md:text-2xl scale-110 drop-shadow-md" : "text-amber-700 dark:text-amber-300 font-black group-hover:scale-110 transition-all",
     btnText: "text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors", 
     title: `font-black drop-shadow-sm transition-all origin-right ${isFocused ? 'text-amber-900 dark:text-white scale-105 md:scale-110' : 'text-amber-800 dark:text-amber-200 group-hover:scale-[1.02] md:group-hover:scale-105 group-hover:text-amber-700 dark:group-hover:text-white'}`, 
     subtitle: "text-amber-600 dark:text-amber-400 font-bold transition-colors", 
     iconBg: `rounded-[0.8rem] transition-all ${isFocused ? 'bg-amber-500 dark:bg-amber-500 shadow-[0_8px_20px_rgba(245,158,11,0.6)] border border-amber-400 text-white scale-110 md:scale-[1.15] rotate-6' : 'bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 shadow-sm text-amber-600 dark:text-amber-400 group-hover:scale-110 group-hover:rotate-3'}`,
  };

  return { 
     wrapper: `bg-rose-50/60 dark:bg-[#281318] border-2 ${isFocused ? 'border-rose-500 shadow-[0_25px_60px_-12px_rgba(244,63,94,0.6)] scale-[1.05] md:scale-[1.08] -translate-y-2 md:-translate-y-3 z-50 ring-[5px] ring-rose-500/40 animate-none' : 'border-rose-400 dark:border-rose-500/50 shadow-[0_8px_25px_-8px_rgba(244,63,94,0.3)] hover:shadow-[0_15px_35px_-10px_rgba(244,63,94,0.5)] hover:scale-[1.02] md:hover:scale-[1.04] hover:-translate-y-1 hover:border-rose-500 z-40 animate-pulse hover:animate-none'} ${baseTransition}`, 
     capsuleBg: isFocused ? "bg-white/90 dark:bg-[#050505] border-2 border-rose-400 dark:border-rose-500/60 shadow-md" : "bg-white dark:bg-[#050505] border border-rose-200 dark:border-rose-500/30 shadow-inner", 
     input: isFocused ? "text-rose-800 dark:text-rose-200 font-black text-xl md:text-2xl scale-110 drop-shadow-md" : "text-rose-700 dark:text-rose-300 font-black group-hover:scale-110 transition-all",
     btnText: "text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors", 
     title: `font-black drop-shadow-sm transition-all origin-right ${isFocused ? 'text-rose-900 dark:text-white scale-105 md:scale-110' : 'text-rose-800 dark:text-rose-200 group-hover:scale-[1.02] md:group-hover:scale-105 group-hover:text-rose-700 dark:group-hover:text-white'}`, 
     subtitle: "text-rose-600 dark:text-rose-400 font-bold transition-colors", 
     iconBg: `rounded-[0.8rem] transition-all ${isFocused ? 'bg-rose-600 dark:bg-rose-500 shadow-[0_8px_20px_rgba(244,63,94,0.6)] border border-rose-400 text-white scale-110 md:scale-[1.15] rotate-6' : 'bg-rose-100 dark:bg-rose-500/20 border border-rose-300 dark:border-rose-500/30 shadow-sm text-rose-600 dark:text-rose-400 group-hover:scale-110 group-hover:rotate-3'}`,
  };
};

const getDynamicSizing = (count: number) => {
  if (count <= 12) {
    return {
      gridCols: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-3.5",
      cardPadding: "p-2.5 md:p-3",
      iconSize: "w-10 h-10 md:w-12 md:h-12 text-xl md:text-2xl",
      titleSize: "text-[13px] md:text-[15px] leading-tight", 
      subTitleSize: "text-[10px] md:text-[11px]",
      btnHeight: "h-9 md:h-10",
      btnWidth: "w-9 md:w-10",
      inputSize: "text-base md:text-lg",
      quickAddClass: "top-1 left-1 flex-col gap-1 opacity-0 group-hover:opacity-100",
      quickAddBtn: "text-[9px] w-7 py-1 rounded",
      gapInner: "gap-1 mb-2 mt-1"
    };
  } else if (count <= 30) { 
    return {
      gridCols: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2.5 md:gap-3",
      cardPadding: "p-2 md:p-2.5",
      iconSize: "w-8 h-8 md:w-9 md:h-9 text-lg", 
      titleSize: "text-[12px] md:text-[14px] leading-tight", 
      subTitleSize: "text-[9px] md:text-[10px]",
      btnHeight: "h-8 md:h-9",
      btnWidth: "w-8 md:w-9",
      inputSize: "text-sm md:text-base font-black",
      quickAddClass: "top-1 left-1 flex-row gap-1 opacity-100", 
      quickAddBtn: "text-[8px] px-1.5 py-0.5 rounded",
      gapInner: "gap-1 mb-1.5 mt-0.5" 
    };
  } else {
    return {
      gridCols: "grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-12 gap-2 md:gap-2.5",
      cardPadding: "p-1.5 md:p-2",
      iconSize: "w-6 h-6 md:w-8 md:h-8 text-base",
      titleSize: "text-[11px] md:text-[12px] leading-tight line-clamp-1", 
      subTitleSize: "hidden", 
      btnHeight: "h-7 md:h-8",
      btnWidth: "w-7 md:w-8",
      inputSize: "text-xs font-bold",
      quickAddClass: "hidden", 
      quickAddBtn: "",
      gapInner: "gap-0.5 mb-1 mt-0.5"
    };
  }
};

const FlyingEmoji = ({ item, targetRef, onComplete }: any) => {
  const [pos, setPos] = useState({ x: item.startX, y: item.startY, opacity: 1, scale: 1.5 });

  useEffect(() => {
    if (!targetRef?.current) {
       onComplete(item.id);
       return;
    }
    const targetRect = targetRef.current.getBoundingClientRect();
    const timer = setTimeout(() => {
      setPos({
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
        opacity: 0.1, 
        scale: 0.3   
      });
    }, 20);
    const completeTimer = setTimeout(() => {
      onComplete(item.id);
    }, 450); 
    return () => { clearTimeout(timer); clearTimeout(completeTimer); };
  }, [item, targetRef, onComplete]);

  return (
    <div
      className="fixed z-[999999] pointer-events-none flex items-center justify-center text-4xl drop-shadow-2xl"
      style={{
        left: pos.x, top: pos.y, opacity: pos.opacity,
        transform: `translate(-50%, -50%) scale(${pos.scale})`,
        transition: 'all 450ms cubic-bezier(0.25, 1, 0.5, 1)' 
      }}
    >
      {item.isImage ? <img src={item.content} className="w-12 h-12 object-contain drop-shadow-sm" alt="" /> : item.content}
    </div>
  );
};

const CustomSelect = ({ value, onChange, options, placeholder, icon: Icon, disabled, hasError, warning }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt: any) => opt.id === value);

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full px-3.5 py-2 rounded-xl transition-all duration-300 cursor-pointer h-10 md:h-11 shadow-sm dark:shadow-inner
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-[#050505]/50 border border-slate-200 dark:border-white/5' :
            hasError ? 'border border-rose-500/50 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-[inset_0_0_0_2px_rgba(244,63,94,0.1)]' :
            warning ? 'border border-amber-500/50 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-[inset_0_0_0_2px_rgba(245,158,11,0.1)]' :
            'bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-white/5'}
          ${isOpen && !disabled ? 'ring-4 ring-indigo-500/20 border-indigo-400 dark:border-indigo-500/50 bg-slate-50 dark:bg-[#121214]' : ''}
        `}
      >
        <div className="flex items-center gap-2.5 truncate">
          {Icon && <Icon className={`w-4 h-4 shrink-0 transition-colors ${disabled ? 'text-slate-400 dark:text-slate-600' : (hasError ? 'text-rose-500' : warning ? 'text-amber-500' : isOpen ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400')}`} />}
          <span className={`font-black text-[11px] md:text-[13px] truncate transition-colors ${selectedOption ? (hasError ? 'text-rose-600 dark:text-rose-400' : warning ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-200') : 'text-slate-500'}`}>
            {selectedOption ? selectedOption.name : placeholder}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500 dark:text-indigo-400' : ''} ${hasError ? 'text-rose-500 dark:text-rose-400' : warning ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
      </div>

      <div className={`absolute top-[calc(100%+8px)] left-0 w-full bg-white/95 dark:bg-[#121214]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[1.2rem] shadow-xl dark:shadow-[0_15px_40px_-10px_rgba(0,0,0,0.5)] z-[100] overflow-hidden transition-all duration-300 origin-top
        ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
          {options.length === 0 ? (
             <div className="p-4 text-center text-slate-500 text-[11px] font-bold">لا توجد خيارات متاحة</div>
          ) : (
            options.map((opt: any) => {
              const isSelected = opt.id === value;
              return (
                <div
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between p-2.5 px-3 rounded-xl cursor-pointer transition-all duration-200
                    ${isSelected ? 'bg-indigo-600 text-white shadow-md scale-[1.02] border border-indigo-500' : 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/30 text-slate-700 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300'}`}
                >
                  <div className="flex items-center gap-2.5">
                    {Icon && <Icon className={`w-4 h-4 transition-colors ${isSelected ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}`} />}
                    <span className={`text-[11px] md:text-[13px] transition-colors ${isSelected ? 'font-black text-white' : 'font-bold'}`}>
                      {opt.name}
                    </span>
                  </div>
                  {isSelected && <Check className="w-4.5 h-4.5 text-white shrink-0 drop-shadow-sm" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default function RequestsPage() {
  const [isZenMode, setIsZenMode] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [selectedAgency, setSelectedAgency] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [orderDate, setOrderDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedOrderType, setSelectedOrderType] = useState('طلبية يومية');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  const [invoiceWarning, setInvoiceWarning] = useState<string | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isExactDuplicate, setIsExactDuplicate] = useState(false);
  const [hasExistingOrderToday, setHasExistingOrderToday] = useState(false);

  const [orderNotes, setOrderNotes] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const [flyingItems, setFlyingItems] = useState<any[]>([]);
  const [btnPulse, setBtnPulse] = useState(false);

  const [now, setNow] = useState(dayjs());
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { isDark } = useTheme();

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, target: PickerTarget, viewDate: dayjs.Dayjs, mode: 'date' | 'month' | 'year'
  }>({ isOpen: false, target: 'orderDate', viewDate: dayjs(), mode: 'date' });

  const totalOrderedItemsCount = Object.values(quantities).filter(qty => qty > 0).length;

  useEffect(() => {
    if (isHistoryOpen || datePickerConfig.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isHistoryOpen, datePickerConfig.isOpen]);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerAutoCollapse = () => {
    if (!isHeaderCollapsed && selectedAgency && selectedBranch && !editingOrderId && !isExactDuplicate && !invoiceWarning) {
      setIsHeaderCollapsed(true);
    }
  };

  const isMounted = useRef(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (!isMounted.current) {
      isMounted.current = true;
      const draft = localStorage.getItem('pos_draft_cart');
      if (draft) {
        try {
          const { q, a, b, n, d } = JSON.parse(draft);
          if (d === dayjs().format('YYYY-MM-DD')) {
             if (q && Object.keys(q).length > 0) {
                 setQuantities(q);
                 if (a) setSelectedAgency(a);
                 if (b) setSelectedBranch(b);
                 if (n) setOrderNotes(n);
                 setIsDraftRestored(true);
                 setTimeout(() => setIsDraftRestored(false), 5000);
             }
          }
        } catch(e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      if (Object.keys(quantities).length > 0) {
        localStorage.setItem('pos_draft_cart', JSON.stringify({
          q: quantities, a: selectedAgency, b: selectedBranch, n: orderNotes, d: dayjs().format('YYYY-MM-DD')
        }));
      } else if (Object.keys(quantities).length === 0 && !editingOrderId) {
        localStorage.removeItem('pos_draft_cart');
      }
    }
  }, [quantities, selectedAgency, selectedBranch, orderNotes, editingOrderId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 60000); 
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const fetchTimeLimit = dayjs().subtract(12, 'hour').toISOString();

      const { data: agenciesData, error: agError } = await supabase.from('agencies').select('id, name').eq('is_active', true).order('name');
      if (agError) throw new Error("خطأ في جلب الوكالات: " + agError.message);

      const { data: branchesData, error: brError } = await supabase.from('branches').select('id, name, agency_id').order('name');
      if (brError) throw new Error("خطأ في جلب الفروع: " + brError.message);
      
      const { data: itemsData, error: itemsError } = await supabase.from('items').select(`
        id, name, icon, sequence, agency_id,
        initial_unit, primary_unit, main_unit, measurement_type, unit_type,
        packaging_type, packaging_capacity, packaging_unit,
        product_type, storage_type,
        categories(id, name, color, sequence, icon)
      `)
      .eq('is_active', true)
      .order('sequence');
      if (itemsError) throw new Error("خطأ في جلب الأصناف: " + itemsError.message);

      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id, branch_id, status, created_at, notes, order_type, invoice_number,
          branches (id, name, agency_id),
          order_details (id, item_id, quantity, items (id, name, primary_unit, main_unit, agency_id))
        `)
        .gte('created_at', fetchTimeLimit)
        .order('created_at', { ascending: false });

      setAgencies(agenciesData || []);
      setBranches(branchesData || []);
      setItems(itemsData || []); 
      setOrders(ordersData || []);

    } catch (err: any) {
      setDbError(err?.message || "يرجى التأكد من اتصال قاعدة البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const checkDuplicates = async () => {
      setIsCheckingDuplicates(true);
      setInvoiceWarning(null);
      setIsExactDuplicate(false);
      setHasExistingOrderToday(false);

      if (!orderDate || !selectedAgency || !selectedBranch) {
        setIsCheckingDuplicates(false);
        return;
      }
      
      const startOfDay = dayjs(orderDate).startOf('day').toISOString();
      const endOfDay = dayjs(orderDate).endOf('day').toISOString();
      
      const promises = [];
      let newInvoiceWarning = null;
      let exactDuplicateFound = false;
      let anyOrderFound = false;

      let branchQueryAny = supabase
        .from('orders')
        .select('id, order_type')
        .eq('branch_id', selectedBranch)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      if (editingOrderId) branchQueryAny = branchQueryAny.neq('id', editingOrderId);
      
      promises.push(branchQueryAny.then(({data}) => {
         if (data && data.length > 0) {
           anyOrderFound = true; 
           if (data.some(o => o.order_type === selectedOrderType)) {
             exactDuplicateFound = true;
           }
         }
      }));

      if (invoiceNumber.trim()) {
        const validBranchIds = branches.filter(b => b.agency_id === selectedAgency).map(b => b.id);
        if (validBranchIds.length > 0) {
          let invQuery = supabase
            .from('orders')
            .select('id')
            .eq('invoice_number', invoiceNumber.trim())
            .eq('order_type', selectedOrderType) 
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay)
            .in('branch_id', validBranchIds);
          if (editingOrderId) invQuery = invQuery.neq('id', editingOrderId);
          
          promises.push(invQuery.limit(1).maybeSingle().then(({data}) => {
             if (data) {
               newInvoiceWarning = `⚠️ الفاتورة مستخدمة لطلبية (${selectedOrderType}) في الوكالة!`;
             }
          }));
        }
      }

      await Promise.all(promises);
      setInvoiceWarning(newInvoiceWarning);
      setIsExactDuplicate(exactDuplicateFound);
      setHasExistingOrderToday(anyOrderFound);
      setIsCheckingDuplicates(false);

      if (exactDuplicateFound || newInvoiceWarning) {
        setIsHeaderCollapsed(false);
      }
    };

    const timeoutId = setTimeout(checkDuplicates, 500); 
    return () => clearTimeout(timeoutId);
  }, [invoiceNumber, orderDate, editingOrderId, selectedAgency, selectedBranch, selectedOrderType, branches, agencies]);

  const filteredBranches = useMemo(() => {
    if (!selectedAgency) return [];
    return branches.filter(b => b.agency_id === selectedAgency);
  }, [branches, selectedAgency]);

  const groupedItems = useMemo(() => {
    if (!selectedAgency) return [];

    const agencyItems = items.filter(item => item.agency_id === selectedAgency);

    const grouped = agencyItems.reduce((acc: any, item: any) => {
      const catObj = Array.isArray(item.categories) ? item.categories[0] : item.categories;
      
      const catId = catObj?.id || 'unassigned';
      const catName = catObj?.name || 'أخرى (بدون قسم)';
      const catColor = catObj?.color || '#cbd5e1';
      const catSeq = catObj?.sequence ?? 999;
      const catIcon = catObj?.icon || 'Layers';

      if (!acc[catId]) {
        acc[catId] = { name: catName, color: catColor, sequence: catSeq, icon: catIcon, items: [] };
      }
      acc[catId].items.push(item);
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a: any, b: any) => a.sequence - b.sequence)
      .map((cat: any) => ({
        ...cat,
        items: cat.items.sort((a: any, b: any) => (a.sequence ?? 999) - (b.sequence ?? 999))
      }));
  }, [items, selectedAgency]);

  useEffect(() => {
    if (groupedItems.length > 0) {
      if (!selectedCategoryName || !groupedItems.find((c: any) => c.name === selectedCategoryName)) {
        setSelectedCategoryName(groupedItems[0].name);
      }
    } else {
      setSelectedCategoryName(null);
    }
    inputRefs.current = [];
    setFocusedIndex(null);
  }, [groupedItems, selectedCategoryName]);

  const activeCategory = useMemo(() => {
    return groupedItems.find((c: any) => c.name === selectedCategoryName) || groupedItems[0];
  }, [groupedItems, selectedCategoryName]);

  const displayedItems = useMemo(() => {
    let raw = activeCategory ? activeCategory.items : [];
    if (searchQuery) raw = raw.filter((i: any) => i.name.includes(searchQuery));
    return raw;
  }, [activeCategory, searchQuery]);

  const dynamicSizing = useMemo(() => {
    return getDynamicSizing(displayedItems.length);
  }, [displayedItems.length]);

  const handleIncrement = (item: any, e?: React.MouseEvent) => {
    triggerAutoCollapse();
    if (e) {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const isImage = typeof item.icon === 'string' && item.icon.startsWith('http');
      
      const IconCmp = allIconsMap[item.icon] || Package;
      
      const newFlyingItem = {
        id: Date.now() + Math.random(),
        startX: rect.left + rect.width / 2,
        startY: rect.top + rect.height / 2,
        content: isImage ? item.icon : <IconCmp className="w-10 h-10 text-indigo-500 drop-shadow-md" />,
        isImage: isImage
      };
      setFlyingItems(prev => [...prev, newFlyingItem]);
    }
    setQuantities(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  };

  const handleDecrement = (itemId: string, e?: React.MouseEvent) => {
    triggerAutoCollapse();
    if (e) e.stopPropagation();
    setQuantities(prev => {
      const current = prev[itemId] || 0;
      if (current <= 1) {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      }
      return { ...prev, [itemId]: current - 1 };
    });
  };

  const handleQuantityChange = (itemId: string, val: string) => {
    triggerAutoCollapse();
    if (val === '') {
      setQuantities(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
      return;
    }
    
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      if (num === 0) {
        setQuantities(prev => {
          const newState = { ...prev };
          delete newState[itemId];
          return newState;
        });
      } else {
        setQuantities(prev => ({ ...prev, [itemId]: num }));
      }
    }
  };

  const focusInput = (index: number) => {
    triggerAutoCollapse();
    if (inputRefs.current[index]) {
      const inputEl = inputRefs.current[index];
      inputEl?.focus();
      setTimeout(() => inputEl?.select(), 10);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    let cols = 1;
    if (inputRefs.current[0]) {
      const gridEl = inputRefs.current[currentIndex]?.closest('.grid');
      if (gridEl) {
        const gridComputed = window.getComputedStyle(gridEl).getPropertyValue('grid-template-columns');
        cols = gridComputed.split(' ').length || 1;
      }
    }

    if (e.key === 'Enter' || e.key === 'ArrowLeft') {
      e.preventDefault(); 
      inputRefs.current[currentIndex + 1]?.focus();
    } 
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      inputRefs.current[currentIndex - 1]?.focus();
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (inputRefs.current[currentIndex + cols]) {
          inputRefs.current[currentIndex + cols]?.focus();
      }
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (inputRefs.current[currentIndex - cols]) {
          inputRefs.current[currentIndex - cols]?.focus();
      }
    }
  };

  const handleAgencyChange = (agencyId: string) => {
    if (Object.keys(quantities).length > 0 && !window.confirm('تغيير الوكالة سيؤدي لمسح السلة الحالية. هل تود الاستمرار؟')) {
      return;
    }
    setSelectedAgency(agencyId);
    setSelectedBranch(''); 
    setQuantities({}); 
  };

  const resetForm = (requireConfirm = true) => {
    if (requireConfirm && !window.confirm('هل أنت متأكد من مسح كافة بيانات الطلب الحالي؟')) return;
    setQuantities({});
    setOrderNotes('');
    setInvoiceNumber('');
    setSelectedBranch('');
    setSelectedAgency('');
    setSelectedOrderType('طلبية يومية');
    setEditingOrderId(null);
    setIsHeaderCollapsed(false);
    localStorage.removeItem('pos_draft_cart');
  };

  const handleEditClick = (order: any) => {
    setEditingOrderId(order.id);
    setOrderNotes(order.notes || '');
    setInvoiceNumber(order.invoice_number || '');
    setOrderDate(dayjs(order.created_at).format('YYYY-MM-DD'));
    setSelectedOrderType(order.order_type || 'طلبية يومية');

    const newQuantities: Record<string, number> = {};
    let inferredAgencyId = '';

    if (order.order_details && Array.isArray(order.order_details)) {
      order.order_details.forEach((detail: any) => {
        const itemId = detail.item_id || detail.items?.id;
        if (itemId) {
          newQuantities[itemId] = detail.quantity;
          if (!inferredAgencyId && detail.items?.agency_id) {
            inferredAgencyId = detail.items.agency_id;
          }
        }
      });
    }

    setQuantities(newQuantities);
    if (inferredAgencyId) setSelectedAgency(inferredAgencyId);
    setSelectedBranch(order.branch_id || '');
    
    setIsHeaderCollapsed(false); 
    setIsHistoryOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    resetForm(false);
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('هل أنت متأكد من مسح هذه الطلبية نهائياً من السجل الشامل؟')) return;
    try {
      const { error: detailsError } = await supabase.from('order_details').delete().eq('order_id', orderId);
      if (detailsError) throw detailsError;
      
      const { error: orderError } = await supabase.from('orders').delete().eq('id', orderId);
      if (orderError) throw orderError;
      
      alert("تم محو الطلبية بنجاح.");
      await fetchData();
    } catch (error: any) {
      alert("خطأ في محو الطلبية: " + error.message);
    }
  };

  const isDuplicateBlocked = isExactDuplicate;
  const isBtnDisabled = isSaving || totalOrderedItemsCount === 0 || !!invoiceWarning || isDuplicateBlocked;

  const handleSaveOrder = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    
    if (isDuplicateBlocked) {
      return alert(`⚠️ لا يمكن إرسال الطلبية!\n\nالفرع استلم طلبية (${selectedOrderType}) مسبقاً اليوم، يرجى تغيير نوع الطلبية للموافقة.`);
    }

    if (!selectedAgency) return alert("يرجى اختيار الوكالة أولاً.");
    if (!selectedBranch) return alert("يرجى اختيار الفرع.");
    
    if (!invoiceNumber.trim()) return alert("رقم الفاتورة مطلوب لحفظ الطلبية.");
    
    if (invoiceWarning) return alert("يرجى تصحيح رقم الفاتورة أو تغييره. الرقم مدخل مسبقاً.");

    const selectedItems = Object.entries(quantities).filter(([_, qty]) => qty > 0);
    if (selectedItems.length === 0) return alert("يرجى إضافة مادة واحدة على الأقل للطلب.");

    setIsSaving(true);
    try {
      const startOfDay = dayjs(orderDate).startOf('day').toISOString();
      const endOfDay = dayjs(orderDate).endOf('day').toISOString();
      
      let branchCheckQuery = supabase
        .from('orders')
        .select('id')
        .eq('branch_id', selectedBranch)
        .eq('order_type', selectedOrderType) 
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      if (editingOrderId) branchCheckQuery = branchCheckQuery.neq('id', editingOrderId);
      
      const { data: doubleCheckBranch } = await branchCheckQuery.limit(1).maybeSingle();
      if (doubleCheckBranch) {
        setIsSaving(false);
        setIsExactDuplicate(true);
        return alert(`⚠️ تم تسجيل طلبية (${selectedOrderType}) لهذا الفرع من جهاز آخر!\n\nيرجى تغيير نوع الطلبية.`);
      }

      const validBranchIds = branches.filter(b => b.agency_id === selectedAgency).map(b => b.id);
      
      let query = supabase
        .from('orders')
        .select('id')
        .eq('invoice_number', invoiceNumber.trim())
        .eq('order_type', selectedOrderType) 
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .in('branch_id', validBranchIds);

      if (editingOrderId) query = query.neq('id', editingOrderId);
      
      const { data: existingInvoice } = await query.maybeSingle();
      if (existingInvoice) {
        setIsSaving(false);
        const agencyName = agencies.find(a => a.id === selectedAgency)?.name || 'الوكالة';
        setInvoiceWarning(`⚠️ الفاتورة مسجلة مسبقاً لـ (${agencyName}) في تاريخ ${dayjs(orderDate).format('YYYY-MM-DD')}!`);
        return alert(`رقم الفاتورة (${invoiceNumber}) مسجل مسبقاً.`);
      }

      if (editingOrderId) {
        const existingOrder = orders.find(o => o.id === editingOrderId);
        let finalCreatedAt = existingOrder?.created_at;
        
        const inputDate = dayjs(orderDate).format('YYYY-MM-DD');
        const existingDate = dayjs(existingOrder?.created_at).format('YYYY-MM-DD');
        if (inputDate !== existingDate) {
           finalCreatedAt = dayjs(orderDate).hour(dayjs().hour()).minute(dayjs().minute()).toISOString();
        }

        const { error: orderError } = await supabase
          .from('orders')
          .update({
            branch_id: selectedBranch,
            status: 'تم التجهيز', 
            notes: orderNotes,
            invoice_number: invoiceNumber.trim(),
            order_type: selectedOrderType,
            ...(finalCreatedAt ? { created_at: finalCreatedAt } : {})
          })
          .eq('id', editingOrderId);

        if (orderError) throw new Error(orderError.message);

        const { error: deleteError } = await supabase
          .from('order_details')
          .delete()
          .eq('order_id', editingOrderId);
        
        if (deleteError) throw new Error(deleteError.message);

        const detailsPayload = selectedItems.map(([itemId, qty]) => ({
          order_id: editingOrderId,
          item_id: itemId,
          quantity: qty
        }));

        const { error: detailsError } = await supabase.from('order_details').insert(detailsPayload);
        if (detailsError) throw new Error(detailsError.message);

        alert("تم حفظ التعديلات في السجل الشامل بنجاح!");
        setEditingOrderId(null);

      } else {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert([{ 
            branch_id: selectedBranch, 
            status: 'تم التجهيز', 
            notes: orderNotes,
            invoice_number: invoiceNumber.trim(),
            order_type: selectedOrderType,
            created_at: dayjs(orderDate).hour(dayjs().hour()).minute(dayjs().minute()).toISOString()
          }])
          .select()
          .single();

        if (orderError) throw orderError;

        const detailsPayload = selectedItems.map(([itemId, qty]) => ({
          order_id: orderData.id,
          item_id: itemId,
          quantity: qty
        }));

        const { error: detailsError } = await supabase.from('order_details').insert(detailsPayload);
        if (detailsError) throw detailsError;

        alert("تم إرسال الطلبية بنجاح وتحويلها إلى سجل المذكرات والفواتير!");
      }

      setQuantities({});
      setOrderNotes('');
      setInvoiceNumber('');
      setSelectedBranch('');
      setSelectedAgency('');
      setSelectedOrderType('طلبية يومية');
      setIsHeaderCollapsed(false);
      localStorage.removeItem('pos_draft_cart');
      
      await fetchData();
    } catch (error: any) {
      alert("حدث خطأ أثناء الحفظ: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getRemainingTime = (createdAt: string) => {
    const expiresAt = dayjs(createdAt).add(2, 'hour');
    const diff = expiresAt.diff(now);
    if (diff <= 0) return null; 
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `تختفي بعد: ${hours}س و ${mins}د`;
  };

  const activeOrders = orders.filter(order => dayjs(order.created_at).add(2, 'hour').isAfter(now));

  const openDatePicker = (target: PickerTarget, defaultDate: string, defaultMode: 'date' | 'month' = 'date') => {
    setDatePickerConfig({ isOpen: true, target, viewDate: dayjs(defaultDate || dayjs().format('YYYY-MM-DD')), mode: defaultMode });
  };

  const handleDateSelection = (dateStr: string) => {
    if (datePickerConfig.target === 'orderDate') {
      setOrderDate(dateStr);
    }
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`flex flex-col min-h-screen overflow-x-hidden font-sans transition-colors duration-200 ${isZenMode ? 'bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-300' : 'bg-slate-100 dark:bg-[#050505] text-slate-900 dark:text-white'}`} dir="rtl">
        
        {/* 🟢 النافذة المنسدلة (سجل الطلبيات) بتقنية Portal 🟢 */}
        {isClient && createPortal(
          <div className={`${isDark ? 'dark' : ''}`}>
            {/* Overlay */}
            <div 
              className={`fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-[9999999] transition-opacity duration-300 ${isHistoryOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
              onClick={() => setIsHistoryOpen(false)}
            />
            
            {/* Drawer */}
            <div 
              className={`fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-xl rounded-t-[2.5rem] shadow-[0_-15px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_-15px_50px_rgba(0,0,0,0.5)] z-[99999999] transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col border-t border-slate-200 dark:border-white/10 ${isHistoryOpen ? 'translate-y-0' : 'translate-y-full'}`}
              style={{ maxHeight: '85vh', height: 'auto' }}
            >
              <div className="w-full flex justify-center pt-3 pb-1 cursor-pointer" onClick={() => setIsHistoryOpen(false)}>
                <div className="w-16 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
              </div>
              
              <div className="flex justify-between items-center px-6 md:px-8 py-2 border-b border-slate-100 dark:border-white/5 pb-4">
                 <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 dark:bg-[#121214] text-indigo-600 dark:text-indigo-400 p-2.5 rounded-[1.1rem] shadow-sm dark:shadow-inner border border-indigo-100 dark:border-white/5"><ListChecks className="w-5 h-5 md:w-6 md:h-6" /></div>
                    <div>
                       <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">سجل الإدخالات</h2>
                       <p className="text-[10px] md:text-[11px] font-bold text-slate-500 mt-0.5">يظهر هنا الطلبيات الأخيرة للمراجعة أو التعديل.</p>
                    </div>
                 </div>
                 <button onClick={() => setIsHistoryOpen(false)} className="bg-slate-100 dark:bg-[#121214] hover:bg-slate-200 dark:hover:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 p-2.5 rounded-full transition-colors outline-none">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              
              <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar pb-10">
                 {activeOrders.length === 0 ? (
                   <div className="bg-slate-50/60 dark:bg-[#121214]/60 rounded-[2rem] p-10 md:p-14 text-center text-slate-500 border border-slate-200 dark:border-white/5 border-dashed">
                     <Package className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 opacity-30" />
                     <p className="text-sm md:text-base font-black tracking-tight">لا توجد طلبات مسجلة مؤخراً.</p>
                     <p className="text-[10px] md:text-xs font-bold mt-1 opacity-70">عند إرسال طلبية، ستظهر هنا للمراجعة.</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 max-w-[120rem] mx-auto">
                     {activeOrders.map((order) => {
                       const remainingTime = getRemainingTime(order.created_at);
                       const orderTypeData = ORDER_TYPES.find(t => t.id === order.order_type) || ORDER_TYPES[0];
                       
                       return (
                         <div key={order.id} className={"bg-white dark:bg-[#121214] p-4 rounded-[1.5rem] shadow-sm border flex flex-col gap-3.5 transition-all duration-300 hover:shadow-md hover:-translate-y-1 " + (editingOrderId === order.id ? "border-amber-400 dark:border-amber-500/50 ring-4 ring-amber-100 dark:ring-amber-500/10 shadow-md shadow-amber-500/20" : "border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20")}>
                           <div className="flex justify-between items-start">
                             <div className="flex items-center gap-3">
                               <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 shadow-inner flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                                 <Store className="w-5 h-5" />
                               </div>
                               <div>
                                 <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-200 mb-1 leading-tight tracking-tight">{order.branches?.name || 'فرع غير محدد'}</h3>
                                 <div className="flex items-center gap-1.5 flex-wrap">
                                   {order.invoice_number && (
                                     <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border bg-slate-50 dark:bg-[#050505] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 en-num dir-ltr shadow-sm">
                                       #{order.invoice_number}
                                     </span>
                                   )}
                                   <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border flex items-center gap-1 shadow-sm ${orderTypeData.bg} ${orderTypeData.color} border-transparent`}>
                                     {orderTypeData.label}
                                   </span>
                                 </div>
                               </div>
                             </div>
                             <div className="text-[10px] font-black text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#050505] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/5 en-num text-center min-w-[60px] shadow-inner">
                               {dayjs(order.created_at).format('hh:mm A')}
                               <div className="text-orange-500 dark:text-orange-400 mt-1 text-[8px] animate-pulse font-bold">{remainingTime}</div>
                             </div>
                           </div>

                           <div className="bg-slate-50 dark:bg-[#050505]/80 border border-slate-200 dark:border-white/5 rounded-xl p-2.5 shadow-inner">
                             <div className="max-h-28 overflow-y-auto custom-scrollbar pr-1">
                               <table className="w-full text-right">
                                 <tbody>
                                   {order.order_details?.map((detail: any, idx: number) => {
                                     return (
                                       <tr key={detail.id} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                         <td className="py-1.5 font-bold text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1.5">
                                           <span className="text-[9px] text-slate-400 dark:text-slate-500 w-3">{idx + 1}.</span> {detail.items?.name || 'محذوفة'}
                                         </td>
                                         <td className="py-1.5 text-left font-black text-slate-800 dark:text-slate-300 text-[12px] en-num dir-ltr">
                                           <span className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 px-2 py-0.5 rounded-md shadow-sm dark:shadow-inner">{detail.quantity}</span>
                                         </td>
                                       </tr>
                                     )
                                   })}
                                 </tbody>
                               </table>
                             </div>
                             {order.notes && (
                               <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-white/5 flex items-start gap-1.5 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-lg border border-amber-200 dark:border-amber-500/20">
                                 <AlertCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                                 <span className="text-[10px] font-bold text-amber-700 dark:text-amber-200 leading-snug">{order.notes}</span>
                               </div>
                             )}
                           </div>

                           <div className="flex gap-2 mt-auto pt-1">
                             <button onClick={() => handleEditClick(order)} disabled={editingOrderId === order.id} className="flex-1 bg-white dark:bg-[#050505] border border-amber-300 dark:border-amber-500/30 py-2 rounded-xl text-amber-600 dark:text-amber-400 font-black flex items-center justify-center gap-1.5 text-[11px] hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-400 dark:hover:border-amber-500/50 disabled:opacity-50 transition-all duration-300 shadow-sm dark:shadow-inner outline-none">
                               <Edit className="w-3.5 h-3.5" /> تعديل
                             </button>
                             <button onClick={() => handleDeleteOrder(order.id)} className="flex-1 bg-white dark:bg-[#050505] border border-rose-300 dark:border-rose-500/30 py-2 rounded-xl text-rose-600 dark:text-rose-400 font-black flex items-center justify-center gap-1.5 text-[11px] hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-400 dark:hover:border-rose-500/50 transition-all duration-300 shadow-sm dark:shadow-inner outline-none">
                               <Trash2 className="w-3.5 h-3.5" /> حذف
                             </button>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}
              </div>
            </div>
          </div>,
          document.body
        )}
        
        {flyingItems.map(flyItem => (
          <FlyingEmoji 
            key={flyItem.id} item={flyItem} targetRef={sendBtnRef} 
            onComplete={(id: number) => {
              setFlyingItems(prev => prev.filter(i => i.id !== id));
              setBtnPulse(true);
              setTimeout(() => setBtnPulse(false), 250); 
            }} 
          />
        ))}

        {/* 🟢 الهيدر صار جزء من التسلسل الطبيعي (مو ثابت) 🟢 */}
        <div className={`w-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isHeaderCollapsed ? 'pt-2 pb-0' : 'pt-3 pb-2'} ${isZenMode ? 'hidden' : 'block'}`}>
          <div className="max-w-[120rem] mx-auto px-2 md:px-4">
            
            <div className={`bg-white dark:bg-[#121214] rounded-[1.5rem] shadow-sm dark:shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10 relative transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isHeaderCollapsed ? 'mb-1' : 'mb-3'}`}>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 md:p-4 gap-3 z-20 relative bg-white dark:bg-[#121214] rounded-t-[1.5rem] rounded-b-[1.5rem]">
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Link href="/hub" title="الرئيسية (لوحة التحكم)" className="shrink-0 flex items-center justify-center p-2 md:p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 dark:from-indigo-600 dark:to-blue-700 text-white rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all outline-none border border-indigo-400/50 group">
                    <LayoutGrid className="w-5 h-5 md:w-6 md:h-6 group-hover:-rotate-12 transition-transform" />
                  </Link>

                  <button 
                    onClick={() => window.location.href='/logout'} 
                    title="تسجيل الخروج" 
                    className="shrink-0 flex items-center justify-center p-2 md:p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl shadow-sm dark:shadow-inner hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all outline-none border border-rose-200 dark:border-rose-500/30 group ml-2"
                  >
                    <LogOut className="w-5 h-5 md:w-6 md:h-6 group-hover:-translate-x-1 transition-transform" />
                  </button>

                  <button 
                    onClick={() => setIsHistoryOpen(true)}
                    className="shrink-0 flex items-center justify-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 rounded-xl text-slate-700 dark:text-slate-300 transition-all outline-none relative group"
                  >
                    <ListChecks className="w-4 h-4 md:w-5 md:h-5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] md:text-[13px] font-black hidden sm:inline">سجل الطلبيات</span>
                    {activeOrders.length > 0 && (
                      <span className="absolute -top-1.5 -left-1.5 bg-rose-500 text-white text-[9px] md:text-[10px] font-black px-1.5 min-w-[1.25rem] h-5 rounded-full flex items-center justify-center shadow-sm border border-white/10">
                        {activeOrders.length}
                      </span>
                    )}
                  </button>

                  <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 p-2 md:p-2.5 rounded-xl text-slate-500 dark:text-slate-400 shadow-sm dark:shadow-inner shrink-0 relative hidden md:block">
                    <ClipboardList className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-3 w-3 border-2 border-white dark:border-[#121214] ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    </span>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">بوابة الكاشير الذكية</h2>
                      <span className={`text-[8px] md:text-[9px] font-black px-1.5 py-0.5 rounded-md border flex items-center gap-1 transition-colors shadow-sm dark:shadow-inner ${
                        isOnline ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 animate-pulse'
                      }`}>
                        {isOnline ? <><Wifi className="w-2.5 h-2.5" /> متصل</> : <><WifiOff className="w-2.5 h-2.5" /> محلي</>}
                      </span>
                    </div>
                    <p className="text-[9px] md:text-[10px] font-bold text-slate-500 mt-0.5">نظام الإدخال السريع (POS)</p>
                  </div>

                  {editingOrderId && (
                    <div className="mr-auto md:mr-4 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5 animate-pulse border border-amber-200 dark:border-amber-500/20 shadow-sm dark:shadow-inner">
                      <Edit className="w-3.5 h-3.5" /> وضع التعديل
                    </div>
                  )}
                  
                  <button onClick={() => setIsZenMode(true)} className="mr-auto md:mr-0 p-2 md:p-2.5 bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors outline-none hidden md:flex items-center justify-center shadow-sm">
                    <Eye className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center bg-slate-50 dark:bg-[#050505] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner w-full md:w-auto">
                   <Search className="w-4 h-4 ml-2 text-slate-400 shrink-0" />
                   <input 
                     type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
                     placeholder="ابحث عن صنف..." 
                     onFocus={() => setIsHeaderCollapsed(false)} 
                     className="h-9 md:h-11 flex-1 md:w-40 xl:w-48 bg-transparent pr-1 outline-none font-bold text-[10px] md:text-[11px] text-slate-700 dark:text-slate-300 text-right focus:bg-white dark:focus:bg-white/5 focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all duration-300 placeholder:text-slate-400 dark:placeholder:text-slate-600" 
                   />
                   <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1.5 shrink-0"></div>

                   <button type="button" onClick={() => resetForm(true)} title="تفريغ السلة بالكامل" className="w-9 h-9 md:w-11 md:h-11 shrink-0 bg-white dark:bg-[#121214] text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/30 border border-slate-200 dark:border-white/5 rounded-xl font-bold flex items-center justify-center transition-all duration-300 shadow-sm dark:shadow-inner ml-1 outline-none">
                     <Trash2 className="w-4 h-4 md:w-4 md:h-4" />
                   </button>

                   {editingOrderId && (
                     <button type="button" onClick={cancelEdit} className="px-3 h-9 md:h-11 text-rose-600 dark:text-rose-400 bg-white dark:bg-[#121214] hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl font-black flex items-center justify-center gap-1 text-[10px] transition-all duration-300 shrink-0 shadow-sm dark:shadow-inner ml-1 border border-slate-200 dark:border-white/5 outline-none">
                       <X className="w-3.5 h-3.5" /> إلغاء
                     </button>
                   )}
                   <button 
                     ref={sendBtnRef}
                     type="button" onClick={handleSaveOrder} disabled={isBtnDisabled || !isOnline} 
                     title={!isOnline ? "لا يمكن الإرسال بدون إنترنت (محفوظ كمسودة)" : ""}
                     className={`group flex items-center justify-center gap-1.5 h-9 md:h-11 px-4 md:px-6 rounded-xl font-black text-[11px] md:text-[13px] transition-all duration-300 ml-1 outline-none ${
                       isBtnDisabled || !isOnline
                       ? "bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-600 cursor-not-allowed" 
                       : "bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white shadow-md hover:shadow-lg border border-indigo-400/30"
                     } ${btnPulse && isOnline ? "scale-[1.03] shadow-lg shadow-indigo-400/50" : ""}`}
                   >
                     <span>{isSaving ? 'جاري...' : (editingOrderId ? 'تعديل' : 'إرسال')}</span>
                     {!isSaving && !editingOrderId && <Send className="w-3.5 h-3.5 md:w-4 md:h-4 transform rotate-180" />}
                     {!isSaving && editingOrderId && <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                     {isSaving && <Loader2 className="animate-spin w-3.5 h-3.5 md:w-4 md:h-4" />}
                     
                     {totalOrderedItemsCount > 0 && !isBtnDisabled && isOnline && (
                       <span className={`bg-black/20 dark:bg-black/30 text-white px-2 py-0.5 rounded-lg text-[9px] md:text-[10px] en-num mr-1 transition-all shadow-inner ${btnPulse ? "bg-white text-indigo-600" : ""}`}>{totalOrderedItemsCount}</span>
                     )}
                   </button>
                </div>
              </div>

              <div className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-visible relative z-10 ${isHeaderCollapsed ? 'max-h-0 opacity-0 hidden' : 'max-h-[500px] opacity-100 border-t border-slate-200 dark:border-white/10'}`}>
                <div className="p-3 md:p-4 bg-slate-50/50 dark:bg-[#050505]/50 rounded-b-[1.5rem]">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    
                    {/* اختيار الوكالة والفرع */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#121214] p-2.5 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row gap-2.5 shadow-sm">
                      <CustomSelect 
                        value={selectedAgency} 
                        onChange={handleAgencyChange} 
                        options={agencies} 
                        placeholder="-- اختر الوكالة --" 
                        icon={Building2} 
                        disabled={false}
                      />
                      <CustomSelect 
                        value={selectedBranch} 
                        onChange={setSelectedBranch} 
                        options={filteredBranches} 
                        placeholder={selectedAgency ? "-- اختر الفرع --" : "انتظر الوكالة"} 
                        icon={Store} 
                        disabled={!selectedAgency} 
                        hasError={isDuplicateBlocked}
                        warning={hasExistingOrderToday && !isExactDuplicate}
                      />
                    </div>

                    <div className="lg:col-span-4 bg-white dark:bg-[#121214] p-2.5 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row gap-2.5 shadow-sm">
                      <input 
                        type="text" 
                        value={invoiceNumber} 
                        onChange={(e) => setInvoiceNumber(e.target.value)} 
                        required disabled={!selectedAgency} placeholder="رقم الفاتورة..."
                        className={"flex-1 border px-4 py-2 outline-none font-black text-slate-900 dark:text-slate-200 rounded-xl text-right text-[11px] md:text-[13px] transition-all duration-300 en-num h-11 shadow-sm dark:shadow-inner " + (invoiceWarning ? "border-rose-400 dark:border-rose-500/50 focus:border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 focus:ring-4 focus:ring-rose-500/20" : "bg-slate-50 dark:bg-[#050505] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus:bg-white dark:focus:bg-[#121214] focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 placeholder-slate-400 dark:placeholder-slate-600")}
                      />
                      
                      <div onClick={() => openDatePicker('orderDate', orderDate, 'date')} className="flex-1 bg-slate-50 dark:bg-[#050505] rounded-xl border border-slate-200 dark:border-white/10 flex items-center px-4 hover:border-slate-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-[#121214] transition-all duration-300 cursor-pointer group h-11 shadow-sm dark:shadow-inner relative focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-400 dark:focus-within:border-indigo-500/50 focus-within:bg-white dark:focus-within:bg-[#121214]">
                        <CalendarClock className="w-4.5 h-4.5 text-slate-500 ml-2 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className={"font-black text-[11px] md:text-[13px] dir-ltr text-right mt-0.5 " + (orderDate ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-600")}>
                          {orderDate ? dayjs(orderDate).format('YYYY-MM-DD') : 'التاريخ'}
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-4 bg-slate-50 dark:bg-[#050505] p-2 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shadow-sm dark:shadow-inner">
                      {ORDER_TYPES.slice(0, 5).map((type) => {
                        const isSelected = selectedOrderType === type.id;
                        return (
                          <button
                            key={type.id} type="button" onClick={() => setSelectedOrderType(type.id)}
                            className={`flex-1 min-w-[70px] md:min-w-[80px] py-1.5 px-1 flex flex-col items-center justify-center gap-1 rounded-xl text-[9px] md:text-[11px] font-black transition-all duration-300 outline-none ${
                              isSelected 
                              ? "bg-white dark:bg-[#121214] text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200 dark:ring-white/10 scale-100 transform" 
                              : "text-slate-500 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-300 scale-[0.97]"
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg ${isSelected ? type.bg + ' ' + type.color + ' border ' + type.border : 'bg-transparent text-slate-400 dark:text-slate-600 border border-transparent'}`}>
                              {type.icon}
                            </div>
                            <span className="leading-none mt-0.5">{type.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {(invoiceWarning || isExactDuplicate || (hasExistingOrderToday && !isDuplicateBlocked)) && (
                    <div className="flex flex-col gap-1.5 mt-3 border-t border-slate-200 dark:border-white/5 pt-3">
                      {invoiceWarning && (
                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold text-[10px] md:text-[11px] bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/20 w-fit shadow-sm dark:shadow-inner">
                          <AlertCircle className="w-4 h-4 shrink-0" /> <span>{invoiceWarning}</span>
                        </div>
                      )}
                      {isExactDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold text-[10px] md:text-[11px] bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/20 w-fit animate-in fade-in slide-in-from-top-1 shadow-sm dark:shadow-inner">
                          <AlertTriangle className="w-4 h-4 shrink-0" /> <span>⚠️ الفرع مسجل له طلبية ({selectedOrderType}) اليوم! يرجى اختيار نوع آخر للموافقة.</span>
                        </div>
                      )}
                      {hasExistingOrderToday && !isExactDuplicate && (
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-[10px] md:text-[11px] bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/20 w-fit animate-in fade-in slide-in-from-top-1 shadow-sm dark:shadow-inner">
                          <Check className="w-4 h-4 shrink-0" /> <span>ملاحظة: سيتم تسجيل هذه الطلبية كملحق إضافي للفرع لهذا اليوم.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-visible relative z-10 ${isHeaderCollapsed ? 'max-h-[60px] opacity-100 -mt-2 pb-3' : 'max-h-0 opacity-0 m-0 p-0 hidden'}`}>
                 <div className="flex items-center gap-3 md:gap-5 flex-wrap bg-white dark:bg-[#121214] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 shadow-md px-5 py-2 rounded-full cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" onClick={() => setIsHeaderCollapsed(false)}>
                   <span className="flex items-center gap-1.5 text-[11px] font-black"><Building2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/> {agencies.find(a => a.id === selectedAgency)?.name || 'الوكالة'}</span>
                   <span className="text-slate-300 dark:text-slate-700">|</span>
                   <span className="flex items-center gap-1.5 text-[11px] font-black"><Store className="w-4 h-4 text-emerald-500 dark:text-emerald-400"/> {branches.find(b => b.id === selectedBranch)?.name || 'الفرع'}</span>
                   <span className="text-slate-300 dark:text-slate-700">|</span>
                   <span className="flex items-center gap-1.5 text-[11px] font-black en-num dir-ltr"><Hash className="w-4 h-4 text-fuchsia-500 dark:text-fuchsia-400"/> {invoiceNumber}</span>
                   <span className="text-slate-300 dark:text-slate-700">|</span>
                   <span className="flex items-center gap-1.5 text-[11px] font-black en-num dir-ltr"><CalendarClock className="w-4 h-4 text-amber-500 dark:text-amber-400"/> {dayjs(orderDate).format('YYYY-MM-DD')}</span>
                   <span className="text-slate-300 dark:text-slate-700">|</span>
                   <span className="text-[11px] font-black text-sky-500 dark:text-sky-400">{selectedOrderType}</span>
                 </div>
              </div>

              <div className={`absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-300 ${isHeaderCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <button 
                  onClick={() => setIsHeaderCollapsed(true)} 
                  title="طي التفاصيل"
                  className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 shadow-md rounded-full w-16 h-7 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white transition-all duration-300 cursor-pointer group outline-none"
                >
                   <ChevronUp className="w-4.5 h-4.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>

            {/* 🟢 شريط الأقسام (Categories) صار Scrollable بالموبايل 🟢 */}
            <div className={`pt-2 pb-1 flex items-center justify-between gap-4 px-1 ${isZenMode ? 'hidden' : 'flex'}`}>
              <div className="flex overflow-x-auto hide-scrollbar gap-2.5 flex-1 w-full pb-2 px-1">
                {!selectedAgency ? (
                  <div className="text-slate-400 dark:text-slate-600 font-bold text-[11px] w-full px-1 py-1">يرجى اختيار الوكالة لعرض أقسام المواد...</div>
                ) : (
                  groupedItems.map((category: any) => {
                    const totalItemsCount = category.items.length;
                    const activeItemsCount = category.items.filter((item: any) => (quantities[item.id] || 0) > 0).length;
                    const isSelected = selectedCategoryName === category.name;
                    
                    const IconCmp = allIconsMap[category.icon] || Layers;

                    return (
                      <button
                        key={category.name} type="button" onClick={() => setSelectedCategoryName(category.name)}
                        className={`shrink-0 flex items-center gap-2 px-3.5 py-2 md:px-5 md:py-2.5 rounded-[1.1rem] font-black text-[11px] md:text-[13px] transition-all duration-300 border outline-none ${
                          isSelected 
                          ? "bg-white dark:bg-[#121214] text-slate-900 dark:text-white border-slate-300 dark:border-white/20 shadow-md dark:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.5)] ring-2 ring-slate-200 dark:ring-white/10 scale-[1.03] z-10" 
                          : activeItemsCount > 0 
                          ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 shadow-sm hover:shadow-md hover:-translate-y-0.5" 
                          : "bg-slate-100 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-[#121214] shadow-sm hover:shadow hover:-translate-y-0.5"
                        }`}
                      >
                        <span className="text-base md:text-lg leading-none filter drop-shadow-sm flex items-center justify-center">
                          {typeof IconCmp === 'function' || typeof IconCmp === 'object' ? <IconCmp className="w-5 h-5 md:w-6 md:h-6" /> : IconCmp}
                        </span>
                        <span className="leading-none mt-0.5 tracking-tight">{category.name}</span>
                        
                        <div className={`px-2 py-0.5 rounded-lg text-[10px] md:text-[11px] leading-none flex items-center gap-1 shrink-0 font-black ml-1 shadow-inner border en-num dir-ltr ${
                          isSelected 
                          ? "bg-slate-100 dark:bg-black/50 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white" 
                          : activeItemsCount > 0
                          ? "bg-indigo-100 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                          : "bg-slate-200 dark:bg-[#050505] border-slate-300 dark:border-white/5 text-slate-500 dark:text-slate-600"
                        }`}>
                          <span className={activeItemsCount > 0 ? (isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-400") : "opacity-60"}>{activeItemsCount}</span>
                          <span className="opacity-40 text-[9px] -mt-0.5">/</span>
                          <span className={isSelected ? "opacity-90" : "opacity-70"}>{totalItemsCount}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              
              <div className="shrink-0 flex bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-xl p-1 shadow-sm dark:shadow-inner h-[46px] items-center mb-1">
                <button 
                  onClick={() => setViewMode('grid')} 
                  className={`p-2 rounded-lg transition-all outline-none ${viewMode === 'grid' ? 'bg-indigo-500 dark:bg-indigo-600 text-white shadow-md dark:shadow-[0_0_10px_rgba(79,70,229,0.5)]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="عرض شبكي"
                >
                  <LayoutGrid className="w-4 h-4"/>
                </button>
                <button 
                  onClick={() => setViewMode('list')} 
                  className={`p-2 rounded-lg transition-all outline-none ${viewMode === 'list' ? 'bg-indigo-500 dark:bg-indigo-600 text-white shadow-md dark:shadow-[0_0_10px_rgba(79,70,229,0.5)]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="عرض قائمة"
                >
                  <List className="w-4 h-4"/>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* 🟢 حاوية المواد صارت تمتد على راحتها بدل السكرول الداخلي 🟢 */}
        <div className="flex-1 w-full p-2 md:p-4 pb-32 md:pb-40">
          <div className={`max-w-[120rem] mx-auto ${isZenMode ? 'mt-4' : ''}`}>
            
            {isDraftRestored && (
              <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 mb-3 animate-in fade-in slide-in-from-top-4 border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">
                <Check className="w-4 h-4" /> <span>تم استعادة مسودة طلبيتك السابقة بنجاح!</span>
              </div>
            )}

            {!selectedAgency ? (
              <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 opacity-60 h-[40vh]">
                <Sparkles className="w-14 h-14 mb-3 drop-shadow-sm" />
                <p className="text-base font-black tracking-tight">الشاشة جاهزة لاستقبال الطلبات</p>
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="text-center text-rose-500/80 font-bold py-12 text-sm flex flex-col items-center justify-center h-[40vh] gap-3">
                <Package className="w-14 h-14 opacity-30" />
                لا توجد مواد مضافة لهذا القسم.
              </div>
            ) : (
              viewMode === 'list' ? (
                <div className="flex flex-col gap-3">
                  {displayedItems.map((item: any, index: number) => {
                    const qty = quantities[item.id] || 0;
                    const isFocused = focusedIndex === index;
                    const displayMainUnit = item.main_unit && item.main_unit !== '-' ? item.main_unit : (item.primary_unit || 'بدون');
                    const colors = getQtyColors(qty, isFocused);
                    
                    const ItemIconCmp = allIconsMap[item.icon] || Package;

                    return (
                      <div 
                        key={item.id} 
                        onClick={() => focusInput(index)}
                        className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 md:p-4 rounded-[1.2rem] transition-all duration-300 cursor-text relative gap-4 ${colors.wrapper}`}
                      >
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                           <div className={`flex items-center justify-center shrink-0 transition-all duration-300 aspect-square w-12 h-12 text-3xl ${colors.iconBg}`}>
                              {item.icon && typeof item.icon === 'string' && item.icon.startsWith('http') ? (
                                <img src={item.icon} alt={item.name} className="w-full h-full object-contain p-1 drop-shadow-sm" />
                              ) : (
                                <ItemIconCmp className="w-6 h-6" />
                              )}
                           </div>
                           <div className="flex flex-col min-w-0">
                             <h4 className={`font-black break-words tracking-tighter transition-colors text-lg ${colors.title}`}>
                               {item.name}
                             </h4>
                             <span className={`font-bold truncate mt-0.5 transition-colors text-xs ${colors.subtitle}`}>
                               {item.product_type || 'جاف'} • {displayMainUnit}
                             </span>
                           </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                           <div className={`flex transition-opacity opacity-0 group-hover:opacity-100 flex-row gap-1`} dir="ltr">
                              <button type="button" onClick={(e) => { e.stopPropagation(); triggerAutoCollapse(); setQuantities(prev => ({...prev, [item.id]: (prev[item.id] || 0) + 5})); }} className={`font-black bg-white/90 dark:bg-[#121214]/90 backdrop-blur-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-md transition-all duration-200 shadow-sm border border-slate-200 dark:border-white/10 outline-none px-2 py-1 text-xs`}>+5</button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); triggerAutoCollapse(); setQuantities(prev => ({...prev, [item.id]: (prev[item.id] || 0) + 10})); }} className={`font-black bg-white/90 dark:bg-[#121214]/90 backdrop-blur-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-md transition-all duration-200 shadow-sm border border-slate-200 dark:border-white/10 outline-none px-2 py-1 text-xs`}>+10</button>
                           </div>
                           
                           <div className={`flex items-center justify-between p-1 rounded-[0.8rem] transition-colors duration-300 w-[140px] md:w-[160px] shrink-0 ${colors.capsuleBg}`} dir="ltr">
                             <button type="button" onClick={(e) => handleDecrement(item.id, e)} className={`shrink-0 flex items-center justify-center rounded-[0.6rem] transition-colors bg-transparent outline-none h-10 w-10 ${colors.btnText}`}>
                               <Minus className="w-5 h-5" />
                             </button>
                             
                             <input 
                               ref={(el) => { inputRefs.current[index] = el; }}
                               type="number" min="0" step="any" value={qty || ''} 
                               onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                               onKeyDown={(e) => handleInputKeyDown(e, index)}
                               onFocus={(e) => { triggerAutoCollapse(); setFocusedIndex(index); setTimeout(() => e.target.select(), 10); }} 
                               onBlur={() => setFocusedIndex(null)}
                               placeholder="0"
                               className={`qty-input flex-1 min-w-0 w-full text-center bg-transparent outline-none transition-all duration-300 h-10 text-xl ${colors.input} placeholder-slate-400 dark:placeholder-slate-600`}
                             />
                             
                             <button type="button" onClick={(e) => handleIncrement(item, e)} className={`shrink-0 flex items-center justify-center rounded-[0.6rem] transition-colors bg-transparent outline-none h-10 w-10 ${colors.btnText}`}>
                               <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
                             </button>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`grid ${dynamicSizing.gridCols}`}>
                  {displayedItems.map((item: any, index: number) => {
                    const qty = quantities[item.id] || 0;
                    const isFocused = focusedIndex === index;
                    const displayMainUnit = item.main_unit && item.main_unit !== '-' ? item.main_unit : (item.primary_unit || 'بدون');
                    const colors = getQtyColors(qty, isFocused);
                    
                    const ItemIconCmp = allIconsMap[item.icon] || Package;

                    return (
                      <div 
                        key={item.id} 
                        onClick={() => focusInput(index)}
                        className={`group flex flex-col h-full rounded-[1.2rem] transition-all duration-300 cursor-text relative ${dynamicSizing.cardPadding} ${colors.wrapper}`}
                      >
                        <div className={`absolute z-10 flex transition-opacity ${dynamicSizing.quickAddClass}`} dir="ltr">
                           <button type="button" onClick={(e) => { e.stopPropagation(); triggerAutoCollapse(); setQuantities(prev => ({...prev, [item.id]: (prev[item.id] || 0) + 5})); }} className={`font-black bg-white/90 dark:bg-[#121214]/90 backdrop-blur-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-md transition-all duration-200 shadow-sm border border-slate-200 dark:border-white/10 outline-none ${dynamicSizing.quickAddBtn}`}>+5</button>
                           <button type="button" onClick={(e) => { e.stopPropagation(); triggerAutoCollapse(); setQuantities(prev => ({...prev, [item.id]: (prev[item.id] || 0) + 10})); }} className={`font-black bg-white/90 dark:bg-[#121214]/90 backdrop-blur-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white rounded-md transition-all duration-200 shadow-sm border border-slate-200 dark:border-white/10 outline-none ${dynamicSizing.quickAddBtn}`}>+10</button>
                        </div>

                        <div className={`flex flex-col items-center justify-center flex-1 px-1 text-center ${dynamicSizing.gapInner}`}>
                          <div className={`flex items-center justify-center shrink-0 transition-all duration-300 aspect-square ${dynamicSizing.iconSize} ${colors.iconBg}`}>
                            {item.icon && typeof item.icon === 'string' && item.icon.startsWith('http') ? (
                              <img src={item.icon} alt={item.name} className="w-full h-full object-contain p-1 drop-shadow-sm" />
                            ) : (
                              <ItemIconCmp className="w-5 h-5 md:w-6 md:h-6" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 w-full items-center mt-1.5">
                            <h4 className={`font-black break-words tracking-tighter transition-colors px-1 ${dynamicSizing.titleSize} ${colors.title}`}>
                              {item.name}
                            </h4>
                            <span className={`font-bold truncate mt-0.5 transition-colors ${dynamicSizing.subTitleSize} ${colors.subtitle}`}>
                              {item.product_type || 'جاف'} • {displayMainUnit}
                            </span>
                          </div>
                        </div>
                        
                        <div className={`flex items-center justify-between w-full p-1 mt-auto rounded-[0.8rem] transition-colors duration-300 ${colors.capsuleBg}`} dir="ltr">
                          <button type="button" onClick={(e) => handleDecrement(item.id, e)} className={`shrink-0 flex items-center justify-center rounded-[0.6rem] transition-colors bg-transparent outline-none ${dynamicSizing.btnHeight} ${dynamicSizing.btnWidth} ${colors.btnText}`}>
                            <Minus className="w-4 h-4 md:w-4.5 md:h-4.5" />
                          </button>
                          
                          <input 
                            ref={(el) => { inputRefs.current[index] = el; }}
                            type="number" min="0" step="any" value={qty || ''} 
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            onKeyDown={(e) => handleInputKeyDown(e, index)}
                            onFocus={(e) => { triggerAutoCollapse(); setFocusedIndex(index); setTimeout(() => e.target.select(), 10); }} 
                            onBlur={() => setFocusedIndex(null)}
                            placeholder="0"
                            className={`qty-input flex-1 min-w-0 w-full text-center bg-transparent outline-none transition-all duration-300 ${dynamicSizing.btnHeight} ${dynamicSizing.inputSize} ${colors.input} placeholder-slate-400 dark:placeholder-slate-600`}
                          />
                          
                          <button type="button" onClick={(e) => handleIncrement(item, e)} className={`shrink-0 flex items-center justify-center rounded-[0.6rem] transition-colors bg-transparent outline-none ${dynamicSizing.btnHeight} ${dynamicSizing.btnWidth} ${colors.btnText}`}>
                            <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {isZenMode && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-bottom-10 fade-in duration-500 no-print">
            <button 
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-6 py-3.5 rounded-full font-black text-sm shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all outline-none"
            >
              <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

        {/* 🟢 النافذة المنبثقة للتقويم بتقنية Portal 🟢 */}
        {isClient && datePickerConfig.isOpen && !isZenMode && createPortal(
          <div className={`fixed inset-0 z-[9999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 font-sans ${isDark ? 'dark' : ''}`} dir="rtl">
            <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] shadow-2xl dark:shadow-[0_0_50px_rgba(20,184,166,0.15)] animate-in zoom-in-95 duration-300">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-white/5 pb-5">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors outline-none">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black transition-colors outline-none ${datePickerConfig.mode === 'month' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num transition-colors outline-none ${datePickerConfig.mode === 'year' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-300'}`}
                   >
                     {datePickerConfig.viewDate.format('YYYY')}
                   </button>
                </div>

                <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors outline-none">
                  <ChevronLeft className="w-5 h-5"/>
                </button>
              </div>

              {datePickerConfig.mode === 'year' && (
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const year = datePickerConfig.viewDate.year() - 7 + i;
                    const isSelected = datePickerConfig.viewDate.year() === year;
                    return (
                      <button
                        key={year}
                        onClick={() => {
                          const newDate = datePickerConfig.viewDate.year(year);
                          setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'month'}));
                        }}
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none ${isSelected ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
                      >
                        {year}
                      </button>
                    )
                  })}
                </div>
              )}

              {datePickerConfig.mode === 'month' && (
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const isSelected = datePickerConfig.viewDate.month() === i;
                    const monthName = dayjs().month(i).format('MMMM');
                    const monthNum = String(i + 1).padStart(2, '0');
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          const newDate = datePickerConfig.viewDate.month(i);
                          setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'date'}));
                        }}
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 flex flex-col items-center gap-1.5 outline-none ${isSelected ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
                      >
                        <span>{monthName}</span>
                        <span className="text-[10px] en-num opacity-50 font-bold">{monthNum}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {datePickerConfig.mode === 'date' && (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-3">
                    {WEEK_DAYS.map(d => (
                      <div key={d} className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: datePickerConfig.viewDate.startOf('month').day() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: datePickerConfig.viewDate.daysInMonth() }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = datePickerConfig.viewDate.date(dayNum).format('YYYY-MM-DD');
                      const isSelected = dateStr === orderDate;
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDateSelection(dateStr)}
                          className={`
                            aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num transition-all active:scale-95 outline-none
                            ${isSelected ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' :
                              isToday ? 'text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10' :
                              'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-transparent'}
                          `}
                        >
                          {dayNum}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <button onClick={() => setDatePickerConfig(p => ({...p, isOpen: false}))} className="w-full mt-6 py-4 bg-slate-50 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-2xl font-black text-[15px] transition-colors border border-transparent outline-none">
                إلغاء
              </button>
            </div>
          </div>,
          document.body
        )}
        
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          
          input:focus:not(.qty-input) {
             box-shadow: inset 0 2px 4px rgba(0,0,0,0.02), 0 0 0 4px rgba(99, 102, 241, 0.1) !important;
          }
          .qty-input:focus {
             box-shadow: none !important;
             outline: none !important;
          }
          .en-num { font-family: system-ui, -apple-system, sans-serif; }
        `}} />
      </div>
    </div>
  );
}