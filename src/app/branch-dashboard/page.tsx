"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  Store, Package, ShoppingCart, TrendingUp, Sparkles, 
  History, Loader2, LogOut, CheckCircle2, Clock, XCircle, 
  BarChart3, Activity, Layers, Sun, Moon, ArrowUpRight
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar-iq';

dayjs.locale('ar-iq');

export default function BranchSmartDashboard() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [orders, setOrders] = useState<any[]>([]);

  // 💡 التحقق من الجلسة وجلب بيانات الفرع 💡
  useEffect(() => {
    const session = localStorage.getItem('erp_session');
    if (!session) {
      router.push('/login');
    } else {
      const parsedSession = JSON.parse(session);
      setCurrentUser(parsedSession);
      setMounted(true);
    }
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;
    
    const fetchBranchOrders = async () => {
      setIsLoading(true);
      try {
        // جلب كل الطلبيات الخاصة بهذا الفرع (سواء كان اسم الحساب هو اسم الفرع أو مسجل كـ Branch)
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id, created_at, status, invoice_number, order_type,
            branches (name),
            order_details (
              quantity,
              items (name, main_unit, primary_unit, categories(name, color))
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // فلترة الطلبيات لتطابق الفرع الحالي
        const branchOrders = (data || []).filter((o: any) => 
          o.branches?.name === currentUser.name || 
          o.branches?.name === currentUser.branch ||
          o.branch_id === currentUser.id
        );

        setOrders(branchOrders);
      } catch (err) {
        console.error("Error fetching branch orders:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranchOrders();
  }, [currentUser]);

  // 💡 حساب إحصائيات الفرع والاستهلاك 💡
  const analytics = useMemo(() => {
    // 💡 تم إصلاح المشكلة هنا بإضافة maxQty و totalItemsOrdered للـ Return الأولي 💡
    if (orders.length === 0) return { totalOrders: 0, totalItemsOrdered: 0, topItem: null, itemConsumption: [], suggestedOrder: [], maxQty: 1 };

    const consumptionMap: Record<string, { name: string, qty: number, unit: string, category: string, color: string, orderCount: number }> = {};
    let totalItemsOrdered = 0;

    orders.forEach(order => {
      // لتجنب تكرار حساب المادة أكثر من مرة في نفس الطلبية إذا حدث خطأ
      const itemsInThisOrder = new Set(); 

      order.order_details?.forEach((detail: any) => {
        if (!detail.items) return;
        const itemName = detail.items.name;
        const qty = Number(detail.quantity) || 0;
        const unit = detail.items.main_unit || detail.items.primary_unit || 'وحدة';
        const catName = detail.items.categories?.name || 'عام';
        const catColor = detail.items.categories?.color || '#cbd5e1';

        if (!consumptionMap[itemName]) {
          consumptionMap[itemName] = { name: itemName, qty: 0, unit, category: catName, color: catColor, orderCount: 0 };
        }
        
        consumptionMap[itemName].qty += qty;
        totalItemsOrdered += qty;

        if (!itemsInThisOrder.has(itemName)) {
          consumptionMap[itemName].orderCount += 1;
          itemsInThisOrder.add(itemName);
        }
      });
    });

    const consumptionList = Object.values(consumptionMap).sort((a, b) => b.qty - a.qty);
    const topItem = consumptionList.length > 0 ? consumptionList[0] : null;

    // 💡 خوارزمية الطلبية المقترحة (الذكاء الاستهلاكي) 💡
    // تقترح المواد بناءً على معدل الاستهلاك في الطلبيات السابقة
    const totalOrdersCount = orders.length;
    const suggestedOrder = consumptionList
      .filter(item => item.orderCount >= (totalOrdersCount * 0.3)) // المادة تنطلب بـ 30% من الطلبيات على الأقل
      .map(item => {
        // حساب متوسط الطلب للمادة في الطلبية الواحدة
        const averageQty = item.qty / totalOrdersCount;
        // تقريب الكمية لأقرب رقم صحيح منطقي
        const suggestedQty = Math.ceil(averageQty);
        return { ...item, suggestedQty };
      })
      .filter(item => item.suggestedQty > 0)
      .slice(0, 12); // نقترح أهم 12 مادة فقط

    // استخراج أقصى كمية مطلوبة لرسم شريط التقدم (Progress Bar)
    const maxQty = topItem ? topItem.qty : 1;

    return { totalOrders: totalOrdersCount, totalItemsOrdered, topItem, itemConsumption: consumptionList, suggestedOrder, maxQty };
  }, [orders]);

  const handleLogout = () => {
    localStorage.removeItem('erp_session');
    router.push('/login');
  };

  if (!mounted || !currentUser) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white font-sans pb-24 transition-colors duration-300" dir="rtl">
        
        {/* خلفية جمالية */}
        <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 dark:from-indigo-900/20 via-transparent dark:via-[#050505] to-transparent dark:to-[#050505] -z-10 pointer-events-none transition-colors duration-500"></div>

        {/* الهيدر العلوي */}
        <header className="px-6 py-4 flex justify-between items-center bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-200 dark:border-white/5 shadow-sm transition-colors duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[1rem] bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-[16px] font-black leading-tight text-slate-900 dark:text-white">بوابة الفرع الذكية</h2>
              <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{currentUser.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors outline-none cursor-pointer active:scale-95">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className="p-2.5 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 active:scale-95 outline-none transition-colors cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-500/20">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-8 mt-4">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
              <p className="text-slate-500 font-bold">جاري تحميل بيانات الفرع...</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              {/* ==================================================== */}
              {/* 1️⃣ بطاقات الإحصائيات السريعة */}
              {/* ==================================================== */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white dark:bg-[#121214] p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl shadow-sm dark:shadow-inner"><ShoppingCart className="w-6 h-6"/></div>
                    <span className="text-[11px] font-black text-slate-400 bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-lg border border-slate-100 dark:border-white/5 shadow-inner">الطلبيات الكلية</span>
                  </div>
                  <div>
                    <h3 className="text-4xl font-black text-slate-800 dark:text-white en-num">{analytics.totalOrders}</h3>
                    <p className="text-[12px] font-bold text-slate-500 mt-2">إجمالي فواتير السحب المعتمدة للفرع</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#121214] p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-sm dark:shadow-inner"><TrendingUp className="w-6 h-6"/></div>
                    <span className="text-[11px] font-black text-slate-400 bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-lg border border-slate-100 dark:border-white/5 shadow-inner">المادة الأكثر طلباً</span>
                  </div>
                  <div>
                    <h3 className="text-[20px] font-black text-slate-800 dark:text-white truncate" title={analytics.topItem?.name || 'لا يوجد'}>
                      {analytics.topItem?.name || 'لا توجد بيانات'}
                    </h3>
                    <p className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                      تم سحب <span className="en-num">{analytics.topItem?.qty || 0}</span> {analytics.topItem?.unit || ''}
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#121214] p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-2 h-full bg-amber-500"></div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl shadow-sm dark:shadow-inner"><Package className="w-6 h-6"/></div>
                    <span className="text-[11px] font-black text-slate-400 bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-lg border border-slate-100 dark:border-white/5 shadow-inner">حجم الاستهلاك</span>
                  </div>
                  <div>
                    <h3 className="text-4xl font-black text-slate-800 dark:text-white en-num">{analytics.itemConsumption.length}</h3>
                    <p className="text-[12px] font-bold text-slate-500 mt-2">نوع مختلف من المواد تم سحبه للفرع</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* ==================================================== */}
                {/* 2️⃣ الطلبية المقترحة (Smart Suggestion) */}
                {/* ==================================================== */}
                <div className="xl:col-span-1 space-y-6">
                  <div className="bg-gradient-to-br from-indigo-900 to-[#0a0a0c] p-6 rounded-[2.5rem] shadow-xl border border-indigo-500/20 relative overflow-hidden text-white">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/30 rounded-full blur-[50px] pointer-events-none"></div>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-fuchsia-500/20 rounded-full blur-[50px] pointer-events-none"></div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 shadow-inner">
                          <Sparkles className="w-6 h-6 text-indigo-300 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black tracking-tight text-white">الطلبية المقترحة الذكية</h3>
                          <p className="text-[10px] text-indigo-300 font-bold mt-0.5">بناءً على متوسط الاستهلاك السابق</p>
                        </div>
                      </div>

                      {analytics.suggestedOrder.length === 0 ? (
                        <div className="py-10 text-center bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30 text-indigo-300" />
                          <p className="text-sm font-bold text-indigo-200">لا توجد بيانات كافية لاقتراح طلبية.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 mb-6 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                          {analytics.suggestedOrder.map((item, idx) => (
                            <div key={idx} className="bg-white/10 backdrop-blur-md border border-white/10 p-3.5 rounded-xl flex items-center justify-between hover:bg-white/20 transition-colors cursor-default">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center font-black text-[11px] text-indigo-300 border border-white/5 shrink-0 shadow-inner">
                                  <span dir="ltr">{idx + 1}</span>
                                </div>
                                <div className="max-w-[140px]">
                                  <p className="font-black text-[13px] text-white truncate" title={item.name}>{item.name}</p>
                                  <p className="text-[9px] font-bold text-indigo-300 mt-0.5 truncate">{item.category}</p>
                                </div>
                              </div>
                              <div className="bg-indigo-500/20 border border-indigo-400/30 px-3 py-1.5 rounded-lg text-center shadow-inner shrink-0 min-w-[70px]">
                                <span className="block text-[15px] font-black text-indigo-200 leading-none en-num drop-shadow-md">{item.suggestedQty}</span>
                                <span className="block text-[9px] font-bold text-indigo-300/80 mt-1">{item.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button onClick={() => router.push('/pos')} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-black py-4 rounded-2xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] outline-none active:scale-95 flex items-center justify-center gap-2">
                        إنشاء طلبية من المقترح <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-2 space-y-8">
                  {/* ==================================================== */}
                  {/* 3️⃣ جدول المواد المستهلكة (تفصيلي) */}
                  {/* ==================================================== */}
                  <div>
                    <h3 className="text-[15px] font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-500" /> تحليل استهلاك المواد (تفصيلي)
                    </h3>
                    <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[2rem] p-5 shadow-sm">
                      {analytics.itemConsumption.length === 0 ? (
                        <p className="text-center text-sm font-bold text-slate-500 py-10">لم يتم سحب أي مواد حتى الآن.</p>
                      ) : (
                        <div className="max-h-[350px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                          {analytics.itemConsumption.map((item, idx) => {
                            const progress = Math.max(2, (item.qty / analytics.maxQty) * 100);
                            return (
                              <div key={idx} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex flex-col gap-3 shadow-sm transition-colors hover:border-emerald-200 dark:hover:border-emerald-500/30">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 flex items-center justify-center font-black text-slate-500 dark:text-slate-400 text-sm shrink-0 shadow-inner">
                                      <span dir="ltr">{idx + 1}</span>
                                    </div>
                                    <div>
                                      <h4 className="font-black text-[14px] text-slate-900 dark:text-white">{item.name}</h4>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5 flex items-center gap-1 shadow-sm"><Layers className="w-3 h-3"/> {item.category}</span>
                                        <span className="text-[10px] font-bold text-slate-500">تم الطلب {item.orderCount} مرات</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-2 rounded-xl text-center min-w-[80px] shadow-sm dark:shadow-inner">
                                    <span className="block text-lg font-black text-emerald-600 dark:text-emerald-400 en-num leading-none">{item.qty}</span>
                                    <span className="block text-[10px] font-bold text-emerald-600/70 dark:text-emerald-500/70 mt-1">{item.unit}</span>
                                  </div>
                                </div>
                                {/* شريط التقدم اللوني */}
                                <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 overflow-hidden shadow-inner">
                                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, backgroundColor: item.color }}></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ==================================================== */}
                  {/* 4️⃣ سجل الطلبات الأخيرة */}
                  {/* ==================================================== */}
                  <div>
                    <h3 className="text-[15px] font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                      <History className="w-5 h-5 text-blue-500" /> سجل الطلبيات الأخيرة
                    </h3>
                    <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[2rem] p-5 shadow-sm">
                      {orders.length === 0 ? (
                        <p className="text-center text-sm font-bold text-slate-500 py-10">لا يوجد سجل طلبيات سابق.</p>
                      ) : (
                        <div className="space-y-3">
                          {orders.slice(0, 5).map((order) => (
                            <div key={order.id} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-sm transition-colors hover:bg-slate-100 dark:hover:bg-[#1a1a24]">
                              <div>
                                <h4 className="font-black text-[14px] text-slate-900 dark:text-white flex items-center gap-2">
                                  فاتورة: <span className="en-num text-indigo-500 dark:text-indigo-400">#{order.invoice_number || '0000'}</span>
                                </h4>
                                <p className="text-[11px] font-bold text-slate-500 mt-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {dayjs(order.created_at).format('YYYY-MM-DD | hh:mm A')}</p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className={`text-[11px] font-black px-3 py-1 rounded-lg border shadow-sm dark:shadow-inner ${
                                  order.status === 'قيد الانتظار' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30' :
                                  order.status === 'قيد التجهيز' ? 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30' :
                                  order.status === 'مرفوض' || order.status === 'ملغى' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30' :
                                  'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                                }`}>
                                  {order.status}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-[#121214] px-2 py-0.5 rounded border border-slate-200 dark:border-white/5">{order.order_type || 'طلب عام'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}
        </main>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; }
        .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
      `}} />
    </div>
  );
}