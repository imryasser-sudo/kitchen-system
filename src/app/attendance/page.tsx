"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider'; 
import { toast } from 'sonner'; // 💡 استيراد مكتبة الإشعارات المضافة حديثاً
import { 
  Search, CalendarDays, Users, UserCheck, UserX, Clock, 
  Ban, FileText, CheckCircle2, Loader2, AlertCircle, ChevronRight, ChevronLeft,
  DollarSign, Coffee, Briefcase, Hourglass, LayoutGrid, ChevronDown,
  History, ShoppingCart, BarChart3, Eye, EyeOff
} from 'lucide-react';
import Link from 'next/link';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

interface Employee {
  id: string;
  full_name: string;
  role: string;
  branch: string;
  department: string;
  avatar_color: string;
}

interface AttendanceRecord {
  id?: string;
  employee_id: string;
  record_date: string;
  status: 'حاضر' | 'غائب' | 'إجازة براتب' | 'إجازة بدون راتب';
  deduction: number;
  notes: string;
}

export default function AttendancePage() {
  const pathname = usePathname();
  const { isDark } = useTheme(); 
  
  const [isZenMode, setIsZenMode] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [staff, setStaff] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [syncStatus, setSyncStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  
  const [viewTab, setViewTab] = useState<'pending' | 'recorded' | 'all'>('pending');

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, 
    viewDate: dayjs.Dayjs, 
    mode: 'date' | 'month' | 'year'
  }>({ isOpen: false, viewDate: dayjs(), mode: 'date' });

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, role, branch, department, avatar_color')
        .neq('status', 'منهى خدماته'); 
        
      if (error) throw error;

      const sortedData = (data || []).sort((a, b) => 
        (a.full_name || '').localeCompare(b.full_name || '', 'ar')
      );
      
      setStaff(sortedData);
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  };

  // 💡 الدالة المحدثة مع تنبيهات واضحة للأخطاء 💡
  const fetchAttendance = async (date: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('record_date', date);

      if (error) {
        console.error("Supabase Error Details:", error);
        throw error;
      }

      const recordsMap: Record<string, AttendanceRecord> = {};
      (data || []).forEach(record => {
        recordsMap[record.employee_id] = record;
      });
      
      setRecords(recordsMap);
    } catch (err: any) {
      console.error("Error fetching attendance:", err);
      // إظهار تنبيه واضح للمستخدم في حال عدم وجود الجدول
      if (err?.code === '42P01') {
        toast.error('عذراً، جدول الحضور (attendance) غير موجود في قاعدة البيانات!');
      } else if (err?.code === '42703') {
        toast.error('نقص في أعمدة الجدول (تأكد من وجود deduction و notes).');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchAttendance(selectedDate);
  }, [selectedDate]);

  const stats = useMemo(() => {
    let present = 0; let absent = 0; let paidLeave = 0; let unpaidLeave = 0;
    let recordedCount = 0;
    
    staff.forEach(emp => {
      const record = records[emp.id];
      if (record) {
        recordedCount++;
        if (record.status === 'حاضر') present++;
        else if (record.status === 'غائب') absent++;
        else if (record.status === 'إجازة براتب') paidLeave++;
        else if (record.status === 'إجازة بدون راتب') unpaidLeave++;
      }
    });

    return { 
      present, absent, paidLeave, unpaidLeave, 
      total: staff.length, 
      pending: staff.length - recordedCount 
    };
  }, [staff, records]);

  const displayStaff = useMemo(() => {
    const baseFiltered = staff.filter(emp => {
      const matchSearch = (emp.full_name || '').includes(searchQuery);
      const matchBranch = branchFilter ? emp.branch === branchFilter : true;
      return matchSearch && matchBranch;
    });

    return baseFiltered.filter(emp => {
      const hasRecord = !!records[emp.id];
      if (viewTab === 'pending') {
        const isAnimating = syncStatus[emp.id] === 'saving' || syncStatus[emp.id] === 'saved';
        return !hasRecord || isAnimating;
      }
      if (viewTab === 'recorded') return hasRecord;
      return true;
    });
  }, [staff, records, viewTab, searchQuery, branchFilter, syncStatus]);

  const uniqueBranches = useMemo(() => Array.from(new Set(staff.map(s => s.branch))), [staff]);
  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2) : '?';

  const syncRecordToServer = async (empId: string, updates: Partial<AttendanceRecord>) => {
    setSyncStatus(prev => ({ ...prev, [empId]: 'saving' }));
    
    const currentRecord = records[empId] || {
      employee_id: empId,
      record_date: selectedDate,
      status: 'حاضر',
      deduction: 0,
      notes: ''
    };

    const safeDeduction = updates.deduction !== undefined 
      ? (Number(updates.deduction) || 0) 
      : (Number(currentRecord.deduction) || 0);

    const newRecord = { 
      ...currentRecord, 
      ...updates,
      deduction: safeDeduction,
      notes: updates.notes !== undefined ? updates.notes : (currentRecord.notes || '')
    };

    setRecords(prev => ({ ...prev, [empId]: newRecord as AttendanceRecord }));

    try {
      const { data: existingRecords, error: selectError } = await supabase
        .from('attendance')
        .select('id')
        .eq('employee_id', empId)
        .eq('record_date', selectedDate);

      if (selectError) throw selectError;

      const existing = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

      if (existing) {
        const { error: updateError } = await supabase
          .from('attendance')
          .update({
            status: newRecord.status,
            deduction: newRecord.deduction,
            notes: newRecord.notes
          })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('attendance')
          .insert([{
            employee_id: empId,
            record_date: selectedDate,
            status: newRecord.status,
            deduction: newRecord.deduction,
            notes: newRecord.notes
          }]);
        if (insertError) throw insertError;
      }
      
      setSyncStatus(prev => ({ ...prev, [empId]: 'saved' }));
      setTimeout(() => { setSyncStatus(prev => ({ ...prev, [empId]: 'idle' })); }, 800);

    } catch (err: any) {
      console.error("Sync Error Details:", JSON.stringify(err, null, 2), err);
      toast.error('حدث خطأ أثناء الحفظ! يرجى التأكد من الجداول.');
      setSyncStatus(prev => ({ ...prev, [empId]: 'error' }));
    }
  };

  const handleStatusChange = (empId: string, status: any) => syncRecordToServer(empId, { status });
  const handleDeductionBlur = (empId: string, deduction: number) => syncRecordToServer(empId, { deduction });
  const handleNotesBlur = (empId: string, notes: string) => syncRecordToServer(empId, { notes });

  const openDatePicker = () => setDatePickerConfig({ isOpen: true, viewDate: dayjs(selectedDate), mode: 'date' });
  const handleDateSelection = (dateStr: string) => { setSelectedDate(dateStr); setDatePickerConfig(p => ({ ...p, isOpen: false })); };
  const changeDate = (days: number) => { const newDate = dayjs(selectedDate).add(days, 'day').format('YYYY-MM-DD'); setSelectedDate(newDate); };
  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const dayName = dayjs(selectedDate).format('dddd');

  return (
    <div className={`min-h-screen font-sans relative transition-colors duration-500 ease-in-out ${isDark ? 'dark' : ''}`}>
      <div className={`min-h-screen transition-all duration-700 ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-900 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-[130px]'}`} dir="rtl">
        
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-100 dark:from-rose-900/15 via-transparent dark:via-[#050505] to-transparent dark:to-[#050505] -z-10 pointer-events-none transition-opacity duration-700 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-700 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🌟 الهيدر الزجاجي المحدث (توسيط التقويم) 🌟 */}
          <div className={`bg-white/80 dark:bg-white/5 backdrop-blur-3xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col lg:flex-row items-center justify-between gap-6 mb-8 relative overflow-hidden transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="absolute left-0 top-0 w-64 h-64 bg-rose-100 dark:bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* 1️⃣ معلومات الصفحة (يمين الشاشة) */}
            <div className="flex items-center gap-5 w-full lg:w-1/3 relative z-10">
              <Link href="/hub" className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none">
                <LayoutGrid className="w-6 h-6 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-4">
                <div className="bg-rose-50 dark:bg-gradient-to-br dark:from-rose-500/20 dark:to-red-900/40 border border-rose-200 dark:border-rose-500/30 w-14 h-14 rounded-[1.3rem] text-rose-600 dark:text-rose-400 shadow-inner flex items-center justify-center shrink-0">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight">سجل الحضور</h2>
                  <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-1">لوحة الترحيل السريع</p>
                </div>
              </div>
            </div>

            {/* 2️⃣ التقويم (بالنصف تماماً على الكمبيوتر، وبالبداية على الموبايل) 💡 */}
            <div className="flex justify-center w-full lg:w-1/3 relative z-10 order-first lg:order-none">
              <div className="bg-white dark:bg-[#121214] p-2 rounded-2xl flex items-center justify-between w-full max-w-[320px] shadow-sm dark:shadow-inner border border-slate-200 dark:border-white/10 gap-4">
                <button onClick={() => changeDate(-1)} className="p-3 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition-colors border border-slate-100 dark:border-white/5 outline-none"><ChevronRight className="w-5 h-5" /></button>
                
                <div 
                  className="flex flex-col items-center flex-1 relative cursor-pointer group py-1" 
                  onClick={openDatePicker}
                >
                  <span className="text-[14px] md:text-[16px] font-black text-rose-500 dark:text-rose-400 mb-1 drop-shadow-sm flex items-center gap-1.5 group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors">
                    <CalendarDays className="w-4 h-4 md:w-5 md:h-5" /> {dayName}
                  </span>
                  <span className="text-[15px] md:text-[17px] font-black text-slate-900 dark:text-white dir-ltr group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors en-num tracking-widest">
                    {dayjs(selectedDate).format('DD / MM / YYYY')}
                  </span>
                </div>

                <button onClick={() => changeDate(1)} disabled={selectedDate === dayjs().format('YYYY-MM-DD')} className="p-3 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl transition-colors border border-slate-100 dark:border-white/5 disabled:opacity-30 disabled:hover:bg-slate-50 dark:disabled:hover:bg-white/5 disabled:hover:text-slate-400 outline-none"><ChevronLeft className="w-5 h-5" /></button>
              </div>
            </div>

            {/* 3️⃣ الإجراءات وزر التركيز (يسار الشاشة) */}
            <div className="flex justify-end items-center gap-4 w-full lg:w-1/3 relative z-10 hidden lg:flex">
              <button 
                onClick={() => setIsZenMode(true)}
                title="وضع التركيز لتسجيل الحضور"
                className="p-4 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 rounded-[1.5rem] text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner outline-none group"
              >
                <Eye className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>

          {/* 💡 الإحصائيات الشاملة */}
          <div className={`grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4 mb-8 transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="bg-white dark:bg-[#121214] p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl flex flex-col justify-center items-center text-center">
              <div className="p-2.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-2xl mb-2 border border-slate-200 dark:border-white/5"><Users className="w-5 h-5"/></div>
              <span className="text-2xl font-black text-slate-900 dark:text-white en-num">{stats.total}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mt-1">العدد الكلي</span>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-[2rem] border border-indigo-100 dark:border-indigo-500/20 shadow-sm dark:shadow-2xl flex flex-col justify-center items-center text-center">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl mb-2 border border-indigo-200 dark:border-indigo-500/30"><Hourglass className="w-5 h-5"/></div>
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 en-num">{stats.pending}</span>
              <span className="text-[10px] font-black text-indigo-600/70 dark:text-indigo-500/70 uppercase tracking-wider mt-1">بانتظار التسجيل</span>
            </div>
            <div className="bg-white dark:bg-[#121214] p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-emerald-50 dark:bg-emerald-500/5 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/10 transition-colors pointer-events-none"></div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-2 border border-emerald-100 dark:border-emerald-500/20 relative z-10"><UserCheck className="w-5 h-5"/></div>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 relative z-10 en-num">{stats.present}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mt-1 relative z-10">حاضرون</span>
            </div>
            <div className="bg-white dark:bg-[#121214] p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden group">
               <div className="absolute inset-0 bg-rose-50 dark:bg-rose-500/5 group-hover:bg-rose-100 dark:group-hover:bg-rose-500/10 transition-colors pointer-events-none"></div>
              <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl mb-2 border border-rose-100 dark:border-rose-500/20 relative z-10"><UserX className="w-5 h-5"/></div>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 relative z-10 en-num">{stats.absent}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mt-1 relative z-10">الغياب</span>
            </div>
            <div className="bg-white dark:bg-[#121214] p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-sky-50 dark:bg-sky-500/5 group-hover:bg-sky-100 dark:group-hover:bg-sky-500/10 transition-colors pointer-events-none"></div>
              <div className="p-2.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-2xl mb-2 border border-sky-100 dark:border-sky-500/20 relative z-10"><DollarSign className="w-5 h-5"/></div>
              <span className="text-2xl font-black text-sky-600 dark:text-sky-400 relative z-10 en-num">{stats.paidLeave}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mt-1 relative z-10">إجازة (براتب)</span>
            </div>
            <div className="bg-white dark:bg-[#121214] p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-2xl flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-amber-50 dark:bg-amber-500/5 group-hover:bg-amber-100 dark:group-hover:bg-amber-500/10 transition-colors pointer-events-none"></div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl mb-2 border border-amber-100 dark:border-amber-500/20 relative z-10"><Ban className="w-5 h-5"/></div>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 relative z-10 en-num">{stats.unpaidLeave}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider mt-1 relative z-10">إجازة (بدون راتب)</span>
            </div>
          </div>

          {/* 💡 أزرار التبويبات للتحكم بالمختفين (Tabs) 💡 */}
          <div className={`bg-white dark:bg-[#0a0a0c] p-2.5 rounded-[1.5rem] flex flex-col md:flex-row items-center w-full max-w-4xl mx-auto mb-8 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_20px_rgba(0,0,0,0.5)] gap-2.5 relative z-10 transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            
            <button 
              onClick={() => setViewTab('pending')} 
              className={`flex-1 w-full px-5 py-4 min-w-max text-[13px] font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 outline-none group 
                ${viewTab === 'pending' 
                  ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md dark:shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-400/50 scale-[1.02] ring-2 ring-indigo-500/20' 
                  : 'bg-slate-50 dark:bg-indigo-500/10 text-slate-500 dark:text-indigo-400/70 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-indigo-500/20 border border-slate-200 dark:border-indigo-500/20 shadow-inner'}`}
            >
              <Hourglass className={`w-4 h-4 transition-colors ${viewTab === 'pending' ? 'animate-pulse text-white' : 'text-slate-400 dark:text-indigo-400/70 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'}`} /> بانتظار التسجيل 
              <span className={`en-num tracking-widest ml-1 px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${viewTab === 'pending' ? 'bg-black/20 border-white/20 text-white shadow-inner' : 'bg-slate-200 dark:bg-indigo-900/40 border-slate-300 dark:border-indigo-500/30 text-slate-600 dark:text-indigo-300 group-hover:bg-slate-300 dark:group-hover:bg-indigo-900/60'}`}>
                {stats.pending}
              </span>
            </button>
            
            <button 
              onClick={() => setViewTab('recorded')} 
              className={`flex-1 w-full px-5 py-4 min-w-max text-[13px] font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 outline-none group 
                ${viewTab === 'recorded' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md dark:shadow-[0_0_20px_rgba(16,185,129,0.5)] border border-emerald-400/50 scale-[1.02] ring-2 ring-emerald-500/20' 
                  : 'bg-slate-50 dark:bg-emerald-500/10 text-slate-500 dark:text-emerald-400/70 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-emerald-500/20 border border-slate-200 dark:border-emerald-500/20 shadow-inner'}`}
            >
              <CheckCircle2 className={`w-4 h-4 transition-colors ${viewTab === 'recorded' ? 'text-white' : 'text-slate-400 dark:text-emerald-400/70 group-hover:text-emerald-500 dark:group-hover:text-emerald-400'}`} /> تم تسجيلهم 
              <span className={`en-num tracking-widest ml-1 px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${viewTab === 'recorded' ? 'bg-black/20 border-white/20 text-white shadow-inner' : 'bg-slate-200 dark:bg-emerald-900/40 border-slate-300 dark:border-emerald-500/30 text-slate-600 dark:text-emerald-300 group-hover:bg-slate-300 dark:group-hover:bg-emerald-900/60'}`}>
                {stats.total - stats.pending}
              </span>
            </button>
            
            <button 
              onClick={() => setViewTab('all')} 
              className={`flex-1 w-full px-5 py-4 min-w-max text-[13px] font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 outline-none group 
                ${viewTab === 'all' 
                  ? 'bg-gradient-to-r from-slate-600 to-slate-500 dark:from-slate-700 dark:to-slate-600 text-white shadow-md dark:shadow-[0_0_20px_rgba(255,255,255,0.15)] border border-slate-400 dark:border-slate-500/50 scale-[1.02] ring-2 ring-slate-500/20' 
                  : 'bg-slate-50 dark:bg-slate-500/10 text-slate-500 dark:text-slate-400/70 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-500/20 border border-slate-200 dark:border-slate-500/20 shadow-inner'}`}
            >
              <Users className={`w-4 h-4 transition-colors ${viewTab === 'all' ? 'text-white' : 'text-slate-400 dark:text-slate-400/70 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} /> عرض كل الكادر
              <span className={`en-num tracking-widest ml-1 px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${viewTab === 'all' ? 'bg-black/30 border-white/20 text-white shadow-inner' : 'bg-slate-200 dark:bg-slate-900/40 border-slate-300 dark:border-slate-500/30 text-slate-600 dark:text-slate-300 group-hover:bg-slate-300 dark:group-hover:bg-slate-900/60'}`}>
                {stats.total}
              </span>
            </button>

          </div>

          {/* البحث والفلترة */}
          <div className="bg-white dark:bg-[#121214] p-4 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-2xl mb-8 flex flex-col md:flex-row items-center gap-4 relative z-10">
            <div className="relative w-full md:w-96 shrink-0 group/search">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within/search:text-indigo-500 dark:group-focus-within/search:text-indigo-400 transition-colors pointer-events-none" />
              <input 
                type="text" placeholder="ابحث عن موظف بالاسم..." 
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 text-[14px] transition-all shadow-inner outline-none"
              />
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block mx-2"></div>
            
            <div className="relative w-full md:w-auto group/select flex-1">
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/10 transition-all cursor-pointer shadow-inner appearance-none outline-none">
                <option value="" className="bg-white dark:bg-[#121214]">كل الفروع والمواقع</option>
                {uniqueBranches.map(b => <option key={b} value={b} className="bg-white dark:bg-[#121214]">{b}</option>)}
              </select>
              <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-focus-within/select:text-rose-500 dark:group-focus-within/select:text-rose-400 pointer-events-none transition-colors" />
            </div>
          </div>

          {/* 💡 شبكة كارتات الموظفين التفاعلية (Grid of Cards) 💡 */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 relative z-10"><Loader2 className="w-12 h-12 text-rose-500 animate-spin mb-4" /><p className="text-slate-500 dark:text-slate-400 font-bold">جاري تحميل سجلات اليوم...</p></div>
          ) : displayStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-[#121214] rounded-[2.5rem] border border-slate-200 dark:border-white/10 border-dashed shadow-sm dark:shadow-2xl relative z-10">
              {viewTab === 'pending' ? (
                <>
                  <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center rounded-full mb-6 border border-emerald-200 dark:border-emerald-500/20 shadow-inner"><CheckCircle2 className="w-12 h-12"/></div>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">تم الانتهاء!</p>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">تم ترحيل سجلات جميع الموظفين لهذا اليوم بنجاح.</p>
                </>
              ) : (
                <>
                  <Search className="w-16 h-16 text-slate-400 dark:text-slate-600 mb-4 opacity-50"/>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">لا يوجد موظفين في هذه القائمة</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 relative z-10">
              {displayStaff.map((emp) => {
                const record = records[emp.id];
                const status = record?.status;
                const isSaving = syncStatus[emp.id] === 'saving';
                const isSaved = syncStatus[emp.id] === 'saved';

                return (
                  <div key={emp.id} className="bg-white dark:bg-[#121214] rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-2xl overflow-hidden flex flex-col relative group transition-all hover:border-slate-300 dark:hover:border-white/20 hover:shadow-md dark:hover:bg-[#151518]">
                    
                    {/* 💡 مؤشر الترحيل (Sync Indicator) */}
                    <div className="absolute top-4 left-4 z-20">
                      {isSaving && <div className="bg-white dark:bg-[#0a0a0c] p-2 rounded-full shadow-lg border border-slate-200 dark:border-white/10"><Loader2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400 animate-spin" /></div>}
                      {isSaved && <div className="bg-emerald-500 p-2 rounded-full shadow-lg border border-emerald-400 text-white animate-in zoom-in duration-300"><CheckCircle2 className="w-4 h-4" /></div>}
                    </div>

                    {/* 💡 هيدر الكارت (معلومات الموظف) */}
                    <div className="p-5 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-4 relative">
                      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${emp.avatar_color || 'from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-800'} opacity-10 rounded-bl-[100px] pointer-events-none`}></div>
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${emp.avatar_color || 'from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-800'} text-white flex items-center justify-center font-black text-lg shrink-0 shadow-inner border border-white/20 dark:border-white/10 relative z-10`}>
                        {getInitials(emp.full_name)}
                      </div>
                      <div className="relative z-10 pr-1 max-w-[calc(100%-80px)]">
                        <h3 className="text-[16px] font-black text-slate-900 dark:text-white truncate" title={emp.full_name}>{emp.full_name}</h3>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 truncate"><Briefcase className="w-3 h-3 shrink-0"/> {emp.role}</p>
                        <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">{emp.branch}</p>
                      </div>
                    </div>

                    {/* 💡 أزرار الحالة التفاعلية المتطورة الملونة دائماً 💡 */}
                    <div className="p-4 grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleStatusChange(emp.id, 'حاضر')}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border outline-none 
                          ${status === 'حاضر' 
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/20 dark:border-emerald-500/40 shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30' 
                            : 'bg-slate-50 dark:bg-emerald-500/5 border-slate-200 dark:border-emerald-500/10 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-200 dark:hover:border-emerald-500/20 shadow-inner'}`}
                      >
                        <div className={`p-2 rounded-full transition-all ${status === 'حاضر' ? 'bg-emerald-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400' : 'bg-white dark:bg-[#0a0a0c] text-slate-400 dark:text-emerald-500/60 border border-slate-200 dark:border-emerald-500/20 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 shadow-inner'}`}><UserCheck className="w-4 h-4" /></div>
                        <span className={`text-[11px] font-black ${status === 'حاضر' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-emerald-500/60 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'}`}>حاضر / مداوم</span>
                      </button>

                      <button 
                        onClick={() => handleStatusChange(emp.id, 'غائب')}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border outline-none 
                          ${status === 'غائب' 
                            ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/20 dark:border-rose-500/40 shadow-sm dark:shadow-[0_0_15px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/30' 
                            : 'bg-slate-50 dark:bg-rose-500/5 border-slate-200 dark:border-rose-500/10 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-200 dark:hover:border-rose-500/20 shadow-inner'}`}
                      >
                        <div className={`p-2 rounded-full transition-all ${status === 'غائب' ? 'bg-rose-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(244,63,94,0.5)] border border-rose-400' : 'bg-white dark:bg-[#0a0a0c] text-slate-400 dark:text-rose-500/60 border border-slate-200 dark:border-rose-500/20 group-hover:text-rose-500 dark:group-hover:text-rose-400 shadow-inner'}`}><UserX className="w-4 h-4" /></div>
                        <span className={`text-[11px] font-black ${status === 'غائب' ? 'text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-rose-500/60 group-hover:text-rose-600 dark:group-hover:text-rose-400'}`}>غائب (بدون عذر)</span>
                      </button>

                      <button 
                        onClick={() => handleStatusChange(emp.id, 'إجازة براتب')}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border outline-none 
                          ${status === 'إجازة براتب' 
                            ? 'bg-sky-50 border-sky-200 dark:bg-sky-500/20 dark:border-sky-500/40 shadow-sm dark:shadow-[0_0_15px_rgba(14,165,233,0.15)] ring-1 ring-sky-500/30' 
                            : 'bg-slate-50 dark:bg-sky-500/5 border-slate-200 dark:border-sky-500/10 hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:border-sky-200 dark:hover:border-sky-500/20 shadow-inner'}`}
                      >
                        <div className={`p-2 rounded-full transition-all ${status === 'إجازة براتب' ? 'bg-sky-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(14,165,233,0.5)] border border-sky-400' : 'bg-white dark:bg-[#0a0a0c] text-slate-400 dark:text-sky-500/60 border border-slate-200 dark:border-sky-500/20 group-hover:text-sky-500 dark:group-hover:text-sky-400 shadow-inner'}`}><DollarSign className="w-4 h-4" /></div>
                        <span className={`text-[11px] font-black ${status === 'إجازة براتب' ? 'text-sky-700 dark:text-sky-400' : 'text-slate-500 dark:text-sky-500/60 group-hover:text-sky-600 dark:group-hover:text-sky-400'}`}>إجازة (براتب)</span>
                      </button>

                      <button 
                        onClick={() => handleStatusChange(emp.id, 'إجازة بدون راتب')}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border outline-none 
                          ${status === 'إجازة بدون راتب' 
                            ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/20 dark:border-amber-500/40 shadow-sm dark:shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30' 
                            : 'bg-slate-50 dark:bg-amber-500/5 border-slate-200 dark:border-amber-500/10 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-200 dark:hover:border-amber-500/20 shadow-inner'}`}
                      >
                        <div className={`p-2 rounded-full transition-all ${status === 'إجازة بدون راتب' ? 'bg-amber-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-400' : 'bg-white dark:bg-[#0a0a0c] text-slate-400 dark:text-amber-500/60 border border-slate-200 dark:border-amber-500/20 group-hover:text-amber-500 dark:group-hover:text-amber-400 shadow-inner'}`}><Ban className="w-4 h-4" /></div>
                        <span className={`text-[11px] font-black ${status === 'إجازة بدون راتب' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-amber-500/60 group-hover:text-amber-600 dark:group-hover:text-amber-400'}`}>إجازة (بدون راتب)</span>
                      </button>
                    </div>

                    {/* 💡 الإضافات الإدارية (خصم + ملاحظة) */}
                    <div className="p-4 pt-2 mt-auto border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c]/50">
                      <div className="flex gap-2">
                        {/* حقل الخصم */}
                        <div className="relative w-24 shrink-0 group/input">
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-rose-500 uppercase pointer-events-none group-focus-within/input:text-rose-400 transition-colors">خصم</span>
                          <input 
                            type="number" 
                            defaultValue={record?.deduction === 0 ? '' : record?.deduction}
                            placeholder="0"
                            onBlur={(e) => handleDeductionBlur(emp.id, Number(e.target.value))}
                            className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-rose-500 dark:text-rose-400 font-black text-[13px] pl-2 pr-10 py-3 rounded-xl focus:outline-none focus:border-rose-500/50 dir-ltr text-left shadow-sm dark:shadow-inner transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-700" 
                          />
                        </div>
                        {/* حقل الملاحظة */}
                        <div className="relative flex-1 group/input2">
                          <input 
                            type="text" 
                            defaultValue={record?.notes || ''}
                            placeholder="أضف ملاحظة..."
                            onBlur={(e) => handleNotesBlur(emp.id, e.target.value)}
                            className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-300 font-bold text-[12px] px-3 py-3 rounded-xl focus:outline-none focus:border-indigo-500/50 shadow-sm dark:shadow-inner transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600" 
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* 💡 زر الخروج من وضع التركيز (يظهر فقط عند التفعيل) 💡 */}
        {isZenMode && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-bottom-10 fade-in duration-500">
            <button 
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-6 py-3.5 rounded-full font-black text-sm shadow-xl dark:shadow-[0_10px_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all outline-none"
            >
              <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

        {/* ======================================================= */}
        {/* 🟢 التقويم المؤسساتي الشامل المبرمج (أيام، أشهر، سنوات) 🟢 */}
        {/* ======================================================= */}
        {datePickerConfig.isOpen && !isZenMode && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] shadow-2xl dark:shadow-[0_0_50px_rgba(244,63,94,0.15)] animate-in zoom-in-95 duration-300">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-white/5 pb-5">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-rose-500 dark:text-rose-400 transition-colors outline-none">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black transition-colors outline-none ${datePickerConfig.mode === 'month' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white hover:text-rose-500 dark:hover:text-rose-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num transition-colors outline-none ${datePickerConfig.mode === 'year' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white hover:text-rose-500 dark:hover:text-rose-300'}`}
                   >
                     {datePickerConfig.viewDate.format('YYYY')}
                   </button>
                </div>

                <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-rose-500 dark:text-rose-400 transition-colors outline-none">
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
                        onClick={() => setDatePickerConfig(p => ({...p, viewDate: p.viewDate.year(year), mode: 'month'}))}
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none ${isSelected ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
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
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 flex flex-col items-center gap-1.5 outline-none ${isSelected ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
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
                      <div key={d} className="text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: datePickerConfig.viewDate.startOf('month').day() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: datePickerConfig.viewDate.daysInMonth() }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = datePickerConfig.viewDate.date(dayNum).format('YYYY-MM-DD');
                      
                      const isSelected = dateStr === selectedDate;
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDateSelection(dateStr)}
                          className={`
                            aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num transition-all active:scale-95 outline-none
                            ${isSelected ? 'bg-rose-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(244,63,94,0.4)]' :
                              isToday ? 'text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10' :
                              'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-transparent'}
                          `}
                        >
                          {dayNum}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <button onClick={() => setDatePickerConfig(p => ({...p, isOpen: false}))} className="w-full mt-6 py-4 bg-slate-50 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-2xl font-black text-[15px] transition-colors border border-slate-200 dark:border-white/5 outline-none">
                إلغاء
              </button>
            </div>
          </div>
        )}

        <style dangerouslySetInnerHTML={{__html: `
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
        `}} />
      </div>
    </div>
  );
}