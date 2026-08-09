"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  TrendingUp, Loader2, AlertCircle, PackageSearch, Filter, Calendar, 
  FileSpreadsheet, Printer, Store, Package, CalendarDays, ArrowRightLeft, Building2,
  ChevronDown, RotateCcw, Settings, MoveHorizontal, Maximize, RefreshCw,
  ChevronRight, ChevronLeft, LayoutGrid, History, ShoppingCart, BarChart3, Eye, EyeOff, Layers
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

dayjs.locale('ar');

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

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

// 💡 الحصول على حرف العمود في إكسل
const getColLetter = (colIndex: number) => {
  let temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp - 1) / 26);
  }
  return letter;
};

// 💡 الإعدادات الافتراضية للطباعة 💡
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
  dynamicColWidth: 5 
};

export default function AveragesPage() {
  const { isDark } = useTheme(); // 💡 ربط الوضع الليلي
  const pathname = usePathname();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // 💡 التصفير التلقائي للتواريخ
  const [startDate, setStartDate] = useState<string>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [activeDateRange, setActiveDateRange] = useState<string>('month');
  
  const [branchFilter, setBranchFilter] = useState<string>('الكل');
  const [itemFilter, setItemFilter] = useState<string>('الكل');
  
  const [activeAgencyTab, setActiveAgencyTab] = useState<string>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل'); 
  const [viewType, setViewType] = useState<'weekdays' | 'branches'>('branches');

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);

  // 💡 حالة وضع التركيز (Zen Mode)
  const [isZenMode, setIsZenMode] = useState(false);

  // 💡 حالة التقويم المبرمج
  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, 
    viewDate: dayjs.Dayjs, 
    mode: 'date' | 'month' | 'year',
    target: 'start' | 'end' | null
  }>({ isOpen: false, viewDate: dayjs(), mode: 'date', target: null });

  const weekdays = [
    { id: 0, name: 'الأحد' }, { id: 1, name: 'الإثنين' }, { id: 2, name: 'الثلاثاء' },
    { id: 3, name: 'الأربعاء' }, { id: 4, name: 'الخميس' }, { id: 5, name: 'الجمعة' }, { id: 6, name: 'السبت' }
  ];

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('smartOrdersAvgPdfSettings_v1');
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
      localStorage.setItem('smartOrdersAvgPdfSettings_v1', JSON.stringify(pdfSettings));
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
      agenciesData?.forEach(ag => {
        agMap[ag.id] = ag.name;
      });

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

  const quickCategoriesTabs = useMemo(() => {
    const uniqueItemsMap = new Map<string, any>();
    
    orders.forEach(order => {
      order.order_details?.forEach((detail: any) => {
        const agId = detail.items?.agency_id;
        const agencyName = agId ? (agenciesMap[agId] || 'غير محدد') : 'غير محدد';
        
        if (activeAgencyTab === 'الكل' || agencyName === activeAgencyTab) {
          const catName = detail.items?.categories?.name || 'غير محدد';
          const iName = detail.items?.name || 'غير محدد';
          const compKey = `${agencyName}-${iName}`;
          if (!uniqueItemsMap.has(compKey)) {
            uniqueItemsMap.set(compKey, { categoryName: catName });
          }
        }
      });
    });

    const counts: Record<string, number> = {};
    Array.from(uniqueItemsMap.values()).forEach(item => {
      counts[item.categoryName] = (counts[item.categoryName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, activeAgencyTab, agenciesMap]);

  const { uniqueBranchesDropdown, uniqueItemsDropdown } = useMemo(() => {
    const itemsSet = new Set<string>();

    orders.forEach(order => {
      order.order_details?.forEach((detail: any) => {
        const agId = detail.items?.agency_id;
        const agencyName = agId ? (agenciesMap[agId] || 'غير محدد') : 'غير محدد';
        const catName = detail.items?.categories?.name || 'غير محدد';

        if ((activeAgencyTab === 'الكل' || agencyName === activeAgencyTab) && 
            (categoryFilter === 'الكل' || catName === categoryFilter)) {
          if (detail.items?.name) itemsSet.add(detail.items.name);
        }
      });
    });

    const bList = allBranches.map(b => {
      return { id: b.id, name: b.name }; 
    }).sort((a, b) => a.name.localeCompare(b.name));
    
    return { uniqueBranchesDropdown: bList, uniqueItemsDropdown: Array.from(itemsSet).sort() };
  }, [orders, allBranches, activeAgencyTab, categoryFilter, agenciesMap]);

  const { branches, items, branchTotals, weekdayTotals, grandTotal, totalDaysCount, weekdayCounts } = useMemo(() => {
    const globalActiveDates = new Set<string>();
    const finalBranchesMap = new Map();
    const itemsMap = new Map();

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

    let displayBranches = Array.from(finalBranchesMap.values());
    
    if (branchFilter !== 'الكل') {
      displayBranches = displayBranches.filter(b => b.id === branchFilter);
    }
    if (activeAgencyTab !== 'الكل') {
      displayBranches = displayBranches.filter(b => b.agencyName === activeAgencyTab);
    }

    const sortedBranches = displayBranches.sort((a, b) => {
      const aAg = a.agencyName || '';
      const bAg = b.agencyName || '';
      if (aAg === bAg) return (a.cleanName || '').localeCompare(b.cleanName || '');
      return aAg.localeCompare(bAg);
    });

    orders.forEach(order => {
      const orderDate = dayjs(order.created_at).format('YYYY-MM-DD');
      let isDateValid = true;
      if (startDate && endDate) {
        isDateValid = orderDate >= startDate && orderDate <= endDate;
      } else if (startDate) {
        isDateValid = orderDate >= startDate;
      } else if (endDate) {
        isDateValid = orderDate <= endDate;
      }
      if (isDateValid) globalActiveDates.add(orderDate);
    });

    const tDaysCount = globalActiveDates.size;
    const wCounts: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    globalActiveDates.forEach(date => { wCounts[dayjs(date).day()]++; });

    orders.forEach(order => {
      const orderDate = dayjs(order.created_at).format('YYYY-MM-DD');
      if (!globalActiveDates.has(orderDate)) return;

      const bId = order.branch_id;
      if (!finalBranchesMap.has(bId)) return;
      if (branchFilter !== 'الكل' && branchFilter !== bId) return;

      const branchAgencyName = finalBranchesMap.get(bId).agencyName;
      if (activeAgencyTab !== 'الكل' && branchAgencyName !== activeAgencyTab) return;

      const orderDay = dayjs(order.created_at).day();

      order.order_details?.forEach((detail: any) => {
        const iId = detail.item_id;
        const iName = detail.items?.name || 'غير محدد';
        if (itemFilter !== 'الكل' && iName !== itemFilter) return;

        const agId = detail.items?.agency_id;
        const agencyName = agId ? (agenciesMap[agId] || 'غير محدد') : 'غير محدد';
        
        if (activeAgencyTab !== 'الكل' && agencyName !== activeAgencyTab) return;

        const catName = detail.items?.categories?.name || 'غير محدد';
        if (categoryFilter !== 'الكل' && catName !== categoryFilter) return;

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
            branchesSum: {}, 
            weekdaysSum: { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 }, 
            totalSum: 0 
          });
        }

        const itemObj = itemsMap.get(iId);
        itemObj.branchesSum[bId] = roundNumber((itemObj.branchesSum[bId] || 0) + qty);
        itemObj.weekdaysSum[orderDay] = roundNumber(itemObj.weekdaysSum[orderDay] + qty);
        itemObj.totalSum = roundNumber(itemObj.totalSum + qty);
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
    const wTotals: Record<number, number> = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    let gTotal = 0;

    sortedBranches.forEach(b => { bTotals[b.id] = roundNumber(sortedItems.reduce((sum, item) => sum + (item.branchesSum[b.id] || 0), 0)); });
    [0, 1, 2, 3, 4, 5, 6].forEach(day => { wTotals[day] = roundNumber(sortedItems.reduce((sum, item) => sum + item.weekdaysSum[day], 0)); });
    gTotal = roundNumber(sortedItems.reduce((sum, item) => sum + item.totalSum, 0));

    return { 
      branches: sortedBranches, items: sortedItems, branchTotals: bTotals, 
      weekdayTotals: wTotals, grandTotal: gTotal, totalDaysCount: tDaysCount, weekdayCounts: wCounts 
    };
  }, [orders, allBranches, startDate, endDate, branchFilter, itemFilter, agenciesMap, activeAgencyTab, categoryFilter]);

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

  const shiftMonth = (direction: number) => {
    const refDate = startDate ? dayjs(startDate) : dayjs();
    const newMonth = refDate.add(direction, 'month');
    
    setStartDate(newMonth.startOf('month').format('YYYY-MM-DD'));
    
    if (newMonth.isSame(dayjs(), 'month')) {
      setEndDate(dayjs().format('YYYY-MM-DD'));
    } else {
      setEndDate(newMonth.endOf('month').format('YYYY-MM-DD'));
    }
    setActiveDateRange('custom_month');
  };

  const clearFilters = () => {
    applyDateRange('month'); 
    setBranchFilter('الكل');
    setItemFilter('الكل');
    setActiveAgencyTab('الكل');
    setCategoryFilter('الكل');
  };

  const openDatePicker = (target: 'start' | 'end') => {
    const initialDate = target === 'start' ? (startDate || dayjs().format('YYYY-MM-DD')) : (endDate || dayjs().format('YYYY-MM-DD'));
    setDatePickerConfig({ isOpen: true, viewDate: dayjs(initialDate), mode: 'date', target });
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
    if (branchFilter === 'الكل') return 'كل الفروع';
    const branch = uniqueBranchesDropdown.find(b => b.id === branchFilter);
    return branch ? branch.name : 'فرع محدد';
  };

  const formatAvg = (sum: number, count: number) => {
    if (!count || count === 0) return '-';
    const avg = sum / count;
    if (avg === 0) return '-';
    const rounded = Math.round(avg);
    return rounded === 0 ? '-' : rounded.toString();
  };

  const handleExportExcel = async () => {
    if (items.length === 0) return alert("لا توجد بيانات لتصديرها.");

    const isBranches = viewType === 'branches';
    const viewTitle = isBranches ? 'حسب الأفرع' : 'حسب أيام الأسبوع';
    const agencyTitle = activeAgencyTab !== 'الكل' ? `لوظائف وكالة (${activeAgencyTab})` : 'الكلي (كل الوكالات)';
    const branchName = getBranchFilterName();
    const itemName = itemFilter === 'الكل' ? 'كل المواد' : itemFilter;
    const exportTime = dayjs().format('YYYY-MM-DD | hh:mm A');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'نظام المطبخ المركزي';
    const worksheet = workbook.addWorksheet('متوسط الطلبات', { views: [{ rightToLeft: true }] });

    const hasAgencyCol = activeAgencyTab === 'الكل';
    const baseColsCount = hasAgencyCol ? 6 : 5;
    const dynamicHeadersCount = isBranches ? branches.length : 7;
    const totalCols = baseColsCount + dynamicHeadersCount;

    const columns = [
      { key: 'index', width: 6 },
    ];
    if (hasAgencyCol) columns.push({ key: 'agency', width: 18 });
    columns.push(
      { key: 'category', width: 18 },
      { key: 'item', width: 35 },
      { key: 'unit', width: 12 }
    );
    for (let i = 0; i < dynamicHeadersCount; i++) columns.push({ key: `dyn_${i}`, width: 15 });
    columns.push({ key: 'total', width: 18 });
    worksheet.columns = columns;

    worksheet.mergeCells(`A1:${getColLetter(totalCols)}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `📊 متوسط الطلبات (${viewTitle}) ${agencyTitle} - المطبخ المركزي`;
    titleCell.font = { name: 'Segoe UI', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 45;

    worksheet.mergeCells(`A2:C2`); worksheet.getCell('A2').value = `🏪 الفرع المختار: ${branchName}`;
    worksheet.mergeCells(`D2:E2`); worksheet.getCell('D2').value = `📅 أيام العمل: ${totalDaysCount} يوم`;
    worksheet.mergeCells(`F2:${getColLetter(totalCols)}2`); worksheet.getCell('F2').value = `🕒 تاريخ التصدير: ${exportTime}`;

    worksheet.mergeCells(`A3:C3`); worksheet.getCell('A3').value = `📦 المادة المحددة: ${itemName}`;
    worksheet.mergeCells(`D3:${getColLetter(totalCols)}3`); worksheet.getCell('D3').value = `⏳ نطاق التقرير: ${getDateRangeText()}`;

    [2, 3].forEach(rowIdx => {
      worksheet.getRow(rowIdx).height = 25;
      for (let col = 1; col <= totalCols; col++) {
        const cell = worksheet.getCell(rowIdx, col);
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF334155' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      }
    });
    worksheet.addRow([]); 

    const headerValues = ['#'];
    if (hasAgencyCol) headerValues.push('الوكالة');
    headerValues.push('القسم', 'المادة المطلوبة', 'الوحدة');
    if (isBranches) {
      branches.forEach(b => headerValues.push(b.cleanName));
    } else {
      weekdays.forEach(d => headerValues.push(d.name));
    }
    headerValues.push('المتوسط العام');

    const headerRow = worksheet.addRow(headerValues);
    headerRow.height = 35;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0369A1' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: {style:'medium', color:{argb:'FF075985'}}, bottom: {style:'medium', color:{argb:'FF075985'}}, left:{style:'thin'}, right:{style:'thin'} };
    });

    items.forEach((item, index) => {
      const rowValues: any[] = [index + 1];
      if (hasAgencyCol) rowValues.push(item.agencyName);
      rowValues.push(item.categoryName, item.name, item.mainUnit);

      const dynVals: any[] = [];
      if (isBranches) {
        branches.forEach(b => {
           const val = formatAvg(item.branchesSum[b.id] || 0, totalDaysCount);
           rowValues.push(val); dynVals.push(val);
        });
      } else {
        weekdays.forEach(d => {
           const val = formatAvg(item.weekdaysSum[d.id] || 0, weekdayCounts[d.id]);
           rowValues.push(val); dynVals.push(val);
        });
      }
      
      const totalAvg = formatAvg(item.totalSum, totalDaysCount);
      rowValues.push(totalAvg);

      const dataRow = worksheet.addRow(rowValues);
      dataRow.height = 28;
      const rowBg = index % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      dataRow.eachCell((cell, colNum) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: {style:'thin', color:{argb:'FFE2E8F0'}}, left: {style:'thin', color:{argb:'FFE2E8F0'}}, right: {style:'thin', color:{argb:'FFE2E8F0'}} };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.font = { name: 'Segoe UI', size: 11, color: { argb: 'FF334155' } };

        if (hasAgencyCol && colNum === 2) cell.font = { bold: true, color: { argb: 'FF1D4ED8' } };
        const catCol = hasAgencyCol ? 3 : 2;
        const nameCol = hasAgencyCol ? 4 : 3;
        const unitCol = hasAgencyCol ? 5 : 4;
        
        if (colNum === catCol) { cell.font = { bold: true }; } 
        if (colNum === nameCol) { cell.font = { bold: true, color: { argb: 'FF0F172A' } }; cell.alignment.horizontal = 'right'; }
        if (colNum === unitCol) { cell.font = { bold: true, color: { argb: 'FF059669' } }; }
        
        if (colNum > unitCol && colNum < totalCols) {
          if (cell.value !== '-') {
            cell.font = { bold: true, color: { argb: 'FFD97706' } };
          } else {
            cell.font = { color: { argb: 'FF94A3B8' } };
          }
        }

        if (colNum === totalCols) {
           cell.font = { bold: true, color: { argb: 'FF0369A1' }, size: 12 };
           cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
        }
      });
    });

    const footerValues: any[] = [];
    const footerSpan = baseColsCount - 1;
    footerValues[1] = 'المتوسط الكلي للسحوبات باليوم:';
    for (let i=2; i<=footerSpan; i++) footerValues[i] = '';

    if (isBranches) {
      branches.forEach(b => footerValues.push(formatAvg(branchTotals[b.id] || 0, totalDaysCount)));
    } else {
      weekdays.forEach(d => footerValues.push(formatAvg(weekdayTotals[d.id] || 0, weekdayCounts[d.id])));
    }
    footerValues.push(formatAvg(grandTotal, totalDaysCount));

    const footerRow = worksheet.addRow(footerValues);
    footerRow.height = 35;
    
    const mergeEndLetter = hasAgencyCol ? 'E' : 'D';
    worksheet.mergeCells(`A${footerRow.number}:${mergeEndLetter}${footerRow.number}`);
    
    footerRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', bold: true, size: 12, color: { argb: 'FF0284C7' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'medium', color: {argb: 'FF0369A1'} } };
      
      if (colNum === 1) cell.alignment.horizontal = 'right';
      if (colNum > footerSpan && colNum < totalCols && cell.value !== '-') cell.font.color = { argb: 'FFD97706' };
      if (colNum === totalCols) {
        cell.font = { bold: true, size: 14, color: { argb: 'FF075985' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBAE6FD' } };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `متوسط_الطلبات_${viewType === 'branches' ? 'الافروع' : 'الايام'}_${dayjs().format('YYYYMMDD')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (items.length === 0) return alert("لا توجد بيانات لطباعتها.");

    const isBranches = viewType === 'branches';
    const viewTitle = isBranches ? 'حسب الأفرع' : 'حسب أيام الأسبوع';
    const agencyTitle = activeAgencyTab !== 'الكل' ? `لوظائف وكالة (${activeAgencyTab})` : 'الكلي (كل الوكالات)';
    const branchName = getBranchFilterName();
    const itemName = itemFilter === 'الكل' ? 'كل المواد' : itemFilter;

    const hasAgencyCol = activeAgencyTab === 'الكل';
    const getColStyle = (widthPercent: number) => {
      return pdfSettings.autoFit ? `padding: 6px 4px;` : `width: ${widthPercent}%; padding: 6px 4px;`;
    };

    let dynamicHeaders = isBranches 
      ? branches.map(b => `<th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.dynamicColWidth)} background-color: #0284c7; color: white; word-break: break-word; white-space: normal;"><span style="font-size:13px; font-weight: 900;">${b.cleanName}</span>${b.agencyName && activeAgencyTab === 'الكل' ? `<span style="font-size:9px; color:#e0f2fe; display:block; line-height:1.2;">${b.agencyName}</span>` : ''}</th>`).join('')
      : weekdays.map(d => `<th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.dynamicColWidth)} background-color: #0284c7; color: white; font-size: 13px; font-weight: 900; word-break: break-word; white-space: normal;">${d.name}</th>`).join('');

    let tableRowsHTML = '';
    items.forEach((item, index) => {
      const rowClass = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      let dynamicCells = isBranches 
        ? branches.map(b => {
            const val = formatAvg(item.branchesSum[b.id] || 0, totalDaysCount);
            return `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: 900; color: ${val === '-' ? '#94a3b8' : '#d97706'}; border: 1px solid #e2e8f0; font-size: 14px;" dir="ltr">${val}</td>`;
          }).join('')
        : weekdays.map(d => {
            const val = formatAvg(item.weekdaysSum[d.id] || 0, weekdayCounts[d.id]);
            return `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: 900; color: ${val === '-' ? '#94a3b8' : '#d97706'}; border: 1px solid #e2e8f0; font-size: 14px;" dir="ltr">${val}</td>`;
          }).join('');

      tableRowsHTML += `
        <tr style="background-color: ${rowClass}; page-break-inside: avoid;">
          <td style="${getColStyle(pdfSettings.seqWidth)} color: #64748b; font-weight: bold; text-align: center; border: 1px solid #e2e8f0; font-size: 13px;">${index + 1}</td>
          ${hasAgencyCol ? `<td style="${getColStyle(pdfSettings.agencyWidth)} text-align: center; color: #1d4ed8; font-weight: bold; border: 1px solid #e2e8f0; font-size: 13px;">${item.agencyName}</td>` : ''}
          <td style="${getColStyle(pdfSettings.categoryWidth)} text-align: center; font-weight: bold; color: ${item.categoryColor}; border: 1px solid #e2e8f0; font-size: 13px;">${item.categoryName}</td>
          <td style="${getColStyle(pdfSettings.itemWidth)} font-weight: 900; color: #1e293b; text-align: right; border: 1px solid #e2e8f0; font-size: 15px; word-break: break-word;">${item.name}</td>
          <td style="${getColStyle(pdfSettings.unitWidth)} text-align: center; color: #059669; font-weight: 900; border: 1px solid #e2e8f0; font-size: 13px;">${item.mainUnit}</td>
          ${dynamicCells}
          <td style="${getColStyle(pdfSettings.totalWidth)} text-align: center; background-color: #e0f2fe; color: #0369a1; font-weight: 900; border: 1px solid #e2e8f0; font-size: 16px;" dir="ltr">${formatAvg(item.totalSum, totalDaysCount)}</td>
        </tr>
      `;
    });

    let dynamicFooterCells = isBranches
      ? branches.map(b => `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: 900; border: 1px solid #e2e8f0; font-size: 15px; color:#d97706;" dir="ltr">${formatAvg(branchTotals[b.id] || 0, totalDaysCount)}</td>`).join('')
      : weekdays.map(d => `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: 900; border: 1px solid #e2e8f0; font-size: 15px; color:#d97706;" dir="ltr">${formatAvg(weekdayTotals[d.id] || 0, weekdayCounts[d.id])}</td>`).join('');

    const baseColsCount = hasAgencyCol ? 5 : 4;

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>متوسط_الطلبات_${dayjs().format('YYYYMMDD')}</title>
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
               bottom: 0; left: 0; right: 0; 
               background: white; 
               padding-top: 6px; border-top: 2px solid #e2e8f0;
               z-index: 1000; justify-content: space-between;
               font-size: 13px; font-weight: 900; color: #64748b;
            }
            table { 
               width: 100% !important; max-width: 100% !important;
               table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'} !important; 
               border-collapse: collapse; page-break-inside: auto; 
            }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; } 
            th, td {
               word-wrap: break-word !important; word-break: break-word !important;
               white-space: normal !important; overflow-wrap: break-word !important;
            }
            .print-container { 
               padding-bottom: 50px; zoom: ${pdfSettings.zoom / 100}; 
               width: 100%; max-width: 100%; overflow: hidden;
               margin-right: ${pdfSettings.shiftX}mm;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 15px;">
              <div>
                <h1 style="margin: 0; color: #0369a1; font-size: 28px; font-weight: 900;">متوسط الطلبات (${viewTitle}) ${agencyTitle}</h1>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 15px; font-weight: bold;">تحليل التوزيع الجغرافي والزمني للمطبخ المركزي</p>
              </div>
              <div style="text-align: left;">
                <p style="margin: 0; color: #475569; font-size: 13px; font-weight: bold;">المطبخ المركزي</p>
                <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 11px;">تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>

            <div style="background: #f0f9ff; padding: 10px 15px; border-radius: 8px; border: 1px solid #bae6fd; margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; font-weight: bold; color: #075985;">
              <div style="background: white; border: 1px solid #7dd3fc; padding: 5px 12px; border-radius: 6px;">أيام العمل الفعلية: <span style="color: #0284c7; font-weight: 900;">${totalDaysCount} يوم</span></div>
              <div style="background: white; border: 1px solid #7dd3fc; padding: 5px 12px; border-radius: 6px;">الفرع المختار: <span style="color: #0284c7; font-weight: 900;">${branchName}</span></div>
              <div style="background: white; border: 1px solid #7dd3fc; padding: 5px 12px; border-radius: 6px;">المادة المحددة: <span style="color: #0284c7; font-weight: 900;">${itemName}</span></div>
              <div style="background: white; border: 1px solid #7dd3fc; padding: 5px 12px; border-radius: 6px;">نطاق التقرير: <span dir="ltr" style="color: #0284c7; font-weight: 900;">${getDateRangeText()}</span></div>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #0284c7; color: #ffffff;">
                  <th style="${getColStyle(pdfSettings.seqWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">ت</th>
                  ${hasAgencyCol ? `<th style="${getColStyle(pdfSettings.agencyWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">الوكالة</th>` : ''}
                  <th style="${getColStyle(pdfSettings.categoryWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">القسم</th>
                  <th style="${getColStyle(pdfSettings.itemWidth)} text-align: right; border: 1px solid #cbd5e1; font-size: 15px;">المادة المطلوبة</th>
                  <th style="${getColStyle(pdfSettings.unitWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">الوحدة</th>
                  ${dynamicHeaders}
                  <th style="${getColStyle(pdfSettings.totalWidth)} text-align: center; border: 1px solid #cbd5e1; background-color: #0369a1; font-size: 15px;">المتوسط العام</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHTML}
                <tr style="background-color: #e0f2fe; color: #0369a1; border-top: 2px solid #0284c7;">
                  <td colspan="${baseColsCount}" style="text-align: left; padding: 12px 15px; font-weight: 900; font-size: 15px; border: 1px solid #e2e8f0;">المتوسط الكلي للسحوبات باليوم:</td>
                  ${dynamicFooterCells}
                  <td style="padding: 12px 4px; text-align: center; font-weight: 900; font-size: 17px; border: 1px solid #e2e8f0; background-color: #bae6fd;" dir="ltr">${formatAvg(grandTotal, totalDaysCount)}</td>
                </tr>
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
  const dynamicHeadersCount = viewType === 'branches' ? branches.length : 7;
  const totalCalculatedWidth = pdfSettings.seqWidth + (hasAgency ? pdfSettings.agencyWidth : 0) + pdfSettings.categoryWidth + pdfSettings.itemWidth + pdfSettings.unitWidth + pdfSettings.totalWidth + (pdfSettings.dynamicColWidth * dynamicHeadersCount);

  if (!isMounted) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-all duration-300 ease-in-out ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-[140px]'}`} dir="rtl">
        
        {/* 🟢 الإشعاع الخلفي 🟢 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 dark:from-indigo-900/15 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-opacity duration-300 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`p-4 md:p-8 max-w-[100rem] mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* الترويسة العليا */}
          <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 w-full transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            
            {/* 💡 القسم الأيمن: زر المكتبة + العنوان 💡 */}
            <div className="flex items-center gap-4 text-right w-full md:w-auto">
              <Link href="/hub" className="bg-white dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-300 dark:bg-white/10 hidden md:block"></div>

              <div className="bg-indigo-50 dark:bg-indigo-500/20 p-4 rounded-[1.3rem] text-indigo-600 dark:text-indigo-400 shadow-inner border border-indigo-200 dark:border-indigo-500/30 shrink-0 flex items-center justify-center">
                <TrendingUp className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-1 truncate tracking-tight">متوسط الطلبات</h2>
                <p className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 truncate">تحليل وحساب المتوسط اليومي للطلبات.</p>
              </div>
            </div>

            {/* أزرار الطباعة والتصدير وإعداداتها (ملونة وواضحة) */}
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-white dark:bg-[#121214] p-2 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                
                <button 
                  onClick={() => setShowPdfSettings(!showPdfSettings)} 
                  title="إعدادات القياس للـ PDF"
                  className={`p-3.5 rounded-xl transition-all border outline-none 
                    ${showPdfSettings 
                      ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30 shadow-inner' 
                      : 'bg-slate-50 dark:bg-indigo-500/5 text-slate-500 dark:text-indigo-400/80 border-slate-200 dark:border-indigo-500/10 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 hover:border-indigo-200 dark:hover:border-indigo-500/30'}`}
                >
                  <Settings className={`w-5 h-5 transition-transform duration-300 ${showPdfSettings ? 'rotate-90' : ''}`} />
                </button>

                <button onClick={handleExportPDF} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-500/5 text-rose-600 dark:text-rose-400/80 border border-rose-200 dark:border-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/15 hover:border-rose-300 dark:hover:border-rose-500/30 hover:text-rose-700 dark:hover:text-rose-400 px-5 py-3.5 rounded-xl font-black text-sm transition-all active:scale-95 outline-none shadow-inner">
                  <Printer className="w-5 h-5" /> طباعة تقرير (PDF)
                </button>
                <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400/80 border border-emerald-200 dark:border-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:text-emerald-700 dark:hover:text-emerald-400 px-5 py-3.5 rounded-xl font-black text-sm transition-all active:scale-95 outline-none shadow-inner">
                  <FileSpreadsheet className="w-5 h-5" /> تصدير لجداول (Excel)
                </button>
                
                {/* 💡 زر وضع التركيز 💡 */}
                <button onClick={() => setIsZenMode(true)} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-500/20 hover:bg-slate-200 dark:hover:bg-slate-500/20 hover:border-slate-400 dark:hover:border-slate-500/30 hover:text-slate-900 dark:hover:text-white px-5 py-3.5 rounded-xl font-black text-[13px] transition-all outline-none hidden md:flex shadow-inner">
                  <Eye className="w-4 h-4" /> وضع التركيز
                </button>
              </div>

              {showPdfSettings && (
                <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-2xl flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2"><Settings className="w-4 h-4"/> إعدادات الطباعة المتقدمة (تُحفظ تلقائياً)</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10">
                      <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase">حجم الورق</label>
                      <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-indigo-400 cursor-pointer appearance-none hover:bg-indigo-100 dark:hover:bg-indigo-500/10 transition-colors">
                        <option value="A3" className="bg-white dark:bg-[#121214]">A3 (أفضل للأفرع الكثيرة)</option>
                        <option value="A4" className="bg-white dark:bg-[#121214]">A4 (ورق قياسي)</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 uppercase">هوامش الورقة</label>
                      <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-indigo-400 cursor-pointer appearance-none hover:bg-indigo-100 dark:hover:bg-indigo-500/10 transition-colors">
                        <option value="0mm" className="bg-white dark:bg-[#121214]">بدون هوامش (0mm)</option>
                        <option value="2mm" className="bg-white dark:bg-[#121214]">ضيقة جداً (2mm)</option>
                        <option value="5mm" className="bg-white dark:bg-[#121214]">ضيقة (5mm)</option>
                        <option value="10mm" className="bg-white dark:bg-[#121214]">عادية (10mm)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none ${pdfSettings.autoFit ? 'bg-indigo-100 dark:bg-indigo-500/20 border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400' : 'bg-slate-50 dark:bg-indigo-500/5 border-slate-200 dark:border-indigo-500/20 text-slate-500 dark:text-indigo-400/70 hover:bg-slate-100 dark:hover:bg-indigo-500/10 hover:text-slate-700 dark:hover:text-indigo-400'}`}>
                        <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                        <span className="bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/30" dir="ltr">{pdfSettings.shiftX} mm</span>
                      </div>
                      <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-indigo-500 dark:accent-indigo-400 h-2 bg-slate-100 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer mt-1 border border-slate-200 dark:border-white/10" />
                      <div className="flex justify-between text-[9px] font-bold text-slate-400"><span>إلى اليمين (-50)</span><span>إلى اليسار (+50)</span></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <hr className="flex-1 border-slate-200 dark:border-white/5" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">إعدادات الأعمدة (تعمل مع الاحتواء اليدوي)</span>
                    <hr className="flex-1 border-slate-200 dark:border-white/5" />
                  </div>

                  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    
                    <div className="flex flex-col gap-2 w-full col-span-1 sm:col-span-2 lg:col-span-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                        <span className="bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/30">{pdfSettings.zoom}%</span>
                      </div>
                      <input type="range" min="30" max="100" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-indigo-500 dark:accent-indigo-400 h-2 bg-slate-100 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/10" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">عرض التسلسل (ت)</label>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{pdfSettings.seqWidth}%</span>
                      </div>
                      <input type="range" min="1" max="10" value={pdfSettings.seqWidth} onChange={e => updatePdfSetting('seqWidth', Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    {hasAgency && (
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">عرض الوكالة</label>
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{pdfSettings.agencyWidth}%</span>
                        </div>
                        <input type="range" min="3" max="20" value={pdfSettings.agencyWidth} onChange={e => updatePdfSetting('agencyWidth', Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                      </div>
                    )}

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">عرض القسم</label>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{pdfSettings.categoryWidth}%</span>
                      </div>
                      <input type="range" min="4" max="20" value={pdfSettings.categoryWidth} onChange={e => updatePdfSetting('categoryWidth', Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">عرض المادة</label>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{pdfSettings.itemWidth}%</span>
                      </div>
                      <input type="range" min="10" max="40" value={pdfSettings.itemWidth} onChange={e => updatePdfSetting('itemWidth', Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">عرض الوحدة</label>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{pdfSettings.unitWidth}%</span>
                      </div>
                      <input type="range" min="3" max="15" value={pdfSettings.unitWidth} onChange={e => updatePdfSetting('unitWidth', Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">عرض الإجمالي</label>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">{pdfSettings.totalWidth}%</span>
                      </div>
                      <input type="range" min="4" max="20" value={pdfSettings.totalWidth} onChange={e => updatePdfSetting('totalWidth', Number(e.target.value))} className="w-full accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">عرض (حقل الفرع/اليوم)</label>
                        <span className="bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/30">{pdfSettings.dynamicColWidth}%</span>
                      </div>
                      <input type="range" min="2" max="25" value={pdfSettings.dynamicColWidth} onChange={e => updatePdfSetting('dynamicColWidth', Number(e.target.value))} className="w-full accent-indigo-500 dark:accent-indigo-400 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>
                  </div>

                  {!pdfSettings.autoFit && (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                      <span>مجموع النسب المئوية للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-600 dark:text-emerald-500'}`}>{totalCalculatedWidth}%</span></span>
                      {totalCalculatedWidth > 100 ? (
                        <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيقوم بضغط الجدول إجبارياً)</span>
                      ) : (
                        <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5">✅ ممتاز (الجدول سيظهر بشكل مثالي في الورقة)</span>
                      )}
                    </div>
                  )}
                  {pdfSettings.autoFit && (
                    <div className="p-3 rounded-xl border bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-black text-center">
                      تم تفعيل "الاحتواء التلقائي" - سيقوم المتصفح بضبط وتوزيع الأعمدة أوتوماتيكياً بناءً على محتوى الكلمات، وتم إيقاف النسب اليدوية مؤقتاً.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={`bg-white dark:bg-[#121214] p-6 rounded-[2.5rem] mb-8 border border-slate-200 dark:border-white/10 flex flex-col gap-5 w-full shadow-sm dark:shadow-2xl transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none p-0' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-white/5 pb-5">
              <div className="flex items-center gap-2 font-black text-slate-500 dark:text-slate-400 text-base">
                <Filter className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> فرز وتحديد النطاق:
              </div>
              
              <div className="flex flex-col 2xl:flex-row gap-3 items-center w-full md:w-auto flex-wrap justify-end">
                
                {/* أزرار نوع العرض (ملونة وبارزة) */}
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-x-auto hide-scrollbar max-w-full w-full lg:w-fit shrink-0">
                  <span className="text-xs font-black text-slate-500 px-2 shrink-0">نوع العرض:</span>
                  <button 
                    onClick={() => setViewType('weekdays')}
                    className={`px-4 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 shrink-0 outline-none border 
                      ${viewType === 'weekdays' 
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-[#050505] shadow-[0_0_10px_rgba(99,102,241,0.4)] border-indigo-500 dark:border-indigo-400 scale-[1.02]' 
                        : 'bg-white dark:bg-indigo-500/5 text-slate-600 dark:text-indigo-400/70 hover:bg-slate-100 dark:hover:bg-indigo-500/10 hover:text-slate-900 dark:hover:text-indigo-300 border-slate-200 dark:border-indigo-500/10 shadow-sm dark:shadow-inner'}`}
                  >
                    حسب أيام الأسبوع
                  </button>
                  <button 
                    onClick={() => setViewType('branches')}
                    className={`px-4 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 shrink-0 outline-none border 
                      ${viewType === 'branches' 
                        ? 'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-[#050505] shadow-[0_0_10px_rgba(99,102,241,0.4)] border-indigo-500 dark:border-indigo-400 scale-[1.02]' 
                        : 'bg-white dark:bg-indigo-500/5 text-slate-600 dark:text-indigo-400/70 hover:bg-slate-100 dark:hover:bg-indigo-500/10 hover:text-slate-900 dark:hover:text-indigo-300 border-slate-200 dark:border-indigo-500/10 shadow-sm dark:shadow-inner'}`}
                  >
                    حسب الأفرع
                  </button>
                </div>
                
                {/* أزرار نطاق التاريخ (ملونة وبارزة) */}
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-x-auto hide-scrollbar max-w-full w-full lg:w-fit shrink-0">
                  <div className="px-2 text-[11px] font-black text-slate-500 flex items-center gap-1 shrink-0">
                    <CalendarDays className="w-4 h-4" /> النطاق:
                  </div>
                  {['7days', '14days', '21days', '28days', 'month', 'all'].map((rangeType) => {
                    const isActive = activeDateRange === rangeType;
                    const label = rangeType === '7days' ? 'آخر 7 أيام' : rangeType === '14days' ? '14 يوم' : rangeType === '21days' ? '21 يوم' : rangeType === '28days' ? '28 يوم' : rangeType === 'month' ? 'الشهر' : 'كل الأيام';
                    return (
                      <button 
                        key={rangeType}
                        onClick={() => applyDateRange(rangeType as any)} 
                        className={`px-4 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 shrink-0 outline-none border 
                          ${isActive 
                            ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 shadow-sm dark:shadow-[0_0_10px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/20 scale-[1.02]' 
                            : 'bg-white dark:bg-indigo-500/5 text-slate-500 dark:text-indigo-400/60 hover:bg-slate-100 dark:hover:bg-indigo-500/15 hover:text-slate-700 dark:hover:text-indigo-300 border-slate-200 dark:border-indigo-500/10 shadow-sm dark:shadow-inner'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* 💡 التقويم السريع بالأاتجاهات 💡 */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] shrink-0 w-full lg:w-auto justify-between">
                  <button onClick={() => shiftMonth(-1)} className="p-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/30 outline-none">
                    <ChevronRight className="w-4 h-4"/>
                  </button>
                  
                  <div className="flex flex-col items-center justify-center min-w-[110px] px-2 cursor-pointer group/month" onClick={() => openDatePicker('start')}>
                    <span className="text-[9px] font-black text-indigo-500/60 uppercase tracking-widest mb-0.5 transition-colors group-hover/month:text-indigo-500/80">شهر التحليل</span>
                    <span className="font-black text-[13px] text-indigo-700 dark:text-indigo-300 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(99,102,241,0.4)] transition-colors group-hover/month:text-indigo-600 dark:group-hover/month:text-indigo-200">
                      {startDate ? dayjs(startDate).format('MMMM YYYY') : 'مخصص'}
                    </span>
                  </div>

                  <button onClick={() => shiftMonth(1)} disabled={dayjs(startDate).isSame(dayjs(), 'month')} className="p-2 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/30 outline-none disabled:opacity-30 disabled:pointer-events-none">
                    <ChevronLeft className="w-4 h-4"/>
                  </button>
                </div>

              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full relative">
              <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row gap-3">
                <div onClick={() => openDatePicker('start')} className="relative flex-1 h-14 bg-white dark:bg-indigo-500/5 rounded-[1.5rem] border border-slate-200 dark:border-indigo-500/20 shadow-sm dark:shadow-inner flex items-center px-4 hover:bg-slate-50 dark:hover:bg-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors cursor-pointer group">
                  <Calendar className="w-5 h-5 text-indigo-500 ml-3 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col z-10 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-indigo-500/70">من تاريخ</span>
                    <span className={`font-black text-[15px] dir-ltr text-right tracking-widest ${startDate ? 'text-slate-800 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>
                      {startDate ? dayjs(startDate).format('DD / MM / YYYY') : 'اختر التاريخ'}
                    </span>
                  </div>
                </div>

                <div onClick={() => openDatePicker('end')} className="relative flex-1 h-14 bg-white dark:bg-indigo-500/5 rounded-[1.5rem] border border-slate-200 dark:border-indigo-500/20 shadow-sm dark:shadow-inner flex items-center px-4 hover:bg-slate-50 dark:hover:bg-indigo-500/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors cursor-pointer group">
                  <Calendar className="w-5 h-5 text-indigo-500 ml-3 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col z-10 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-indigo-500/70">إلى تاريخ</span>
                    <span className={`font-black text-[15px] dir-ltr text-right tracking-widest ${endDate ? 'text-slate-800 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>
                      {endDate ? dayjs(endDate).format('DD / MM / YYYY') : 'اختر التاريخ'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-indigo-500/20 shadow-sm dark:shadow-inner h-14 flex items-center group/select focus-within:border-indigo-400 dark:focus-within:border-indigo-500/50 transition-colors">
                <div className="absolute right-4 text-slate-400 dark:text-indigo-500/70 pointer-events-none group-focus-within/select:text-indigo-600 dark:group-focus-within/select:text-indigo-400 transition-colors"><Store className="w-5 h-5" /></div>
                <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-800 dark:text-indigo-100 text-sm appearance-none cursor-pointer">
                  <option value="الكل" className="bg-white dark:bg-[#121214]">كل الفروع</option>
                  {uniqueBranchesDropdown.map(b => <option key={b.id} value={b.id} className="bg-white dark:bg-[#121214]">{b.name}</option>)}
                </select>
                <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-indigo-500/50 pointer-events-none group-focus-within/select:text-indigo-600 dark:group-focus-within/select:text-indigo-400 transition-colors" />
              </div>

              <div className="relative bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-indigo-500/20 shadow-sm dark:shadow-inner h-14 flex items-center group/select focus-within:border-indigo-400 dark:focus-within:border-indigo-500/50 transition-colors">
                <div className="absolute right-4 text-slate-400 dark:text-indigo-500/70 pointer-events-none group-focus-within/select:text-indigo-600 dark:group-focus-within/select:text-indigo-400 transition-colors"><Package className="w-5 h-5" /></div>
                <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-800 dark:text-indigo-100 text-[13px] appearance-none cursor-pointer">
                  <option value="الكل" className="bg-white dark:bg-[#121214]">كل المواد</option>
                  {uniqueItemsDropdown.map(item => <option key={item} value={item} className="bg-white dark:bg-[#121214]">{item}</option>)}
                </select>
                <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-indigo-500/50 pointer-events-none group-focus-within/select:text-indigo-600 dark:group-focus-within/select:text-indigo-400 transition-colors" />
              </div>

              {/* 💡 زر تفريغ الفلاتر الجديد والمصغر 💡 */}
              {(startDate !== '' || endDate !== '' || branchFilter !== 'الكل' || itemFilter !== 'الكل' || activeAgencyTab !== 'الكل' || categoryFilter !== 'الكل') && (
                 <div className="lg:absolute lg:-bottom-12 lg:left-0 flex justify-end mt-2 lg:mt-0">
                    <button onClick={clearFilters} className="h-10 flex items-center justify-center gap-1.5 px-4 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors w-full md:w-auto outline-none shadow-sm">
                       <RotateCcw className="w-3.5 h-3.5" /> مسح الفلاتر
                    </button>
                 </div>
              )}
            </div>
            
            <div className="mt-6 flex items-center justify-center sm:justify-start gap-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 p-3 rounded-2xl w-fit shadow-sm">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                أيام العمل الفعلية المحسوبة: <span className="text-indigo-600 dark:text-indigo-500 font-black px-2 text-base bg-white dark:bg-[#0a0a0c] border border-indigo-200 dark:border-indigo-500/30 rounded-lg shadow-sm ml-1 en-num">{totalDaysCount}</span> يوم
              </span>
            </div>
          </div>

          {dbError && (
            <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-sm dark:shadow-2xl w-full">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500" />
              <p>{dbError}</p>
            </div>
          )}

          {!dbError && isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 w-full">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            </div>
          ) : !dbError && (
            <div className={`transition-all duration-300 ${isZenMode ? 'bg-white dark:bg-black border border-slate-200 dark:border-white/5 rounded-2xl shadow-none' : 'bg-white dark:bg-[#121214] p-4 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-2xl border border-slate-200 dark:border-white/10'} w-full min-h-[400px]`}>
              
              <div className={`flex items-center justify-between mb-6 pb-5 border-b border-slate-100 dark:border-white/5 transition-colors ${isZenMode ? 'px-4 pt-4 border-none' : ''}`}>
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">جدول متوسط التوزيع</h3>
                </div>
                <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-5 py-2 rounded-xl font-black text-sm border border-indigo-200 dark:border-indigo-500/20 shadow-sm dark:shadow-none">
                  <span className="en-num ml-1">{items.length}</span> مادة معروضة
                </span>
              </div>

              {/* 💡 أزرار فلترة الوكالات 💡 */}
              <div className={`flex flex-wrap items-center gap-2 mb-4 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none p-0' : 'scale-y-100 opacity-100'}`}>
                <button 
                  onClick={() => { setActiveAgencyTab('الكل'); setCategoryFilter('الكل'); setItemFilter('الكل'); }}
                  className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-300 flex items-center gap-2 outline-none border ${
                    activeAgencyTab === 'الكل' 
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 shadow-sm dark:shadow-[0_0_10px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/20 scale-[1.02]' 
                    : 'bg-slate-50 dark:bg-indigo-500/5 text-slate-600 dark:text-indigo-400/60 border-slate-200 dark:border-indigo-500/10 hover:bg-slate-100 dark:hover:bg-indigo-500/15 hover:border-slate-300 dark:hover:border-indigo-500/30 hover:text-slate-800 dark:hover:text-indigo-300 shadow-sm dark:shadow-inner'
                  }`}
                >
                  <Building2 className="w-4 h-4" /> كل الوكالات
                </button>
                
                {uniqueAgenciesList.map(agency => (
                  <button 
                    key={agency}
                    onClick={() => { setActiveAgencyTab(agency); setCategoryFilter('الكل'); setItemFilter('الكل'); }}
                    className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-300 outline-none border ${
                      activeAgencyTab === agency 
                      ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-500/40 shadow-sm dark:shadow-[0_0_10px_rgba(99,102,241,0.2)] ring-1 ring-indigo-500/20 scale-[1.02]' 
                      : 'bg-slate-50 dark:bg-indigo-500/5 text-slate-600 dark:text-indigo-400/60 border-slate-200 dark:border-indigo-500/10 hover:bg-slate-100 dark:hover:bg-indigo-500/15 hover:border-slate-300 dark:hover:border-indigo-500/30 hover:text-slate-800 dark:hover:text-indigo-300 shadow-sm dark:shadow-inner'
                    }`}
                  >
                    {agency}
                  </button>
                ))}
              </div>

              {/* 💡 أزرار فلترة الأقسام التابعة للوكالة المحددة 💡 */}
              {quickCategoriesTabs.length > 0 && (
                <div className={`flex flex-wrap items-center gap-2 mb-6 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none p-0' : 'scale-y-100 opacity-100'}`}>
                  <button 
                    onClick={() => { setCategoryFilter('الكل'); setItemFilter('الكل'); }}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all duration-300 flex items-center gap-2 outline-none border ${
                      categoryFilter === 'الكل' 
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 shadow-sm dark:shadow-[0_0_10px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/20 scale-[1.02]' 
                      : 'bg-slate-50 dark:bg-emerald-500/5 text-slate-600 dark:text-emerald-400/60 border-slate-200 dark:border-emerald-500/10 hover:bg-slate-100 dark:hover:bg-emerald-500/15 hover:border-slate-300 dark:hover:border-emerald-500/30 hover:text-slate-800 dark:hover:text-emerald-300 shadow-sm dark:shadow-inner'
                    }`}
                  >
                    <Layers className="w-4 h-4" /> كل الأقسام
                  </button>
                  
                  {quickCategoriesTabs.map(c => (
                    <button 
                      key={c.name}
                      onClick={() => { setCategoryFilter(c.name); setItemFilter('الكل'); }}
                      className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all duration-300 outline-none border flex items-center gap-1.5 group ${
                        categoryFilter === c.name 
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 shadow-sm dark:shadow-[0_0_10px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/20 scale-[1.02]' 
                        : 'bg-slate-50 dark:bg-emerald-500/5 text-slate-600 dark:text-emerald-400/60 border-slate-200 dark:border-emerald-500/10 hover:bg-slate-100 dark:hover:bg-emerald-500/15 hover:border-slate-300 dark:hover:border-emerald-500/30 hover:text-slate-800 dark:hover:text-emerald-300 shadow-sm dark:shadow-inner'
                      }`}
                    >
                      {c.name}
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] en-num transition-colors ${categoryFilter === c.name ? 'bg-emerald-200 dark:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200' : 'bg-slate-200 dark:bg-emerald-500/10 text-slate-500 dark:text-emerald-500/50 group-hover:text-slate-700 dark:group-hover:text-emerald-400/80'}`}>
                        {c.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className={`transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none p-0' : 'scale-y-100 opacity-100'}`}>
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-4 py-2 rounded-xl text-xs font-bold w-fit mb-4 shadow-sm dark:shadow-none">
                  <ArrowRightLeft className="w-4 h-4 animate-pulse" /> 
                  اسحب الجدول يميناً ويساراً (Scroll) لرؤية كافة الأعمدة المخفية
                </div>
              </div>

              {items.length === 0 ? (
                <div className="py-24 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0a0a0c] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10">
                  <PackageSearch className="w-20 h-20 mx-auto mb-5 opacity-30 text-indigo-500" />
                  <p className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">لا توجد مسحوبات مطابقة للبحث</p>
                  <p className="text-sm font-bold text-slate-500">حاول تغيير نطاق التاريخ أو إزالة الفلاتر المحددة.</p>
                </div>
              ) : (
                <div className={`overflow-x-auto w-full custom-scrollbar pb-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner bg-white dark:bg-[#0a0a0c]/50 ${isZenMode ? 'min-h-[85vh]' : ''}`}>
                  <table className="w-full text-right border-collapse min-w-max">
                    <thead className={`text-slate-600 dark:text-slate-300 font-black text-[12px] uppercase ${isZenMode ? 'bg-slate-100 border-b border-slate-200 dark:bg-black dark:border-white/10' : 'bg-slate-100 dark:bg-[#121214]'}`}>
                      <tr>
                        <th className={`py-4 px-3 border border-slate-200 dark:border-white/10 text-center sticky right-0 z-20 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.5)] ${isZenMode ? 'bg-slate-100 dark:bg-black' : 'bg-slate-100 dark:bg-[#121214]'}`}>ت</th>
                        
                        {activeAgencyTab === 'الكل' && (
                          <th className="py-4 px-4 border border-slate-200 dark:border-white/10 text-center">الوكالة</th>
                        )}
                        
                        <th className="py-4 px-4 border border-slate-200 dark:border-white/10 text-center">القسم</th>
                        <th className="py-4 px-5 border border-slate-200 dark:border-white/10 text-right min-w-[200px]">المادة المطلوبة</th>
                        <th className="py-4 px-4 border border-slate-200 dark:border-white/10 text-center text-emerald-600 dark:text-emerald-400">وحدة الحساب</th>
                        
                        {viewType === 'branches' 
                          ? branches.map(branch => (
                              <th key={branch.id} className={`py-4 px-2 border border-slate-200 dark:border-white/10 text-center min-w-[70px] max-w-[120px] align-bottom transition-colors ${isZenMode ? '' : 'hover:bg-slate-200 dark:hover:bg-white/5'}`}>
                                <div className="flex flex-col items-center justify-end gap-1 h-full">
                                  {branch.agencyName && activeAgencyTab === 'الكل' && (
                                    <span className="text-[10px] text-indigo-600 dark:text-blue-400 font-bold leading-tight whitespace-normal">{branch.agencyName}</span>
                                  )}
                                  <span className="text-indigo-700 dark:text-cyan-400 font-black text-[14px] leading-tight whitespace-normal">{branch.cleanName}</span>
                                </div>
                              </th>
                            ))
                          : weekdays.map(day => (
                              <th key={day.id} className={`py-4 px-3 border border-slate-200 dark:border-white/10 text-center text-indigo-700 dark:text-cyan-400 font-black text-[14px] min-w-[80px] transition-colors ${isZenMode ? '' : 'hover:bg-slate-200 dark:hover:bg-white/5'}`}>
                                {day.name}
                              </th>
                            ))
                        }
                        
                        <th className="py-4 px-4 bg-indigo-50 dark:bg-cyan-500/10 border border-slate-200 dark:border-white/10 text-indigo-700 dark:text-cyan-300 text-center sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.5)]">المتوسط العام</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y text-[13px] ${isZenMode ? 'divide-slate-200 border-b border-slate-200 dark:divide-white/5 dark:border-white/5' : 'divide-slate-100 border-b border-slate-200 dark:divide-white/10 dark:border-white/10'}`}>
                      {items.map((item, index) => (
                        <tr key={item.id} className={`group transition-colors ${isZenMode ? 'hover:bg-slate-50 bg-white dark:hover:bg-white/5 dark:bg-transparent' : 'hover:bg-slate-50 bg-white dark:hover:bg-[#121214] dark:bg-[#0a0a0c]'}`}>
                          <td className={`py-3 px-3 text-slate-500 dark:text-slate-400 font-black text-sm text-center sticky right-0 border border-slate-200 dark:border-white/10 z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.5)] transition-colors ${isZenMode ? 'bg-white group-hover:bg-slate-50 dark:bg-black dark:group-hover:bg-white/5' : 'bg-white group-hover:bg-slate-50 dark:bg-[#0a0a0c] dark:group-hover:bg-[#121214]'}`}>{index + 1}</td>
                          
                          {activeAgencyTab === 'الكل' && (
                            <td className="py-3 px-4 font-black text-indigo-600 dark:text-blue-400 text-[13px] text-center whitespace-nowrap border border-slate-200 dark:border-white/10">{item.agencyName}</td>
                          )}
                          
                          <td className="py-3 px-4 font-black text-center whitespace-nowrap border border-slate-200 dark:border-white/10" style={{ color: item.categoryColor }}>{item.categoryName}</td>
                          <td className="py-3 px-5 font-black text-slate-800 dark:text-slate-200 text-[15px] whitespace-normal border border-slate-200 dark:border-white/10">
                            {item.name}
                          </td>
                          <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-black text-[13px] text-center border border-slate-200 dark:border-white/10">
                            {item.mainUnit}
                          </td>
                          
                          {viewType === 'branches'
                            ? branches.map(branch => {
                                const val = formatAvg(item.branchesSum[branch.id] || 0, totalDaysCount);
                                return (
                                  <td key={branch.id} className="py-3 px-2 text-center border border-slate-200 dark:border-white/10">
                                    {val !== '-' ? (
                                      <span className="font-black text-[15px] en-num inline-block text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-[#121214] px-2 py-1 rounded-lg border border-amber-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                                        {val}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700 font-black bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-lg border border-transparent">-</span>
                                    )}
                                  </td>
                                )
                              })
                            : weekdays.map(day => {
                                const val = formatAvg(item.weekdaysSum[day.id] || 0, weekdayCounts[day.id]);
                                return (
                                  <td key={day.id} className="py-3 px-2 text-center border border-slate-200 dark:border-white/10">
                                    {val !== '-' ? (
                                      <span className="font-black text-[15px] en-num inline-block text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-[#121214] px-2 py-1 rounded-lg border border-amber-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                                        {val}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-700 font-black bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-lg border border-transparent">-</span>
                                    )}
                                  </td>
                                )
                              })
                          }
                          
                          <td className={`py-3 px-4 text-center border border-slate-200 dark:border-white/10 sticky left-0 z-10 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.5)] transition-colors ${isZenMode ? 'bg-indigo-50/50 group-hover:bg-indigo-50 dark:bg-cyan-500/5 dark:group-hover:bg-cyan-500/10' : 'bg-indigo-50/50 group-hover:bg-indigo-50 dark:bg-cyan-500/5 dark:group-hover:bg-cyan-500/10'}`}>
                            <span className="font-black text-indigo-700 dark:text-cyan-300 text-[16px] en-num bg-indigo-100 dark:bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-cyan-500/20 shadow-sm dark:shadow-inner inline-block">
                              {formatAvg(item.totalSum, totalDaysCount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    
                    <tfoot>
                      <tr className={`${isZenMode ? 'bg-slate-100 border-t-2 border-indigo-200 dark:bg-black dark:border-cyan-500/50' : 'bg-slate-100 dark:bg-[#121214] border-t-[3px] border-indigo-300 dark:border-cyan-500/50'}`}>
                        <td colSpan={activeAgencyTab === 'الكل' ? 5 : 4} className={`py-4 px-5 font-black text-slate-800 dark:text-white text-[15px] text-left border border-slate-200 dark:border-white/10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.5)] ${isZenMode ? 'bg-slate-100 dark:bg-black' : ''}`}>
                          المتوسط الكلي للسحوبات باليوم:
                        </td>
                        
                        {viewType === 'branches'
                          ? branches.map(branch => (
                              <td key={branch.id} className={`py-4 px-3 text-center border border-slate-200 dark:border-white/10 ${isZenMode ? 'bg-slate-100 dark:bg-black' : 'bg-slate-50 dark:bg-[#0a0a0c]'}`}>
                                <span className="font-black text-amber-600 dark:text-amber-500 text-lg en-num bg-white dark:bg-[#121214] px-3 py-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                                  {formatAvg(branchTotals[branch.id] || 0, totalDaysCount)}
                                </span>
                              </td>
                            ))
                          : weekdays.map(day => (
                              <td key={day.id} className={`py-4 px-3 text-center border border-slate-200 dark:border-white/10 ${isZenMode ? 'bg-slate-100 dark:bg-black' : 'bg-slate-50 dark:bg-[#0a0a0c]'}`}>
                                <span className="font-black text-amber-600 dark:text-amber-500 text-lg en-num bg-white dark:bg-[#121214] px-3 py-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                                  {formatAvg(weekdayTotals[day.id] || 0, weekdayCounts[day.id])}
                                </span>
                              </td>
                            ))
                        }
                        
                        <td className={`py-4 px-4 text-center border border-slate-200 dark:border-white/10 sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.5)] ${isZenMode ? 'bg-indigo-100 dark:bg-cyan-500/5' : 'bg-indigo-100 dark:bg-cyan-500/10'}`}>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[11px] font-black text-indigo-600 dark:text-cyan-400">المجموع الكلي</span>
                            <span className="font-black text-indigo-900 dark:text-white text-2xl en-num block drop-shadow-sm dark:drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]">
                              {formatAvg(grandTotal, totalDaysCount)}
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
              className="flex items-center gap-2 bg-white text-black px-6 py-3.5 rounded-full font-black text-sm shadow-[0_10px_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all outline-none"
            >
              <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

        {/* ======================================================= */}
        {/* 🟢 التقويم المؤسساتي الشامل المبرمج (تم حل التمركز) 🟢 */}
        {/* ======================================================= */}
        {datePickerConfig.isOpen && !isZenMode && (
          <div className="fixed top-0 left-0 w-full h-[100dvh] z-[999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden">
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
                          setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'date'}));
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
                      
                      const isSelected = dateStr === (datePickerConfig.target === 'start' ? startDate : endDate);
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

        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
        `}} />
      </div>
    </div>
  );
}