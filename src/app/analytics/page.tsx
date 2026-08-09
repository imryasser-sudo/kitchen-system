"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Archive, Loader2, AlertCircle, Calendar, 
  TrendingUp, TrendingDown, Minus, Activity, Filter, ArrowRightLeft, Target, 
  ArrowUpRight, ArrowDownRight, Zap, LineChart, Award, PackageSearch, Store, ChevronDown, CalendarDays, BarChart2, Layers,
  FileSpreadsheet, RotateCcw, FileText, Search, FileClock, LayoutGrid, ReceiptText,
  Hash, Trophy, ChevronLeft, ChevronRight, Eye, EyeOff
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

import { useReactToPrint } from 'react-to-print';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

dayjs.locale('ar');

const roundNumber = (num: number) => Math.round(num * 1000) / 1000;
const formatNum = (num: number) => Number(num).toLocaleString('en-US', { maximumFractionDigits: 2 });

const getColLetter = (colIndex: number) => {
  let temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp - 1) / 26);
  }
  return letter;
};

interface DbItem {
  id: string;
  name: string;
  agency_id: string;
  agencyName?: string;
  sequence: number;
  categories?: { name: string, color: string, sequence: number };
  main_unit?: string;
}

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

type PickerTarget = 'periodAStart' | 'periodAEnd' | 'periodBStart' | 'periodBEnd' | 'selectedMonth' | 'traceStartDate' | 'traceEndDate';

export default function AnalyticsPage() {
  const pathname = usePathname();
  
  // 💡 حالة وضع التركيز (Zen Mode) 💡
  const [isZenMode, setIsZenMode] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [allItemsDb, setAllItemsDb] = useState<DbItem[]>([]);
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<'comparison' | 'monthly' | 'item_trace'>('comparison');

  const [periodAStart, setPeriodAStart] = useState<string>(dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'));
  const [periodAEnd, setPeriodAEnd] = useState<string>(dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'));
  const [periodBStart, setPeriodBStart] = useState<string>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [periodBEnd, setPeriodBEnd] = useState<string>(dayjs().format('YYYY-MM-DD'));

  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'));

  const [traceItemFilter, setTraceItemFilter] = useState<string>('');
  const [traceStartDate, setTraceStartDate] = useState<string>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [traceEndDate, setTraceEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  const [agencyFilter, setAgencyFilter] = useState<string>('الكل');
  const [branchFilter, setBranchFilter] = useState<string>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [itemFilter, setItemFilter] = useState<string>('الكل');

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, 
    target: PickerTarget, 
    viewDate: dayjs.Dayjs, 
    mode: 'date' | 'month' | 'year'
  }>({ isOpen: false, target: 'periodAStart', viewDate: dayjs(), mode: 'date' });

  const printRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      // 💡 قمنا بإضافة استدعاء (invoice_number, order_type) من قاعدة البيانات لتضمينها في التحليلات 💡
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`id, branch_id, status, created_at, invoice_number, order_type, order_details (item_id, quantity)`)
        .limit(15000)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      const validOrders = (ordersData || []).filter(order => order.status !== 'pending' && order.status !== 'rejected');

      const { data: agenciesData, error: agenciesError } = await supabase.from('agencies').select('id, name');
      if (agenciesError) throw agenciesError;

      const { data: branchesData, error: branchesError } = await supabase.from('branches').select('id, name, agency_id').order('name');
      if (branchesError) throw branchesError;

      const { data: itemsData, error: itemsError } = await supabase.from('items').select('id, name, sequence, agency_id, main_unit, categories(name, color, sequence)');
      if (itemsError) throw itemsError;

      const agMap: Record<string, string> = {};
      agenciesData?.forEach(ag => { agMap[ag.id] = ag.name; });

      const mappedItems = (itemsData || []).map((item: any) => ({
          id: item.id, name: item.name, sequence: item.sequence ?? 999, agency_id: item.agency_id,
          categories: { name: item.categories?.name || 'غير محدد', color: item.categories?.color || '#4f46e5', sequence: item.categories?.sequence ?? 999 },
          main_unit: item.main_unit || 'لم تحدد', agencyName: item.agency_id ? (agMap[item.agency_id] || 'غير محدد') : 'غير محدد'
      })) as DbItem[];

      mappedItems.sort((a, b) => a.name.localeCompare(b.name));

      setAgenciesMap(agMap); setAllBranches(branchesData || []); setAllItemsDb(mappedItems); setOrders(validOrders);
    } catch (err: any) { setDbError(err?.message || "يرجى التأكد من اتصال قاعدة البيانات."); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const clearFilters = () => {
    setPeriodAStart(dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'));
    setPeriodAEnd(dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'));
    setPeriodBStart(dayjs().startOf('month').format('YYYY-MM-DD'));
    setPeriodBEnd(dayjs().format('YYYY-MM-DD'));
    setSelectedMonth(dayjs().format('YYYY-MM'));
    setTraceStartDate(dayjs().startOf('month').format('YYYY-MM-DD'));
    setTraceEndDate(dayjs().format('YYYY-MM-DD'));
    setTraceItemFilter(''); 
    setAgencyFilter('الكل'); 
    setBranchFilter('الكل');
    setCategoryFilter('الكل'); 
    setItemFilter('الكل'); 
  };

  const filteredBranchesDropdown = useMemo(() => {
    if (agencyFilter === 'الكل') return allBranches;
    return allBranches.filter(b => agenciesMap[b.agency_id] === agencyFilter);
  }, [allBranches, agencyFilter, agenciesMap]);

  const filteredCategoriesTabs = useMemo(() => {
    const items = agencyFilter === 'الكل' ? allItemsDb : allItemsDb.filter(item => item.agencyName === agencyFilter);
    const uniqueItems = new Map<string, DbItem>();
    items.forEach(item => {
      const compKey = `${item.agency_id}-${item.name.trim()}`;
      if (!uniqueItems.has(compKey)) uniqueItems.set(compKey, item);
    });

    const counts: Record<string, number> = {};
    Array.from(uniqueItems.values()).forEach(item => {
      const catName = item.categories?.name || 'غير محدد';
      counts[catName] = (counts[catName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allItemsDb, agencyFilter]);

  const filteredItemsDropdown = useMemo(() => {
    let items = allItemsDb;
    if (agencyFilter !== 'الكل') items = items.filter(item => item.agencyName === agencyFilter);
    if (categoryFilter !== 'الكل') items = items.filter(item => item.categories?.name === categoryFilter);

    const unique = new Map<string, DbItem>();
    items.forEach(item => {
      const compKey = `${item.agency_id}-${item.name.trim()}`;
      if (!unique.has(compKey)) unique.set(compKey, item);
    });
    return Array.from(unique.values());
  }, [allItemsDb, agencyFilter, categoryFilter]);

  const uniqueAgencies = useMemo(() => {
    const agencies = new Set<string>();
    allItemsDb.forEach(item => { if (item.agencyName) agencies.add(item.agencyName); });
    return Array.from(agencies).sort();
  }, [allItemsDb]);

  const { comparisonDataFlat, comparisonDataGrouped } = useMemo(() => {
    if (activeView !== 'comparison' || !periodAStart || !periodAEnd || !periodBStart || !periodBEnd) return { comparisonDataFlat: [], comparisonDataGrouped: [] };
    
    const idToCompKey: Record<string, string> = {};
    const map: Record<string, { item: DbItem, qtyA: number, qtyB: number }> = {};
    
    allItemsDb.forEach(item => {
      const compKey = `${item.agency_id}-${item.name.trim()}`;
      idToCompKey[item.id] = compKey;

      if (agencyFilter !== 'الكل' && item.agencyName !== agencyFilter) return;
      if (categoryFilter !== 'الكل' && item.categories?.name !== categoryFilter) return;
      
      if (!map[compKey]) {
        map[compKey] = { item, qtyA: 0, qtyB: 0 };
      }
    });

    const targetCompKey = itemFilter !== 'الكل' ? idToCompKey[itemFilter] : null;

    orders.forEach(order => {
      const orderDate = dayjs(order.created_at).format('YYYY-MM-DD');
      const isPeriodA = orderDate >= periodAStart && orderDate <= periodAEnd;
      const isPeriodB = orderDate >= periodBStart && orderDate <= periodBEnd;
      if (!isPeriodA && !isPeriodB) return;
      if (branchFilter !== 'الكل' && order.branch_id !== branchFilter) return;
      
      order.order_details?.forEach((detail: any) => {
        const compKey = idToCompKey[detail.item_id];
        if (!compKey || !map[compKey]) return;
        if (targetCompKey && compKey !== targetCompKey) return;
        
        const qty = parseFloat(detail.quantity) || 0;
        if (isPeriodA) map[compKey].qtyA = roundNumber(map[compKey].qtyA + qty);
        if (isPeriodB) map[compKey].qtyB = roundNumber(map[compKey].qtyB + qty);
      });
    });

    const flatResult = Object.values(map).filter(d => d.qtyA > 0 || d.qtyB > 0).map(d => {
        const diff = roundNumber(d.qtyB - d.qtyA);
        let growthPct = 0; let trend: 'up' | 'down' | 'same' | 'new' = 'same';
        if (d.qtyA === 0 && d.qtyB > 0) { trend = 'new'; growthPct = 100; } 
        else if (d.qtyA > 0 && d.qtyB === 0) { trend = 'down'; growthPct = -100; } 
        else if (diff > 0) { trend = 'up'; growthPct = roundNumber((diff / d.qtyA) * 100); } 
        else if (diff < 0) { trend = 'down'; growthPct = roundNumber((diff / d.qtyA) * 100); }
        return { ...d, diff, growthPct, trend };
      });
      
    flatResult.sort((a, b) => {
      if (a.item.agencyName !== b.item.agencyName) return (a.item.agencyName || '').localeCompare(b.item.agencyName || '');
      if (a.item.categories!.sequence !== b.item.categories!.sequence) return a.item.categories!.sequence - b.item.categories!.sequence;
      if (a.item.categories!.name !== b.item.categories!.name) return a.item.categories!.name.localeCompare(b.item.categories!.name);
      if (a.item.sequence !== b.item.sequence) return a.item.sequence - b.item.sequence;
      return a.item.name.localeCompare(b.item.name);
    });

    const grouped: { key: string, agencyName: string, categoryName: string, color: string, items: any[] }[] = [];
    let currentGroup: any = null;
    flatResult.forEach(row => {
      const groupKey = `${row.item.agencyName}-${row.item.categories!.name}`;
      if (!currentGroup || currentGroup.key !== groupKey) {
        if (currentGroup) grouped.push(currentGroup);
        currentGroup = { key: groupKey, agencyName: row.item.agencyName, categoryName: row.item.categories!.name, color: row.item.categories!.color, items: [] };
      }
      currentGroup.items.push(row);
    });
    if (currentGroup) grouped.push(currentGroup);
    return { comparisonDataFlat: flatResult, comparisonDataGrouped: grouped };
  }, [orders, allItemsDb, periodAStart, periodAEnd, periodBStart, periodBEnd, agencyFilter, branchFilter, categoryFilter, itemFilter, activeView]);

  const kpis = useMemo(() => {
    let totalA = 0; let totalB = 0; let upCount = 0; let downCount = 0; let newCount = 0;
    comparisonDataFlat.forEach(d => {
      totalA += d.qtyA; totalB += d.qtyB;
      if (d.trend === 'up') upCount++;
      if (d.trend === 'down') downCount++;
      if (d.trend === 'new') newCount++;
    });
    const overallDiff = totalB - totalA;
    const overallGrowth = totalA === 0 ? (totalB > 0 ? 100 : 0) : roundNumber((overallDiff / totalA) * 100);
    return { totalA: roundNumber(totalA), totalB: roundNumber(totalB), overallDiff: roundNumber(overallDiff), overallGrowth, upCount, downCount, newCount };
  }, [comparisonDataFlat]);

  const monthlyData = useMemo(() => {
    if (activeView !== 'monthly' || !selectedMonth) return null;
    const daysCount = dayjs(selectedMonth).daysInMonth();
    
    const idToCompKey: Record<string, string> = {};
    const map: Record<string, { item: DbItem, dailyQty: Record<number, number>, total: number }> = {};
    
    allItemsDb.forEach(item => {
      const compKey = `${item.agency_id}-${item.name.trim()}`;
      idToCompKey[item.id] = compKey;

      if (agencyFilter !== 'الكل' && item.agencyName !== agencyFilter) return;
      if (categoryFilter !== 'الكل' && item.categories?.name !== categoryFilter) return;
      
      if (!map[compKey]) {
        map[compKey] = { item, dailyQty: {}, total: 0 };
        for (let i = 1; i <= daysCount; i++) map[compKey].dailyQty[i] = 0;
      }
    });

    const targetCompKey = itemFilter !== 'الكل' ? idToCompKey[itemFilter] : null;

    orders.forEach(order => {
      const orderDate = dayjs(order.created_at);
      if (orderDate.format('YYYY-MM') !== selectedMonth) return;
      if (branchFilter !== 'الكل' && order.branch_id !== branchFilter) return;
      const dayOfMonth = orderDate.date();
      
      order.order_details?.forEach((detail: any) => {
        const compKey = idToCompKey[detail.item_id];
        if (!compKey || !map[compKey]) return;
        if (targetCompKey && compKey !== targetCompKey) return;
        
        const qty = parseFloat(detail.quantity) || 0;
        map[compKey].dailyQty[dayOfMonth] = roundNumber(map[compKey].dailyQty[dayOfMonth] + qty);
        map[compKey].total = roundNumber(map[compKey].total + qty);
      });
    });

    const flatRows = Object.values(map).filter(d => d.total > 0);
    flatRows.sort((a, b) => {
      if (a.item.agencyName !== b.item.agencyName) return (a.item.agencyName || '').localeCompare(b.item.agencyName || '');
      if (a.item.categories!.sequence !== b.item.categories!.sequence) return a.item.categories!.sequence - b.item.categories!.sequence;
      if (a.item.categories!.name !== b.item.categories!.name) return a.item.categories!.name.localeCompare(b.item.categories!.name);
      if (a.item.sequence !== b.item.sequence) return a.item.sequence - b.item.sequence;
      return a.item.name.localeCompare(b.item.name);
    });

    const groupedRows: { key: string, agencyName: string, categoryName: string, color: string, items: any[] }[] = [];
    let currentGroup: any = null;
    flatRows.forEach(row => {
      const groupKey = `${row.item.agencyName}-${row.item.categories!.name}`;
      if (!currentGroup || currentGroup.key !== groupKey) {
        if (currentGroup) groupedRows.push(currentGroup);
        currentGroup = { key: groupKey, agencyName: row.item.agencyName, categoryName: row.item.categories!.name, color: row.item.categories!.color, items: [] };
      }
      currentGroup.items.push(row);
    });
    if (currentGroup) groupedRows.push(currentGroup);

    const footerTotals: Record<number, number> = {};
    let grandTotal = 0;
    for (let i = 1; i <= daysCount; i++) footerTotals[i] = 0;
    flatRows.forEach(row => {
      for (let i = 1; i <= daysCount; i++) footerTotals[i] = roundNumber(footerTotals[i] + row.dailyQty[i]);
      grandTotal = roundNumber(grandTotal + row.total);
    });
    return { flatRows, flatRowsCount: flatRows.length, groupedRows, daysCount, footerTotals, grandTotal };
  }, [orders, allItemsDb, selectedMonth, agencyFilter, branchFilter, categoryFilter, itemFilter, activeView]);

  const filteredItemsForTrace = useMemo(() => {
    const items = allItemsDb.filter(item => { 
      if (agencyFilter !== 'الكل' && item.agencyName !== agencyFilter) return false; 
      if (categoryFilter !== 'الكل' && item.categories?.name !== categoryFilter) return false;
      return true; 
    });
    const unique = new Map<string, DbItem>();
    items.forEach(item => {
      const compKey = `${item.agency_id}-${item.name.trim()}`;
      if (!unique.has(compKey)) unique.set(compKey, item);
    });
    return Array.from(unique.values());
  }, [allItemsDb, agencyFilter, categoryFilter]);

  const itemTraceData = useMemo(() => {
    if (activeView !== 'item_trace' || !traceItemFilter) return null;
    const results: { date: string, datetime: string, branchName: string, agencyName: string, quantity: number, orderId: string, invoiceNumber: string, orderType: string }[] = [];
    let totalQty = 0; const uniqueBranches = new Set<string>();
    
    const targetItem = allItemsDb.find(i => i.id === traceItemFilter);
    if (!targetItem) return null;
    const targetCompKey = `${targetItem.agency_id}-${targetItem.name.trim()}`;
    
    const idToCompKey: Record<string, string> = {};
    allItemsDb.forEach(item => {
      idToCompKey[item.id] = `${item.agency_id}-${item.name.trim()}`;
    });

    orders.forEach(order => {
      const orderDate = dayjs(order.created_at).format('YYYY-MM-DD');
      if (orderDate < traceStartDate || orderDate > traceEndDate) return;
      if (branchFilter !== 'الكل' && order.branch_id !== branchFilter) return;
      
      const matchingDetails = order.order_details?.filter((d: any) => idToCompKey[d.item_id] === targetCompKey) || [];
      
      let sumQty = 0;
      matchingDetails.forEach((d: any) => {
         sumQty += parseFloat(d.quantity) || 0;
      });

      if (sumQty > 0) {
        const branch = allBranches.find(b => b.id === order.branch_id);
        results.push({ 
          date: orderDate, 
          datetime: dayjs(order.created_at).format('YYYY-MM-DD hh:mm A'), 
          branchName: branch?.name || 'غير معروف', 
          agencyName: agenciesMap[branch?.agency_id] || 'غير محدد', 
          quantity: sumQty, 
          orderId: order.id,
          invoiceNumber: order.invoice_number || '-',
          orderType: order.order_type || 'طلبية يومية',
        });
        totalQty += sumQty; 
        uniqueBranches.add(order.branch_id);
      }
    });

    results.sort((a, b) => dayjs(b.datetime).valueOf() - dayjs(a.datetime).valueOf());
    return { history: results, totalQty: roundNumber(totalQty), branchesCount: uniqueBranches.size, ordersCount: results.length, itemDetails: targetItem };
  }, [activeView, traceItemFilter, orders, traceStartDate, traceEndDate, branchFilter, allBranches, agenciesMap, allItemsDb]);

  const openDatePicker = (target: PickerTarget, defaultDate: string, defaultMode: 'date' | 'month' = 'date') => {
    setDatePickerConfig({ isOpen: true, target, viewDate: dayjs(defaultDate), mode: defaultMode });
  };

  const handleDateSelection = (dateStr: string) => {
    const t = datePickerConfig.target;
    if (t === 'periodAStart') setPeriodAStart(dateStr);
    else if (t === 'periodAEnd') setPeriodAEnd(dateStr);
    else if (t === 'periodBStart') setPeriodBStart(dateStr);
    else if (t === 'periodBEnd') setPeriodBEnd(dateStr);
    else if (t === 'selectedMonth') setSelectedMonth(dateStr.substring(0, 7));
    else if (t === 'traceStartDate') setTraceStartDate(dateStr);
    else if (t === 'traceEndDate') setTraceEndDate(dateStr);
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const applyQuickCompare = (type: 'thisVsLastMonth' | 'thisVsLastWeek') => {
    if (type === 'thisVsLastMonth') {
      setPeriodAStart(dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD')); setPeriodAEnd(dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'));
      setPeriodBStart(dayjs().startOf('month').format('YYYY-MM-DD')); setPeriodBEnd(dayjs().format('YYYY-MM-DD'));
    } else if (type === 'thisVsLastWeek') {
      setPeriodAStart(dayjs().subtract(2, 'week').startOf('week').format('YYYY-MM-DD')); setPeriodAEnd(dayjs().subtract(2, 'week').endOf('week').format('YYYY-MM-DD'));
      setPeriodBStart(dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD')); setPeriodBEnd(dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD'));
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef, documentTitle: `تحليلات_${activeView}_${dayjs().format('YYYYMMDD')}`,
    pageStyle: `@page { size: landscape; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; color: black !important; } .no-print { display: none !important; } .print-table { width: 100% !important; max-width: none !important; } }`
  });

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'Enterprise Kitchen System';
    let sheetName = activeView === 'comparison' ? '📊 مقارنة الفترات' : activeView === 'monthly' ? '📅 التحليل الشهري' : '🔍 سجل حركة المادة';
    const worksheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: true }] });

    let title = ''; let headers: string[] = []; let totalCols = 0;
    if (activeView === 'comparison') {
      if (comparisonDataFlat.length === 0) return alert("لا توجد بيانات لتصديرها.");
      title = '📊 التحليل الاستراتيجي - مقارنة الفترات ومؤشرات النمو'; headers = ['#', '🏢 الوكالة', '📁 القسم', '📦 المادة', '⚖️ الوحدة', '📅 الفترة (أ)', '⚡ الفترة (ب)', '⚖️ الفرق', '📈 مؤشر النمو']; totalCols = 9;
    } else if (activeView === 'monthly') {
      if (!monthlyData || monthlyData.flatRows.length === 0) return alert("لا توجد بيانات لتصديرها.");
      title = `📅 التحليل الاستراتيجي - التوزيع اليومي (${selectedMonth})`; headers = ['#', '🏢 الوكالة', '📁 القسم', '📦 المادة', '⚖️ الوحدة'];
      for (let i = 1; i <= monthlyData.daysCount; i++) headers.push(`يوم ${i}`);
      headers.push('∑ المجموع'); totalCols = 4 + monthlyData.daysCount + 1;
    } else if (activeView === 'item_trace') {
      if (!itemTraceData || itemTraceData.history.length === 0) return alert("لا توجد بيانات لتصديرها.");
      // 💡 تم تحديث تقرير سجل المادة في الإكسل لدعم الحقول الجديدة 💡
      title = `🔍 سجل حركة المادة: ${itemTraceData.itemDetails?.name || ''}`; headers = ['#', '🕒 التاريخ والوقت', '🧾 الفاتورة', '📑 النوع', '🏪 الفرع', '🏢 الوكالة', '📦 الكمية المسحوبة']; totalCols = 7;
    }

    worksheet.properties.defaultRowHeight = 25; worksheet.mergeCells(`A1:${getColLetter(totalCols)}1`);
    const titleCell = worksheet.getCell('A1'); titleCell.value = title; titleCell.font = { name: 'Cairo', size: 16, bold: true, color: { argb: 'FF0F172A' } }; titleCell.alignment = { horizontal: 'center', vertical: 'middle' }; worksheet.getRow(1).height = 40;

    const filterRow1 = worksheet.addRow([]); filterRow1.getCell(1).value = '🏢 الوكالة المحددة:'; filterRow1.getCell(2).value = agencyFilter; filterRow1.getCell(4).value = '🏪 الفرع المحدد:'; filterRow1.getCell(5).value = branchFilter === 'الكل' ? 'الكل' : allBranches.find(b => b.id === branchFilter)?.name || 'محدد';
    worksheet.mergeCells('B2:C2'); worksheet.mergeCells('E2:F2');
    if (totalCols >= 7) { worksheet.mergeCells(`G2:${getColLetter(totalCols)}2`); const dateCell = filterRow1.getCell(7); dateCell.value = `🕒 تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}`; dateCell.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' }, bold: true }; dateCell.alignment = { horizontal: 'left', vertical: 'middle' }; }
    [1, 4].forEach(col => { const cell = filterRow1.getCell(col); cell.font = { bold: true, color: { argb: 'FF334155' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; cell.alignment = { horizontal: 'left', vertical: 'middle' }; });
    [2, 5].forEach(col => { const cell = filterRow1.getCell(col); cell.font = { bold: true, color: { argb: 'FF0F172A' } }; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }); worksheet.getRow(2).height = 28;

    if (activeView === 'comparison') {
      const periodRow = worksheet.addRow([]); periodRow.getCell(1).value = '📅 الفترة (أ):'; periodRow.getCell(2).value = `${periodAStart} إلى ${periodAEnd}`; periodRow.getCell(4).value = '⚡ الفترة (ب):'; periodRow.getCell(5).value = `${periodBStart} إلى ${periodBEnd}`;
      worksheet.mergeCells('B3:C3'); worksheet.mergeCells(`E3:${getColLetter(totalCols)}3`); 
      [1, 4].forEach(col => { const cell = periodRow.getCell(col); cell.font = { bold: true, color: { argb: 'FF334155' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; cell.alignment = { horizontal: 'left', vertical: 'middle' }; });
      [2, 5].forEach(col => { const cell = periodRow.getCell(col); cell.font = { bold: true, color: { argb: 'FF4F46E5' } }; cell.alignment = { horizontal: 'right', vertical: 'middle' }; }); worksheet.getRow(3).height = 28;
    }
    worksheet.addRow([]); 
    const headerRow = worksheet.addRow(headers); headerRow.height = 35;
    headerRow.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; cell.font = { name: 'Arial', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: { style: 'medium', color: {argb: 'FF0F172A'} }, left: { style: 'thin', color: {argb: 'FF334155'} }, bottom: { style: 'medium', color: {argb: 'FF0F172A'} }, right: { style: 'thin', color: {argb: 'FF334155'} } }; });

    if (activeView === 'comparison') {
      comparisonDataFlat.forEach((row, idx) => {
          const isUp = row.trend === 'up'; const isDown = row.trend === 'down'; const isNew = row.trend === 'new';
          let trendText = '➖ استقرار'; if (isNew) trendText = '✨ مادة جديدة'; else if (isUp) trendText = `📈 +${row.growthPct}%`; else if (isDown) trendText = `📉 ${row.growthPct}%`;
          const diffText = row.diff > 0 ? `+${row.diff}` : row.diff;
          const dataRow = worksheet.addRow([ idx + 1, row.item.agencyName, row.item.categories?.name, row.item.name, row.item.main_unit, row.qtyA, row.qtyB, diffText, trendText ]);
          const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
          dataRow.eachCell((cell, colNum) => {
              cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: { style: 'thin', color: {argb: 'FFE2E8F0'} }, left: { style: 'thin', color: {argb: 'FFE2E8F0'} }, bottom: { style: 'thin', color: {argb: 'FFE2E8F0'} }, right: { style: 'thin', color: {argb: 'FFE2E8F0'} } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }; cell.font = { color: { argb: 'FF334155' }, size: 11 };
              if (colNum === 4) cell.font = { bold: true, color: { argb: 'FF0F172A' }, size: 11 }; 
              if (colNum === 6) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; cell.numFmt = '#,##0.###'; }
              if (colNum === 7) { cell.font = { bold: true, color: { argb: 'FF4338CA' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }; cell.numFmt = '#,##0.###'; }
              if (colNum === 8) { cell.font = { bold: true, color: { argb: row.diff > 0 ? 'FF059669' : row.diff < 0 ? 'FFE11D48' : 'FF94A3B8' } }; cell.numFmt = '#,##0.###'; }
              if (colNum === 9) { cell.font = { bold: true }; if (isNew) { cell.font.color = { argb: 'FFB45309' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; } else if (isUp) { cell.font.color = { argb: 'FF047857' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; } else if (isDown) { cell.font.color = { argb: 'FFBE123C' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } }; } else cell.font.color = { argb: 'FF64748B' }; }
          });
      });
      const footerRow = worksheet.addRow(['∑ المجموع الكلي:', '', '', '', '', kpis.totalA, kpis.totalB, kpis.overallDiff > 0 ? `+${kpis.overallDiff}` : kpis.overallDiff, `${kpis.overallGrowth}%`]);
      footerRow.height = 35; worksheet.mergeCells(`A${footerRow.number}:E${footerRow.number}`);
      footerRow.eachCell((cell, colNum) => { cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; cell.border = { top: { style: 'medium', color: {argb: 'FF0F172A'} } }; if (colNum === 1) cell.alignment.horizontal = 'right'; });
    } else if (activeView === 'monthly' && monthlyData) {
      monthlyData.flatRows.forEach((row, idx) => {
          const rowData = [idx + 1, row.item.agencyName, row.item.categories?.name, row.item.name, row.item.main_unit];
          for (let i = 1; i <= monthlyData.daysCount; i++) rowData.push(row.dailyQty[i] > 0 ? row.dailyQty[i] : '-'); rowData.push(row.total);
          const dataRow = worksheet.addRow(rowData); const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
          dataRow.eachCell((cell, colNum) => {
              cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: { style: 'thin', color: {argb: 'FFE2E8F0'} }, left: { style: 'thin', color: {argb: 'FFE2E8F0'} }, bottom: { style: 'thin', color: {argb: 'FFE2E8F0'} }, right: { style: 'thin', color: {argb: 'FFE2E8F0'} } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }; cell.font = { color: { argb: 'FF334155' }, size: 11 };
              if (colNum === 4) cell.font = { bold: true, color: { argb: 'FF0F172A' } };
              if (colNum > 5 && colNum < totalCols && cell.value !== '-') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; cell.font = { bold: true, color: { argb: 'FF047857' } }; cell.numFmt = '#,##0.###'; }
              if (colNum === totalCols) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; cell.font = { bold: true, color: { argb: 'FF065F46' }, size: 12 }; cell.numFmt = '#,##0.###'; }
          });
      });
      const footerData = ['∑ إجمالي السحب اليومي:', '', '', '', ''];
      for (let i = 1; i <= monthlyData.daysCount; i++) footerData.push(monthlyData.footerTotals[i] > 0 ? monthlyData.footerTotals[i].toString() : '-');
      footerData.push(monthlyData.grandTotal.toString());
      const footerRow = worksheet.addRow(footerData); footerRow.height = 35; worksheet.mergeCells(`A${footerRow.number}:E${footerRow.number}`);
      footerRow.eachCell((cell, colNum) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; cell.border = { top: { style: 'medium', color: {argb: 'FF0F172A'} } }; if (colNum === 1) { cell.alignment.horizontal = 'right'; cell.font.size = 12; } if (colNum >= 5 && cell.value !== '-') { cell.numFmt = '#,##0.###'; cell.font.color = { argb: 'FF93C5FD' }; } if (colNum === totalCols) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }; } });
    } else if (activeView === 'item_trace' && itemTraceData) {
      itemTraceData.history.forEach((row, idx) => {
          // 💡 تضمين الحقول الجديدة في صفوف الإكسل 💡
          const dataRow = worksheet.addRow([ idx + 1, row.datetime, row.invoiceNumber, row.orderType, row.branchName, row.agencyName, row.quantity ]);
          const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
          dataRow.eachCell((cell, colNum) => { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: { style: 'thin', color: {argb: 'FFE2E8F0'} }, left: { style: 'thin', color: {argb: 'FFE2E8F0'} }, bottom: { style: 'thin', color: {argb: 'FFE2E8F0'} }, right: { style: 'thin', color: {argb: 'FFE2E8F0'} } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }; cell.font = { color: { argb: 'FF334155' }, size: 11 }; if (colNum === 2) cell.font = { bold: true, color: { argb: 'FF475569' } }; if (colNum === 3) cell.font = { bold: true, color: { argb: 'FFD97706' } }; if (colNum === 4) cell.font = { bold: true, color: { argb: 'FF0284C7' } }; if (colNum === 5) cell.font = { bold: true, color: { argb: 'FF1D4ED8' } }; if (colNum === 7) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; cell.font = { bold: true, color: { argb: 'FF047857' }, size: 12 }; cell.numFmt = '#,##0.###'; } });
      });
      const footerData = ['∑ إجمالي الكمية المسحوبة:', '', '', '', '', '', itemTraceData.totalQty]; const footerRow = worksheet.addRow(footerData); footerRow.height = 35; worksheet.mergeCells(`A${footerRow.number}:F${footerRow.number}`);
      footerRow.eachCell((cell, colNum) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; cell.border = { top: { style: 'medium', color: {argb: 'FF0F172A'} } }; if (colNum === 1) { cell.alignment.horizontal = 'right'; cell.font.size = 12; } if (colNum === 7) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 15 }; cell.numFmt = '#,##0.###'; } });
    }
    worksheet.columns.forEach((col, i) => { if (i === 0) col.width = 6; else if (i === 1) col.width = 18; else if (i === 2) col.width = 18; else if (i === 3) col.width = 35; else if (i === 4) col.width = 15; else if (activeView === 'monthly' && i >= 5 && i < totalCols - 1) col.width = 8; else col.width = 18; });
    const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); saveAs(blob, `${title.replace(/ /g, '_').replace(/[:📅📊🔍]/g, '')}.xlsx`);
  };

  let globalRenderIndex = 1;
  let globalMonthlyIndex = 1;

  return (
    <div className={`min-h-screen pb-20 w-full font-sans relative ${isZenMode ? 'bg-slate-100 text-slate-800 dark:bg-black dark:text-slate-300' : 'bg-slate-50 text-slate-900 dark:bg-[#050505] dark:text-white'}`} dir="rtl">
      
      {/* 🟢 الإشعاع الخلفي 🟢 */}
      <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 via-slate-50 to-slate-50 dark:from-indigo-900/15 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none ${isZenMode ? 'hidden' : 'block'}`}></div>

      {/* 🌟 الهيدر الثابت العائم بالوضعين 🌟 */}
      <div className="sticky top-0 z-[999] pt-2 md:pt-4 pb-2 px-4 md:px-8 bg-slate-50/80 dark:bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-[100rem] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 md:gap-5 bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-2xl p-4 md:px-6 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Link href="/hub" title="الرئيسية" className="bg-slate-50 dark:bg-white/5 p-2.5 rounded-[1.1rem] hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 group shrink-0 outline-none shadow-sm dark:shadow-inner">
              <LayoutGrid className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white" />
            </Link>
            <div className="w-px h-8 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
            <div className="flex items-center gap-3 flex-1">
              <div className="bg-gradient-to-br from-indigo-100 to-blue-50 dark:from-indigo-500/20 dark:to-blue-900/40 border border-indigo-200 dark:border-indigo-500/30 w-11 h-11 rounded-2xl text-indigo-600 dark:text-indigo-400 shadow-sm dark:shadow-inner flex items-center justify-center shrink-0">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[18px] md:text-[20px] font-black text-slate-900 dark:text-white tracking-tight">التحليلات والمقارنات</h2>
                <p className="text-[11px] md:text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block">راقب حركة السحوبات، قارن بين الفترات، واكتشف الذروة.</p>
              </div>
            </div>
            {/* 💡 زر وضع التركيز المدمج 💡 */}
            <button 
              onClick={() => setIsZenMode(!isZenMode)}
              title={isZenMode ? "إنهاء وضع التركيز" : "تفعيل وضع التركيز"}
              className={`mr-auto p-2.5 rounded-xl border outline-none transition-all ${isZenMode ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-400' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 dark:bg-white/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10'}`}
            >
              {isZenMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className={`mx-auto w-full relative z-10 ${isZenMode ? 'p-2 max-w-[120rem]' : 'px-4 md:px-8 max-w-[100rem]'}`}>

        {/* 🟢 أزرار الإجراءات 🟢 */}
        <div className={`flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8 w-full mt-4 no-print relative z-10 ${isZenMode ? 'hidden' : 'block'}`}>
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 w-full lg:w-auto shrink-0 bg-white dark:bg-[#121214] p-2 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
            <button onClick={clearFilters} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-slate-50 dark:bg-white/5 shadow-sm border border-rose-200 dark:border-rose-500/30 px-5 py-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/10 hover:text-rose-500 dark:hover:text-rose-300 font-black text-[13px] outline-none">
              <RotateCcw className="w-4 h-4" /> تصفير 
            </button>
            <button onClick={handlePrint} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-500/20 shadow-sm dark:shadow-md dark:shadow-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 hover:text-indigo-500 dark:hover:text-indigo-300 px-5 py-3 rounded-xl font-black text-[13px] outline-none border border-indigo-200 dark:border-indigo-500/30">
              <FileText className="w-4 h-4" /> تصدير PDF
            </button>
            <button onClick={handleExportExcel} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/20 shadow-sm dark:shadow-md dark:shadow-emerald-500/10 px-5 py-3 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/30 hover:text-emerald-500 dark:hover:text-emerald-300 font-black text-[13px] outline-none border border-emerald-200 dark:border-emerald-500/30">
              <FileSpreadsheet className="w-4 h-4" /> تصدير إكسل
            </button>
          </div>
        </div>

        {dbError && (
          <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-sm w-full no-print relative z-10">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500" /><p>{dbError}</p>
          </div>
        )}

        {!dbError && isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 w-full no-print relative z-10">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
          </div>
        ) : !dbError && (
          <>
            {/* 🟢 أزرار التنقل بين النوافذ (Tabs) 🟢 */}
            <div className={`flex flex-col lg:flex-row bg-white dark:bg-[#0a0a0c] p-2.5 rounded-[1.5rem] border border-slate-200 dark:border-white/10 w-full max-w-5xl mx-auto mb-8 shadow-sm dark:shadow-[0_0_20px_rgba(0,0,0,0.5)] gap-2.5 no-print relative z-10 ${isZenMode ? 'hidden' : 'flex'}`}>
              <button 
                onClick={() => setActiveView('comparison')} 
                className={`flex-1 px-5 py-4 min-w-max text-[13px] font-black rounded-xl transition-all flex items-center justify-center gap-2 outline-none group 
                  ${activeView === 'comparison' 
                    ? 'bg-indigo-600 text-white shadow-md dark:bg-gradient-to-r dark:from-indigo-600 dark:to-blue-500 dark:shadow-[0_0_20px_rgba(99,102,241,0.5)] border-indigo-500 dark:border-indigo-400/50 scale-[1.02] ring-2 ring-indigo-500/20' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 border border-slate-200 dark:bg-indigo-500/10 dark:text-indigo-400/70 dark:hover:text-indigo-300 dark:hover:bg-indigo-500/20 dark:border-indigo-500/20 dark:shadow-inner'}`}
              >
                <ArrowRightLeft className={`w-5 h-5 ${activeView === 'comparison' ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600 dark:text-indigo-400/70 dark:group-hover:text-indigo-400'}`} /> مقارنة الفترات
              </button>

              <button 
                onClick={() => setActiveView('monthly')} 
                className={`flex-1 px-5 py-4 min-w-max text-[13px] font-black rounded-xl transition-all flex items-center justify-center gap-2 outline-none group 
                  ${activeView === 'monthly' 
                    ? 'bg-emerald-600 text-white shadow-md dark:bg-gradient-to-r dark:from-emerald-600 dark:to-teal-500 dark:shadow-[0_0_20px_rgba(16,185,129,0.5)] border-emerald-500 dark:border-emerald-400/50 scale-[1.02] ring-2 ring-emerald-500/20' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-emerald-600 border border-slate-200 dark:bg-emerald-500/10 dark:text-emerald-400/70 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/20 dark:border-emerald-500/20 dark:shadow-inner'}`}
              >
                <CalendarDays className={`w-5 h-5 ${activeView === 'monthly' ? 'text-white' : 'text-slate-400 group-hover:text-emerald-600 dark:text-emerald-400/70 dark:group-hover:text-emerald-400'}`} /> تحليل أيام الشهر
              </button>

              <button 
                onClick={() => setActiveView('item_trace')} 
                className={`flex-1 px-5 py-4 min-w-max text-[13px] font-black rounded-xl transition-all flex items-center justify-center gap-2 outline-none group 
                  ${activeView === 'item_trace' 
                    ? 'bg-amber-600 text-white shadow-md dark:bg-gradient-to-r dark:from-amber-600 dark:to-orange-500 dark:shadow-[0_0_20px_rgba(245,158,11,0.5)] border-amber-500 dark:border-amber-400/50 scale-[1.02] ring-2 ring-amber-500/20' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-amber-600 border border-slate-200 dark:bg-amber-500/10 dark:text-amber-400/70 dark:hover:text-amber-300 dark:hover:bg-amber-500/20 dark:border-amber-500/20 dark:shadow-inner'}`}
              >
                <Search className={`w-5 h-5 ${activeView === 'item_trace' ? 'text-white' : 'text-slate-400 group-hover:text-amber-600 dark:text-amber-400/70 dark:group-hover:text-amber-400'}`} /> سجل حركة المواد
              </button>
            </div>

            {/* 🟢 فلاتر النظام المتقدمة (طبقات) 🟢 */}
            <div className={`bg-white dark:bg-[#121214] p-4 md:p-6 rounded-[1.5rem] mb-8 border border-slate-200 dark:border-white/10 flex flex-col gap-5 w-full shadow-sm dark:shadow-sm no-print relative z-10 ${isZenMode ? 'hidden' : 'flex'}`}>
              <div className="flex items-center gap-2 font-black text-slate-700 dark:text-slate-300 text-sm pb-4 border-b border-slate-200 dark:border-white/5 w-full">
                <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> فلاتر النظام:
              </div>
              
              <div className="flex flex-col gap-4 w-full">
                {/* الطابق الأول: الوكالة */}
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <span className="text-[13px] font-black text-slate-500 dark:text-slate-400 min-w-[50px]">الوكالة:</span>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => { setAgencyFilter('الكل'); setCategoryFilter('الكل'); setBranchFilter('الكل'); setItemFilter('الكل'); setTraceItemFilter(''); }} 
                      className={`px-4 py-2 rounded-xl text-xs font-black outline-none border 
                        ${agencyFilter === 'الكل' 
                          ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm ring-1 ring-indigo-200 scale-[1.02] dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40 dark:shadow-[0_0_10px_rgba(99,102,241,0.2)] dark:ring-indigo-500/20' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:text-indigo-600 dark:bg-indigo-500/5 dark:text-indigo-400/60 dark:border-indigo-500/10 dark:hover:bg-indigo-500/15 dark:hover:border-indigo-500/30 dark:hover:text-indigo-300 shadow-inner'}`}
                    >
                      الكل
                    </button>
                    {uniqueAgencies.map(ag => (
                      <button 
                        key={ag} 
                        onClick={() => { setAgencyFilter(ag); setCategoryFilter('الكل'); setBranchFilter('الكل'); setItemFilter('الكل'); setTraceItemFilter(''); }} 
                        className={`px-4 py-2 rounded-xl text-xs font-black outline-none border 
                          ${agencyFilter === ag 
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm ring-1 ring-indigo-200 scale-[1.02] dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40 dark:shadow-[0_0_10px_rgba(99,102,241,0.2)] dark:ring-indigo-500/20' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:text-indigo-600 dark:bg-indigo-500/5 dark:text-indigo-400/60 dark:border-indigo-500/10 dark:hover:bg-indigo-500/15 dark:hover:border-indigo-500/30 dark:hover:text-indigo-300 shadow-inner'}`}
                      >
                        {ag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* الطابق الثاني: الأقسام (تبويبات) */}
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <span className="text-[13px] font-black text-slate-500 dark:text-slate-400 min-w-[50px]">القسم:</span>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => { setCategoryFilter('الكل'); setItemFilter('الكل'); setTraceItemFilter(''); }} 
                      className={`px-4 py-2 rounded-xl text-xs font-black outline-none border flex items-center gap-1.5 group
                        ${categoryFilter === 'الكل' 
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm ring-1 ring-emerald-200 scale-[1.02] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 dark:shadow-[0_0_10px_rgba(16,185,129,0.2)] dark:ring-emerald-500/20' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400/60 dark:border-emerald-500/10 dark:hover:bg-emerald-500/15 dark:hover:border-emerald-500/30 dark:hover:text-emerald-300 shadow-inner'}`}
                    >
                      الكل
                    </button>
                    {filteredCategoriesTabs.map(c => (
                      <button 
                        key={c.name} 
                        onClick={() => { setCategoryFilter(c.name); setItemFilter('الكل'); setTraceItemFilter(''); }} 
                        className={`px-4 py-2 rounded-xl text-xs font-black outline-none border flex items-center gap-1.5 group
                          ${categoryFilter === c.name 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm ring-1 ring-emerald-200 scale-[1.02] dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 dark:shadow-[0_0_10px_rgba(16,185,129,0.2)] dark:ring-emerald-500/20' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300 hover:text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400/60 dark:border-emerald-500/10 dark:hover:bg-emerald-500/15 dark:hover:border-emerald-500/30 dark:hover:text-emerald-300 shadow-inner'}`}
                      >
                        {c.name} 
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] en-num
                          ${categoryFilter === c.name ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-500/30 dark:text-emerald-200' : 'bg-slate-200 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500/50 dark:group-hover:text-emerald-400/80'}`}>
                          {c.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* الطابق الثالث: الفرع والمادة */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-slate-200 dark:border-white/5">
                  {/* فلتر الفرع */}
                  <div className="flex items-center gap-3 w-full sm:w-1/2">
                     <span className="text-[13px] font-black text-slate-500 dark:text-slate-400 min-w-[50px]">الفرع:</span>
                     <div className="relative flex-1 group/select1">
                        <select 
                          value={branchFilter} 
                          onChange={(e) => setBranchFilter(e.target.value)} 
                          className="w-full bg-slate-50 border border-slate-300 dark:bg-[#0a0a0c] dark:border-white/10 px-4 py-2.5 outline-none font-bold text-slate-900 dark:text-white text-[13px] rounded-xl appearance-none focus:bg-white dark:focus:bg-white/5 focus:border-indigo-400 dark:focus:border-indigo-500/50 cursor-pointer shadow-inner"
                        >
                          <option value="الكل" className="bg-white dark:bg-[#121214]">كل الفروع</option>
                          {filteredBranchesDropdown.map(b => (
                            <option key={b.id} value={b.id} className="bg-white dark:bg-[#121214]">{b.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within/select1:text-indigo-500 dark:group-focus-within/select1:text-white pointer-events-none w-4 h-4" />
                     </div>
                  </div>

                  {/* فلتر المادة */}
                  <div className="flex items-center gap-3 w-full sm:w-1/2">
                     <span className="text-[13px] font-black text-slate-500 dark:text-slate-400 min-w-[50px]">المادة:</span>
                     <div className="relative flex-1 group/select2">
                        <select 
                          value={itemFilter} 
                          onChange={(e) => setItemFilter(e.target.value)} 
                          className="w-full bg-slate-50 border border-slate-300 dark:bg-[#0a0a0c] dark:border-white/10 px-4 py-2.5 outline-none font-bold text-slate-900 dark:text-white text-[13px] rounded-xl appearance-none focus:bg-white dark:focus:bg-white/5 focus:border-emerald-400 dark:focus:border-emerald-500/50 cursor-pointer shadow-inner"
                        >
                          <option value="الكل" className="bg-white dark:bg-[#121214]">كل المواد المرتبطة</option>
                          {filteredItemsDropdown.map(i => (
                            <option key={i.id} value={i.id} className="bg-white dark:bg-[#121214]">{i.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within/select2:text-emerald-500 dark:group-focus-within/select2:text-emerald-400 pointer-events-none w-4 h-4" />
                     </div>
                  </div>
                </div>
              </div>
            </div>

            <div ref={printRef} className="print-container w-full relative z-10">

              <div className="hidden print-only mb-8 border-b-4 border-slate-800 pb-4 w-full">
                 <div className="flex justify-between items-center w-full">
                    <div>
                       <h1 className="text-3xl font-black text-slate-900 mb-1">التحليل الاستراتيجي للنظام</h1>
                       <p className="text-lg font-bold text-slate-500">
                         نوع التقرير: {activeView === 'comparison' ? 'مقارنة فترات السحب' : activeView === 'monthly' ? `التحليل الشهري (${selectedMonth})` : `سجل مادة (${itemTraceData?.itemDetails?.name || ''})`}
                       </p>
                    </div>
                    <div className="text-left">
                       <p className="text-sm font-bold text-slate-500">تاريخ التصدير</p>
                       <p className="text-lg font-black text-slate-800 dir-ltr inline-block en-num">{dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
                    </div>
                 </div>
              </div>

              {/* ========================================= */}
              {/* 🟢 مقارنة الفترات (Comparison) 🟢 */}
              {/* ========================================= */}
              {activeView === 'comparison' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 w-full">
                  
                  {/* 🍱 شبكة البينتو 🍱 */}
                  <div className={`grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6 relative z-10 no-print ${isZenMode ? 'hidden' : 'block'}`}>
                     
                     {/* الكارت الملكي */}
                     <div className="lg:col-span-2 lg:row-span-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 md:p-8 rounded-[2rem] shadow-sm dark:shadow-xl flex flex-col justify-between relative overflow-hidden group">
                       <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-10 -mt-10 group-hover:scale-150 transition-transform duration-700 ${kpis.overallGrowth >= 0 ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-rose-100 dark:bg-rose-500/20'}`}></div>
                       <div className="relative z-10 flex justify-between items-start mb-6">
                          <div className={`p-3.5 rounded-2xl border ${kpis.overallGrowth >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30' : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30'}`}>
                             {kpis.overallGrowth >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => applyQuickCompare('thisVsLastWeek')} className="text-[10px] font-black bg-slate-50 hover:bg-slate-100 text-slate-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 outline-none">الأسبوع الماضي</button>
                            <button onClick={() => applyQuickCompare('thisVsLastMonth')} className="text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 dark:text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/30 outline-none">الشهر الماضي</button>
                          </div>
                       </div>
                       <div className="relative z-10 mt-auto">
                          <div className="flex flex-col mb-4">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">مؤشر النمو الكلي للمواد</span>
                            <p className={`text-5xl md:text-6xl font-black dir-ltr text-left tracking-tighter leading-none en-num ${kpis.overallGrowth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {kpis.overallGrowth > 0 ? '+' : ''}{kpis.overallGrowth}%
                            </p>
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-4">
                            <div>
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">الفرق في الكميات</p>
                              <p className={`text-lg font-black dir-ltr text-left text-slate-900 dark:text-white en-num`}>
                                {kpis.overallDiff > 0 ? '+' : ''}{formatNum(kpis.overallDiff)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">المسحوب (ب) مقابل (أ)</p>
                              <p className="text-sm font-black text-slate-900 dark:text-white dir-ltr en-num">{formatNum(kpis.totalB)} / {formatNum(kpis.totalA)}</p>
                            </div>
                          </div>
                       </div>
                     </div>

                     {/* تحديد الفترة أ */}
                     <div className="lg:col-span-1 lg:row-span-1 bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2rem] p-5 shadow-sm flex flex-col justify-center">
                       <h4 className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5 uppercase tracking-widest"><Target className="w-3.5 h-3.5" /> الفترة (أ) - الأساس:</h4>
                       <div className="space-y-2">
                         <div onClick={() => openDatePicker('periodAStart', periodAStart)} className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-[13px] font-black dir-ltr flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5">
                           <span className="en-num text-slate-900 dark:text-white tracking-widest">{dayjs(periodAStart).format('DD / MM / YYYY')}</span>
                           <CalendarDays className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                         </div>
                         <div onClick={() => openDatePicker('periodAEnd', periodAEnd)} className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-[13px] font-black dir-ltr flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5">
                           <span className="en-num text-slate-900 dark:text-white tracking-widest">{dayjs(periodAEnd).format('DD / MM / YYYY')}</span>
                           <CalendarDays className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                         </div>
                       </div>
                     </div>

                     {/* تحديد الفترة ب */}
                     <div className="lg:col-span-1 lg:row-span-1 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-500/20 rounded-[2rem] p-5 shadow-sm flex flex-col justify-center">
                       <h4 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-1.5 uppercase tracking-widest"><Zap className="w-3.5 h-3.5" /> الفترة (ب) - المقارنة:</h4>
                       <div className="space-y-2">
                         <div onClick={() => openDatePicker('periodBStart', periodBStart)} className="w-full bg-white dark:bg-[#121214] border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-4 py-2.5 text-[13px] font-black dir-ltr flex items-center justify-between cursor-pointer hover:bg-indigo-50 dark:hover:bg-white/5 shadow-inner text-indigo-700 dark:text-indigo-300">
                           <span className="en-num tracking-widest">{dayjs(periodBStart).format('DD / MM / YYYY')}</span>
                           <CalendarDays className="w-4 h-4 text-indigo-400 dark:text-indigo-500/50" />
                         </div>
                         <div onClick={() => openDatePicker('periodBEnd', periodBEnd)} className="w-full bg-white dark:bg-[#121214] border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-4 py-2.5 text-[13px] font-black dir-ltr flex items-center justify-between cursor-pointer hover:bg-indigo-50 dark:hover:bg-white/5 shadow-inner text-indigo-700 dark:text-indigo-300">
                           <span className="en-num tracking-widest">{dayjs(periodBEnd).format('DD / MM / YYYY')}</span>
                           <CalendarDays className="w-4 h-4 text-indigo-400 dark:text-indigo-500/50" />
                         </div>
                       </div>
                     </div>

                     {/* مواد ارتفعت */}
                     <div className="lg:col-span-1 lg:row-span-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-[2rem] p-6 text-emerald-600 dark:text-emerald-400 flex items-center justify-between group shadow-sm">
                        <div>
                          <p className="text-[11px] font-black mb-1 uppercase tracking-widest text-emerald-600 dark:text-emerald-500">مواد حققت نمو</p>
                          <p className="text-4xl font-black en-num">{kpis.upCount}</p>
                        </div>
                        <div className="bg-emerald-100 dark:bg-emerald-500/20 p-3 rounded-2xl group-hover:scale-110 border border-emerald-300 dark:border-emerald-500/30"><TrendingUp className="w-6 h-6" /></div>
                     </div>

                     {/* مواد تراجعت */}
                     <div className="lg:col-span-1 lg:row-span-1 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-[2rem] p-6 text-rose-600 dark:text-rose-400 flex items-center justify-between group shadow-sm">
                        <div>
                          <p className="text-[11px] font-black mb-1 uppercase tracking-widest text-rose-600 dark:text-rose-500">مواد تراجعت</p>
                          <p className="text-4xl font-black en-num">{kpis.downCount}</p>
                        </div>
                        <div className="bg-rose-100 dark:bg-rose-500/20 p-3 rounded-2xl group-hover:scale-110 border border-rose-300 dark:border-rose-500/30"><TrendingDown className="w-6 h-6" /></div>
                     </div>
                  </div>

                  <div className={`${isZenMode ? 'bg-slate-50 border border-slate-300 dark:bg-black dark:border-white/10 rounded-2xl shadow-none' : 'bg-white dark:bg-[#121214] p-4 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-2xl border border-slate-200 dark:border-white/10'} w-full min-h-[400px]`}>
                    <div className={`flex items-center justify-between mb-6 pb-5 border-b border-slate-200 dark:border-white/5 no-print ${isZenMode ? 'bg-slate-100 px-4 pt-4 dark:bg-black' : ''}`}>
                      <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 pl-4">
                        <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> جدول المقارنة المباشر للمواد
                      </h3>
                    </div>

                    {comparisonDataGrouped.length === 0 ? (
                      <div className="py-24 text-center text-slate-500">
                        <Archive className="w-16 h-16 mx-auto mb-4 opacity-40 text-slate-400 dark:text-slate-600" />
                        <p className="text-xl font-black">لا توجد حركات مسجلة في الفترتين المحددة.</p>
                      </div>
                    ) : (
                      // 💡 جدول الإكسل المخطط والثابت 💡
                      <div className={`overflow-auto w-full custom-island-scroll pb-6 rounded-2xl border border-slate-300 dark:border-white/10 shadow-inner ${isZenMode ? 'max-h-[85vh] bg-white dark:bg-[#0a0a0c]/50' : 'max-h-[550px] bg-slate-50 dark:bg-[#0a0a0c]/50'}`}>
                        <table className="w-full text-right border-collapse min-w-max print-table">
                          <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-[#121214] text-slate-600 dark:text-slate-400 font-black text-[12px] uppercase tracking-wider shadow-sm">
                            <tr>
                              <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10">ت</th>
                              <th className="py-3 px-4 border border-slate-300 dark:border-white/10">الوكالة</th>
                              <th className="py-3 px-6 border border-slate-300 dark:border-white/10">المادة المطلوبة</th>
                              <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10">الوحدة</th>
                              <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10 bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-slate-300">الفترة (أ)</th>
                              <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">الفترة (ب)</th>
                              <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10">الفرق</th>
                              <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10">مؤشر النمو</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-[13px]">
                            {comparisonDataGrouped.map((group, groupIndex) => {
                              const catColor = group.color || '#6366f1'; 
                              return (
                                <React.Fragment key={`${group.key}-${groupIndex}`}>
                                  <tr className="border-y-2 border-slate-300 dark:border-y-white/10 dark:border-t-white/10 dark:border-b-white/5" style={{ backgroundColor: isZenMode ? 'transparent' : `${catColor}10` }}>
                                    <td colSpan={8} className="py-3 px-5 font-black text-right sticky right-0 z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.2)] border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#121214]" style={{ color: catColor }}>
                                      <span className="flex items-center gap-2 text-[14px]">
                                        <Layers className="w-4 h-4" style={{ color: catColor }} />
                                        قسم: {group.categoryName}
                                        {agencyFilter === 'الكل' && <span className="text-[11px] mr-2 opacity-70" style={{ color: catColor }}>({group.agencyName})</span>}
                                      </span>
                                    </td>
                                  </tr>
                                  
                                  {group.items.map((row) => {
                                    const isUp = row.trend === 'up';
                                    const isDown = row.trend === 'down';
                                    const isNew = row.trend === 'new';
                                    const index = globalRenderIndex++;

                                    return (
                                      <tr key={row.item.id} className={`group/row ${isZenMode ? 'bg-white even:bg-slate-50 hover:bg-slate-100 dark:bg-black dark:even:bg-[#0a0a0c] dark:hover:bg-white/5' : 'bg-white even:bg-slate-50/80 hover:bg-indigo-50/50 dark:bg-[#0a0a0c] dark:even:bg-[#121214] dark:hover:bg-white/5'}`}>
                                        <td className="py-3 px-4 text-center font-bold text-slate-500 border border-slate-300 dark:border-white/10"><span className="en-num">{index}</span></td>
                                        <td className="py-3 px-4 font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap border border-slate-300 dark:border-white/10">{row.item.agencyName}</td>
                                        <td className="py-3 px-6 font-black text-slate-800 dark:text-slate-200 whitespace-nowrap border border-slate-300 dark:border-white/10">{row.item.name}</td>
                                        <td className="py-3 px-4 text-center font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap border border-slate-300 dark:border-white/10">{row.item.main_unit}</td>
                                        
                                        <td className="py-3 px-4 text-center whitespace-nowrap border border-slate-300 dark:border-white/10">
                                          <span className="inline-block bg-slate-100 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/10 px-3 py-1.5 rounded-xl font-black text-slate-800 dark:text-slate-200 en-num dir-ltr shadow-sm dark:shadow-inner text-sm min-w-[60px]">
                                            {row.qtyA}
                                          </span>
                                        </td>

                                        <td className="py-3 px-4 text-center whitespace-nowrap border border-slate-300 dark:border-white/10">
                                          <span className="inline-block bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 px-3 py-1.5 rounded-xl font-black text-indigo-700 dark:text-indigo-300 en-num dir-ltr shadow-sm dark:shadow-inner text-sm min-w-[60px]">
                                            {row.qtyB}
                                          </span>
                                        </td>
                                        
                                        <td className="py-3 px-4 text-center whitespace-nowrap border border-slate-300 dark:border-white/10">
                                          <span className={`inline-block px-3 py-1.5 rounded-xl font-black en-num dir-ltr shadow-sm dark:shadow-inner border text-sm min-w-[70px] ${row.diff > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400' : row.diff < 0 ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400' : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-400'}`}>
                                            {row.diff > 0 ? '+' : ''}{row.diff}
                                          </span>
                                        </td>

                                        <td className="py-3 px-4 text-center whitespace-nowrap border border-slate-300 dark:border-white/10">
                                          {isNew ? (
                                            <span className="inline-flex items-center justify-center gap-1.5 min-w-[90px] px-3 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 font-black text-[11px] shadow-sm">
                                              <Award className="w-3.5 h-3.5" /> مادة جديدة
                                            </span>
                                          ) : isUp ? (
                                            <span className="inline-flex items-center justify-center gap-1.5 min-w-[90px] px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 font-black text-[12px] en-num dir-ltr shadow-sm">
                                              <TrendingUp className="w-3.5 h-3.5" /> +{row.growthPct}%
                                            </span>
                                          ) : isDown ? (
                                            <span className="inline-flex items-center justify-center gap-1.5 min-w-[90px] px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 font-black text-[12px] en-num dir-ltr shadow-sm">
                                              <TrendingDown className="w-3.5 h-3.5" /> {row.growthPct}%
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center justify-center gap-1.5 min-w-[90px] px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 border border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10 font-black text-[11px]">
                                              <Minus className="w-3.5 h-3.5" /> استقرار
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* 🟢 التحليل الشهري (Monthly) 🟢 */}
              {/* ========================================= */}
              {activeView === 'monthly' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 w-full">
                  
                  {/* 🍱 شبكة البينتو 🍱 */}
                  <div className={`grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6 relative z-10 no-print ${isZenMode ? 'hidden' : 'block'}`}>
                    {/* إجمالي السحوبات */}
                    <div className="lg:col-span-2 lg:row-span-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 md:p-8 rounded-[2rem] shadow-sm dark:shadow-xl flex flex-col justify-between relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-100 dark:bg-emerald-500/20 rounded-full blur-3xl -ml-10 -mt-10 group-hover:scale-150 transition-transform duration-700"></div>
                      <div className="relative z-10 flex justify-between items-start mb-6">
                        <div className="bg-emerald-50 dark:bg-emerald-500/20 p-3.5 rounded-2xl text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                          <Hash className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">إجمالي السحب الشهري</span>
                      </div>
                      <div className="relative z-10 mt-auto">
                        <p className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white dir-ltr text-left tracking-tighter mb-4 en-num">
                          {monthlyData ? formatNum(monthlyData.grandTotal) : 0}
                        </p>
                        <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 pt-4">
                          <div>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">المتوسط اليومي التقريبي</p>
                            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 dir-ltr text-left en-num">
                              ~ {monthlyData ? formatNum(roundNumber(monthlyData.grandTotal / monthlyData.daysCount)) : 0}
                            </p>
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            <Activity className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* مربع اختيار الشهر (بالتقويم المبرمج) */}
                    <div 
                      onClick={() => openDatePicker('selectedMonth', selectedMonth + '-01', 'month')}
                      className="lg:col-span-1 lg:row-span-1 relative bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-[2rem] p-6 text-emerald-600 dark:text-emerald-400 shadow-sm overflow-hidden flex flex-col justify-center items-center group cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all"
                    >
                       <CalendarDays className="w-8 h-8 mb-3 opacity-90 group-hover:scale-110 relative z-10" />
                       <h3 className="text-[11px] font-black opacity-90 mb-2 relative z-10 uppercase tracking-widest">تحديد شهر التحليل</h3>
                       <span className="bg-transparent text-2xl font-black text-center border-b-2 border-emerald-300 dark:border-emerald-500/50 pb-1 dir-ltr relative z-10 en-num tracking-widest w-full">
                         {selectedMonth.split('-')[1]} / {selectedMonth.split('-')[0]}
                       </span>
                    </div>

                    {/* مربع المواد الفعالة */}
                    <div className="lg:col-span-1 lg:row-span-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-[2rem] p-6 text-amber-600 dark:text-amber-400 shadow-sm flex flex-col justify-between group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-amber-100 dark:bg-amber-500/20 p-3 rounded-xl border border-amber-200 dark:border-amber-500/30">
                          <PackageSearch className="w-5 h-5" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-amber-600 dark:text-amber-500 mb-1 uppercase tracking-widest">مواد مسحوبة بالشهر</p>
                        <p className="text-3xl font-black tracking-tight en-num">{monthlyData ? monthlyData.flatRowsCount : 0}</p>
                      </div>
                    </div>

                    {/* مربع إحصائية الفروع والوكالات */}
                    <div className="lg:col-span-2 lg:row-span-1 bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 shadow-sm flex items-center justify-between group">
                       <div className="flex items-center gap-4">
                         <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-2xl text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                           <Store className="w-6 h-6" />
                         </div>
                         <div>
                           <h3 className="font-black text-slate-900 dark:text-white text-lg">تحليل شامل للفروع والوكالات</h3>
                           <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">تتبع السحب اليومي وتوزيع الكميات</p>
                         </div>
                       </div>
                       <div className="text-left dir-ltr">
                         <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-3 py-1 rounded-xl en-num">{monthlyData?.daysCount} Day</span>
                       </div>
                    </div>
                  </div>

                  <div className={`${isZenMode ? 'bg-slate-50 border border-slate-300 dark:bg-black dark:border-white/10 rounded-2xl shadow-none' : 'bg-white dark:bg-[#121214] p-2 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-2xl border border-slate-200 dark:border-white/10'} w-full min-h-[500px]`}>
                    <div className={`flex items-center justify-between mb-6 pb-5 border-b border-slate-200 dark:border-white/5 no-print ${isZenMode ? 'bg-slate-100 px-4 pt-4 dark:bg-black' : ''}`}>
                      <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 pl-4">
                        <CalendarDays className="w-5 h-5 text-emerald-600 dark:text-emerald-500" /> توزيع كميات السحب على أيام الشهر
                      </h3>
                    </div>

                    {!monthlyData || monthlyData.groupedRows.length === 0 ? (
                      <div className="py-24 text-center text-slate-500">
                        <Archive className="w-16 h-16 mx-auto mb-4 opacity-40 text-slate-400 dark:text-slate-600" />
                        <p className="text-xl font-black">لا توجد حركات مسجلة في هذا الشهر.</p>
                      </div>
                    ) : (
                      // 💡 جدول الإكسل المخطط والثابت للتحليل الشهري 💡
                      <div className={`overflow-auto w-full custom-island-scroll pb-6 rounded-2xl border border-slate-300 dark:border-white/10 shadow-inner ${isZenMode ? 'max-h-[85vh] bg-white dark:bg-[#0a0a0c]/50' : 'max-h-[550px] bg-slate-50 dark:bg-[#0a0a0c]/50'}`}>
                        <table className="w-full text-right border-collapse print-table">
                          <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-[#121214] text-slate-600 dark:text-slate-400 font-black text-[11px] uppercase tracking-wider shadow-sm">
                            <tr>
                              <th className="py-3 px-3 text-center border border-slate-300 dark:border-white/10 sticky right-0 bg-slate-100 dark:bg-[#121214] z-30 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.3)]">ت</th>
                              <th className="py-3 px-4 border border-slate-300 dark:border-white/10 whitespace-nowrap">الوكالة</th>
                              <th className="py-3 px-4 border border-slate-300 dark:border-white/10 min-w-[180px]">المادة</th>
                              <th className="py-3 px-2 text-center border border-slate-300 dark:border-white/10 whitespace-nowrap">الوحدة</th>
                              
                              {Array.from({ length: monthlyData.daysCount }, (_, i) => i + 1).map(day => (
                                <th key={day} className="py-3 px-2 text-center border border-slate-300 dark:border-white/10 min-w-[40px] text-[11px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                  <span className="en-num">{day}</span>
                                </th>
                              ))}
                              
                              <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 sticky left-0 z-30 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.3)]">المجموع</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-[13px]">
                            {monthlyData.groupedRows.map((group, groupIndex) => {
                              const catColor = group.color || '#10b981';
                              return (
                                <React.Fragment key={`${group.key}-${groupIndex}`}>
                                  <tr className="border-y-2 border-slate-300 dark:border-y-white/10 dark:border-t-white/10 dark:border-b-white/5" style={{ backgroundColor: isZenMode ? 'transparent' : `${catColor}10` }}>
                                    <td colSpan={4 + monthlyData.daysCount + 1} className="py-3 px-5 font-black text-right sticky right-0 z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.3)] border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#121214]" style={{ color: catColor }}>
                                      <span className="flex items-center gap-2 text-[14px]">
                                        <Layers className="w-4 h-4" style={{ color: catColor }} />
                                        قسم: {group.categoryName}
                                        {agencyFilter === 'الكل' && <span className="text-[11px] mr-2 opacity-70" style={{ color: catColor }}>({group.agencyName})</span>}
                                      </span>
                                    </td>
                                  </tr>

                                  {group.items.map(row => {
                                    const index = globalMonthlyIndex++;
                                    return (
                                      <tr key={row.item.id} className={`group/row ${isZenMode ? 'bg-white even:bg-slate-50 hover:bg-slate-100 dark:bg-black dark:even:bg-[#0a0a0c] dark:hover:bg-white/5' : 'bg-white even:bg-slate-50/80 hover:bg-indigo-50/50 dark:bg-[#0a0a0c] dark:even:bg-[#121214] dark:hover:bg-white/5'}`}>
                                        <td className={`py-3 px-3 text-center font-bold text-slate-500 sticky right-0 z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.3)] border border-slate-300 dark:border-white/10 ${isZenMode ? 'bg-white group-even/row:bg-slate-50 group-hover/row:bg-slate-100 dark:bg-black dark:group-hover/row:bg-white/5' : 'bg-white group-even/row:bg-slate-50/80 group-hover/row:bg-indigo-50/50 dark:bg-[#0a0a0c] dark:group-even/row:bg-[#121214] dark:group-hover/row:bg-white/5'}`}>
                                          <span className="en-num">{index}</span>
                                        </td>
                                        <td className="py-3 px-4 font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap border border-slate-300 dark:border-white/10">{row.item.agencyName}</td>
                                        <td className="py-3 px-4 font-black text-slate-800 dark:text-slate-200 truncate max-w-[200px] border border-slate-300 dark:border-white/10" title={row.item.name}>{row.item.name}</td>
                                        <td className="py-3 px-2 text-center font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap border border-slate-300 dark:border-white/10">{row.item.main_unit}</td>
                                        
                                        {Array.from({ length: monthlyData.daysCount }, (_, i) => i + 1).map(day => {
                                          const qty = row.dailyQty[day];
                                          return (
                                            <td key={day} className={`py-3 px-1.5 text-center border border-slate-300 dark:border-white/10 ${qty > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-black' : 'text-slate-400 dark:text-slate-600 font-bold'}`}>
                                              <span className="en-num">{qty > 0 ? qty : '-'}</span>
                                            </td>
                                          );
                                        })}
                                        
                                        <td className={`py-3 px-4 text-center font-black text-base text-emerald-600 dark:text-emerald-400 sticky left-0 z-10 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.3)] border border-slate-300 dark:border-white/10 ${isZenMode ? 'bg-emerald-50/50 group-hover/row:bg-emerald-100 dark:bg-emerald-500/5 dark:group-hover/row:bg-emerald-500/10' : 'bg-emerald-50 group-hover/row:bg-emerald-100/80 dark:bg-emerald-500/10 dark:group-hover/row:bg-emerald-500/20'}`}>
                                          <span className="en-num">{row.total}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-800 dark:bg-[#121214] border-t-4 border-slate-900 dark:border-white/10">
                              <td colSpan={4} className="py-4 px-4 font-black text-white text-left sticky right-0 z-20 bg-slate-800 dark:bg-[#121214] shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.3)] border border-slate-700 dark:border-white/5">
                                إجمالي السحب اليومي:
                              </td>
                              {Array.from({ length: monthlyData.daysCount }, (_, i) => i + 1).map(day => {
                                const dailyTotal = monthlyData.footerTotals[day];
                                return (
                                  <td key={day} className={`py-4 px-1.5 text-center font-black border border-slate-700 dark:border-white/5 ${dailyTotal > 0 ? 'text-indigo-300 dark:text-indigo-400 text-[13px] bg-indigo-900/40 dark:bg-indigo-500/20' : 'text-slate-500 dark:text-slate-600 text-[11px]'}`}>
                                    <span className="en-num">{dailyTotal > 0 ? dailyTotal : '-'}</span>
                                  </td>
                                );
                              })}
                              <td className="py-4 px-4 text-center font-black text-xl text-white bg-emerald-600 dark:bg-emerald-500/20 sticky left-0 z-30 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.3)] border border-slate-700 dark:border-white/10">
                                <span className="en-num">{monthlyData.grandTotal}</span>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/* 🟢 تتبع السحوبات (Item Trace) 🟢 */}
              {/* ========================================= */}
              {activeView === 'item_trace' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 w-full">
                  
                  {/* 🍱 شبكة البينتو 🍱 */}
                  <div className={`grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6 relative z-10 no-print ${isZenMode ? 'hidden' : 'block'}`}>
                    {/* محرك البحث السريع */}
                    <div className="lg:col-span-2 lg:row-span-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-6 md:p-8 rounded-[2rem] shadow-sm dark:shadow-xl flex flex-col justify-center relative overflow-hidden group">
                       <div className="absolute top-0 left-0 w-32 h-32 bg-amber-100 dark:bg-amber-500/10 rounded-full blur-3xl -ml-10 -mt-10 group-hover:scale-150 transition-transform duration-700"></div>
                       <h3 className="text-[13px] font-black text-amber-600 dark:text-amber-400 mb-4 flex items-center gap-2 relative z-10 uppercase tracking-widest"><Search className="w-5 h-5"/> تحديد مسار المادة</h3>
                       
                       <div className="flex gap-3 relative z-10">
                         <div onClick={() => openDatePicker('traceStartDate', traceStartDate, 'date')} className="flex-1 bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 hover:border-amber-300 dark:hover:border-amber-500/30 shadow-inner">
                           <div>
                             <span className="block text-[9px] font-bold text-slate-500 mb-0.5">من تاريخ</span>
                             <span className="font-black text-sm dir-ltr text-slate-900 dark:text-white block en-num tracking-widest">{dayjs(traceStartDate).format('DD / MM / YYYY')}</span>
                           </div>
                           <Calendar className="w-4 h-4 text-amber-500/50" />
                         </div>
                         <div onClick={() => openDatePicker('traceEndDate', traceEndDate, 'date')} className="flex-1 bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 hover:border-amber-300 dark:hover:border-amber-500/30 shadow-inner">
                           <div>
                             <span className="block text-[9px] font-bold text-slate-500 mb-0.5">إلى تاريخ</span>
                             <span className="font-black text-sm dir-ltr text-slate-900 dark:text-white block en-num tracking-widest">{dayjs(traceEndDate).format('DD / MM / YYYY')}</span>
                           </div>
                           <Calendar className="w-4 h-4 text-amber-500/50" />
                         </div>
                       </div>
                    </div>

                    {/* إجمالي ما تم سحبه */}
                    <div className="lg:col-span-1 lg:row-span-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-[2rem] p-6 text-amber-600 dark:text-amber-400 shadow-sm dark:shadow-lg flex flex-col justify-between">
                       <p className="text-[11px] font-black mb-2 uppercase tracking-widest text-amber-600 dark:text-amber-500">إجمالي المسحوب</p>
                       <div className="flex items-end justify-between">
                         <p className="text-4xl font-black"><span className="en-num">{itemTraceData ? itemTraceData.totalQty : 0}</span></p>
                         <span className="font-bold bg-amber-100 dark:bg-amber-500/20 px-2 py-1 rounded-lg text-xs border border-amber-300 dark:border-amber-500/30">{itemTraceData?.itemDetails?.main_unit || '-'}</span>
                       </div>
                    </div>

                    {/* عدد الطلبيات */}
                    <div className="lg:col-span-1 lg:row-span-1 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
                       <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">الطلبيات المسجلة</p>
                       <div className="flex items-end justify-between">
                         <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400"><span className="en-num">{itemTraceData ? itemTraceData.ordersCount : 0}</span></p>
                         <div className="bg-slate-50 dark:bg-white/5 p-2.5 rounded-xl border border-slate-200 dark:border-white/10">
                           <ReceiptText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                         </div>
                       </div>
                    </div>

                    {/* انتشار المادة */}
                    <div className="lg:col-span-2 lg:row-span-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-[2rem] p-6 shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <div className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-500/30 p-3.5 rounded-2xl shadow-inner"><Store className="w-6 h-6" /></div>
                         <div>
                           <p className="font-black text-slate-900 dark:text-white text-lg">انتشار المادة في الفروع</p>
                           <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">الفروع التي قامت بسحب المادة</p>
                         </div>
                       </div>
                       <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#121214] px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm"><span className="en-num">{itemTraceData ? itemTraceData.branchesCount : 0}</span></span>
                    </div>
                  </div>

                  {itemTraceData && (
                    <>
                      <div className={`${isZenMode ? 'bg-slate-50 border border-slate-300 dark:bg-black dark:border-white/10 rounded-2xl shadow-none' : 'bg-white dark:bg-[#121214] p-2 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-2xl border border-slate-200 dark:border-white/10'} w-full min-h-[400px]`}>
                        <div className={`flex items-center justify-between mb-6 pb-5 border-b border-slate-200 dark:border-white/5 no-print ${isZenMode ? 'bg-slate-100 px-4 pt-4 dark:bg-black' : ''}`}>
                          <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 pl-4">
                            <FileClock className="w-5 h-5 text-amber-500" /> سجل السحوبات التفصيلي
                          </h3>
                        </div>

                        {itemTraceData.history.length === 0 ? (
                          <div className="py-24 text-center text-slate-500">
                            <Archive className="w-16 h-16 mx-auto mb-4 opacity-40 text-slate-400 dark:text-slate-600" />
                            <p className="text-xl font-black">لا يوجد أي سحب لهذه المادة في التواريخ المحددة.</p>
                          </div>
                        ) : (
                          // 💡 جدول الإكسل المخطط والثابت لسجل المادة مع الأعمدة الجديدة 💡
                          <div className={`overflow-auto w-full custom-island-scroll pb-6 rounded-2xl border border-slate-300 dark:border-white/10 shadow-inner ${isZenMode ? 'max-h-[85vh] bg-white dark:bg-[#0a0a0c]/50' : 'max-h-[550px] bg-slate-50 dark:bg-[#0a0a0c]/50'}`}>
                            <table className="w-full text-right border-collapse min-w-max print-table">
                              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-[#121214] text-slate-600 dark:text-slate-400 font-black text-[12px] uppercase tracking-wider shadow-sm">
                                <tr>
                                  <th className="py-3 px-4 text-center border border-slate-300 dark:border-white/10">ت</th>
                                  <th className="py-3 px-6 text-center border border-slate-300 dark:border-white/10">التاريخ والوقت</th>
                                  {/* 💡 العمودين الجدد في عرض السجل 💡 */}
                                  <th className="py-3 px-6 text-center border border-slate-300 dark:border-white/10">الفاتورة</th>
                                  <th className="py-3 px-6 text-center border border-slate-300 dark:border-white/10">النوع</th>
                                  <th className="py-3 px-6 border border-slate-300 dark:border-white/10">الفرع</th>
                                  <th className="py-3 px-6 border border-slate-300 dark:border-white/10">الوكالة التابع لها</th>
                                  <th className="py-3 px-6 text-center border border-slate-300 dark:border-white/10 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">الكمية المسحوبة</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-[13px]">
                                {itemTraceData.history.map((row, index) => {
                                  return (
                                    <tr key={index} className={`group/row ${isZenMode ? 'bg-white even:bg-slate-50 hover:bg-slate-100 dark:bg-black dark:even:bg-[#0a0a0c] dark:hover:bg-white/5' : 'bg-white even:bg-slate-50/80 hover:bg-indigo-50/50 dark:bg-[#0a0a0c] dark:even:bg-[#121214] dark:hover:bg-white/5'}`}>
                                      <td className="py-3 px-4 text-center font-bold text-slate-500 border border-slate-300 dark:border-white/10"><span className="en-num">{index + 1}</span></td>
                                      <td className="py-3 px-6 font-black text-slate-700 dark:text-slate-300 text-center whitespace-nowrap bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10"><span className="en-num dir-ltr">{row.datetime}</span></td>
                                      
                                      {/* 💡 بيانات الفاتورة والنوع 💡 */}
                                      <td className="py-3 px-6 font-black text-amber-600 dark:text-amber-400 text-center whitespace-nowrap border border-slate-300 dark:border-white/10"><span className="en-num dir-ltr">{row.invoiceNumber}</span></td>
                                      <td className="py-3 px-6 font-black text-sky-600 dark:text-sky-400 text-center whitespace-nowrap border border-slate-300 dark:border-white/10">{row.orderType}</td>

                                      <td className="py-3 px-6 font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap border border-slate-300 dark:border-white/10">{row.branchName}</td>
                                      <td className="py-3 px-6 font-black text-slate-600 dark:text-slate-400 whitespace-nowrap border border-slate-300 dark:border-white/10">{row.agencyName}</td>
                                      <td className="py-3 px-6 text-center font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 whitespace-nowrap border border-slate-300 dark:border-white/10 shadow-inner">
                                        <span className="en-num dir-ltr">{row.quantity}</span> <span className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 mr-1">{itemTraceData.itemDetails?.main_unit}</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  
                  {(!traceItemFilter || itemFilter === 'الكل') && (
                    <div className={`py-32 text-center text-slate-500 bg-white dark:bg-[#121214] rounded-[2.5rem] border border-slate-300 dark:border-white/10 border-dashed shadow-sm no-print ${isZenMode ? 'hidden' : 'block'}`}>
                      <PackageSearch className="w-16 h-16 mx-auto mb-4 opacity-40 text-slate-400 dark:text-slate-600" />
                      <p className="text-xl font-black text-slate-500 dark:text-slate-400">يرجى تحديد (المادة) من القوائم أعلاه لبدء التتبع بدقة.</p>
                    </div>
                  )}
                </div>
              )}

            </div>

          </>
        )}

        {/* ======================================================= */}
        {/* 🟢 التقويم المؤسساتي الشامل المبرمج (أيام، أشهر، سنوات) 🟢 */}
        {/* ======================================================= */}
        {datePickerConfig.isOpen && !isZenMode && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/50 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
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
                          if (datePickerConfig.target === 'selectedMonth') {
                            handleDateSelection(newDate.format('YYYY-MM-DD'));
                          } else {
                            setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'date'}));
                          }
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
                      
                      let selectedDateStr = '';
                      if (datePickerConfig.target === 'periodAStart') selectedDateStr = periodAStart;
                      else if (datePickerConfig.target === 'periodAEnd') selectedDateStr = periodAEnd;
                      else if (datePickerConfig.target === 'periodBStart') selectedDateStr = periodBStart;
                      else if (datePickerConfig.target === 'periodBEnd') selectedDateStr = periodBEnd;
                      else if (datePickerConfig.target === 'traceStartDate') selectedDateStr = traceStartDate;
                      else if (datePickerConfig.target === 'traceEndDate') selectedDateStr = traceEndDate;
                      else if (datePickerConfig.target === 'selectedMonth') selectedDateStr = selectedMonth + '-01';

                      const isSelected = dateStr === selectedDateStr;
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDateSelection(dateStr)}
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