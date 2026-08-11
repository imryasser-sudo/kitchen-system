"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTheme } from '@/components/ThemeProvider'; 
import dayjs from 'dayjs';
import 'dayjs/locale/ar-iq';

import { 
  Wallet, FileText, CalendarDays, LogOut, CheckCircle2, XCircle, 
  Loader2, Banknote, ShieldCheck, CreditCard, AlertTriangle, MonitorPlay, 
  QrCode, ChevronDown, Clock, Phone, HeartPulse, ReceiptText, TrendingUp,
  User, Sun, Moon, UserCheck, UserX, Ban, DollarSign, Briefcase, TrendingDown, Info,
  Store, Package, ShoppingCart, Sparkles, History, BarChart3, Activity, Layers, ArrowUpRight, BellRing, ClipboardCheck
} from 'lucide-react';

dayjs.locale('ar-iq');

const leaveReasons = [
  "إجازة شهرية اعتيادية", "أسباب شخصية / التزامات خاصة", "إجازة مرضية / مراجعة طبيب",
  "إجازة سنوية / استراحة اعتيادية", "ظرف عائلي طارئ / حالة وفاة", "زواج / مناسبة عائلية خاصة",
  "مراجعة دوائر حكومية / تخليص معاملات", "إجازة أمومة / رعاية طفل", "إجازة دراسية / أداء امتحانات",
  "السفر خارج البلاد", "أخرى (يرجى التوضيح)"
];

const advanceReasons = [
  "مصاريف شخصية / احتياجات خاصة", "حالة طبية طارئة / مصاريف علاج", "إيجار سكن متأخر / التزامات سكنية",
  "رسوم دراسية / أقساط مدارس وجامعات", "صيانة سيارة / حادث مروري طارئ", "مصاريف زواج / خطوبة",
  "سداد ديون مستعجلة", "صيانة المنزل / ترميمات ضرورية", "مصاريف عائلية طارئة", "أخرى (يرجى التوضيح)"
];

const leaveDurations = [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30];

const getInitials = (name: string) => name ? name.split(' ').map((n: string) => n[0]).join('').substring(0, 2) : '؟';

// 💡 دالة تشغيل صوت الإشعار 💡
const playNotificationSound = () => {
  try {
    const audio = new Audio('https://actions.google.com/sounds/v1/alarms/friendly_chime.ogg');
    audio.play().catch((err) => console.log('المتصفح يمنع تشغيل الصوت تلقائياً بدون تفاعل المستخدم', err));
  } catch (error) {
    console.error("خطأ في تشغيل الصوت", error);
  }
};

// ==========================================
// 1️⃣ شاشة إدارة الفرع (Branch Smart Dashboard)
// ==========================================
function BranchDashboard({ currentUser, handleLogout, isDark, toggleTheme, router }: any) {
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  
  // 💡 حساس قراءة التبويب من الشريط السفلي (يشمل الإشعارات) 💡
  const [currentHash, setCurrentHash] = useState('id_card');

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      setCurrentHash(hash || 'id_card');
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    
    const handleTabChange = (e: any) => {
      setCurrentHash(e.detail || 'id_card');
    };
    window.addEventListener('change-tab', handleTabChange);

    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('change-tab', handleTabChange);
    };
  }, []);

  const fetchBranchOrders = async (showNotification = false) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, created_at, status, invoice_number, order_type, branch_id,
          branches (name),
          order_details (
            quantity,
            items (name, main_unit, primary_unit, categories(name, color))
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const branchOrders = (data || []).filter((o: any) => 
        o.branches?.name === currentUser.name || 
        o.branches?.name === currentUser.branch ||
        o.branch_id === currentUser.id
      );

      setOrders(branchOrders);

      if (showNotification) {
        playNotificationSound();
        toast.success('تم استلام إشعار جديد أو تحديث على الطلبية!', {
          icon: <BellRing className="w-5 h-5 text-emerald-500" />,
          duration: 5000,
        });
      }
    } catch (err) {
      console.error("Error fetching branch orders:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranchOrders();

    const channel = supabase
      .channel('branch_orders_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
        if (
          payload.new?.branch_id === currentUser.id || 
          payload.new?.status === 'بانتظار الاعتماد' 
        ) {
          fetchBranchOrders(true); 
        } else {
          fetchBranchOrders(false);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const pendingApprovals = useMemo(() => {
    return orders.filter(o => o.status === 'بانتظار الاعتماد' || o.status === 'قيد الانتظار' || o.status === 'جاهز للاستلام');
  }, [orders]);

  const analytics = useMemo(() => {
    if (orders.length === 0) return { totalOrders: 0, totalItemsOrdered: 0, topItem: null, itemConsumption: [], suggestedOrder: [], maxQty: 1 };

    const consumptionMap: Record<string, { name: string, qty: number, unit: string, category: string, color: string, orderCount: number }> = {};
    let totalItemsOrdered = 0;

    orders.forEach(order => {
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

    const totalOrdersCount = orders.length;
    const suggestedOrder = consumptionList
      .filter(item => item.orderCount >= (totalOrdersCount * 0.3))
      .map(item => ({ ...item, suggestedQty: Math.ceil(item.qty / totalOrdersCount) }))
      .filter(item => item.suggestedQty > 0)
      .slice(0, 12);

    const maxQty = topItem ? topItem.qty : 1;

    return { totalOrders: totalOrdersCount, totalItemsOrdered, topItem, itemConsumption: consumptionList, suggestedOrder, maxQty };
  }, [orders]);

  // 💡 تغذية الإشعارات الذكية (تبويب الإشعارات الجديد) 💡
  const notificationsList = useMemo(() => {
    return orders.map(order => {
       let title = '';
       let icon = null;
       let bgColor = '';
       let textColor = '';
       
       if (order.status === 'قيد الانتظار') {
         title = `تم إرسال الطلبية #${order.invoice_number || '0000'} بانتظار استلام المطبخ`;
         icon = <Clock className="w-5 h-5 text-amber-500" />;
         bgColor = 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20';
         textColor = 'text-amber-700 dark:text-amber-400';
       } else if (order.status === 'قيد التجهيز') {
         title = `جاري تجهيز الطلبية #${order.invoice_number || '0000'} في المطبخ المركزي`;
         icon = <Loader2 className="w-5 h-5 text-sky-500 animate-spin" />;
         bgColor = 'bg-sky-50 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/20';
         textColor = 'text-sky-700 dark:text-sky-400';
       } else if (order.status === 'بانتظار الاعتماد' || order.status === 'جاهز للاستلام') {
         title = `الطلبية #${order.invoice_number || '0000'} جاهزة وتحتاج اعتمادك (تأكيد الاستلام)`;
         icon = <BellRing className="w-5 h-5 text-rose-500 animate-pulse" />;
         bgColor = 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30';
         textColor = 'text-rose-700 dark:text-rose-400';
       } else if (order.status === 'مكتمل') {
         title = `تم استلام واعتماد الطلبية #${order.invoice_number || '0000'} بنجاح`;
         icon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
         bgColor = 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20';
         textColor = 'text-emerald-700 dark:text-emerald-400';
       } else {
         title = `تحديث حالة الطلبية #${order.invoice_number || '0000'}: ${order.status}`;
         icon = <Info className="w-5 h-5 text-slate-500" />;
         bgColor = 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-white/10';
         textColor = 'text-slate-700 dark:text-slate-300';
       }

       return { ...order, notifTitle: title, icon, bgColor, textColor };
    });
  }, [orders]);

  const handleApproveOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.from('orders').update({ status: 'مكتمل' }).eq('id', orderId);
      if (error) throw error;
      toast.success('تم الاعتماد والاستلام بنجاح!');
      fetchBranchOrders();
    } catch (error) {
      toast.error('حدث خطأ أثناء الاعتماد.');
    }
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white font-sans pb-24 transition-colors duration-300" dir="rtl">
        <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 dark:from-indigo-900/20 via-transparent dark:via-[#050505] to-transparent dark:to-[#050505] -z-10 pointer-events-none transition-colors duration-500"></div>

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
          ) : currentHash === 'approvals' ? (
            // ====================================================
            // 💡 شاشة الاعتمادات (الطلبيات بانتظار استلام الفرع)
            // ====================================================
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <ClipboardCheck className="w-6 h-6 text-emerald-500" /> الاعتمادات المعلقة
                  </h3>
                  <p className="text-[12px] font-bold text-slate-500 mt-1">الطلبيات الجاهزة التي تم إرسالها من المطبخ المركزي وتحتاج اعتمادك (تأكيد الاستلام).</p>
                </div>
              </div>

              {pendingApprovals.length === 0 ? (
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[2rem] p-12 shadow-sm text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-[#0a0a0c] rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5">
                    <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-2">لا توجد اعتمادات معلقة</h3>
                  <p className="text-sm font-bold text-slate-500">لقد قمت باعتماد واستلام كافة الطلبيات المرسلة لفرعك بنجاح.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {pendingApprovals.map((order) => (
                    <div key={order.id} className="bg-white dark:bg-[#121214] border border-emerald-200 dark:border-emerald-500/30 rounded-[2rem] shadow-[0_10px_30px_-10px_rgba(16,185,129,0.1)] relative overflow-hidden flex flex-col group">
                      <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
                      
                      <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-emerald-50/50 dark:bg-emerald-500/5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-md mb-2 inline-block shadow-sm">بانتظار التأكيد والاستلام</span>
                            <h4 className="font-black text-lg text-slate-900 dark:text-white">
                              طلبية <span className="en-num text-emerald-600 dark:text-emerald-400">#{order.invoice_number}</span>
                            </h4>
                            <p className="text-[11px] font-bold text-slate-500 mt-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> أُرسلت: {dayjs(order.created_at).format('YYYY-MM-DD | hh:mm A')}</p>
                          </div>
                          <div className="bg-white dark:bg-[#0a0a0c] p-2.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                            <Package className="w-6 h-6 text-slate-400" />
                          </div>
                        </div>
                      </div>

                      <div className="p-6 flex-1 bg-slate-50/50 dark:bg-transparent">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">محتويات الطلبية للاستلام:</p>
                        <ul className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                          {order.order_details?.map((detail: any, idx: number) => (
                            <li key={idx} className="flex justify-between items-center text-[13px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#0a0a0c] p-2.5 rounded-lg border border-slate-100 dark:border-white/5 shadow-sm">
                              <span className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> {detail.items?.name}
                              </span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400 en-num bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-500/20">
                                {detail.quantity} {detail.items?.main_unit}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#121214]">
                        <button 
                          onClick={() => handleApproveOrder(order.id)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm py-4 rounded-xl transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.5)] active:scale-95 flex items-center justify-center gap-2 outline-none"
                        >
                          <CheckCircle2 className="w-5 h-5" /> اعتماد الطلبية (تأكيد استلام المواد)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : currentHash === 'notifications' ? (
            // ====================================================
            // 💡 مركز الإشعارات والحركات الذكي 💡
            // ====================================================
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <BellRing className="w-6 h-6 text-amber-500" /> مركز الإشعارات والحركات
                  </h3>
                  <p className="text-[12px] font-bold text-slate-500 mt-1">تتبع أحدث الحالات لطلبيات فرعك بشكل مباشر (مكتملة، قيد التجهيز، انتظار).</p>
                </div>
              </div>

              {notificationsList.length === 0 ? (
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[2rem] p-12 shadow-sm text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-[#0a0a0c] rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5">
                    <BellRing className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  </div>
                  <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-2">لا توجد إشعارات حالياً</h3>
                  <p className="text-sm font-bold text-slate-500">صندوق الإشعارات الخاص بفرعك فارغ.</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[2rem] p-4 shadow-sm space-y-3">
                  {notificationsList.map(notif => (
                    <div key={notif.id} className={`flex items-start md:items-center gap-4 p-4 rounded-2xl border transition-colors hover:shadow-sm ${notif.bgColor}`}>
                      <div className="shrink-0 bg-white dark:bg-[#0a0a0c] p-2.5 rounded-full shadow-sm">
                        {notif.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-[13px] font-black ${notif.textColor}`}>{notif.notifTitle}</h4>
                        <p className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> {dayjs(notif.created_at).format('YYYY-MM-DD | hh:mm A')}
                        </p>
                      </div>
                      <div className="hidden md:block">
                         <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-[#121214] px-2 py-0.5 rounded border border-slate-200 dark:border-white/5 shadow-sm">
                           {notif.order_type || 'طلب عام'}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // ====================================================
            // 💡 شاشة الإحصائيات وبطاقة الهوية (الافتراضية)
            // ====================================================
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
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

// ==========================================
// 2️⃣ شاشة الموظف العادي (Employee Dashboard)
// ==========================================
function EmployeeDashboard({ currentUser, handleLogout, isDark, toggleTheme, router }: any) {
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeModal, setActiveModal] = useState<'none' | 'advance' | 'leave'>('none');
  
  const [requestData, setRequestData] = useState({ 
    amount: '', days: '1', reason: '', otherReason: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 💡 حساس التمرير الذكي للموظفين 💡
  useEffect(() => {
    const handleTabChange = (e: any) => {
      if (e.detail) {
        const targetElement = document.getElementById(e.detail);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    window.addEventListener('change-tab', handleTabChange);
    
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
    return () => window.removeEventListener('change-tab', handleTabChange);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const fetchEmployeeData = async () => {
      setIsLoading(true);
      try {
        const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
        const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');

        const { data: staffData } = await supabase.from('staff').select('*').eq('id', currentUser.id).single();
        setEmployee(staffData);

        const { data: attData } = await supabase.from('attendance').select('*').eq('employee_id', currentUser.id).gte('record_date', startOfMonth).lte('record_date', endOfMonth).order('record_date', { ascending: false });
        setAttendance(attData || []);

        const { data: adjData } = await supabase.from('payroll_adjustments').select('*').eq('employee_id', currentUser.id).gte('record_date', startOfMonth).lte('record_date', endOfMonth).order('record_date', { ascending: false });
        setAdjustments(adjData || []);

        const { data: reqData } = await supabase.from('staff_requests').select('*').eq('staff_id', currentUser.id).order('created_at', { ascending: false });
        setRequests(reqData || []);
      } catch (error) { console.error("Error:", error); } 
      finally { setIsLoading(false); }
    };
    fetchEmployeeData();
  }, [currentUser]);

  const payrollStats = useMemo(() => {
    if (!employee || (!employee.basic_salary && !employee.salary)) return null;
    const baseSalary = employee.basic_salary || employee.salary;
    
    let present = 0, absent = 0, halfDays = 0, attDeductions = 0;
    let paidLeave = 0, unpaidLeave = 0;
    
    attendance.forEach(a => {
      if (a.status === 'حاضر') present += 1;
      else if (a.status === 'نصف يوم') { present += 0.5; halfDays += 1; }
      else if (a.status === 'غائب') absent += 1;
      else if (a.status === 'إجازة براتب') paidLeave += 1;
      else if (a.status === 'إجازة بدون راتب') unpaidLeave += 1;
      
      if (a.deduction) attDeductions += Number(a.deduction);
    });

    const unpaidDays = absent + (halfDays * 0.5) + unpaidLeave;
    const absenceDeductionAmount = Math.round(unpaidDays * (baseSalary / 30));
    const earnedSalary = Math.round(Math.max(0, baseSalary - absenceDeductionAmount));

    let bonus = 0, manualDeduction = 0, advance = 0;
    adjustments.forEach(a => {
      if (a.adjustment_type === 'إضافي') bonus += Number(a.amount);
      if (a.adjustment_type === 'خصم') manualDeduction += Number(a.amount);
      if (a.adjustment_type === 'سلفة') advance += Number(a.amount);
    });

    const financialDeductions = attDeductions + manualDeduction;
    const netSalary = Math.round(earnedSalary + bonus - financialDeductions - advance);
    
    return { 
      baseSalary, present, absent, paidLeave, unpaidLeave, 
      unpaidDays, absenceDeductionAmount, bonus, advance, 
      financialDeductions, earnedSalary, netSalary 
    };
  }, [employee, attendance, adjustments]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = requestData.reason === 'أخرى (يرجى التوضيح)' ? `أخرى: ${requestData.otherReason}` : requestData.reason;
    if (!finalReason.trim() || finalReason === 'أخرى: ') { toast.error('يرجى تحديد أو كتابة سبب الطلب.'); return; }
    setIsSubmitting(true);
    try {
      const payload = {
        staff_id: currentUser.id, staff_name: currentUser.name,
        request_type: activeModal === 'advance' ? 'loan' : 'leave',
        amount_or_days: activeModal === 'advance' ? Number(requestData.amount) : Number(requestData.days),
        reason: finalReason, status: 'قيد الانتظار'
      };
      await supabase.from('staff_requests').insert([payload]);
      toast.success('تم إرسال طلبك للإدارة بنجاح!');
      setActiveModal('none'); 
      setRequestData({ amount: '', days: '1', reason: '', otherReason: '' });
      const { data } = await supabase.from('staff_requests').select('*').eq('staff_id', currentUser.id).order('created_at', { ascending: false });
      setRequests(data || []);
    } catch (err) { toast.error('حدث خطأ أثناء الإرسال'); } 
    finally { setIsSubmitting(false); }
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen font-sans pb-[100px] transition-colors duration-300 dark:bg-[#050505] bg-slate-50 text-slate-900 dark:text-white" dir="rtl">
        <header className="px-5 py-4 flex justify-between items-center bg-white/80 dark:bg-[#121214]/80 backdrop-blur-lg sticky top-0 z-40 border-b border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
              {getInitials(currentUser.name)}
            </div>
            <div>
              <h2 className="text-sm font-black leading-tight">داشبورد الموظف</h2>
              <p className="text-[10px] font-bold text-slate-500">الخدمة الذاتية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors outline-none cursor-pointer active:scale-95">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 active:scale-95 outline-none transition-all hover:bg-rose-100 dark:hover:bg-rose-500/20">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6 max-w-[800px] mx-auto space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-40"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div id="id_card" className="relative bg-gradient-to-br from-slate-900 to-slate-800 dark:from-[#1a1a24] dark:to-[#0a0a0c] rounded-[2rem] p-6 shadow-xl overflow-hidden text-white border border-slate-700/50 dark:border-white/10 scroll-mt-24">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl"></div>
                
                <div className="flex justify-between items-start relative z-10 mb-6">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-[1.2rem] bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-2xl font-black shadow-inner border border-white/20">
                      {getInitials(employee?.full_name || currentUser.name)}
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight mb-1">{employee?.full_name || currentUser.name}</h2>
                      <span className="text-[11px] font-bold bg-white/10 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">{employee?.role || currentUser.role}</span>
                    </div>
                  </div>
                  <QrCode className="w-8 h-8 text-white/30" />
                </div>

                <div className="grid grid-cols-2 gap-4 relative z-10 border-t border-white/10 pt-4 mt-2">
                  <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">الفرع / القسم</p><p className="text-[13px] font-black mt-0.5">{employee?.branch || 'عام'}</p></div>
                  <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">تاريخ المباشرة</p><p className="text-[13px] font-black mt-0.5 dir-ltr text-right">{employee?.join_date || 'غير محدد'}</p></div>
                  <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1"><Phone className="w-3 h-3"/> الهاتف الشخصي</p><p className="text-[13px] font-black mt-0.5 dir-ltr text-right">{employee?.phone || 'غير مدرج'}</p></div>
                  <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1"><HeartPulse className="w-3 h-3"/> البطاقة الصحية</p><p className="text-[13px] font-black mt-0.5 text-emerald-300 dir-ltr text-right">{employee?.health_cert_expiry || 'غير مدرج'}</p></div>
                  <div className="col-span-2 bg-white/5 p-3 rounded-xl border border-white/10 flex justify-between items-center">
                    <div><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">جهة الاتصال للطوارئ</p><p className="text-[13px] font-black mt-0.5">{employee?.emergency_contact_name || 'غير مدرج'}</p></div>
                    <p className="text-[13px] font-black dir-ltr text-rose-300">{employee?.emergency_contact_phone || '---'}</p>
                  </div>
                </div>
              </div>

              <h3 className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-2 pt-2">الخدمات السريعة (طلب سلفة/إجازة)</h3>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setActiveModal('advance');
                    setRequestData({ ...requestData, amount: '', reason: advanceReasons[0], otherReason: '' });
                  }} 
                  className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-4 rounded-[1.5rem] flex flex-col items-center gap-3 shadow-sm hover:border-amber-500/30 active:scale-95 transition-all outline-none"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center"><Banknote className="w-6 h-6"/></div>
                  <span className="text-[13px] font-black text-slate-700 dark:text-slate-300">طلب سلفة مالية</span>
                </button>
                <button 
                  onClick={() => {
                    setActiveModal('leave');
                    setRequestData({ ...requestData, days: '1', reason: leaveReasons[0], otherReason: '' });
                  }} 
                  className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-4 rounded-[1.5rem] flex flex-col items-center gap-3 shadow-sm hover:border-sky-500/30 active:scale-95 transition-all outline-none"
                >
                  <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center"><CalendarDays className="w-6 h-6"/></div>
                  <span className="text-[13px] font-black text-slate-700 dark:text-slate-300">طلب إجازة/زمنية</span>
                </button>
              </div>

              <div id="payroll" className="pt-6 border-t border-slate-200 dark:border-white/10 scroll-mt-24">
                <h3 className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-2 pb-3">ملخص الحضور والإجازات (الشهر الحالي)</h3>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-3.5 rounded-[1.2rem] text-center shadow-sm">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">حضور</p>
                    <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 en-num">{payrollStats?.present}</h3>
                  </div>
                  <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-3.5 rounded-[1.2rem] text-center shadow-sm">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">غياب مخصوم</p>
                    <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 en-num">{payrollStats?.absent}</h3>
                  </div>
                  <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-3.5 rounded-[1.2rem] text-center shadow-sm">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">إجازة (بدون راتب)</p>
                    <h3 className="text-xl font-black text-amber-600 dark:text-amber-400 en-num">{payrollStats?.unpaidLeave}</h3>
                  </div>
                  <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-3.5 rounded-[1.2rem] text-center shadow-sm">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">إجازة (براتب)</p>
                    <h3 className="text-xl font-black text-sky-600 dark:text-sky-400 en-num">{payrollStats?.paidLeave}</h3>
                  </div>
                  <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-3.5 rounded-[1.2rem] text-center shadow-sm">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">إجمالي الخصومات</p>
                    <h3 className="text-[14px] mt-1 font-black text-rose-500 en-num">{payrollStats?.financialDeductions?.toLocaleString('en-US')} د.ع</h3>
                  </div>
                  <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-3.5 rounded-[1.2rem] text-center shadow-sm bg-gradient-to-tr from-sky-50 to-transparent dark:from-sky-900/10">
                    <p className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">رصيد الإجازات</p>
                    <h3 className="text-xl font-black text-sky-600 dark:text-sky-400 en-num">{employee?.annual_leave_balance || 0}</h3>
                  </div>
                </div>

                <h3 className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-2 pb-3">كشف الراتب التفصيلي (الصافي)</h3>
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[1.5rem] p-5 shadow-sm space-y-3.5 mb-6">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="font-bold text-slate-500">الراتب الأساسي (العقد)</span>
                    <span className="font-black text-slate-800 dark:text-white en-num">{payrollStats?.baseSalary?.toLocaleString('en-US') || 0} د.ع</span>
                  </div>

                  {(payrollStats?.unpaidDays ?? 0) > 0 && (
                    <div className="flex justify-between items-center text-[12px] bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-xl border border-rose-100 dark:border-rose-500/20">
                      <span className="font-bold text-rose-600 dark:text-rose-400">استقطاع غياب وإجازات ({payrollStats?.unpaidDays} يوم)</span>
                      <span className="font-black text-rose-600 dark:text-rose-400 en-num dir-ltr">- {payrollStats?.absenceDeductionAmount?.toLocaleString('en-US')} د.ع</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[12px] bg-slate-50 dark:bg-[#0a0a0c] p-2.5 rounded-xl border border-slate-100 dark:border-white/5">
                    <span className="font-black text-slate-600 dark:text-slate-300">المستحق مقابل الدوام الفعلي</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 en-num">{payrollStats?.earnedSalary?.toLocaleString('en-US') || 0} د.ع</span>
                  </div>

                  {(payrollStats?.bonus ?? 0) > 0 && (
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="font-bold text-slate-500 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-500"/> مكافآت وحوافز</span>
                      <span className="font-black text-emerald-500 en-num dir-ltr">+ {payrollStats?.bonus?.toLocaleString('en-US')} د.ع</span>
                    </div>
                  )}

                  {(payrollStats?.financialDeductions ?? 0) > 0 && (
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="font-bold text-slate-500 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-rose-500"/> عقوبات وخصومات إدارية</span>
                      <span className="font-black text-rose-500 en-num dir-ltr">- {payrollStats?.financialDeductions?.toLocaleString('en-US')} د.ع</span>
                    </div>
                  )}

                  {(payrollStats?.advance ?? 0) > 0 && (
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="font-bold text-slate-500 flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-amber-500"/> سلف مسحوبة (مستردة)</span>
                      <span className="font-black text-amber-500 en-num dir-ltr">- {payrollStats?.advance?.toLocaleString('en-US')} د.ع</span>
                    </div>
                  )}

                  <div className="border-t border-slate-100 dark:border-white/10 pt-4 mt-2">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-xl text-white shadow-md flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mb-0.5">الصافي النهائي للاستلام</p>
                        <p className="text-[11px] text-emerald-200">الدفع عبر: {employee?.payment_method || 'كاش'}</p>
                      </div>
                      <span className="font-black text-2xl en-num">{payrollStats?.netSalary?.toLocaleString('en-US') || 0} <span className="text-[12px]">د.ع</span></span>
                    </div>
                  </div>
                </div>

                <h3 className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-2 pb-3">تفاصيل سجل الدوام (أيام عدم الحضور والخصومات)</h3>
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[1.5rem] shadow-sm overflow-hidden p-2 space-y-2 mb-6">
                  {attendance.filter(a => a.status !== 'حاضر' || a.deduction > 0).length === 0 ? (
                    <p className="text-center text-[12px] font-bold text-slate-500 py-6">سجلك نظيف جداً! لا يوجد غيابات أو خصومات.</p>
                  ) : (
                    attendance.filter(a => a.status !== 'حاضر' || a.deduction > 0).map((record, idx) => (
                      <div key={idx} className="flex flex-col p-3 bg-slate-50 dark:bg-[#0a0a0c] rounded-xl border border-slate-100 dark:border-white/5 gap-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {record.status === 'غائب' && <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-[10px] font-black">غائب</span>}
                            {record.status === 'إجازة بدون راتب' && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-black">إجازة مخصومة</span>}
                            {record.status === 'إجازة براتب' && <span className="bg-sky-100 text-sky-700 px-2 py-1 rounded text-[10px] font-black">إجازة مدفوعة</span>}
                            {record.status === 'حاضر' && record.deduction > 0 && <span className="bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white px-2 py-1 rounded text-[10px] font-black">حاضر (يوجد خصم)</span>}
                            <span className="text-[11px] font-bold text-slate-500 en-num dir-ltr">{record.record_date}</span>
                          </div>
                          {record.deduction > 0 && (
                            <span className="text-[12px] font-black text-rose-500 en-num dir-ltr">- {Number(record.deduction).toLocaleString('en-US')}</span>
                          )}
                        </div>
                        {record.notes && <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/5"><Info className="w-3 h-3 inline-block ml-1 opacity-70"/> {record.notes}</p>}
                      </div>
                    ))
                  )}
                </div>

                <h3 className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-2 pb-3">سجل الحركات المالية (سلف، مكافآت، خصم)</h3>
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[1.5rem] shadow-sm overflow-hidden p-2 space-y-2 mb-6">
                  {adjustments.length === 0 ? (
                    <p className="text-center text-[12px] font-bold text-slate-500 py-6">لا توجد حركات مالية مسجلة لهذا الشهر.</p>
                  ) : (
                    adjustments.map((adj, idx) => (
                      <div key={idx} className="flex flex-col p-3 bg-slate-50 dark:bg-[#0a0a0c] rounded-xl border border-slate-100 dark:border-white/5 gap-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {adj.adjustment_type === 'إضافي' && <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><TrendingUp className="w-3.5 h-3.5"/></div>}
                            {adj.adjustment_type === 'خصم' && <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg"><TrendingDown className="w-3.5 h-3.5"/></div>}
                            {adj.adjustment_type === 'سلفة' && <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Banknote className="w-3.5 h-3.5"/></div>}
                            <div>
                              <p className="text-[12px] font-black text-slate-800 dark:text-white">{adj.adjustment_type} {adj.category ? `- ${adj.category}` : ''}</p>
                              <span className="text-[10px] font-bold text-slate-500 en-num dir-ltr">{adj.record_date}</span>
                            </div>
                          </div>
                          <span className={`text-[13px] font-black en-num dir-ltr ${adj.adjustment_type === 'إضافي' ? 'text-emerald-500' : adj.adjustment_type === 'خصم' ? 'text-rose-500' : 'text-amber-500'}`}>
                            {adj.adjustment_type === 'إضافي' ? '+' : '-'} {Number(adj.amount).toLocaleString('en-US')}
                          </span>
                        </div>
                        {adj.notes && <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-white/5 p-2 rounded-lg border border-slate-200 dark:border-white/5"><Info className="w-3 h-3 inline-block ml-1 opacity-70"/> {adj.notes}</p>}
                      </div>
                    ))
                  )}
                </div>

                <h3 className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-2 pb-3">سجل ومتابعة طلباتي السابقة</h3>
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[1.5rem] shadow-sm overflow-hidden p-2 space-y-2">
                  {requests.length === 0 ? (
                    <p className="text-center text-[12px] font-bold text-slate-500 py-8">لا توجد طلبات سابقة مسجلة</p>
                  ) : (
                    requests.map((req, idx) => (
                      <div key={idx} className="flex flex-col p-3 bg-slate-50 dark:bg-[#0a0a0c] rounded-xl border border-slate-100 dark:border-white/5 gap-2">
                        <div className="flex justify-between items-center">
                          <p className="text-[13px] font-black text-slate-800 dark:text-white">
                            {req.request_type === 'loan' ? 'طلب سلفة' : 'طلب إجازة'} - <span className="en-num text-indigo-500">{req.request_type === 'leave' ? `${req.amount_or_days} أيام` : req.amount_or_days}</span>
                          </p>
                          {req.status === 'قيد الانتظار' && <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-black flex items-center gap-1"><Clock className="w-3 h-3"/> قيد الانتظار</span>}
                          {req.status === 'مقبول' && <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-black flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> مقبول</span>}
                          {req.status === 'مرفوض' && <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-[10px] font-black flex items-center gap-1"><XCircle className="w-3 h-3"/> مرفوض</span>}
                        </div>
                        <p className="text-[11px] font-bold text-slate-500 line-clamp-1">{req.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </main>

        {activeModal !== 'none' && createPortal(
          <div className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 pb-12 animate-in fade-in duration-300 no-print" dir="rtl">
            <div className="bg-white dark:bg-[#121214] w-full max-w-md rounded-[2rem] p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in slide-in-from-bottom-full md:zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  {activeModal === 'advance' ? <Banknote className="w-5 h-5 text-amber-500"/> : <CalendarDays className="w-5 h-5 text-sky-500"/>}
                  {activeModal === 'advance' ? 'طلب سلفة مالية' : 'طلب إجازة زمنية'}
                </h3>
                <button onClick={() => setActiveModal('none')} className="p-2 bg-slate-100 dark:bg-white/5 rounded-full text-slate-500 active:scale-95 outline-none"><XCircle className="w-5 h-5"/></button>
              </div>

              <form onSubmit={submitRequest} className="space-y-4">
                
                {activeModal === 'advance' ? (
                  <div>
                    <label className="text-[11px] font-black text-slate-500 mb-1.5 block">المبلغ المطلوب (د.ع)</label>
                    <input type="number" required min="1000" value={requestData.amount || ''} onChange={e => setRequestData({...requestData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black text-lg p-3.5 rounded-xl focus:outline-none focus:border-amber-500 dir-ltr text-right en-num" placeholder="مثال: 50000" />
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-black text-slate-500 mb-1.5 block">مدة الإجازة المطلوبة</label>
                    <div className="relative">
                      <select 
                        value={requestData.days || '1'}
                        onChange={e => setRequestData({...requestData, days: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-sm p-3.5 pr-4 pl-10 rounded-xl focus:outline-none focus:border-sky-500 appearance-none"
                      >
                        {leaveDurations.map(day => (
                          <option key={day} value={day}>
                            {day === 1 ? 'يوم واحد' : day === 2 ? 'يومين' : day <= 10 ? `${day} أيام` : `${day} يوماً`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    <p className="text-[10px] font-bold text-sky-500 mt-2 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> يبدأ حساب الإجازة من تاريخ موافقة الإدارة.
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-black text-slate-500 mb-1.5 block">سبب الطلب الأساسي</label>
                  <div className="relative">
                    <select 
                      value={requestData.reason || ''}
                      onChange={e => setRequestData({...requestData, reason: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-sm p-3.5 pr-4 pl-10 rounded-xl focus:outline-none focus:border-slate-500 appearance-none"
                    >
                      {activeModal === 'advance' ? (
                        advanceReasons.map((reason, idx) => <option key={idx} value={reason}>{reason}</option>)
                      ) : (
                        leaveReasons.map((reason, idx) => <option key={idx} value={reason}>{reason}</option>)
                      )}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {requestData.reason === 'أخرى (يرجى التوضيح)' && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[11px] font-black text-rose-500 mb-1.5 block">يرجى كتابة السبب بالتفصيل:</label>
                    <textarea 
                      required 
                      rows={2} 
                      value={requestData.otherReason || ''} 
                      onChange={e => setRequestData({...requestData, otherReason: e.target.value})} 
                      className="w-full bg-rose-50 dark:bg-rose-500/5 border border-rose-200 dark:border-rose-500/20 text-slate-900 dark:text-white font-bold text-sm p-3.5 rounded-xl focus:outline-none focus:border-rose-500 resize-none" 
                      placeholder="اكتب التفاصيل هنا..."
                    ></textarea>
                  </div>
                )}

                <button type="submit" disabled={isSubmitting} className={`w-full text-white py-4 mt-2 rounded-xl font-black text-[14px] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${activeModal === 'advance' ? 'bg-amber-600' : 'bg-sky-600'}`}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>} تأكيد وإرسال الطلب
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}

        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; }
          .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
        `}} />
      </div>
    </div>
  );
}


// ==========================================
// 🌟 الموجه الرئيسي (Unified Dashboard)
// ==========================================
export default function UnifiedDashboardPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const session = localStorage.getItem('erp_session');
    if (!session) {
      router.push('/login');
    } else {
      setCurrentUser(JSON.parse(session));
      setMounted(true);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('erp_session');
    router.push('/login');
  };

  if (!mounted || !currentUser) return null;

  // 💡 تحديد نوع الشاشة بناءً على المنصب 💡
  const isBranchManager = currentUser.role === 'BranchManager' || String(currentUser.role).includes('فرع');

  if (isBranchManager) {
    return <BranchDashboard currentUser={currentUser} handleLogout={handleLogout} isDark={isDark} toggleTheme={toggleTheme} router={router} />;
  } else {
    return <EmployeeDashboard currentUser={currentUser} handleLogout={handleLogout} isDark={isDark} toggleTheme={toggleTheme} router={router} />;
  }
}