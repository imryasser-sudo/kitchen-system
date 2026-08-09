"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; // 💡 استيراد مكتبة الثيم 💡
import { 
  Loader2, AlertCircle, Filter, Calendar, Store, Package, 
  Printer, FileSpreadsheet, Building2, RotateCcw, ChevronDown, 
  CalendarDays, ListChecks, Layers, Settings, RefreshCw, Maximize, 
  MoveHorizontal, CheckCircle2, Scissors, BadgeCheck, ChevronLeft, 
  ChevronRight, Eye, EyeOff, LayoutGrid
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useReactToPrint } from 'react-to-print';
import Link from 'next/link';

dayjs.locale('ar');

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const roundNumber = (num: number) => Math.round(num * 1000) / 1000;

// 💡 دالة تحويل لون الـ Hex إلى لون شفاف Rgba علمود الوهج والإطارات 💡
const hexToRgba = (hex: string, alpha: number = 1) => {
  let r = 6, g = 182, b = 212; // لون افتراضي (نيلي)
  if (hex && hex.startsWith('#')) {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
    if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    }
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getCleanBranchName = (fullName: string, agencyName: string) => {
  if (!fullName) return 'غير محدد';
  let clean = fullName;
  if (clean.includes('-')) clean = clean.split('-').pop()?.trim() || clean;
  if (agencyName) {
    const agencyWords = agencyName.split(/[-\s]+/).filter(w => w.length > 2);
    agencyWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      clean = clean.replace(regex, '').trim();
    });
  }
  return clean.replace(/^[-\s]+/, '').trim() || fullName;
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

const defaultPdfSettings = {
  paperSize: 'A3', margin: '5mm', bottomMargin: 25, footerOffset: 15, zoom: 85, shiftX: 0, autoFit: true,
  c_seq: 4, c_name: 25, c_unit: 8, c_branch: 8, c_total: 10
};

export default function BranchSummaryMatrixPage() {
  const { isDark } = useTheme(); // 💡 ربط الثيم بالصفحة 💡
  
  const [orders, setOrders] = useState<any[]>([]);
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  const [agenciesColorMap, setAgenciesColorMap] = useState<Record<string, string>>({});
  const [agenciesLogoMap, setAgenciesLogoMap] = useState<Record<string, string | null>>({});
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  
  const [activeDateRange, setActiveDateRange] = useState<string>('month');
  const [branchFilter, setBranchFilter] = useState<string>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [activeAgencyTab, setActiveAgencyTab] = useState<string>('الكل');

  const [isZenMode, setIsZenMode] = useState(false);

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, 
    target: 'start' | 'end' | 'month' | null, 
    viewDate: dayjs.Dayjs, 
    mode: 'date' | 'month' | 'year'
  }>({
    isOpen: false,
    target: null,
    viewDate: dayjs(),
    mode: 'date'
  });
  
  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('matrixPdfSettings_v3_cyan');
    if (savedSettings) {
      try { setPdfSettings(JSON.parse(savedSettings)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isMounted) localStorage.setItem('matrixPdfSettings_v3_cyan', JSON.stringify(pdfSettings));
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => {
    setPdfSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetPdfSettings = () => { setPdfSettings(defaultPdfSettings); };

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const { data: agenciesData, error: agenciesError } = await supabase.from('agencies').select('*');
      if (agenciesError) throw agenciesError;
      
      const agMap: Record<string, string> = {};
      const agColorMap: Record<string, string> = {};
      const agLogoMap: Record<string, string | null> = {};
      
      agenciesData?.forEach(ag => { 
        agMap[ag.id] = ag.name; 
        agColorMap[ag.id] = ag.color || '#06b6d4'; 
        agLogoMap[ag.id] = ag.logo_url || null; 
      });
      
      setAgenciesMap(agMap);
      setAgenciesColorMap(agColorMap);
      setAgenciesLogoMap(agLogoMap);

      const { data: branchesData, error: branchesError } = await supabase.from('branches').select('id, name, agency_id').order('name');
      if (branchesError) throw branchesError;
      setAllBranches(branchesData || []);

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`id, branch_id, status, created_at, branches (id, name, agency_id), order_details (item_id, quantity, items (id, name, primary_unit, main_unit, agency_id, sequence, categories(name, color, sequence)))`)
        .limit(100000)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      const validOrders = (ordersData || []).filter(order => order.status !== 'pending' && order.status !== 'rejected');
      setOrders(validOrders);
    } catch (err: any) {
      setDbError(err?.message || "يرجى التأكد من اتصال قاعدة البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const uniqueAgenciesList = useMemo(() => {
    const agencies = new Map<string, string>();
    allBranches.forEach(b => {
      const agName = b.agency_id ? (agenciesMap[b.agency_id] || '') : '';
      const agColor = b.agency_id ? (agenciesColorMap[b.agency_id] || '#06b6d4') : '#06b6d4';
      if (agName && !agencies.has(agName)) agencies.set(agName, agColor);
    });
    return Array.from(agencies.entries())
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allBranches, agenciesMap, agenciesColorMap]);

  const uniqueBranchesDropdown = useMemo(() => {
    return allBranches.map(b => ({ id: b.id, name: b.name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allBranches]);

  const quickCategoriesTabs = useMemo(() => {
    const uniqueItemsMap = new Map<string, any>();
    
    orders.forEach(order => {
      order.order_details?.forEach((detail: any) => {
        const agId = detail.items?.agency_id;
        const agencyName = agId ? (agenciesMap[agId] || 'غير محدد') : 'غير محدد';
        
        if (activeAgencyTab === 'الكل' || agencyName === activeAgencyTab) {
          const catName = detail.items?.categories?.name || 'غير محدد';
          const catColor = detail.items?.categories?.color || '#10b981';
          const iName = detail.items?.name || 'غير محدد';
          
          const compKey = `${agencyName}-${catName}-${iName}`;
          if (!uniqueItemsMap.has(compKey)) {
            uniqueItemsMap.set(compKey, { categoryName: catName, categoryColor: catColor });
          }
        }
      });
    });

    const counts: Record<string, { count: number, color: string }> = {};
    Array.from(uniqueItemsMap.values()).forEach(item => {
      if (!counts[item.categoryName]) {
        counts[item.categoryName] = { count: 0, color: item.categoryColor };
      }
      counts[item.categoryName].count += 1;
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, count: data.count, color: data.color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, activeAgencyTab, agenciesMap]);

  const { displayBranches, items, branchTotals, grandTotal } = useMemo(() => {
    const finalBranchesMap = new Map();
    const itemsMap = new Map();

    allBranches.forEach(b => {
      const agName = b.agency_id ? (agenciesMap[b.agency_id] || '') : '';
      const agColor = b.agency_id ? (agenciesColorMap[b.agency_id] || '#06b6d4') : '#06b6d4';
      const agLogo = b.agency_id ? (agenciesLogoMap[b.agency_id] || null) : null;
      
      finalBranchesMap.set(b.id, { id: b.id, name: b.name, agencyName: agName, agencyColor: agColor, agencyLogo: agLogo, cleanName: getCleanBranchName(b.name, agName) });
    });

    let displayBranchesArray = Array.from(finalBranchesMap.values());
    if (branchFilter !== 'الكل') displayBranchesArray = displayBranchesArray.filter(b => b.id === branchFilter);
    if (activeAgencyTab !== 'الكل') displayBranchesArray = displayBranchesArray.filter(b => b.agencyName === activeAgencyTab);

    displayBranchesArray.sort((a, b) => {
      if (a.agencyName === b.agencyName) return a.cleanName.localeCompare(b.cleanName);
      return a.agencyName.localeCompare(b.agencyName);
    });

    orders.forEach(order => {
      const orderDate = dayjs(order.created_at).format('YYYY-MM-DD');
      let isDateValid = true;
      if (startDate && endDate) isDateValid = orderDate >= startDate && orderDate <= endDate;
      else if (startDate) isDateValid = orderDate >= startDate;
      else if (endDate) isDateValid = orderDate <= endDate;
      if (!isDateValid) return;

      const bId = order.branch_id;
      if (!finalBranchesMap.has(bId)) return;
      if (branchFilter !== 'الكل' && branchFilter !== bId) return;

      const branchAgencyName = finalBranchesMap.get(bId).agencyName;
      if (activeAgencyTab !== 'الكل' && branchAgencyName !== activeAgencyTab) return;

      order.order_details?.forEach((detail: any) => {
        const iName = detail.items?.name || 'غير محدد';
        const agId = detail.items?.agency_id;
        const agencyName = agId ? (agenciesMap[agId] || 'غير محدد') : 'غير محدد';
        const agencyColor = agId ? (agenciesColorMap[agId] || '#06b6d4') : '#06b6d4';
        
        if (activeAgencyTab !== 'الكل' && agencyName !== activeAgencyTab) return;

        const dbPrim = detail.items?.primary_unit;
        const dbMain = detail.items?.main_unit;
        const catName = detail.items?.categories?.name || 'غير محدد';
        const catColor = detail.items?.categories?.color || '#cbd5e1';
        
        if (categoryFilter !== 'الكل' && catName !== categoryFilter) return;

        const catSequence = detail.items?.categories?.sequence ?? 999;
        const itemSequence = detail.items?.sequence ?? 999;
        const calculatedMainUnit = dbMain && dbMain !== '-' && dbMain !== 'null' ? dbMain : (dbPrim || 'لم تحدد');
        const qty = parseFloat(detail.quantity) || 0;

        const uniqueItemKey = `${agencyName}-${catName}-${iName}`;

        if (!itemsMap.has(uniqueItemKey)) {
          itemsMap.set(uniqueItemKey, { id: uniqueItemKey, name: iName, agencyName: agencyName, agencyColor: agencyColor, categoryName: catName, categoryColor: catColor, categorySequence: catSequence, itemSequence: itemSequence, mainUnit: calculatedMainUnit, branchesData: {}, rowTotal: 0 });
        }

        const itemObj = itemsMap.get(uniqueItemKey);
        itemObj.branchesData[bId] = roundNumber((itemObj.branchesData[bId] || 0) + qty);
        itemObj.rowTotal = roundNumber(itemObj.rowTotal + qty);
      });
    });

    const sortedItems = Array.from(itemsMap.values()).sort((a, b) => {
      if (a.agencyName !== b.agencyName) return a.agencyName.localeCompare(b.agencyName);
      if (a.categorySequence !== b.categorySequence) return a.categorySequence - b.categorySequence;
      if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
      if (a.itemSequence !== b.itemSequence) return a.itemSequence - b.itemSequence;
      return a.name.localeCompare(b.name);
    });

    const bTotals: Record<string, number> = {};
    let gTotal = 0;

    displayBranchesArray.forEach((b: any) => {
      bTotals[b.id] = roundNumber(sortedItems.reduce((sum: number, item: any) => sum + (item.branchesData[b.id] || 0), 0));
    });
    gTotal = roundNumber(sortedItems.reduce((sum: number, item: any) => sum + item.rowTotal, 0));

    return { displayBranches: displayBranchesArray, items: sortedItems, branchTotals: bTotals, grandTotal: gTotal };
  }, [orders, allBranches, startDate, endDate, branchFilter, categoryFilter, activeAgencyTab, agenciesMap, agenciesColorMap, agenciesLogoMap]);

  const shiftMonth = (direction: number) => {
    const refDate = startDate ? dayjs(startDate) : dayjs();
    const newMonth = refDate.add(direction, 'month');
    
    setStartDate(newMonth.startOf('month').format('YYYY-MM-DD'));
    
    if (newMonth.isSame(dayjs(), 'month')) {
      setEndDate(dayjs().format('YYYY-MM-DD'));
    } else {
      setEndDate(newMonth.endOf('month').format('YYYY-MM-DD'));
    }
    setActiveDateRange('custom');
  };

  const applyDateRange = (type: 'today' | '7days' | '14days' | '21days' | '28days' | 'month' | 'all') => {
    setActiveDateRange(type);
    setSelectedMonth(''); 
    const today = dayjs().format('YYYY-MM-DD');

    if (type === 'today') {
      setStartDate(today); setEndDate(today);
    } else if (type === '7days') {
      setStartDate(dayjs().subtract(7, 'day').format('YYYY-MM-DD')); setEndDate(today);
    } else if (type === '14days') {
      setStartDate(dayjs().subtract(14, 'day').format('YYYY-MM-DD')); setEndDate(today);
    } else if (type === '21days') {
      setStartDate(dayjs().subtract(21, 'day').format('YYYY-MM-DD')); setEndDate(today);
    } else if (type === '28days') {
      setStartDate(dayjs().subtract(28, 'day').format('YYYY-MM-DD')); setEndDate(today);
    } else if (type === 'month') {
      setStartDate(dayjs().startOf('month').format('YYYY-MM-DD')); setEndDate(today);
    } else if (type === 'all') {
      setStartDate(''); setEndDate('');
    }
  };

  const clearFilters = () => {
    applyDateRange('month');
    setBranchFilter('الكل');
    setCategoryFilter('الكل');
    setActiveAgencyTab('الكل');
    setSelectedMonth('');
  };

  const openDatePicker = (target: 'start' | 'end' | 'month') => {
    const initialDate = target === 'start' ? (startDate || dayjs().format('YYYY-MM-DD')) : target === 'end' ? (endDate || dayjs().format('YYYY-MM-DD')) : dayjs().format('YYYY-MM-DD');
    setDatePickerConfig({ isOpen: true, viewDate: dayjs(initialDate), mode: target === 'month' ? 'month' : 'date', target });
  };

  const handleDateSelection = (dateStr: string) => {
    if (datePickerConfig.target === 'start') {
      setStartDate(dateStr);
      if (endDate && dateStr > endDate) setEndDate(dateStr);
    } else if (datePickerConfig.target === 'end') {
      setEndDate(dateStr);
      if (startDate && dateStr < startDate) setStartDate(dateStr);
    }
    setActiveDateRange('custom');
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const handleMonthChangeCustom = (val: string) => {
    setSelectedMonth(val);
    setActiveDateRange('custom');
    if (val) {
      const start = dayjs(val).startOf('month').format('YYYY-MM-DD');
      const end = dayjs(val).endOf('month').format('YYYY-MM-DD');
      setStartDate(start);
      setEndDate(end);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const getDateRangeText = () => {
    if (startDate && endDate) {
      if (startDate === endDate) return `ليوم ${startDate}`;
      return `من ${startDate} إلى ${endDate}`;
    }
    if (startDate) return `من ${startDate} ولغاية اليوم`;
    if (endDate) return `لغاية ${endDate}`;
    return 'كل التواريخ (شامل)';
  };

  const getBranchFilterName = () => {
    if (branchFilter === 'الكل') return 'الكل';
    return uniqueBranchesDropdown.find(b => b.id === branchFilter)?.name || 'محدد';
  };

  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handlePrint = useReactToPrint({
    contentRef: printRef, 
    documentTitle: `ملخص_التجهيز_المجمع_${dayjs().format('YYYYMMDD')}`,
    print: async (printIframe) => {
      if (isMobile) {
        const htmlContent = printIframe.contentDocument?.documentElement.innerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow && htmlContent) {
          printWindow.document.open();
          printWindow.document.write("<!DOCTYPE html><html dir='rtl' lang='ar'>" + htmlContent + "</html>");
          printWindow.document.close();
          setTimeout(() => { printWindow.focus(); printWindow.print(); }, 800);
        } else {
          alert("للطباعة من الموبايل: يرجى السماح بـ (Pop-ups) من إعدادات المتصفح.");
          printIframe.contentWindow?.focus(); printIframe.contentWindow?.print();
        }
      } else {
        printIframe.contentWindow?.focus(); printIframe.contentWindow?.print();
      }
    },
    pageStyle: `
      @import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;700;900&display=swap');
      @page { 
        ${isMobile ? '' : `size: ${pdfSettings.paperSize} landscape;`}
        margin-top: ${pdfSettings.margin}; margin-left: ${pdfSettings.margin}; margin-right: ${pdfSettings.margin};
        margin-bottom: ${pdfSettings.bottomMargin}mm !important; 
      }
      @media print {
        body, .print-container, .print-table { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; color: black !important; }
        * { text-shadow: none !important; }
        .no-print { display: none !important; }
        .print-only { display: flex !important; }
        .print-text-black { color: #000 !important; }
        tr, td, th { page-break-inside: avoid !important; }
        thead { display: table-header-group !important; }
        .print-container { width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; border: none !important; box-shadow: none !important; padding-bottom: 20px !important; margin-right: ${pdfSettings.shiftX}mm !important; }
        .custom-scrollbar { overflow: visible !important; overflow-x: visible !important; border: none !important; box-shadow: none !important; background: transparent !important; display: block !important; }
        .print-table { width: 100% !important; min-width: 0 !important; max-width: none !important; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'} !important; margin-bottom: 40px !important; ${isMobile ? '' : `zoom: ${pdfSettings.zoom / 100} !important;`} border-collapse: collapse !important; border: 3px solid #000000 !important; }
        .print-table th, .print-table td { font-size: ${isMobile ? '8px' : '10px'} !important; padding: 4px 2px !important; min-width: 0 !important; word-wrap: break-word !important; border: 1px solid #000000 !important; background-color: white !important; color: #000 !important; }
        .print-table thead th { background-color: #f1f5f9 !important; color: #0f172a !important; border: 2px solid #000000 !important; }
        .agency-row td { background-color: #cbd5e1 !important; color: #0f172a !important; border: 2px solid #000000 !important; text-align: center !important; font-weight: 900 !important; font-size: 14px !important; }
        .category-row td { background-color: #f8fafc !important; color: #0f172a !important; border: 2px solid #000000 !important; text-align: center !important; font-style: italic !important; }
        .col-total { background-color: #e2e8f0 !important; color: #000000 !important; border: 2px solid #000000 !important; font-weight: 900 !important; }
        ${!pdfSettings.autoFit ? `
          .col-seq { width: ${pdfSettings.c_seq}% !important; }
          .col-name { width: ${pdfSettings.c_name}% !important; white-space: normal !important; }
          .col-unit { width: ${pdfSettings.c_unit}% !important; }
          .col-branch { width: ${pdfSettings.c_branch}% !important; }
          .col-total { width: ${pdfSettings.c_total}% !important; }
        ` : `
          .col-name { white-space: normal !important; min-width: 120px !important; }
          .col-branch { white-space: normal !important; word-break: break-all !important; font-size: 9px !important; }
        `}
      }
    `
  });

  const handleExportExcel = async () => {
    if (items.length === 0) return alert("لا توجد بيانات لتصديرها.");
    const targetDate = startDate ? dayjs(startDate) : dayjs();
    const agencyNameForFile = activeAgencyTab !== 'الكل' ? activeAgencyTab : 'كل_الوكالات';
    let exportName = `${agencyNameForFile}_تجهيز_${targetDate.format('MM_YYYY')}`;
    if (categoryFilter !== 'الكل') exportName += `_${categoryFilter}`;
    exportName = exportName.replace(/\s+/g, '_') + '.xlsx';

    const agencyTitle = activeAgencyTab !== 'الكل' ? `وكالة (${activeAgencyTab})` : 'الكلي (كل الوكالات)';
    const totalCols = displayBranches.length + 4;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('التجهيز المجمع', { views: [{ rightToLeft: true }] });

    worksheet.mergeCells(`A1:${getColLetter(totalCols)}2`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `📦 أوامر التحميل والتجهيز المجمع | ${agencyTitle} 🚀`;
    titleCell.font = { name: 'Cairo', size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; 
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = { bottom: { style: 'thick', color: { argb: 'FF06B6D4' } }, top: { style: 'thick', color: { argb: 'FF000000' } }, left: { style: 'thick', color: { argb: 'FF000000' } }, right: { style: 'thick', color: { argb: 'FF000000' } } };

    worksheet.mergeCells(`A3:${getColLetter(totalCols)}3`);
    const metaCell = worksheet.getCell('A3');
    metaCell.value = `📅 تاريخ الإصدار: ${dayjs().format('YYYY-MM-DD')}  |  ⏰ الوقت: ${dayjs().format('hh:mm A')}  |  👤 المصدر: نظام الإدارة المركزي (ERP)`;
    metaCell.font = { name: 'Cairo', size: 11, color: { argb: 'FF475569' }, bold: true };
    metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(3).height = 25;
    worksheet.addRow([]); 

    const filterRow1 = worksheet.addRow(['⏳ النطاق الزمني:', getDateRangeText(), '📍 الفرع المحدد:', getBranchFilterName()]);
    worksheet.mergeCells('B5:C5');
    if (totalCols > 4) worksheet.mergeCells(`E5:${getColLetter(totalCols)}5`);
    filterRow1.eachCell((cell, colNum) => {
      if ([1, 2, 4, 5].includes(colNum)) {
        cell.font = { name: 'Cairo', bold: true, color: { argb: colNum===1 || colNum===4 ? 'FFFFFFFF' : 'FF0F172A' }, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNum===1 || colNum===4 ? 'FF06B6D4' : 'FFE0F2FE' } };
        cell.border = { top: { style: 'thin', color: {argb: 'FF475569'} }, bottom: { style: 'thin', color: {argb: 'FF475569'} }, left: { style: 'thin', color: {argb: 'FF475569'} }, right: { style: 'thin', color: {argb: 'FF475569'} } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
    filterRow1.height = 35;

    if (categoryFilter !== 'الكل') {
      const catRow = worksheet.addRow(['📁 القسم المحدد:', categoryFilter, '', '']);
      worksheet.mergeCells(`B${catRow.number}:C${catRow.number}`);
      if (totalCols > 4) worksheet.mergeCells(`E${catRow.number}:${getColLetter(totalCols)}${catRow.number}`);
      catRow.eachCell((cell, colNum) => {
        if ([1, 2].includes(colNum)) {
          cell.font = { name: 'Cairo', bold: true, color: { argb: colNum===1 ? 'FFFFFFFF' : 'FF0F172A' }, size: 12 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNum===1 ? 'FF1E40AF' : 'FFDBEAFE' } };
          cell.border = { top: { style: 'thin', color: {argb: 'FF475569'} }, bottom: { style: 'thin', color: {argb: 'FF475569'} }, left: { style: 'thin', color: {argb: 'FF475569'} }, right: { style: 'thin', color: {argb: 'FF475569'} } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
      catRow.height = 35;
    }
    worksheet.addRow([]); 

    const headerData = ['ت', '🏷️ المادة / الصنف المطلوب', '⚖️ الوحدة'];
    displayBranches.forEach((b: any) => { headerData.push(`🏪 ${b.cleanName}`); });
    headerData.push('📊 المجموع الكلي');

    const hRow = worksheet.addRow(headerData);
    hRow.height = 45; 
    hRow.eachCell((cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colNum === totalCols ? 'FF1D4ED8' : 'FF0F172A' } }; 
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12, name: 'Cairo' };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thick', color:{argb: 'FF000000'} }, bottom: { style: 'thick', color:{argb: 'FF000000'} }, left: { style: 'thin', color:{argb: 'FF64748B'} }, right: { style: 'thin', color:{argb: 'FF64748B'} } };
    });

    let currentAgencyExcel = '';
    let currentCategoryExcel = '';

    items.forEach((item, idx) => {
      const isNewAgency = activeAgencyTab === 'الكل' && item.agencyName !== currentAgencyExcel;
      const isNewCategory = isNewAgency || item.categoryName !== currentCategoryExcel;
      currentAgencyExcel = item.agencyName; currentCategoryExcel = item.categoryName;

      if (isNewAgency) {
        const rAg = worksheet.addRow([`🏢 وكالة: ${item.agencyName}`]);
        worksheet.mergeCells(`A${rAg.number}:${getColLetter(totalCols)}${rAg.number}`);
        rAg.getCell(1).font = { name: 'Cairo', bold: true, color: { argb: 'FFFFFFFF' }, size: 15 };
        rAg.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        rAg.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        rAg.getCell(1).border = { top: { style: 'medium', color: { argb: 'FF000000' } }, bottom: { style: 'medium', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } };
        rAg.height = 35;
      }
      if (isNewCategory) {
        const rCat = worksheet.addRow([`📁 القسم: ${item.categoryName}`]);
        worksheet.mergeCells(`A${rCat.number}:${getColLetter(totalCols)}${rCat.number}`);
        rCat.getCell(1).font = { name: 'Cairo', bold: true, color: { argb: 'FF1E40AF' }, size: 14 };
        rCat.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        rCat.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        rCat.getCell(1).border = { top: { style: 'thin', color: { argb: 'FF94A3B8' } }, bottom: { style: 'thin', color: { argb: 'FF94A3B8' } }, left: { style: 'thin', color: { argb: 'FF94A3B8' } }, right: { style: 'thin', color: { argb: 'FF94A3B8' } } };
        rCat.height = 30;
      }

      const rowData: any[] = [idx + 1, item.name, item.mainUnit];
      displayBranches.forEach((b: any) => { rowData.push(item.branchesData[b.id] || '-'); });
      rowData.push(item.rowTotal);

      const dataRow = worksheet.addRow(rowData);
      dataRow.height = 28; 
      const isAltRow = idx % 2 !== 0;

      dataRow.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin', color: {argb: 'FF475569'} }, left: { style: 'thin', color: {argb: 'FF475569'} }, bottom: { style: 'thin', color: {argb: 'FF475569'} }, right: { style: 'thin', color: {argb: 'FF475569'} } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAltRow ? 'FFF8FAFC' : 'FFFFFFFF' } };

        if (colNumber === 2) {
          cell.font = { name: 'Cairo', bold: true, color: { argb: 'FF0F172A' }, size: 12 };
          cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
        } else if (colNumber === 3) {
           cell.font = { name: 'Cairo', bold: true, color: { argb: 'FF059669' }, size: 11 }; 
        } else if (colNumber > 3 && colNumber < totalCols) {
          if(cell.value !== '-') { cell.font = { name: 'Arial', bold: true, color: { argb: 'FF1E293B' }, size: 13 }; } 
          else { cell.font = { name: 'Arial', color: { argb: 'FFCBD5E1' }, size: 14 }; }
        } else if (colNumber === totalCols) {
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 15 }; 
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }; 
          cell.border = { top: { style: 'thin', color: {argb: 'FF1E3A8A'} }, bottom: { style: 'thin', color: {argb: 'FF1E3A8A'} }, left: { style: 'medium', color: {argb: 'FF1E3A8A'} }, right: { style: 'medium', color: {argb: 'FF1E3A8A'} } }; 
        }
      });
    });

    worksheet.addRow([]); worksheet.addRow([]);
    
    const sigRow1 = worksheet.addRow(['', '', '', 'توقيع المستلم (أمين المخزن)', '', '', '', 'مصادقة الإدارة العامة (الاعتماد)']);
    sigRow1.height = 25;
    sigRow1.eachCell(cell => { cell.font = { name: 'Cairo', bold: true, size: 12, color: { argb: 'FF475569' } }; cell.alignment = { horizontal: 'center' }; });
    worksheet.mergeCells(`D${sigRow1.number}:E${sigRow1.number}`);
    worksheet.mergeCells(`H${sigRow1.number}:I${sigRow1.number}`);
    worksheet.addRow([]);

    const sigRow3 = worksheet.addRow(['', '', '', '-------------------------', '', '', '', 'ياسـر سعـدون']);
    sigRow3.height = 40;
    sigRow3.getCell(4).alignment = { horizontal: 'center', vertical: 'bottom' };
    const adminSigCell = sigRow3.getCell(8);
    adminSigCell.font = { name: 'Aref Ruqaa', italic: true, bold: true, size: 28, color: { argb: 'FF0C0A89' } }; 
    adminSigCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.mergeCells(`D${sigRow3.number}:E${sigRow3.number}`);
    worksheet.mergeCells(`H${sigRow3.number}:I${sigRow3.number}`);

    const sigRow4 = worksheet.addRow(['', '', '', '', '', '', '', 'ياسر سعدون (أبو العز)']);
    sigRow4.height = 25;
    sigRow4.getCell(8).font = { name: 'Cairo', bold: true, size: 13, color: { argb: 'FF0F172A' } };
    sigRow4.getCell(8).alignment = { horizontal: 'center', vertical: 'top' };
    worksheet.mergeCells(`H${sigRow4.number}:I${sigRow4.number}`);
    
    const sigRow5 = worksheet.addRow(['', '', '', '', '', '', '', 'المدير العام - Central Kitchen']);
    sigRow5.height = 20;
    sigRow5.getCell(8).font = { name: 'Cairo', bold: true, size: 10, color: { argb: 'FF64748B' } };
    sigRow5.getCell(8).alignment = { horizontal: 'center', vertical: 'top' };
    worksheet.mergeCells(`H${sigRow5.number}:I${sigRow5.number}`);

    worksheet.columns.forEach((col, i) => {
      if (i === 0) col.width = 6; else if (i === 1) col.width = 45; else if (i === 2) col.width = 12; else if (i === totalCols - 1) col.width = 18; else col.width = 15; 
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, exportName); 
  };

  const totalCalculatedWidth = pdfSettings.c_seq + pdfSettings.c_name + pdfSettings.c_unit + (pdfSettings.c_branch * displayBranches.length) + pdfSettings.c_total;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-all duration-300 ease-in-out ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-[130px]'}`} dir="rtl">
        
        {/* 🟢 الإشعاع الخلفي 🟢 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-100/50 dark:from-cyan-900/15 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-opacity duration-300 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🌟 الهيدر 🌟 */}
          <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 w-full bg-white/80 dark:bg-white/5 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-300 origin-top no-print ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-5 text-right w-full md:w-auto">
              
              <Link href="/hub" className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-300 dark:bg-white/10 hidden md:block"></div>

              <div className="bg-gradient-to-br from-cyan-100 to-cyan-50 dark:from-cyan-500/20 dark:to-cyan-900/40 border border-cyan-200 dark:border-cyan-500/30 w-14 h-14 rounded-[1.3rem] text-cyan-600 dark:text-cyan-400 shadow-inner flex items-center justify-center shrink-0">
                 <Store className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white mb-1 truncate tracking-tight">تجهيز الفروع (فواتير مجمعة)</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 truncate">جدول متقاطع يعرض الكميات المطلوبة لتسهيل التحميل</p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto flex-wrap md:flex-nowrap">
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-white dark:bg-[#121214] p-2 rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                
                <button 
                  onClick={() => setShowPdfSettings(!showPdfSettings)} 
                  title="إعدادات الطباعة للـ PDF"
                  className={`p-3.5 rounded-xl flex items-center justify-center transition-all outline-none border ${showPdfSettings ? 'bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/30 shadow-inner' : 'bg-slate-50 dark:bg-cyan-500/5 text-slate-500 dark:text-cyan-400/80 border-slate-200 dark:border-cyan-500/10 hover:bg-cyan-50 dark:hover:bg-cyan-500/15 hover:border-cyan-200 dark:hover:border-cyan-500/30'}`}
                >
                  <Settings className={`w-5 h-5 transition-transform duration-300 ${showPdfSettings ? 'rotate-90' : ''}`} />
                </button>

                <button onClick={handlePrint} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-500/5 text-rose-600 dark:text-rose-400/80 border border-rose-200 dark:border-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/15 hover:border-rose-300 dark:hover:border-rose-500/30 hover:text-rose-700 dark:hover:text-rose-400 px-5 py-3.5 rounded-xl font-black text-sm transition-all active:scale-95 outline-none shadow-inner">
                  <Printer className="w-5 h-5" /> طباعة تقرير PDF
                </button>
                
                <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400/80 border border-emerald-200 dark:border-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:text-emerald-700 dark:hover:text-emerald-400 px-5 py-3.5 rounded-xl font-black text-sm transition-all active:scale-95 outline-none shadow-inner">
                  <FileSpreadsheet className="w-5 h-5" /> تصدير لـ Excel
                </button>

                <button onClick={() => setIsZenMode(true)} title="وضع التركيز" className="p-3.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-[1.5rem] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-inner outline-none hidden md:block group">
                  <Eye className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              </div>

              {showPdfSettings && (
                <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative mt-2 lg:absolute right-0 top-[110%] w-[90vw] md:w-[600px] lg:w-[800px]">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                    <span className="text-sm font-black text-cyan-600 dark:text-cyan-400 flex items-center gap-2"><Settings className="w-4 h-4"/> إعدادات الطباعة المتقدمة (تُحفظ تلقائياً)</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1 transition-colors bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 outline-none">
                      <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase">حجم الورق</label>
                      <div className="relative group/select">
                        <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-cyan-200 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-100 font-bold text-sm px-4 py-2.5 rounded-[1.5rem] outline-none focus:border-cyan-400 dark:focus:border-cyan-500/50 cursor-pointer appearance-none hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shadow-inner">
                          <option value="A3" className="bg-white dark:bg-[#121214]">A3 (أفضل للأفرع)</option>
                          <option value="A4" className="bg-white dark:bg-[#121214]">A4 (ورق قياسي)</option>
                        </select>
                        <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-600/50 dark:text-cyan-500/50 pointer-events-none" />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase">الهوامش الجانبية</label>
                      <div className="relative group/select">
                        <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-cyan-200 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-100 font-bold text-sm px-4 py-2.5 rounded-[1.5rem] outline-none focus:border-cyan-400 dark:focus:border-cyan-500/50 cursor-pointer appearance-none hover:bg-slate-100 dark:hover:bg-white/5 transition-colors shadow-inner">
                          <option value="0mm" className="bg-white dark:bg-[#121214]">بدون هوامش (0mm)</option>
                          <option value="2mm" className="bg-white dark:bg-[#121214]">ضيقة جداً (2mm)</option>
                          <option value="5mm" className="bg-white dark:bg-[#121214]">ضيقة (5mm)</option>
                          <option value="10mm" className="bg-white dark:bg-[#121214]">عادية (10mm)</option>
                        </select>
                        <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-600/50 dark:text-cyan-500/50 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none ${pdfSettings.autoFit ? 'bg-cyan-100 dark:bg-cyan-500 text-cyan-700 dark:text-[#050505] border-cyan-300 dark:border-cyan-400 shadow-sm dark:shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-slate-50 dark:bg-cyan-500/5 border-slate-200 dark:border-cyan-500/20 text-slate-500 dark:text-cyan-400/70 hover:bg-slate-100 dark:hover:bg-cyan-500/10 hover:text-slate-700 dark:hover:text-cyan-300 shadow-inner'}`}>
                        <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                        <span className="bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-500/30" dir="ltr">{pdfSettings.shiftX} mm</span>
                      </div>
                      <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-cyan-600 dark:accent-cyan-400 h-2 bg-slate-100 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer mt-1 outline-none border border-slate-200 dark:border-white/10" />
                      <div className="flex justify-between text-[9px] font-bold text-slate-400"><span>إلى اليمين (-50)</span><span>إلى اليسار (+50)</span></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <hr className="flex-1 border-slate-100 dark:border-white/5" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">إعدادات الأعمدة (لليدوي فقط)</span>
                    <hr className="flex-1 border-slate-100 dark:border-white/5" />
                  </div>

                  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    
                    <div className="flex flex-col gap-2 w-full col-span-1 sm:col-span-2 lg:col-span-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                        <span className="bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-500/30">{pdfSettings.zoom}%</span>
                      </div>
                      <input type="range" min="30" max="100" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-cyan-600 dark:accent-cyan-400 h-2 bg-slate-100 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/10" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">عرض التسلسل (ت)</label>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{pdfSettings.c_seq}%</span>
                      </div>
                      <input type="range" min="1" max="10" value={pdfSettings.c_seq} onChange={e => updatePdfSetting('c_seq', Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">عرض المادة</label>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{pdfSettings.c_name}%</span>
                      </div>
                      <input type="range" min="10" max="40" value={pdfSettings.c_name} onChange={e => updatePdfSetting('c_name', Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">عرض الوحدة</label>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{pdfSettings.c_unit}%</span>
                      </div>
                      <input type="range" min="3" max="15" value={pdfSettings.c_unit} onChange={e => updatePdfSetting('c_unit', Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-cyan-600 dark:text-cyan-500 uppercase tracking-wider">عرض (عمود الفرع)</label>
                        <span className="bg-cyan-50 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-500/30">{pdfSettings.c_branch}%</span>
                      </div>
                      <input type="range" min="2" max="25" value={pdfSettings.c_branch} onChange={e => updatePdfSetting('c_branch', Number(e.target.value))} className="w-full accent-cyan-600 dark:accent-cyan-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>
                  </div>

                  {!pdfSettings.autoFit && (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                      <span>مجموع النسب المئوية للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-600 dark:text-emerald-500'}`}>{totalCalculatedWidth}%</span></span>
                      {totalCalculatedWidth > 100 ? (
                        <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيقوم بضغط الجدول إجبارياً)</span>
                      ) : (
                        <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول سيظهر بشكل مثالي في الورقة)</span>
                      )}
                    </div>
                  )}
                  {pdfSettings.autoFit && (
                    <div className="p-3 rounded-xl border bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-400 text-[11px] font-black text-center">
                      تم تفعيل "الاحتواء التلقائي" - سيقوم المتصفح بضبط وتوزيع الأعمدة أوتوماتيكياً.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 💡 صندوق الفلاتر الفخم والتقويم المخصص 💡 */}
          <div className={`bg-white dark:bg-[#121214] p-6 rounded-[2.5rem] mb-8 border border-slate-200 dark:border-white/10 flex flex-col gap-5 w-full shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 origin-top no-print ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 p-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-white/5 pb-5">
              <div className="flex items-center gap-2 font-black text-slate-500 dark:text-slate-400 text-base">
                <Filter className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> فلترة وتحديد نطاق العرض:
              </div>
              
              <div className="flex flex-col 2xl:flex-row gap-3 items-center w-full md:w-auto flex-wrap justify-end relative">
                
                {/* أزرار نطاق التاريخ (ملونة وبارزة) */}
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-x-auto hide-scrollbar max-w-full w-full lg:w-fit shrink-0">
                  <div className="px-2 text-[11px] font-black text-slate-500 flex items-center gap-1 shrink-0">
                    <CalendarDays className="w-4 h-4" /> النطاق:
                  </div>
                  {['today', '7days', '14days', '28days', 'month', 'all'].map((rangeType) => {
                    const isActive = activeDateRange === rangeType;
                    const label = rangeType === 'today' ? 'اليوم' : rangeType === '7days' ? 'آخر 7 أيام' : rangeType === '14days' ? '14 يوم' : rangeType === '28days' ? '28 يوم' : rangeType === 'month' ? 'الشهر' : 'كل الأيام';
                    return (
                      <button 
                        key={rangeType}
                        onClick={() => applyDateRange(rangeType as any)} 
                        className={`px-4 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 shrink-0 outline-none border 
                          ${isActive 
                            ? 'bg-cyan-100 dark:bg-cyan-500 text-cyan-700 dark:text-[#050505] shadow-sm dark:shadow-[0_0_10px_rgba(6,182,212,0.4)] border-cyan-300 dark:border-cyan-400 scale-[1.02]' 
                            : 'bg-white dark:bg-cyan-500/5 text-slate-500 dark:text-cyan-400/60 hover:bg-slate-100 dark:hover:bg-cyan-500/15 hover:text-slate-700 dark:hover:text-cyan-300 border-slate-200 dark:border-cyan-500/10 shadow-sm dark:shadow-inner'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* 💡 التقويم السريع بالأسهم 💡 */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-cyan-200 dark:border-cyan-500/30 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] shrink-0 w-full lg:w-auto justify-between">
                  <button onClick={() => shiftMonth(-1)} className="p-2 bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 rounded-xl text-cyan-600 dark:text-cyan-400 transition-colors border border-transparent hover:border-cyan-200 dark:hover:border-cyan-500/30 outline-none">
                    <ChevronRight className="w-4 h-4"/>
                  </button>
                  
                  <div className="flex flex-col items-center justify-center min-w-[110px] px-2 cursor-pointer group/month" onClick={() => openDatePicker('month')}>
                    <span className="text-[9px] font-black text-cyan-600/70 dark:text-cyan-500/60 uppercase tracking-widest mb-0.5 transition-colors group-hover/month:text-cyan-700 dark:group-hover/month:text-cyan-500/80">شهر التحليل</span>
                    <span className="font-black text-[13px] text-cyan-700 dark:text-cyan-300 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(34,211,238,0.4)] transition-colors group-hover/month:text-cyan-800 dark:group-hover/month:text-cyan-200">
                      {startDate ? dayjs(startDate).format('MMMM YYYY') : 'مخصص'}
                    </span>
                  </div>

                  <button onClick={() => shiftMonth(1)} disabled={dayjs(startDate).isSame(dayjs(), 'month')} className="p-2 bg-cyan-50 dark:bg-cyan-500/10 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 rounded-xl text-cyan-600 dark:text-cyan-400 transition-colors border border-transparent hover:border-cyan-200 dark:hover:border-cyan-500/30 outline-none disabled:opacity-30 disabled:pointer-events-none">
                    <ChevronLeft className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full relative">
              <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row gap-3">
                <div onClick={() => openDatePicker('start')} className="relative flex-1 h-14 bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-cyan-500/20 shadow-sm dark:shadow-inner flex items-center px-4 hover:bg-slate-50 dark:hover:bg-cyan-500/10 hover:border-cyan-300 dark:hover:border-cyan-500/40 transition-colors cursor-pointer group">
                  <Calendar className="w-5 h-5 text-cyan-600 dark:text-cyan-500 ml-3 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col z-10 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-cyan-500/70">من تاريخ</span>
                    <span className={`font-black text-[15px] dir-ltr text-right tracking-widest ${startDate ? 'text-slate-800 dark:text-cyan-300' : 'text-slate-400 dark:text-slate-500'}`}>
                      {startDate ? dayjs(startDate).format('DD / MM / YYYY') : 'اختر التاريخ'}
                    </span>
                  </div>
                </div>

                <div onClick={() => openDatePicker('end')} className="relative flex-1 h-14 bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-cyan-500/20 shadow-sm dark:shadow-inner flex items-center px-4 hover:bg-slate-50 dark:hover:bg-cyan-500/10 hover:border-cyan-300 dark:hover:border-cyan-500/40 transition-colors cursor-pointer group">
                  <Calendar className="w-5 h-5 text-cyan-600 dark:text-cyan-500 ml-3 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col z-10 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-cyan-500/70">إلى تاريخ</span>
                    <span className={`font-black text-[15px] dir-ltr text-right tracking-widest ${endDate ? 'text-slate-800 dark:text-cyan-300' : 'text-slate-400 dark:text-slate-500'}`}>
                      {endDate ? dayjs(endDate).format('DD / MM / YYYY') : 'اختر التاريخ'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative flex-1 bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-cyan-500/20 shadow-sm dark:shadow-inner h-14 flex items-center group/select focus-within:border-cyan-400 dark:focus-within:border-cyan-500/50 transition-colors">
                <div className="absolute right-4 text-slate-400 dark:text-cyan-500/70 pointer-events-none group-focus-within/select:text-cyan-600 dark:group-focus-within/select:text-cyan-400 transition-colors"><Store className="w-5 h-5" /></div>
                <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-800 dark:text-cyan-100 text-sm appearance-none cursor-pointer">
                  <option value="الكل" className="bg-white dark:bg-[#121214]">كل الفروع</option>
                  {uniqueBranchesDropdown.map(b => <option key={b.id} value={b.id} className="bg-white dark:bg-[#121214]">{b.name}</option>)}
                </select>
                <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-cyan-500/50 pointer-events-none group-focus-within/select:text-cyan-600 dark:group-focus-within/select:text-cyan-400 transition-colors" />
              </div>

              <div className="relative flex-1 bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-cyan-500/20 shadow-sm dark:shadow-inner h-14 flex items-center group/select focus-within:border-cyan-400 dark:focus-within:border-cyan-500/50 transition-colors hidden">
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="hidden">
                  <option value="الكل">الكل</option>
                </select>
              </div>

              {/* 💡 زر مسح الفلاتر المصغر 💡 */}
              {(startDate !== '' || endDate !== '' || branchFilter !== 'الكل' || activeAgencyTab !== 'الكل' || categoryFilter !== 'الكل') && (
                <div className="lg:absolute lg:-bottom-12 lg:left-0 flex justify-end mt-2 lg:mt-0">
                  <button 
                    onClick={clearFilters} 
                    title="تصفير الفلاتر وإلغاء التحديد"
                    className="h-10 flex items-center justify-center gap-1.5 px-4 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors w-full md:w-auto outline-none shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> مسح الفلاتر
                  </button>
                </div>
              )}
            </div>
          </div>

          {dbError && (
            <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-sm dark:shadow-2xl w-full no-print">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500" />
              <p>{dbError}</p>
            </div>
          )}

          {!dbError && isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 w-full no-print">
              <Loader2 className="w-12 h-12 text-cyan-600 dark:text-cyan-500 animate-spin" />
            </div>
          ) : !dbError && (
            <div className={`transition-all duration-300 ${isZenMode ? 'bg-white dark:bg-black border border-slate-200 dark:border-white/5 rounded-2xl shadow-none' : 'bg-white dark:bg-[#121214] p-4 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10'} w-full min-h-[400px]`}>
              
              <div className={`flex items-center justify-between mb-6 pb-5 border-b border-slate-100 dark:border-white/5 transition-colors no-print ${isZenMode ? 'px-4 pt-4 border-none' : ''}`}>
                <div className="flex items-center gap-3">
                  <ListChecks className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">جدول التجهيز المجمع (Matrix)</h3>
                </div>
                <span className="bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-5 py-2 rounded-xl font-black text-sm border border-cyan-200 dark:border-cyan-500/20 flex items-center gap-1.5 shadow-sm dark:shadow-inner">
                  <BadgeCheck className="w-4 h-4"/> <span className="en-num">{items.length}</span> صنف معروض
                </span>
              </div>

              {/* 💡 أزرار فلترة الوكالات 💡 */}
              <div className={`flex flex-wrap items-center gap-2 mb-4 transition-all duration-300 origin-top no-print ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none p-0' : 'scale-y-100 opacity-100'}`}>
                <button 
                  onClick={() => { setActiveAgencyTab('الكل'); setCategoryFilter('الكل'); }}
                  style={activeAgencyTab === 'الكل' ? {
                    backgroundColor: isDark ? '#06b6d4' : '#0891b2', color: isDark ? '#050505' : '#ffffff', borderColor: isDark ? '#06b6d4' : '#0891b2', boxShadow: `0 0 15px ${hexToRgba('#06b6d4', 0.4)}`, transform: 'scale(1.02)'
                  } : {
                    backgroundColor: isDark ? '#0a0a0c' : '#f8fafc', color: isDark ? '#06b6d4' : '#0891b2', borderColor: isDark ? hexToRgba('#06b6d4', 0.3) : '#bae6fd', boxShadow: `inset 0 0 10px ${hexToRgba('#06b6d4', 0.05)}`
                  }}
                  className="px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-300 flex items-center gap-2 outline-none border hover:brightness-110"
                >
                  <Building2 className="w-4 h-4" /> كل الوكالات
                </button>
                
                {uniqueAgenciesList.map(agency => {
                  const isActive = activeAgencyTab === agency.name;
                  const color = agency.color || '#06b6d4';
                  return (
                    <button 
                      key={agency.name}
                      onClick={() => { setActiveAgencyTab(agency.name); setCategoryFilter('الكل'); }}
                      style={isActive ? {
                        backgroundColor: color, color: isDark ? '#050505' : '#ffffff', borderColor: color, boxShadow: `0 0 15px ${hexToRgba(color, 0.4)}`, transform: 'scale(1.02)'
                      } : {
                        backgroundColor: isDark ? '#0a0a0c' : '#f8fafc', color: isDark ? '#e2e8f0' : '#475569', borderColor: isDark ? hexToRgba(color, 0.3) : '#cbd5e1', boxShadow: `inset 0 0 10px ${hexToRgba(color, 0.05)}`
                      }}
                      className="px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-300 outline-none border hover:brightness-110"
                      onMouseEnter={(e) => {
                        if (!isActive) { e.currentTarget.style.color = color; e.currentTarget.style.borderColor = color; }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) { e.currentTarget.style.color = isDark ? '#e2e8f0' : '#475569'; e.currentTarget.style.borderColor = isDark ? hexToRgba(color, 0.3) : '#cbd5e1'; }
                      }}
                    >
                      {agency.name}
                    </button>
                  )
                })}
              </div>

              {/* 💡 أزرار (تبويبات) فلترة الأقسام 💡 */}
              {quickCategoriesTabs.length > 0 && (
                <div className={`flex flex-wrap items-center gap-2 mb-6 transition-all duration-300 origin-top no-print ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none p-0' : 'scale-y-100 opacity-100'}`}>
                  <button 
                    onClick={() => { setCategoryFilter('الكل'); }}
                    style={categoryFilter === 'الكل' ? {
                      backgroundColor: isDark ? hexToRgba('#10b981', 0.15) : '#d1fae5', color: isDark ? '#10b981' : '#047857', borderColor: isDark ? '#10b981' : '#059669', boxShadow: `0 0 12px ${hexToRgba('#10b981', 0.3)}`, transform: 'scale(1.02)'
                    } : {
                      backgroundColor: isDark ? '#0a0a0c' : '#f8fafc', color: isDark ? '#10b981' : '#059669', borderColor: isDark ? hexToRgba('#10b981', 0.2) : '#a7f3d0'
                    }}
                    className="px-4 py-2.5 rounded-xl font-black text-xs transition-all duration-300 flex items-center gap-2 outline-none border hover:brightness-110"
                  >
                    <Layers className="w-4 h-4" /> كل الأقسام
                  </button>
                  
                  {quickCategoriesTabs.map(c => {
                    const isActive = categoryFilter === c.name;
                    const color = c.color || '#10b981';
                    return (
                      <button 
                        key={c.name}
                        onClick={() => { setCategoryFilter(c.name); }}
                        style={isActive ? {
                          backgroundColor: isDark ? hexToRgba(color, 0.15) : hexToRgba(color, 0.1), color: isDark ? color : '#050505', borderColor: color, boxShadow: `0 0 12px ${hexToRgba(color, 0.3)}`, transform: 'scale(1.02)'
                        } : {
                          backgroundColor: isDark ? '#0a0a0c' : '#f8fafc', color: isDark ? '#cbd5e1' : '#475569', borderColor: isDark ? hexToRgba(color, 0.2) : '#cbd5e1'
                        }}
                        className="px-4 py-2.5 rounded-xl font-black text-xs transition-all duration-300 outline-none border flex items-center gap-1.5 group hover:brightness-110"
                        onMouseEnter={(e) => {
                          if (!isActive) { e.currentTarget.style.color = color; e.currentTarget.style.backgroundColor = isDark ? hexToRgba(color, 0.05) : hexToRgba(color, 0.1); }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) { e.currentTarget.style.color = isDark ? '#cbd5e1' : '#475569'; e.currentTarget.style.backgroundColor = isDark ? '#0a0a0c' : '#f8fafc'; }
                        }}
                      >
                        {c.name}
                        <span 
                          style={{
                            backgroundColor: isActive ? color : isDark ? hexToRgba(color, 0.1) : '#f1f5f9',
                            color: isActive ? '#050505' : color
                          }}
                          className="px-1.5 py-0.5 rounded-md text-[10px] en-num transition-colors font-bold"
                        >
                          {c.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {items.length === 0 ? (
                <div className="py-24 text-center text-slate-500 bg-slate-50 dark:bg-[#0a0a0c] rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/10 no-print shadow-inner">
                  <Package className="w-20 h-20 mx-auto mb-5 opacity-30 text-cyan-600 dark:text-cyan-500" />
                  <p className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">لا توجد مسحوبات مطابقة للبحث</p>
                  <p className="text-sm font-bold text-slate-500">تأكد من اختيار نطاق تاريخ صحيح أو قسم به طلبات.</p>
                </div>
              ) : (
                <div className={`overflow-x-auto w-full custom-scrollbar pb-6 rounded-[1.5rem] border-4 border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] bg-white dark:bg-[#0a0a0c]/50 relative print-table-container ${isZenMode ? 'min-h-[85vh]' : ''}`}>
                  <table className="w-full text-right border-collapse min-w-max border-2 border-slate-200 dark:border-white/10 print-table">
                    
                    <thead className={`text-slate-600 dark:text-slate-300 shadow-sm dark:shadow-md text-[11px] uppercase tracking-widest ${isZenMode ? 'bg-slate-100 dark:bg-black border-b border-slate-200 dark:border-white/10' : 'bg-slate-100 dark:bg-[#121214]'}`}>
                      <tr>
                        <th className={`py-4 px-3 w-12 text-center sticky right-0 z-20 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.5)] col-seq border border-slate-200 dark:border-white/10 font-black ${isZenMode ? 'bg-slate-100 dark:bg-black' : 'bg-slate-100 dark:bg-[#121214]'}`}>ت</th>
                        <th className="py-4 px-5 text-right min-w-[280px] col-name border border-slate-200 dark:border-white/10 font-black tracking-wide">المادة / الصنف المطلوب</th>
                        <th className="py-4 px-4 text-center whitespace-nowrap min-w-[90px] col-unit border border-slate-200 dark:border-white/10 font-black">الوحدة</th>
                        
                        {displayBranches.map(branch => (
                          <th key={branch.id} className={`py-4 px-2 text-center min-w-[100px] align-bottom whitespace-nowrap border border-slate-200 dark:border-white/10 branch-col col-branch ${isZenMode ? '' : 'bg-slate-50 dark:bg-[#121214]'}`}>
                            <div className="flex flex-col items-center justify-end gap-1.5 h-full">
                              {branch.agencyLogo ? (
                                <img src={branch.agencyLogo} alt={branch.agencyName} className="h-6 object-contain mb-1 drop-shadow-md" />
                              ) : (
                                branch.agencyName && activeAgencyTab === 'الكل' && (
                                  <span className="text-[10px] font-bold leading-tight whitespace-normal text-indigo-600 dark:text-cyan-500/70">{branch.agencyName}</span>
                                )
                              )}
                              <span className="text-indigo-700 dark:text-cyan-400 font-black text-[13px] leading-tight whitespace-normal drop-shadow-sm">{branch.cleanName}</span>
                            </div>
                          </th>
                        ))}
                        
                        <th className={`py-4 px-4 text-cyan-700 dark:text-cyan-300 text-center sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.6)] whitespace-nowrap min-w-[100px] col-total border-2 border-cyan-300 dark:border-cyan-500/30 font-black ${isZenMode ? 'bg-cyan-50 dark:bg-cyan-500/5' : 'bg-cyan-100 dark:bg-cyan-500/10'}`}>المجموع</th>
                      </tr>
                    </thead>
                    
                    <tbody className={`divide-y text-[13px] ${isZenMode ? 'divide-slate-200 border-b border-slate-200 dark:divide-white/5 dark:border-white/5 bg-transparent' : 'divide-slate-200 border-b border-slate-200 dark:divide-white/10 dark:border-white/10 bg-white dark:bg-[#050505]'}`}>
                      {items.map((item, index) => {
                        const prevItem = index > 0 ? items[index - 1] : null;
                        
                        const isNewAgency = activeAgencyTab === 'الكل' && (!prevItem || item.agencyName !== prevItem.agencyName);
                        const isNewCategory = isNewAgency || (!prevItem || item.categoryName !== prevItem.categoryName);

                        return (
                          <React.Fragment key={item.id}>
                            {isNewAgency && (
                              <tr className="bg-slate-100 dark:bg-[#121214] text-indigo-700 dark:text-cyan-400 agency-row border-y border-slate-200 dark:border-white/10">
                                <td colSpan={displayBranches.length + 4} className="py-4 px-5 font-black text-[16px] shadow-sm dark:shadow-md text-center">
                                  <div className="flex items-center justify-center gap-3">
                                    <Building2 className="w-6 h-6 text-indigo-600 dark:text-cyan-500" />
                                    <span className="tracking-widest drop-shadow-sm dark:drop-shadow-md text-slate-800 dark:text-white">وكالة: {item.agencyName}</span>
                                  </div>
                                </td>
                              </tr>
                            )}
                            
                            {isNewCategory && (
                              <tr className="bg-slate-50 dark:bg-[#0a0a0c] category-row border-y border-slate-200 dark:border-white/5">
                                <td colSpan={displayBranches.length + 4} className="py-3.5 px-5 font-black text-slate-700 dark:text-slate-300 text-[14px] shadow-inner text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Layers className="w-5 h-5 text-slate-400 dark:text-cyan-500/50" />
                                    القسم: {item.categoryName}
                                  </div>
                                </td>
                              </tr>
                            )}

                            <tr className={`group/row transition-colors duration-200 ${isZenMode ? 'hover:bg-slate-50 even:bg-slate-50 dark:hover:bg-white/5 dark:even:bg-white/5' : 'bg-white hover:bg-slate-50 even:bg-slate-50/50 dark:bg-[#121214] dark:hover:bg-white/5 dark:even:bg-[#0a0a0c]'}`}>
                              
                              <td className={`py-3.5 px-3 text-slate-500 font-bold text-[13px] en-num text-center sticky right-0 bg-white/95 group-even/row:bg-slate-50/95 dark:bg-[#121214]/95 dark:group-even/row:bg-[#0a0a0c]/95 backdrop-blur-sm z-10 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.3)] group-hover/row:bg-transparent transition-colors col-seq border border-slate-200 dark:border-white/5`}>
                                {index + 1}
                              </td>
                              
                              <td className="py-3.5 px-5 font-black text-slate-800 dark:text-slate-300 text-[14px] text-right item-name-cell col-name border border-slate-200 dark:border-white/5 group-hover/row:text-slate-900 dark:group-hover/row:text-white transition-colors">
                                {item.name}
                              </td>
                              
                              <td className="py-3.5 px-4 text-center whitespace-nowrap col-unit border border-slate-200 dark:border-white/5">
                                <span className="bg-slate-100 dark:bg-[#050505] text-slate-500 dark:text-slate-400 px-3 py-1 rounded-md text-[11px] font-black border border-slate-200 dark:border-white/5 shadow-inner">{item.mainUnit}</span>
                              </td>
                              
                              {displayBranches.map(branch => {
                                const qty = item.branchesData[branch.id];
                                return (
                                  <td key={branch.id} className="py-3.5 px-3 text-center border border-slate-200 dark:border-white/5 relative whitespace-nowrap branch-col col-branch group/cell hover:bg-indigo-50 dark:hover:bg-cyan-500/20 transition-colors">
                                    {qty ? (
                                      <span className="font-black text-[15px] en-num inline-block text-slate-800 dark:text-white drop-shadow-sm">
                                        {Number(qty).toString()}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 dark:text-slate-600 font-medium en-num">-</span>
                                    )}
                                  </td>
                                )
                              })}
                              
                              <td className={`py-3.5 px-4 text-center sticky left-0 z-10 shadow-[4px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_15px_-3px_rgba(0,0,0,0.5)] whitespace-nowrap col-total transition-colors border-2 border-cyan-200 dark:border-cyan-500/20 ${isZenMode ? 'bg-cyan-50 group-hover/row:bg-cyan-100 dark:bg-cyan-500/5 dark:group-hover/row:bg-cyan-500/10' : 'bg-cyan-50 group-hover/row:bg-cyan-100 dark:bg-cyan-500/10 dark:group-hover/row:bg-cyan-500/20'}`}>
                                <span className="font-black text-[16px] en-num bg-white dark:bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-200 dark:border-cyan-500/20 shadow-sm dark:shadow-inner inline-block text-cyan-700 dark:text-cyan-300 drop-shadow-sm">
                                  {Number(item.rowTotal).toString()}
                                </span>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    
                    <tfoot>
                      <tr className={`${isZenMode ? 'bg-slate-100 dark:bg-black border-t-2 border-cyan-300 dark:border-cyan-500/50' : 'bg-slate-100 dark:bg-[#121214] border-t-[3px] border-cyan-300 dark:border-cyan-500/50'}`}>
                        <td colSpan={3} className={`py-4 px-5 font-black text-slate-800 dark:text-white text-[15px] text-left border border-slate-200 dark:border-white/10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.5)] ${isZenMode ? 'bg-slate-100 dark:bg-black' : ''}`}>
                          المجموع الكلي للسحوبات:
                        </td>
                        
                        {displayBranches.map(branch => (
                          <td key={branch.id} className={`py-4 px-3 text-center border border-slate-200 dark:border-white/10 ${isZenMode ? 'bg-slate-100 dark:bg-black' : 'bg-white dark:bg-[#0a0a0c]'}`}>
                            <span className="font-black text-amber-600 dark:text-amber-500 text-lg en-num bg-slate-50 dark:bg-[#121214] px-3 py-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner">
                              {branchTotals[branch.id] || 0}
                            </span>
                          </td>
                        ))}
                        
                        <td className={`py-4 px-4 text-center border border-slate-200 dark:border-white/10 sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.5)] ${isZenMode ? 'bg-cyan-100 dark:bg-cyan-500/5' : 'bg-cyan-100 dark:bg-cyan-500/10'}`}>
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-black text-cyan-800 dark:text-white text-2xl en-num block drop-shadow-sm dark:drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]">
                              {grandTotal}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tfoot>

                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 💡 زر الخروج من وضع التركيز (يظهر فقط عند التفعيل) 💡 */}
        {isZenMode && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-bottom-10 fade-in duration-300 no-print">
            <button 
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-2 bg-slate-900 text-white dark:bg-white dark:text-black px-6 py-3.5 rounded-full font-black text-sm shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all outline-none"
            >
              <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

        {/* ======================================================= */}
        {/* 🟢 التقويم المؤسساتي الشامل المبرمج (تم حل التمركز) 🟢 */}
        {/* ======================================================= */}
        {datePickerConfig.isOpen && !isZenMode && (
          <div className="fixed top-0 left-0 w-full h-[100dvh] z-[999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden no-print">
            <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl dark:shadow-[0_0_50px_rgba(34,211,238,0.1)] animate-in zoom-in-95 duration-300">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/5 pb-5 shrink-0">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-cyan-500/10 hover:bg-slate-100 dark:hover:bg-cyan-500/20 rounded-xl text-indigo-600 dark:text-cyan-400 transition-colors border border-transparent outline-none">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black transition-colors outline-none ${datePickerConfig.mode === 'month' ? 'text-indigo-600 dark:text-cyan-400 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-cyan-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num transition-colors outline-none ${datePickerConfig.mode === 'year' ? 'text-indigo-600 dark:text-cyan-400 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-cyan-300'}`}
                   >
                     {datePickerConfig.viewDate.format('YYYY')}
                   </button>
                </div>

                <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-cyan-500/10 hover:bg-slate-100 dark:hover:bg-cyan-500/20 rounded-xl text-indigo-600 dark:text-cyan-400 transition-colors border border-transparent outline-none">
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
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none ${isSelected ? 'bg-indigo-600 text-white dark:bg-cyan-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-50 dark:bg-cyan-500/5 text-slate-600 dark:text-cyan-400/70 hover:bg-slate-100 dark:hover:bg-cyan-500/15 hover:text-indigo-600 dark:hover:text-cyan-300 border border-slate-200 dark:border-cyan-500/10'}`}
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
                          if (datePickerConfig.target === 'month') {
                            handleMonthChangeCustom(newDate.format('YYYY-MM'));
                            setDatePickerConfig(p => ({...p, isOpen: false}));
                          } else {
                            setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'date'}));
                          }
                        }}
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 flex flex-col items-center gap-1.5 outline-none ${isSelected ? 'bg-indigo-600 text-white dark:bg-cyan-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-50 dark:bg-cyan-500/5 text-slate-600 dark:text-cyan-400/70 hover:bg-slate-100 dark:hover:bg-cyan-500/15 hover:text-indigo-600 dark:hover:text-cyan-300 border border-slate-200 dark:border-cyan-500/10'}`}
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
                      <div key={d} className="text-center text-[10px] font-black text-slate-400 dark:text-cyan-500/50 uppercase tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: datePickerConfig.viewDate.startOf('month').day() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: datePickerConfig.viewDate.daysInMonth() }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = datePickerConfig.viewDate.date(dayNum).format('YYYY-MM-DD');
                      
                      let isSelected = false;
                      if (datePickerConfig.target === 'start') isSelected = dateStr === startDate;
                      if (datePickerConfig.target === 'end') isSelected = dateStr === endDate;
                      
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDateSelection(dateStr)}
                          className={`
                            aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num transition-all active:scale-95 outline-none
                            ${isSelected ? 'bg-indigo-600 text-white dark:bg-cyan-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(34,211,238,0.4)]' :
                              isToday ? 'text-indigo-600 border border-indigo-300 bg-indigo-50 dark:text-cyan-300 dark:border-cyan-500/30 dark:bg-cyan-500/20' :
                              'text-slate-700 hover:bg-slate-100 hover:text-indigo-600 dark:bg-cyan-500/5 dark:text-cyan-400/80 dark:hover:bg-cyan-500/15 dark:hover:text-cyan-300 border border-transparent'}
                          `}
                        >
                          {dayNum}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <button onClick={() => setDatePickerConfig(p => ({...p, isOpen: false}))} className="w-full mt-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400/80 dark:hover:text-rose-400 rounded-2xl font-black text-[15px] transition-colors border border-transparent dark:border-rose-500/20 outline-none shadow-sm dark:shadow-inner shrink-0">
                إلغاء النافذة
              </button>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;700;900&display=swap');
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .en-num { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; direction: ltr; display: inline-block; }
      `}} />
    </div>
  );
}