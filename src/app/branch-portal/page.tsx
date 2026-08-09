"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from 'sonner'; 
import { 
  Store, Loader2, Search, Plus, Minus, 
  ShoppingCart, Send, Clock, History, LayoutGrid, 
  Package, Soup, Sandwich, UtensilsCrossed, Beef, CupSoda, Pizza, Layers, CalendarClock, LogOut, FileText, List, MapPin, User, Lock, ChevronDown, ClipboardCheck, Sun, Moon, Eye, EyeOff, CheckCircle2, ChefHat, X, Trash2, Hash, MonitorPlay
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

let globalAudioCtx: any = null;

const initAudioContext = () => {
  if (!globalAudioCtx) {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      globalAudioCtx = new AudioContext();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume();
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('click', initAudioContext, { once: true });
  window.addEventListener('touchstart', initAudioContext, { once: true });
}

const playAlertSound = () => {
  try {
    if (!globalAudioCtx) return;
    if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
    
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = globalAudioCtx.createOscillator();
      const gain = globalAudioCtx.createGain();
      osc.connect(gain);
      gain.connect(globalAudioCtx.destination);
      
      osc.type = 'sine'; 
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = globalAudioCtx.currentTime;
    playTone(880.00, now, 0.4);       
    playTone(1046.50, now + 0.15, 0.6); 
  } catch (err) {
    console.log("Audio play blocked by browser", err);
  }
};

const getCategoryIcon = (name: string) => {
  if (!name) return <Layers className="w-5 h-5" />;
  const lower = name.toLowerCase();
  if (lower.includes('صوص') || lower.includes('sauce')) return <Soup className="w-5 h-5" />;
  if (lower.includes('مقبلات') || lower.includes('appetizer') || lower.includes('فرايز')) return <UtensilsCrossed className="w-5 h-5" />;
  if (lower.includes('ساندويش') || lower.includes('sandwich') || lower.includes('بركر') || lower.includes('وجبات')) return <Sandwich className="w-5 h-5" />;
  if (lower.includes('تقطيع') || lower.includes('cutting') || lower.includes('لحم')) return <Beef className="w-5 h-5" />;
  if (lower.includes('مشروب') || lower.includes('عصير') || lower.includes('بيبسي')) return <CupSoda className="w-5 h-5" />;
  if (lower.includes('بيتزا') || lower.includes('معجنات')) return <Pizza className="w-5 h-5" />;
  return <Layers className="w-5 h-5" />;
};

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

const getQtyColorsList = (qty: number, isFocused: boolean) => {
  if (qty === 0) return {
     wrapper: isFocused 
       ? "bg-slate-100 dark:bg-[#1e1e2d] border-2 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.4)] scale-[1.02] z-30" 
       : "bg-white dark:bg-gradient-to-r dark:from-[#121214] dark:to-[#1a1a24] border border-slate-200 dark:border-white/10 shadow-sm hover:border-indigo-500/50 hover:shadow-md hover:-translate-y-0.5 z-10 transition-all duration-300",
     capsuleBg: "bg-slate-50 dark:bg-[#050505]/80 border border-slate-200 dark:border-white/10 group-hover:border-indigo-500/30 shadow-inner",
     input: "text-slate-900 dark:text-slate-200 font-black text-xl md:text-2xl group-hover:text-indigo-600 dark:group-hover:text-white transition-colors",
     btnText: "text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:text-white hover:border-indigo-400 hover:bg-indigo-50 transition-all",
     title: "text-slate-800 dark:text-slate-200 font-black group-hover:text-indigo-600 dark:group-hover:text-white transition-colors tracking-wide",
     subtitle: "text-slate-500 font-bold group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors",
     iconBg: "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 group-hover:text-white group-hover:border-indigo-400 group-hover:bg-indigo-500/30 rounded-2xl shadow-sm transition-all duration-300",
  };
  
  return { 
     wrapper: `bg-emerald-50 dark:bg-gradient-to-r dark:from-emerald-950/30 dark:to-emerald-900/40 border-2 ${isFocused ? 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)] scale-[1.02] z-30 ring-2 ring-emerald-500/20' : 'border-emerald-400 dark:border-emerald-500/60 shadow-sm hover:-translate-y-0.5 z-10 transition-all duration-300'}`, 
     capsuleBg: "bg-white dark:bg-[#050505]/60 border border-emerald-200 dark:border-emerald-500/40 shadow-inner", 
     input: "text-emerald-700 dark:text-emerald-400 font-black drop-shadow-md text-xl md:text-2xl", 
     btnText: "text-emerald-600 dark:text-emerald-100 bg-emerald-100 dark:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/50 hover:text-white hover:bg-emerald-500 transition-all", 
     title: "text-emerald-800 dark:text-emerald-300 font-black tracking-wide", 
     subtitle: "text-emerald-600 dark:text-emerald-500/80 font-bold", 
     iconBg: `rounded-2xl ${isFocused ? 'bg-emerald-500 text-white shadow-md' : 'bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-200'} transition-all duration-300`,
  };
};

const getQtyColorsGrid = (qty: number, isFocused: boolean) => {
  if (qty === 0) return {
     wrapper: isFocused 
       ? "bg-white dark:bg-[#1e1e2d] border-2 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.4)] scale-[1.05] z-30" 
       : "bg-white dark:bg-gradient-to-b dark:from-[#1a1a24] dark:to-[#121214] border border-slate-200 dark:border-slate-600/60 shadow-sm hover:border-indigo-400 hover:shadow-md hover:-translate-y-1 z-10 transition-all duration-300",
     capsuleBg: "bg-slate-50 dark:bg-[#050505]/80 border border-slate-200 dark:border-slate-700 shadow-inner",
     input: "text-slate-900 dark:text-white font-black text-xl drop-shadow-md",
     btnText: "text-slate-500 dark:text-slate-200 bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 hover:text-white hover:border-indigo-400 hover:bg-indigo-500 transition-all",
     title: "text-slate-800 dark:text-slate-100 font-black group-hover:text-indigo-600 dark:group-hover:text-white transition-colors tracking-wide",
     subtitle: "text-slate-500 dark:text-slate-400 font-bold group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors",
     iconBg: "bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-500 text-slate-500 dark:text-slate-200 group-hover:text-white group-hover:bg-indigo-500 rounded-[1rem] shadow-sm transition-all duration-300",
  };
  
  return { 
     wrapper: `bg-emerald-50 dark:bg-gradient-to-b dark:from-emerald-900/40 dark:to-emerald-950/20 border-2 ${isFocused ? 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)] scale-[1.05] z-30 ring-2 ring-emerald-500/20' : 'border-emerald-400 dark:border-emerald-500/60 shadow-sm hover:-translate-y-1 z-10 transition-all duration-300'}`, 
     capsuleBg: "bg-white dark:bg-[#050505]/60 border border-emerald-200 dark:border-emerald-500/40 shadow-inner", 
     input: "text-emerald-700 dark:text-emerald-400 font-black drop-shadow-md", 
     btnText: "text-emerald-600 dark:text-emerald-100 bg-emerald-100 dark:bg-emerald-600/30 border border-emerald-300 dark:border-emerald-500/50 hover:text-white hover:bg-emerald-50 transition-all", 
     title: "text-emerald-800 dark:text-emerald-300 font-black tracking-wide", 
     subtitle: "text-emerald-600 dark:text-emerald-500/80 font-bold", 
     iconBg: `rounded-[1rem] ${isFocused ? 'bg-emerald-500 text-white shadow-md' : 'bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-200'} transition-all duration-300`,
  };
};

const getDynamicSizingGrid = (count: number) => {
  if (count <= 12) {
    return { gridCols: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-2.5 sm:gap-3", cardPadding: "p-2.5 md:p-3", iconSize: "w-10 h-10 md:w-12 md:h-12 text-2xl md:text-3xl", titleSize: "text-[14px] md:text-[18px] leading-none", subTitleSize: "text-[9px] md:text-[11px]", btnHeight: "h-8 md:h-10", btnWidth: "w-8 md:w-10", inputSize: "text-base md:text-xl", gapInner: "gap-1 md:gap-1.5 mb-1.5 md:mb-2 mt-0.5" };
  } else if (count <= 30) { 
    return { gridCols: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-2.5", cardPadding: "p-2 md:p-2.5", iconSize: "w-8 h-8 md:w-10 md:h-10 text-xl md:text-2xl", titleSize: "text-[13px] md:text-[16px] leading-none", subTitleSize: "text-[9px] md:text-[10px]", btnHeight: "h-7 md:h-8", btnWidth: "w-7 md:w-8", inputSize: "text-sm md:text-base font-black", gapInner: "gap-1 md:gap-1.5 mb-1.5 md:mb-2 mt-0.5 md:mt-1" };
  } else {
    return { gridCols: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9 gap-1.5 md:gap-2", cardPadding: "p-1.5 md:p-1.5", iconSize: "w-6 h-6 md:w-8 md:h-8 text-lg", titleSize: "text-[11px] md:text-[14px] leading-none line-clamp-1", subTitleSize: "hidden", btnHeight: "h-6 md:h-7", btnWidth: "w-6 md:w-7", inputSize: "text-xs md:text-sm font-bold", gapInner: "gap-0.5 mb-1 mt-0.5" };
  }
};

const FlyingEmoji = ({ item, targetRef, onComplete }: any) => {
  const [pos, setPos] = useState({ x: item.startX, y: item.startY, opacity: 1, scale: 1.5 });
  useEffect(() => {
    if (!targetRef?.current) { onComplete(item.id); return; }
    const targetRect = targetRef.current.getBoundingClientRect();
    const timer = setTimeout(() => { setPos({ x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2, opacity: 0.1, scale: 0.3 }); }, 20);
    const completeTimer = setTimeout(() => { onComplete(item.id); }, 450); 
    return () => { clearTimeout(timer); clearTimeout(completeTimer); };
  }, [item, targetRef, onComplete]);
  return <div className="fixed z-[99999] pointer-events-none flex items-center justify-center text-4xl drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" style={{ left: pos.x, top: pos.y, opacity: pos.opacity, transform: `translate(-50%, -50%) scale(${pos.scale})`, transition: 'all 450ms cubic-bezier(0.25, 1, 0.5, 1)' }}>{item.emoji}</div>;
};

// ============================================================
// --- 🌟 الصفحة الرئيسية للبوابة 🌟 ---
// ============================================================

export default function BranchPortalPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [isInitializing, setIsInitializing] = useState(true);
  const [branch, setBranch] = useState<any>(null);
  const [portalSettings, setPortalSettings] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [totalOrders, setTotalOrders] = useState(0); 
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [allBranchesForAdmin, setAllBranchesForAdmin] = useState<any[]>([]);
  const [allPendingOrders, setAllPendingOrders] = useState<any[]>([]);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'history' | 'approvals'>('menu');
  
  const [isListView, setIsListView] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [senderName, setSenderName] = useState('');
  const [orderHistory, setOrderHistory] = useState<any[]>([]);

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sendBtnRef = useRef<HTMLButtonElement>(null);
  const [flyingItems, setFlyingItems] = useState<any[]>([]);

  const [isZenMode, setIsZenMode] = useState(false);

  // ذاكرة التتبع المحلية لالتقاط الحذف الخفي
  const orderHistoryRef = useRef<any[]>([]);
  useEffect(() => {
    orderHistoryRef.current = orderHistory;
  }, [orderHistory]);

  const totalOrderedItemsCount = Object.values(quantities).filter(qty => qty > 0).length;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('update-portal-badges', { 
        detail: { cart: totalOrderedItemsCount, approvals: isAdmin ? allPendingOrders.length : 0, history: totalOrders } 
      }));
    }
  }, [totalOrderedItemsCount, allPendingOrders.length, totalOrders, isAdmin]);

  // 💡 التزامن السريع للتبويبات (مستمع الحدث الجديد) 💡
  useEffect(() => {
    const handleTabChange = (e: any) => {
      if (e.detail && ['menu', 'cart', 'history', 'approvals'].includes(e.detail)) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('change-tab', handleTabChange);

    const hash = window.location.hash.replace('#', '');
    if (['menu', 'cart', 'history', 'approvals'].includes(hash)) setActiveTab(hash as any);

    return () => window.removeEventListener('change-tab', handleTabChange);
  }, []);

  const navigateTab = (tabId: 'menu' | 'cart' | 'history' | 'approvals') => {
    setActiveTab(tabId);
    window.location.hash = tabId;
  };

  useEffect(() => {
    const init = async () => {
      const savedView = localStorage.getItem('portal_view_mode');
      if (savedView === 'grid') setIsListView(false);

      const session = localStorage.getItem('erp_session');
      if (!session) {
        window.location.replace('/login');
        return;
      }
      
      const parsedSession = JSON.parse(session);
      const allowedAdmins = ['Admin', 'AsstManager', 'Accountant'];
      const isUserAdmin = allowedAdmins.includes(parsedSession.role);
      setIsAdmin(isUserAdmin);

      if (isUserAdmin) {
        const { data: branches } = await supabase.from('branches').select('*').order('name');
        if (branches && branches.length > 0) {
          setAllBranchesForAdmin(branches);
          setBranch(branches[0]);
          await loadPortalData(branches[0], true);
        }
      } else {
        let branchIdToLoad = null;
        const cookieStr = typeof document !== 'undefined' ? document.cookie.split('; ').find(row => row.startsWith('user_session=')) : null;
        if (cookieStr) {
          try {
            const sessionData = JSON.parse(decodeURIComponent(cookieStr.split('=')[1]));
            if (sessionData.type === 'branch') branchIdToLoad = sessionData.id;
          } catch(e) {}
        }
        
        if (branchIdToLoad) {
          const { data } = await supabase.from('branches').select('*').eq('id', branchIdToLoad).maybeSingle();
          if (data) {
            setBranch(data);
            await loadPortalData(data, false); 
          }
        } else {
           const { data } = await supabase.from('branches').select('*').eq('name', parsedSession.name).maybeSingle();
           if (data) {
             setBranch(data);
             await loadPortalData(data, false);
           }
        }
      }
      setIsInitializing(false);
    };
    init();
  }, []);

  const loadPortalData = async (branchData: any, isUserAdmin: boolean) => {
    let itemsQuery = supabase.from('items').select('*, categories(id, name, color, sequence)');
    if (branchData.agency_id) itemsQuery = itemsQuery.eq('agency_id', branchData.agency_id);

    const promises: any[] = [
      supabase.from('order_portal_settings').select('*').maybeSingle(),
      itemsQuery,
      supabase.from('branch_orders').select('*').eq('branch_id', branchData.id).order('created_at', { ascending: false }).limit(15),
      supabase.from('branch_orders').select('id', { count: 'exact' }).eq('branch_id', branchData.id) 
    ];

    if (branchData.agency_id) {
      promises.push(supabase.from('agencies').select('name').eq('id', branchData.agency_id).maybeSingle());
    }

    const [settingsRes, itemsRes, historyRes, countRes, agencyRes] = await Promise.all(promises);

    if (settingsRes.data) setPortalSettings(settingsRes.data);
    if (historyRes.data) setOrderHistory(historyRes.data);
    
    if (countRes && countRes.count !== null) {
      setTotalOrders(countRes.count);
    }
    
    if (agencyRes?.data) {
      setBranch((prev: any) => ({ ...prev, agency_name: agencyRes.data.name }));
    }
    
    if (itemsRes.data) {
      const uniqueItems: any[] = [];
      const seenNames = new Set();
      for (const item of itemsRes.data) {
        const cleanName = (item.name || '').trim();
        if (!seenNames.has(cleanName)) {
          seenNames.add(cleanName);
          uniqueItems.push(item);
        }
      }
      setItems(uniqueItems);
    }

    // 💡 حماية: جلب الاعتمادات فقط للإدارة 💡
    if (isUserAdmin) {
      fetchPendingApprovals();
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const { data } = await supabase
        .from('branch_orders')
        .select('*, branches (name, agency_id, agencies(name))')
        .eq('status', 'قيد المراجعة')
        .order('created_at', { ascending: true });
      
      setAllPendingOrders(data || []);
    } catch (err) {
      console.error("Error fetching approvals:", err);
    }
  };

  useEffect(() => {
    if (!branch) return;

    const channel = supabase.channel('realtime_portal_approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branch_orders' }, (payload: any) => {
        
        const isDeletedFromMyHistory = payload.eventType === 'DELETE' && orderHistoryRef.current.some(o => o.id === payload.old?.id);
        const isMyBranch = (payload.new?.branch_id === branch.id) || isDeletedFromMyHistory;
        
        if (isMyBranch) {
            if (payload.eventType === 'UPDATE' && payload.new?.status !== payload.old?.status) {
                playAlertSound(); 

                const invoice = payload.new.invoice_number || 'بدون رقم';
                const newStatus = payload.new.status;

                if (newStatus === 'معتمد') {
                    toast.success(`تم اعتماد طلبيتك #${invoice}`, { description: 'الطلبية الآن قيد التجهيز في المطبخ 👨‍🍳', duration: 6000 });
                } else if (newStatus === 'تم التجهيز') {
                    toast.success(`طلبيتك #${invoice} جاهزة!`, { description: 'تم تجهيز الطلبية بالكامل وجاهزة للاستلام ✅', duration: 6000 });
                } else if (newStatus === 'مرفوض' || newStatus === 'ملغى') {
                    toast.error(`إلغاء الطلبية #${invoice}`, { description: 'تم إلغاء/رفض طلبيتك، يرجى مراجعة الإدارة ❌', duration: 6000 });
                }
            } 
            else if (payload.eventType === 'DELETE') {
                playAlertSound();
                toast.error(`تم حذف طلبية من سجلك`, { description: 'قامت الإدارة بحذف إحدى الطلبيات نهائياً 🗑️', duration: 6000 });
            }

            supabase.from('branch_orders').select('*').eq('branch_id', branch.id).order('created_at', { ascending: false }).limit(15).then(res => {
              if(res.data) setOrderHistory(res.data);
            });
            supabase.from('branch_orders').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id).then(res => {
              if(res.count !== null) setTotalOrders(res.count);
            });
        }
        
        if (isAdmin) fetchPendingApprovals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [branch, isAdmin]);

  const handleDeleteMyOrder = async (order: any) => {
    if (!isAdmin && order.status !== 'قيد المراجعة') return; 
    
    if (!window.confirm('هل أنت متأكد من إلغاء وحذف هذه الطلبية نهائياً؟\nسيتم إزالتها من السجلات بالكامل.')) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('branch_orders').delete().eq('id', order.id);
      if (error) throw error;
      
      if (isAdmin && order.invoice_number) {
         await supabase.from('orders').delete().eq('invoice_number', order.invoice_number);
      }
      
      setOrderHistory(prev => prev.filter(o => o.id !== order.id));
      setTotalOrders(prev => prev > 0 ? prev - 1 : 0);
      toast.success('تم الإلغاء', { description: 'تم حذف الطلبية بنجاح.' });
    } catch (err: any) {
      console.error("Delete Error:", err);
      alert(`حدث خطأ أثناء الحذف:\n\n${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (isAdmin) {
      window.location.replace('/hub');
    } else {
      if (window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
        await supabase.auth.signOut();
        localStorage.removeItem('erp_session');
        sessionStorage.clear();
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }
        window.location.replace('/login');
      }
    }
  };

  const toggleViewMode = () => {
    const newMode = !isListView;
    setIsListView(newMode);
    localStorage.setItem('portal_view_mode', newMode ? 'list' : 'grid');
  };

  const isPortalOpen = useMemo(() => {
    if (!portalSettings) return true; 
    if (portalSettings.status === 'مفتوح دائم') return true;
    if (portalSettings.status === 'مغلق') return false;
    if (portalSettings.status === 'مجدول') {
      const nowTime = dayjs().format('HH:mm');
      return nowTime >= portalSettings.open_time && nowTime <= portalSettings.close_time;
    }
    return true;
  }, [portalSettings]);

  const groupedItems = useMemo(() => {
    const grouped = items.reduce((acc: any, item: any) => {
      const catId = item.categories?.id || 'unassigned';
      const catName = item.categories?.name || 'أخرى';
      const catSeq = item.categories?.sequence ?? 999;
      if (!acc[catId]) acc[catId] = { name: catName, sequence: catSeq, items: [] };
      acc[catId].items.push(item);
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => a.sequence - b.sequence).map((cat: any) => ({
      ...cat, items: cat.items.sort((a: any, b: any) => (a.sequence ?? 999) - (b.sequence ?? 999))
    }));
  }, [items]);

  useEffect(() => {
    if (groupedItems.length > 0 && (!selectedCategoryName || !groupedItems.find((c: any) => c.name === selectedCategoryName))) {
      setSelectedCategoryName(groupedItems[0].name);
    }
    inputRefs.current = []; setFocusedIndex(null);
  }, [groupedItems, selectedCategoryName]);

  const activeCategory = useMemo(() => groupedItems.find((c: any) => c.name === selectedCategoryName) || groupedItems[0], [groupedItems, selectedCategoryName]);
  
  const displayedItems = useMemo(() => {
    let raw = activeCategory ? activeCategory.items : [];
    if (searchQuery) raw = raw.filter((i: any) => i.name.includes(searchQuery));
    return raw;
  }, [activeCategory, searchQuery]);

  const dynamicSizingGrid = useMemo(() => getDynamicSizingGrid(displayedItems.length), [displayedItems.length]);

  const handleIncrement = (item: any, e?: React.MouseEvent) => {
    if (!isPortalOpen) return alert('البوابة مغلقة حالياً.');
    if (e) {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setFlyingItems(prev => [...prev, { id: Date.now() + Math.random(), startX: rect.left + rect.width / 2, startY: rect.top + rect.height / 2, emoji: getItemEmoji(item.name) }]);
    }
    setQuantities(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  };

  const handleDecrement = (itemId: string, e?: React.MouseEvent) => {
    if (!isPortalOpen) return;
    if (e) e.stopPropagation();
    setQuantities(prev => {
      const current = prev[itemId] || 0;
      if (current <= 1) { const newState = { ...prev }; delete newState[itemId]; return newState; }
      return { ...prev, [itemId]: current - 1 };
    });
  };

  const handleQuantityChange = (itemId: string, val: string) => {
    if (!isPortalOpen) return;
    if (val === '') { setQuantities(prev => { const n = { ...prev }; delete n[itemId]; return n; }); return; }
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      if (num === 0) setQuantities(prev => { const n = { ...prev }; delete n[itemId]; return n; });
      else setQuantities(prev => ({ ...prev, [itemId]: num }));
    }
  };

  const submitOrder = async () => {
    if (!isPortalOpen) return alert('عذراً، البوابة مغلقة حالياً.');
    if (Object.keys(quantities).length === 0) return alert('السلة فارغة.');
    if (!senderName.trim()) return alert('يرجى كتابة اسم مُرسل الطلبية أولاً.'); 

    setIsSubmitting(true);
    try {
      const itemsPayload = Object.entries(quantities).filter(([_, q]) => q > 0).map(([itemId, qty]) => {
        const itemObj = items.find(i => i.id === itemId);
        return { item_id: itemId, name: itemObj?.name || 'مجهول', category: itemObj?.categories?.name || 'عام', unit: itemObj?.unit || 'قطعة', qty };
      });

      const finalNotes = senderName.trim() ? `مُرسل الطلب: ${senderName.trim()}\n${orderNotes}` : orderNotes;

      const invoiceNum = `BR-${dayjs().format('MMDD')}-${Math.floor(Math.random() * 1000)}`;

      const { error } = await supabase.from('branch_orders').insert([{ 
        branch_id: branch.id, 
        items: itemsPayload, 
        status: 'قيد المراجعة', 
        notes: finalNotes, 
        order_date: dayjs().format('YYYY-MM-DD'),
        invoice_number: invoiceNum 
      }]);
      
      if (error) throw error;

      alert('تم إرسال طلبيتك للمطبخ المركزي بنجاح وبانتظار الاعتماد!');
      setQuantities({}); setOrderNotes(''); setSenderName('');
      window.dispatchEvent(new CustomEvent('change-tab', { detail: 'history' }));
      window.location.hash = 'history';
      await loadPortalData(branch, isAdmin);
    } catch (err: any) {
      console.error("Supabase Insert Error:", err);
      alert(`حدث خطأ أثناء إرسال الطلبية:\n\n${err.message || JSON.stringify(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isInitializing) return <div className={`fixed inset-0 flex items-center justify-center p-4 ${isDark ? 'bg-[#050505]' : 'bg-slate-50'}`}><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>;

  if (!branch) return (
    <div className={`fixed inset-0 flex flex-col items-center justify-center p-4 text-center ${isDark ? 'bg-[#050505]' : 'bg-slate-50'}`}>
      <Store className="w-16 h-16 text-slate-400 dark:text-slate-600 mb-4 opacity-50" />
      <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">عذراً، لا يمكن الوصول لهذه الشاشة</h3>
      <p className="text-slate-500 dark:text-slate-400 font-bold text-sm max-w-sm mb-6 leading-relaxed">
        هذه الشاشة مخصصة لحسابات (مدراء الفروع).<br/> لم يتم العثور على بيانات فرع مرتبطة بحسابك الحالي أو أن قاعدة البيانات لا تحتوي على فروع.
      </p>
      <Link href="/login" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition-colors">
        العودة لتسجيل الدخول
      </Link>
    </div>
  );

  return (
    <div className={isDark ? 'dark' : ''}>
      <style dangerouslySetInnerHTML={{__html: `
        html, body { overscroll-behavior-y: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .qty-input:focus { box-shadow: none !important; outline: none !important; }
        .en-num { font-family: system-ui, -apple-system, sans-serif; }
      `}} />
      
      <div className={`fixed inset-0 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white font-sans transition-colors duration-500 ${isZenMode ? 'pt-4' : ''}`} dir="rtl">
        
        {/* ======================= (الهيدر المدمج) ======================= */}
        {!isZenMode && (
          <div className="bg-white dark:bg-[#0a0a0c] z-50 border-b border-slate-200 dark:border-white/5 shadow-sm shrink-0 w-full flex flex-col">
            <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between max-w-5xl mx-auto w-full gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isAdmin ? (
                  <div className="relative shrink-0 w-full sm:w-[220px]">
                    <select 
                      value={branch?.id || ''} 
                      onChange={async (e) => {
                        const selected = allBranchesForAdmin.find(b => b.id === e.target.value);
                        if (selected) {
                          setIsInitializing(true);
                          setBranch(selected);
                          await loadPortalData(selected, true);
                          setQuantities({});
                          setIsInitializing(false);
                        }
                      }}
                      className="w-full text-[14px] md:text-[15px] font-black text-indigo-700 dark:text-white bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-400/20 rounded-lg px-3 py-1.5 pl-8 outline-none appearance-none cursor-pointer transition-colors shadow-sm truncate"
                    >
                      {allBranchesForAdmin.map(b => (
                        <option key={b.id} value={b.id} className="bg-white dark:bg-[#121214] text-slate-900 dark:text-white font-bold">{b.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 dark:text-indigo-400 pointer-events-none" />
                    <div className="absolute -top-2 -right-1 bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-md font-black shadow-sm z-10 border border-white dark:border-[#0a0a0c] flex items-center gap-0.5"><Lock className="w-2 h-2"/> إدمن</div>
                  </div>
                ) : (
                  <h2 className="text-[15px] md:text-[17px] font-black text-slate-900 dark:text-white leading-none drop-shadow-sm truncate shrink-0">{branch.name}</h2>
                )}
                
                <div className="flex items-center flex-wrap gap-2 text-[10px] md:text-[11px] font-bold mt-1.5">
                  {(branch.agency_name || branch.agency) && (
                     <span className="bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/5 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-md shadow-sm">
                       {branch.agency_name || branch.agency}
                     </span>
                  )}
                  <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 bg-white dark:bg-[#121214] px-2 py-1 rounded-md border border-slate-200 dark:border-white/5 shadow-sm">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0" />
                    {branch.location || branch.address || branch.city || branch.name}
                  </span>
                  
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-md border shadow-sm ${!isPortalOpen ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                    {!isPortalOpen ? (
                      <><Clock className="w-3.5 h-3.5"/> مغلقة</>
                    ) : (
                      <><span className="w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-ping block"></span> نشط</>
                    )}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setIsZenMode(true)} title="وضع التركيز" className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all outline-none hidden md:flex">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={toggleViewMode} title={isListView ? "التبديل إلى عرض الشبكة" : "التبديل إلى عرض القائمة"} className="p-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 shadow-inner hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition-all outline-none">
                  {isListView ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                </button>
                <button onClick={handleLogout} title="رجوع / تسجيل خروج" className="p-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 shadow-inner hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg transition-all outline-none">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 💡 شريط الأزرار الخاص بمدير النظام 💡 */}
            {isAdmin && (
              <div className="px-3 sm:px-4 pb-3 pt-1 w-full max-w-2xl mx-auto">
                <div className="bg-slate-100 dark:bg-[#121214] p-1.5 rounded-[1.2rem] flex items-center justify-between w-full shadow-inner border border-slate-200 dark:border-white/5 gap-1">
                  
                  <button onClick={() => navigateTab('menu')} className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2 rounded-[1rem] transition-all outline-none ${activeTab === 'menu' ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/5'}`}>
                    <LayoutGrid className="w-4 h-4 md:w-4.5 md:h-4.5" />
                    <span className="text-[10px] md:text-[12px] font-black">الأصناف</span>
                  </button>

                  <button onClick={() => navigateTab('approvals')} className={`relative flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2 rounded-[1rem] transition-all outline-none ${activeTab === 'approvals' ? 'bg-white dark:bg-white/10 text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200/50 dark:border-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/5'}`}>
                    <div className="relative">
                      <ClipboardCheck className="w-4 h-4 md:w-4.5 md:h-4.5" />
                      {allPendingOrders.length > 0 && <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[8px] font-black min-w-[14px] h-[14px] flex items-center justify-center rounded-full border border-white dark:border-[#121214] shadow-sm en-num">{allPendingOrders.length}</span>}
                    </div>
                    <span className="text-[10px] md:text-[12px] font-black">الاعتمادات</span>
                  </button>

                  <button onClick={() => navigateTab('cart')} className={`relative flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2 rounded-[1rem] transition-all outline-none ${activeTab === 'cart' ? 'bg-white dark:bg-white/10 text-violet-600 dark:text-violet-400 shadow-sm border border-slate-200/50 dark:border-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/5'}`}>
                    <div className="relative">
                      <ShoppingCart className="w-4 h-4 md:w-4.5 md:h-4.5" />
                      {totalOrderedItemsCount > 0 && <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-black min-w-[14px] h-[14px] flex items-center justify-center rounded-full border border-white dark:border-[#121214] shadow-sm en-num">{totalOrderedItemsCount}</span>}
                    </div>
                    <span className="text-[10px] md:text-[12px] font-black">السلة</span>
                  </button>

                  <button onClick={() => navigateTab('history')} className={`relative flex-1 flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 py-2 rounded-[1rem] transition-all outline-none ${activeTab === 'history' ? 'bg-white dark:bg-white/10 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200/50 dark:border-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/5'}`}>
                    <div className="relative">
                      <History className="w-4 h-4 md:w-4.5 md:h-4.5" />
                      {totalOrders > 0 && <span className="absolute -top-1.5 -right-2 bg-sky-500 text-white text-[8px] font-black min-w-[14px] h-[14px] flex items-center justify-center rounded-full border border-white dark:border-[#121214] shadow-sm en-num">{totalOrders}</span>}
                    </div>
                    <span className="text-[10px] md:text-[12px] font-black">سجلي</span>
                  </button>

                </div>
              </div>
            )}

          </div>
        )}

        {flyingItems.map(flyItem => <FlyingEmoji key={flyItem.id} item={flyItem} targetRef={sendBtnRef} onComplete={(id: number) => setFlyingItems(prev => prev.filter(i => i.id !== id))} />)}

        {/* ======================= (الأصناف - Menu) ======================= */}
        {activeTab === 'menu' && (
          <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-300">
            
            <div className={`shrink-0 bg-white dark:bg-[#0a0a0c] z-30 w-full pt-2 pb-2 border-b border-slate-200 dark:border-white/5 shadow-sm ${isZenMode ? 'rounded-t-[2.5rem] mt-2' : ''}`}>
              <div className="max-w-4xl mx-auto px-4">
                
                <div className="relative mb-2 group/search">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within/search:text-indigo-500 dark:group-focus-within/search:text-indigo-400 transition-colors" />
                  <input type="text" placeholder="ابحث عن صنف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 font-bold px-3 pr-9 py-2.5 rounded-xl focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 text-[12px] shadow-inner transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                </div>

                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 pt-1">
                  {groupedItems.map((category: any) => {
                    const activeCount = category.items.filter((item: any) => (quantities[item.id] || 0) > 0).length;
                    const totalItems = category.items.length;
                    const isSelected = selectedCategoryName === category.name;
                    
                    return (
                      <button key={category.name} onClick={() => setSelectedCategoryName(category.name)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-[12px] transition-all duration-300 border shrink-0 outline-none group ${
                          isSelected 
                          ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)] ring-2 ring-indigo-500/20 scale-[1.02]" 
                          : activeCount > 0 
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 shadow-inner" 
                          : "bg-white dark:bg-[#121214] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white shadow-sm"
                        }`}
                      >
                        <span className="drop-shadow-sm">{getCategoryIcon(category.name)}</span>
                        <span className="flex items-center gap-1">
                          {category.name}
                          <span className={`text-[9px] en-num ${isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-400'}`}>({totalItems})</span>
                        </span>
                        {activeCount > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[9px] en-num font-black ml-1 transition-colors shadow-sm ${isSelected ? "bg-white text-indigo-600" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"}`}>{activeCount}</span>}
                      </button>
                    );
                  })}
                </div>

              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 pb-[140px] bg-slate-50 dark:bg-[#050505]">
              <div className="max-w-4xl mx-auto">
                {displayedItems.length === 0 ? (
                  <div className="text-center text-indigo-400/50 dark:text-indigo-300/50 font-bold py-12 flex flex-col items-center justify-center h-full bg-white dark:bg-[#121214] rounded-3xl border border-slate-200 dark:border-white/5 border-dashed shadow-sm"><Package className="w-12 h-12 opacity-30 mb-2" />لا توجد أصناف تطابق البحث</div>
                ) : (
                  <div className={isListView ? "flex flex-col gap-3 md:gap-4" : `grid ${dynamicSizingGrid.gridCols}`}>
                    {displayedItems.map((item: any, index: number) => {
                      const qty = quantities[item.id] || 0;
                      const isFocused = focusedIndex === index;
                      const colors = isListView ? getQtyColorsList(qty, isFocused) : getQtyColorsGrid(qty, isFocused);

                      if (isListView) {
                        return (
                          <div key={item.id} onClick={() => { if(isPortalOpen) { inputRefs.current[index]?.focus(); } }} className={`group flex items-center justify-between p-3.5 md:p-4 rounded-[1.2rem] md:rounded-[1.5rem] transition-all duration-300 cursor-text relative ${colors.wrapper}`}>
                            <div className="flex items-center gap-4 flex-1 min-w-0 pl-3">
                              <div className={`flex items-center justify-center shrink-0 w-14 h-14 md:w-16 md:h-16 text-3xl md:text-4xl aspect-square transition-all duration-300 ${colors.iconBg}`}>
                                <span className="drop-shadow-sm leading-none">{getItemEmoji(item.name)}</span>
                              </div>
                              <div className="flex flex-col min-w-0 text-right">
                                <h4 className={`font-black truncate transition-colors text-[16px] md:text-[18px] ${colors.title}`} title={item.name}>{item.name}</h4>
                                <span className={`font-bold truncate mt-1 transition-colors text-[12px] md:text-[13px] ${colors.subtitle}`}>{item.unit || 'قطعة'}</span>
                              </div>
                            </div>
                            
                            {isPortalOpen ? (
                              <div className={`flex items-center justify-between w-[180px] sm:w-[210px] md:w-[240px] p-2 shrink-0 rounded-[1.2rem] md:rounded-[1.4rem] transition-all duration-300 ${colors.capsuleBg}`} dir="ltr">
                                <button type="button" onClick={(e) => handleDecrement(item.id, e)} className={`w-11 h-11 md:w-12 md:h-12 shrink-0 flex items-center justify-center rounded-[0.8rem] transition-all duration-300 outline-none ${colors.btnText}`}><Minus className="w-5 h-5 md:w-6 md:h-6" /></button>
                                <input ref={(el) => { inputRefs.current[index] = el; }} type="number" min="0" step="any" value={qty || ''} onChange={(e) => handleQuantityChange(item.id, e.target.value)} onFocus={(e) => { setFocusedIndex(index); setTimeout(() => e.target.select(), 10); }} onBlur={() => setFocusedIndex(null)} placeholder="0" className={`qty-input en-num flex-1 min-w-0 w-full text-center px-2 bg-transparent outline-none transition-all duration-300 ${colors.input}`} />
                                <button type="button" onClick={(e) => handleIncrement(item, e)} className={`w-11 h-11 md:w-12 md:h-12 shrink-0 flex items-center justify-center rounded-[0.8rem] transition-all duration-300 outline-none ${colors.btnText}`}><Plus className="w-5 h-5 md:w-6 md:h-6" /></button>
                              </div>
                            ) : (
                              <div className="w-[180px] sm:w-[210px] md:w-[240px] shrink-0 bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 p-3 rounded-2xl text-center shadow-inner"><Lock className="w-5 h-5 text-slate-400 dark:text-slate-500 mx-auto"/></div>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <div key={item.id} onClick={() => { if(isPortalOpen) { inputRefs.current[index]?.focus(); } }} className={`group flex flex-col h-full rounded-[1.2rem] transition-all duration-300 cursor-text relative ${dynamicSizingGrid.cardPadding} ${colors.wrapper}`}>
                            <div className={`flex flex-col items-center justify-center flex-1 px-1 text-center ${dynamicSizingGrid.gapInner}`}>
                              <div className={`flex items-center justify-center shrink-0 transition-all duration-300 aspect-square ${dynamicSizingGrid.iconSize} ${colors.iconBg}`}>
                                <span className="drop-shadow-sm leading-none">{getItemEmoji(item.name)}</span>
                              </div>
                              <div className="flex flex-col min-w-0 w-full items-center mt-1.5">
                                <h4 className={`font-black break-words tracking-tighter transition-colors px-1 ${dynamicSizingGrid.titleSize} ${colors.title}`}>{item.name}</h4>
                                <span className={`font-bold truncate mt-0.5 transition-colors ${dynamicSizingGrid.subTitleSize} ${colors.subtitle}`}>{item.unit || 'قطعة'}</span>
                              </div>
                            </div>
                            
                            {isPortalOpen ? (
                              <div className={`flex items-center justify-between w-full p-1 mt-auto rounded-[0.8rem] transition-all duration-300 ${colors.capsuleBg}`} dir="ltr">
                                <button type="button" onClick={(e) => handleDecrement(item.id, e)} className={`shrink-0 flex items-center justify-center rounded-[0.6rem] outline-none ${dynamicSizingGrid.btnHeight} ${dynamicSizingGrid.btnWidth} ${colors.btnText}`}><Minus className="w-4 h-4 md:w-4.5 md:h-4.5" /></button>
                                <input ref={(el) => { inputRefs.current[index] = el; }} type="number" min="0" step="any" value={qty || ''} onChange={(e) => handleQuantityChange(item.id, e.target.value)} onFocus={(e) => { setFocusedIndex(index); setTimeout(() => e.target.select(), 10); }} onBlur={() => setFocusedIndex(null)} placeholder="0" className={`qty-input en-num flex-1 min-w-0 w-full text-center bg-transparent outline-none transition-all duration-300 ${dynamicSizingGrid.btnHeight} ${dynamicSizingGrid.inputSize} ${colors.input}`} />
                                <button type="button" onClick={(e) => handleIncrement(item, e)} className={`shrink-0 flex items-center justify-center rounded-[0.6rem] outline-none ${dynamicSizingGrid.btnHeight} ${dynamicSizingGrid.btnWidth} ${colors.btnText}`}><Plus className="w-4 h-4 md:w-4.5 md:h-4.5" /></button>
                              </div>
                            ) : (
                              <div className="mt-auto bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 p-2 rounded-xl text-center shadow-inner"><Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 mx-auto"/></div>
                            )}
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================= (السلة - Cart) ======================= */}
        {activeTab === 'cart' && (
          <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 pb-[200px] animate-in fade-in duration-300 bg-slate-50 dark:bg-[#050505] ${isZenMode ? 'pt-16' : ''}`}>
            <div className="max-w-3xl mx-auto">
              <h3 className="font-black text-slate-900 dark:text-white text-xl mb-5 flex items-center gap-2"><ShoppingCart className="w-6 h-6 text-indigo-500 dark:text-indigo-400"/> سلة المراجعة</h3>
              
              {totalOrderedItemsCount === 0 ? (
                <div className="bg-white dark:bg-[#121214] rounded-[2rem] p-12 text-center border border-slate-200 dark:border-white/10 shadow-sm flex flex-col items-center justify-center min-h-[50vh]">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-[#0a0a0c] rounded-full flex items-center justify-center mb-5 border border-slate-200 dark:border-white/5 shadow-inner">
                    <ShoppingCart className="w-12 h-12 text-slate-400 dark:text-slate-600" />
                  </div>
                  <h4 className="font-black text-slate-800 dark:text-slate-300 text-lg mb-2">السلة فارغة</h4>
                  <p className="font-bold text-slate-500 text-sm mb-6">قم بإضافة الأصناف من القائمة أولاً.</p>
                  <button onClick={() => { window.dispatchEvent(new CustomEvent('change-tab', { detail: 'menu' })); }} className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-500 text-white shadow-[0_5px_15px_rgba(99,102,241,0.3)] font-black px-6 py-3 rounded-xl hover:scale-105 transition-all outline-none border border-indigo-400/50">
                    تصفح قائمة الأصناف
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  
                  <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 p-4 rounded-[1.5rem] border border-indigo-200 dark:border-indigo-500/20 shadow-sm">
                     <span className="font-black text-[13px] flex items-center gap-2"><CalendarClock className="w-5 h-5"/> تاريخ الطلبية:</span>
                     <span className="font-black text-[14px] en-num dir-ltr">{dayjs().format('YYYY-MM-DD')}</span>
                  </div>

                  <div className="bg-white dark:bg-[#121214] rounded-[1.5rem] shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-[#0a0a0c] px-4 py-3 border-b border-slate-200 dark:border-white/5">
                      <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">الأصناف المضافة ({totalOrderedItemsCount})</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                      {Object.entries(quantities).filter(([_, q]) => q > 0).map(([itemId, qty]) => {
                        const item = items.find(i => i.id === itemId);
                        return (
                          <div key={itemId} className="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-xl flex items-center justify-center text-lg shadow-inner shrink-0 border border-indigo-200 dark:border-indigo-500/20">
                                {getItemEmoji(item?.name || '')}
                              </div>
                              <div>
                                <h4 className="font-black text-slate-800 dark:text-white text-[14px] leading-tight mb-1">{item?.name}</h4>
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{item?.unit || 'قطعة'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#0a0a0c] p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm shrink-0">
                              <button onClick={() => handleDecrement(itemId)} className="w-8 h-8 flex items-center justify-center bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:shadow-sm rounded-lg transition-all outline-none"><Minus className="w-4 h-4"/></button>
                              <span className="font-black text-slate-800 dark:text-white text-[15px] en-num w-5 text-center">{qty}</span>
                              <button onClick={() => handleIncrement(item)} className="w-8 h-8 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 hover:shadow-sm rounded-lg transition-all outline-none"><Plus className="w-4 h-4"/></button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#121214] rounded-[1.5rem] p-5 shadow-sm border border-slate-200 dark:border-white/10">
                    <label className="text-[13px] font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/> اسم مُرسل الطلبية <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={senderName} 
                      onChange={e => setSenderName(e.target.value)} 
                      placeholder="مثال: أحمد - شفت الصباحي" 
                      className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 font-bold px-4 py-3.5 rounded-xl focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-[13px] transition-all shadow-inner text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    />
                  </div>

                  <div className="bg-white dark:bg-[#121214] rounded-[1.5rem] p-5 shadow-sm border border-slate-200 dark:border-white/10">
                    <label className="text-[13px] font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/> ملاحظات للمطبخ المركزي (اختياري)
                    </label>
                    <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="مثال: يرجى استعجال الدجاج..." rows={3} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 font-bold px-4 py-3.5 rounded-xl focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-[13px] resize-none transition-all shadow-inner text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"></textarea>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🟢 زر الإرسال العائم 🟢 */}
        {activeTab === 'cart' && totalOrderedItemsCount > 0 && (
          <div className="fixed bottom-[90px] left-4 right-4 z-40 flex justify-center pointer-events-none animate-in slide-in-from-bottom-4 duration-500">
             <button 
               ref={sendBtnRef} 
               onClick={submitOrder} 
               disabled={isSubmitting || !isPortalOpen || !senderName.trim()} 
               className={`w-full max-w-sm h-14 rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 pointer-events-auto transition-all duration-300 outline-none ${
                 isSubmitting || !isPortalOpen || !senderName.trim()
                   ? 'bg-slate-200 dark:bg-[#121214] text-slate-400 dark:text-slate-500 shadow-none border border-slate-300 dark:border-white/10 cursor-not-allowed'
                   : 'bg-gradient-to-r from-indigo-500 to-blue-500 dark:from-indigo-600 dark:to-blue-500 text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.6)] border border-indigo-400/50 hover:shadow-[0_15px_40px_-10px_rgba(99,102,241,0.7)] hover:-translate-y-1 active:scale-[0.98]'
               }`}
             >
               {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>} 
               {!isPortalOpen ? 'البوابة مغلقة حالياً' : !senderName.trim() ? 'يرجى كتابة اسم المُرسل' : 'إرسال للموافقة'}
             </button>
          </div>
        )}

        {/* ======================= (الاعتمادات - Approvals Preview) ======================= */}
        {activeTab === 'approvals' && (
          <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 pb-[140px] animate-in fade-in duration-300 bg-slate-50 dark:bg-[#050505] ${isZenMode ? 'pt-16' : ''}`}>
            <div className="max-w-3xl mx-auto">
              <h3 className="font-black text-slate-900 dark:text-white text-xl mb-6 flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-amber-500 dark:text-amber-400"/> الاعتمادات المفتوحة بالمركز</h3>
              
              {allPendingOrders.length === 0 ? (
                <div className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-16 text-center border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl flex flex-col items-center justify-center min-h-[40vh]">
                  <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-200 dark:border-emerald-500/20 shadow-inner">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">الطابور فارغ</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs max-w-sm leading-relaxed">جميع الطلبيات المرسلة تم التعامل معها من قبل الإدارة.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allPendingOrders.map(order => (
                    <div key={order.id} className="bg-white dark:bg-[#121214] rounded-[2rem] p-5 shadow-sm dark:shadow-md border border-slate-200 dark:border-white/10 relative overflow-hidden flex flex-col h-full">
                      <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-600 dark:to-amber-400"></div>

                      <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-white/10 pb-4 shrink-0 mt-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20 shadow-inner shrink-0">
                            <Store className="w-5 h-5"/>
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 dark:text-white text-[14px] leading-tight mb-0.5">{order.branches?.name}</h4>
                            <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">{order.branches?.agencies?.name}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-[12px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/20 en-num dir-ltr shadow-sm">
                            #{order.invoice_number || '0000'}
                          </span>
                          <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20 flex items-center gap-1 shadow-sm">
                            <Clock className="w-3 h-3 text-amber-500/70"/> <span className="en-num dir-ltr">{dayjs(order.created_at).format('hh:mm A')}</span>
                          </span>
                        </div>
                      </div>

                      {order.notes && (
                        <div className="bg-slate-50 dark:bg-[#0a0a0c] rounded-xl p-2.5 mb-4 border border-slate-200 dark:border-white/5 flex items-start gap-2 shadow-sm dark:shadow-inner shrink-0">
                          <User className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{order.notes}</p>
                        </div>
                      )}

                      <div className="mb-4 flex-1 flex flex-col min-h-0">
                        <h5 className="font-black text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Package className="w-3.5 h-3.5 text-amber-500"/> الأصناف ({order.items?.length})</h5>
                        <div className="space-y-1.5 overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-[50px] max-h-[150px]">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-[11px] p-2 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                              <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-[#0a0a0c] px-2 py-0.5 rounded shadow-sm dark:shadow-inner border border-indigo-100 dark:border-white/5 flex items-center gap-1">
                                 <span className="en-num mt-0.5">{item.qty}</span> <span>{item.unit}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-auto pt-3 border-t border-slate-100 dark:border-white/10 flex justify-center shrink-0">
                         <span className="text-[11px] font-black text-amber-600 dark:text-amber-500 flex items-center gap-1.5 animate-pulse">
                           <Loader2 className="w-4 h-4 animate-spin" /> في انتظار اعتماد الإدارة ...
                         </span>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================= (سجل طلباتي - History Tracker) ======================= */}
        {activeTab === 'history' && (
          <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 pb-[140px] animate-in fade-in duration-300 bg-slate-50 dark:bg-[#050505] ${isZenMode ? 'pt-16' : ''}`}>
            <div className="max-w-3xl mx-auto">
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-900 dark:text-white text-xl flex items-center gap-2"><History className="w-6 h-6 text-indigo-500 dark:text-indigo-400"/> تتبع طلباتي</h3>
                <span className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-black text-[12px] shadow-sm flex items-center gap-1.5">
                  إجمالي الطلبيات: <span className="bg-white text-indigo-600 px-1.5 rounded-sm shadow-inner en-num">{totalOrders}</span>
                </span>
              </div>

              <div className="space-y-6">
                {orderHistory.map(order => (
                  <div key={order.id} className="bg-white dark:bg-[#121214] rounded-[2rem] p-5 shadow-sm border border-slate-200 dark:border-white/10 transition-colors">
                    
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-white/5 pb-4">
                      <div className="flex items-center gap-3">
                         <div className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-500/20 shadow-inner flex items-center gap-1.5">
                           <Hash className="w-4 h-4" />
                           <span className="text-[14px] md:text-[15px] font-black en-num dir-ltr">{order.invoice_number || '0000'}</span>
                         </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-slate-500 mb-1">تاريخ الطلب</p>
                        <p className="text-[12px] md:text-[13px] en-num font-black text-slate-800 dark:text-slate-200">{dayjs(order.created_at).format('YYYY-MM-DD | hh:mm A')}</p>
                      </div>
                    </div>

                    {order.status === 'مرفوض' || order.status === 'ملغى' ? (
                       <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-xl p-3 flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 font-black text-[13px] mb-6 shadow-sm">
                          <X className="w-5 h-5" /> تم إلغاء / رفض هذه الطلبية
                       </div>
                    ) : (
                       <div className="relative flex items-center justify-between mb-8 mt-2 px-2 md:px-6">
                          
                          <div className="absolute top-[14px] left-[15%] right-[15%] h-[4px] bg-slate-200 dark:bg-slate-800 rounded-full z-0 overflow-hidden">
                             <div className="absolute top-0 right-0 h-full bg-emerald-500 transition-all duration-700 z-0" 
                                  style={{ width: order.status === 'قيد المراجعة' ? '0%' : order.status === 'معتمد' || order.status === 'قيد التجهيز' ? '50%' : '100%' }}></div>
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-2 w-20">
                             <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${order.status === 'قيد المراجعة' || order.status === 'معتمد' || order.status === 'قيد التجهيز' || order.status === 'تم التجهيز' ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white dark:bg-[#121214] border-slate-300 dark:border-slate-700 text-slate-400'}`}>
                                <Clock className="w-4 h-4 md:w-5 md:h-5" />
                             </div>
                             <span className={`text-[10px] md:text-[11px] font-black text-center transition-colors ${order.status === 'قيد المراجعة' || order.status === 'معتمد' || order.status === 'قيد التجهيز' || order.status === 'تم التجهيز' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>المراجعة</span>
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-2 w-24">
                             <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${order.status === 'معتمد' || order.status === 'قيد التجهيز' || order.status === 'تم التجهيز' ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]' : order.status === 'قيد المراجعة' ? 'bg-white dark:bg-[#121214] border-emerald-400 dark:border-emerald-500 text-emerald-500 shadow-sm' : 'bg-white dark:bg-[#121214] border-slate-300 dark:border-slate-700 text-slate-400'}`}>
                                {order.status === 'معتمد' || order.status === 'قيد التجهيز' || order.status === 'تم التجهيز' ? <ChefHat className="w-4 h-4 md:w-5 md:h-5" /> : <Loader2 className={`w-4 h-4 md:w-5 md:h-5 ${order.status === 'قيد المراجعة' ? 'animate-spin' : ''}`} />}
                             </div>
                             <span className={`text-[10px] md:text-[11px] font-black text-center transition-colors ${order.status === 'معتمد' || order.status === 'قيد التجهيز' || order.status === 'تم التجهيز' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>التجهيز بالمطبخ</span>
                          </div>

                          <div className="relative z-10 flex flex-col items-center gap-2 w-20">
                             <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${order.status === 'تم التجهيز' ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-110' : order.status === 'معتمد' || order.status === 'قيد التجهيز' ? 'bg-white dark:bg-[#121214] border-emerald-400 dark:border-emerald-500 text-emerald-500 shadow-sm' : 'bg-white dark:bg-[#121214] border-slate-300 dark:border-slate-700 text-slate-400'}`}>
                                {order.status === 'تم التجهيز' ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : <Package className="w-4 h-4 md:w-5 md:h-5" />}
                             </div>
                             <span className={`text-[10px] md:text-[11px] font-black text-center transition-colors ${order.status === 'تم التجهيز' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>جاهز للاستلام</span>
                          </div>
                       </div>
                    )}

                    <div className="bg-slate-50 dark:bg-[#0a0a0c] p-4 rounded-2xl border border-slate-100 dark:border-white/5 mt-2">
                      <h5 className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5"><Package className="w-4 h-4"/> المواد المطلوبة ({order.items.length})</h5>
                      <div className="max-h-[160px] overflow-y-auto custom-scrollbar pr-1 divide-y divide-slate-200 dark:divide-white/5">
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between items-center py-2.5 text-[12px] first:pt-0 last:pb-0">
                           <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-indigo-400 dark:bg-indigo-500 rounded-full shrink-0"></span>{item.name}
                           </span>
                           <span className="font-black text-indigo-700 dark:text-indigo-400 bg-white dark:bg-[#121214] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-1.5">
                              <span className="en-num mt-0.5">{item.qty}</span> <span>{item.unit}</span>
                           </span>
                        </div>
                      ))}
                      </div>
                    </div>
                    
                    {order.status === 'قيد المراجعة' ? (
                      <button 
                        onClick={() => handleDeleteMyOrder(order)}
                        disabled={isSubmitting}
                        className="mt-4 w-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 py-3 rounded-[1rem] text-[13px] font-black hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500 dark:hover:text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-sm outline-none active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" /> إلغاء الطلبية (متاح قبل الاعتماد فقط)
                      </button>
                    ) : isAdmin ? (
                      <button 
                        onClick={() => handleDeleteMyOrder(order)}
                        disabled={isSubmitting}
                        className="mt-4 w-full bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 py-3 rounded-[1rem] text-[13px] font-black hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500 dark:hover:text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-sm outline-none active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" /> حذف إداري قسري (تنظيف السجل)
                      </button>
                    ) : null}

                  </div>
                ))}
                
                {orderHistory.length === 0 && (
                  <div className="text-center text-slate-500 font-bold py-12 flex flex-col items-center justify-center bg-white dark:bg-[#121214] rounded-[2rem] border border-slate-200 dark:border-white/5 border-dashed shadow-sm">
                    <History className="w-12 h-12 opacity-30 mb-2 text-indigo-400" />
                    لا يوجد سجل طلبات سابق
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 💡 زر الخروج من وضع التركيز 💡 */}
        {isZenMode && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-top-4 fade-in duration-500 no-print">
            <button 
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-full font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all outline-none"
            >
              <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

      </div>
    </div>
  );
}