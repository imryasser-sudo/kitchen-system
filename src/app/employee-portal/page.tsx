"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  User, Phone, LogIn, Loader2, Wallet, CalendarDays, 
  ReceiptText, Banknote, CalendarClock, ChevronRight, 
  LogOut, Clock, CheckCircle2, AlertCircle, Send, X,
  MapPin, Globe, Cake, Home, Briefcase, Network, UserMinus, ShieldCheck,
  TrendingUp, TrendingDown, FileText, Download, HeartPulse, CreditCard, AlertTriangle, ShieldAlert
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

export default function EmployeePortalPage() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile'>('dashboard');
  const [activeModal, setActiveModal] = useState<'none' | 'advance' | 'leave'>('none');
  const [requestData, setRequestData] = useState({ amount: '', startDate: '', endDate: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentMonthDisplay = dayjs().format('MM / YYYY');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) { setErrorMsg('يرجى إدخال رقم الهاتف'); return; }
    
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('phone', phoneNumber.trim())
        .eq('status', 'نشط')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setErrorMsg('رقم الهاتف غير مسجل أو الحساب غير نشط.');
        return;
      }
      
      setEmployee(data);
      localStorage.setItem('emp_portal_phone', data.phone);
      fetchEmployeeData(data.id);
    } catch (err) {
      setErrorMsg('حدث خطأ في النظام، حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if(window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      localStorage.removeItem('emp_portal_phone');
      setEmployee(null);
      setPhoneNumber('');
    }
  };

  useEffect(() => {
    const autoLogin = async () => {
      const savedPhone = localStorage.getItem('emp_portal_phone');
      if (savedPhone) {
        setPhoneNumber(savedPhone);
        const { data } = await supabase.from('staff').select('*').eq('phone', savedPhone).eq('status', 'نشط').maybeSingle();
        if (data) {
          setEmployee(data);
          await fetchEmployeeData(data.id);
        } else {
          localStorage.removeItem('emp_portal_phone'); 
        }
      }
      setIsInitializing(false); 
    };
    autoLogin();
  }, []);

  const fetchEmployeeData = async (empId: string) => {
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
    const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD');

    const [attRes, adjRes, reqRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', empId).gte('record_date', startOfMonth).lte('record_date', endOfMonth),
      supabase.from('payroll_adjustments').select('*').eq('employee_id', empId).gte('record_date', startOfMonth).lte('record_date', endOfMonth),
      supabase.from('employee_requests').select('*').eq('employee_id', empId).order('created_at', { ascending: false }).limit(10)
    ]);

    setAttendance(attRes.data || []);
    setAdjustments(adjRes.data || []);
    setRequests(reqRes.data || []);
  };

  const payrollStats = React.useMemo(() => {
    if (!employee || !employee.salary) return null;

    let present = 0, absent = 0, paidLeave = 0, unpaidLeave = 0, halfDays = 0, attDeductions = 0;
    
    attendance.forEach(a => {
      if (a.status === 'حاضر') present += 1;
      else if (a.status === 'نصف يوم') { present += 0.5; halfDays += 1; }
      else if (a.status === 'غائب') absent += 1;
      else if (a.status === 'إجازة براتب' || a.status === 'مجاز') paidLeave += 1;
      else if (a.status === 'إجازة بدون راتب') unpaidLeave += 1;

      if (a.deduction) attDeductions += Number(a.deduction);
    });

    const dailyRate = employee.salary / 30;
    const unpaidDays = absent + unpaidLeave + (halfDays * 0.5);
    const absenceDeductionAmount = Math.round(unpaidDays * dailyRate);
    const earnedSalary = Math.round(Math.max(0, employee.salary - absenceDeductionAmount));

    let bonus = 0, manualDeduction = 0, advance = 0;
    adjustments.forEach(a => {
      if (a.adjustment_type === 'إضافي') bonus += Number(a.amount);
      if (a.adjustment_type === 'خصم') manualDeduction += Number(a.amount);
      if (a.adjustment_type === 'سلفة') advance += Number(a.amount);
    });

    const financialDeductions = attDeductions + manualDeduction;
    const netSalary = Math.round(earnedSalary + bonus - financialDeductions - advance);

    return { 
      present, absent, paidLeave, unpaidLeave, halfDays, unpaidDays,
      absenceDeductionAmount, attDeductions, bonus, manualDeduction, advance,
      financialDeductions, earnedSalary, netSalary 
    };
  }, [employee, attendance, adjustments]);

  const detailedFinancialLog = React.useMemo(() => {
    if (!employee || !employee.salary) return [];
    const log: any[] = [];
    const dailyRate = employee.salary / 30;

    adjustments.forEach(adj => {
      log.push({
        id: adj.id, date: adj.record_date, title: adj.category, type: adj.adjustment_type, amount: Number(adj.amount), notes: adj.notes
      });
    });

    attendance.forEach(att => {
      let deductionAmount = 0; let title = '';
      if (att.status === 'غائب') { deductionAmount = dailyRate; title = 'غياب بدون عذر'; } 
      else if (att.status === 'إجازة بدون راتب') { deductionAmount = dailyRate; title = 'إجازة بدون راتب'; } 
      else if (att.status === 'نصف يوم') { deductionAmount = dailyRate / 2; title = 'نصف يوم عمل'; }

      if (att.deduction && Number(att.deduction) > 0) {
        log.push({ id: `att-deduct-${att.id}`, date: att.record_date, title: 'خصم تأخير/عقوبة من الدوام', type: 'خصم', amount: Number(att.deduction), notes: att.notes || 'مسجل مع سجل الحضور' });
      }

      if (deductionAmount > 0) {
        log.push({ id: `att-absence-${att.id}`, date: att.record_date, title: title, type: 'استقطاع غياب', amount: Math.round(deductionAmount), notes: att.notes || 'استقطاع تلقائي بسبب حالة الدوام' });
      }
    });

    return log.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
  }, [adjustments, attendance, employee]);

  const submitRequest = async () => {
    if (activeModal === 'advance' && !requestData.amount) return alert('يرجى إدخال مبلغ السلفة');
    if (activeModal === 'leave' && (!requestData.startDate || !requestData.endDate)) return alert('يرجى تحديد تواريخ الإجازة');

    setIsSubmitting(true);
    try {
      const payload = {
        employee_id: employee.id,
        request_type: activeModal === 'advance' ? 'سلفة' : 'إجازة',
        amount: activeModal === 'advance' ? Number(requestData.amount) : 0,
        start_date: activeModal === 'leave' ? requestData.startDate : null,
        end_date: activeModal === 'leave' ? requestData.endDate : null,
        notes: requestData.notes
      };

      await supabase.from('employee_requests').insert([payload]);
      
      alert('تم إرسال طلبك للإدارة بنجاح!');
      setActiveModal('none');
      setRequestData({ amount: '', startDate: '', endDate: '', notes: '' });
      fetchEmployeeData(employee.id); 
    } catch (err) {
      alert('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2) : '?';

  // حساب حالة الشهادة الصحية
  const checkHealthCert = () => {
    if (!employee?.health_cert_expiry) return { status: 'missing', text: 'غير مدرجة', color: 'text-slate-500' };
    const daysLeft = dayjs(employee.health_cert_expiry).diff(dayjs(), 'day');
    if (daysLeft < 0) return { status: 'expired', text: 'منتهية الصلاحية!', color: 'text-rose-400' };
    if (daysLeft <= 30) return { status: 'warning', text: `تنتهي قريباً (${daysLeft} يوم)`, color: 'text-amber-400' };
    return { status: 'valid', text: 'سارية المفعول', color: 'text-emerald-400' };
  };
  const healthStatus = checkHealthCert();

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold tracking-widest text-sm uppercase">جاري تحميل البوابة...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans relative overflow-hidden" dir="rtl">
        <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#050505] to-[#050505] -z-10 pointer-events-none"></div>

        <div className="bg-[#121214] w-full max-w-md rounded-[2.5rem] p-8 border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] text-center animate-in fade-in zoom-in-95 duration-500 relative z-10">
          <div className="w-24 h-24 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-indigo-500/20">
            <User className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">بوابة الخدمة الذاتية</h2>
          <p className="text-sm font-bold text-slate-400 mb-8">أدخل رقم هاتفك المسجل في النظام للدخول</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"><Phone className="w-5 h-5"/></div>
              <input 
                type="tel" 
                placeholder="07XX XXX XXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-[#0a0a0c] border border-white/10 text-white font-black text-xl px-4 pr-12 py-4 rounded-2xl focus:outline-none focus:border-indigo-500 focus:bg-[#121214] transition-all dir-ltr text-center shadow-inner focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
            
            {errorMsg && <p className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">{errorMsg}</p>}

            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg py-4 rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] transition-all disabled:opacity-50 active:scale-95">
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <LogIn className="w-6 h-6" />} دخول لبوابة الموظف
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-28 font-sans relative" dir="rtl">
      
      <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/15 via-[#050505] to-[#050505] -z-10 pointer-events-none"></div>

      {/* هيدر الموظف المظلم */}
      <div className="bg-[#121214] border-b border-white/5 px-6 pt-10 pb-10 shadow-sm relative overflow-hidden rounded-b-[3rem] print-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="flex justify-between items-start relative z-10 max-w-xl mx-auto">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-[1.5rem] bg-[#0a0a0c] text-indigo-400 flex items-center justify-center font-black text-2xl shadow-inner border border-white/10`}>
              {getInitials(employee.full_name)}
            </div>
            <div>
              <p className="text-emerald-400 text-[11px] font-black uppercase tracking-wider mb-1">مرحباً بك،</p>
              <h2 className="text-xl md:text-2xl font-black text-white">{employee.full_name}</h2>
              <p className="text-[12px] font-bold text-slate-400 mt-0.5">{employee.role} • {employee.branch}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-3 bg-white/5 border border-white/10 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-colors active:scale-95"><LogOut className="w-5 h-5" /></button>
        </div>
      </div>

      {/* التابات العائمة */}
      <div className="flex justify-center -mt-6 relative z-30 px-5 max-w-xl mx-auto mb-8 print-hidden">
        <div className="bg-[#0a0a0c] p-1.5 rounded-2xl shadow-lg border border-white/10 flex w-full">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex-1 py-3 text-[13px] font-black rounded-xl transition-all flex justify-center items-center gap-2 outline-none active:scale-95 ${activeTab === 'dashboard' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Wallet className="w-4 h-4" /> الراتب والطلبات
          </button>
          <button 
            onClick={() => setActiveTab('profile')} 
            className={`flex-1 py-3 text-[13px] font-black rounded-xl transition-all flex justify-center items-center gap-2 outline-none active:scale-95 ${activeTab === 'profile' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <User className="w-4 h-4" /> ملفي الشخصي (شامل)
          </button>
        </div>
      </div>

      <div className="px-5 relative z-20 space-y-6 max-w-xl mx-auto">
        
        {/* 🟢 تبويب الداشبورد (الراتب والطلبات) 🟢 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* كارت الراتب الصافي الرئيسي */}
            <div className="bg-[#121214] p-8 rounded-[2.5rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden group printable-area">
              <div className="absolute top-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 print-hidden"></div>
              <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-indigo-400"/> الصافي النهائي المستحق (لشهر {currentMonthDisplay})
              </p>
              <h1 className="text-4xl md:text-5xl font-black text-white dir-ltr my-2 group-hover:scale-105 transition-transform duration-300">
                {payrollStats?.netSalary?.toLocaleString('en-US') || 0} <span className="text-xl text-slate-500">د.ع</span>
              </h1>
            </div>

            {/* 💡 كارت تفاصيل حساب الراتب 💡 */}
            <div className="bg-[#121214] rounded-[2rem] p-6 border border-white/10 shadow-sm printable-area">
              <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-5">
                <h3 className="text-sm font-black text-white flex items-center gap-2"><ReceiptText className="w-5 h-5 text-emerald-400"/> كشف حساب الراتب التفصيلي</h3>
                <button onClick={() => window.print()} className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors print-hidden flex items-center gap-1 text-[10px] font-black border border-emerald-500/20"><Download className="w-3.5 h-3.5"/> طباعة الوصل</button>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="font-bold text-slate-400">الراتب الاسمي (العقد)</span>
                  <span className="font-black text-slate-300 dir-ltr">{employee.salary?.toLocaleString('en-US')} د.ع</span>
                </div>
                
                {(payrollStats?.unpaidDays ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="font-bold text-slate-400">إجمالي استقطاع الغياب ({payrollStats?.unpaidDays} أيام)</span>
                    <span className="font-black text-rose-400 dir-ltr">- {payrollStats?.absenceDeductionAmount?.toLocaleString('en-US')} د.ع</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-[13px] bg-[#0a0a0c] p-3 rounded-xl border border-white/5 shadow-inner my-2">
                  <span className="font-black text-slate-300">المستحق مقابل الدوام</span>
                  <span className="font-black text-emerald-400 dir-ltr">{payrollStats?.earnedSalary?.toLocaleString('en-US')} د.ع</span>
                </div>

                {(payrollStats?.bonus ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="font-bold text-slate-400">مكافآت وحوافز إضافية</span>
                    <span className="font-black text-emerald-400 dir-ltr">+ {payrollStats?.bonus?.toLocaleString('en-US')} د.ع</span>
                  </div>
                )}

                {(payrollStats?.financialDeductions ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="font-bold text-slate-400">خصومات وعقوبات إدارية</span>
                    <span className="font-black text-rose-400 dir-ltr">- {payrollStats?.financialDeductions?.toLocaleString('en-US')} د.ع</span>
                  </div>
                )}

                {(payrollStats?.advance ?? 0) > 0 && (
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="font-bold text-slate-400">سحب سلف (مستردة)</span>
                    <span className="font-black text-amber-400 dir-ltr">- {payrollStats?.advance?.toLocaleString('en-US')} د.ع</span>
                  </div>
                )}
              </div>
            </div>

            {/* أزرار الخدمات السريعة */}
            <h3 className="text-sm font-black text-slate-400 px-2 mt-6 uppercase tracking-widest print-hidden">الخدمات السريعة</h3>
            <div className="grid grid-cols-2 gap-4 print-hidden">
              <button onClick={() => setActiveModal('advance')} className="bg-[#121214] p-5 rounded-[2rem] shadow-sm border border-white/10 flex flex-col items-center justify-center gap-3 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all outline-none active:scale-95 group">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full group-hover:scale-110 transition-transform"><Banknote className="w-6 h-6"/></div>
                <span className="text-[13px] font-black text-slate-300">طلب سلفة مالية</span>
              </button>
              <button onClick={() => setActiveModal('leave')} className="bg-[#121214] p-5 rounded-[2rem] shadow-sm border border-white/10 flex flex-col items-center justify-center gap-3 hover:border-sky-500/50 hover:bg-sky-500/5 transition-all outline-none active:scale-95 group">
                <div className="p-3 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full group-hover:scale-110 transition-transform"><CalendarClock className="w-6 h-6"/></div>
                <span className="text-[13px] font-black text-slate-300">طلب إجازة/مغادرة</span>
              </button>
            </div>

            {/* 💡 كارت ملخص الحضور والإجازات السنوية 💡 */}
            <h3 className="text-sm font-black text-slate-400 px-2 mt-8 uppercase tracking-widest flex items-center gap-2 print-hidden"><CalendarDays className="w-4 h-4 text-indigo-400"/> ملخص الدوام والإجازات</h3>
            <div className="bg-[#121214] rounded-[2rem] p-5 border border-white/10 shadow-sm mt-4 print-hidden">
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#0a0a0c] p-3.5 rounded-2xl border border-white/5 shadow-inner flex items-center gap-3 hover:border-emerald-500/30 transition-colors">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg"><CheckCircle2 className="w-4 h-4"/></div>
                  <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">حضور</p><p className="text-lg font-black text-emerald-400">{payrollStats?.present} <span className="text-[10px]">يوم</span></p></div>
                </div>
                
                <div className="bg-[#0a0a0c] p-3.5 rounded-2xl border border-white/5 shadow-inner flex items-center gap-3 hover:border-rose-500/30 transition-colors">
                  <div className="p-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg"><AlertCircle className="w-4 h-4"/></div>
                  <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">غياب مخصوم</p><p className="text-lg font-black text-rose-400">{payrollStats?.unpaidDays} <span className="text-[10px]">يوم</span></p></div>
                </div>
              </div>

              {/* رصيد الإجازات */}
              <div className="bg-[#0a0a0c] border border-white/5 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg"><ShieldCheck className="w-4 h-4"/></div>
                  <div>
                    <p className="text-[12px] font-black text-white">رصيد الإجازات السنوية</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">المتبقي من الرصيد المدفوع</p>
                  </div>
                </div>
                <div className="text-2xl font-black text-sky-400 bg-sky-500/10 px-4 py-1.5 rounded-lg border border-sky-500/20">
                  {employee.annual_leave_balance || 0} <span className="text-[10px] text-sky-500">يوم</span>
                </div>
              </div>

            </div>

            {/* السجل المالي المفصل */}
            <h3 className="text-sm font-black text-slate-400 px-2 mt-8 uppercase tracking-widest flex items-center gap-2 print-hidden">
              <FileText className="w-4 h-4 text-indigo-400" /> كشف الحركات (غياب، مكافآت، سلف)
            </h3>
            <div className="bg-[#121214] rounded-[2rem] border border-white/10 shadow-sm p-2 overflow-hidden print-hidden">
              {detailedFinancialLog.length === 0 ? (
                <p className="text-center text-xs font-bold text-slate-500 py-10">لا توجد حركات مسجلة هذا الشهر</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {detailedFinancialLog.map(item => (
                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-[#1a1a24] transition-colors rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl shadow-inner border ${
                          item.type === 'إضافي' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                          item.type === 'سلفة' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {item.type === 'إضافي' ? <TrendingUp className="w-5 h-5" /> : 
                           item.type === 'سلفة' ? <Banknote className="w-5 h-5" /> : 
                           <TrendingDown className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-[13px] font-black text-white">{item.title}</p>
                          <p className="text-[10px] font-bold text-slate-500 mt-1">
                            {item.date} {item.notes && item.notes !== '-' ? `• ${item.notes}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[13px] font-black dir-ltr ${
                        item.type === 'إضافي' ? 'text-emerald-400' : 
                        item.type === 'سلفة' ? 'text-amber-400' : 
                        'text-rose-400'
                      }`}>
                        {item.type === 'إضافي' ? '+' : '-'}{item.amount.toLocaleString('en-US')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🟢 تبويب الملف الشخصي (شامل كل المعلومات) 🟢 */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 mb-8">
            
            {/* 1. السجل الوظيفي */}
            <div className="bg-[#121214] rounded-[2rem] border border-white/10 shadow-sm p-6 space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500"></div>
              <h3 className="text-sm font-black text-white border-b border-white/5 pb-4 mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400"/> السجل الوظيفي والدوام
              </h3>
              
              <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors">
                <div className="p-3 bg-[#0a0a0c] border border-white/5 text-slate-400 rounded-xl shadow-inner"><MapPin className="w-5 h-5"/></div>
                <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">موقع العمل والقسم</p><p className="text-[14px] font-black text-slate-300 mt-1">{employee.branch} • {employee.department || 'عام'}</p></div>
              </div>

              <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors">
                <div className="p-3 bg-[#0a0a0c] border border-white/5 text-slate-400 rounded-xl shadow-inner"><Clock className="w-5 h-5"/></div>
                <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">شفت الدوام المخصص</p><p className="text-[14px] font-black text-slate-300 mt-1">{employee.shift_time || 'غير محدد (مرن)'}</p></div>
              </div>

              <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors">
                <div className="p-3 bg-[#0a0a0c] border border-white/5 text-slate-400 rounded-xl shadow-inner"><CalendarDays className="w-5 h-5"/></div>
                <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">تاريخ المباشرة</p><p className="text-[14px] font-black text-slate-300 dir-ltr text-right mt-1">{employee.join_date || 'غير محدد'}</p></div>
              </div>
            </div>

            {/* 2. الصحة والقانونية (مهم للمطاعم) */}
            <div className="bg-[#121214] rounded-[2rem] border border-white/10 shadow-sm p-6 space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
              <h3 className="text-sm font-black text-white border-b border-white/5 pb-4 mb-2 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-emerald-400"/> الرقابة الصحية والمستندات
              </h3>
              
              <div className="flex items-center gap-4 bg-[#0a0a0c] border border-white/5 p-3 rounded-xl shadow-inner">
                <div className={`p-3 rounded-xl ${healthStatus.status === 'valid' ? 'bg-emerald-500/10 text-emerald-400' : healthStatus.status === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {healthStatus.status === 'valid' ? <ShieldCheck className="w-5 h-5"/> : <ShieldAlert className="w-5 h-5"/>}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">البطاقة الصحية (الفحص الطبي)</p>
                  <p className={`text-[13px] font-black mt-1 ${healthStatus.color}`}>{healthStatus.text}</p>
                </div>
                {employee.health_cert_expiry && <div className="text-[11px] font-bold text-slate-400 dir-ltr">{employee.health_cert_expiry}</div>}
              </div>
            </div>

            {/* 3. المعلومات البنكية والمالية */}
            <div className="bg-[#121214] rounded-[2rem] border border-white/10 shadow-sm p-6 space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-sky-500"></div>
              <h3 className="text-sm font-black text-white border-b border-white/5 pb-4 mb-2 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-sky-400"/> بيانات الدفع والراتب
              </h3>
              
              <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors">
                <div className="p-3 bg-[#0a0a0c] border border-white/5 text-slate-400 rounded-xl shadow-inner"><Wallet className="w-5 h-5"/></div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">طريقة استلام الراتب</p>
                  <p className="text-[14px] font-black text-sky-400 mt-1">{employee.payment_method || 'استلام نقدي (كاش)'}</p>
                </div>
              </div>

              {(employee.payment_method === 'بنك' || employee.payment_method === 'زين كاش' || employee.payment_method === 'بطاقة') && (
                <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors">
                  <div className="p-3 bg-[#0a0a0c] border border-white/5 text-slate-400 rounded-xl shadow-inner"><Banknote className="w-5 h-5"/></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">رقم الحساب / IBAN / المحفظة</p>
                    <p className="text-[13px] font-black text-slate-300 mt-1 dir-ltr">{employee.bank_account || 'غير مدرج'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 4. الطوارئ */}
            <div className="bg-[#121214] rounded-[2rem] border border-white/10 shadow-sm p-6 space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-rose-500"></div>
              <h3 className="text-sm font-black text-white border-b border-white/5 pb-4 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400"/> جهة الاتصال للطوارئ
              </h3>
              
              <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl shadow-inner"><Phone className="w-5 h-5"/></div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">الاسم والقرابة</p>
                  <p className="text-[14px] font-black text-slate-300 mt-1">{employee.emergency_contact_name || 'غير مدرج'}</p>
                  <p className="text-[13px] font-bold text-slate-400 dir-ltr mt-1">{employee.emergency_contact_phone || '---'}</p>
                </div>
              </div>
            </div>

            {/* 5. المعلومات الشخصية (الأساسية) */}
            <div className="bg-[#121214] rounded-[2rem] border border-white/10 shadow-sm p-6 space-y-5">
              <h3 className="text-sm font-black text-white border-b border-white/5 pb-4 mb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400"/> المعلومات الشخصية (الهوية)
              </h3>
              
              <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors">
                <div className="p-3 bg-[#0a0a0c] border border-white/5 text-slate-400 rounded-xl shadow-inner"><Phone className="w-5 h-5"/></div>
                <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">رقم الهاتف الشخصي</p><p className="text-[14px] font-black text-slate-300 dir-ltr text-right mt-1">{employee.phone}</p></div>
              </div>
              
              <div className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors">
                <div className="p-3 bg-[#0a0a0c] border border-white/5 text-slate-400 rounded-xl shadow-inner"><Cake className="w-5 h-5"/></div>
                <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">تاريخ الميلاد</p><p className="text-[14px] font-black text-slate-300 mt-1">{employee.birth_date || 'غير محدد'}</p></div>
              </div>

              <div className="flex items-start gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors">
                <div className="p-3 bg-[#0a0a0c] border border-white/5 text-slate-400 rounded-xl mt-1 shadow-inner"><Home className="w-5 h-5"/></div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">السكن: <span className="text-emerald-400">{employee.accommodation_type || 'سكن شخصي'}</span></p>
                  <p className="text-[13px] font-bold text-slate-300 mt-1.5 leading-relaxed">{employee.address || 'العنوان التفصيلي غير مدرج'}</p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* 💡 الفورم المنبثق لطلب سلفة أو إجازة */}
      {activeModal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300 p-2 md:p-0 md:items-center print-hidden">
          <div className="bg-[#121214] w-full max-w-lg rounded-[2.5rem] p-6 md:p-8 pb-10 border border-white/10 shadow-[0_0_50px_rgba(79,70,229,0.15)] animate-in slide-in-from-bottom-full md:zoom-in-95 duration-400">
            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
              <h3 className="text-xl font-black text-white flex items-center gap-3">
                <div className={`p-2 rounded-xl shadow-inner border ${activeModal === 'advance' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>
                  {activeModal === 'advance' ? <Banknote className="w-6 h-6"/> : <CalendarClock className="w-6 h-6"/>}
                </div>
                {activeModal === 'advance' ? 'تقديم طلب سلفة' : 'تقديم طلب إجازة'}
              </h3>
              <button onClick={() => setActiveModal('none')} className="p-2.5 bg-white/5 hover:bg-rose-500/20 rounded-xl text-slate-400 hover:text-rose-400 transition-colors active:scale-95"><X className="w-5 h-5"/></button>
            </div>

            <div className="space-y-6">
              {activeModal === 'advance' ? (
                <div>
                  <label className="text-[12px] font-black text-slate-400 mb-2.5 block uppercase tracking-widest">المبلغ المطلوب (د.ع)</label>
                  <input type="number" placeholder="أدخل المبلغ..." value={requestData.amount} onChange={e => setRequestData({...requestData, amount: e.target.value})} className="w-full bg-[#0a0a0c] border border-white/10 text-white font-black text-xl px-4 py-4 rounded-2xl focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 dir-ltr text-right shadow-inner" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[12px] font-black text-slate-400 mb-2.5 block uppercase tracking-widest">من تاريخ</label>
                    <input type="date" value={requestData.startDate} onChange={e => setRequestData({...requestData, startDate: e.target.value})} className="w-full bg-[#0a0a0c] border border-white/10 text-white font-bold px-4 py-4 rounded-2xl focus:outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 shadow-inner" />
                  </div>
                  <div>
                    <label className="text-[12px] font-black text-slate-400 mb-2.5 block uppercase tracking-widest">إلى تاريخ</label>
                    <input type="date" value={requestData.endDate} onChange={e => setRequestData({...requestData, endDate: e.target.value})} className="w-full bg-[#0a0a0c] border border-white/10 text-white font-bold px-4 py-4 rounded-2xl focus:outline-none focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 shadow-inner" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[12px] font-black text-slate-400 mb-2.5 block uppercase tracking-widest">السبب / المبرر</label>
                <textarea placeholder="اكتب سبب الطلب للإدارة..." value={requestData.notes} onChange={e => setRequestData({...requestData, notes: e.target.value})} rows={3} className="w-full bg-[#0a0a0c] border border-white/10 text-white font-bold px-4 py-4 rounded-2xl focus:outline-none focus:border-slate-500/50 focus:ring-2 focus:ring-slate-500/20 resize-none shadow-inner"></textarea>
              </div>

              <button onClick={submitRequest} disabled={isSubmitting} className={`w-full text-white py-4 mt-2 rounded-2xl font-black text-[16px] flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${activeModal === 'advance' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'bg-sky-600 hover:bg-sky-500 shadow-[0_0_20px_rgba(2,132,199,0.3)]'}`}>
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>} إرسال الطلب للإدارة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تنسيقات الطباعة المخفية والخطوط */}
      <style dangerouslySetInnerHTML={{__html: `
        .dir-ltr { direction: ltr; }
        .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
        
        @media print {
          body { background: white !important; color: black !important; }
          .print-hidden { display: none !important; }
          .printable-area { 
            background: white !important; 
            border: 1px solid #ccc !important; 
            box-shadow: none !important; 
            color: black !important;
            page-break-inside: avoid;
          }
          * { text-shadow: none !important; }
        }
      `}} />
    </div>
  );
}