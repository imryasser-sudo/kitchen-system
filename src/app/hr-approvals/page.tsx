"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { playNotificationSound } from '@/components/AudioAlert'; 
import { toast } from 'sonner'; 
import { 
  ClipboardCheck, Search, Loader2, CheckCircle2, XCircle, 
  Clock, Banknote, CalendarClock, ShieldAlert, Check, X,
  User, MapPin, CalendarDays, Wallet, Trash2, Filter, AlertTriangle, ShieldCheck
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar-iq'; // 💡 تم تحديث اللغة إلى ar-iq للتناسق

dayjs.locale('ar-iq');

interface EmployeeRequest {
  id: string;
  employee_id: string;
  request_type: 'سلفة' | 'إجازة';
  amount: number;
  start_date: string;
  end_date: string;
  notes: string;
  status: 'قيد الانتظار' | 'موافق عليه' | 'مرفوض';
  created_at: string;
  staff: {
    full_name: string;
    role: string;
    branch: string;
    avatar_color: string;
    salary: number; 
    annual_leave_balance: number; 
  };
}

export default function HRApprovalsPage() {
  const { isDark } = useTheme(); 
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [activeFilter, setActiveFilter] = useState<'all' | 'سلفة' | 'إجازة'>('all'); 

  const [selectedReq, setSelectedReq] = useState<EmployeeRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [leaveType, setLeaveType] = useState<'إجازة براتب' | 'إجازة بدون راتب'>('إجازة بدون راتب');
  const [empPreviousAdvances, setEmpPreviousAdvances] = useState<number>(0); 

  const currentMonth = dayjs().format('YYYY-MM');

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      // 💡 تم إصلاح طريقة الربط هنا (staff بدلاً من staff:employee_id) 💡
      const { data, error } = await supabase
        .from('employee_requests')
        .select(`*, staff (full_name, role, branch, avatar_color, salary, annual_leave_balance)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data as any);
    } catch (err) {
      console.error("Error fetching requests:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('realtime_hr_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'employee_requests' },
        (payload) => {
          const isAdvance = payload.new.request_type === 'سلفة';
          
          playNotificationSound();
          
          toast.success(isAdvance ? 'طلب سلفة جديد 💰' : 'طلب إجازة جديد 🏖️', {
            description: 'تم استلام طلب جديد من الموظفين بانتظار مراجعتك واعتمادك.',
            duration: 6000,
          });
          
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const kpis = useMemo(() => {
    let totalAdvances = 0;
    let totalLeaves = 0;
    let pendingCount = 0;

    requests.forEach(req => {
      const reqMonth = dayjs(req.created_at).format('YYYY-MM');
      if (req.status === 'قيد الانتظار') pendingCount++;
      if (req.status === 'موافق عليه' && reqMonth === currentMonth) {
        if (req.request_type === 'سلفة') totalAdvances += Number(req.amount || 0);
        if (req.request_type === 'إجازة') totalLeaves++;
      }
    });

    return { totalAdvances, totalLeaves, pendingCount };
  }, [requests, currentMonth]);

  const filteredRequests = requests.filter(r => {
    const matchSearch = r.staff?.full_name.includes(searchQuery) || r.staff?.branch.includes(searchQuery);
    const matchType = activeFilter === 'all' || r.request_type === activeFilter;
    return matchSearch && matchType;
  });

  const pendingList = filteredRequests.filter(r => r.status === 'قيد الانتظار');
  const historyList = filteredRequests.filter(r => r.status !== 'قيد الانتظار');

  const openApproveModal = async (req: EmployeeRequest) => {
    setSelectedReq(req);
    if (req.request_type === 'سلفة') {
      setApprovedAmount(req.amount);
      
      const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');
      
      const { data } = await supabase
        .from('payroll_adjustments')
        .select('amount')
        .eq('employee_id', req.employee_id)
        .eq('adjustment_type', 'سلفة')
        .gte('record_date', startOfMonth)
        .lte('record_date', endOfMonth);
        
      const prevAdvances = data?.reduce((sum, adj) => sum + Number(adj.amount), 0) || 0;
      setEmpPreviousAdvances(prevAdvances);
    }
  };

  const confirmApproval = async () => {
    if (!selectedReq) return;
    setIsProcessing(true);

    try {
      if (selectedReq.request_type === 'سلفة') {
        const { error: adjError } = await supabase.from('payroll_adjustments').insert([{
          employee_id: selectedReq.employee_id,
          adjustment_type: 'سلفة',
          amount: approvedAmount,
          record_date: dayjs().format('YYYY-MM-DD'),
          notes: `سلفة معتمدة (من البوابة) - المبرر: ${selectedReq.notes || 'بدون'}`
        }]);
        if (adjError) throw adjError;
      }

      if (selectedReq.request_type === 'إجازة') {
        const dates = [];
        let curr = dayjs(selectedReq.start_date);
        const end = dayjs(selectedReq.end_date);
        let daysCount = 0;
        
        while (curr.isBefore(end) || curr.isSame(end, 'day')) {
          dates.push(curr.format('YYYY-MM-DD'));
          curr = curr.add(1, 'day');
          daysCount++;
        }

        const attendancePayload = dates.map(d => ({
          employee_id: selectedReq.employee_id,
          record_date: d,
          status: leaveType,
          deduction: 0
        }));

        const { error: attError } = await supabase.from('attendance').upsert(attendancePayload, { onConflict: 'employee_id, record_date' });
        if (attError) throw attError;

        if (leaveType === 'إجازة براتب' && selectedReq.staff?.annual_leave_balance) {
           await supabase.from('staff')
             .update({ annual_leave_balance: selectedReq.staff.annual_leave_balance - daysCount })
             .eq('id', selectedReq.employee_id);
        }
      }

      const { error: reqError } = await supabase.from('employee_requests').update({ status: 'موافق عليه' }).eq('id', selectedReq.id);
      if (reqError) throw reqError;

      toast.success('تم اعتماد الطلب وتحديث السجلات بنجاح!');
      setSelectedReq(null);
      fetchRequests();

    } catch (err: any) {
      toast.error(`حدث خطأ أثناء الاعتماد: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (req: EmployeeRequest) => {
    if (!window.confirm('هل أنت متأكد من رفض هذا الطلب؟')) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('employee_requests').update({ status: 'مرفوض' }).eq('id', req.id);
      if (error) throw error;
      toast.success('تم رفض الطلب.'); 
      fetchRequests();
    } catch (err) {
      toast.error('حدث خطأ أثناء رفض الطلب');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('⚠️ تحذير: هل أنت متأكد من مسح جميع الطلبات المعالجة من الأرشيف؟\nهذا الإجراء لا يمكن التراجع عنه.')) return;
    setIsClearing(true);
    try {
      const { error } = await supabase.from('employee_requests').delete().neq('status', 'قيد الانتظار');
      if (error) throw error;
      toast.success('تم تنظيف الأرشيف بنجاح! ✨');
      fetchRequests();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء تنظيف السجل');
    } finally {
      setIsClearing(false);
    }
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2) : '?';

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white overflow-x-hidden font-sans pb-[130px] relative transition-colors duration-300" dir="rtl">
        
        {/* 🟢 الإشعاع الخلفي 🟢 */}
        <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-fuchsia-100/50 dark:from-fuchsia-900/15 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-colors duration-300"></div>

        <div className="p-4 md:p-8 max-w-[100rem] mx-auto w-full relative z-10">
          
          {/* الترويسة العليا */}
          <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 md:px-8 rounded-[2.5rem] shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col xl:flex-row justify-between items-center gap-6 mb-6 relative overflow-hidden transition-colors duration-300">
            <div className="flex items-center gap-4 text-right w-full xl:w-auto relative z-10">
              <div className="bg-gradient-to-br from-fuchsia-50 dark:from-fuchsia-500/20 to-fuchsia-100 dark:to-fuchsia-900/40 border border-fuchsia-200 dark:border-fuchsia-500/30 w-14 h-14 rounded-[1.3rem] text-fuchsia-600 dark:text-fuchsia-400 shadow-inner flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight mb-1">موافقات الإدارة (HR)</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400">مراجعة واعتماد طلبات السلف والإجازات الخاصة بالموظفين.</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0a0a0c] p-1.5 rounded-2xl flex items-center w-full xl:w-auto overflow-x-auto shadow-inner border border-slate-200 dark:border-white/5 relative z-10 transition-colors duration-300">
              <button onClick={() => setActiveTab('pending')} className={`px-6 py-3 min-w-max text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none active:scale-95 ${activeTab === 'pending' ? 'bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-400 shadow-sm border border-fuchsia-200 dark:border-fuchsia-500/30' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <Clock className="w-4 h-4" /> الطلبات المعلقة ({pendingList.length})
              </button>
              <button onClick={() => setActiveTab('history')} className={`px-6 py-3 min-w-max text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none active:scale-95 ${activeTab === 'history' ? 'bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-400 shadow-sm border border-fuchsia-200 dark:border-fuchsia-500/30' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                <ShieldAlert className="w-4 h-4" /> السجل والأرشيف
              </button>
            </div>
          </div>

          {/* 📊 شريط المؤشرات السريعة (KPIs) 📊 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm hover:border-fuchsia-300 dark:hover:border-fuchsia-500/30 transition-colors">
              <div className="p-3.5 bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 rounded-2xl"><Clock className="w-6 h-6"/></div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">إجمالي الطلبات المعلقة</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{kpis.pendingCount} <span className="text-xs text-fuchsia-600 dark:text-fuchsia-400">طلب</span></p>
              </div>
            </div>
            <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors">
              <div className="p-3.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl"><Banknote className="w-6 h-6"/></div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">إجمالي السلف المعتمدة (لهذا الشهر)</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 dir-ltr text-right">{kpis.totalAdvances.toLocaleString('en-US')} <span className="text-xs text-indigo-600 dark:text-indigo-400">د.ع</span></p>
              </div>
            </div>
            <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm hover:border-sky-300 dark:hover:border-sky-500/30 transition-colors">
              <div className="p-3.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-2xl"><CalendarClock className="w-6 h-6"/></div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">المجازين المعتمدين (لهذا الشهر)</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{kpis.totalLeaves} <span className="text-xs text-sky-600 dark:text-sky-400">موظف</span></p>
              </div>
            </div>
          </div>

          {/* شريط البحث + الفلاتر الذكية + زر التنظيف */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
            
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative w-full max-w-sm">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input 
                  type="text" 
                  placeholder="ابحث باسم الموظف أو الفرع..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-fuchsia-400 dark:focus:border-fuchsia-500/50 focus:ring-4 focus:ring-fuchsia-500/10 text-[14px] transition-all shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>
              {/* 🔍 الفلاتر الذكية 🔍 */}
              <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-1.5 rounded-2xl flex items-center gap-1 shrink-0 h-[52px] shadow-sm">
                <button onClick={() => setActiveFilter('all')} className={`p-2.5 rounded-xl text-[11px] font-black transition-all outline-none cursor-pointer active:scale-95 ${activeFilter === 'all' ? 'bg-fuchsia-50 dark:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><Filter className="w-4 h-4"/></button>
                <button onClick={() => setActiveFilter('سلفة')} className={`px-3 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 outline-none cursor-pointer active:scale-95 ${activeFilter === 'سلفة' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><Banknote className="w-4 h-4"/> سلف</button>
                <button onClick={() => setActiveFilter('إجازة')} className={`px-3 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 outline-none cursor-pointer active:scale-95 ${activeFilter === 'إجازة' ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><CalendarDays className="w-4 h-4"/> إجازات</button>
              </div>
            </div>

            {activeTab === 'history' && historyList.length > 0 && (
              <button onClick={handleClearHistory} disabled={isClearing} className="bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 px-5 py-3.5 rounded-2xl font-black text-[13px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 w-full xl:w-auto outline-none shadow-sm dark:shadow-inner shrink-0">
                {isClearing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>} تنظيف الأرشيف
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-fuchsia-500 animate-spin mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-bold tracking-widest text-sm uppercase">جاري تحميل الطلبات...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {(activeTab === 'pending' ? pendingList : historyList).length === 0 ? (
                <div className="col-span-full text-center py-32 bg-white dark:bg-[#121214] rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner">
                  <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-fuchsia-300 dark:text-fuchsia-500/30" />
                  <p className="text-xl font-black text-slate-800 dark:text-white mb-1">لا توجد طلبات في هذه القائمة</p>
                  <p className="text-xs font-bold text-slate-500">جرب تغيير الفلتر أو مربع البحث.</p>
                </div>
              ) : (
                (activeTab === 'pending' ? pendingList : historyList).map(req => (
                  <div key={req.id} className="bg-white dark:bg-[#121214] rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] hover:border-fuchsia-300 dark:hover:border-white/20 transition-all duration-300 flex flex-col overflow-hidden relative group">
                    
                    <div className={`absolute top-0 right-0 w-1.5 h-full transition-all duration-300 group-hover:w-2 ${req.request_type === 'سلفة' ? 'bg-indigo-500' : 'bg-sky-500'}`}></div>

                    <div className="p-5 flex gap-4 items-start border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c]/50">
                      <div className={`w-12 h-12 rounded-[1rem] bg-gradient-to-br ${req.staff?.avatar_color || 'from-slate-600 to-slate-800'} text-white flex items-center justify-center font-black text-lg shrink-0 shadow-inner border border-white/10 group-hover:scale-105 transition-transform`}>
                        {getInitials(req.staff?.full_name)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-black text-slate-900 dark:text-white text-[15px]">{req.staff?.full_name}</h3>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500"/> {req.staff?.branch} • {req.staff?.role}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-md text-[9px] font-black border flex items-center gap-1 shadow-sm dark:shadow-inner ${
                            req.status === 'قيد الانتظار' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20' : 
                            req.status === 'موافق عليه' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 
                            'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'
                          }`}>
                            {req.status === 'قيد الانتظار' && <Clock className="w-3 h-3"/>}
                            {req.status === 'موافق عليه' && <CheckCircle2 className="w-3 h-3"/>}
                            {req.status === 'مرفوض' && <XCircle className="w-3 h-3"/>}
                            {req.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 flex-1 relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`p-1.5 rounded-lg border shadow-sm dark:shadow-inner ${req.request_type === 'سلفة' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20' : 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/20'}`}>
                          {req.request_type === 'سلفة' ? <Banknote className="w-4 h-4"/> : <CalendarClock className="w-4 h-4"/>}
                        </div>
                        <h4 className="font-black text-slate-700 dark:text-slate-300 text-[13px]">طلب {req.request_type}</h4>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mr-auto dir-ltr">{dayjs(req.created_at).format('YYYY-MM-DD | hh:mm A')}</span>
                      </div>

                      {req.request_type === 'سلفة' ? (
                        <div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 p-4 rounded-2xl text-center mb-4 shadow-sm dark:shadow-inner">
                          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-500 uppercase tracking-widest mb-1">المبلغ المطلوب</p>
                          <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400 dir-ltr">{req.amount.toLocaleString('en-US')} <span className="text-sm">د.ع</span></p>
                        </div>
                      ) : (
                        <div className="bg-sky-50 dark:bg-sky-500/5 border border-sky-100 dark:border-sky-500/10 p-4 rounded-2xl flex justify-between items-center text-center mb-4 shadow-sm dark:shadow-inner">
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-sky-600 dark:text-sky-500 uppercase tracking-widest mb-1">من تاريخ</p>
                            <p className="text-[13px] font-black text-sky-700 dark:text-sky-400 dir-ltr">{req.start_date}</p>
                          </div>
                          <div className="w-px h-8 bg-sky-200 dark:bg-sky-500/20"></div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-sky-600 dark:text-sky-500 uppercase tracking-widest mb-1">إلى تاريخ</p>
                            <p className="text-[13px] font-black text-sky-700 dark:text-sky-400 dir-ltr">{req.end_date}</p>
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">المبرر / ملاحظات الموظف:</p>
                        <p className="text-[12px] font-bold text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-[#0a0a0c] p-3 rounded-xl border border-slate-200 dark:border-white/5 min-h-[60px] shadow-sm dark:shadow-inner">{req.notes || 'لا توجد ملاحظات.'}</p>
                      </div>
                    </div>

                    {req.status === 'قيد الانتظار' && (
                      <div className="p-4 bg-slate-50 dark:bg-[#0a0a0c] border-t border-slate-200 dark:border-white/5 flex gap-3">
                        <button onClick={() => openApproveModal(req)} disabled={isProcessing} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black text-[13px] flex items-center justify-center gap-2 transition-all shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 active:scale-95 outline-none cursor-pointer">
                          <Check className="w-4 h-4"/> مراجعة واعتماد
                        </button>
                        <button onClick={() => handleReject(req)} disabled={isProcessing} className="flex-1 bg-white dark:bg-[#121214] hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-white/5 hover:border-rose-200 dark:hover:border-rose-500/20 py-3 rounded-xl font-black text-[13px] flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95 outline-none shadow-sm dark:shadow-none cursor-pointer">
                          <X className="w-4 h-4"/> رفض
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* 🌟 نافذة الاعتماد و "درع الحماية المالي" 🌟 */}
          {selectedReq && (
            <div className="fixed top-0 left-0 w-full h-[100dvh] z-[100] flex items-center justify-center px-4 py-10 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
              <div className="bg-white dark:bg-[#121214] w-full max-w-[500px] rounded-[2.5rem] shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-300 transition-colors">
                
                <div className={`p-6 border-b border-transparent dark:border-white/10 text-white flex justify-between items-center transition-colors ${selectedReq.request_type === 'سلفة' ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-sky-600 dark:bg-sky-500'}`}>
                  <div className="flex items-center gap-3">
                    {selectedReq.request_type === 'سلفة' ? <Banknote className="w-6 h-6"/> : <CalendarClock className="w-6 h-6"/>}
                    <div>
                      <h3 className="text-lg font-black tracking-tight">اعتماد طلب {selectedReq.request_type}</h3>
                      <p className="text-[11px] font-bold text-white/80 mt-0.5">الموظف: {selectedReq.staff?.full_name}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedReq(null)} className="p-2 bg-black/10 hover:bg-black/20 rounded-xl transition-colors active:scale-95 outline-none cursor-pointer"><X className="w-4 h-4"/></button>
                </div>

                <div className="p-6 space-y-6">
                  
                  {/* 🛡️ درع الحماية المالي 🛡️ */}
                  {selectedReq.request_type === 'سلفة' ? (
                    <div className={`border p-4 rounded-2xl flex gap-3 items-start shadow-sm dark:shadow-inner transition-colors ${
                      approvedAmount + empPreviousAdvances > (selectedReq.staff?.salary || 0) 
                        ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30' 
                        : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                    }`}>
                      {approvedAmount + empPreviousAdvances > (selectedReq.staff?.salary || 0) 
                        ? <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5"/>
                        : <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5"/>
                      }
                      <div className="flex-1">
                        <h4 className={`text-[11px] font-black tracking-widest uppercase mb-2 ${approvedAmount + empPreviousAdvances > (selectedReq.staff?.salary || 0) ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>درع الحماية المالي (الراتب)</h4>
                        
                        <div className="space-y-1.5 mt-2 text-[11px] font-bold">
                          <div className="flex justify-between text-slate-500 dark:text-slate-300"><span>الراتب الاسمي:</span> <span className="dir-ltr text-slate-800 dark:text-white">{(selectedReq.staff?.salary || 0).toLocaleString()} د.ع</span></div>
                          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>السلف المسحوبة سابقاً (هذا الشهر):</span> <span className="dir-ltr text-amber-600 dark:text-amber-400">{empPreviousAdvances.toLocaleString()} د.ع</span></div>
                          <div className="w-full h-px bg-slate-200 dark:bg-white/10 my-1"></div>
                          <div className="flex justify-between font-black text-sm">
                            <span className={approvedAmount + empPreviousAdvances > (selectedReq.staff?.salary || 0) ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>المتبقي من راتبه:</span> 
                            <span className={`dir-ltr ${approvedAmount + empPreviousAdvances > (selectedReq.staff?.salary || 0) ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{((selectedReq.staff?.salary || 0) - empPreviousAdvances - approvedAmount).toLocaleString()} د.ع</span>
                          </div>
                        </div>
                        
                        {approvedAmount + empPreviousAdvances > (selectedReq.staff?.salary || 0) && (
                          <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 mt-2 bg-rose-100 dark:bg-rose-500/10 p-2 rounded-lg border border-rose-200 dark:border-rose-500/20">⚠️ تحذير: إجمالي سلف الموظف تتجاوز راتبه الشهري!</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 p-4 rounded-2xl flex gap-3 items-start shadow-sm dark:shadow-inner transition-colors">
                      <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5"/>
                      <div className="flex-1">
                        <h4 className="text-[11px] font-black text-sky-700 dark:text-sky-400 tracking-widest uppercase mb-1.5">رصيد الإجازات السنوية</h4>
                        <p className="text-[13px] font-bold text-slate-600 dark:text-slate-300 flex justify-between items-center">
                          الرصيد المتبقي للموظف: <span className="text-xl font-black text-slate-900 dark:text-white px-3 py-1 bg-white dark:bg-[#0a0a0c] rounded-lg border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">{selectedReq.staff?.annual_leave_balance || 0} يوم</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedReq.request_type === 'سلفة' ? (
                    <div>
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-widest transition-colors">المبلغ المعتمد النهائي (د.ع) <span className="text-[9px] text-indigo-500 dark:text-indigo-400">(يمكنك تعديله)</span></label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={approvedAmount} 
                          onChange={(e) => setApprovedAmount(Number(e.target.value))} 
                          className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 font-black text-xl px-4 py-4 rounded-2xl focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-indigo-500/10 dir-ltr text-center shadow-sm dark:shadow-inner transition-colors"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-widest transition-colors">حدد نوع الإجازة <span className="text-[9px] text-sky-500 dark:text-sky-400">(ستسجل بالنظام المالي)</span></label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => setLeaveType('إجازة براتب')}
                          className={`p-4 rounded-2xl border font-black text-[12px] flex flex-col items-center gap-2 transition-all outline-none active:scale-95 cursor-pointer ${leaveType === 'إجازة براتب' ? 'bg-sky-50 dark:bg-sky-500/20 border-sky-300 dark:border-sky-500/50 text-sky-700 dark:text-sky-400 shadow-sm dark:shadow-inner' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5 text-slate-500 hover:border-slate-300 dark:hover:border-white/20'}`}
                        >
                          <Wallet className="w-5 h-5"/> مدفوعة (تخصم من الرصيد)
                        </button>
                        <button 
                          onClick={() => setLeaveType('إجازة بدون راتب')}
                          className={`p-4 rounded-2xl border font-black text-[12px] flex flex-col items-center gap-2 transition-all outline-none active:scale-95 cursor-pointer ${leaveType === 'إجازة بدون راتب' ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-400 shadow-sm dark:shadow-inner' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5 text-slate-500 hover:border-slate-300 dark:hover:border-white/20'}`}
                        >
                          <User className="w-5 h-5"/> مخصومة (تخصم من الراتب)
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                <div className="p-5 border-t border-slate-200 dark:border-white/5 flex gap-3 bg-slate-50 dark:bg-[#0a0a0c] transition-colors">
                  <button onClick={() => setSelectedReq(null)} className="px-6 py-3.5 bg-white dark:bg-[#121214] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 rounded-xl font-black text-[13px] transition-all outline-none active:scale-95 border border-slate-200 dark:border-white/5 cursor-pointer">إلغاء</button>
                  <button onClick={confirmApproval} disabled={isProcessing} className={`flex-1 text-white py-3.5 rounded-xl font-black text-[14px] flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95 outline-none cursor-pointer ${selectedReq.request_type === 'سلفة' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-md dark:shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'bg-sky-600 hover:bg-sky-500 shadow-md dark:shadow-[0_0_20px_rgba(2,132,199,0.4)]'}`}>
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5"/>} تأكيد الاعتماد والتنفيذ
                  </button>
                </div>
                
              </div>
            </div>
          )}

        </div>
        <style dangerouslySetInnerHTML={{__html: `
          .dir-ltr { direction: ltr; }
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />
      </div>
    </div>
  );
}