"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  Wallet, Search, CalendarDays, ReceiptText, Printer, FileSpreadsheet, 
  ChevronRight, ChevronLeft, Loader2, Users, TrendingUp, TrendingDown, 
  Banknote, AlertCircle, ShieldCheck, LayoutGrid, Settings, Maximize, 
  MoveHorizontal, RefreshCw, BadgeCheck, Filter, Calendar, Store, 
  Layers, RotateCcw, ChevronDown, Package, Eye, EyeOff
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

dayjs.locale('ar');

interface Employee {
  id: string;
  full_name: string;
  role: string;
  branch: string;
  department: string;
  salary: number;
  avatar_color: string;
}

interface AttendanceRecord {
  employee_id: string;
  status: string;
  deduction: number;
  record_date: string;
}

interface AdjustmentRecord {
  employee_id: string;
  adjustment_type: 'إضافي' | 'خصم' | 'سلفة';
  amount: number;
}

const defaultPdfSettings = {
  paperSize: 'A3', 
  margin: '10mm',
  zoom: 85,
  shiftX: 0,
  autoFit: true
};

const getColLetter = (colIndex: number) => {
  let temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp - 1) / 26);
  }
  return letter;
};

type PickerTarget = 'startDate' | 'endDate' | 'selectMonth';
const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function PayrollPage() {
  const { isDark } = useTheme(); 
  const [isZenMode, setIsZenMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'detailed' | 'payroll'>('detailed');
  
  const [startDate, setStartDate] = useState<string>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().endOf('month').format('YYYY-MM-DD'));
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  
  const [staff, setStaff] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [branchFilter, setBranchFilter] = useState<string>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, target: PickerTarget, viewDate: dayjs.Dayjs, mode: 'date' | 'month' | 'year'
  }>({ isOpen: false, target: 'startDate', viewDate: dayjs(), mode: 'date' });

  const daysInMonth = dayjs(currentMonth).daysInMonth();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('payrollPdfSettings_v2');
    if (savedSettings) {
      try { setPdfSettings(JSON.parse(savedSettings)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('payrollPdfSettings_v2', JSON.stringify(pdfSettings));
    }
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => {
    setPdfSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetPdfSettings = () => {
    setPdfSettings(defaultPdfSettings);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [staffRes, attRes, adjRes] = await Promise.all([
        supabase.from('staff').select('id, full_name, role, branch, department, salary, avatar_color').neq('status', 'منهى خدماته'),
        supabase.from('attendance').select('employee_id, status, deduction, record_date').gte('record_date', startDate).lte('record_date', endDate),
        supabase.from('payroll_adjustments').select('employee_id, adjustment_type, amount').gte('record_date', startDate).lte('record_date', endDate)
      ]);

      if (staffRes.error) throw staffRes.error;
      
      setStaff((staffRes.data || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ar')));
      setAttendance(attRes.data || []);
      setAdjustments(adjRes.data || []);

    } catch (err) {
      console.error("Error fetching payroll data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const uniqueBranchesDropdown = useMemo(() => {
    const branches = new Set<string>();
    staff.forEach(s => { if (s.branch) branches.add(s.branch); });
    return Array.from(branches).sort();
  }, [staff]);

  const uniqueCategoriesList = useMemo(() => {
    const categories = new Set<string>();
    staff.forEach(s => { if (s.department) categories.add(s.department); });
    return Array.from(categories).sort();
  }, [staff]);

  const payrollData = useMemo(() => {
    return staff.filter(emp => {
      if (branchFilter !== 'الكل' && emp.branch !== branchFilter) return false;
      if (categoryFilter !== 'الكل' && emp.department !== categoryFilter) return false;
      if (searchQuery && !emp.full_name.includes(searchQuery) && !emp.role.includes(searchQuery) && !emp.branch.includes(searchQuery)) return false;
      return true;
    }).map(emp => {
      const empAtt = attendance.filter(a => a.employee_id === emp.id);
      const empAdj = adjustments.filter(a => a.employee_id === emp.id);

      let present = 0, absent = 0, paidLeave = 0, unpaidLeave = 0, halfDays = 0, attDeductions = 0;
      
      empAtt.forEach(a => {
        if (a.status === 'حاضر') present += 1;
        else if (a.status === 'نصف يوم') { present += 0.5; halfDays += 1; }
        else if (a.status === 'غائب') absent += 1;
        else if (a.status === 'إجازة براتب' || a.status === 'مجاز') paidLeave += 1;
        else if (a.status === 'إجازة بدون راتب') unpaidLeave += 1;

        if (a.deduction) attDeductions += Number(a.deduction);
      });

      const dailyRate = emp.salary / 30;
      
      const unpaidDays = absent + unpaidLeave + (halfDays * 0.5);
      const absenceDeductionAmount = Math.round(unpaidDays * dailyRate);

      const earnedSalary = Math.round(Math.max(0, emp.salary - absenceDeductionAmount));

      let bonus = 0, manualDeduction = 0, advance = 0;
      empAdj.forEach(a => {
        if (a.adjustment_type === 'إضافي') bonus += Number(a.amount);
        if (a.adjustment_type === 'خصم') manualDeduction += Number(a.amount);
        if (a.adjustment_type === 'سلفة') advance += Number(a.amount);
      });

      const financialDeductions = attDeductions + manualDeduction;
      const netSalary = Math.round(earnedSalary + bonus - financialDeductions - advance);

      return {
        ...emp,
        present, absent, paidLeave, unpaidLeave, halfDays, unpaidDays,
        absenceDeductionAmount, attDeductions, bonus, manualDeduction, advance,
        financialDeductions, earnedSalary, netSalary
      };
    });
  }, [staff, attendance, adjustments, searchQuery, branchFilter, categoryFilter]);

  const stats = useMemo(() => {
    let totalEarned = 0, totalNet = 0, totalDeductions = 0, totalAdvances = 0;
    payrollData.forEach(p => {
      totalEarned += p.earnedSalary;
      totalNet += p.netSalary;
      totalDeductions += p.financialDeductions;
      totalAdvances += p.advance;
    });
    return { totalEarned, totalNet, totalDeductions, totalAdvances };
  }, [payrollData]);

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2) : '?';

  const openDatePicker = (target: PickerTarget, defaultDate: string, defaultMode: 'date' | 'month' = 'date') => {
    setDatePickerConfig({ isOpen: true, target, viewDate: dayjs(defaultDate), mode: defaultMode });
  };

  const handleDateSelection = (dateStr: string) => {
    const t = datePickerConfig.target;
    if (t === 'startDate') {
      setStartDate(dateStr);
      setCurrentMonth(dayjs(dateStr).format('YYYY-MM'));
    }
    else if (t === 'endDate') setEndDate(dateStr);
    else if (t === 'selectMonth') {
      setStartDate(dayjs(dateStr).startOf('month').format('YYYY-MM-DD'));
      setEndDate(dayjs(dateStr).endOf('month').format('YYYY-MM-DD'));
      setCurrentMonth(dayjs(dateStr).format('YYYY-MM'));
    }
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const clearFilters = () => {
    setBranchFilter('الكل');
    setCategoryFilter('الكل');
    setSearchQuery('');
  };

  const handleExportExcel = async (type: 'attendance' | 'detailed' | 'payroll') => {
    if (payrollData.length === 0) return alert("لا توجد بيانات لتصديرها.");
    setIsExportingExcel(true);

    try {
      const isAtt = type === 'attendance';
      const isDetailed = type === 'detailed';
      
      const baseTitle = isAtt ? 'ملخص_دوام_الموظفين' : isDetailed ? 'السجل_اليومي_المركزي' : 'كشف_الرواتب_المالي';
      let exportName = `${baseTitle}_شهر_${dayjs(currentMonth).format('MM_YYYY')}`;
      
      if (branchFilter !== 'الكل') exportName += `_فرع_${branchFilter}`;
      if (categoryFilter !== 'الكل') exportName += `_قسم_${categoryFilter}`;
      exportName = exportName.replace(/\s+/g, '_') + '.xlsx';

      const displayTitle = isAtt ? `ملخص دوام وحضور الموظفين | شهر ${dayjs(currentMonth).format('MM-YYYY')}` : 
                           isDetailed ? `السجل الجداري المفصل للدوام | شهر ${dayjs(currentMonth).format('MM-YYYY')}` : 
                           `كشف الرواتب والتفاصيل المالية | شهر ${dayjs(currentMonth).format('MM-YYYY')}`;

      const themeColor = isDetailed ? 'FFD97706' : isAtt ? 'FF4F46E5' : 'FF059669';

      let totalCols = isDetailed ? daysInMonth + 3 : isAtt ? 8 : 12;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('كشف الرواتب', { views: [{ rightToLeft: true }] });

      worksheet.mergeCells(`A1:${getColLetter(totalCols)}2`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `🏢 ${displayTitle}`;
      titleCell.font = { name: 'Cairo', size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; 
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.border = { bottom: { style: 'thick', color: { argb: themeColor } }, top: { style: 'thick', color: { argb: 'FF000000' } }, left: { style: 'thick', color: { argb: 'FF000000' } }, right: { style: 'thick', color: { argb: 'FF000000' } } };

      worksheet.mergeCells(`A3:${getColLetter(totalCols)}3`);
      const metaCell = worksheet.getCell('A3');
      metaCell.value = `📅 تاريخ الإصدار: ${dayjs().format('YYYY-MM-DD')}  |  ⏰ الوقت: ${dayjs().format('hh:mm A')}  |  👤 العدد الكلي: ${payrollData.length} موظف`;
      metaCell.font = { name: 'Cairo', size: 11, color: { argb: 'FF475569' }, bold: true };
      metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(3).height = 25;

      worksheet.addRow([]); 

      const filterRow1 = worksheet.addRow(['📍 الفرع المحدد:', branchFilter, '📁 القسم المحدد:', categoryFilter]);
      worksheet.mergeCells('B5:C5');
      if (totalCols > 4) worksheet.mergeCells(`E5:${getColLetter(totalCols)}5`);

      filterRow1.eachCell((cell, colNum) => {
        if ([1, 2, 4, 5].includes(colNum)) {
          cell.font = { name: 'Cairo', bold: true, color: { argb: colNum===1 || colNum===4 ? 'FFFFFFFF' : 'FF0F172A' }, size: 12 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNum===1 || colNum===4 ? 'FF0284C7' : 'FFE0F2FE' } };
          cell.border = { top: { style: 'thin', color: {argb: 'FF475569'} }, bottom: { style: 'thin', color: {argb: 'FF475569'} }, left: { style: 'thin', color: {argb: 'FF475569'} }, right: { style: 'thin', color: {argb: 'FF475569'} } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
      filterRow1.height = 35;

      worksheet.addRow([]); 

      let headerData: string[] = [];
      if (isDetailed) {
        headerData = ['ت', '👤 اسم الموظف', '📍 الفرع/الموقع'];
        daysArray.forEach(d => {
          headerData.push(`${d}\n${dayjs(currentMonth).date(d).format('dd')}`);
        });
      } else if (isAtt) {
        headerData = ['ت', '👤 اسم الموظف', '📍 الفرع', 'المنصب', '🟢 حاضر (أيام)', '🔴 غائب', '🔵 إجازات', '🚫 أيام الغياب (المخصومة)'];
      } else {
        headerData = ['ت', '👤 اسم الموظف', '📍 الفرع', 'الراتب الاسمي (د.ع)', 'حضور', 'إجازة', 'غياب', 'استقطاع غياب (د.ع)', 'المستحق للدوام (د.ع)', 'إضافات (د.ع)', 'عقوبات وخصم (د.ع)', 'سلف مستردة (د.ع)', 'الصافي النهائي (د.ع)'];
      }

      const hRow = worksheet.addRow(headerData);
      hRow.height = 45; 
      
      hRow.eachCell((cell, colNum) => {
        if (!isDetailed && !isAtt && colNum === totalCols) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; 
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; 
        }
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12, name: 'Cairo' };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { 
          top: { style: 'thick', color:{argb: 'FF000000'} }, 
          bottom: { style: 'thick', color:{argb: 'FF000000'} }, 
          left: { style: 'thin', color:{argb: 'FF475569'} }, 
          right: { style: 'thin', color:{argb: 'FF475569'} } 
        };
      });

      payrollData.forEach((emp, idx) => {
        let rowData: any[] = [];
        if (isDetailed) {
          rowData = [idx + 1, emp.full_name, emp.branch];
          daysArray.forEach(d => {
             const dateStr = dayjs(currentMonth).date(d).format('YYYY-MM-DD');
             const rec = attendance.find(a => a.employee_id === emp.id && a.record_date === dateStr);
             const stat = rec?.status || '-';
             
             let symbol = '-';
             if (stat === 'حاضر') symbol = 'ح';
             else if (stat === 'غائب') symbol = 'غ';
             else if (stat === 'إجازة براتب') symbol = 'ج$';
             else if (stat === 'إجازة بدون راتب') symbol = 'ج';
             else if (stat === 'مجاز') symbol = 'م';
             else if (stat === 'نصف يوم') symbol = '½';
             
             rowData.push(symbol);
          });
        } else if (isAtt) {
          rowData = [idx + 1, emp.full_name, emp.branch, emp.role, emp.present, emp.absent, `${emp.paidLeave} / ${emp.unpaidLeave}`, emp.unpaidDays];
        } else {
          rowData = [idx + 1, emp.full_name, emp.branch, emp.salary, emp.present + (emp.halfDays * 0.5), emp.paidLeave, emp.unpaidDays, emp.absenceDeductionAmount > 0 ? -emp.absenceDeductionAmount : 0, emp.earnedSalary, emp.bonus > 0 ? emp.bonus : '-', emp.financialDeductions > 0 ? -emp.financialDeductions : '-', emp.advance > 0 ? -emp.advance : '-', emp.netSalary];
        }

        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 28; 
        const isAltRow = idx % 2 !== 0;

        dataRow.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = { 
            top: { style: 'thin', color: {argb: 'FF475569'} }, 
            left: { style: 'thin', color: {argb: 'FF475569'} }, 
            bottom: { style: 'thin', color: {argb: 'FF475569'} }, 
            right: { style: 'thin', color: {argb: 'FF475569'} } 
          };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAltRow ? 'FFF8FAFC' : 'FFFFFFFF' } };

          if (colNumber === 2) {
            cell.font = { name: 'Cairo', bold: true, color: { argb: 'FF0F172A' }, size: 12 };
            cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
          } else {
            cell.font = { name: 'Arial', bold: true, color: { argb: 'FF1E293B' }, size: 12 }; 
          }

          if (isDetailed && colNumber > 3) {
            const val = cell.value;
            if (val === 'ح') cell.font = { color: { argb: 'FF059669' }, bold: true, size: 12 };
            else if (val === 'غ') cell.font = { color: { argb: 'FFE11D48' }, bold: true, size: 12 };
            else if (val === 'ج$') cell.font = { color: { argb: 'FF0EA5E9' }, bold: true, size: 12 };
            else if (val === 'ج' || val === 'م') cell.font = { color: { argb: 'FFD97706' }, bold: true, size: 12 };
            else if (val === '½') cell.font = { color: { argb: 'FF6366F1' }, bold: true, size: 12 };
            else cell.font = { color: { argb: 'FFCBD5E1' } };

            const dateStr = dayjs(currentMonth).date(colNumber - 3).format('YYYY-MM-DD');
            const isFriday = dayjs(dateStr).day() === 5;
            if (isFriday) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            }
          } else if (isAtt) {
            if (colNumber === 5) cell.font = { color: { argb: 'FF059669' }, bold: true, size: 13 };
            if (colNumber === 6) cell.font = { color: { argb: 'FFE11D48' }, bold: true, size: 13 };
            if (colNumber === 8) cell.font = { color: { argb: 'FF4F46E5' }, bold: true, size: 13 };
          } else if (!isDetailed && !isAtt) {
            if (colNumber === 4 || colNumber >= 8) cell.font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF1E293B' } };
            
            if (colNumber === 8 && Number(cell.value) < 0) cell.font = { color: { argb: 'FFE11D48' }, bold: true, size: 12 };
            if (colNumber === 9) cell.font = { color: { argb: 'FF059669' }, bold: true, size: 12 };
            if (colNumber === 10 && cell.value !== '-') cell.font = { color: { argb: 'FF0EA5E9' }, bold: true, size: 12 };
            if (colNumber === 11 && cell.value !== '-') cell.font = { color: { argb: 'FFE11D48' }, bold: true, size: 12 };
            if (colNumber === 12 && cell.value !== '-') cell.font = { color: { argb: 'FFD97706' }, bold: true, size: 12 };
            
            if (colNumber === 13) {
              cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }; 
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; 
              cell.border = { 
                top: { style: 'thin', color: {argb: 'FF3730A3'} }, 
                bottom: { style: 'thin', color: {argb: 'FF3730A3'} }, 
                left: { style: 'medium', color: {argb: 'FF3730A3'} }, 
                right: { style: 'medium', color: {argb: 'FF3730A3'} } 
              }; 
            }
          }
        });
      });

      if (!isAtt && !isDetailed) {
        worksheet.addRow([]);
        const footerData: any[] = ['المجاميع الكلية:'];
        for(let i=1; i < 8; i++) footerData.push('');
        footerData.push(stats.totalEarned);
        footerData.push('');
        footerData.push(stats.totalDeductions > 0 ? -stats.totalDeductions : 0);
        footerData.push(stats.totalAdvances > 0 ? -stats.totalAdvances : 0);
        footerData.push(stats.totalNet);

        const footerRow = worksheet.addRow(footerData);
        footerRow.height = 40;
        worksheet.mergeCells(`A${footerRow.number}:H${footerRow.number}`);

        footerRow.eachCell((cell, colNumber) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; 
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FF38BDF8' }, size: 14 }; 
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { 
            top: { style: 'thick', color: {argb: 'FF000000'} }, 
            bottom: { style: 'thick', color: {argb: 'FF000000'} }, 
            left: { style: 'thin', color: {argb: 'FF475569'} }, 
            right: { style: 'thin', color: {argb: 'FF475569'} } 
          };
          if(colNumber === 1) {
            cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
            cell.font = { name: 'Cairo', bold: true, color: { argb: 'FFFFFFFF' }, size: 15 };
          }
          if(colNumber === 9) cell.font = { name: 'Arial', bold: true, color: { argb: 'FF10B981' }, size: 14 };
          if(colNumber === 11) cell.font = { name: 'Arial', bold: true, color: { argb: 'FFF43F5E' }, size: 14 };
          if(colNumber === 12) cell.font = { name: 'Arial', bold: true, color: { argb: 'FFF59E0B' }, size: 14 };
          if(colNumber === 13) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; 
            cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 17 };
          }
        });
      }

      worksheet.columns.forEach((col, i) => {
        if (i === 0) col.width = 6; 
        else if (i === 1) col.width = 35; 
        else if (i === 2) col.width = 15; 
        else if (isDetailed && i > 2) col.width = 5;
        else if (isAtt && i === 3) col.width = 20;
        else if (isAtt && i > 3) col.width = 18;
        else if (!isDetailed && !isAtt) {
          if (i === 3) col.width = 18;
          else if (i === totalCols - 1) col.width = 20;
          else col.width = 16;
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, exportName);

    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء تصدير ملف الإكسل.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPDF = (type: 'attendance' | 'detailed' | 'payroll') => {
    if (payrollData.length === 0) return alert("لا توجد بيانات لطباعتها.");
    setIsExportingPDF(true);

    const isAtt = type === 'attendance';
    const isDetailed = type === 'detailed';
    const title = isAtt ? `ملخص دوام الموظفين - للفترة من ${startDate} إلى ${endDate}` : 
                  isDetailed ? `السجل اليومي المفصل للدوام - لشهر ${dayjs(currentMonth).format('MM/YYYY')}` :
                  `كشف الرواتب المالي المفصل - للفترة من ${startDate} إلى ${endDate}`;
    const themeColor = isDetailed ? '#f59e0b' : isAtt ? '#4f46e5' : '#10b981';

    let trRows = '';
    payrollData.forEach((emp, index) => {
      const rowClass = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      
      if (isDetailed) {
        let daysHtml = daysArray.map(d => {
             const dateStr = dayjs(currentMonth).date(d).format('YYYY-MM-DD');
             const record = attendance.find(a => a.employee_id === emp.id && a.record_date === dateStr);
             const stat = record?.status || '-';
             
             const isFriday = dayjs(dateStr).day() === 5;
             const bgFriday = isFriday ? 'background-color: #fee2e2;' : '';

             let symbol = '-';
             let color = '#000000'; 
             if (stat === 'حاضر') { symbol = 'ح'; color = '#059669'; }
             else if (stat === 'غائب') { symbol = 'غ'; color = '#e11d48'; }
             else if (stat === 'إجازة براتب') { symbol = 'ج$'; color = '#0ea5e9'; }
             else if (stat === 'إجازة بدون راتب') { symbol = 'ج'; color = '#d97706'; }
             else if (stat === 'مجاز') { symbol = 'م'; color = '#d97706'; }
             else if (stat === 'نصف يوم') { symbol = '½'; color = '#6366f1'; }

             return `<td style="text-align: center; border: 1px solid #000; padding: 4px 1px; font-size: 10px; font-weight: 900; color: ${color}; ${bgFriday}">${symbol}</td>`;
        }).join('');

        trRows += `
          <tr style="background-color: ${rowClass}; page-break-inside: avoid;">
            <td style="text-align: center; border: 1px solid #000; padding: 4px; font-size: 10px; color: #000;">${index + 1}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 4px 6px; font-size: 11px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; color: #000;">${emp.full_name}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 4px 6px; font-size: 10px; font-weight: bold; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">${emp.branch}</td>
            ${daysHtml}
          </tr>
        `;
      } else if (isAtt) {
        trRows += `
          <tr style="background-color: ${rowClass}; page-break-inside: avoid;">
            <td style="text-align: center; border: 1px solid #000; padding: 10px; font-size: 12px; color: #000;">${index + 1}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 10px; font-size: 13px; font-weight: bold; color: #000;">${emp.full_name} <div style="font-size: 9px; color: #475569;">${emp.role} - ${emp.branch}</div></td>
            <td style="text-align: center; border: 1px solid #000; padding: 10px; font-size: 14px; font-weight: bold; color: #059669;">${emp.present}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 10px; font-size: 14px; font-weight: bold; color: #e11d48;">${emp.absent}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 10px; font-size: 13px; font-weight: bold; color: #d97706;">${emp.paidLeave} / ${emp.unpaidLeave}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 10px; font-size: 15px; font-weight: 900; color: #4f46e5;">${emp.unpaidDays} أيام</td>
          </tr>
        `;
      } else {
        trRows += `
          <tr style="background-color: ${rowClass}; page-break-inside: avoid;">
            <td style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 10px; color: #000;">${index + 1}</td>
            <td style="text-align: right; border: 1px solid #000; padding: 8px 6px; font-size: 11px; font-weight: bold; color:#000;">${emp.full_name} <div style="font-size: 8px; color: #475569;">${emp.role}</div></td>
            <td dir="ltr" style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 10px; font-weight: bold; color: #000;">${emp.salary.toLocaleString('en-US')}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 11px; font-weight: bold; color: #059669;">${emp.present + (emp.halfDays * 0.5)}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 11px; font-weight: bold; color: #0ea5e9;">${emp.paidLeave}</td>
            <td style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 11px; font-weight: bold; color: #e11d48;">${emp.unpaidDays}</td>
            <td dir="ltr" style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 10px; font-weight: bold; color: #e11d48;">${emp.absenceDeductionAmount > 0 ? '-' + emp.absenceDeductionAmount.toLocaleString('en-US') : '-'}</td>
            <td dir="ltr" style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 11px; font-weight: bold; color: #059669;">${emp.earnedSalary.toLocaleString('en-US')}</td>
            <td dir="ltr" style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 10px; font-weight: bold; color: #0ea5e9;">${emp.bonus > 0 ? '+' + emp.bonus.toLocaleString('en-US') : '-'}</td>
            <td dir="ltr" style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 10px; font-weight: bold; color: #e11d48;">${emp.financialDeductions > 0 ? '-' + emp.financialDeductions.toLocaleString('en-US') : '-'}</td>
            <td dir="ltr" style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 10px; font-weight: bold; color: #d97706;">${emp.advance > 0 ? '-' + emp.advance.toLocaleString('en-US') : '-'}</td>
            <td dir="ltr" style="text-align: center; border: 1px solid #000; padding: 8px 4px; font-size: 12px; font-weight: 900; color: #000; background: #eef2ff;">${emp.netSalary.toLocaleString('en-US')}</td>
          </tr>
        `;
      }
    });

    let thDays = isDetailed ? daysArray.map(d => {
      const dateStr = dayjs(currentMonth).date(d).format('YYYY-MM-DD');
      const isFriday = dayjs(dateStr).day() === 5;
      const bgFriday = isFriday ? 'background-color: #fca5a5;' : ''; 
      return `<th width="2.6%" style="padding: 4px 1px; font-size: 8px; text-align: center; border: 2px solid #000; color: #fff; ${bgFriday}">${d}<br><span style="font-size:6px; color:#fff; font-weight:normal;">${dayjs(dateStr).format('dd')}</span></th>`;
    }).join('') : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            @page { size: ${pdfSettings.paperSize} landscape; margin: ${pdfSettings.margin}; }
            body { font-family: 'Cairo', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; background: white; color: #0f172a; }
            .print-container { zoom: ${pdfSettings.zoom / 100}; margin-right: ${pdfSettings.shiftX}mm; }
            table { width: 100%; border-collapse: collapse; page-break-inside: auto; margin-bottom: 20px; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'}; border: 3px solid #000; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            th { background-color: #0f172a; color: white; padding: ${isDetailed ? '4px 2px' : '10px 4px'}; font-size: ${isDetailed ? '10px' : '10px'}; border: 2px solid #000; }
            .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .totals-box { background: #f8fafc; border: 2px solid #000; padding: 15px; display: flex; justify-content: space-between; margin-top: 20px; }
            .totals-box div { text-align: center; }
            .totals-box span { display: block; font-size: 12px; color: #000; font-weight: bold; margin-bottom: 5px; }
            .totals-box strong { font-size: 18px; font-weight: 900; color: #000; }
            .legend { font-size: 10px; color: #000; font-weight: bold; background: #f8fafc; padding: 8px; border: 1px solid #000; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="header-box">
              <div>
                <h1 style="margin: 0; color: #000; font-size: 20px; font-weight: 900;">${title}</h1>
                <p style="margin: 2px 0 0 0; color: #000; font-size: 12px;">العدد الكلي للموظفين المدرجين في الكشف: <span style="font-weight:900;">${payrollData.length}</span></p>
              </div>
              <div style="text-align: left;">
                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #000;">تاريخ الطباعة:</p>
                <p dir="ltr" style="margin: 2px 0 0 0; color: #000; font-size: 12px; font-weight:bold;">${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  ${isDetailed ? `
                    <th width="3%">ت</th>
                    <th width="12%" style="text-align: right;">اسم الموظف</th>
                    <th width="8%" style="text-align: center;">موقع العمل</th>
                    ${thDays}
                  ` : isAtt ? `
                    <th width="5%">ت</th>
                    <th width="30%" style="text-align: right;">اسم الموظف</th>
                    <th width="15%">حاضر</th>
                    <th width="15%">غائب</th>
                    <th width="15%">إجازات</th>
                    <th width="20%">أيام الغياب (للاستقطاع)</th>
                  ` : `
                    <th width="3%">ت</th>
                    <th width="16%" style="text-align: right;">اسم الموظف</th>
                    <th width="8%">الاسمي</th>
                    <th width="7%">حضور</th>
                    <th width="7%">إجازة</th>
                    <th width="7%">غياب</th>
                    <th width="9%">استقطاع غياب</th>
                    <th width="9%">المستحق</th>
                    <th width="8%">إضافات</th>
                    <th width="8%">عقوبات</th>
                    <th width="8%">سلف</th>
                    <th width="10%" style="background-color: #1d4ed8;">الصافي النهائي</th>
                  `}
                </tr>
              </thead>
              <tbody>
                ${trRows}
              </tbody>
            </table>
            
            ${isDetailed ? `
              <div class="legend">
                مفتاح الرموز: &nbsp; <span style="color:#059669;">(ح: حاضر)</span> &nbsp; | &nbsp; <span style="color:#e11d48;">(غ: غائب)</span> &nbsp; | &nbsp; <span style="color:#0ea5e9;">(ج$: إجازة براتب)</span> &nbsp; | &nbsp; <span style="color:#d97706;">(ج: إجازة بدون راتب)</span> &nbsp; | &nbsp; <span style="color:#d97706;">(م: مجاز)</span> &nbsp; | &nbsp; <span style="color:#6366f1;">(½: نصف يوم)</span> &nbsp; | &nbsp; <span style="color:#e11d48;">(اللون الأحمر: يوم جمعة)</span>
              </div>
            ` : ''}

            ${!isAtt && !isDetailed ? `
              <div class="totals-box">
                <div><span>إجمالي الرواتب المستحقة للدوام</span><strong dir="ltr">${stats.totalEarned.toLocaleString('en-US')} د.ع</strong></div>
                <div><span>إجمالي الخصومات الإدارية</span><strong dir="ltr">${stats.totalDeductions.toLocaleString('en-US')} د.ع</strong></div>
                <div><span>إجمالي السلف المستردة</span><strong dir="ltr">${stats.totalAdvances.toLocaleString('en-US')} د.ع</strong></div>
                <div style="background-color:#0f172a; color:#fff; padding:10px; border-radius:8px;">
                   <span style="color:#cbd5e1;">الصافي الكلي المطلوب دفعه</span>
                   <strong dir="ltr" style="color:#fff; font-size: 20px;">${stats.totalNet.toLocaleString('en-US')} د.ع</strong>
                </div>
              </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 40px; border-top: 2px solid #000; padding-top: 10px; page-break-inside: avoid;">
              <div style="font-size: 12px; font-weight: bold; color: #000;">طُبع بواسطة: نظام الإدارة المركزي (ERP)</div>
              <div style="font-size: 12px; font-weight: bold; color: #000;" dir="ltr">تاريخ الطباعة: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</div>
            </div>

          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      setTimeout(() => {
        setIsExportingPDF(false);
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);
      }, 1000);
    }
  };

  const printPayslip = (emp: typeof payrollData[0]) => {
    const printWindow = document.createElement('iframe');
    printWindow.style.display = 'none';
    document.body.appendChild(printWindow);
    
    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <title>شريط راتب - ${emp.full_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body { font-family: 'Cairo', sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #0f172a; margin: 0; font-size: 28px; font-weight: 900; }
            .header p { color: #64748b; margin: 5px 0 0 0; font-size: 16px; font-weight: bold; }
            .info-grid { display: flex; justify-content: space-between; background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
            .info-item { display: flex; flex-direction: column; gap: 5px; }
            .info-label { font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; }
            .info-value { font-size: 16px; font-weight: 900; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #0f172a; color: white; text-align: right; padding: 12px; font-size: 14px; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: bold; color: #334155; }
            .amount { text-align: left; font-family: monospace; font-size: 16px; font-weight: 900; }
            .positive { color: #059669; }
            .negative { color: #e11d48; }
            .neutral { color: #64748b; }
            .net-box { background: #0f172a; color: white; padding: 25px; text-align: center; border-radius: 16px; }
            .net-box p { margin: 0 0 5px 0; color: #94a3b8; font-size: 14px; }
            .net-box h2 { margin: 0; font-size: 42px; font-family: monospace; }
            .highlight-row { background-color: #f8fafc; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>إدارة المطبخ المركزي</h1>
            <p>كشف تفاصيل الراتب (Payslip) - الفترة من ${startDate} إلى ${endDate}</p>
          </div>

          <div class="info-grid">
            <div class="info-item"><span class="info-label">اسم الموظف</span><span class="info-value">${emp.full_name}</span></div>
            <div class="info-item"><span class="info-label">المنصب</span><span class="info-value">${emp.role}</span></div>
            <div class="info-item"><span class="info-label">حالة الدوام (أيام)</span><span class="info-value" style="color:#059669;">حضور: ${emp.present + (emp.halfDays * 0.5)} | إجازات (براتب): ${emp.paidLeave}</span></div>
            <div class="info-item"><span class="info-label text-center">الغياب الكلي</span><span class="info-value text-center" style="color:#e11d48;">${emp.unpaidDays} أيام</span></div>
          </div>

          <table>
            <thead>
              <tr><th>التفاصيل والبيان</th><th style="text-align: left;">المبلغ (د.ع)</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>الراتب الاسمي (الثابت)</td>
                <td class="amount neutral">${emp.salary.toLocaleString('en-US')} د.ع</td>
              </tr>
              ${emp.unpaidDays > 0 ? `
              <tr>
                <td>استقطاع الغيابات والإجازات بدون راتب (${emp.unpaidDays} أيام)</td>
                <td class="amount negative">- ${emp.absenceDeductionAmount.toLocaleString('en-US')} د.ع</td>
              </tr>
              ` : ''}
              <tr class="highlight-row">
                <td style="color:#0f172a;">الراتب المستحق (بعد خصم الغيابات)</td>
                <td class="amount" style="color:#0f172a;">${emp.earnedSalary.toLocaleString('en-US')} د.ع</td>
              </tr>
              ${emp.bonus > 0 ? `
              <tr>
                <td>مكافآت وإضافيات (عمل إضافي، حوافز)</td>
                <td class="amount positive">+ ${emp.bonus.toLocaleString('en-US')} د.ع</td>
              </tr>` : ''}
              ${emp.financialDeductions > 0 ? `
              <tr>
                <td>خصومات مالية وعقوبات (من الإدارة)</td>
                <td class="amount negative">- ${emp.financialDeductions.toLocaleString('en-US')} د.ع</td>
              </tr>` : ''}
              ${emp.advance > 0 ? `
              <tr>
                <td>استقطاع سلف مستلمة سابقاً</td>
                <td class="amount negative">- ${emp.advance.toLocaleString('en-US')} د.ع</td>
              </tr>` : ''}
            </tbody>
          </table>

          <div class="net-box">
            <p>الصافي النهائي المستحق الدفع للموظف (Net Salary)</p>
            <h2>${emp.netSalary.toLocaleString('en-US')} د.ع</h2>
          </div>
        </body>
      </html>
    `;
    
    const doc = printWindow.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        printWindow.contentWindow?.focus();
        printWindow.contentWindow?.print();
        setTimeout(() => document.body.removeChild(printWindow), 1000);
      }, 500);
    }
  };

  if (!isMounted) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-colors duration-300 ease-in-out pb-[130px] ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white'}`} dir="rtl">
        
        {/* 🌟 الخلفية المظلمة والتأثيرات 🌟 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 dark:from-indigo-900/20 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-opacity duration-300 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🟢 الهيدر الثابت 🟢 */}
          <div className={`flex flex-col md:flex-row items-center justify-between gap-6 mb-8 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-300 origin-top z-10 ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="absolute left-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center gap-4 text-right w-full xl:w-auto relative z-10">
              <div className="bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-800 w-14 h-14 rounded-[1.3rem] text-white shadow-md dark:shadow-xl dark:shadow-indigo-500/30 flex items-center justify-center shrink-0">
                <Wallet className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-[22px] font-black text-slate-800 dark:text-white tracking-tight transition-colors">كشف الرواتب (Payroll)</h2>
                <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">النظام المالي وحساب الصافي النهائي للموظفين</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#050505] p-1.5 rounded-2xl flex items-center w-full md:w-auto shadow-sm dark:shadow-inner border border-slate-200 dark:border-white/10 overflow-x-auto hide-scrollbar relative z-10 transition-colors">
              <button 
                onClick={() => setActiveTab('attendance')} 
                className={`flex-1 md:flex-none px-6 py-3 min-w-max text-[12px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'attendance' ? 'bg-white dark:bg-[#121214] text-indigo-600 dark:text-indigo-400 shadow-sm dark:shadow-md border border-slate-200 dark:border-indigo-500/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                <CalendarDays className="w-4 h-4" /> ملخص الدوام
              </button>
              <button 
                onClick={() => setActiveTab('detailed')} 
                className={`flex-1 md:flex-none px-6 py-3 min-w-max text-[12px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'detailed' ? 'bg-white dark:bg-[#121214] text-amber-600 dark:text-amber-400 shadow-sm dark:shadow-md border border-slate-200 dark:border-amber-500/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                <LayoutGrid className="w-4 h-4" /> السجل المفصل
              </button>
              <button 
                onClick={() => setActiveTab('payroll')} 
                className={`flex-1 md:flex-none px-6 py-3 min-w-max text-[12px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'payroll' ? 'bg-white dark:bg-[#121214] text-emerald-600 dark:text-emerald-400 shadow-sm dark:shadow-md border border-slate-200 dark:border-emerald-500/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                <ReceiptText className="w-4 h-4" /> كشف الرواتب
              </button>
            </div>
          </div>

          {/* 🟢 شريط أدوات التحكم (Toolbar) الموحد 🟢 */}
          <div className={`bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 p-2 md:p-3 rounded-[1.5rem] mb-8 flex flex-col-reverse xl:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-lg w-full no-print relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>

              {/* جزء الأزرار والفلاتر */}
              <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                  
                  <div className="flex bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm dark:shadow-inner h-[46px] transition-colors">
                    <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="bg-transparent text-slate-700 dark:text-slate-300 text-[12px] font-bold px-4 outline-none cursor-pointer hover:text-indigo-600 dark:hover:text-white appearance-none transition-colors">
                      <option value="الكل" className="bg-white dark:bg-[#121214]">كل الفروع</option>
                      {uniqueBranchesDropdown.map(b => <option key={b} value={b} className="bg-white dark:bg-[#121214]">{b}</option>)}
                    </select>
                    <div className="w-px bg-slate-200 dark:bg-white/10 transition-colors"></div>
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-transparent text-slate-700 dark:text-slate-300 text-[12px] font-bold px-4 outline-none cursor-pointer hover:text-indigo-600 dark:hover:text-white appearance-none transition-colors">
                      <option value="الكل" className="bg-white dark:bg-[#121214]">كل الأقسام</option>
                      {uniqueCategoriesList.map(c => <option key={c} value={c} className="bg-white dark:bg-[#121214]">{c}</option>)}
                    </select>
                  </div>

                  <div className="hidden xl:block w-px h-6 bg-slate-200 dark:bg-white/10 mx-1 transition-colors"></div>

                  <button onClick={clearFilters} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-black text-[12px] transition-colors outline-none cursor-pointer active:scale-95">
                    <RotateCcw className="w-4 h-4" /> تصفير
                  </button>
                  <button onClick={() => setIsZenMode(true)} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-black text-[12px] transition-colors outline-none cursor-pointer active:scale-95">
                    <Eye className="w-4 h-4" /> التركيز
                  </button>
              </div>

              {/* 💡 جزء التاريخ المبرمج 💡 */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto">
                  
                  {/* 💡 زر شهر محدد 💡 */}
                  <div onClick={() => openDatePicker('selectMonth', startDate, 'month')} className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden cursor-pointer h-[46px] group hover:border-teal-400 dark:hover:border-teal-500/50 transition-colors w-full sm:w-auto shadow-sm dark:shadow-inner active:scale-95 outline-none">
                    <div className="bg-white dark:bg-[#121214] px-4 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0 transition-colors group-hover:bg-teal-50 dark:group-hover:bg-teal-500/20">
                      <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-500" />
                    </div>
                    <div className="bg-slate-50 dark:bg-[#050505] px-4 flex items-center justify-center min-w-[90px] transition-colors">
                      <span className="text-[12px] font-black text-slate-800 dark:text-white tracking-widest whitespace-nowrap">شهر محدد</span>
                    </div>
                  </div>

                  <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-white/10 mx-1 transition-colors"></div>

                  {/* 💡 زر من 💡 */}
                  <div onClick={() => openDatePicker('startDate', startDate, 'date')} className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden cursor-pointer h-[46px] group hover:border-indigo-300 dark:hover:border-white/20 transition-colors w-full sm:w-auto shadow-sm dark:shadow-inner active:scale-95 outline-none">
                    <div className="bg-white dark:bg-[#121214] w-12 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0 transition-colors">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">من</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#050505] px-4 flex items-center justify-center min-w-[130px] transition-colors">
                      <span className="text-[13px] font-black text-slate-800 dark:text-white tracking-widest dir-ltr en-num whitespace-nowrap">{dayjs(startDate).format('DD / MM / YYYY')}</span>
                    </div>
                  </div>
                  
                  {/* 💡 زر إلى 💡 */}
                  <div onClick={() => openDatePicker('endDate', endDate, 'date')} className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden cursor-pointer h-[46px] group hover:border-indigo-300 dark:hover:border-white/20 transition-colors w-full sm:w-auto shadow-sm dark:shadow-inner active:scale-95 outline-none">
                    <div className="bg-white dark:bg-[#121214] w-12 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0 transition-colors">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إلى</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#050505] px-4 flex items-center justify-center min-w-[130px] transition-colors">
                      <span className="text-[13px] font-black text-slate-800 dark:text-white tracking-widest dir-ltr en-num whitespace-nowrap">{dayjs(endDate).format('DD / MM / YYYY')}</span>
                    </div>
                  </div>
              </div>

          </div>

          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden' : 'scale-y-100 opacity-100'}`}>
            <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
              <div><span className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">الرواتب المستحقة (بعد خصم الغياب)</span><span className="text-xl md:text-2xl font-black text-slate-800 dark:text-white dir-ltr block mt-1">{stats.totalEarned.toLocaleString('en-US')} د.ع</span></div>
              <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center text-slate-400 shrink-0 transition-colors"><Users className="w-5 h-5"/></div>
            </div>
            <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
              <div><span className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">إجمالي المخصوم (عقوبات مالية)</span><span className="text-xl md:text-2xl font-black text-rose-600 dark:text-rose-400 dir-ltr block mt-1">- {stats.totalDeductions.toLocaleString('en-US')} د.ع</span></div>
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0 transition-colors"><TrendingDown className="w-5 h-5"/></div>
            </div>
            <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-lg flex items-center justify-between transition-colors">
              <div><span className="block text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">إجمالي السلف المستردة</span><span className="text-xl md:text-2xl font-black text-sky-600 dark:text-sky-400 dir-ltr block mt-1">- {stats.totalAdvances.toLocaleString('en-US')} د.ع</span></div>
              <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 flex items-center justify-center text-sky-500 shrink-0 transition-colors"><Banknote className="w-5 h-5"/></div>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-[2rem] border border-indigo-200 dark:border-indigo-500/30 shadow-sm dark:shadow-lg flex items-center justify-between relative overflow-hidden transition-colors">
              <div className="absolute -right-4 -bottom-4 opacity-10 dark:opacity-20"><ShieldCheck className="w-24 h-24 text-indigo-600 dark:text-indigo-500"/></div>
              <div className="relative z-10"><span className="block text-[11px] font-black text-indigo-700 dark:text-indigo-300 uppercase">الصافي الكلي المطلوب دفعه</span><span className="text-2xl md:text-3xl font-black text-indigo-700 dark:text-indigo-400 dir-ltr block mt-1">{stats.totalNet.toLocaleString('en-US')} د.ع</span></div>
            </div>
          </div>

          {/* 🟢 شريط البحث العلوي للجدول 🟢 */}
          <div className={`relative w-full mb-6 shrink-0 transition-all duration-300 origin-top z-10 ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden' : 'scale-y-100 opacity-100'}`}>
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 transition-colors" />
            <input 
              type="text" 
              placeholder="ابحث عن موظف أو فرع..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 shadow-sm dark:shadow-inner text-[14px] transition-all"
            />
          </div>

          {activeTab === 'attendance' && (
            <div className={`overflow-x-auto w-full custom-island-scroll rounded-[2.5rem] border shadow-sm dark:shadow-lg pb-4 animate-in fade-in duration-300 transition-colors ${isZenMode ? 'bg-transparent border-slate-200 dark:border-white/5' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10'}`}>
              <div className={`p-6 border-b flex flex-col md:flex-row items-center justify-between gap-4 rounded-t-[2.5rem] transition-colors ${isZenMode ? 'bg-slate-50/50 dark:bg-black/50 border-slate-200 dark:border-white/5' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10'}`}>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400 transition-colors"/>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white transition-colors">ملخص أيام الدوام (من {dayjs(startDate).format('DD/MM')} إلى {dayjs(endDate).format('DD/MM')})</h3>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button onClick={() => setShowPdfSettings(!showPdfSettings)} className={`p-2.5 rounded-xl transition-all shadow-sm border outline-none cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-indigo-600 text-white border-indigo-700 dark:border-indigo-500' : 'bg-white dark:bg-[#050505] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}><Settings className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.preventDefault(); handleExportPDF('attendance'); }} disabled={isExportingPDF || payrollData.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all disabled:opacity-50 outline-none cursor-pointer active:scale-95">
                    {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4"/>} طباعة PDF
                  </button>
                  <button onClick={(e) => { e.preventDefault(); handleExportExcel('attendance'); }} disabled={isExportingExcel || payrollData.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all disabled:opacity-50 outline-none cursor-pointer active:scale-95">
                    {isExportingExcel ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4"/>} إكسل
                  </button>
                </div>
              </div>
              
              {showPdfSettings && !isZenMode && (
                <div className="bg-slate-50 dark:bg-[#050505] p-5 m-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner flex flex-col gap-5 animate-in slide-in-from-top-2 relative transition-colors">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
                    <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 transition-colors"><Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400"/> إعدادات طباعة الجدول (PDF)</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors bg-white dark:bg-[#121214] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95"><RefreshCw className="w-3 h-3" /> استعادة الافتراضيات</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-2"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 transition-colors">حجم الورق</label><select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-3 py-2 rounded-xl focus:border-indigo-400 dark:focus:border-indigo-500/50 outline-none transition-colors shadow-sm dark:shadow-inner cursor-pointer appearance-none"><option value="A4" className="bg-white dark:bg-[#050505]">A4</option><option value="A3" className="bg-white dark:bg-[#050505]">A3</option></select></div>
                    <div className="flex flex-col gap-2"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 transition-colors">الهوامش</label><select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-3 py-2 rounded-xl focus:border-indigo-400 dark:focus:border-indigo-500/50 outline-none transition-colors shadow-sm dark:shadow-inner cursor-pointer appearance-none"><option value="0mm" className="bg-white dark:bg-[#050505]">بدون</option><option value="5mm" className="bg-white dark:bg-[#050505]">5mm</option><option value="10mm" className="bg-white dark:bg-[#050505]">10mm</option></select></div>
                    <div className="flex flex-col gap-2 col-span-2"><div className="flex justify-between"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 transition-colors">الزووم ({pdfSettings.zoom}%)</label></div><input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-indigo-600 h-2 bg-slate-200 dark:bg-[#121214] border border-transparent dark:border-white/5 rounded-lg outline-none cursor-pointer" /></div>
                  </div>
                </div>
              )}

              <table className="w-full text-right border-collapse min-w-[1000px]">
                <thead className="bg-slate-50 dark:bg-[#050505] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase transition-colors">
                  <tr>
                    <th className="py-4 px-6 border-b border-slate-200 dark:border-white/10">معلومات الموظف</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">حاضر (أيام)</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">غائب (بدون عذر)</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">إجازة براتب / بدون</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center text-rose-600 dark:text-rose-400">الغيابات (للاستقطاع)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 transition-colors">
                  {isLoading ? (
                    <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 text-indigo-500 dark:text-indigo-400 animate-spin mx-auto"/></td></tr>
                  ) : payrollData.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-500 font-bold">لا توجد بيانات تطابق بحثك</td></tr>
                  ) : (
                    payrollData.map((emp) => {
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors bg-white dark:bg-transparent">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${emp.avatar_color || 'from-slate-700 to-slate-800'} text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm dark:shadow-inner`}>
                                {getInitials(emp.full_name)}
                              </div>
                              <div>
                                <h4 className="text-[14px] font-black text-slate-800 dark:text-slate-200 transition-colors">{emp.full_name}</h4>
                                <p className="text-[11px] font-bold text-slate-500 mt-0.5 transition-colors">{emp.role} • <span className="text-indigo-600 dark:text-indigo-400">{emp.branch}</span></p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center font-black text-emerald-600 dark:text-emerald-400 text-[15px] bg-emerald-50 dark:bg-emerald-500/5 transition-colors">{emp.present > 0 ? emp.present : '-'}</td>
                          <td className="py-4 px-4 text-center font-black text-rose-600 dark:text-rose-400 text-[15px] bg-rose-50 dark:bg-rose-500/5 transition-colors">{emp.absent > 0 ? emp.absent : '-'}</td>
                          <td className="py-4 px-4 text-center font-black text-sky-600 dark:text-sky-400 text-[15px] bg-sky-50 dark:bg-sky-500/5 transition-colors">{emp.paidLeave} / {emp.unpaidLeave}</td>
                          <td className="py-4 px-4 text-center font-black text-rose-600 dark:text-rose-500 text-[15px] bg-rose-100 dark:bg-rose-500/10 border-l border-slate-100 dark:border-white/5 shadow-inner transition-colors">{emp.unpaidDays} أيام</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'detailed' && (
            <div className={`overflow-x-auto w-full custom-island-scroll rounded-[2.5rem] border shadow-sm dark:shadow-lg pb-4 animate-in fade-in duration-300 transition-all ${isZenMode ? 'bg-transparent border-slate-200 dark:border-white/5' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10'}`}>
              <div className={`p-6 border-b flex flex-col md:flex-row items-center justify-between gap-4 rounded-t-[2.5rem] transition-colors ${isZenMode ? 'bg-slate-50/50 dark:bg-black/50 border-slate-200 dark:border-white/5' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10'}`}>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <LayoutGrid className="w-5 h-5 text-amber-600 dark:text-amber-500 transition-colors"/>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white transition-colors">السجل الجداري المفصل لشهر {dayjs(currentMonth).format('MM')} ({daysInMonth} يوم)</h3>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button onClick={() => setShowPdfSettings(!showPdfSettings)} className={`p-2.5 rounded-xl transition-all shadow-sm border outline-none cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-amber-600 text-white border-amber-500' : 'bg-white dark:bg-[#050505] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}><Settings className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.preventDefault(); handleExportPDF('detailed'); }} disabled={isExportingPDF || payrollData.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all disabled:opacity-50 outline-none cursor-pointer active:scale-95">
                    {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4"/>} طباعة PDF
                  </button>
                  <button onClick={(e) => { e.preventDefault(); handleExportExcel('detailed'); }} disabled={isExportingExcel || payrollData.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all disabled:opacity-50 outline-none cursor-pointer active:scale-95">
                    {isExportingExcel ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4"/>} إكسل VIP
                  </button>
                </div>
              </div>
              
              {showPdfSettings && !isZenMode && (
                <div className="bg-slate-50 dark:bg-[#050505] p-5 m-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner flex flex-col gap-5 animate-in slide-in-from-top-2 relative transition-colors">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
                    <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 transition-colors"><Settings className="w-4 h-4 text-amber-600 dark:text-amber-400"/> إعدادات طباعة الجدول المفصل (PDF)</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors bg-white dark:bg-[#121214] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95"><RefreshCw className="w-3 h-3" /> استعادة</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                    <div className="flex flex-col gap-2"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 transition-colors">حجم الورق</label><select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-3 py-2.5 rounded-xl focus:border-amber-400 dark:focus:border-amber-500/50 outline-none cursor-pointer appearance-none transition-colors shadow-sm dark:shadow-inner"><option value="A4" className="bg-white dark:bg-[#050505]">A4</option><option value="A3" className="bg-white dark:bg-[#050505]">A3 (مفضل)</option></select></div>
                    <div className="flex flex-col gap-2"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 transition-colors">الهوامش</label><select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-3 py-2.5 rounded-xl focus:border-amber-400 dark:focus:border-amber-500/50 outline-none cursor-pointer appearance-none transition-colors shadow-sm dark:shadow-inner"><option value="0mm" className="bg-white dark:bg-[#050505]">بدون</option><option value="5mm" className="bg-white dark:bg-[#050505]">5mm</option><option value="10mm" className="bg-white dark:bg-[#050505]">10mm</option></select></div>
                    <div className="flex flex-col gap-2 col-span-2"><div className="flex justify-between"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 transition-colors">الزووم ({pdfSettings.zoom}%)</label></div><input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-amber-600 h-2 bg-slate-200 dark:bg-[#121214] border border-transparent dark:border-white/5 rounded-lg mt-1 outline-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2"><button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`w-full py-2.5 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 ${pdfSettings.autoFit ? 'bg-amber-600 border-amber-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}><Maximize className="w-4 h-4 inline-block ml-1" /> {pdfSettings.autoFit ? 'احتواء: تلقائي' : 'احتواء: يدوي'}</button></div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto custom-island-scroll pb-2 mt-2 px-2">
                <div className="print-container relative w-full">
                  <table className="w-full text-right border-collapse min-w-max print-table">
                    <thead className="bg-slate-50 dark:bg-[#050505] text-slate-500 dark:text-slate-400 font-black text-[11px] uppercase transition-colors">
                      <tr>
                        <th className="py-4 px-6 border-b border-r border-slate-200 dark:border-white/10 sticky right-0 bg-slate-50 dark:bg-[#050505] z-20 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.5)] min-w-[200px] transition-colors">الموظف</th>
                        {daysArray.map(d => {
                          const dateStr = dayjs(currentMonth).date(d).format('YYYY-MM-DD');
                          const isFriday = dayjs(dateStr).day() === 5;
                          return (
                            <th key={d} className={`py-3 px-1 border-b border-slate-200 dark:border-white/10 text-center w-8 min-w-[2.2rem] transition-colors ${isFriday ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'bg-white dark:bg-[#121214]'}`}>
                              <div className="flex flex-col items-center">
                                <span className="text-[13px] font-black">{d}</span>
                                <span className={`text-[8px] font-bold mt-0.5 ${isFriday ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>{dayjs(dateStr).format('dd')}</span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 border-b border-slate-200 dark:border-white/10 transition-colors">
                      {isLoading ? (
                        <tr><td colSpan={daysInMonth + 1} className="py-20 text-center"><Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto"/></td></tr>
                      ) : payrollData.length === 0 ? (
                        <tr><td colSpan={daysInMonth + 1} className="py-20 text-center text-slate-500 font-bold">لا توجد بيانات تطابق بحثك</td></tr>
                      ) : (
                        payrollData.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors bg-white dark:bg-transparent group/row">
                            <td className={`py-2 px-4 border-r border-slate-200 dark:border-white/10 sticky right-0 z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.5)] transition-colors ${isZenMode ? 'bg-white dark:bg-black group-hover/row:bg-slate-50 dark:group-hover/row:bg-[#121214]' : 'bg-white dark:bg-[#121214] group-hover/row:bg-slate-50 dark:group-hover/row:bg-[#1a1a1f]'}`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${emp.avatar_color || 'from-slate-700 to-slate-800'} text-white flex items-center justify-center font-black text-[10px] shrink-0 shadow-sm dark:shadow-inner`}>
                                  {getInitials(emp.full_name)}
                                </div>
                                <div className="truncate max-w-[140px]">
                                  <h4 className="text-[12px] font-black text-slate-800 dark:text-slate-200 truncate transition-colors" title={emp.full_name}>{emp.full_name}</h4>
                                  <p className="text-[9px] font-bold text-slate-500 mt-0.5 truncate transition-colors">{emp.branch}</p>
                                </div>
                              </div>
                            </td>
                            {daysArray.map(d => {
                               const dateStr = dayjs(currentMonth).date(d).format('YYYY-MM-DD');
                               const record = attendance.find(a => a.employee_id === emp.id && a.record_date === dateStr);
                               const isFriday = dayjs(dateStr).day() === 5;
                               
                               const getStatusIcon = (status?: string) => {
                                 switch (status) {
                                   case 'حاضر': return <div className="w-5 h-5 mx-auto bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md flex items-center justify-center font-black text-[10px] shadow-sm dark:shadow-none" title="حاضر">ح</div>;
                                   case 'غائب': return <div className="w-5 h-5 mx-auto bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-md flex items-center justify-center font-black text-[10px] shadow-sm dark:shadow-none" title="غائب">غ</div>;
                                   case 'إجازة براتب': return <div className="w-5 h-5 mx-auto bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-md flex items-center justify-center font-black text-[10px] shadow-sm dark:shadow-none" title="إجازة براتب">ج$</div>;
                                   case 'إجازة بدون راتب': return <div className="w-5 h-5 mx-auto bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md flex items-center justify-center font-black text-[10px] shadow-sm dark:shadow-none" title="إجازة بدون راتب">ج</div>;
                                   case 'مجاز': return <div className="w-5 h-5 mx-auto bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md flex items-center justify-center font-black text-[10px] shadow-sm dark:shadow-none" title="مجاز">م</div>;
                                   case 'نصف يوم': return <div className="w-5 h-5 mx-auto bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-md flex items-center justify-center font-black text-[9px] shadow-sm dark:shadow-none" title="نصف يوم">½</div>;
                                   default: return <div className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600 flex items-center justify-center font-black text-[10px]" title="لم يسجل">-</div>;
                                 }
                               };

                               return (
                                 <td key={d} className={`py-1 px-0.5 border-l border-slate-100 dark:border-white/5 text-center transition-colors cursor-default ${isFriday ? 'bg-rose-50 dark:bg-rose-900/10' : ''}`}>
                                   {getStatusIcon(record?.status)}
                                 </td>
                               );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div className={`overflow-x-auto w-full custom-island-scroll rounded-[2.5rem] border shadow-sm dark:shadow-lg pb-4 animate-in fade-in duration-300 transition-all ${isZenMode ? 'bg-transparent border-slate-200 dark:border-white/5' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10'}`}>
              <div className={`p-6 border-b flex flex-col md:flex-row items-center justify-between gap-4 rounded-t-[2.5rem] transition-colors ${isZenMode ? 'bg-slate-50/50 dark:bg-black/50 border-slate-200 dark:border-white/5' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10'}`}>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <ReceiptText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 transition-colors"/>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white transition-colors">التفاصيل المالية وصافي الراتب المستحق</h3>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button onClick={() => setShowPdfSettings(!showPdfSettings)} className={`p-2.5 rounded-xl transition-all shadow-sm border outline-none cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-emerald-600 text-white border-emerald-700 dark:border-emerald-500' : 'bg-white dark:bg-[#050505] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}><Settings className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.preventDefault(); handleExportPDF('payroll'); }} disabled={isExportingPDF || payrollData.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all disabled:opacity-50 outline-none cursor-pointer active:scale-95">
                    {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4"/>} طباعة PDF
                  </button>
                  <button onClick={(e) => { e.preventDefault(); handleExportExcel('payroll'); }} disabled={isExportingExcel || payrollData.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all disabled:opacity-50 outline-none cursor-pointer active:scale-95">
                    {isExportingExcel ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileSpreadsheet className="w-4 h-4"/>} إكسل VIP
                  </button>
                </div>
              </div>
              
              {showPdfSettings && !isZenMode && (
                <div className="bg-slate-50 dark:bg-[#050505] p-5 m-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner flex flex-col gap-5 animate-in slide-in-from-top-2 relative transition-colors">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
                    <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2 transition-colors"><Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/> إعدادات طباعة الكشف (PDF)</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors bg-white dark:bg-[#121214] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95"><RefreshCw className="w-3 h-3" /> استعادة الافتراضيات</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-2"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 transition-colors">حجم الورق</label><select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-3 py-2 rounded-xl focus:border-emerald-400 dark:focus:border-emerald-500/50 outline-none transition-colors shadow-sm dark:shadow-inner cursor-pointer appearance-none"><option value="A4" className="bg-white dark:bg-[#050505]">A4</option><option value="A3" className="bg-white dark:bg-[#050505]">A3</option></select></div>
                    <div className="flex flex-col gap-2"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 transition-colors">الهوامش</label><select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-3 py-2 rounded-xl focus:border-emerald-400 dark:focus:border-emerald-500/50 outline-none transition-colors shadow-sm dark:shadow-inner cursor-pointer appearance-none"><option value="0mm" className="bg-white dark:bg-[#050505]">بدون</option><option value="5mm" className="bg-white dark:bg-[#050505]">5mm</option><option value="10mm" className="bg-white dark:bg-[#050505]">10mm</option></select></div>
                    <div className="flex flex-col gap-2 col-span-2"><div className="flex justify-between"><label className="text-[11px] font-black text-slate-500 dark:text-slate-400 transition-colors">الزووم ({pdfSettings.zoom}%)</label></div><input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-emerald-600 h-2 bg-slate-200 dark:bg-[#121214] border border-transparent dark:border-white/5 rounded-lg outline-none cursor-pointer" /></div>
                  </div>
                </div>
              )}

              <table className="w-full text-right border-collapse min-w-[1400px]">
                <thead className="bg-slate-50 dark:bg-[#050505] text-slate-500 dark:text-slate-400 font-black text-[11px] uppercase tracking-wider transition-colors">
                  <tr>
                    <th className="py-4 px-6 border-b border-slate-200 dark:border-white/10">معلومات الموظف</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">الراتب الاسمي</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">أيام الحضور</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center text-sky-600 dark:text-sky-400">أيام الإجازة (براتب)</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center text-rose-600 dark:text-rose-400">أيام الغياب</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center text-rose-600 dark:text-rose-500">استقطاع الغياب</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400">المستحق للدوام</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center text-sky-600 dark:text-sky-400">مكافآت وإضافي</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center text-rose-600 dark:text-rose-500">عقوبات وخصم</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center text-amber-600 dark:text-amber-500">سلف مستردة</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400">الصافي النهائي</th>
                    <th className="py-4 px-6 border-b border-slate-200 dark:border-white/10 text-center">وصل الراتب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 transition-colors">
                  {isLoading ? (
                    <tr><td colSpan={12} className="py-20 text-center"><Loader2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 animate-spin mx-auto"/></td></tr>
                  ) : payrollData.length === 0 ? (
                    <tr><td colSpan={12} className="py-20 text-center text-slate-500 font-bold">لا توجد بيانات تطابق بحثك</td></tr>
                  ) : (
                    payrollData.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors bg-white dark:bg-transparent">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${emp.avatar_color || 'from-slate-700 to-slate-800'} text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm dark:shadow-inner`}>
                              {getInitials(emp.full_name)}
                            </div>
                            <div>
                              <h4 className="text-[14px] font-black text-slate-800 dark:text-slate-200 transition-colors">{emp.full_name}</h4>
                              <p className="text-[11px] font-bold text-slate-500 mt-0.5 transition-colors">{emp.role} • <span className="text-indigo-600 dark:text-indigo-400">{emp.branch}</span></p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4 text-center font-bold text-slate-500 dark:text-slate-400 text-[14px] dir-ltr transition-colors">
                          {emp.salary.toLocaleString('en-US')} د.ع
                        </td>
                        
                        <td className="py-4 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400 text-[14px] transition-colors">
                          {emp.present + (emp.halfDays * 0.5)}
                        </td>

                        <td className="py-4 px-4 text-center font-bold text-sky-600 dark:text-sky-400 text-[14px] transition-colors">
                          {emp.paidLeave}
                        </td>

                        <td className="py-4 px-4 text-center font-bold text-rose-600 dark:text-rose-400 text-[14px] transition-colors">
                          {emp.unpaidDays}
                        </td>

                        <td className="py-4 px-4 text-center font-bold text-rose-600 dark:text-rose-500 text-[14px] dir-ltr transition-colors">
                          {emp.absenceDeductionAmount > 0 ? `- ${emp.absenceDeductionAmount.toLocaleString('en-US')} د.ع` : '-'}
                        </td>
                        
                        <td className="py-4 px-4 text-center bg-emerald-50 dark:bg-emerald-500/5 border-x border-slate-100 dark:border-white/5 font-black text-emerald-700 dark:text-emerald-400 text-[14px] dir-ltr shadow-sm dark:shadow-inner transition-colors">
                          {emp.earnedSalary.toLocaleString('en-US')} د.ع
                        </td>
                        
                        <td className="py-4 px-4 text-center font-black text-sky-600 dark:text-sky-400 text-[14px] dir-ltr transition-colors">
                          {emp.bonus > 0 ? `+ ${emp.bonus.toLocaleString('en-US')} د.ع` : '-'}
                        </td>
                        
                        <td className="py-4 px-4 text-center font-black text-rose-600 dark:text-rose-500 text-[14px] dir-ltr transition-colors">
                          {emp.financialDeductions > 0 ? `- ${emp.financialDeductions.toLocaleString('en-US')} د.ع` : '-'}
                        </td>

                        <td className="py-4 px-4 text-center font-black text-amber-600 dark:text-amber-500 text-[14px] dir-ltr transition-colors">
                          {emp.advance > 0 ? `- ${emp.advance.toLocaleString('en-US')} د.ع` : '-'}
                        </td>

                        <td className="py-4 px-4 text-center bg-indigo-50 dark:bg-indigo-500/10 font-black text-indigo-700 dark:text-indigo-400 text-[16px] dir-ltr shadow-sm dark:shadow-inner transition-colors">
                          {emp.netSalary.toLocaleString('en-US')} د.ع
                        </td>

                        <td className="py-4 px-6 text-center">
                          <button 
                            onClick={() => printPayslip(emp)}
                            className="p-2.5 text-slate-400 hover:text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/20 outline-none cursor-pointer active:scale-95"
                            title="طباعة كشف الراتب (Payslip)"
                          >
                            <Printer className="w-5 h-5"/>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* 💡 التقويم المؤسساتي المنبثق (Modal) 💡 */}
        {datePickerConfig.isOpen && !isZenMode && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 no-print transition-colors">
            <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] shadow-2xl dark:shadow-[0_0_50px_rgba(20,184,166,0.15)] animate-in zoom-in-95 duration-300 transition-colors">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-white/5 pb-5 shrink-0 transition-colors">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-teal-600 dark:text-teal-400 transition-colors outline-none cursor-pointer active:scale-95">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'month' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-800 dark:text-white hover:text-teal-600 dark:hover:text-teal-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'year' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-800 dark:text-white hover:text-teal-600 dark:hover:text-teal-300'}`}
                   >
                     {datePickerConfig.viewDate.format('YYYY')}
                   </button>
                </div>

                <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-teal-600 dark:text-teal-400 transition-colors outline-none cursor-pointer active:scale-95">
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
                        onClick={() => {
                          const newDate = datePickerConfig.viewDate.year(year);
                          if (datePickerConfig.target === 'selectMonth') {
                            handleDateSelection(newDate.format('YYYY-MM-DD'));
                          } else {
                            setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'month'}));
                          }
                        }}
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none cursor-pointer ${isSelected ? 'bg-teal-600 dark:bg-teal-500 text-white shadow-md dark:shadow-lg dark:shadow-teal-500/30' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner'}`}
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
                          if (datePickerConfig.target === 'selectMonth') {
                            handleDateSelection(newDate.format('YYYY-MM-DD'));
                          } else {
                            setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'date'}));
                          }
                        }}
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 flex flex-col items-center gap-1.5 outline-none cursor-pointer ${isSelected ? 'bg-teal-600 dark:bg-teal-500 text-white shadow-md dark:shadow-lg dark:shadow-teal-500/30' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner'}`}
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
                      <div key={d} className="text-center text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: datePickerConfig.viewDate.startOf('month').day() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: datePickerConfig.viewDate.daysInMonth() }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = datePickerConfig.viewDate.date(dayNum).format('YYYY-MM-DD');
                      
                      let selectedDateStr = '';
                      if (datePickerConfig.target === 'startDate') selectedDateStr = startDate;
                      else if (datePickerConfig.target === 'endDate') selectedDateStr = endDate;

                      const isSelected = dateStr === selectedDateStr;
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDateSelection(dateStr)}
                          className={`
                            aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num transition-all active:scale-95 outline-none cursor-pointer
                            ${isSelected ? 'bg-teal-600 dark:bg-teal-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(20,184,166,0.4)]' :
                              isToday ? 'text-teal-600 border border-teal-300 bg-teal-50 dark:text-teal-400 dark:border-teal-500/30 dark:bg-teal-500/10' :
                              'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white border border-transparent'}
                          `}
                        >
                          {dayNum}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <button onClick={() => setDatePickerConfig(p => ({...p, isOpen: false}))} className="w-full mt-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/5 dark:hover:bg-rose-500/20 dark:text-slate-400 dark:hover:text-rose-400 rounded-2xl font-black text-[15px] transition-colors border border-transparent outline-none cursor-pointer active:scale-95 shrink-0">
                إلغاء النافذة
              </button>
            </div>
          </div>
        )}

        {/* 🟢 زر إنهاء وضع التركيز 🟢 */}
        {isZenMode && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-bottom-10 fade-in duration-500 no-print">
            <button 
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-6 py-3.5 rounded-full font-black text-sm shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer"
            >
              <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-island-scroll::-webkit-scrollbar { width: 5px; height: 5px;}
        .custom-island-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-island-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-island-scroll::-webkit-scrollbar-thumb { background: #334155; }
        .custom-island-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        html.dark .custom-island-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }

        .en-num { font-family: system-ui, -apple-system, sans-serif; }
      `}} />
    </div>
  );
}