"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  Calculator, TrendingUp, CalendarDays, CloudSun, Wallet, Activity, 
  Loader2, AlertCircle, Printer, FileSpreadsheet, PackageOpen, Filter, Calendar,
  Store, Package, RotateCcw, ChevronDown, Building2, ArrowRightLeft, Layers, Settings,
  MoveHorizontal, Maximize, RefreshCw, Eye, EyeOff, CheckCircle2, LayoutList, Grid2X2, ChevronRight, ChevronLeft
} from 'lucide-react';
import dayjs from 'dayjs';

interface BranchCell {
  baseQty: number;
  finalQty: number;
  diff: number;
  aiNote: string;
}

interface TableRow {
  id: string;
  name: string;
  categoryName: string;
  categoryColor: string;
  agencyName: string;
  mainUnit: string;
  categorySequence: number; 
  itemSequence: number;     
  branches: Record<string, BranchCell>;
  totalProposed: number;
}

// 💡 توسيع الخيارات لتشمل كل الاحتمالات الإيجابية والسلبية 💡
const FILTER_LABELS = {
  weather: {
    normal: 'طبيعي (مستقر)',
    rain: 'أمطار غزيرة',
    dust: 'عواصف ترابية',
    heatwave: 'موجة حر شديدة',
    cold: 'موجة برد قارس',
    perfect: 'جو ربيعي مثالي (خروج عوائل)'
  },
  event: {
    normal: 'أيام عادية',
    weekend: 'عطلة نهاية الأسبوع (خميس-جمعة-سبت)',
    match: 'مباراة مهمة للمنتخب/كلاسيكو',
    schools: 'فترة دوام المدارس',
    exams: 'فترة امتحانات',
    holiday: 'عطلة رسمية (أعياد ومناسبات)',
    ramadan: 'شهر رمضان المبارك',
    protests: 'مظاهرات أو قطوعات أمنية'
  },
  economy: {
    normal: 'اعتيادي (منتصف الشهر)',
    payday: 'توزيع رواتب (بداية الشهر)',
    month_end: 'نهاية الشهر (ضعف القدرة الشرائية)',
    discount: 'حملة خصومات (عروض قوية)',
    inflation: 'ارتفاع أسعار السوق (تضخم)'
  },
  operation: {
    normal: 'انسيابية اعتيادية',
    traffic: 'اختناقات مرورية شديدة',
    shortage: 'نقص عمالة بالمطبخ/الكادر',
    equip_fail: 'عطل بالمعدات الرئيسية',
    fast_delivery: 'توفر أسطول توصيل إضافي'
  }
};

const roundNumber = (num: number) => {
  return Math.round(num * 1000) / 1000;
};

const getCleanBranchName = (fullName: string, agencyName: string) => {
  if (!fullName) return 'غير محدد';
  let clean = fullName;
  if (clean.includes('-')) {
    clean = clean.split('-').pop()?.trim() || clean;
  }
  if (agencyName) {
    const agencyWords = agencyName.split(/[-\s]+/).filter(w => w.length > 2);
    agencyWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      clean = clean.replace(regex, '').trim();
    });
  }
  clean = clean.replace(/^[-\s]+/, '').trim();
  return clean || fullName;
};

const defaultPdfSettings = {
  paperSize: 'A3',
  margin: '5mm',
  zoom: 95,
  shiftX: 0,
  autoFit: false,
  seqWidth: 3,
  agencyWidth: 8,
  categoryWidth: 8,
  itemWidth: 18,
  unitWidth: 6,
  totalWidth: 8,
  branchWidth: 5
};

// 💡 إعدادات التقويم الذكي المخصص 💡
type PickerTarget = 'startDate' | 'endDate';
const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function SmartOrdersPage() {
  const { isDark } = useTheme(); 
  const [isZenMode, setIsZenMode] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table'); 
  
  const [orders, setOrders] = useState<any[]>([]);
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeDateRange, setActiveDateRange] = useState<string>('all');
  
  const [branchFilter, setBranchFilter] = useState<string>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [itemFilter, setItemFilter] = useState<string>('الكل');
  
  const [activeAgencyTab, setActiveAgencyTab] = useState<string>('الكل');

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);

  // 💡 حالة التقويم المنبثق 💡
  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, target: PickerTarget, viewDate: dayjs.Dayjs, mode: 'date' | 'month' | 'year'
  }>({ isOpen: false, target: 'startDate', viewDate: dayjs(), mode: 'date' });

  const [factors, setFactors] = useState({
    weather: 'normal',
    event: 'normal',
    economy: 'normal',
    operation: 'normal'
  });

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('smartOrdersPdfSettings_v3');
    if (savedSettings) {
      try {
        setPdfSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Error loading PDF settings', e);
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('smartOrdersPdfSettings_v3', JSON.stringify(pdfSettings));
    }
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => {
    setPdfSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetPdfSettings = () => {
    setPdfSettings(defaultPdfSettings);
  };

  const handleFactorChange = (key: keyof typeof factors, value: string) => {
    setFactors(prev => ({ ...prev, [key]: value }));
  };

  // 💡 دوال التقويم المخصص 💡
  const openDatePicker = (target: PickerTarget, defaultDate: string) => {
    setDatePickerConfig({ isOpen: true, target, viewDate: defaultDate ? dayjs(defaultDate) : dayjs(), mode: 'date' });
  };

  const handleDateSelection = (dateStr: string) => {
    if (datePickerConfig.target === 'startDate') setStartDate(dateStr);
    else if (datePickerConfig.target === 'endDate') setEndDate(dateStr);
    setActiveDateRange('custom');
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, branch_id, status, created_at,
          branches (id, name, sector, agency_id),
          order_details (id, item_id, quantity, items (id, name, primary_unit, main_unit, measurement_type, initial_unit, product_type, agency_id, sequence, categories(name, color, sequence)))
        `)
        .limit(100000)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      
      const validOrders = (ordersData || []).filter(order => 
        order.status !== 'pending' && order.status !== 'rejected'
      );

      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name');
        
      if (agenciesError) throw agenciesError;

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, agency_id')
        .order('name');
        
      if (branchesError) throw branchesError;
      setAllBranches(branchesData || []);

      const agMap: Record<string, string> = {};
      agenciesData?.forEach(ag => { agMap[ag.id] = ag.name; });

      setAgenciesMap(agMap);
      setOrders(validOrders);
    } catch (err: any) {
      setDbError(err?.message || "يرجى التأكد من اتصال قاعدة البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const uniqueAgenciesList = useMemo(() => {
    const agencies = new Set<string>();
    allBranches.forEach(b => {
      const agName = b.agency_id ? (agenciesMap[b.agency_id] || '') : '';
      if (agName) agencies.add(agName);
    });
    return Array.from(agencies).sort();
  }, [allBranches, agenciesMap]);

  const { uniqueBranchesDropdown, uniqueCategoriesDropdown, uniqueItemsDropdown } = useMemo(() => {
    const itemsSet = new Set<string>();
    const categoriesSet = new Set<string>();
    
    orders.forEach(order => {
      order.order_details?.forEach((detail: any) => {
        if (detail.items?.name) itemsSet.add(detail.items.name);
        if (detail.items?.categories?.name) categoriesSet.add(detail.items.categories.name);
      });
    });

    const bList = allBranches.map(b => {
      return { id: b.id, name: b.name }; 
    }).sort((a, b) => a.name.localeCompare(b.name));
    
    return { 
      uniqueBranchesDropdown: bList, 
      uniqueCategoriesDropdown: Array.from(categoriesSet).sort(),
      uniqueItemsDropdown: Array.from(itemsSet).sort() 
    };
  }, [orders, allBranches]);

  const { displayBranches, tableRows, totalDaysCount } = useMemo(() => {
    const finalBranchesMap = new Map();
    const globalActiveDates = new Set<string>();

    allBranches.forEach(b => {
      const agName = b.agency_id ? (agenciesMap[b.agency_id] || '') : '';
      finalBranchesMap.set(b.id, { 
        id: b.id, 
        name: b.name, 
        agencyName: agName,
        cleanName: getCleanBranchName(b.name, agName)
      });
    });

    orders.forEach(order => {
      const bId = order.branch_id;
      if (bId && !finalBranchesMap.has(bId)) {
        const agId = order.branches?.agency_id;
        const agName = agId ? (agenciesMap[agId] || '') : '';
        const branchName = order.branches?.name || 'غير محدد';
        finalBranchesMap.set(bId, { 
          id: bId, 
          name: branchName, 
          agencyName: agName,
          cleanName: getCleanBranchName(branchName, agName)
        });
      }
    });

    let displayBranchesArray = Array.from(finalBranchesMap.values());
    if (branchFilter !== 'الكل') displayBranchesArray = displayBranchesArray.filter(b => b.id === branchFilter);
    if (activeAgencyTab !== 'الكل') displayBranchesArray = displayBranchesArray.filter(b => b.agencyName === activeAgencyTab);

    displayBranchesArray.sort((a, b) => {
      if (a.agencyName === b.agencyName) return (a.cleanName || '').localeCompare(b.cleanName || '');
      return a.agencyName.localeCompare(b.agencyName);
    });

    orders.forEach(order => {
      const orderDate = dayjs(order.created_at).format('YYYY-MM-DD');
      let isDateValid = true;
      if (startDate && endDate) isDateValid = orderDate >= startDate && orderDate <= endDate;
      else if (startDate) isDateValid = orderDate >= startDate;
      else if (endDate) isDateValid = orderDate <= endDate;
      if (isDateValid) globalActiveDates.add(orderDate);
    });

    const tDaysCount = globalActiveDates.size || 1;
    const itemsMap = new Map<string, any>();

    orders.forEach(order => {
      const orderDate = dayjs(order.created_at).format('YYYY-MM-DD');
      if (!globalActiveDates.has(orderDate)) return;

      const bId = order.branch_id;
      if (!finalBranchesMap.has(bId)) return;
      if (branchFilter !== 'الكل' && branchFilter !== bId) return;

      const branchAgencyName = finalBranchesMap.get(bId).agencyName;
      if (activeAgencyTab !== 'الكل' && branchAgencyName !== activeAgencyTab) return;

      order.order_details?.forEach((detail: any) => {
        const iId = detail.item_id;
        
        const catName = detail.items?.categories?.name || 'غير محدد';
        if (categoryFilter !== 'الكل' && catName !== categoryFilter) return;

        const iName = detail.items?.name || 'غير محدد';
        if (itemFilter !== 'الكل' && iName !== itemFilter) return;

        const agId = detail.items?.agency_id;
        const agencyName = agId ? (agenciesMap[agId] || 'غير محدد') : 'غير محدد';
        
        if (activeAgencyTab !== 'الكل' && agencyName !== activeAgencyTab) return;

        const dbPrim = detail.items?.primary_unit;
        const dbMain = detail.items?.main_unit;
        const catColor = detail.items?.categories?.color || '#cbd5e1';
        
        const rawCatSequence = detail.items?.categories?.sequence;
        const catSequence = (rawCatSequence !== null && rawCatSequence !== undefined) ? Number(rawCatSequence) : 999;

        const rawItemSequence = detail.items?.sequence;
        const itemSequence = (rawItemSequence !== null && rawItemSequence !== undefined) ? Number(rawItemSequence) : 999;

        const calculatedMainUnit = dbMain && dbMain !== '-' && dbMain !== 'null' ? dbMain : (dbPrim || 'لم تحدد');
        const qty = parseFloat(detail.quantity) || 0;

        if (!itemsMap.has(iId)) {
          itemsMap.set(iId, { 
            id: iId, 
            name: iName, 
            agencyName: agencyName,
            categoryName: catName,
            categoryColor: catColor,
            categorySequence: catSequence, 
            itemSequence: itemSequence,    
            mainUnit: calculatedMainUnit,
            branchTotals: {}
          });
        }
        
        const itemObj = itemsMap.get(iId)!;
        if (!itemObj.branchTotals[bId]) itemObj.branchTotals[bId] = 0;
        itemObj.branchTotals[bId] += qty;
      });
    });

    const rows: TableRow[] = [];

    itemsMap.forEach((itemData) => {
      let totalProposed = 0;
      const branchCells: Record<string, BranchCell> = {};

      const isPkg = itemData.categoryName.includes('تغليف') || itemData.name.includes('تغليف') || itemData.name.includes('علب') || itemData.name.includes('كيس');
      const isSauce = itemData.categoryName.includes('صوص') || itemData.name.includes('صوص') || itemData.name.includes('ثومية') || itemData.name.includes('مقبلات');
      const isFood = !isPkg && !isSauce;

      displayBranchesArray.forEach(branch => {
        const totalQty = itemData.branchTotals[branch.id] || 0;
        const baseAvgQty = totalQty / tDaysCount;

        if (baseAvgQty === 0) {
          branchCells[branch.id] = { baseQty: 0, finalQty: 0, diff: 0, aiNote: "" };
          return;
        }

        let multiplier = 1;

        if (factors.weather === 'rain') multiplier += isPkg ? 0.30 : -0.15;
        else if (factors.weather === 'dust') multiplier -= 0.25; 
        else if (factors.weather === 'heatwave') multiplier += isSauce ? 0.20 : -0.10;
        else if (factors.weather === 'cold') multiplier += isFood ? 0.15 : 0;
        else if (factors.weather === 'perfect') multiplier += 0.25;

        if (factors.event === 'weekend') multiplier += 0.35;
        else if (factors.event === 'match') multiplier += (isFood || isPkg) ? 0.40 : 0.15;
        else if (factors.event === 'schools') multiplier += 0.10;
        else if (factors.event === 'exams') multiplier -= 0.20; 
        else if (factors.event === 'holiday') multiplier += 0.45; 
        else if (factors.event === 'ramadan') multiplier += isFood ? 0.10 : -0.10; 
        else if (factors.event === 'protests') multiplier -= 0.50; 

        if (factors.economy === 'payday') multiplier += 0.30;
        else if (factors.economy === 'month_end') multiplier -= 0.25;
        else if (factors.economy === 'discount') multiplier += 0.50;
        else if (factors.economy === 'inflation') multiplier -= 0.15;

        if (factors.operation === 'traffic') { if (isPkg) multiplier += 0.20; else multiplier -= 0.10; }
        else if (factors.operation === 'shortage') multiplier -= 0.15;
        else if (factors.operation === 'equip_fail') multiplier -= 0.40;
        else if (factors.operation === 'fast_delivery') multiplier += isPkg ? 0.25 : 0.05;

        const finalQty = Math.max(0, Math.round(baseAvgQty * multiplier));
        const diff = finalQty - Math.round(baseAvgQty);

        totalProposed += finalQty;
        branchCells[branch.id] = { baseQty: Math.round(baseAvgQty), finalQty, diff, aiNote: diff !== 0 ? "تعديل ذكي" : "" };
      });

      if (totalProposed > 0) {
        rows.push({
          id: itemData.id,
          name: itemData.name,
          categoryName: itemData.categoryName,
          categoryColor: itemData.categoryColor,
          categorySequence: itemData.categorySequence, 
          itemSequence: itemData.itemSequence,         
          agencyName: itemData.agencyName,
          mainUnit: itemData.mainUnit,
          branches: branchCells,
          totalProposed
        });
      }
    });

    rows.sort((a, b) => {
      if (a.agencyName !== b.agencyName) return a.agencyName.localeCompare(b.agencyName);
      if (a.categorySequence !== b.categorySequence) return a.categorySequence - b.categorySequence;
      if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
      if (a.itemSequence !== b.itemSequence) return a.itemSequence - b.itemSequence;
      return a.name.localeCompare(b.name);
    });

    return { displayBranches: displayBranchesArray, tableRows: rows, totalDaysCount: tDaysCount };
  }, [orders, allBranches, factors, startDate, endDate, branchFilter, categoryFilter, itemFilter, agenciesMap, activeAgencyTab]);

  const applyDateRange = (type: 'today' | '7days' | '14days' | '21days' | '28days' | 'month' | 'all') => {
    setActiveDateRange(type);
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
    applyDateRange('all');
    setBranchFilter('الكل');
    setCategoryFilter('الكل');
    setItemFilter('الكل');
    setActiveAgencyTab('الكل');
    setFactors({ weather: 'normal', event: 'normal', economy: 'normal', operation: 'normal' });
  };

  const getDateRangeText = () => {
    if (startDate && endDate) {
      if (startDate === endDate) return `ليوم ${startDate}`;
      return `من ${startDate} إلى ${endDate}`;
    }
    if (startDate) return `من ${startDate} ولغاية اليوم`;
    if (endDate) return `لغاية ${endDate}`;
    return 'كل التواريخ في السجل الشامل';
  };

  const getBranchFilterName = () => {
    if (branchFilter === 'الكل') return 'كل الفروع';
    const branch = uniqueBranchesDropdown.find(b => b.id === branchFilter);
    return branch ? branch.name : 'فرع محدد';
  };

  const handleExportExcel = () => {
    if (tableRows.length === 0) return alert("لا توجد بيانات لتصديرها.");

    const agencyTitle = activeAgencyTab !== 'الكل' ? `لوظائف وكالة (${activeAgencyTab})` : 'الكلي (كل الوكالات)';
    const branchName = getBranchFilterName();
    const catName = categoryFilter === 'الكل' ? 'كل الأقسام' : categoryFilter;
    const itemName = itemFilter === 'الكل' ? 'كل المواد' : itemFilter;

    const weatherText = FILTER_LABELS.weather[factors.weather as keyof typeof FILTER_LABELS.weather];
    const eventText = FILTER_LABELS.event[factors.event as keyof typeof FILTER_LABELS.event];
    const economyText = FILTER_LABELS.economy[factors.economy as keyof typeof FILTER_LABELS.economy];
    const operationText = FILTER_LABELS.operation[factors.operation as keyof typeof FILTER_LABELS.operation];

    const branchHeaders = displayBranches.map(b => `<th width="10%">${b.agencyName && activeAgencyTab === 'الكل' ? b.agencyName + '<br/>' : ''}${b.cleanName}</th>`).join('');
    const baseCols = activeAgencyTab === 'الكل' ? 5 : 4;
    const totalCols = displayBranches.length + baseCols + 1;
    const remainingCols = Math.max(1, totalCols - 4);

    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar">
      <head><meta charset="utf-8" /><style>
        table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; }
        th { background-color: #4f46e5; color: #ffffff; font-weight: bold; font-size: 14px; padding: 12px; border: 1px solid #cbd5e1; text-align: center; }
        td { padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-size: 13px; color: #1e293b; font-weight: bold; }
        .title { font-size: 22px; font-weight: bold; color: #4f46e5; text-align: center; padding: 15px; border: none; }
        .total-col { background-color: #e0e7ff; color: #4338ca; font-size: 15px; }
        .alt-row { background-color: #f8fafc; }
        .meta-label { font-weight: bold; background-color: #f1f5f9; color: #334155; text-align: left; border: 1px solid #cbd5e1; padding: 10px; }
        .meta-value { text-align: right; background-color: #ffffff; color: #4f46e5; border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; }
      </style></head>
      <body>
        <table>
          <tr><td colspan="${totalCols}" class="title">تقرير الطلبيات الذكية للمطبخ المركزي ${agencyTitle}</td></tr>
          <tr><td colspan="${totalCols}" style="text-align:center; color:#64748b; padding: 10px; font-size: 12px; border:none;">تاريخ التقرير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</td></tr>
          
          <tr><td colspan="${totalCols}" style="border: none; height: 10px;"></td></tr>

          <tr>
            <td class="meta-label">الطقس:</td><td class="meta-value">${weatherText}</td>
            <td class="meta-label">الأحداث والمناسبات:</td><td class="meta-value">${eventText}</td>
            <td colspan="${remainingCols}" style="border: none;"></td>
          </tr>
          <tr>
            <td class="meta-label">القوة الشرائية:</td><td class="meta-value">${economyText}</td>
            <td class="meta-label">حالة التشغيل:</td><td class="meta-value">${operationText}</td>
            <td colspan="${remainingCols}" style="border: none;"></td>
          </tr>
          <tr>
            <td class="meta-label">الفرع المختار:</td><td class="meta-value">${branchName}</td>
            <td class="meta-label">القسم:</td><td class="meta-value">${catName}</td>
            <td colspan="${remainingCols}" style="border: none;"></td>
          </tr>
          <tr>
            <td class="meta-label">المادة المحددة:</td><td class="meta-value">${itemName}</td>
            <td class="meta-label">نطاق التقرير:</td><td class="meta-value" dir="ltr">${getDateRangeText()} (${totalDaysCount} يوم)</td>
            <td colspan="${remainingCols}" style="border: none;"></td>
          </tr>

          <tr><td colspan="${totalCols}" style="border: none; height: 20px;"></td></tr>
          
          <thead>
            <tr>
              <th width="3%">ت</th>
              ${activeAgencyTab === 'الكل' ? '<th width="10%">الوكالة</th>' : ''}
              <th width="10%">القسم</th>
              <th width="20%">المادة / الصنف</th>
              <th width="8%">وحدة الحساب</th>
              ${branchHeaders}
              <th width="10%">المجموع الذكي</th>
            </tr>
          </thead>
          <tbody>
    `;

    tableRows.forEach((row, index) => {
      const rowClass = index % 2 === 0 ? '' : 'alt-row';
      const branchCells = displayBranches.map(branch => {
        const cell = row.branches[branch.id];
        if (!cell || cell.finalQty === 0) return `<td style="color: #cbd5e1;">-</td>`;
        return `<td dir="ltr" style="${cell.diff > 0 ? 'color: #059669;' : cell.diff < 0 ? 'color: #e11d48;' : ''}">${cell.finalQty}</td>`;
      }).join('');

      tableHTML += `
        <tr class="${rowClass}">
          <td>${index + 1}</td>
          ${activeAgencyTab === 'الكل' ? `<td style="color: #1d4ed8;">${row.agencyName}</td>` : ''}
          <td style="color: ${row.categoryColor};">${row.categoryName}</td>
          <td style="text-align: right;">${row.name}</td>
          <td style="color: #059669;">${row.mainUnit}</td>
          ${branchCells}
          <td class="total-col" dir="ltr">${row.totalProposed}</td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table></body></html>`;
    const blob = new Blob(['\uFEFF' + tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `طلبيات_ذكية_${dayjs().format('YYYY-MM-DD')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (tableRows.length === 0) return alert("لا توجد بيانات لطباعتها.");

    const agencyTitle = activeAgencyTab !== 'الكل' ? `لوظائف وكالة (${activeAgencyTab})` : 'الكلي (كل الوكالات)';
    const catName = categoryFilter === 'الكل' ? 'كل الأقسام' : categoryFilter;
    
    const weatherText = FILTER_LABELS.weather[factors.weather as keyof typeof FILTER_LABELS.weather];
    const eventText = FILTER_LABELS.event[factors.event as keyof typeof FILTER_LABELS.event];
    const economyText = FILTER_LABELS.economy[factors.economy as keyof typeof FILTER_LABELS.economy];
    const operationText = FILTER_LABELS.operation[factors.operation as keyof typeof FILTER_LABELS.operation];

    const hasAgencyCol = activeAgencyTab === 'الكل';
    
    const getColStyle = (widthPercent: number) => {
      return pdfSettings.autoFit ? `padding: 6px 2px;` : `width: ${widthPercent}%; padding: 6px 2px;`;
    };

    const branchHeaders = displayBranches.map(b => `<th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.branchWidth)} background-color: #4f46e5; color: white; word-break: break-word; white-space: normal;"><span style="font-size:14px; font-weight: 900;">${b.cleanName}</span>${b.agencyName && activeAgencyTab === 'الكل' ? `<span style="font-size:9px; color:#c7d2fe; display:block; line-height:1.2;">${b.agencyName}</span>` : ''}</th>`).join('');

    let trRows = '';
    tableRows.forEach((row, index) => {
      const branchCells = displayBranches.map(branch => {
        const cell = row.branches[branch.id];
        if (!cell || cell.finalQty === 0) return `<td style="${getColStyle(pdfSettings.branchWidth)} text-align: center; color: #cbd5e1; font-weight: 900; border: 1px solid #e2e8f0; font-size: 15px;" dir="ltr">-</td>`;
        return `<td dir="ltr" style="${getColStyle(pdfSettings.branchWidth)} text-align: center; font-weight: 900; border: 1px solid #e2e8f0; font-size: 15px; ${cell.diff > 0 ? 'color: #059669;' : cell.diff < 0 ? 'color: #e11d48;' : 'color: #1e293b;'}">${cell.finalQty}</td>`;
      }).join('');

      const rowClass = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      trRows += `
        <tr style="background-color: ${rowClass}; page-break-inside: avoid;">
          <td style="${getColStyle(pdfSettings.seqWidth)} color: #64748b; font-weight: bold; text-align: center; border: 1px solid #e2e8f0; font-size: 13px;">${index + 1}</td>
          ${hasAgencyCol ? `<td style="${getColStyle(pdfSettings.agencyWidth)} text-align: center; color: #1d4ed8; font-weight: bold; border: 1px solid #e2e8f0; font-size: 13px;">${row.agencyName}</td>` : ''}
          <td style="${getColStyle(pdfSettings.categoryWidth)} text-align: center; font-weight: bold; color: ${row.categoryColor}; border: 1px solid #e2e8f0; font-size: 13px;">${row.categoryName}</td>
          <td style="${getColStyle(pdfSettings.itemWidth)} font-weight: 900; color: #1e293b; text-align: right; border: 1px solid #e2e8f0; font-size: 15px; word-break: break-word;">${row.name}</td>
          <td style="${getColStyle(pdfSettings.unitWidth)} text-align: center; color: #059669; font-weight: 900; border: 1px solid #e2e8f0; font-size: 13px;">${row.mainUnit}</td>
          ${branchCells}
          <td style="${getColStyle(pdfSettings.totalWidth)} text-align: center; background-color: #e0e7ff; color: #4338ca; font-weight: 900; border: 1px solid #e2e8f0; font-size: 16px;" dir="ltr">${row.totalProposed}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>طلبيات_ذكية_${dayjs().format('YYYYMMDD')}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            
            @page { size: ${pdfSettings.paperSize} landscape; margin: ${pdfSettings.margin}; }
            
            * { box-sizing: border-box; }
            
            body { 
              font-family: 'Cairo', system-ui, sans-serif; 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              margin: 0; padding: 0; background: white;
            }
            
            .print-footer { 
               display: flex !important; 
               position: fixed !important; 
               bottom: 0; 
               left: 0; 
               right: 0; 
               background: white; 
               padding-top: 6px; 
               border-top: 2px solid #e2e8f0;
               z-index: 1000;
               justify-content: space-between;
               font-size: 13px;
               font-weight: 900;
               color: #64748b;
            }
            
            table { 
               width: 100% !important; 
               max-width: 100% !important;
               table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'} !important; 
               border-collapse: collapse; 
               page-break-inside: auto; 
            }
            
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; } 
            
            th, td {
               word-wrap: break-word !important;
               word-break: break-word !important;
               white-space: normal !important;
               overflow-wrap: break-word !important;
            }
            
            .print-container { 
               padding-bottom: 50px; 
               zoom: ${pdfSettings.zoom / 100}; 
               width: 100%;
               max-width: 100%;
               overflow: hidden;
               margin-right: ${pdfSettings.shiftX}mm;
            }
            
            .factors-grid {
               display: flex;
               gap: 12px;
               margin-bottom: 15px;
            }
            .factor-box {
               flex: 1;
               background: #f1f5f9;
               border: 1px solid #cbd5e1;
               padding: 10px 15px;
               border-radius: 8px;
            }
            .factor-title {
               font-size: 12px;
               font-weight: 900;
               color: #475569;
               margin-bottom: 5px;
            }
            .factor-value {
               font-size: 16px;
               font-weight: 900;
               color: #4f46e5;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 15px;">
              <div>
                <h1 style="margin: 0; color: #4f46e5; font-size: 28px; font-weight: 900;">تقرير الطلبيات الذكية الموحد ${agencyTitle}</h1>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 15px; font-weight: bold;">القسم المفلتر: <span style="color:#4f46e5;">${catName}</span> | الأيام المحللة: ${totalDaysCount} يوم</p>
              </div>
              <div style="text-align: left;">
                <p style="margin: 0; color: #475569; font-size: 13px; font-weight: bold;">المطبخ المركزي</p>
                <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 11px;">تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>

            <div class="factors-grid">
              <div class="factor-box">
                <div class="factor-title">حالة الطقس المتوقعة</div>
                <div class="factor-value">${weatherText}</div>
              </div>
              <div class="factor-box">
                <div class="factor-title">الأحداث والمناسبات</div>
                <div class="factor-value">${eventText}</div>
              </div>
              <div class="factor-box">
                <div class="factor-title">القوة الشرائية</div>
                <div class="factor-value">${economyText}</div>
              </div>
              <div class="factor-box">
                <div class="factor-title">ظروف التشغيل</div>
                <div class="factor-value">${operationText}</div>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #4f46e5; color: #ffffff;">
                  <th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.seqWidth)} font-size: 14px;">ت</th>
                  ${hasAgencyCol ? `<th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.agencyWidth)} font-size: 14px;">الوكالة</th>` : ''}
                  <th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.categoryWidth)} font-size: 14px;">القسم</th>
                  <th style="text-align: right; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.itemWidth)} font-size: 15px; padding-right: 8px !important;">المادة / الصنف</th>
                  <th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.unitWidth)} font-size: 14px;">الوحدة</th>
                  ${branchHeaders}
                  <th style="text-align: center; border: 1px solid #cbd5e1; background-color: #4338ca; ${getColStyle(pdfSettings.totalWidth)} font-size: 15px;">الكمية الذكية</th>
                </tr>
              </thead>
              <tbody>
                ${trRows}
              </tbody>
            </table>
            
          </div>
          
          <div class="print-footer">
            <div>طُبع بواسطة: <span style="color: #0f172a; margin-right: 5px;">YASIR SAADOUN</span></div>
            <div dir="ltr">تاريخ الطباعة: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</div>
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

  const hasAgency = activeAgencyTab === 'الكل';
  const totalCalculatedWidth = pdfSettings.seqWidth + (hasAgency ? pdfSettings.agencyWidth : 0) + pdfSettings.categoryWidth + pdfSettings.itemWidth + pdfSettings.unitWidth + pdfSettings.totalWidth + (pdfSettings.branchWidth * displayBranches.length);

  if (!isMounted) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`p-4 md:p-6 max-w-[100rem] mx-auto w-full font-sans pb-[130px] min-h-screen transition-colors duration-300 ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-900 dark:text-slate-300' : 'bg-slate-50 dark:bg-[#050505] text-slate-800 dark:text-white'}`} dir="rtl">
        
        {/* الترويسة العليا */}
        <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 w-full transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden' : 'scale-y-100 opacity-100'}`}>
          <div className="flex items-center gap-5 text-right w-full md:w-auto">
            <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-3xl text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-500/20 shrink-0">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-[#2d3748] dark:text-white mb-1 transition-colors duration-300">الطلبيات الذكية (AI)</h2>
              <p className="text-sm font-bold text-[#718096] dark:text-slate-400 transition-colors duration-300">توقع ذكي مبني على ظروف الطقس والأحداث والقوة الشرائية.</p>
            </div>
          </div>
          
          {/* أزرار الطباعة والتصدير وإعداداتها */}
          <div className="flex flex-col gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-white dark:bg-[#121214] p-2 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors duration-300">
              
              <button 
                onClick={() => setShowPdfSettings(!showPdfSettings)} 
                title="إعدادات القياس للـ PDF"
                className={`p-3.5 rounded-xl transition-all shadow-sm border outline-none cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                <Settings className={`w-5 h-5 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} />
              </button>

              <button onClick={handleExportPDF} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-50 dark:bg-[#0a0a0c] shadow-sm border border-slate-200 dark:border-white/10 px-5 py-3.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/10 font-black text-sm transition-all active:scale-95 outline-none cursor-pointer">
                <Printer className="w-5 h-5" /> طباعة تقرير (PDF)
              </button>
              <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-50 dark:bg-[#0a0a0c] shadow-sm border border-slate-200 dark:border-white/10 px-5 py-3.5 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 font-black text-sm transition-all active:scale-95 outline-none cursor-pointer">
                <FileSpreadsheet className="w-5 h-5" /> تصدير لجداول (Excel)
              </button>
              
              <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-1"></div>
              
              <button onClick={() => setIsZenMode(true)} className="px-4 py-3.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors outline-none cursor-pointer active:scale-95" title="وضع التركيز">
                <Eye className="w-5 h-5" />
              </button>
            </div>

            {/* مستطيل القياسات (لوحة تحكم الطباعة الشاملة) */}
            {showPdfSettings && (
              <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 shadow-[0_10px_40px_-10px_rgba(79,70,229,0.15)] dark:shadow-[0_10px_40px_-10px_rgba(99,102,241,0.1)] flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative transition-colors duration-300">
                
                <div className="flex items-center justify-between border-b border-indigo-50 dark:border-indigo-500/10 pb-3">
                  <span className="text-sm font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-2"><Settings className="w-4 h-4"/> إعدادات الطباعة المتقدمة (تُحفظ تلقائياً)</span>
                  <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-indigo-500/50">
                    <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">حجم الورق</label>
                    <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-indigo-700 dark:text-indigo-400 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 cursor-pointer appearance-none transition-colors">
                      <option value="A3">A3 (أفضل للأفرع)</option>
                      <option value="A4">A4 (ورق قياسي)</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">هوامش الورقة</label>
                    <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-indigo-700 dark:text-indigo-400 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 cursor-pointer appearance-none transition-colors">
                      <option value="0mm">بدون هوامش (0mm)</option>
                      <option value="2mm">ضيقة جداً (2mm)</option>
                      <option value="5mm">ضيقة (5mm)</option>
                      <option value="10mm">عادية (10mm)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-indigo-500/50 ${pdfSettings.autoFit ? 'bg-indigo-600 border-indigo-700 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                      <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 w-full lg:col-span-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                      <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/30 shadow-sm dark:shadow-inner" dir="ltr">{pdfSettings.shiftX} mm</span>
                    </div>
                    <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-indigo-600 h-2 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer mt-1 border border-slate-200 dark:border-white/5" />
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 dark:text-slate-500"><span>إلى اليمين (-50)</span><span>إلى اليسار (+50)</span></div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <hr className="flex-1 border-slate-100 dark:border-white/5" />
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1 rounded-full border border-slate-100 dark:border-white/5 shadow-sm dark:shadow-inner">إعدادات الأعمدة (تعمل مع الاحتواء اليدوي)</span>
                  <hr className="flex-1 border-slate-100 dark:border-white/5" />
                </div>

                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  
                  <div className="flex flex-col gap-2 w-full col-span-1 sm:col-span-2 lg:col-span-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                      <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/30 shadow-sm dark:shadow-inner">{pdfSettings.zoom}%</span>
                    </div>
                    <input type="range" min="30" max="100" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-indigo-600 h-2 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض التسلسل (ت)</label>
                      <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.seqWidth}%</span>
                    </div>
                    <input type="range" min="1" max="10" value={pdfSettings.seqWidth} onChange={e => updatePdfSetting('seqWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                  </div>

                  {hasAgency && (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الوكالة</label>
                        <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.agencyWidth}%</span>
                      </div>
                      <input type="range" min="3" max="20" value={pdfSettings.agencyWidth} onChange={e => updatePdfSetting('agencyWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                    </div>
                  )}

                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض القسم</label>
                      <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.categoryWidth}%</span>
                    </div>
                    <input type="range" min="4" max="20" value={pdfSettings.categoryWidth} onChange={e => updatePdfSetting('categoryWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض المادة</label>
                      <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.itemWidth}%</span>
                    </div>
                    <input type="range" min="10" max="40" value={pdfSettings.itemWidth} onChange={e => updatePdfSetting('itemWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الوحدة</label>
                      <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.unitWidth}%</span>
                    </div>
                    <input type="range" min="3" max="15" value={pdfSettings.unitWidth} onChange={e => updatePdfSetting('unitWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الإجمالي</label>
                      <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.totalWidth}%</span>
                    </div>
                    <input type="range" min="4" max="20" value={pdfSettings.totalWidth} onChange={e => updatePdfSetting('totalWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">عرض حقل الفرع الواحد</label>
                      <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/20 shadow-sm dark:shadow-inner">{pdfSettings.branchWidth}%</span>
                    </div>
                    <input type="range" min="2" max="25" value={pdfSettings.branchWidth} onChange={e => updatePdfSetting('branchWidth', Number(e.target.value))} className="w-full accent-indigo-500 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                  </div>
                </div>

                {!pdfSettings.autoFit && (
                  <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors shadow-sm dark:shadow-inner ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
                    <span>مجموع النسب المئوية للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-700 dark:text-rose-500' : 'text-emerald-800 dark:text-emerald-500'}`}>{totalCalculatedWidth}%</span></span>
                    {totalCalculatedWidth > 100 ? (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيقوم بضغط الجدول إجبارياً)</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول سيظهر بشكل مثالي في الورقة)</span>
                    )}
                  </div>
                )}
                {pdfSettings.autoFit && (
                  <div className="p-3 rounded-xl border bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-[11px] font-black text-center shadow-sm dark:shadow-inner transition-colors">
                    تم تفعيل "الاحتواء التلقائي" - سيقوم المتصفح بضبط وتوزيع الأعمدة أوتوماتيكياً بناءً على محتوى الكلمات، وتم إيقاف النسب اليدوية مؤقتاً.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* اللوحة الأفقية (العلوية) - الفلاتر الذكية (مع الخيارات الكثيرة) */}
        <div className={`bg-indigo-50/50 dark:bg-[#121214]/80 backdrop-blur-xl p-5 md:p-6 rounded-[2.5rem] mb-6 w-full border border-indigo-200 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col md:flex-row gap-6 items-center justify-between transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 m-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
          <div className="w-full md:w-1/4 flex flex-col gap-1">
            <h3 className="font-black text-indigo-700 dark:text-indigo-400 text-lg flex items-center gap-2">
              <Calculator className="w-5 h-5" /> المتغيرات المؤثرة
            </h3>
            <p className="text-xs font-bold text-indigo-600/80 dark:text-indigo-300/80 leading-relaxed mt-1">
              حدد ظروف اليوم لكي يقوم النظام بتعديل التوقعات والكميات تلقائياً بناءً على العوامل البيئية والاقتصادية.
            </p>
          </div>
          
          <div className="w-full md:w-3/4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                <CloudSun className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> حالة الطقس المتوقعة
              </label>
              <select value={factors.weather} onChange={(e) => handleFactorChange('weather', e.target.value)} className="w-full p-2.5 bg-white dark:bg-[#050505] border border-indigo-100 dark:border-white/10 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-400 cursor-pointer text-sm shadow-sm dark:shadow-inner appearance-none transition-colors">
                <option value="normal" className="bg-white dark:bg-[#121214]">طبيعي (مستقر)</option>
                <option value="rain" className="bg-white dark:bg-[#121214]">أمطار غزيرة</option>
                <option value="dust" className="bg-white dark:bg-[#121214]">عواصف ترابية</option>
                <option value="heatwave" className="bg-white dark:bg-[#121214]">موجة حر شديدة</option>
                <option value="cold" className="bg-white dark:bg-[#121214]">موجة برد قارس</option>
                <option value="perfect" className="bg-white dark:bg-[#121214]">جو ربيعي مثالي (خروج عوائل)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                <CalendarDays className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> الأحداث والمناسبات
              </label>
              <select value={factors.event} onChange={(e) => handleFactorChange('event', e.target.value)} className="w-full p-2.5 bg-white dark:bg-[#050505] border border-indigo-100 dark:border-white/10 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-400 cursor-pointer text-sm shadow-sm dark:shadow-inner appearance-none transition-colors">
                <option value="normal" className="bg-white dark:bg-[#121214]">أيام عادية</option>
                <option value="weekend" className="bg-white dark:bg-[#121214]">عطلة نهاية الأسبوع (خميس-جمعة-سبت)</option>
                <option value="match" className="bg-white dark:bg-[#121214]">مباراة مهمة للمنتخب/كلاسيكو</option>
                <option value="schools" className="bg-white dark:bg-[#121214]">فترة دوام المدارس</option>
                <option value="exams" className="bg-white dark:bg-[#121214]">فترة امتحانات</option>
                <option value="holiday" className="bg-white dark:bg-[#121214]">عطلة رسمية (أعياد ومناسبات)</option>
                <option value="ramadan" className="bg-white dark:bg-[#121214]">شهر رمضان المبارك</option>
                <option value="protests" className="bg-white dark:bg-[#121214]">مظاهرات أو قطوعات أمنية</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                <Wallet className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> القوة الشرائية
              </label>
              <select value={factors.economy} onChange={(e) => handleFactorChange('economy', e.target.value)} className="w-full p-2.5 bg-white dark:bg-[#050505] border border-indigo-100 dark:border-white/10 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-400 cursor-pointer text-sm shadow-sm dark:shadow-inner appearance-none transition-colors">
                <option value="normal" className="bg-white dark:bg-[#121214]">اعتيادي (منتصف الشهر)</option>
                <option value="payday" className="bg-white dark:bg-[#121214]">توزيع رواتب (بداية الشهر)</option>
                <option value="month_end" className="bg-white dark:bg-[#121214]">نهاية الشهر (ضعف القدرة الشرائية)</option>
                <option value="discount" className="bg-white dark:bg-[#121214]">حملة خصومات (عروض قوية)</option>
                <option value="inflation" className="bg-white dark:bg-[#121214]">ارتفاع أسعار السوق (تضخم)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                <Activity className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /> ظروف التشغيل
              </label>
              <select value={factors.operation} onChange={(e) => handleFactorChange('operation', e.target.value)} className="w-full p-2.5 bg-white dark:bg-[#050505] border border-indigo-100 dark:border-white/10 rounded-xl font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-400 cursor-pointer text-sm shadow-sm dark:shadow-inner appearance-none transition-colors">
                <option value="normal" className="bg-white dark:bg-[#121214]">انسيابية اعتيادية</option>
                <option value="traffic" className="bg-white dark:bg-[#121214]">اختناقات مرورية شديدة</option>
                <option value="shortage" className="bg-white dark:bg-[#121214]">نقص عمالة بالمطبخ/الكادر</option>
                <option value="equip_fail" className="bg-white dark:bg-[#121214]">عطل بالمعدات الرئيسية</option>
                <option value="fast_delivery" className="bg-white dark:bg-[#121214]">توفر أسطول توصيل إضافي</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`bg-slate-50 dark:bg-[#121214]/80 backdrop-blur-xl p-6 rounded-[2.5rem] mb-8 border border-slate-200 dark:border-white/5 flex flex-col gap-5 w-full shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 m-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-white/10 pb-5">
            <div className="flex items-center gap-2 font-black text-slate-600 dark:text-slate-300 text-base">
              <Filter className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> فرز بيانات السجل الشامل (الماضي):
            </div>
            
            <div className="flex flex-col lg:flex-row gap-3 items-center w-full md:w-auto">
              <div className="flex items-center gap-1 bg-white dark:bg-[#050505] p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner overflow-x-auto hide-scrollbar max-w-full w-full lg:w-fit transition-colors">
                <div className="px-2 text-[11px] font-black text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                  <CalendarDays className="w-4 h-4" /> النطاق:
                </div>
                <button onClick={() => applyDateRange('7days')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === '7days' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'}`}>آخر 7 أيام</button>
                <button onClick={() => applyDateRange('14days')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === '14days' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'}`}>14 يوم</button>
                <button onClick={() => applyDateRange('21days')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === '21days' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'}`}>21 يوم</button>
                <button onClick={() => applyDateRange('28days')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === '28days' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'}`}>28 يوم</button>
                <button onClick={() => applyDateRange('month')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === 'month' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'}`}>الشهر</button>
                <button onClick={() => applyDateRange('all')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === 'all' ? 'bg-slate-800 dark:bg-white text-white dark:text-black shadow-md dark:shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'}`}>كل الايام</button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
            <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row gap-3">
              <div onClick={() => openDatePicker('startDate', startDate)} className="relative flex-1 h-14 bg-white dark:bg-[#050505] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner flex items-center px-4 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-colors cursor-pointer group active:scale-95">
                <Calendar className="w-5 h-5 text-indigo-500 dark:text-indigo-400 ml-3 shrink-0" />
                <div className="flex flex-col z-10 pointer-events-none">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">من تاريخ</span>
                  <span className={`font-black text-sm dir-ltr text-right ${startDate ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    {startDate ? dayjs(startDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                  </span>
                </div>
              </div>

              <div onClick={() => openDatePicker('endDate', endDate)} className="relative flex-1 h-14 bg-white dark:bg-[#050505] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner flex items-center px-4 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-colors cursor-pointer group active:scale-95">
                <Calendar className="w-5 h-5 text-indigo-500 dark:text-indigo-400 ml-3 shrink-0" />
                <div className="flex flex-col z-10 pointer-events-none">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">إلى تاريخ</span>
                  <span className={`font-black text-sm dir-ltr text-right ${endDate ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    {endDate ? dayjs(endDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative bg-white dark:bg-[#050505] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner h-14 flex items-center hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-colors">
              <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none"><Store className="w-5 h-5" /></div>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-700 dark:text-slate-300 text-sm appearance-none cursor-pointer">
                <option value="الكل" className="bg-white dark:bg-[#121214]">كل الفروع</option>
                {uniqueBranchesDropdown.map(b => <option key={b.id} value={b.id} className="bg-white dark:bg-[#121214]">{b.name}</option>)}
              </select>
              <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            </div>

            <div className="relative bg-white dark:bg-[#050505] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner h-14 flex items-center hover:border-violet-400 dark:hover:border-violet-500/50 transition-colors">
              <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none"><Layers className="w-5 h-5" /></div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-700 dark:text-slate-300 text-sm appearance-none cursor-pointer">
                <option value="الكل" className="bg-white dark:bg-[#121214]">كل الأقسام</option>
                {uniqueCategoriesDropdown.map(cat => <option key={cat} value={cat} className="bg-white dark:bg-[#121214]">{cat}</option>)}
              </select>
              <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            </div>

            <div className="relative bg-white dark:bg-[#050505] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner h-14 flex items-center hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-colors">
              <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none"><Package className="w-5 h-5" /></div>
              <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-700 dark:text-slate-300 text-[13px] appearance-none cursor-pointer">
                <option value="الكل" className="bg-white dark:bg-[#121214]">كل المواد</option>
                {uniqueItemsDropdown.map(item => <option key={item} value={item} className="bg-white dark:bg-[#121214]">{item}</option>)}
              </select>
              <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            </div>

            {(startDate !== '' || endDate !== '' || branchFilter !== 'الكل' || categoryFilter !== 'الكل' || itemFilter !== 'الكل' || activeAgencyTab !== 'الكل') && (
              <button onClick={clearFilters} className="h-14 flex items-center justify-center gap-2 px-5 bg-rose-50 dark:bg-rose-500/10 rounded-[1.5rem] border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 font-black text-sm hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors lg:col-span-5 shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95">
                <RotateCcw className="w-5 h-5" /> مسح جميع الفلاتر
              </button>
            )}
          </div>
        </div>

        {dbError && (
          <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-sm dark:shadow-[0_0_15px_rgba(244,63,94,0.1)] w-full transition-colors">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500 dark:text-rose-400" />
            <p>{dbError}</p>
          </div>
        )}

        {!dbError && isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 w-full">
            <Loader2 className="w-12 h-12 text-indigo-500 dark:text-indigo-400 animate-spin" />
            <p className="text-slate-500 font-bold">جاري تحليل البيانات...</p>
          </div>
        ) : !dbError && (
          <div className="bg-white dark:bg-[#121214]/80 backdrop-blur-xl p-4 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/5 w-full min-h-[400px] transition-colors duration-300">
            
            <div className="flex items-center justify-between mb-6 pb-5 border-b border-slate-100 dark:border-white/10 gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl shadow-sm dark:shadow-inner"><TrendingUp className="w-6 h-6" /></div>
                <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white tracking-tight">جدول الطلبيات الذكية</h3>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Toggle List/Grid */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#050505] p-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors">
                  <button 
                    onClick={() => setViewMode('table')} 
                    className={`p-2 rounded-lg transition-all outline-none cursor-pointer active:scale-95 ${viewMode === 'table' ? 'bg-white dark:bg-[#121214] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-white/5' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    title="عرض كجدول"
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('grid')} 
                    className={`p-2 rounded-lg transition-all outline-none cursor-pointer active:scale-95 ${viewMode === 'grid' ? 'bg-white dark:bg-[#121214] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-white/5' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    title="عرض كشبكة (كروت)"
                  >
                    <Grid2X2 className="w-4 h-4" />
                  </button>
                </div>

                <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-5 py-2.5 rounded-xl font-black text-sm border border-indigo-200 dark:border-indigo-500/30 shadow-sm dark:shadow-inner transition-colors">
                  أيام السجل: <span dir="ltr">{totalDaysCount}</span> يوم
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-6">
              <button 
                onClick={() => setActiveAgencyTab('الكل')}
                className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${
                  activeAgencyTab === 'الكل' 
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-black shadow-md dark:shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-transparent' 
                  : 'bg-white dark:bg-[#050505] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <Building2 className="w-4 h-4" /> كل الوكالات
              </button>
              
              {uniqueAgenciesList.map(agency => (
                <button 
                  key={agency}
                  onClick={() => setActiveAgencyTab(agency)}
                  className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all outline-none cursor-pointer active:scale-95 ${
                    activeAgencyTab === agency 
                    ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-500' 
                    : 'bg-white dark:bg-[#050505] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {agency}
                </button>
              ))}
            </div>

            {viewMode === 'table' && (
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-4 py-2 rounded-xl text-xs font-bold w-fit mb-4 shadow-sm dark:shadow-inner">
                <ArrowRightLeft className="w-4 h-4 animate-pulse" /> 
                اسحب الجدول يميناً ويساراً (Scroll) لرؤية كافة الأعمدة المخفية
              </div>
            )}

            {tableRows.length === 0 ? (
              <div className="py-24 text-center text-slate-400 dark:text-slate-600 bg-slate-50/50 dark:bg-[#050505] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">
                <PackageOpen className="w-20 h-20 mx-auto mb-5 opacity-50 dark:opacity-30 text-indigo-400 dark:text-indigo-500" />
                <p className="text-2xl font-black text-slate-700 dark:text-slate-400 mb-2 tracking-tight">لا توجد بيانات كافية لبناء الجدول الذكي</p>
                <p className="text-sm font-bold text-slate-500">تأكد من وجود طلبات مسجلة في السجل الشامل للفترة المحددة.</p>
              </div>
            ) : viewMode === 'table' ? (
              <div className="overflow-x-auto w-full custom-scrollbar pb-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner bg-slate-50/50 dark:bg-[#050505] transition-colors duration-300">
                <table className="w-full text-right border-collapse min-w-max">
                  <thead className="bg-slate-100 dark:bg-[#121214] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase transition-colors duration-300">
                    <tr>
                      <th className="py-4 px-3 border-b-2 border-slate-200 dark:border-white/10 text-center sticky right-0 z-20 bg-slate-100 dark:bg-[#121214] shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(255,255,255,0.02)]">ت</th>
                      
                      {activeAgencyTab === 'الكل' && (
                        <th className="py-4 px-4 border-b-2 border-slate-200 dark:border-white/10 text-center border-r border-slate-200 dark:border-white/5">الوكالة</th>
                      )}
                      
                      <th className="py-4 px-4 border-b-2 border-slate-200 dark:border-white/10 text-center">القسم</th>
                      <th className="py-4 px-5 border-b-2 border-slate-200 dark:border-white/10 text-right min-w-[200px] border-l border-slate-200 dark:border-white/5">المادة / الصنف</th>
                      <th className="py-4 px-4 border-b-2 border-slate-200 dark:border-white/10 text-center text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-white/5">وحدة الحساب</th>
                      
                      {displayBranches.map(branch => (
                        <th key={branch.id} className="py-4 px-2 border-b-2 border-slate-200 dark:border-white/10 text-center min-w-[80px] max-w-[120px] align-bottom">
                          <div className="flex flex-col items-center justify-end gap-1 h-full">
                            {branch.agencyName && activeAgencyTab === 'الكل' && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold leading-tight whitespace-normal">{branch.agencyName}</span>
                            )}
                            <span className="text-indigo-800 dark:text-indigo-300 font-black text-[14px] leading-tight whitespace-normal">{branch.cleanName}</span>
                          </div>
                        </th>
                      ))}
                      
                      <th className="py-4 px-4 bg-indigo-100 dark:bg-indigo-900/30 border-b-2 border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-300 text-center border-r border-white dark:border-black/50 sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)]">الكمية الذكية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 transition-colors duration-300">
                    {tableRows.map((row, index) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-[#0a0a0c] transition-colors bg-white dark:bg-[#121214]">
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-bold text-xs text-center sticky right-0 bg-white dark:bg-[#121214] z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(255,255,255,0.02)]">{index + 1}</td>
                        
                        {activeAgencyTab === 'الكل' && (
                          <td className="py-3 px-4 font-black text-blue-700 dark:text-blue-400 text-center whitespace-nowrap border-r border-slate-100 dark:border-white/5">{row.agencyName}</td>
                        )}
                        
                        <td className="py-3 px-4 font-black text-center whitespace-nowrap" style={{ color: row.categoryColor }}>{row.categoryName}</td>
                        <td className="py-3 px-5 font-black text-slate-800 dark:text-slate-200 text-[14px] whitespace-normal border-l border-slate-100 dark:border-white/5">
                          {row.name}
                        </td>
                        <td className="py-3 px-4 text-emerald-700 dark:text-emerald-400 font-black text-[13px] text-center border-l border-slate-100 dark:border-white/5">
                          {row.mainUnit}
                        </td>
                        
                        {displayBranches.map(branch => {
                          const cell = row.branches[branch.id];
                          if (!cell || cell.finalQty === 0) {
                            return <td key={branch.id} className="py-3 px-3 text-center border-l border-slate-50 dark:border-white/5 text-slate-300 dark:text-slate-600 font-bold">-</td>;
                          }
                          return (
                            <td key={branch.id} className="py-3 px-3 text-center border-l border-slate-50 dark:border-white/5">
                              <div className="flex flex-col items-center justify-center">
                                <span className={`font-black text-[15px] en-num inline-block ${
                                  cell.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 
                                  cell.diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-700 dark:text-indigo-400'
                                }`}>
                                  {cell.finalQty}
                                </span>
                                {cell.diff !== 0 && (
                                  <span className={`text-[10px] font-black mt-1 px-1.5 py-0.5 rounded shadow-sm dark:shadow-inner ${cell.diff > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'}`}>
                                    {cell.diff > 0 ? '+' : ''}{cell.diff}
                                  </span>
                                )}
                              </div>
                            </td>
                          )
                        })}
                        
                        <td className="py-3 px-4 text-center bg-indigo-50/50 dark:bg-indigo-900/10 border-r border-indigo-50 dark:border-indigo-500/10 sticky left-0 z-10 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors">
                          <span className="font-black text-indigo-700 dark:text-indigo-300 text-base en-num bg-white dark:bg-[#050505] px-3 py-1 rounded-xl border border-indigo-100 dark:border-indigo-500/30 shadow-sm dark:shadow-inner inline-block transition-colors">
                            {row.totalProposed}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {tableRows.map((row) => {
                  const branchesWithQty = displayBranches.filter(branch => {
                    const cell = row.branches[branch.id];
                    return cell && cell.finalQty > 0;
                  });

                  return (
                    <div key={row.id} className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm hover:shadow-md dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all flex flex-col gap-4 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-1.5 h-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: row.categoryColor }}></div>
                      
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="font-black text-slate-800 dark:text-slate-200 text-lg leading-tight">{row.name}</h4>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md mt-1.5 inline-block border shadow-sm dark:shadow-inner" style={{ color: row.categoryColor, backgroundColor: `${row.categoryColor}15`, borderColor: `${row.categoryColor}30` }}>
                            {row.categoryName}
                          </span>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 px-3 py-1.5 rounded-xl text-center shadow-sm dark:shadow-inner shrink-0 transition-colors">
                          <span className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">المجموع</span>
                          <span dir="ltr" className="font-black text-indigo-600 dark:text-indigo-400 text-lg leading-none en-num drop-shadow-sm">{row.totalProposed}</span>
                          <span className="block text-[9px] font-bold text-indigo-400 dark:text-indigo-500 mt-0.5">{row.mainUnit}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 mt-2 pt-4 border-t border-slate-100 dark:border-white/5 transition-colors">
                        <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Store className="w-3.5 h-3.5"/> تفاصيل فروع الاستهلاك:</p>
                        <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                          {branchesWithQty.length === 0 ? (
                            <span className="text-xs font-bold text-slate-400 text-center py-2">لا توجد كميات مقترحة للفروع</span>
                          ) : (
                            branchesWithQty.map(branch => {
                              const cell = row.branches[branch.id];
                              return (
                                <div key={branch.id} className="flex justify-between items-center bg-slate-50 dark:bg-[#121214] p-2 rounded-lg border border-slate-100 dark:border-white/5 shadow-sm dark:shadow-inner transition-colors">
                                  <span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 truncate pl-2">{branch.cleanName}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span dir="ltr" className={`font-black text-[14px] en-num ${cell.diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : cell.diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                      {cell.finalQty}
                                    </span>
                                    {cell.diff !== 0 && (
                                      <span className={`text-[9px] font-black px-1 py-0.5 rounded shadow-sm dark:shadow-inner border ${cell.diff > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'}`} dir="ltr">
                                        {cell.diff > 0 ? '+' : ''}{cell.diff}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 💡 التقويم المؤسساتي المنبثق (Modal) 💡 */}
        {datePickerConfig.isOpen && !isZenMode && (
          <div className="fixed top-0 left-0 w-full h-[100dvh] z-[999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden no-print">
            <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl dark:shadow-[0_0_50px_rgba(79,70,229,0.15)] animate-in zoom-in-95 duration-300">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/5 pb-5 shrink-0">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors outline-none cursor-pointer active:scale-95">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'month' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'year' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-300'}`}
                   >
                     {datePickerConfig.viewDate.format('YYYY')}
                   </button>
                </div>

                <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors outline-none cursor-pointer active:scale-95">
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
                          setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'month'}));
                        }}
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none cursor-pointer ${isSelected ? 'bg-indigo-600 text-white shadow-md dark:shadow-lg dark:shadow-indigo-500/30' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
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
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 flex flex-col items-center gap-1.5 outline-none cursor-pointer ${isSelected ? 'bg-indigo-600 text-white shadow-md dark:shadow-lg dark:shadow-indigo-500/30' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
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
                            ${isSelected ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' :
                              isToday ? 'text-indigo-600 border border-indigo-300 bg-indigo-50 dark:text-indigo-400 dark:border-indigo-500/30 dark:bg-indigo-500/10' :
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
        .en-num { font-family: system-ui, -apple-system, sans-serif; }
      `}} />
    </div>
  );
}