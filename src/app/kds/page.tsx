"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { toast } from 'sonner'; 
import { 
  ChefHat, Clock, Store, Package, CheckCircle2, 
  Loader2, Edit, X, Plus, Minus, MonitorPlay, Save, Layers, Trash2, ListChecks,
  Sun, Moon, Lock, ShieldCheck, ShieldAlert, UtensilsCrossed, Receipt, BarChart3
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
  if (!type) return isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700';
  if (type.includes('طارئ') || type.includes('نقص')) return 'bg-rose-500 text-white';
  if (type.includes('استرجاع')) return 'bg-amber-500 text-white';
  if (type.includes('تحويل')) return 'bg-fuchsia-500 text-white';
  if (type.includes('دعم')) return 'bg-teal-500 text-white';
  return isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'; 
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
      
      if (['Admin', 'AsstManager', 'Accountant', 'Chef'].includes(session.role)) {
        setIsManager(true);
      }
      
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
    if (!isManager) return;
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
    if (max <= 5) {
      return (
        <div className="flex items-center gap-1 shrink-0" dir="ltr">
          {Array.from({ length: max }).map((_, i) => (
            <div key={i} className={`transition-all duration-200 rounded-full ${
              i < current 
              ? 'w-2.5 h-2.5 bg-emerald-500 shadow-sm scale-110' 
              : 'w-2 h-2 bg-slate-300 dark:bg-slate-600'
            }`} />
          ))}
        </div>
      );
    }
    
    return (
      <div className={`px-2 py-0.5 rounded text-[10px] font-black en-num min-w-[35px] text-center shrink-0 transition-colors ${
        current === max 
        ? 'bg-emerald-500 text-white shadow-sm' 
        : current > 0 
          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' 
          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
      }`}>
        {current}/{max}
      </div>
    );
  };

  const aggregatedData = getAggregatedData();
  
  // 💡 تحديد نوع الشاشة النشطة بذكاء 💡
  let viewMode = 'orders';
  let selectedCategory = null;

  if (activeTab === 'summary') {
    viewMode = 'summary';
  } else if (activeTab !== 'orders') {
    selectedCategory = aggregatedData.find((c: any) => c.name === activeTab);
    if (selectedCategory) {
      viewMode = 'category';
    } else {
      // إذا اختفى القسم لعدم وجود طلبات، نرجع للتكتات
      viewMode = 'orders';
    }
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-3 ${isDark ? 'bg-[#0a0a0f]' : 'bg-slate-50'}`}>
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className={`font-black text-xs uppercase tracking-widest animate-pulse ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>جاري تحميل المطبخ...</p>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0f] text-slate-900 dark:text-white font-sans flex flex-col overflow-hidden relative transition-colors duration-300 pb-[80px]" dir="rtl">
        
        {/* 🌟 هيدر شاشة المطبخ (ملموم ومدمج) 🌟 */}
        <div className="bg-white dark:bg-[#12121a] border-b border-slate-200 dark:border-slate-800 p-3 md:p-4 shrink-0 shadow-sm relative z-20 transition-colors duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 w-full">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 p-2.5 rounded-xl shrink-0">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-tight">
                  {isBranchManager ? 'متابعة التجهيز' : 'شاشة المطبخ (KDS)'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  {activeOrders.length} طلبات قيد التجهيز
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
              {/* 💡 أزرار التجميع مدمجة بالهيدر 💡 */}
              {!isBranchManager && (
                <div className="flex gap-1.5 shrink-0">
                  <button 
                    onClick={() => setActiveTab('orders')}
                    className={`px-4 py-2 rounded-lg font-black text-xs transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
                      viewMode === 'orders'
                      ? 'bg-rose-500 text-white shadow-sm' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Receipt className="w-4 h-4"/> التكتات (الفواتير)
                  </button>
                  
                  {/* 💡 زر التبويب الجديد (خلاصة المجاميع) 💡 */}
                  <button 
                    onClick={() => setActiveTab('summary')}
                    className={`px-4 py-2 rounded-lg font-black text-xs transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
                      viewMode === 'summary'
                      ? 'bg-amber-500 text-white shadow-sm' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4"/> خلاصة المجاميع
                  </button>

                  {aggregatedData.map((cat: any, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveTab(cat.name)}
                      className={`px-4 py-2 rounded-lg font-black text-xs transition-all whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
                        activeTab === cat.name 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <ListChecks className="w-4 h-4"/> {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {activeOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative">
            <div className="bg-slate-100 dark:bg-slate-800/50 p-6 rounded-full mb-4">
              <ChefHat className="w-16 h-16 text-slate-300 dark:text-slate-600" />
            </div>
            <h2 className="text-xl font-black text-slate-700 dark:text-slate-300 mb-1">المطبخ فارغ</h2>
            <p className="text-slate-500 dark:text-slate-500 font-bold text-xs">لا توجد أي طلبيات قيد التجهيز حالياً.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 z-10 relative">
            <div className="w-full">
              
              {/* 🌟 1️⃣ شاشة خلاصة المجاميع (المجموع لكل قسم وحسب الصنف) 🌟 */}
              {viewMode === 'summary' && !isBranchManager && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-300">
                  {aggregatedData.map((category: any, idx: number) => {
                    const catTotalQty = category.items.reduce((sum: number, item: any) => sum + item.total, 0);
                    return (
                      <div key={idx} className="bg-white dark:bg-[#12121a] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
                        {/* رأس القسم */}
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/50 flex justify-between items-center">
                          <h3 className="font-black text-[15px] text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                            <Layers className="w-5 h-5"/> {category.name}
                          </h3>
                          <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-700/50 flex flex-col items-center shadow-sm">
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-0.5">إجمالي القسم</span>
                            <span className="text-[16px] font-black en-num leading-none">{catTotalQty}</span>
                          </div>
                        </div>
                        {/* محتويات القسم */}
                        <div className="p-3 space-y-2 flex-1 overflow-y-auto custom-scrollbar max-h-[60vh]">
                          {category.items.map((item: any, iIdx: number) => (
                            <div key={iIdx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-[#1a1a24] rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-colors">
                              <span className="font-bold text-[14px] text-slate-800 dark:text-slate-200 truncate pr-2">{item.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0 bg-white dark:bg-[#12121a] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                <span className="font-black text-[16px] en-num text-emerald-600 dark:text-emerald-400">{item.total}</span>
                                <span className="text-[10px] font-bold text-slate-400">{item.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 🌟 2️⃣ شاشة القسم المحدد (Matrix) 🌟 */}
              {viewMode === 'category' && selectedCategory && !isBranchManager && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 animate-in fade-in duration-300">
                  {selectedCategory.items.map((item: any, itemIdx: number) => {
                    const totalQty = Number(item.total) || 0;
                    const completedQty = Object.entries(item.branches).reduce((sum: number, [branch, qty]: any) => {
                      return sum + (completedItems[`matrix-${selectedCategory.name}-${item.name}-${branch}`] || 0);
                    }, 0);
                    const isAllBranchesCompleted = completedQty >= totalQty && totalQty > 0;

                    return (
                      <div key={itemIdx} className={`bg-white dark:bg-[#12121a] rounded-xl flex flex-col relative overflow-hidden transition-all border ${isAllBranchesCompleted ? 'border-emerald-400 shadow-sm' : 'border-slate-200 dark:border-slate-800'}`}>
                        {completedQty > 0 && !isAllBranchesCompleted && (
                          <div className="absolute top-0 right-0 h-full bg-emerald-50 dark:bg-emerald-900/20 transition-all duration-300 z-0" style={{ width: `${(completedQty / totalQty) * 100}%` }}></div>
                        )}
                        
                        <div className="p-3 relative z-10 flex flex-col h-full">
                          <div className="flex justify-between items-start mb-3 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                            <h3 className={`text-[13px] font-black leading-tight pr-1 ${isAllBranchesCompleted ? 'text-emerald-600 dark:text-emerald-400 line-through opacity-70' : 'text-slate-800 dark:text-slate-200'}`}>
                              {item.name}
                            </h3>
                            <div className={`px-2 py-1 rounded-md flex flex-col items-center shrink-0 border ${isAllBranchesCompleted ? 'bg-transparent border-emerald-200 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white border-slate-200 dark:border-slate-700'}`}>
                              <span className="text-lg font-black en-num leading-none">{item.total}</span>
                            </div>
                          </div>

                          <div className="space-y-1.5 mt-auto">
                            {Object.entries(item.branches).map(([branch, bQty]: any, bIdx) => {
                              const maxBranchQty = Number(bQty);
                              const uniqueBranchId = `matrix-${selectedCategory.name}-${item.name}-${branch}`;
                              const branchCompletedQty = completedItems[uniqueBranchId] || 0;
                              const isBranchCompleted = branchCompletedQty >= maxBranchQty;

                              return (
                                <div 
                                  key={bIdx} 
                                  onClick={() => { if (isManager) toggleItemCompletion(uniqueBranchId, maxBranchQty); }}
                                  className={`flex justify-between items-center px-2.5 py-2 rounded-lg border text-xs ${isManager ? 'cursor-pointer active:scale-[0.98]' : ''} transition-all relative overflow-hidden ${
                                    isBranchCompleted 
                                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 opacity-70' 
                                    : 'bg-slate-50 dark:bg-[#1a1a24] border-slate-200 dark:border-slate-800'
                                  }`}
                                >
                                  {branchCompletedQty > 0 && !isBranchCompleted && (
                                    <div className="absolute top-0 right-0 h-full bg-emerald-100 dark:bg-emerald-800/30 transition-all duration-300 z-0" style={{ width: `${(branchCompletedQty / maxBranchQty) * 100}%` }}></div>
                                  )}
                                  <div className="flex items-center gap-2 relative z-10 w-full">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 transition-colors ${isBranchCompleted ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
                                      {isBranchCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className={`font-bold truncate transition-all ${isBranchCompleted ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}>{branch}</span>
                                    <div className="mr-auto">
                                      <ProgressIndicator current={branchCompletedQty} max={maxBranchQty} />
                                    </div>
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
              )}

              {/* 🌟 3️⃣ شاشة الطلبيات الفردية (تكت المطبخ المحدث) 🌟 */}
              {viewMode === 'orders' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start w-full animate-in fade-in duration-300">
                  {activeOrders.map((order) => {
                    const waitMinutes = currentTime.diff(dayjs(order.created_at), 'minute');
                    const isLate = waitMinutes >= 30; 
                    const isEditingThis = editingOrderId === order.id;
                    const detailsToRender = isEditingThis ? editedDetails : order.order_details;

                    const totalOrderQty = detailsToRender.reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0);
                    const completedOrderQty = detailsToRender.reduce((sum: number, d: any, idx: number) => sum + (completedItems[`order-${order.id}-detail-${d.id || idx}`] || 0), 0);
                    const isOrderFullyCompleted = completedOrderQty >= totalOrderQty && totalOrderQty > 0;

                    // تجميع المواد حسب الأقسام
                    const groupedDetails = detailsToRender.reduce((acc: any, detail: any) => {
                      const catName = detail.items?.categories?.name || 'عام';
                      const catSeq = detail.items?.categories?.sequence || 999;
                      if (!acc[catName]) acc[catName] = { name: catName, sequence: catSeq, items: [] };
                      acc[catName].items.push(detail);
                      return acc;
                    }, {});
                    const sortedCategories = Object.values(groupedDetails).sort((a: any, b: any) => a.sequence - b.sequence);

                    return (
                      <div 
                        key={order.id} 
                        className={`flex flex-col rounded-2xl overflow-hidden transition-all duration-300 shadow-lg border-2 ${
                          isEditingThis ? 'bg-white dark:bg-[#12121a] border-amber-400' :
                          isLate ? 'bg-white dark:bg-[#12121a] border-rose-500' : 
                          isOrderFullyCompleted ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-500 opacity-95' :
                          'bg-white dark:bg-[#12121a] border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className={`px-4 py-3 flex justify-between items-start border-b-2 border-dashed ${
                          isEditingThis ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-800' : 
                          isLate ? 'bg-rose-100 dark:bg-rose-900/50 border-rose-300 dark:border-rose-800' : 
                          isOrderFullyCompleted ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-300 dark:border-emerald-800' :
                          'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700'
                        }`}>
                          <div className="flex-1 min-w-0">
                            <h3 className={`text-[18px] font-black truncate mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {order.branches?.name || 'مجهول'}
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[10px] font-black bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-sm">
                                {order.branches?.agencies?.name || 'عامة'}
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-sm ${getOrderTypeColor(order.order_type, isDark)}`}>
                                {order.order_type || 'طلب عام'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-[14px] font-black bg-slate-900 dark:bg-black text-white px-2.5 py-1 rounded border border-slate-700 en-num tracking-wider shadow-inner">
                              #{order.invoice_number || '00'}
                            </span>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded font-black text-[11px] shadow-sm ${isLate ? 'bg-rose-600 text-white animate-pulse' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600'}`}>
                              <Clock className="w-3.5 h-3.5" />
                              {calculateWaitTime(order.created_at)}
                            </div>
                          </div>
                        </div>

                        {order.notes && (
                          <div className="px-3 py-2 text-[12px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-b border-amber-100 dark:border-amber-800/50">
                            ⚠️ {order.notes}
                          </div>
                        )}

                        <div className="px-4 py-2 bg-slate-50 dark:bg-[#0a0a0f] border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                           <span className="text-[11px] font-black text-slate-500 uppercase">إجمالي الطلبية:</span>
                           <span className="text-[13px] font-black bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md en-num shadow-inner">
                             {completedOrderQty} / {totalOrderQty}
                           </span>
                        </div>

                        <div className="flex-1 p-2.5 overflow-y-auto custom-scrollbar max-h-[45vh] space-y-3 bg-white dark:bg-[#12121a]">
                          {sortedCategories.map((category: any, catIdx: number) => {
                            const catTotalQty = category.items.reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0);
                            const catCompletedQty = category.items.reduce((sum: number, d: any, idx: number) => sum + (completedItems[`order-${order.id}-detail-${d.id || idx}`] || 0), 0);
                            const isCatCompleted = catCompletedQty >= catTotalQty && catTotalQty > 0;

                            return (
                              <div key={catIdx} className="space-y-1.5 bg-slate-50 dark:bg-[#1a1a24] rounded-xl p-2 border border-slate-100 dark:border-slate-800/50">
                                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700/50 pb-1.5 px-1">
                                  <h4 className={`text-[12px] font-black ${isCatCompleted ? 'text-emerald-500 line-through opacity-70' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                    {category.name}
                                  </h4>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded en-num ${isCatCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'}`}>
                                    القسم: {catTotalQty}
                                  </span>
                                </div>
                                
                                {category.items.map((detail: any, idx: number) => {
                                  const maxDetailQty = Number(detail.quantity) || 0;
                                  const uniqueDetailId = `order-${order.id}-detail-${detail.id || idx}`;
                                  const currentCompletedQty = completedItems[uniqueDetailId] || 0;
                                  const isItemCompleted = currentCompletedQty >= maxDetailQty && maxDetailQty > 0;

                                  return (
                                    <div 
                                      key={idx}
                                      onClick={() => { if(!isEditingThis && isManager) toggleItemCompletion(uniqueDetailId, maxDetailQty); }}
                                      className={`flex justify-between items-center p-2.5 rounded-lg border text-sm ${isManager && !isEditingThis ? 'cursor-pointer active:scale-[0.98]' : ''} transition-all relative overflow-hidden ${
                                        isEditingThis ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700' :
                                        isItemCompleted ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 opacity-60' :
                                        'bg-white dark:bg-[#15151e] border-slate-200 dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-500'
                                      }`}
                                    >
                                      {currentCompletedQty > 0 && !isItemCompleted && !isEditingThis && (
                                        <div className="absolute top-0 right-0 h-full bg-emerald-100/50 dark:bg-emerald-800/30 transition-all duration-300 z-0" style={{ width: `${(currentCompletedQty / maxDetailQty) * 100}%` }}></div>
                                      )}

                                      <div className="flex items-center gap-2.5 relative z-10 w-full">
                                        {!isEditingThis && (
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors ${isItemCompleted ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
                                            {isItemCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                          </div>
                                        )}
                                        <span className={`font-black text-[13px] leading-tight transition-all pr-1 ${isItemCompleted && !isEditingThis ? 'line-through text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                                          {detail.items?.name || 'مادة محذوفة'}
                                        </span>
                                        
                                        <div className="mr-auto shrink-0 flex items-center">
                                          {isEditingThis ? (
                                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1 shadow-inner">
                                              <button onClick={() => handleDecrement(detail.id)} className="w-7 h-7 flex items-center justify-center bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-md active:scale-95"><Minus className="w-4 h-4"/></button>
                                              <span className="w-7 text-center font-black text-[15px] en-num">{detail.quantity}</span>
                                              <button onClick={() => handleIncrement(detail.id)} className="w-7 h-7 flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md active:scale-95"><Plus className="w-4 h-4"/></button>
                                            </div>
                                          ) : (
                                            <span className={`font-black text-[16px] en-num px-2.5 py-0.5 rounded-md border ${isItemCompleted ? 'bg-transparent border-transparent text-emerald-600' : 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 shadow-sm'}`}>
                                              {detail.quantity}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>

                        <div className="p-3 border-t-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1a1a24]">
                          {isManager ? (
                            isEditingThis ? (
                              <div className="flex gap-2">
                                <button onClick={() => handleSaveEdits(order)} disabled={processingId === order.id} className="flex-1 bg-emerald-600 text-white font-black text-[13px] py-3 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 shadow-md">
                                  {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} حفظ
                                </button>
                                <button onClick={cancelEditing} className="flex-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 font-black text-[13px] py-3 rounded-xl active:scale-95 shadow-sm">
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <button 
                                  onClick={() => markAsCompleted(order)}
                                  disabled={processingId === order.id || !isOrderFullyCompleted}
                                  className={`w-full font-black text-[14px] py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all outline-none ${
                                    isOrderFullyCompleted
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:scale-95'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                                  }`}
                                >
                                  {processingId === order.id ? <Loader2 className="w-5 h-5 animate-spin"/> : isOrderFullyCompleted ? <CheckCircle2 className="w-5 h-5"/> : <Lock className="w-5 h-5"/>}
                                  {isOrderFullyCompleted ? 'تأكيد وتجهيز (ترحيل)' : 'أشر جميع المواد أولاً'}
                                </button>
                                
                                <div className="flex justify-between items-center px-2 mt-1">
                                  <button onClick={() => startEditing(order)} className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 opacity-80 hover:opacity-100 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg active:scale-95">
                                    <Edit className="w-3.5 h-3.5"/> تعديل
                                  </button>
                                  <button onClick={() => handleDeleteOrder(order)} className="text-[11px] font-black text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5 opacity-60 hover:opacity-100 active:scale-95">
                                    <Trash2 className="w-3.5 h-3.5"/> حذف
                                  </button>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="w-full text-center py-3 text-[11px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center gap-1.5">
                              <Lock className="w-4 h-4" /> وضع المشاهدة فقط
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
          .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
        `}} />
      </div>
    </div>
  );
}