"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  ClipboardCheck, Clock, CheckCircle2, XCircle, Store, 
  Package, Loader2, Edit, ChevronDown, Check, X, Building2, User, LayoutGrid,
  History, ShoppingCart, BarChart3, Eye, EyeOff, Sun, Moon, Filter, Layers, Zap, ChefHat
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

const forceEnglishNumbers = (val: string) => {
  if (!val) return '';
  return val.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^0-9.]/g, '');
};

export default function ApprovalsPage() {
  const pathname = usePathname();
  const { isDark, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [isZenMode, setIsZenMode] = useState(false);

  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [selectedBranchFilter, setSelectedBranchFilter] = useState('الكل');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('الكل');
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState('الكل');

  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [editedItems, setEditedItems] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchPendingOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('branch_orders')
        .select(`
          *,
          branches (name, agency_id, agencies(name))
        `)
        .eq('status', 'قيد المراجعة')
        .order('created_at', { ascending: true }); 

      if (error) throw error;
      setPendingOrders(data || []);
    } catch (err: any) {
      console.error("Supabase Detailed Error:", err);
      alert(`عذراً، فشل جلب الاعتمادات:\n\nالسبب من قاعدة البيانات:\n${err.message || err.hint || JSON.stringify(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingOrders();
    const channel = supabase.channel('realtime_branch_orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'branch_orders' }, payload => {
        fetchPendingOrders(); 
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const uniqueBranches = useMemo(() => {
    const names = pendingOrders.map(o => o.branches?.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [pendingOrders]);

  const uniqueCategories = useMemo(() => {
    const cats = pendingOrders.flatMap(o => o.items.map((i: any) => i.category)).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [pendingOrders]);

  const uniqueAgencies = useMemo(() => {
    const names = pendingOrders.map(o => o.branches?.agencies?.name).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [pendingOrders]);

  const filteredOrders = useMemo(() => {
    return pendingOrders.filter(order => {
      const matchBranch = selectedBranchFilter === 'الكل' || order.branches?.name === selectedBranchFilter;
      const matchAgency = selectedAgencyFilter === 'الكل' || order.branches?.agencies?.name === selectedAgencyFilter;
      const matchCategory = selectedCategoryFilter === 'الكل' || order.items.some((i: any) => i.category === selectedCategoryFilter);
      return matchBranch && matchAgency && matchCategory;
    });
  }, [pendingOrders, selectedBranchFilter, selectedAgencyFilter, selectedCategoryFilter]);

  const totals = useMemo(() => {
    let ordersCount = filteredOrders.length;
    let totalQuantity = 0;
    filteredOrders.forEach(order => {
      order.items.forEach((item: any) => {
        if (selectedCategoryFilter === 'الكل' || item.category === selectedCategoryFilter) {
          totalQuantity += parseFloat(item.qty) || 0;
        }
      });
    });
    return { ordersCount, totalQuantity };
  }, [filteredOrders, selectedCategoryFilter]);

  const startEditing = (order: any) => {
    setEditingOrder(order);
    setEditedItems(JSON.parse(JSON.stringify(order.items)));
  };

  const handleQtyChange = (index: number, newQty: string) => {
    const englishQty = forceEnglishNumbers(newQty);
    const qty = parseFloat(englishQty);
    const updated = [...editedItems];
    updated[index].qty = isNaN(qty) ? 0 : qty;
    updated[index].qtyString = englishQty; 
    setEditedItems(updated);
  };

  const removeEditedItem = (index: number) => {
    const updated = [...editedItems];
    updated.splice(index, 1);
    setEditedItems(updated);
  };

  const cancelEditing = () => {
    setEditingOrder(null);
    setEditedItems([]);
  };

  const handleReject = async (orderId: string) => {
    if (!window.confirm('هل أنت متأكد من رفض هذه الطلبية وإلغائها نهائياً؟')) return;
    setProcessingId(orderId);
    try {
      const { error } = await supabase.from('branch_orders').update({ status: 'مرفوض' }).eq('id', orderId);
      if (error) throw error;
      setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      alert('حدث خطأ أثناء الرفض');
    } finally {
      setProcessingId(null);
    }
  };

  // 💡 تم تعديل رسالة التنبيه لتلائم شاشة المطبخ 💡
  const handleApprove = async (order: any, isEdited: boolean = false) => {
    const finalItems = isEdited ? editedItems.filter(i => i.qty > 0) : order.items;
    if (finalItems.length === 0) return alert('الطلبية فارغة، يرجى رفضها أو إضافة مواد.');
    
    if (!window.confirm('اعتماد هذه الطلبية سينقلها مباشرة إلى "شاشة المطبخ" ليتم تجهيزها من قبل الشيف. هل أنت متأكد؟')) return;

    setProcessingId(order.id);
    try {
      const invoiceNum = order.invoice_number || `BR-${dayjs().format('MMDD')}-${Math.floor(Math.random() * 1000)}`;
      const orderType = order.order_type || 'طلبية يومية';

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          branch_id: order.branch_id,
          status: 'قيد التجهيز', // هذه الحالة هي التي تقرأها شاشة المطبخ (KDS)
          notes: order.notes,
          order_type: orderType,
          invoice_number: invoiceNum,
          created_at: new Date().toISOString()
        }]).select().single();

      if (orderError) throw orderError;

      const detailsPayload = finalItems.map((item: any) => ({
        order_id: newOrder.id,
        item_id: item.item_id,
        quantity: item.qty
      }));

      const { error: detailsError } = await supabase.from('order_details').insert(detailsPayload);
      if (detailsError) throw detailsError;

      const { error: updateError } = await supabase.from('branch_orders').update({ status: 'معتمد', items: finalItems }).eq('id', order.id);
      if (updateError) throw updateError;

      setPendingOrders(prev => prev.filter(o => o.id !== order.id));
      if (isEdited) cancelEditing();

    } catch (err: any) {
      alert(`حدث خطأ أثناء الاعتماد: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const FilterTabBar = ({ icon: Icon, label, options, selected, onSelect, theme }: any) => {
    const themes: Record<string, any> = {
      amber: {
        container: "bg-amber-50/60 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-500/20",
        icon: "text-amber-500 dark:text-amber-400",
        label: "text-amber-700 dark:text-amber-400",
        btnSelected: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_5px_15px_rgba(245,158,11,0.3)]",
        btnDefault: "text-slate-600 dark:text-slate-400 hover:bg-amber-100/60 dark:hover:bg-amber-500/20 hover:text-amber-700 dark:hover:text-amber-300"
      },
      emerald: {
        container: "bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-500/20",
        icon: "text-emerald-500 dark:text-emerald-400",
        label: "text-emerald-700 dark:text-emerald-400",
        btnSelected: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_5px_15px_rgba(16,185,129,0.3)]",
        btnDefault: "text-slate-600 dark:text-slate-400 hover:bg-emerald-100/60 dark:hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300"
      },
      sky: {
        container: "bg-sky-50/60 dark:bg-sky-900/10 border-sky-200/50 dark:border-sky-500/20",
        icon: "text-sky-500 dark:text-sky-400",
        label: "text-sky-700 dark:text-sky-400",
        btnSelected: "bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-[0_5px_15px_rgba(14,165,233,0.3)]",
        btnDefault: "text-slate-600 dark:text-slate-400 hover:bg-sky-100/60 dark:hover:bg-sky-500/20 hover:text-sky-700 dark:hover:text-sky-300"
      }
    };

    const t = themes[theme] || themes.amber;

    return (
      <div className={`flex items-center p-1.5 rounded-[2rem] overflow-x-auto custom-scrollbar border transition-all ${t.container}`}>
        <div className="flex items-center gap-2 px-3 shrink-0 border-l border-slate-300/50 dark:border-white/10 ml-1">
          <Icon className={`w-4 h-4 ${t.icon}`} />
          <span className={`text-[12px] font-black tracking-tight ${t.label}`}>{label}</span>
        </div>
        <div className="flex items-center gap-1.5 px-1">
          {options.map((opt: string) => (
            <button
              key={opt}
              onClick={() => onSelect(opt)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[12px] font-black transition-all outline-none ${
                selected === opt ? t.btnSelected : t.btnDefault
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (!mounted) return null;

  if (isLoading) return <div className={`min-h-screen ${isDark ? 'bg-[#050505]' : 'bg-slate-50'} flex items-center justify-center`}><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-all duration-700 ease-in-out ${isZenMode ? 'bg-slate-50 dark:bg-black text-slate-800 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-[130px]'}`} dir="rtl">
        
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 via-slate-50 to-slate-50 dark:from-indigo-900/15 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none transition-opacity duration-700 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-700 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-3 md:p-6 max-w-[100rem]'}`}>
          
          {/* 🌟 الهيدر المصغر 🌟 */}
          <div className={`flex items-center justify-between gap-4 mb-4 bg-white dark:bg-[#0a0a0c] p-3 md:px-5 rounded-[1.5rem] border border-slate-200 dark:border-white/5 shadow-sm transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-4 min-w-0">
              <Link href="/hub" className="bg-slate-50 dark:bg-[#121214] p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border border-slate-200 dark:border-white/5 shadow-inner shrink-0 outline-none">
                <LayoutGrid className="w-5 h-5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" />
              </Link>
              <div className="w-px h-6 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 dark:from-indigo-500/20 dark:to-blue-900/40 border border-indigo-300 dark:border-indigo-500/30 w-9 h-9 rounded-xl text-white dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(79,70,229,0.3)]">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <h2 className="text-[15px] md:text-[17px] font-black text-slate-900 dark:text-white tracking-tight truncate">شاشة الاعتمادات</h2>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="bg-slate-50 dark:bg-[#121214] px-3 py-1.5 rounded-lg shadow-inner border border-slate-200 dark:border-white/5 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse"></div>
                <span className="font-black text-[10px] md:text-[11px] text-slate-700 dark:text-slate-300">
                  معلقة: <span className="text-amber-600 dark:text-amber-400 ml-0.5 en-num">{pendingOrders.length}</span>
                </span>
              </div>
              
              <button onClick={toggleTheme} className="shrink-0 flex items-center justify-center p-2 bg-white dark:bg-[#121214] hover:bg-slate-50 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-500 transition-all border border-slate-200 dark:border-white/5 shadow-sm outline-none">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button 
                onClick={() => setIsZenMode(true)}
                title="وضع التركيز"
                className="p-2 bg-white dark:bg-[#121214] hover:bg-slate-50 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-all border border-slate-200 dark:border-white/5 shadow-sm outline-none hidden md:block"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 🌟 شريط التبويبات الملونة 🌟 */}
          {!isZenMode && pendingOrders.length > 0 && (
            <div className="mb-6 bg-white dark:bg-[#0a0a0c] p-4 md:p-5 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm flex flex-col gap-4 transition-all duration-500">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-black text-slate-800 dark:text-slate-200 text-[13px]">فرز وتصفية الطلبات</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-black bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                    <ClipboardCheck className="w-3.5 h-3.5"/> فواتير: 
                    <span className="en-num bg-white dark:bg-black/50 px-2 py-0.5 rounded-md shadow-sm border border-indigo-100 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">{totals.ordersCount}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-black bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    <Package className="w-3.5 h-3.5"/> الكمية الكلية: 
                    <span className="en-num bg-white dark:bg-black/50 px-2 py-0.5 rounded-md shadow-sm border border-emerald-100 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400">{totals.totalQuantity}</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {uniqueCategories.length > 0 && (
                  <FilterTabBar theme="amber" icon={Layers} label="القسم" options={['الكل', ...uniqueCategories]} selected={selectedCategoryFilter} onSelect={setSelectedCategoryFilter} />
                )}
                {uniqueBranches.length > 0 && (
                  <FilterTabBar theme="emerald" icon={Store} label="الفرع" options={['الكل', ...uniqueBranches]} selected={selectedBranchFilter} onSelect={setSelectedBranchFilter} />
                )}
                {uniqueAgencies.length > 0 && (
                  <FilterTabBar theme="sky" icon={Building2} label="الوكالة" options={['الكل', ...uniqueAgencies]} selected={selectedAgencyFilter} onSelect={setSelectedAgencyFilter} />
                )}
              </div>

            </div>
          )}

          {/* 🌟 المحتوى 🌟 */}
          {pendingOrders.length === 0 ? (
            <div className="bg-white dark:bg-[#121214] rounded-[2rem] p-12 text-center border border-slate-200 dark:border-white/5 shadow-sm flex flex-col items-center justify-center min-h-[40vh]">
              <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-5 border border-emerald-200 dark:border-emerald-500/20 shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">الطابور فارغ</h3>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-sm max-w-sm leading-relaxed">جميع طلبات الفروع تم مراجعتها واعتمادها.</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-[#121214] rounded-[2rem] p-12 text-center border border-slate-200 dark:border-white/5 shadow-sm flex flex-col items-center justify-center min-h-[40vh]">
              <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-5 border border-slate-200 dark:border-white/10 shadow-inner">
                <Filter className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">لا توجد نتائج</h3>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-sm max-w-sm leading-relaxed">جرب تغيير التبويبات أعلاه.</p>
              <button onClick={() => { setSelectedCategoryFilter('الكل'); setSelectedBranchFilter('الكل'); setSelectedAgencyFilter('الكل'); }} className="mt-5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-5 py-2 rounded-xl font-black text-[12px] border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors outline-none shadow-sm">إعادة ضبط الفلاتر</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredOrders.map(order => {
                const isEditingThis = editingOrder?.id === order.id;
                const itemsToRender = isEditingThis ? editedItems : order.items;

                const hiddenItemsCount = itemsToRender.filter((i:any) => selectedCategoryFilter !== 'الكل' && i.category !== selectedCategoryFilter).length;
                const displayedItemsCount = itemsToRender.length - hiddenItemsCount;

                return (
                  <div key={order.id} className={`bg-white dark:bg-[#0a0a0c] rounded-[1.8rem] p-5 shadow-sm border transition-all duration-300 relative flex flex-col h-full ${isEditingThis ? 'border-amber-400 dark:border-amber-500/50 ring-2 ring-amber-500/10' : 'border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-md'}`}>
                    
                    <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-white/5 pb-4 shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20 shadow-inner shrink-0">
                          <Store className="w-5 h-5"/>
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 dark:text-white text-[14px] leading-tight mb-1">{order.branches?.name}</h4>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/5">{order.branches?.agencies?.name || 'عام'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20 flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3 text-amber-500/70"/> <span className="en-num dir-ltr">{dayjs(order.created_at).format('hh:mm A')}</span>
                        </span>
                        <p className="text-[9px] font-bold text-slate-500 mt-1 en-num dir-ltr">{dayjs(order.created_at).format('YYYY-MM-DD')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      {order.invoice_number && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-50 dark:bg-[#151518] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5 flex items-center gap-1">
                          الفاتورة: <span className="en-num dir-ltr">#{order.invoice_number}</span>
                        </span>
                      )}
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-1">
                         {order.order_type || 'طلبية يومية'}
                      </span>
                    </div>

                    {order.notes && (
                      <div className="bg-amber-50 dark:bg-[#151518] rounded-xl p-2.5 mb-4 border border-amber-200 dark:border-white/5 flex items-start gap-2 shadow-inner shrink-0">
                        <User className="w-3.5 h-3.5 text-amber-600 dark:text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] font-bold text-amber-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{order.notes}</p>
                      </div>
                    )}

                    <div className="mb-5 flex-1 flex flex-col min-h-0">
                      <div className="flex justify-between items-center mb-3 shrink-0">
                        <h5 className="font-black text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Package className="w-3.5 h-3.5"/> المواد المعروضة ({displayedItemsCount})</h5>
                        
                        {!isEditingThis && (
                          <button 
                            onClick={() => startEditing(order)} 
                            className="text-[10px] md:text-[11px] font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 transition-all flex items-center gap-1.5 shadow-sm outline-none"
                          >
                            <Edit className="w-3.5 h-3.5"/> تعديل الكميات
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5 overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-[150px] max-h-[200px]">
                        {itemsToRender.map((item: any, idx: number) => {
                          if (selectedCategoryFilter !== 'الكل' && item.category !== selectedCategoryFilter) return null;

                          return (
                            <div key={idx} className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${isEditingThis ? 'bg-slate-50 dark:bg-[#151518] border-amber-300 dark:border-amber-500/30' : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10'}`}>
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="font-black text-slate-800 dark:text-slate-200 text-[12px] truncate mb-0.5">{item.name}</p>
                                <p className="font-bold text-slate-400 dark:text-slate-500 text-[9px]">{item.category} • {item.unit}</p>
                              </div>
                              
                              {isEditingThis ? (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <input 
                                    type="text"
                                    inputMode="numeric" 
                                    value={item.qtyString ?? item.qty} 
                                    onChange={(e) => handleQtyChange(idx, e.target.value)}
                                    className="w-14 h-8 text-center font-black text-[13px] bg-white dark:bg-[#0a0a0c] text-slate-900 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-500 dir-ltr en-num"
                                  />
                                  <button onClick={() => removeEditedItem(idx)} className="w-8 h-8 flex items-center justify-center bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition-colors border border-rose-200 dark:border-rose-500/20 outline-none">
                                    <X className="w-3.5 h-3.5"/>
                                  </button>
                                </div>
                              ) : (
                                <div className="shrink-0 bg-slate-50 dark:bg-[#151518] border border-slate-200 dark:border-white/5 px-3 py-1 rounded-lg">
                                  <span className="font-black text-indigo-600 dark:text-indigo-400 text-[13px] en-num dir-ltr">{item.qty}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {hiddenItemsCount > 0 && (
                          <div className="text-center py-2 mt-2 flex flex-col items-center justify-center gap-1 opacity-70">
                            <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                              <EyeOff className="w-3 h-3"/> يوجد <span className="en-num">{hiddenItemsCount}</span> أصناف مخفية بالفلتر
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 💡 تم تعديل أسماء الأزرار للإرسال لشاشة المطبخ 💡 */}
                    <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col gap-2 shrink-0">
                      {isEditingThis ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(order, true)} disabled={processingId === order.id} className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl text-[12px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 outline-none">
                            {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>} 
                            حفظ وإرسال للمطبخ
                          </button>
                          <button onClick={cancelEditing} className="flex-1 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-black py-3 rounded-xl text-[12px] transition-colors outline-none">
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(order, false)} disabled={processingId === order.id} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl text-[12px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 outline-none shadow-sm">
                            {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <ChefHat className="w-4 h-4"/>} 
                            إرسال لشاشة المطبخ
                          </button>
                          <button onClick={() => handleReject(order.id)} disabled={processingId === order.id} className="flex-1 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white font-black py-3 rounded-xl text-[12px] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 outline-none border border-rose-200 dark:border-rose-500/20 hover:border-transparent">
                            {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <XCircle className="w-4 h-4"/>} 
                            رفض
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {isZenMode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-bottom-10 fade-in duration-500 no-print">
            <button 
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-5 py-3 rounded-full font-black text-xs shadow-xl hover:scale-105 active:scale-95 transition-all outline-none border border-white/20 dark:border-black/20"
            >
              <EyeOff className="w-4 h-4" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

      </div>
    </div>
  );
}