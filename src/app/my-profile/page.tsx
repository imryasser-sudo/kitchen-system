"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import 'dayjs/locale/ar-iq';

import { 
  Wallet, FileText, CalendarDays, LogOut, CheckCircle2, XCircle, 
  Loader2, Banknote, ShieldCheck, CreditCard, AlertTriangle, MonitorPlay, 
  QrCode, ChevronDown, Clock, Phone, HeartPulse, ReceiptText, TrendingUp,
  User, Sun, Moon, UserCheck, UserX, Ban, DollarSign, Briefcase, TrendingDown, Info
} from 'lucide-react';

dayjs.locale('ar-iq');

const leaveReasons = [
  "إجازة شهرية اعتيادية",
  "أسباب شخصية / التزامات خاصة",
  "إجازة مرضية / مراجعة طبيب",
  "إجازة سنوية / استراحة اعتيادية",
  "ظرف عائلي طارئ / حالة وفاة",
  "زواج / مناسبة عائلية خاصة",
  "مراجعة دوائر حكومية / تخليص معاملات",
  "إجازة أمومة / رعاية طفل",
  "إجازة دراسية / أداء امتحانات",
  "السفر خارج البلاد",
  "أخرى (يرجى التوضيح)"
];

const advanceReasons = [
  "مصاريف شخصية / احتياجات خاصة",
  "حالة طبية طارئة / مصاريف علاج",
  "إيجار سكن متأخر / التزامات سكنية",
  "رسوم دراسية / أقساط مدارس وجامعات",
  "صيانة سيارة / حادث مروري طارئ",
  "مصاريف زواج / خطوبة",
  "سداد ديون مستعجلة",
  "صيانة المنزل / ترميمات ضرورية",
  "مصاريف عائلية طارئة",
  "أخرى (يرجى التوضيح)"
];

const leaveDurations = [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30];

export default function SinglePageEmployeeDashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
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

  useEffect(() => {
    const session = localStorage.getItem('erp_session');
    if (!session) router.push('/login');
    else { setCurrentUser(JSON.parse(session)); setMounted(true); }
  }, [router]);

  // 💡 الاستماع لإشارة التغيير الفورية من الشريط العالمي 💡
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

  const handleLogout = () => { localStorage.removeItem('erp_session'); router.push('/login'); };

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

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2) : '؟';

  if (!mounted || !currentUser) return null;

  return (
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
        <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 active:scale-95 outline-none transition-all">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="p-4 md:p-6 max-w-[800px] mx-auto space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-40"><Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /></div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* ==================================================== */}
            {/* 1️⃣ بطاقة الهوية الذكية */}
            {/* ==================================================== */}
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

            {/* 2️⃣ زر شاشة المطبخ (KDS) العملاق */}
            <button onClick={() => router.push('/kds')} className="w-full bg-gradient-to-l from-rose-600 to-pink-600 text-white p-5 rounded-[1.5rem] shadow-[0_10px_30px_-10px_rgba(225,29,72,0.5)] flex items-center justify-between outline-none active:scale-95 transition-transform group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                  <MonitorPlay className="w-7 h-7" />
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-black mb-0.5">شاشة المطبخ (KDS)</h3>
                  <p className="text-[11px] text-rose-200 font-bold">اضغط هنا لتجهيز الطلبيات الحية</p>
                </div>
              </div>
            </button>

            {/* 3️⃣ تقديم الطلبات (سلفة / إجازة) */}
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

            {/* ==================================================== */}
            {/* 4️⃣ التفاصيل الشاملة للراتب والدوام (دائماً ظاهرة) */}
            {/* ==================================================== */}
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

              {/* 5️⃣ سجل الدوام والغيابات */}
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

              {/* 6️⃣ سجل الحركات المالية */}
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

              {/* 7️⃣ سجل ومتابعة الطلبات */}
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

      {/* النافذة المنبثقة للطلبات */}
      {activeModal !== 'none' && (
        <div className="fixed inset-0 z-[100000] flex items-end md:items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 pb-12 animate-in fade-in duration-300">
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
                  <input type="number" required min="1000" value={requestData.amount} onChange={e => setRequestData({...requestData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black text-lg p-3.5 rounded-xl focus:outline-none focus:border-amber-500 dir-ltr text-right en-num" placeholder="مثال: 50000" />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-black text-slate-500 mb-1.5 block">مدة الإجازة المطلوبة</label>
                  <div className="relative">
                    <select 
                      value={requestData.days}
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
                    value={requestData.reason}
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
                    value={requestData.otherReason} 
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
        </div>
      )}

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