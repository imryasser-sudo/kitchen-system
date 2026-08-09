"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Wallet, TrendingUp, TrendingDown, Banknote, Search, 
  Plus, CalendarDays, Clock, FileText, X, CheckCircle2, 
  Trash2, AlertCircle, Loader2, Calculator, User, Tag, AlignLeft, Sparkles, ChevronDown, LayoutGrid, ChevronLeft, ChevronRight, Eye, EyeOff, FileSpreadsheet
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import ExcelJS from 'exceljs'; 

dayjs.locale('ar');

interface Employee { id: string; full_name: string; salary: number; avatar_color: string; }
interface AdjustmentRecord { id: string; employee_id: string; record_date: string; adjustment_type: 'إضافي' | 'خصم' | 'سلفة'; category: string; amount: number; notes: string; staff?: { full_name: string; avatar_color: string }; }

const CATEGORIES = {
  'إضافي': ['ساعات عمل إضافية (Overtime)', 'أيام عمل إضافية', 'مكافأة أداء وتفوق (Bonus)', 'بدل نقل / خط (Transportation)', 'بدل طعام / إعاشة', 'حافز مبيعات / تارجت', 'عيدية / مناسبات', 'تعويضات أخرى'],
  'خصم': ['تأخير عن الدوام (ساعات)', 'غياب بدون عذر (أيام)', 'استقطاع إجازة مرضية (تجاوز الحد)', 'استقطاع إجازة بدون راتب', 'عقوبة إدارية (إنذار / غرامة)', 'إتلاف أو فقدان مواد/معدات', 'استقطاع تأمين / ضمان', 'أخرى'],
  'سلفة': ['سلفة نقدية طارئة', 'سلفة زواج / مناسبة', 'قسط سلفة مستمرة', 'أخرى']
};

const forceEnglishNumbers = (val: string) => {
  if (!val) return '';
  return val.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^0-9.]/g, '');
};

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function PayrollAdjustmentsPage() {
  const pathname = usePathname();
  const [filterDate, setFilterDate] = useState(dayjs().format('YYYY-MM-DD'));
  
  const [isZenMode, setIsZenMode] = useState(false);

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, 
    target: 'filter' | 'form', 
    viewDate: dayjs.Dayjs, 
    mode: 'date' | 'month' | 'year'
  }>({
    isOpen: false,
    target: 'form',
    viewDate: dayjs(),
    mode: 'date'
  });

  const [staff, setStaff] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AdjustmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'إضافي' | 'خصم' | 'سلفة'>('إضافي');
  
  const [formData, setFormData] = useState({ employee_id: '', category: '', amount: '', notes: '', record_date: dayjs().format('YYYY-MM-DD'), autoCalcValue: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: staffData } = await supabase.from('staff').select('id, full_name, salary, avatar_color').neq('status', 'منهى خدماته');
      setStaff((staffData || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ar')));

      const startOfMonth = dayjs(filterDate).startOf('month').format('YYYY-MM-DD');
      const endOfMonth = dayjs(filterDate).endOf('month').format('YYYY-MM-DD');

      const { data: recordsData } = await supabase.from('payroll_adjustments').select('*, staff(full_name, avatar_color)').gte('record_date', startOfMonth).lte('record_date', endOfMonth).order('created_at', { ascending: false });
      setRecords(recordsData || []);
    } catch (err) { console.error("Error fetching data:", err); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, [filterDate]);

  const filteredRecords = records.filter(r => r.staff?.full_name.includes(searchQuery) || r.category.includes(searchQuery) || r.notes?.includes(searchQuery));

  const stats = useMemo(() => {
    let bonus = 0; let deduction = 0; let advance = 0;
    filteredRecords.forEach(r => {
      if (r.adjustment_type === 'إضافي') bonus += Number(r.amount);
      if (r.adjustment_type === 'خصم') deduction += Number(r.amount);
      if (r.adjustment_type === 'سلفة') advance += Number(r.amount);
    });
    return { bonus, deduction, advance };
  }, [filteredRecords]);

  useEffect(() => {
    if (!formData.employee_id || !formData.autoCalcValue) return;
    const emp = staff.find(s => s.id === formData.employee_id);
    if (!emp || !emp.salary) return;

    const val = Number(formData.autoCalcValue);
    let calculatedAmount = 0;

    if (formData.category.includes('ساعات عمل إضافية')) calculatedAmount = (emp.salary / 30 / 8) * val * 1.5;
    else if (formData.category.includes('تأخير') || formData.category.includes('ساعات')) calculatedAmount = (emp.salary / 30 / 8) * val;
    else if (formData.category.includes('أيام') || formData.category.includes('غياب') || formData.category.includes('إجازة')) calculatedAmount = (emp.salary / 30) * val;

    if (calculatedAmount > 0) setFormData(prev => ({ ...prev, amount: Math.round(calculatedAmount).toString() }));
  }, [formData.autoCalcValue, formData.category, formData.employee_id, staff]);

  const handleOpenModal = (type: 'إضافي' | 'خصم' | 'سلفة') => {
    if (isZenMode) return; 
    setModalType(type);
    setFormData({ employee_id: '', category: CATEGORIES[type][0], amount: '', notes: '', record_date: filterDate, autoCalcValue: '' });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.employee_id || !formData.category || !formData.amount) return alert('يرجى تعبئة الحقول الأساسية');
    setIsSaving(true);
    try {
      const { error } = await supabase.from('payroll_adjustments').insert([{
        employee_id: formData.employee_id, record_date: formData.record_date, adjustment_type: modalType, category: formData.category, amount: Number(formData.amount), notes: formData.notes
      }]);
      if (error) throw error;
      setIsModalOpen(false);
      fetchData(); 
    } catch (err: any) { alert('حدث خطأ أثناء الحفظ.'); } finally { setIsSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      const { error } = await supabase.from('payroll_adjustments').delete().eq('id', id);
      if (error) throw error;
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) { alert('حدث خطأ أثناء الحذف'); }
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2) : '?';

  const theme = {
    'إضافي': { iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 border dark:border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', ring: 'focus:ring-emerald-500/20', border: 'focus:border-emerald-400 dark:focus:border-emerald-500/50', btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/30', inputBg: 'bg-white dark:bg-[#121214]', glow: 'shadow-[0_0_30px_rgba(16,185,129,0.15)]' },
    'خصم': { iconBg: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 border dark:border-rose-500/30', text: 'text-rose-600 dark:text-rose-400', ring: 'focus:ring-rose-500/20', border: 'focus:border-rose-400 dark:focus:border-rose-500/50', btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/30', inputBg: 'bg-white dark:bg-[#121214]', glow: 'shadow-[0_0_30px_rgba(244,63,94,0.15)]' },
    'سلفة': { iconBg: 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/20 dark:text-sky-400 border dark:border-sky-500/30', text: 'text-sky-600 dark:text-sky-400', ring: 'focus:ring-sky-500/20', border: 'focus:border-sky-400 dark:focus:border-sky-500/50', btn: 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/30', inputBg: 'bg-white dark:bg-[#121214]', glow: 'shadow-[0_0_30px_rgba(14,165,233,0.15)]' }
  }[modalType];

  const handlePrevCalendar = () => {
    setDatePickerConfig(p => ({
      ...p,
      viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')
    }));
  };

  const handleNextCalendar = () => {
    setDatePickerConfig(p => ({
      ...p,
      viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')
    }));
  };

  const handleExportExcel = async () => {
    if (filteredRecords.length === 0) return alert("لا توجد بيانات لتصديرها.");

    const monthName = dayjs(filterDate).format('MMMM YYYY');
    const exportTime = dayjs().format('YYYY-MM-DD | hh:mm A');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'نظام المطبخ المركزي';
    const worksheet = workbook.addWorksheet('سجل الحركات المالية', { views: [{ rightToLeft: true }] });

    worksheet.columns = [
      { key: 'index', width: 8 }, { key: 'date', width: 18 }, { key: 'name', width: 35 },
      { key: 'type', width: 20 }, { key: 'category', width: 40 }, { key: 'amount', width: 22 }, { key: 'notes', width: 55 },
    ];

    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `📊 التقرير المالي الشامل للموظفين - ${monthName}`;
    titleCell.font = { name: 'Segoe UI', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 55;

    worksheet.mergeCells('A2:G2');
    const subTitleCell = worksheet.getCell('A2');
    subTitleCell.value = `🕒 تاريخ ووقت التصدير: ${exportTime}  |  📁 إجمالي السجلات: ${filteredRecords.length}`;
    subTitleCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF475569' } };
    subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 30;

    worksheet.addRow([]); 

    worksheet.mergeCells('A4:B4'); worksheet.getCell('A4').value = '🟢 إجمالي الإضافيات (المكافآت)';
    worksheet.mergeCells('C4:D4'); worksheet.getCell('C4').value = '🔴 إجمالي الخصومات (الاستقطاعات)';
    worksheet.mergeCells('E4:G4'); worksheet.getCell('E4').value = '🏧 إجمالي السلف (المسحوبات)';
    
    ['A4', 'C4', 'E4'].forEach(cellRef => {
      const cell = worksheet.getCell(cellRef);
      cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FF334155' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
    worksheet.getRow(4).height = 30;

    worksheet.mergeCells('A5:B5'); worksheet.getCell('A5').value = stats.bonus;
    worksheet.mergeCells('C5:D5'); worksheet.getCell('C5').value = stats.deduction;
    worksheet.mergeCells('E5:G5'); worksheet.getCell('E5').value = stats.advance;

    worksheet.getCell('A5').font = { size: 18, bold: true, color: { argb: 'FF059669' } };
    worksheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
    worksheet.getCell('C5').font = { size: 18, bold: true, color: { argb: 'FFE11D48' } };
    worksheet.getCell('C5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
    worksheet.getCell('E5').font = { size: 18, bold: true, color: { argb: 'FF0284C7' } };
    worksheet.getCell('E5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };

    ['A5', 'C5', 'E5'].forEach(cellRef => {
      const cell = worksheet.getCell(cellRef);
      cell.numFmt = '#,##0 "د.ع"'; 
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    });
    worksheet.getRow(5).height = 40;

    worksheet.addRow([]);

    const headersRow = worksheet.addRow(['#', '📅 التاريخ', '👤 اسم الموظف', '🏷️ النوع', '📋 التصنيف والسبب', '💰 المبلغ (د.ع)', '📝 التفاصيل / الملاحظات']);
    headersRow.height = 35;
    headersRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: {style:'medium', color:{argb:'FF334155'}}, bottom: {style:'medium', color:{argb:'FF334155'}} };
    });

    filteredRecords.forEach((record, index) => {
      const isBonus = record.adjustment_type === 'إضافي';
      const isDeduct = record.adjustment_type === 'خصم';
      
      const typeIcon = isBonus ? '↗️ إضافي' : isDeduct ? '📉 خصم' : '🏧 سلفة';
      const exportAmount = isDeduct ? -Math.abs(record.amount) : Math.abs(record.amount);
      const noteText = record.notes ? `📝 ${record.notes}` : '-';

      const row = worksheet.addRow([
        index + 1, record.record_date, record.staff?.full_name || 'غير معروف',
        typeIcon, record.category, exportAmount, noteText
      ]);

      row.height = 28;
      
      row.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (colNumber === 3 || colNumber === 5 || colNumber === 7) cell.alignment.horizontal = 'right';
        
        cell.border = { bottom: {style:'thin', color:{argb:'FFE2E8F0'}}, left: {style:'thin', color:{argb:'FFE2E8F0'}}, right: {style:'thin', color:{argb:'FFE2E8F0'}} };
        if (index % 2 !== 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

        if(colNumber === 6) {
          cell.numFmt = '#,##0';
          if (isBonus) { cell.font = { color: { argb: 'FF059669' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; }
          else if (isDeduct) { cell.font = { color: { argb: 'FFE11D48' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }; }
          else { cell.font = { color: { argb: 'FF0284C7' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } }; }
        }
        
        if(colNumber === 4) {
          if (isBonus) cell.font = { color: { argb: 'FF059669' }, bold: true };
          else if (isDeduct) cell.font = { color: { argb: 'FFE11D48' }, bold: true };
          else cell.font = { color: { argb: 'FF0284C7' }, bold: true };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `التقرير_المالي_الاحترافي_${monthName.replace(' ', '_')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`min-h-screen pb-20 w-full font-sans relative ${isZenMode ? 'bg-slate-100 text-slate-800 dark:bg-black dark:text-slate-300' : 'bg-slate-50 text-slate-900 dark:bg-[#050505] dark:text-white'}`} dir="rtl">
      
      {/* الخلفية */}
      <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100/50 via-slate-50 to-slate-50 dark:from-emerald-900/10 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none ${isZenMode ? 'hidden' : 'block'}`}></div>

      {/* 🌟 الهيدر الثابت 🌟 */}
      <div className={`sticky top-0 z-[999] bg-slate-50/90 dark:bg-[#050505]/90 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/5 px-4 md:px-8 py-3 md:py-4 shadow-sm ${isZenMode ? 'hidden' : 'block'}`}>
        <div className="max-w-[100rem] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* العنوان والأيقونة */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link href="/hub" className="bg-white dark:bg-white/5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 shadow-sm outline-none">
              <LayoutGrid className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </Link>
            <div className="w-px h-8 bg-slate-300 dark:bg-white/10 hidden md:block"></div>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[17px] md:text-[19px] font-black text-slate-900 dark:text-white leading-tight">السلف والمكافآت</h2>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">سجل الحركات المالية المباشرة</p>
              </div>
            </div>
          </div>

          {/* الأزرار وتاريخ الفلتر */}
          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
            <button 
              onClick={handleExportExcel}
              title="تصدير السجلات إلى Excel"
              className="p-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 outline-none"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setIsZenMode(true)}
              title="وضع التركيز"
              className="p-2 bg-white hover:bg-slate-100 dark:bg-[#121214] dark:hover:bg-white/10 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-white/10 outline-none hidden md:block"
            >
              <Eye className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1 bg-white dark:bg-[#121214] p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm w-full md:w-auto">
              <button 
                onClick={() => setFilterDate(dayjs(filterDate).subtract(1, 'day').format('YYYY-MM-DD'))} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400 outline-none"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              <div 
                onClick={() => setDatePickerConfig({ isOpen: true, target: 'filter', viewDate: dayjs(filterDate), mode: 'date' })}
                className="flex-1 flex items-center justify-center gap-2 cursor-pointer px-3 min-w-[120px]"
              >
                <CalendarDays className="w-4 h-4 text-emerald-500" />
                <span className="font-bold text-[13px] en-num dir-ltr text-slate-800 dark:text-white">
                  {dayjs(filterDate).format('DD / MM / YYYY')}
                </span>
              </div>

              <button 
                onClick={() => setFilterDate(dayjs(filterDate).add(1, 'day').format('YYYY-MM-DD'))} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400 outline-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>

      <div className={`mx-auto w-full relative z-10 pb-8 mt-6 ${isZenMode ? 'p-2 max-w-[120rem]' : 'px-4 md:px-8 max-w-[100rem]'}`}>

        {/* 🌟 الإحصائيات والأزرار 🌟 */}
        <div className={`${isZenMode ? 'hidden' : 'block'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            <button onClick={() => handleOpenModal('إضافي')} className="relative overflow-hidden bg-gradient-to-l from-white to-emerald-50 dark:from-[#121214] dark:to-emerald-950/30 border border-slate-200 dark:border-emerald-500/20 hover:border-emerald-300 dark:hover:border-emerald-500/50 p-5 rounded-[2rem] shadow-sm hover:shadow-md dark:shadow-[0_8px_20px_rgba(16,185,129,0.05)] dark:hover:shadow-[0_8px_30px_rgba(16,185,129,0.2)] flex items-center gap-4 group active:scale-[0.98] outline-none">
              <div className="absolute left-0 top-0 w-1.5 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
              <div className="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 p-4 rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-transform"><TrendingUp className="w-6 h-6"/></div>
              <div className="text-right flex-1">
                <span className="block text-lg font-black mb-1 text-slate-800 dark:text-white drop-shadow-sm">تسجيل إضافي</span>
                <span className="text-emerald-600/70 dark:text-emerald-200/60 text-[11px] font-bold">ساعات، أيام، بونص، بدلات</span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20"><Plus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
            </button>
            
            <button onClick={() => handleOpenModal('خصم')} className="relative overflow-hidden bg-gradient-to-l from-white to-rose-50 dark:from-[#121214] dark:to-rose-950/30 border border-slate-200 dark:border-rose-500/20 hover:border-rose-300 dark:hover:border-rose-500/50 p-5 rounded-[2rem] shadow-sm hover:shadow-md dark:shadow-[0_8px_20px_rgba(244,63,94,0.05)] dark:hover:shadow-[0_8px_30px_rgba(244,63,94,0.2)] flex items-center gap-4 group active:scale-[0.98] outline-none">
              <div className="absolute left-0 top-0 w-1.5 h-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]"></div>
              <div className="bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 p-4 rounded-2xl group-hover:scale-110 group-hover:-rotate-3 transition-transform"><TrendingDown className="w-6 h-6"/></div>
              <div className="text-right flex-1">
                <span className="block text-lg font-black mb-1 text-slate-800 dark:text-white drop-shadow-sm">تسجيل خصم مالي</span>
                <span className="text-rose-600/70 dark:text-rose-200/60 text-[11px] font-bold">غياب، إجازات مخصومة، عقوبة</span>
              </div>
              <div className="bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-full border border-rose-200 dark:border-rose-500/20 group-hover:bg-rose-100 dark:group-hover:bg-rose-500/20"><Plus className="w-5 h-5 text-rose-600 dark:text-rose-400" /></div>
            </button>
            
            <button onClick={() => handleOpenModal('سلفة')} className="relative overflow-hidden bg-gradient-to-l from-white to-sky-50 dark:from-[#121214] dark:to-sky-950/30 border border-slate-200 dark:border-sky-500/20 hover:border-sky-300 dark:hover:border-sky-500/50 p-5 rounded-[2rem] shadow-sm hover:shadow-md dark:shadow-[0_8px_20px_rgba(14,165,233,0.05)] dark:hover:shadow-[0_8px_30px_rgba(14,165,233,0.2)] flex items-center gap-4 group active:scale-[0.98] outline-none">
              <div className="absolute left-0 top-0 w-1.5 h-full bg-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.5)]"></div>
              <div className="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30 p-4 rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-transform"><Banknote className="w-6 h-6"/></div>
              <div className="text-right flex-1">
                <span className="block text-lg font-black mb-1 text-slate-800 dark:text-white drop-shadow-sm">إصدار سلفة نقدية</span>
                <span className="text-sky-600/70 dark:text-sky-200/60 text-[11px] font-bold">سلف، قروض داخلية مستمرة</span>
              </div>
              <div className="bg-sky-50 dark:bg-sky-500/10 p-2.5 rounded-full border border-sky-200 dark:border-sky-500/20 group-hover:bg-sky-100 dark:group-hover:bg-sky-500/20"><Plus className="w-5 h-5 text-sky-600 dark:text-sky-400" /></div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-10">
            <div className="bg-white dark:bg-[#121214] p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 flex items-center justify-between shadow-sm dark:shadow-inner">
              <div><span className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">إجمالي الإضافيات</span><span className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 en-num dir-ltr block drop-shadow-sm dark:drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{stats.bonus.toLocaleString('en-US')} د.ع</span></div>
              <div className="w-14 h-14 rounded-[1.2rem] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400"><TrendingUp className="w-6 h-6"/></div>
            </div>
            <div className="bg-white dark:bg-[#121214] p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 flex items-center justify-between shadow-sm dark:shadow-inner">
              <div><span className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">إجمالي الخصومات</span><span className="text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400 en-num dir-ltr block drop-shadow-sm dark:drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]">{stats.deduction.toLocaleString('en-US')} د.ع</span></div>
              <div className="w-14 h-14 rounded-[1.2rem] bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400"><TrendingDown className="w-6 h-6"/></div>
            </div>
            <div className="bg-white dark:bg-[#121214] p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 flex items-center justify-between shadow-sm dark:shadow-inner">
              <div><span className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">إجمالي السلف</span><span className="text-2xl md:text-3xl font-black text-sky-600 dark:text-sky-400 en-num dir-ltr block drop-shadow-sm dark:drop-shadow-[0_0_10px_rgba(14,165,233,0.3)]">{stats.advance.toLocaleString('en-US')} د.ع</span></div>
              <div className="w-14 h-14 rounded-[1.2rem] bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400"><Banknote className="w-6 h-6"/></div>
            </div>
          </div>
        </div>

        <div className={`${isZenMode ? 'bg-slate-50 border border-slate-300 dark:bg-black dark:border-white/10 rounded-2xl shadow-none' : 'bg-white dark:bg-[#0a0a0c] rounded-[2rem] border border-slate-300 dark:border-white/10 shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]'} overflow-hidden flex flex-col`}>
          <div className={`p-5 md:p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-5 shrink-0 ${isZenMode ? 'bg-slate-100 border-slate-300 dark:bg-[#050505] dark:border-white/10' : 'bg-slate-50 dark:bg-[#121214] border-slate-300 dark:border-white/10'}`}>
            <h3 className={`text-xl font-black flex items-center gap-3 ${isZenMode ? 'text-slate-800 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
              <FileText className={`w-6 h-6 ${isZenMode ? 'text-slate-500' : 'text-indigo-500 dark:text-indigo-400'}`}/> 
              {isZenMode ? `تدقيق سجلات ${dayjs(filterDate).format('MMMM YYYY')}` : 'السجل المفصل للشهر'}
            </h3>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-80 group">
                <Search className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isZenMode ? 'text-slate-500 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400'}`} />
                <input type="text" placeholder="بحث بالاسم أو التصنيف..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`w-full text-[13px] font-bold px-4 pr-11 py-3 rounded-2xl focus:outline-none focus:ring-2 shadow-inner ${isZenMode ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:ring-slate-200 dark:bg-[#0a0a0c] dark:border-white/10 dark:text-slate-300 dark:placeholder-slate-700 dark:focus:border-slate-500/50 dark:focus:ring-slate-500/10' : 'bg-slate-100 border-slate-300 text-slate-900 placeholder-slate-500 focus:border-indigo-400 focus:ring-indigo-100 dark:bg-[#121214] dark:border-white/10 dark:text-white dark:focus:border-indigo-500/50 dark:focus:ring-indigo-500/10'}`} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32"><Loader2 className={`w-10 h-10 animate-spin mb-4 ${isZenMode ? 'text-slate-500' : 'text-indigo-500 dark:text-indigo-400'}`} /><p className="text-slate-500 dark:text-slate-400 font-bold">جاري تحميل السجلات...</p></div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32"><Search className="w-14 h-14 text-slate-400 dark:text-slate-600 mb-4"/><p className="text-slate-500 dark:text-slate-400 font-bold text-lg">لا توجد حركات مالية في هذا الشهر</p></div>
            ) : (
              <table className="w-full text-right border-collapse min-w-[1000px]">
                <thead className={`font-black text-[12px] uppercase tracking-widest shadow-sm ${isZenMode ? 'bg-slate-200 text-slate-600 dark:bg-[#0a0a0c] dark:text-slate-500' : 'bg-slate-100 text-slate-700 dark:bg-[#121214] dark:text-slate-300'}`}>
                  <tr>
                    <th className="py-3 px-5 text-right border border-slate-300 dark:border-white/10">التاريخ</th>
                    <th className="py-3 px-4 text-right border border-slate-300 dark:border-white/10">الموظف</th>
                    <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10">النوع</th>
                    <th className="py-3 px-4 text-right border border-slate-300 dark:border-white/10">التصنيف والسبب</th>
                    <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10">المبلغ (د.ع)</th>
                    <th className="py-3 px-4 text-right border border-slate-300 dark:border-white/10">التفاصيل / ملاحظات</th>
                    {!isZenMode && <th className="py-3 px-5 text-center border border-slate-300 dark:border-white/10">إجراء</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, index) => (
                    <tr key={record.id} className={`group/row ${isZenMode ? 'bg-white even:bg-slate-50 hover:bg-slate-100 dark:bg-black dark:even:bg-[#0a0a0c] dark:hover:bg-white/5' : 'bg-white even:bg-slate-50/80 hover:bg-indigo-50/50 dark:bg-[#0a0a0c] dark:even:bg-[#121214] dark:hover:bg-white/5'}`}>
                      <td className={`py-3 px-5 text-right border border-slate-300 dark:border-white/10 ${isZenMode ? 'text-slate-600 dark:text-slate-500' : 'text-slate-700 dark:text-slate-400'}`}>
                        <span className="font-bold text-[14px] en-num dir-ltr">{record.record_date}</span>
                      </td>
                      <td className="py-3 px-4 border border-slate-300 dark:border-white/10">
                        <div className="flex items-center gap-3">
                          {!isZenMode && (
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${record.staff?.avatar_color || 'from-slate-700 to-slate-800'} text-white flex items-center justify-center font-black text-[10px] shrink-0 shadow-inner border border-white/20 dark:border-white/10`}>
                              {getInitials(record.staff?.full_name || '')}
                            </div>
                          )}
                          <span className={`font-black text-[14px] ${isZenMode ? 'text-slate-800 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>{record.staff?.full_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center border border-slate-300 dark:border-white/10">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                          isZenMode 
                          ? 'bg-transparent text-slate-500 border-slate-300 dark:text-slate-400 dark:border-white/10' 
                          : record.adjustment_type === 'إضافي' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                            record.adjustment_type === 'خصم' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' :
                            'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20'
                        }`}>{record.adjustment_type}</span>
                      </td>
                      <td className={`py-3 px-4 font-bold text-[13px] border border-slate-300 dark:border-white/10 ${isZenMode ? 'text-slate-600 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{record.category}</td>
                      
                      <td className="py-3 px-4 text-center border border-slate-300 dark:border-white/10">
                        <span className={`font-black text-[15px] en-num dir-ltr ${
                          isZenMode ? (record.adjustment_type === 'خصم' ? 'text-slate-600 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200') :
                          record.adjustment_type === 'إضافي' ? 'text-emerald-600 dark:text-emerald-400' :
                          record.adjustment_type === 'خصم' ? 'text-rose-600 dark:text-rose-400' :
                          'text-sky-600 dark:text-sky-400'
                        }`}>
                          {record.adjustment_type === 'خصم' ? '-' : record.adjustment_type === 'إضافي' ? '+' : ''}{record.amount.toLocaleString('en-US')}
                        </span>
                      </td>

                      <td className={`py-3 px-4 font-bold text-[12px] max-w-[200px] truncate border border-slate-300 dark:border-white/10 ${isZenMode ? 'text-slate-500 dark:text-slate-600' : 'text-slate-500 dark:text-slate-500'}`} title={record.notes}>{record.notes || '-'}</td>
                      
                      {!isZenMode && (
                        <td className="py-3 px-5 text-center border border-slate-300 dark:border-white/10">
                          <button onClick={() => handleDelete(record.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:text-slate-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 rounded-lg opacity-0 group-hover/row:opacity-100 outline-none"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {isZenMode && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-bottom-10 fade-in duration-500">
            <button 
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-2 bg-slate-800 text-white dark:bg-white dark:text-black px-6 py-3.5 rounded-full font-black text-sm shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 outline-none"
            >
              <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

        {isModalOpen && !isZenMode && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 py-10 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xl animate-in fade-in duration-300">
            <div className={`bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 w-full max-w-[500px] rounded-[2.5rem] relative flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] ${theme.glow}`}>
              
              <div className="p-6 md:p-8 pb-4 flex items-start justify-between shrink-0 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className={`p-3.5 rounded-2xl shadow-inner ${theme.iconBg}`}>
                    {modalType === 'إضافي' ? <TrendingUp className="w-6 h-6"/> : modalType === 'خصم' ? <TrendingDown className="w-6 h-6"/> : <Banknote className="w-6 h-6"/>}
                  </div>
                  <div>
                    <h3 className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight">تسجيل {modalType}</h3>
                    <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-1">إدخال البيانات والتفاصيل بدقة</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2.5 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-full border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none outline-none"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 md:p-8 pt-6 space-y-6 flex-1 overflow-y-auto custom-island-scroll">
                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block pl-1">اختر الموظف</label>
                    <div className="relative group/select">
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within/select:text-slate-700 dark:group-focus-within/select:text-white pointer-events-none"><User className="w-5 h-5" /></div>
                      <select 
                        value={formData.employee_id} 
                        onChange={(e) => setFormData({...formData, employee_id: e.target.value, amount: '', autoCalcValue: ''})}
                        className={`w-full border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:ring-4 shadow-inner appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 ${theme.inputBg} ${theme.ring} ${theme.border}`}
                      >
                        <option value="" disabled className="bg-white dark:bg-[#121214]">-- اضغط لاختيار الموظف --</option>
                        {staff.map(emp => (
                          <option key={emp.id} value={emp.id} className="bg-white dark:bg-[#121214]">
                            {emp.full_name} {emp.salary ? `(الراتب: ${emp.salary.toLocaleString('en-US')} د.ع)` : ''}
                          </option>
                        ))}
                      </select>
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"><ChevronDown className="w-4 h-4" /></div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block pl-1">التصنيف أو السبب</label>
                    <div className="relative group/select">
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within/select:text-slate-700 dark:group-focus-within/select:text-white pointer-events-none"><Tag className="w-5 h-5" /></div>
                      <select 
                        value={formData.category} 
                        onChange={(e) => setFormData({...formData, category: e.target.value, autoCalcValue: ''})}
                        className={`w-full border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:ring-4 shadow-inner appearance-none cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 ${theme.inputBg} ${theme.ring} ${theme.border}`}
                      >
                        {CATEGORIES[modalType].map(c => <option key={c} value={c} className="bg-white dark:bg-[#121214]">{c}</option>)}
                      </select>
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"><ChevronDown className="w-4 h-4" /></div>
                    </div>
                  </div>

                  {(formData.category.includes('ساعات') || formData.category.includes('أيام') || formData.category.includes('تأخير') || formData.category.includes('غياب') || formData.category.includes('إجازة')) && (
                    <div className="bg-slate-50 dark:bg-[#121214] border-2 border-dashed border-slate-300 dark:border-white/10 p-5 rounded-[1.5rem] relative hover:border-slate-400 dark:hover:border-white/20">
                      <div className="flex justify-between items-center mb-4">
                        <label className="text-[12px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/> الحساب التلقائي <span className="text-[10px] text-slate-500 font-bold">(اختياري)</span>
                        </label>
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest border ${theme.iconBg}`}>حاسبة ذكية</span>
                      </div>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        placeholder={formData.category.includes('ساعات') || formData.category.includes('تأخير') ? 'أدخل عدد الساعات هنا...' : 'أدخل عدد الأيام هنا...'}
                        value={formData.autoCalcValue}
                        onChange={e => setFormData({...formData, autoCalcValue: forceEnglishNumbers(e.target.value)})}
                        style={{ fontFamily: 'Arial, sans-serif' }}
                        className={`w-full bg-white dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-black text-sm px-4 py-3.5 rounded-[1.2rem] focus:outline-none focus:ring-4 text-center shadow-inner en-num dir-ltr ${theme.ring} ${theme.border}`} 
                      />
                    </div>
                  )}

                  <div className="pt-2 pb-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 block text-center">المبلغ النهائي المعتمد</label>
                    <div className="relative max-w-[280px] mx-auto">
                      <span className={`absolute left-5 top-1/2 -translate-y-1/2 font-black text-[15px] ${theme.text}`}>د.ع</span>
                      <input 
                        type="text"
                        inputMode="numeric"
                        value={formData.amount}
                        onChange={e => setFormData({...formData, amount: forceEnglishNumbers(e.target.value)})}
                        placeholder="0"
                        style={{ fontFamily: 'Arial, sans-serif' }}
                        className={`w-full bg-slate-100 dark:bg-[#121214] border-2 border-slate-300 dark:border-white/10 text-slate-900 dark:text-white font-black text-2xl md:text-3xl px-4 pl-16 py-4 rounded-[1.5rem] focus:outline-none focus:ring-4 text-center shadow-inner placeholder-slate-400 dark:placeholder-slate-700 en-num dir-ltr ${theme.ring} ${theme.border}`} 
                      />
                    </div>
                    {formData.autoCalcValue && <p className={`text-[10px] font-bold text-center mt-3 flex items-center justify-center gap-1.5 ${theme.text}`}><Sparkles className="w-3.5 h-3.5"/> تم الحساب بناءً على الراتب الأساسي للموظف</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block pl-1">تاريخ الاستحقاق</label>
                      <div 
                        onClick={() => setDatePickerConfig({ isOpen: true, target: 'form', viewDate: dayjs(formData.record_date), mode: 'date' })}
                        className="relative overflow-hidden rounded-2xl bg-slate-50 dark:bg-[#121214] border border-slate-300 dark:border-white/10 shadow-inner hover:border-emerald-400 dark:hover:border-emerald-500/50 cursor-pointer group"
                      >
                        <div className="px-4 py-3 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[13px] font-black text-emerald-600 dark:text-emerald-400 mb-1 drop-shadow-sm dark:drop-shadow-md">
                            {dayjs(formData.record_date).format('dddd')}
                          </span>
                          <span className="font-black text-[16px] text-slate-800 dark:text-white tracking-widest en-num dir-ltr">
                            {dayjs(formData.record_date).format('DD / MM / YYYY')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block pl-1">ملاحظات (اختياري)</label>
                      <div className="relative group/note">
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within/note:text-slate-700 dark:group-focus-within/note:text-white pointer-events-none"><AlignLeft className="w-5 h-5" /></div>
                        <input 
                          type="text"
                          value={formData.notes}
                          onChange={e => setFormData({...formData, notes: e.target.value})}
                          placeholder="تفاصيل إضافية..."
                          className={`w-full border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:ring-4 shadow-inner hover:bg-slate-100 dark:hover:bg-white/5 ${theme.inputBg} ${theme.ring} ${theme.border}`} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 pt-5 bg-slate-50 dark:bg-white/5 shrink-0 border-t border-slate-200 dark:border-white/5 backdrop-blur-md">
                <button onClick={handleSave} disabled={isSaving} className={`w-full py-4 rounded-[1.2rem] font-black text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:scale-100 outline-none ${theme.btn}`}>
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} تأكيد وحفظ الـ {modalType}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* 🌟 التقويم المصغر 🌟 */}
        {datePickerConfig.isOpen && !isZenMode && (
          <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-slate-900/50 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] shadow-xl dark:shadow-[0_0_50px_rgba(16,185,129,0.15)] animate-in zoom-in-95 duration-300">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/5 pb-5">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-transparent outline-none">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black outline-none ${datePickerConfig.mode === 'month' ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-md' : 'text-slate-800 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num outline-none ${datePickerConfig.mode === 'year' ? 'text-emerald-600 dark:text-emerald-400 drop-shadow-md' : 'text-slate-800 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-300'}`}
                   >
                     {datePickerConfig.viewDate.format('YYYY')}
                   </button>
                </div>

                <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-transparent outline-none">
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
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num active:scale-95 outline-none ${isSelected ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-white/5'}`}
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
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] active:scale-95 flex flex-col items-center gap-1.5 outline-none ${isSelected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-white/5'}`}
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
                      <div key={d} className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: datePickerConfig.viewDate.startOf('month').day() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: datePickerConfig.viewDate.daysInMonth() }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = datePickerConfig.viewDate.date(dayNum).format('YYYY-MM-DD');
                      const isSelected = dateStr === (datePickerConfig.target === 'filter' ? filterDate : formData.record_date);
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dayNum}
                          onClick={() => {
                            if (datePickerConfig.target === 'filter') {
                              setFilterDate(dateStr);
                            } else {
                              setFormData(prev => ({...prev, record_date: dateStr}));
                            }
                            setDatePickerConfig(p => ({...p, isOpen: false}));
                          }}
                          className={`
                            aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num active:scale-95 outline-none
                            ${isSelected ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' :
                              isToday ? 'text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10' :
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

              <button onClick={() => setDatePickerConfig(p => ({...p, isOpen: false}))} className="w-full mt-6 py-4 bg-slate-50 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-2xl font-black text-[15px] border border-transparent outline-none">
                إلغاء
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}