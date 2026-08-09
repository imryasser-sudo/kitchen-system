"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { toast } from 'sonner'; 
import { 
  ChefHat, Clock, Store, Package, CheckCircle2, 
  Loader2, Edit, X, Plus, Minus, MonitorPlay, Save, Layers, Trash2, ListChecks,
  Sun, Moon, Lock, ShieldCheck, ShieldAlert
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

// ============================================================
// --- 💡 نظام التنبيه الصوتي المدمج (تخطي حظر المتصفح) 💡 ---
// ============================================================
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

// ============================================================

const getOrderTypeColor = (type: string, isDark: boolean) => {
  if (!type) return isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200';
  if (type.includes('طارئ') || type.includes('نقص')) return isDark ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-rose-100 text-rose-700 border-rose-200';
  if (type.includes('استرجاع')) return isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-amber-100 text-amber-700 border-amber-200';
  if (type.includes('تحويل')) return isDark ? 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/50' : 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200';
  if (type.includes('دعم')) return isDark ? 'bg-teal-500/20 text-teal-400 border-teal-500/50' : 'bg-teal-100 text-teal-700 border-teal-200';
  return isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'; 
};

export default function KitchenDisplaySystemPage() {
  const { isDark, toggleTheme } = useTheme(); 
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isManager, setIsManager] = useState(false); 
  const [isBranchManager, setIsBranchManager] = useState(false);

  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(dayjs());

  const [activeTab, setActiveTab] = useState<string>('orders');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editedDetails, setEditedDetails] = useState<any[]>([]);

  const [completedItems, setCompletedItems] = useState<Record<string, number>>({});

  useEffect(() => {
    const sessionStr = localStorage.getItem('erp_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      setCurrentUser(session);
      
      // الشيف والإدارة هم المدراء (يملكون صلاحية التعديل والتجهيز)
      if (['Admin', 'AsstManager', 'Accountant', 'Chef'].includes(session.role)) {
        setIsManager(true);
      }
      
      // مدير الفرع
      if (session.role === 'BranchManager') {
        setIsBranchManager(true);
        setIsManager(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchActiveOrders = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          branches (name, agency_id, agencies(name)),
          order_details (id, item_id, quantity, items (id, name, main_unit, primary_unit, categories(name, sequence)))
        `)
        .eq('status', 'قيد التجهيز')
        .order('created_at', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      
      let finalOrders = data || [];

      // مدير الفرع يشوف طلباته فقط، أما الموظفين والإدارة يشوفون الكل
      if (isBranchManager && currentUser?.name) {
        finalOrders = finalOrders.filter(order => order.branches?.name === currentUser.name);
      }

      setActiveOrders(finalOrders);
    } catch (err: any) {
      console.error("Error fetching KDS orders:", err.message || err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchActiveOrders();
    }

    const channel = supabase.channel('realtime_kds')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        playAlertSound(); 
        toast.success(`طلبية جديدة وصلت للمطبخ! 🔔`, { 
          description: `رقم الفاتورة: #${payload.new.invoice_number || '0000'}`, 
          duration: 8000 
        });
        fetchActiveOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        if (payload.new.status === 'ملغى' || payload.new.status === 'مرفوض') {
          playAlertSound();
          toast.error(`تنبيه: إلغاء طلبية! ❌`, { 
            description: `تم إلغاء الطلبية #${payload.new.invoice_number || '0000'} من قبل الإدارة.`, 
            duration: 8000 
          });
        }
        fetchActiveOrders();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, payload => {
        playAlertSound();
        toast.error(`تم سحب طلبية 🗑️`, { 
          description: `قامت الإدارة بحذف وسحب إحدى الطلبيات من شاشة المطبخ.`, 
          duration: 8000 
        });
        fetchActiveOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, isBranchManager]);

  const toggleItemCompletion = (id: string, maxQty: number) => {
    if (!isManager) return; // 💡 الموظف ومدير الفرع يُمنعون من التأشير هنا 💡
    setCompletedItems(prev => {
      const current = prev[id] || 0;
      const next = { ...prev };
      
      if (current >= maxQty) {
        delete next[id]; 
      } else {
        next[id] = current + 1; 
      }
      return next;
    });
  };

  const startEditing = (order: any) => {
    if (!isManager) return;
    setEditingOrderId(order.id);
    setEditedDetails(JSON.parse(JSON.stringify(order.order_details)));
  };

  const cancelEditing = () => {
    setEditingOrderId(null);
    setEditedDetails([]);
  };

  const handleIncrement = (detailId: string) => {
    const updated = [...editedDetails];
    const itemIndex = updated.findIndex(d => d.id === detailId);
    if (itemIndex > -1) {
      updated[itemIndex].quantity += 1;
      setEditedDetails(updated);
    }
  };

  const handleDecrement = (detailId: string) => {
    const updated = [...editedDetails];
    const itemIndex = updated.findIndex(d => d.id === detailId);
    if (itemIndex > -1 && updated[itemIndex].quantity > 0) {
      updated[itemIndex].quantity -= 1;
      setEditedDetails(updated);
    }
  };

  const handleSaveEdits = async (order: any) => {
    if (!isManager) return;
    setProcessingId(order.id);
    try {
      for (const detail of editedDetails) {
        if (detail.quantity === 0) {
          await supabase.from('order_details').delete().eq('id', detail.id);
        } else {
          await supabase.from('order_details').update({ quantity: detail.quantity }).eq('id', detail.id);
        }
      }

      if (order.invoice_number) {
        const { data: bOrder } = await supabase.from('branch_orders')
          .select('*').or(`notes.ilike.%${order.invoice_number}%,invoice_number.eq.${order.invoice_number}`)
          .maybeSingle();

        if (bOrder && bOrder.items) {
          const updatedBranchItems = editedDetails.filter(d => d.quantity > 0).map(d => {
            const oldItem = bOrder.items.find((i: any) => i.item_id === d.items.id || i.name === d.items.name) || {};
            return { ...oldItem, item_id: d.items.id, name: d.items.name, qty: d.quantity };
          });
          await supabase.from('branch_orders').update({ items: updatedBranchItems }).eq('id', bOrder.id);
        }
      }

      setEditingOrderId(null);
      await fetchActiveOrders();
    } catch (err: any) {
      alert(`حدث خطأ أثناء الحفظ: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteOrder = async (order: any) => {
    if (!isManager) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الطلبية نهائياً؟\n\n(سيتم مسحها بالكامل من النظام ولن يمكن استرجاعها)')) return;

    setProcessingId(order.id);
    try {
      await supabase.from('order_details').delete().eq('order_id', order.id);
      const { error: orderError } = await supabase.from('orders').delete().eq('id', order.id);
      if (orderError) throw orderError;

      if (order.invoice_number) {
        await supabase.from('branch_orders').delete().or(`notes.ilike.%${order.invoice_number}%,invoice_number.eq.${order.invoice_number}`);
      }

      setActiveOrders(prev => prev.filter(o => o.id !== order.id));
    } catch (err) {
      alert('حدث خطأ أثناء الحذف النهائي');
    } finally {
      setProcessingId(null);
    }
  };

  const markAsCompleted = async (order: any) => {
    if (!isManager) return;
    if (!window.confirm('هل تم تجهيز الطلبية بالكامل وجاهزة للتسليم؟\n\nستنتقل الطلبية إلى السجل الشامل.')) return;
    
    setProcessingId(order.id);
    try {
      const { error: orderError } = await supabase.from('orders').update({ status: 'تم التجهيز' }).eq('id', order.id);
      if (orderError) throw orderError;

      if (order.invoice_number) {
        await supabase.from('branch_orders').update({ status: 'تم التجهيز' }).or(`notes.ilike.%${order.invoice_number}%,invoice_number.eq.${order.invoice_number}`);
      }

      setActiveOrders(prev => prev.filter(o => o.id !== order.id));
    } catch (err) {
      alert('حدث خطأ أثناء تحديث الحالة');
    } finally {
      setProcessingId(null);
    }
  };

  const calculateWaitTime = (createdAt: string) => {
    const diff = currentTime.diff(dayjs(createdAt), 'minute');
    if (diff > 60) return `${Math.floor(diff / 60)} ساعة و ${diff % 60} دقيقة`;
    return `${diff} دقيقة`;
  };

  const getAggregatedData = () => {
    const summary: Record<string, any> = {};

    activeOrders.forEach(order => {
      const branchName = order.branches?.name || 'فرع مجهول';
      
      order.order_details.forEach((detail: any) => {
        const catName = detail.items?.categories?.name || 'أصناف عامة';
        const catSeq = detail.items?.categories?.sequence || 999;
        const itemName = detail.items?.name || 'مادة غير معروفة';
        const unit = detail.items?.main_unit && detail.items.main_unit !== '-' ? detail.items.main_unit : (detail.items?.primary_unit || 'قطعة');
        const qty = detail.quantity || 0;

        if (!summary[catName]) {
          summary[catName] = { name: catName, sequence: catSeq, items: {} };
        }

        if (!summary[catName].items[itemName]) {
          summary[catName].items[itemName] = { total: 0, unit, branches: {} };
        }

        summary[catName].items[itemName].total += qty;
        
        if (!summary[catName].items[itemName].branches[branchName]) {
          summary[catName].items[itemName].branches[branchName] = 0;
        }
        summary[catName].items[itemName].branches[branchName] += qty;
      });
    });

    return Object.values(summary).sort((a: any, b: any) => a.sequence - b.sequence).map((cat: any) => ({
      ...cat,
      items: Object.entries(cat.items).map(([name, data]: any) => ({ name, ...data }))
    }));
  };

  const ProgressIndicator = ({ current, max }: { current: number, max: number }) => {
    if (max === 1) {
      return current === 1 
        ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0"/> 
        : <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0 transition-colors"/>;
    }
    
    if (max <= 10) {
      return (
        <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
          {Array.from({ length: max }).map((_, i) => (
            <div key={i} className={`transition-all duration-300 rounded-full ${
              i < current 
              ? 'w-3 h-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] scale-110' 
              : 'w-2 h-2 bg-slate-300 dark:bg-slate-700 opacity-60'
            }`} />
          ))}
        </div>
      );
    }
    
    return (
      <div className={`px-2.5 py-0.5 rounded-md text-[11px] font-black en-num flex items-center justify-center min-w-[45px] shrink-0 transition-colors ${
        current === max 
        ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
        : current > 0 
          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' 
          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
      }`}>
        {current} / {max}
      </div>
    );
  };

  const aggregatedData = getAggregatedData();
  
  const isOrdersView = activeTab === 'orders' || (activeTab !== 'orders' && !aggregatedData.some((c: any) => c.name === activeTab));
  const selectedCategory = isOrdersView ? null : aggregatedData.find((c: any) => c.name === activeTab);

  if (isLoading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#050505]' : 'bg-slate-50'} flex flex-col items-center justify-center gap-4`}>
        <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
        <p className={`font-black uppercase tracking-widest animate-pulse text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>جاري تحميل الشاشة...</p>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white font-sans flex flex-col overflow-hidden relative transition-colors duration-500 pb-[100px]" dir="rtl">
        
        <div className="bg-white dark:bg-[#0f0f13] border-b border-slate-200 dark:border-slate-800 p-4 lg:px-8 lg:py-5 flex flex-col gap-5 shrink-0 shadow-sm dark:shadow-lg relative z-20 transition-colors duration-500">
          
          <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-4 max-w-[120rem] mx-auto w-full">
            <div className="flex items-center gap-4">
              <div className={`${isBranchManager ? 'bg-sky-600 shadow-[0_0_15px_rgba(14,165,233,0.5)]' : 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)]'} text-white p-3 rounded-[1rem] shrink-0`}>
                <MonitorPlay className="w-7 h-7 lg:w-8 lg:h-8" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1.5 whitespace-nowrap">
                  {isBranchManager ? 'شاشة متابعة التجهيز' : 'شاشة المطبخ (KDS)'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-[11px] lg:text-sm flex items-center gap-2 whitespace-nowrap">
                  <span className={`w-2.5 h-2.5 ${isBranchManager ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.8)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'} rounded-full animate-pulse block shrink-0`}></span>
                  <span className="mr-1">{isBranchManager ? 'تتابع طلبيات فرعك لحظياً' : 'متصل ويستقبل الطلبات لحظياً'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 lg:gap-5 mr-auto sm:mr-0">
              
              {/* 💡 الشارة التعريفية للمستخدم (بديل زر التجربة) 💡 */}
              <div className={`px-4 py-2 lg:py-2.5 rounded-[1rem] shadow-inner flex items-center gap-2 font-black text-[12px] border ${
                isManager 
                ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400' 
                : 'bg-slate-100 dark:bg-[#1a1a24] border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {isManager ? <ShieldCheck className="w-5 h-5 shrink-0"/> : <Lock className="w-5 h-5 shrink-0"/>}
                <span className="hidden md:flex items-center gap-1.5">
                  <span className={isManager ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}>{currentUser?.name || ''}</span>
                  <span className="opacity-70">({isManager ? 'صلاحية الإجراء والتجهيز' : 'صلاحية المشاهدة فقط'})</span>
                </span>
              </div>

              <button 
                onClick={toggleTheme} 
                className="p-3 lg:p-3.5 bg-slate-100 dark:bg-[#1a1a24] border border-slate-200 dark:border-slate-700 rounded-[1rem] text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-500 shadow-inner transition-colors outline-none shrink-0"
              >
                {isDark ? <Sun className="w-5 h-5 lg:w-5 lg:h-5" /> : <Moon className="w-5 h-5 lg:w-5 lg:h-5" />}
              </button>

              <div className="text-right hidden sm:block ml-2 shrink-0">
                <h2 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white en-num tracking-wider drop-shadow-md">{currentTime.format('HH:mm:ss')}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-xs lg:text-sm">{currentTime.format('YYYY-MM-DD | dddd')}</p>
              </div>
              
              <div className="bg-slate-100 dark:bg-[#1a1a24] border border-slate-200 dark:border-slate-700 px-6 py-2 lg:px-8 lg:py-3 rounded-[1rem] flex flex-col items-center shadow-inner shrink-0">
                <span className="text-slate-500 dark:text-slate-400 font-black text-[10px] lg:text-[12px] mb-1 uppercase tracking-widest">قيد التجهيز</span>
                <span className="text-3xl lg:text-4xl font-black text-emerald-600 dark:text-emerald-400 leading-none drop-shadow-md">{activeOrders.length}</span>
              </div>
            </div>
          </div>

          {/* 💡 أزرار التجميع (تظهر للكل عدا مدير الفرع) 💡 */}
          {!isBranchManager && (
            <div className="flex bg-slate-100 dark:bg-[#050505] p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner overflow-x-auto custom-scrollbar w-full max-w-[120rem] mx-auto gap-2">
              <button 
                onClick={() => setActiveTab('orders')}
                className={`whitespace-nowrap px-6 py-3 rounded-xl font-black text-[15px] flex items-center gap-2 transition-all shrink-0 outline-none active:scale-95 ${
                  isOrdersView 
                  ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)] border border-indigo-500' 
                  : 'bg-white dark:bg-[#12121a] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <Layers className="w-5 h-5"/> التكتات الفردية
              </button>

              {aggregatedData.map((cat: any, idx: number) => (
                <button 
                  key={idx}
                  onClick={() => setActiveTab(cat.name)}
                  className={`whitespace-nowrap px-6 py-3 rounded-xl font-black text-[15px] flex items-center gap-2 transition-all shrink-0 outline-none active:scale-95 ${
                    activeTab === cat.name 
                    ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-500' 
                    : 'bg-white dark:bg-[#12121a] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <ListChecks className="w-5 h-5"/> {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative">
            <div className="bg-slate-100 dark:bg-slate-900 p-8 rounded-full mb-6 border border-slate-200 dark:border-slate-800 shadow-inner">
              <ChefHat className="w-24 h-24 md:w-32 md:h-32 text-slate-400 dark:text-slate-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">لا توجد طلبيات حالياً</h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm md:text-lg max-w-md mx-auto leading-relaxed">
              {isBranchManager ? 'لم يتم العثور على أي طلبيات تخص فرعك قيد التجهيز في المطبخ.' : 'بانتظار اعتماد طلبيات جديدة من قسم المبيعات أو الإدارة.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 z-10 relative">
            <div className="max-w-[120rem] mx-auto w-full">
              
              {/* 🌟 شاشة القسم المحدد (التجميع / Matrix) 🌟 */}
              {!isOrdersView && selectedCategory && !isBranchManager && (
                <div className="space-y-6 w-full animate-in fade-in duration-500">
                  <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700/80 rounded-[2rem] overflow-hidden shadow-sm dark:shadow-2xl">
                    
                    <div className="bg-slate-50 dark:bg-[#12121a] px-6 md:px-8 py-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4 relative">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/50">
                          <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400"/>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{selectedCategory.name}</h2>
                      </div>
                      <span className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm md:text-base shadow-inner">
                        إجمالي الأنواع: <span className="text-emerald-600 dark:text-emerald-400 en-num ml-1">{selectedCategory.items.length}</span>
                      </span>
                    </div>

                    <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                      {selectedCategory.items.map((item: any, itemIdx: number) => {
                        const totalQty = Number(item.total) || 0;
                        
                        const completedQty = Object.entries(item.branches).reduce((sum: number, [branch, qty]: any) => {
                          const branchCompletedCount = completedItems[`matrix-${selectedCategory.name}-${item.name}-${branch}`] || 0;
                          return sum + branchCompletedCount;
                        }, 0);
                        
                        const isAllBranchesCompleted = completedQty >= totalQty && totalQty > 0;

                        return (
                          <div key={itemIdx} className={`bg-slate-50 dark:bg-[#161622] border transition-colors shadow-sm dark:shadow-lg rounded-[1.5rem] flex flex-col relative overflow-hidden ${isAllBranchesCompleted ? 'border-emerald-300 dark:border-emerald-500/50' : 'border-slate-200 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-slate-500'}`}>
                            
                            {completedQty > 0 && !isAllBranchesCompleted && (
                              <div className="absolute top-0 right-0 h-full bg-emerald-50/50 dark:bg-emerald-900/10 transition-all duration-500 z-0" style={{ width: `${(completedQty / totalQty) * 100}%` }}></div>
                            )}

                            <div className="p-6 relative z-10 flex flex-col h-full">
                              <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                                <h3 className={`text-lg md:text-xl font-black leading-tight transition-all ${isAllBranchesCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                  {item.name}
                                </h3>
                                <div className={`px-4 py-2 rounded-xl flex flex-col items-center justify-center min-w-[80px] shrink-0 border transition-all ${isAllBranchesCompleted ? 'bg-transparent border-emerald-200 dark:border-emerald-900/50 text-emerald-500' : 'bg-emerald-100 dark:bg-emerald-500 text-emerald-800 dark:text-slate-950 border-emerald-200 dark:border-transparent dark:shadow-[0_0_15px_rgba(16,185,129,0.3)]'}`}>
                                  <span className="text-3xl font-black en-num leading-none">{item.total}</span>
                                  <span className="text-[11px] font-bold mt-1 opacity-80">{item.unit}</span>
                                </div>
                              </div>

                              <div className="space-y-3 mt-auto">
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                                  <p className="text-[12px] font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2 uppercase tracking-widest">
                                    <Store className="w-4 h-4"/> الفروع:
                                  </p>
                                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-md en-num dir-ltr transition-colors ${
                                    isAllBranchesCompleted 
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 shadow-sm' 
                                    : 'bg-white text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                  }`}>
                                    {completedQty} / {totalQty}
                                  </span>
                                </div>
                                
                                {Object.entries(item.branches).map(([branch, bQty]: any, bIdx) => {
                                  const maxBranchQty = Number(bQty);
                                  const uniqueBranchId = `matrix-${selectedCategory.name}-${item.name}-${branch}`;
                                  const branchCompletedQty = completedItems[uniqueBranchId] || 0;
                                  const isBranchCompleted = branchCompletedQty >= maxBranchQty;

                                  return (
                                    <div 
                                      key={bIdx} 
                                      // 💡 المؤشر يشتغل فقط إذا المستخدم (إدارة/شيف) 💡
                                      onClick={() => { if (isManager) toggleItemCompletion(uniqueBranchId, maxBranchQty); }}
                                      className={`flex justify-between items-center px-4 py-3 rounded-xl border ${isManager ? 'cursor-pointer' : 'cursor-default'} transition-all overflow-hidden relative ${
                                        isBranchCompleted 
                                        ? 'border-emerald-200 dark:border-emerald-800 opacity-70' 
                                        : `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${isManager ? 'hover:border-emerald-300 dark:hover:border-emerald-600' : ''} shadow-sm`
                                      }`}
                                    >
                                      {branchCompletedQty > 0 && !isBranchCompleted && (
                                        <div className="absolute top-0 right-0 h-full bg-emerald-50 dark:bg-emerald-900/20 transition-all duration-300 z-0" style={{ width: `${(branchCompletedQty / maxBranchQty) * 100}%` }}></div>
                                      )}
                                      
                                      <div className="flex items-center gap-3 relative z-10">
                                        <ProgressIndicator current={branchCompletedQty} max={maxBranchQty} />
                                        <span className={`font-bold text-sm md:text-base transition-all ${isBranchCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                          {branch}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 🌟 شاشة الطلبيات الفردية (التكتات) 🌟 */}
              {(isOrdersView || isBranchManager) && (
                <div className={`grid grid-cols-1 md:grid-cols-2 ${isBranchManager ? 'lg:grid-cols-2 xl:grid-cols-3' : 'lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'} gap-6 items-start w-full`}>
                  {activeOrders.map((order) => {
                    const waitMinutes = currentTime.diff(dayjs(order.created_at), 'minute');
                    const isLate = waitMinutes >= 30; 
                    const isEditingThis = editingOrderId === order.id;
                    const detailsToRender = isEditingThis ? editedDetails : order.order_details;

                    const totalOrderQty = detailsToRender.reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0);
                    const completedOrderQty = detailsToRender.reduce((sum: number, d: any, idx: number) => {
                      const completedCount = completedItems[`order-${order.id}-detail-${d.id || idx}`] || 0;
                      return sum + completedCount;
                    }, 0);
                    const isOrderFullyCompleted = completedOrderQty >= totalOrderQty && totalOrderQty > 0;

                    const groupedDetails = detailsToRender.reduce((acc: any, detail: any) => {
                      const catName = detail.items?.categories?.name || 'أصناف عامة';
                      const catSeq = detail.items?.categories?.sequence || 999;
                      if (!acc[catName]) acc[catName] = { name: catName, sequence: catSeq, items: [] };
                      acc[catName].items.push(detail);
                      return acc;
                    }, {});

                    const sortedCategories = Object.values(groupedDetails).sort((a: any, b: any) => a.sequence - b.sequence);

                    return (
                      <div 
                        key={order.id} 
                        className={`w-full flex flex-col rounded-[1.5rem] border-2 overflow-hidden transition-all duration-500 animate-in fade-in zoom-in-95 ${
                          isEditingThis ? 'bg-white dark:bg-slate-900 border-amber-400 dark:border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' :
                          isLate ? 'bg-white dark:bg-slate-900 border-rose-400 dark:border-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.2)]' : 
                          isOrderFullyCompleted ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-400 dark:border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.15)]' :
                          'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-md dark:shadow-xl'
                        }`}
                      >
                        <div className={`p-5 flex justify-between items-start border-b ${
                          isEditingThis ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50' : 
                          isLate ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50' : 
                          isOrderFullyCompleted ? 'bg-emerald-100/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50' :
                          'bg-slate-50 dark:bg-[#16161e] border-slate-200 dark:border-slate-800'
                        }`}>
                          <div>
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2.5 tracking-tight">{order.branches?.name || 'فرع مجهول'}</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-black bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm dark:shadow-inner">
                                {order.branches?.agencies?.name || 'وكالة عامة'}
                              </span>
                              <span className={`text-[11px] font-black px-3 py-1 rounded-lg border shadow-sm ${getOrderTypeColor(order.order_type, isDark)}`}>
                                {order.order_type || 'طلب عام'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-[14px] font-black bg-slate-900 dark:bg-slate-950 text-white px-3 py-1.5 rounded-xl border border-slate-700 en-num flex items-center gap-1.5 shadow-inner">
                              #{order.invoice_number || '0000'}
                            </span>
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[12px] border shadow-inner ${isLate ? 'bg-rose-600 text-white border-rose-500 animate-pulse' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                              <Clock className="w-3.5 h-3.5" />
                              {calculateWaitTime(order.created_at)}
                            </div>
                          </div>
                        </div>

                        {order.notes && (
                          <div className={`px-5 py-3 border-b text-[13px] font-bold leading-relaxed whitespace-pre-wrap ${isEditingThis ? 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300' : isLate ? 'bg-rose-100 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300' : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300'}`}>
                            ⚠️ {order.notes}
                          </div>
                        )}

                        <div className="flex-1 p-4 bg-slate-50/50 dark:bg-[#0a0a0f] overflow-y-auto custom-scrollbar space-y-5 max-h-[50vh]">
                          
                          {/* التعديل فقط للإدارة والشيف */}
                          {!isEditingThis && isManager && (
                            <div className="flex justify-end mb-[-10px] mt-[-5px]">
                              <button 
                                onClick={() => startEditing(order)} 
                                className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition-colors flex items-center gap-1 shadow-sm outline-none"
                              >
                                <Edit className="w-3 h-3"/> تعديل الكميات
                              </button>
                            </div>
                          )}

                          {sortedCategories.map((category: any, catIndex: number) => {
                            
                            const catTotalQty = category.items.reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0);
                            const catCompletedQty = category.items.reduce((sum: number, d: any, idx: number) => {
                              return sum + (completedItems[`order-${order.id}-detail-${d.id || idx}`] || 0);
                            }, 0);
                            const isCatFullyCompleted = catCompletedQty >= catTotalQty && catTotalQty > 0;

                            return (
                              <div key={catIndex}>
                                <div className="flex items-center justify-between mb-2.5 px-1 pb-1.5 border-b border-slate-200 dark:border-slate-800/80">
                                  <h4 className={`font-black text-[12px] tracking-wide transition-colors ${
                                    isCatFullyCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
                                  }`}>
                                    {category.name}
                                  </h4>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md en-num dir-ltr transition-colors border shadow-sm ${
                                    isCatFullyCompleted 
                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' 
                                    : 'bg-white text-slate-500 border-slate-200 dark:bg-[#15151e] dark:text-slate-400 dark:border-slate-700'
                                  }`}>
                                    {catCompletedQty} / {catTotalQty}
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {category.items.map((detail: any, idx: number) => {
                                    const maxDetailQty = Number(detail.quantity) || 0;
                                    const uniqueDetailId = `order-${order.id}-detail-${detail.id || idx}`;
                                    
                                    const currentCompletedQty = completedItems[uniqueDetailId] || 0;
                                    const isCompleted = currentCompletedQty >= maxDetailQty && maxDetailQty > 0;

                                    return (
                                      <div 
                                        key={detail.id || idx} 
                                        // 💡 المؤشر يشتغل فقط إذا المستخدم (إدارة/شيف) 💡
                                        onClick={() => { if(!isEditingThis && isManager) toggleItemCompletion(uniqueDetailId, maxDetailQty); }}
                                        className={`flex justify-between items-center px-3 py-2.5 rounded-xl border ${isManager ? 'cursor-pointer' : 'cursor-default'} transition-all overflow-hidden relative ${
                                          isEditingThis 
                                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600' 
                                          : isCompleted
                                            ? 'border-emerald-200 dark:border-emerald-800 opacity-70'
                                            : `bg-white dark:bg-[#15151e] border-slate-200 dark:border-slate-800 ${isManager ? 'hover:border-emerald-300 dark:hover:border-emerald-600' : ''} shadow-sm`
                                        }`}
                                      >
                                        
                                        {currentCompletedQty > 0 && !isCompleted && !isEditingThis && (
                                          <div className="absolute top-0 right-0 h-full bg-emerald-50/80 dark:bg-emerald-900/20 transition-all duration-300 z-0" style={{ width: `${(currentCompletedQty / maxDetailQty) * 100}%` }}></div>
                                        )}

                                        <div className="flex items-center gap-3 relative z-10">
                                          {!isEditingThis && (
                                            <ProgressIndicator current={currentCompletedQty} max={maxDetailQty} />
                                          )}
                                          <span className={`text-[14px] md:text-[15px] font-bold leading-tight transition-all ${isCompleted && !isEditingThis ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-white'}`}>
                                            {detail.items?.name || 'مادة محذوفة'}
                                          </span>
                                        </div>
                                        
                                        {isEditingThis ? (
                                          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-1.5 rounded-xl shrink-0 shadow-inner relative z-10">
                                            <button onClick={() => handleDecrement(detail.id)} className="w-8 h-8 flex items-center justify-center bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/30 border border-rose-200 dark:border-rose-500/30 rounded-lg transition-all active:scale-95"><Minus className="w-4 h-4"/></button>
                                            <span className="text-xl font-black text-amber-600 dark:text-amber-400 w-10 text-center en-num">{detail.quantity}</span>
                                            <button onClick={() => handleIncrement(detail.id)} className="w-8 h-8 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 border border-emerald-200 dark:border-emerald-500/30 rounded-lg transition-all active:scale-95"><Plus className="w-4 h-4"/></button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 shrink-0 relative z-10">
                                            <span className={`font-black px-3.5 py-1.5 rounded-lg text-[18px] md:text-[20px] en-num leading-none border transition-all ${isCompleted ? 'bg-transparent border-transparent text-emerald-600 dark:text-emerald-500 line-through' : 'bg-emerald-100 dark:bg-emerald-500 border-emerald-200 dark:border-transparent text-emerald-700 dark:text-slate-950 dark:shadow-[0_0_10px_rgba(16,185,129,0.3)]'}`}>
                                              {detail.quantity}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-[#15151e] border-t border-slate-200 dark:border-slate-800 mt-auto flex flex-col gap-3">
                          
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[12px] font-bold text-slate-500">إجمالي الأقسام: {sortedCategories.length}</span>
                            {!isEditingThis && isManager && (
                              <button 
                                onClick={() => handleDeleteOrder(order)} 
                                className="bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-500/50 px-3 py-2 rounded-lg text-[12px] font-black flex items-center gap-1.5 transition-all outline-none shadow-sm"
                              >
                                <Trash2 className="w-3.5 h-3.5"/> حذف نهائي
                              </button>
                            )}
                          </div>

                          {isManager ? (
                            isEditingThis ? (
                              <div className="flex flex-col gap-3">
                                <button 
                                  onClick={() => handleSaveEdits(order)}
                                  disabled={processingId === order.id}
                                  className="w-full bg-amber-500 hover:bg-amber-400 text-white dark:text-slate-900 font-black text-[15px] py-3.5 rounded-[1rem] flex items-center justify-center gap-2 shadow-[0_5px_15px_rgba(245,158,11,0.3)] dark:shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all outline-none active:scale-95 disabled:opacity-50"
                                >
                                  {processingId === order.id ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ تعديلات الشيف
                                </button>
                                <button 
                                  onClick={cancelEditing}
                                  className="w-full bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[14px] py-3 rounded-[1rem] border border-slate-200 dark:border-slate-600 transition-all outline-none active:scale-95 shadow-sm"
                                >
                                  إلغاء التعديل
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => markAsCompleted(order)}
                                disabled={processingId === order.id || !isOrderFullyCompleted}
                                className={`w-full font-black text-[15px] py-4 rounded-[1rem] flex items-center justify-center gap-3 transition-all outline-none ${
                                  isOrderFullyCompleted
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_5px_15px_rgba(16,185,129,0.3)] dark:shadow-[0_0_20px_rgba(5,150,105,0.6)] ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-[#15151e] active:scale-95 cursor-pointer'
                                  : 'bg-slate-200 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-800'
                                }`}
                              >
                                {processingId === order.id ? (
                                  <Loader2 className="w-5 h-5 animate-spin"/>
                                ) : isOrderFullyCompleted ? (
                                  <CheckCircle2 className="w-5 h-5"/>
                                ) : (
                                  <Lock className="w-5 h-5"/>
                                )}
                                
                                {isOrderFullyCompleted ? 'تم التجهيز (إرسال للسجل)' : 'يرجى تأشير جميع المواد أولاً'}
                              </button>
                            )
                          ) : (
                            <div className="w-full flex items-center justify-center gap-2 py-4 rounded-[1rem] bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 shadow-inner">
                              <Lock className="w-4 h-4" />
                              <span className="font-black text-[13px]">{isBranchManager ? 'وضع المشاهدة الحية (شاشة فرع)' : 'وضع المشاهدة (صلاحية الإجراء للمدير فقط)'}</span>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
          .en-num { font-family: system-ui, -apple-system, sans-serif; }
        `}} />
      </div>
    </div>
  );
}