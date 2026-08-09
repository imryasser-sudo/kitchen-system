"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';
import { 
  Loader2, AlertCircle, PackageSearch, Filter, Calendar, 
  FileSpreadsheet, Printer, Store, Package, CalendarDays, TrendingUp,
  RotateCcw, ChevronDown, PieChart, ArrowRightLeft, Building2, Map as MapIcon, AlertTriangle, Truck, Settings, Maximize, RefreshCw, Layers, Sun, Moon, Eye, EyeOff, CheckCircle2, MoveHorizontal
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar-iq';

import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

dayjs.locale('ar-iq');

const roundNumber = (num: number) => {
  return Math.round(num * 1000) / 1000;
};

const getArabicDay = (dateString: string) => {
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[dayjs(dateString).day()];
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

const getColLetter = (colIndex: number) => {
  let temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp - 1) / 26);
  }
  return letter;
};

interface FinalBranch {
  id: string;
  name: string;
  agencyName: string;
  sector: string;
  cleanName: string;
}

interface MappedItem {
  id: string;
  name: string;
  agencyName: string;
  categoryName: string;
  categoryColor: string;
  categorySequence: number;
  itemSequence: number;
  mainUnit: string;
  branchesData: Record<string, number>;
  rowTotal: number;
  globalIndex?: number; 
}

const defaultPdfSettings = {
  paperSize: 'A3', margin: '5mm', zoom: 95, shiftX: 0, autoFit: false,
  seqWidth: 3, agencyWidth: 8, categoryWidth: 8, itemWidth: 18, unitWidth: 6, totalWidth: 8, dynamicColWidth: 5
};

export default function SummaryPage() {
  const { isDark, toggleTheme } = useTheme();
  const [isZenMode, setIsZenMode] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeDateRange, setActiveDateRange] = useState<string>('month');
  
  const [branchFilter, setBranchFilter] = useState<string>('الكل');
  const [itemFilter, setItemFilter] = useState<string>('الكل');
  
  const [activeAgencyTab, setActiveAgencyTab] = useState<string>('الكل');
  const [activeSectorTab, setActiveSectorTab] = useState<string>('الكل');

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('matrixSummaryPdfSettings_v1');
    if (savedSettings) try { setPdfSettings(JSON.parse(savedSettings)); } catch (e) {}
  }, []);

  useEffect(() => {
    if (isMounted) localStorage.setItem('matrixSummaryPdfSettings_v1', JSON.stringify(pdfSettings));
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => setPdfSettings(prev => ({ ...prev, [key]: value }));
  const resetPdfSettings = () => setPdfSettings(defaultPdfSettings);

  const fetchData = async () => {
    setIsLoading(true); setDbError(null);
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
      
      const validOrders = (ordersData || []).filter(order => order.status !== 'pending' && order.status !== 'rejected');
      
      const { data: agenciesData, error: agenciesError } = await supabase.from('agencies').select('id, name');
      if (agenciesError) throw agenciesError;

      const { data: branchesData, error: branchesError } = await supabase.from('branches').select('id, name, agency_id, sector').order('name');
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
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
    const today = dayjs().format('YYYY-MM-DD');
    setStartDate(startOfMonth);
    setEndDate(today);
    setActiveDateRange('month');

    fetchData();
  }, []);

  const historicalAverages = useMemo(() => {
    const map: Record<string, Record<string, { sum: number, days: Set<string> }>> = {};
    orders.forEach(order => {
      const bId = order.branch_id;
      const orderDate = dayjs(order.created_at).format('YYYY-MM-DD');
      if (!bId) return;
      
      order.order_details?.forEach((detail: any) => {
        const iId = detail.item_id;
        const qty = parseFloat(detail.quantity) || 0;
        if (!map[bId]) map[bId] = {};
        if (!map[bId][iId]) map[bId][iId] = { sum: 0, days: new Set() };
        map[bId][iId].sum += qty;
        map[bId][iId].days.add(orderDate);
      });
    });

    const averages: Record<string, Record<string, number>> = {};
    Object.keys(map).forEach(bId => {
      averages[bId] = {};
      Object.keys(map[bId]).forEach(iId => {
        const data = map[bId][iId];
        averages[bId][iId] = data.sum / (data.days.size || 1);
      });
    });
    return averages;
  }, [orders]);

  const uniqueAgenciesList = useMemo(() => {
    const agencies = new Set<string>();
    allBranches.forEach(b => {
      const agName = b.agency_id ? (agenciesMap[b.agency_id] || '') : '';
      if (agName) agencies.add(agName);
    });
    return Array.from(agencies).sort();
  }, [allBranches, agenciesMap]);

  const uniqueSectorsList = useMemo(() => {
    const sectors = new Set<string>();
    allBranches.forEach(b => {
      const sector = b.sector || 'خطوط التوزيع العامة';
      if (sector) sectors.add(sector);
    });
    return Array.from(sectors).sort();
  }, [allBranches]);

  const { uniqueBranchesDropdown, uniqueItemsDropdown } = useMemo(() => {
    const itemsSet = new Set<string>();
    orders.forEach(order => {
      order.order_details?.forEach((detail: any) => {
        if (detail.items?.name) itemsSet.add(detail.items.name);
      });
    });

    const bList = allBranches.map(b => ({ id: b.id, name: b.name })).sort((a: any, b: any) => a.name.localeCompare(b.name));
    return { uniqueBranchesDropdown: bList, uniqueItemsDropdown: Array.from(itemsSet).sort() };
  }, [orders, allBranches]);

  const { branches, branchSectors, items, branchTotals, grandTotal, daysInView } = useMemo(() => {
    const finalBranchesMap = new Map<string, FinalBranch>();
    const itemsMap = new Map<string, MappedItem>();

    allBranches.forEach(b => {
      const agName = b.agency_id ? (agenciesMap[b.agency_id] || '') : '';
      finalBranchesMap.set(b.id, { 
        id: b.id, name: b.name, agencyName: agName,
        sector: b.sector || 'خطوط التوزيع العامة',
        cleanName: getCleanBranchName(b.name, agName)
      });
    });

    orders.forEach(order => {
      const bId = order.branch_id;
      if (bId && !finalBranchesMap.has(bId)) {
        const agId = order.branches?.agency_id;
        const agName = agId ? (agenciesMap[agId] || '') : '';
        const branchName = order.branches?.name || 'غير محدد';
        const sectorName = order.branches?.sector || 'خطوط التوزيع العامة';
        finalBranchesMap.set(bId, { 
          id: bId, name: branchName, agencyName: agName, sector: sectorName, cleanName: getCleanBranchName(branchName, agName)
        });
      }
    });

    let displayBranches = Array.from(finalBranchesMap.values());
    if (branchFilter !== 'الكل') displayBranches = displayBranches.filter(b => b.id === branchFilter);
    if (activeAgencyTab !== 'الكل') displayBranches = displayBranches.filter(b => b.agencyName === activeAgencyTab);
    if (activeSectorTab !== 'الكل') displayBranches = displayBranches.filter(b => b.sector === activeSectorTab);

    const sortedBranches = displayBranches.sort((a: any, b: any) => {
      if (a.sector !== b.sector) return (a.sector || '').localeCompare(b.sector || '');
      const aAg = a.agencyName || ''; const bAg = b.agencyName || '';
      if (aAg !== bAg) return aAg.localeCompare(bAg);
      return (a.cleanName || '').localeCompare(b.cleanName || '');
    });

    const sectorsArr: { name: string, count: number }[] = [];
    let currSector: any = null;
    sortedBranches.forEach(b => {
      if (!currSector || currSector.name !== b.sector) {
        if (currSector) sectorsArr.push(currSector);
        currSector = { name: b.sector, count: 0 };
      }
      currSector.count++;
    });
    if (currSector) sectorsArr.push(currSector);

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

      const branchAgencyName = finalBranchesMap.get(bId)?.agencyName;
      if (activeAgencyTab !== 'الكل' && branchAgencyName !== activeAgencyTab) return;

      const branchSectorName = finalBranchesMap.get(bId)?.sector;
      if (activeSectorTab !== 'الكل' && branchSectorName !== activeSectorTab) return;

      order.order_details?.forEach((detail: any) => {
        const iId = detail.item_id;
        const iName = detail.items?.name || 'غير محدد';
        if (itemFilter !== 'الكل' && iName !== itemFilter) return;

        const agId = detail.items?.agency_id;
        const agencyName = agId ? (agenciesMap[agId] || 'غير محدد') : 'غير محدد';
        if (activeAgencyTab !== 'الكل' && agencyName !== activeAgencyTab) return;

        const uniqueKey = iId;
        const dbPrim = detail.items?.primary_unit;
        const dbMain = detail.items?.main_unit;
        const catName = detail.items?.categories?.name || 'غير محدد';
        const catColor = detail.items?.categories?.color || '#cbd5e1';
        
        const rawCatSequence = detail.items?.categories?.sequence;
        const catSequence = (rawCatSequence !== null && rawCatSequence !== undefined) ? Number(rawCatSequence) : 999;
        const rawItemSequence = detail.items?.sequence;
        const itemSequence = (rawItemSequence !== null && rawItemSequence !== undefined) ? Number(rawItemSequence) : 999;

        const calculatedMainUnit = dbMain && dbMain !== '-' && dbMain !== 'null' ? dbMain : (dbPrim || 'لم تحدد');
        const qty = parseFloat(detail.quantity) || 0;

        if (!itemsMap.has(uniqueKey)) {
          itemsMap.set(uniqueKey, { 
            id: iId, name: iName, agencyName: agencyName, categoryName: catName, categoryColor: catColor,
            categorySequence: catSequence, itemSequence: itemSequence, mainUnit: calculatedMainUnit, branchesData: {}, rowTotal: 0
          });
        }

        const itemObj = itemsMap.get(uniqueKey)!; 
        itemObj.branchesData[bId] = roundNumber((itemObj.branchesData[bId] || 0) + qty);
        itemObj.rowTotal = roundNumber(itemObj.rowTotal + qty);
      });
    });

    const sortedItems = Array.from(itemsMap.values()).sort((a: any, b: any) => {
      if (a.agencyName !== b.agencyName) return a.agencyName.localeCompare(b.agencyName);
      if (a.categorySequence !== b.categorySequence) return a.categorySequence - b.categorySequence;
      if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
      if (a.itemSequence !== b.itemSequence) return a.itemSequence - b.itemSequence;
      return a.name.localeCompare(b.name);
    });

    const bTotals: Record<string, number> = {};
    let gTotal = 0;

    sortedBranches.forEach((b: any) => {
      bTotals[b.id] = roundNumber(sortedItems.reduce((sum: number, item: any) => sum + (item.branchesData[b.id] || 0), 0));
    });
    gTotal = roundNumber(sortedItems.reduce((sum: number, item: any) => sum + item.rowTotal, 0));

    let calcDays = 1;
    if (startDate && endDate) calcDays = Math.max(1, dayjs(endDate).diff(dayjs(startDate), 'day') + 1);
    else if (startDate) calcDays = Math.max(1, dayjs().diff(dayjs(startDate), 'day') + 1);
    else if (orders.length > 0) calcDays = Math.max(1, dayjs().diff(dayjs(orders[orders.length-1].created_at), 'day') + 1);

    return { branches: sortedBranches, branchSectors: sectorsArr, items: sortedItems, branchTotals: bTotals, grandTotal: gTotal, daysInView: calcDays };
  }, [orders, allBranches, startDate, endDate, branchFilter, itemFilter, agenciesMap, activeAgencyTab, activeSectorTab]);

  const groupedItems = useMemo(() => {
    const groups: { key: string; agencyName: string; categoryName: string; categoryColor: string; items: any[]; totals: { rowTotal: number; branches: Record<string, number> }; }[] = [];
    let currentGroup: any = null;

    items.forEach((item: any) => {
      const groupKey = `${item.agencyName}-${item.categoryName}`;
      if (!currentGroup || currentGroup.key !== groupKey) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          key: groupKey, agencyName: item.agencyName, categoryName: item.categoryName, categoryColor: item.categoryColor,
          items: [], totals: { rowTotal: 0, branches: {} }
        };
        branches.forEach((b: any) => currentGroup.totals.branches[b.id] = 0);
      }
      currentGroup.items.push(item);
      currentGroup.totals.rowTotal = roundNumber(currentGroup.totals.rowTotal + item.rowTotal);
      branches.forEach((b: any) => { currentGroup.totals.branches[b.id] = roundNumber(currentGroup.totals.branches[b.id] + (item.branchesData[b.id] || 0)); });
    });
    if (currentGroup) groups.push(currentGroup);
    
    let globalIdx = 1;
    groups.forEach(g => { g.items.forEach(i => { i.globalIndex = globalIdx++; }); });

    return groups;
  }, [items, branches]);

  const applyDateRange = (type: 'today' | 'week' | 'month' | 'all') => {
    setActiveDateRange(type);
    const today = dayjs().format('YYYY-MM-DD');
    if (type === 'today') { setStartDate(today); setEndDate(today); } 
    else if (type === 'week') { setStartDate(dayjs().subtract(7, 'day').format('YYYY-MM-DD')); setEndDate(today); } 
    else if (type === 'month') { setStartDate(dayjs().startOf('month').format('YYYY-MM-DD')); setEndDate(today); } 
    else if (type === 'all') { setStartDate(''); setEndDate(''); }
  };

  const handleCalendarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    setActiveDateRange('custom');
    const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
    if (input && typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch (error) { input.focus(); input.click(); }
    } else if (input) { input.focus(); input.click(); }
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

  const selectedBranchName = useMemo(() => {
    if (branchFilter === 'الكل') return 'الكل';
    return uniqueBranchesDropdown.find((b: any) => b.id === branchFilter)?.name || 'محدد';
  }, [branchFilter, uniqueBranchesDropdown]);

  // ==========================================
  // 💡 دوال التصدير 💡
  // ==========================================
  const handleExportExcel = async () => {
    if (items.length === 0) return alert("لا توجد بيانات لتصديرها.");

    let agencyTitle = activeAgencyTab !== 'الكل' ? `وكالة (${activeAgencyTab})` : 'الكل';
    if (activeSectorTab !== 'الكل') agencyTitle += ` - خط ${activeSectorTab}`;

    const hasAgencyCol = activeAgencyTab === 'الكل';
    const totalCols = branches.length + (hasAgencyCol ? 6 : 5);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('التوزيع المتقاطع', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 8, xSplit: hasAgencyCol ? 5 : 4 }] });

    worksheet.mergeCells(`A1:${getColLetter(totalCols)}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `تقرير التوزيع اللوجستي المتقاطع - ${agencyTitle}`;
    titleCell.font = { name: 'Cairo', size: 18, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 35;

    worksheet.mergeCells(`A2:${getColLetter(totalCols)}2`);
    const metaCell = worksheet.getCell('A2');
    metaCell.value = `تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')} | بواسطة: YASIR SAADOUN`;
    metaCell.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } };
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.addRow([]);

    const filterRow1 = worksheet.addRow(['النطاق الزمني:', getDateRangeText(), '', 'الفرع المحدد:', selectedBranchName]);
    worksheet.mergeCells('B4:C4');
    if (totalCols > 4) worksheet.mergeCells(`E4:${getColLetter(totalCols)}4`);
    
    const filterRow2 = worksheet.addRow(['خط التوزيع:', activeSectorTab, '', 'المادة المحددة:', itemFilter]);
    worksheet.mergeCells('B5:C5');
    if (totalCols > 4) worksheet.mergeCells(`E5:${getColLetter(totalCols)}5`);

    [filterRow1, filterRow2].forEach(row => {
      row.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      row.getCell(4).font = { bold: true, color: { argb: 'FF334155' } };
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      row.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } };
      row.getCell(5).font = { bold: true, color: { argb: 'FF0F172A' } };
    });

    worksheet.addRow([]);

    const headerRow1Data = [];
    for(let i=0; i < (hasAgencyCol ? 5 : 4); i++) headerRow1Data.push('معلومات المادة');
    branchSectors.forEach((sec: any) => {
      for(let i=0; i < sec.count; i++) headerRow1Data.push(`🚛 ${sec.name}`);
    });
    headerRow1Data.push('الخلاصة');

    const headerRow2Data = ['ت'];
    if (hasAgencyCol) headerRow2Data.push('الوكالة');
    headerRow2Data.push('القسم', 'المادة المطلوبة', 'و.الحساب');
    branches.forEach((b: any) => {
      headerRow2Data.push(`${b.agencyName && hasAgencyCol ? `${b.agencyName} - ` : ''}${b.cleanName}`);
    });
    headerRow2Data.push('المجموع الكلي');

    const h1 = worksheet.addRow(headerRow1Data);
    const h2 = worksheet.addRow(headerRow2Data);

    let startCol = (hasAgencyCol ? 5 : 4) + 1;
    worksheet.mergeCells(`A8:${getColLetter(startCol - 1)}8`);
    branchSectors.forEach((sec: any) => {
      if (sec.count > 1) worksheet.mergeCells(`${getColLetter(startCol)}8:${getColLetter(startCol + sec.count - 1)}8`);
      startCol += sec.count;
    });

    [h1, h2].forEach((row, i) => {
      row.height = 30;
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i===0 ? 'FF334155' : 'FF0F172A' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    let globalIndex = 1;
    groupedItems.forEach((group: any) => {
      const groupHeaderRow = worksheet.addRow([`📦 قسم: ${group.categoryName} ${hasAgencyCol ? `(${group.agencyName})` : ''}`]);
      groupHeaderRow.height = 30;
      worksheet.mergeCells(`A${groupHeaderRow.number}:${getColLetter(totalCols)}${groupHeaderRow.number}`);
      groupHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      groupHeaderRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF0F172A' } };
      groupHeaderRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

      group.items.forEach((item: any) => {
        const rowData: any[] = [globalIndex++];
        if (hasAgencyCol) rowData.push(item.agencyName);
        rowData.push(item.categoryName, item.name, item.mainUnit);
        
        branches.forEach((b: any) => {
          const qty = item.branchesData[b.id] || 0;
          const historicalAvg = historicalAverages[b.id]?.[item.id] || 0;
          const currentAvg = qty / daysInView;
          const isAnomaly = qty > 5 && currentAvg > (historicalAvg * 1.5);
          rowData.push(qty ? (isAnomaly ? `⚠️ ${qty}` : qty) : '-');
        });
        rowData.push(item.rowTotal);

        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 25;
        dataRow.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = { top: { style: 'thin', color: {argb: 'FFCBD5E1'} }, left: { style: 'thin', color: {argb: 'FFCBD5E1'} }, bottom: { style: 'thin', color: {argb: 'FFCBD5E1'} }, right: { style: 'thin', color: {argb: 'FFCBD5E1'} } };
          
          if (colNumber === (hasAgencyCol ? 5 : 4)) cell.font = { bold: true, color: { argb: 'FF059669' } };
          if (colNumber === totalCols) {
            cell.font = { bold: true, color: { argb: 'FF1E40AF' }, size: 12 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
          }
          if (String(cell.value).includes('⚠️')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
            cell.font = { bold: true, color: { argb: 'FFB45309' } };
          }
        });
      });
    });

    const footerData = [];
    footerData.push('المجموع النهائي الكلي:');
    for(let i=1; i < (hasAgencyCol ? 5 : 4); i++) footerData.push('');
    branches.forEach((b: any) => footerData.push(branchTotals[b.id]));
    footerData.push(grandTotal);

    const footerRow = worksheet.addRow(footerData);
    footerRow.height = 35;
    worksheet.mergeCells(`A${footerRow.number}:${getColLetter(hasAgencyCol ? 5 : 4)}${footerRow.number}`);
    
    footerRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { bold: true, color: { argb: 'FF38BDF8' }, size: 14 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thick', color: {argb: 'FF0F172A'} } };
    });
    footerRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };

    worksheet.columns.forEach((col, i) => {
      if (i === 0) col.width = 6;
      else if (i === (hasAgencyCol ? 3 : 2)) col.width = 30; 
      else col.width = 12;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `تقرير_التوزيع_اللوجستي_${activeSectorTab}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const handleExportPDF = () => {
    if (items.length === 0) return alert("لا توجد بيانات لطباعتها.");
    setIsExportingPDF(true);

    const agencyTitle = activeAgencyTab !== 'الكل' ? `لوظائف وكالة (${activeAgencyTab})` : 'الكلي (كل الوكالات)';
    const hasAgencyCol = activeAgencyTab === 'الكل';
    const getColStyle = (widthPercent: number) => pdfSettings.autoFit ? `padding: 8px 4px;` : `width: ${widthPercent}%; padding: 8px 4px;`;

    let dynamicHeaders = branches.map(b => `<th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.dynamicColWidth)} background-color: #f59e0b; color: white; word-break: break-word; white-space: normal;"><span style="font-size:13px; font-weight: 900;">${b.cleanName}</span>${b.agencyName && activeAgencyTab === 'الكل' ? `<span style="font-size:9px; color:#fde68a; display:block; line-height:1.2;">${b.agencyName}</span>` : ''}</th>`).join('');

    let trRows = '';
    let globalIndex = 0;

    groupedItems.forEach(group => {
      trRows += `
        <tr style="background-color: #f1f5f9; border-top: 2px solid #94a3b8; border-bottom: 2px solid #94a3b8;">
          <td colspan="${(hasAgencyCol ? 4 : 3) + branches.length + 1}" style="padding: 12px 15px; text-align: right; font-size: 15px; font-weight: 900; color: #1e293b; white-space: nowrap !important;">
            <span style="display:inline-block; width:12px; height:12px; background-color:${group.categoryColor}; border-radius:50%; margin-left:8px;"></span>
            ${hasAgencyCol ? group.agencyName + ' - ' : ''}${group.categoryName}
          </td>
        </tr>
      `;

      group.items.forEach(item => {
        globalIndex++;
        const rowClass = globalIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
        
        let dynamicCells = branches.map(b => {
          const qty = item.branchesData[b.id] || 0;
          const historicalAvg = historicalAverages[b.id]?.[item.id] || 0;
          const currentAvg = qty / daysInView;
          const isAnomaly = qty > 5 && currentAvg > (historicalAvg * 1.5);
          
          return `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: ${qty ? '900' : '700'}; color: ${qty ? (isAnomaly ? '#b45309' : '#1e3a8a') : '#cbd5e1'}; background-color: ${isAnomaly ? '#fef9c3' : 'transparent'}; border: 1px solid #e2e8f0; font-size: 14px;" dir="ltr">${qty || '-'}</td>`;
        }).join('');

        trRows += `
          <tr style="background-color: ${rowClass}; page-break-inside: avoid;">
            <td style="${getColStyle(pdfSettings.seqWidth)} color: #64748b; font-weight: bold; text-align: center; border: 1px solid #e2e8f0; font-size: 13px;">${globalIndex}</td>
            ${hasAgencyCol ? `<td style="${getColStyle(pdfSettings.agencyWidth)} text-align: center; color: #1d4ed8; font-weight: bold; border: 1px solid #e2e8f0; font-size: 13px;">${item.agencyName}</td>` : ''}
            <td style="${getColStyle(pdfSettings.itemWidth)} font-weight: 900; color: #1e293b; text-align: right; border: 1px solid #e2e8f0; font-size: 15px; word-break: break-word;">${item.name}</td>
            <td style="${getColStyle(pdfSettings.unitWidth)} text-align: center; color: #059669; font-weight: 900; border: 1px solid #e2e8f0; font-size: 13px;">${item.mainUnit}</td>
            ${dynamicCells}
            <td style="${getColStyle(pdfSettings.totalWidth)} text-align: center; background-color: #eff6ff; color: #1e40af; font-weight: 900; border: 1px solid #e2e8f0; font-size: 16px;" dir="ltr">${item.rowTotal}</td>
          </tr>
        `;
      });
    });

    let dynamicFooterCells = branches.map(b => `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: 900; border: 1px solid #e2e8f0; font-size: 15px; color: #1e40af;" dir="ltr">${branchTotals[b.id] || 0}</td>`).join('');

    const baseColsCount = hasAgencyCol ? 4 : 3;

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>ملخص_التوزيع_${dayjs().format('YYYYMMDD')}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            @page { size: ${pdfSettings.paperSize} landscape; margin: ${pdfSettings.margin}; }
            body { font-family: 'Cairo', system-ui, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; background: white; }
            .print-footer { display: flex !important; position: fixed !important; bottom: 0; left: 0; right: 0; background: white; padding-top: 6px; border-top: 2px solid #e2e8f0; z-index: 1000; justify-content: space-between; font-size: 13px; font-weight: 900; color: #64748b; }
            table { width: 100% !important; max-width: 100% !important; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'} !important; border-collapse: collapse; page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            th, td { word-wrap: break-word !important; word-break: break-word !important; white-space: normal !important; overflow-wrap: break-word !important; }
            .print-container { padding-bottom: 50px; zoom: ${pdfSettings.zoom / 100}; width: 100%; max-width: 100%; overflow: hidden; margin-right: ${pdfSettings.shiftX}mm; }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #f59e0b; padding-bottom: 12px; margin-bottom: 15px;">
              <div>
                <h1 style="margin: 0; color: #d97706; font-size: 28px; font-weight: 900;">تقرير التوزيع المتقاطع - ${agencyTitle}</h1>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 15px; font-weight: bold;">جدول متقاطع مدعوم بخطوط السير والتنبيهات للمطبخ المركزي</p>
              </div>
              <div style="text-align: left;">
                <p style="margin: 0; color: #475569; font-size: 13px; font-weight: bold;">المطبخ المركزي</p>
                <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 11px;">تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>

            <div style="background: #f8fafc; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; font-weight: bold; color: #334155;">
              <div style="background: white; border: 1px solid #cbd5e1; padding: 5px 12px; border-radius: 6px;">الفرع المختار: <span style="color: #0f172a; font-weight: 900;">${selectedBranchName}</span></div>
              <div style="background: white; border: 1px solid #cbd5e1; padding: 5px 12px; border-radius: 6px;">خط التوزيع: <span style="color: #0f172a; font-weight: 900;">${activeSectorTab}</span></div>
              <div style="background: white; border: 1px solid #cbd5e1; padding: 5px 12px; border-radius: 6px;">المادة المحددة: <span style="color: #0f172a; font-weight: 900;">${itemFilter}</span></div>
              <div style="background: white; border: 1px solid #cbd5e1; padding: 5px 12px; border-radius: 6px;">النطاق: <span dir="ltr" style="color: #0f172a; font-weight: 900;">${getDateRangeText()}</span></div>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f59e0b; color: #ffffff;">
                  <th style="${getColStyle(pdfSettings.seqWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">ت</th>
                  ${hasAgencyCol ? `<th style="${getColStyle(pdfSettings.agencyWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">الوكالة</th>` : ''}
                  <th style="${getColStyle(pdfSettings.itemWidth)} text-align: right; border: 1px solid #cbd5e1; font-size: 15px;">المادة المطلوبة</th>
                  <th style="${getColStyle(pdfSettings.unitWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">الوحدة</th>
                  ${dynamicHeaders}
                  <th style="${getColStyle(pdfSettings.totalWidth)} text-align: center; border: 1px solid #cbd5e1; background-color: #2563eb; color: white; font-size: 15px;">المجموع</th>
                </tr>
              </thead>
              <tbody>
                ${trRows}
                <tr style="background-color: #f1f5f9; color: #0f172a; border-top: 2px solid #94a3b8;">
                  <td colspan="${baseColsCount}" style="text-align: left; padding: 12px 15px; font-weight: 900; font-size: 15px; border: 1px solid #e2e8f0;">المجموع النهائي الكلي:</td>
                  ${dynamicFooterCells}
                  <td style="padding: 12px 4px; text-align: center; font-weight: 900; font-size: 17px; border: 1px solid #e2e8f0; background-color: #dbeafe; color: #1e40af;" dir="ltr">${grandTotal}</td>
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
        setIsExportingPDF(false);
        if (iframe.contentWindow) { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
        setTimeout(() => { document.body.removeChild(iframe); }, 1500);
      }, 1000);
    }
  };

  if (!isMounted) return null;

  const hasAgency = activeAgencyTab === 'الكل';
  const dynamicHeadersCount = branches.length;
  const totalCalculatedWidth = pdfSettings.seqWidth + (hasAgency ? pdfSettings.agencyWidth : 0) + pdfSettings.categoryWidth + pdfSettings.itemWidth + pdfSettings.unitWidth + pdfSettings.totalWidth + (pdfSettings.dynamicColWidth * dynamicHeadersCount);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen transition-colors duration-300 font-sans relative overflow-x-hidden pb-40 ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white'}`} dir="rtl">
        
        {/* خلفية الإضاءة */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] transition-colors duration-500 from-purple-100/50 via-slate-50 to-slate-50 dark:from-purple-900/15 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        {/* 🟢 الهيدر العلوي 🟢 */}
        <header className={`shrink-0 flex flex-col border-b z-30 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl shadow-sm border-slate-200 dark:border-white/5 transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 border-none' : 'scale-y-100 opacity-100'}`}>
          <div className="h-16 px-4 md:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg shadow-sm dark:shadow-inner border border-purple-200 dark:border-purple-500/20 transition-colors"><PieChart className="w-5 h-5" /></div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-800 dark:text-white transition-colors">التجهيز المجمع <span className="text-purple-600 dark:text-purple-400">(Matrix)</span></h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="p-2 rounded-lg outline-none cursor-pointer active:scale-95 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap" title="تغيير المظهر">
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <div className="w-px h-6 mx-1 bg-slate-200 dark:bg-white/10 transition-colors"></div>
              
              <button onClick={() => setIsZenMode(true)} className="p-2 rounded-lg outline-none cursor-pointer active:scale-95 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap" title="وضع التركيز">
                <Eye className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <div className={`p-4 md:p-6 max-w-[100rem] mx-auto w-full transition-all duration-300 ${isZenMode ? 'mt-4' : ''}`}>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 w-full no-print">
            <div className="flex items-center gap-5 text-right w-full md:w-auto">
              <div className="bg-purple-50 dark:bg-purple-500/10 p-4 rounded-3xl text-purple-600 dark:text-purple-400 shadow-sm border border-purple-100 dark:border-purple-500/20 shrink-0 transition-colors">
                <PieChart className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1 transition-colors">ملخص التوزيع المتقدم</h2>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors">جدول متقاطع مدعوم بخطوط السير والتنبيهات الذكية للشذوذ.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-slate-50 dark:bg-[#121214] p-2 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors">
                <button 
                  onClick={() => setShowPdfSettings(!showPdfSettings)} 
                  title="إعدادات القياس للـ PDF"
                  className={`p-3.5 rounded-xl transition-all shadow-sm border outline-none cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-amber-500 text-white border-amber-600 dark:bg-amber-600 dark:border-amber-700' : 'bg-white dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                  <Settings className={`w-5 h-5 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} />
                </button>
                <button onClick={handleExportPDF} disabled={isExportingPDF} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-[#0a0a0c] shadow-sm border border-slate-200 dark:border-white/10 px-5 py-3.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-black text-sm transition-all active:scale-95 disabled:opacity-50 outline-none cursor-pointer">
                  {isExportingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />} طباعة PDF
                </button>
                <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-[#0a0a0c] shadow-sm border border-slate-200 dark:border-white/10 px-5 py-3.5 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 font-black text-sm transition-all active:scale-95 outline-none cursor-pointer">
                  <FileSpreadsheet className="w-5 h-5" /> تصدير Excel
                </button>
              </div>

              {/* لوحة تحكم الطباعة الشاملة */}
              {showPdfSettings && (
                <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-amber-100 dark:border-amber-500/20 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.15)] dark:shadow-[0_10px_40px_-10px_rgba(245,158,11,0.05)] flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative transition-colors">
                  <div className="flex items-center justify-between border-b border-amber-50 dark:border-amber-500/10 pb-3">
                    <span className="text-sm font-black text-amber-700 dark:text-amber-400 flex items-center gap-2"><Settings className="w-4 h-4"/> إعدادات الطباعة المتقدمة (تُحفظ تلقائياً)</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95">
                      <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">حجم الورق</label>
                      <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-amber-700 dark:text-amber-400 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-amber-400 cursor-pointer transition-colors">
                        <option value="A3">A3 (أفضل للأفرع الكثيرة)</option>
                        <option value="A4">A4 (ورق قياسي)</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">هوامش الورقة</label>
                      <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-amber-700 dark:text-amber-400 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-amber-400 cursor-pointer transition-colors">
                        <option value="0mm">بدون هوامش (0mm)</option>
                        <option value="2mm">ضيقة جداً (2mm)</option>
                        <option value="5mm">ضيقة (5mm)</option>
                        <option value="10mm">عادية (10mm)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 ${pdfSettings.autoFit ? 'bg-amber-500 border-amber-600 text-white' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                        <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                        <span className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20 transition-colors" dir="ltr">{pdfSettings.shiftX} mm</span>
                      </div>
                      <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer mt-1" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <hr className="flex-1 border-slate-100 dark:border-white/5 transition-colors" />
                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1 rounded-full border border-slate-100 dark:border-white/5 transition-colors">إعدادات الأعمدة (تعمل مع الاحتواء اليدوي)</span>
                    <hr className="flex-1 border-slate-100 dark:border-white/5 transition-colors" />
                  </div>

                  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex flex-col gap-2 w-full col-span-1 sm:col-span-2 lg:col-span-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                        <span className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20 transition-colors">{pdfSettings.zoom}%</span>
                      </div>
                      <input type="range" min="30" max="100" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-amber-500 h-2 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض التسلسل (ت)</label><span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.seqWidth}%</span></div><input type="range" min="1" max="10" value={pdfSettings.seqWidth} onChange={e => updatePdfSetting('seqWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" /></div>
                    
                    {hasAgency && (
                      <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الوكالة</label><span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.agencyWidth}%</span></div><input type="range" min="3" max="20" value={pdfSettings.agencyWidth} onChange={e => updatePdfSetting('agencyWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" /></div>
                    )}
                    
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض المادة</label><span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.itemWidth}%</span></div><input type="range" min="10" max="40" value={pdfSettings.itemWidth} onChange={e => updatePdfSetting('itemWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الوحدة</label><span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.unitWidth}%</span></div><input type="range" min="3" max="15" value={pdfSettings.unitWidth} onChange={e => updatePdfSetting('unitWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض المجموع</label><span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.totalWidth}%</span></div><input type="range" min="4" max="20" value={pdfSettings.totalWidth} onChange={e => updatePdfSetting('totalWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-wider">عرض (حقل الفرع)</label><span className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20 transition-colors">{pdfSettings.dynamicColWidth}%</span></div><input type="range" min="2" max="25" value={pdfSettings.dynamicColWidth} onChange={e => updatePdfSetting('dynamicColWidth', Number(e.target.value))} className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" /></div>
                  </div>

                  {!pdfSettings.autoFit && (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
                      <span>مجموع النسب المئوية للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-800 dark:text-emerald-400'}`}>{totalCalculatedWidth}%</span></span>
                      {totalCalculatedWidth > 100 ? (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيقوم بضغط الجدول إجبارياً)</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول سيظهر بشكل مثالي في الورقة)</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#121214] p-6 rounded-[2.5rem] mb-8 border border-slate-200 dark:border-white/5 flex flex-col gap-5 w-full shadow-inner no-print transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-white/10 pb-5 transition-colors">
              <div className="flex items-center gap-2 font-black text-slate-600 dark:text-slate-300 text-base transition-colors">
                <Filter className="w-5 h-5 text-amber-500" /> فلترة وتحديد النطاق (الماضي):
              </div>
              
              <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm w-full md:w-auto overflow-x-auto transition-colors">
                <div className="px-3 text-[11px] font-black text-slate-400 dark:text-slate-500 flex items-center gap-1.5 shrink-0 transition-colors">
                  <CalendarDays className="w-4 h-4" /> النطاق:
                </div>
                <button onClick={() => applyDateRange('today')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === 'today' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>اليوم</button>
                <button onClick={() => applyDateRange('week')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === 'week' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>آخر 7 أيام</button>
                <button onClick={() => applyDateRange('month')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === 'month' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>هذا الشهر</button>
                <button onClick={() => applyDateRange('all')} className={`px-4 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === 'all' ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-[#050505] shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>كل الأيام</button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row gap-3">
                <div onClick={handleCalendarClick} className="relative flex-1 h-14 bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm flex items-center px-4 hover:border-amber-300 dark:hover:border-amber-500/50 transition-colors cursor-pointer group">
                  <Calendar className="w-5 h-5 text-amber-500 ml-3 shrink-0" />
                  <div className="flex flex-col z-10 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 transition-colors">من تاريخ</span>
                    <span className={`font-black text-sm dir-ltr text-right transition-colors ${startDate ? 'text-amber-700 dark:text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
                      {startDate ? dayjs(startDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                    </span>
                  </div>
                  <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setActiveDateRange('custom'); }} className="absolute w-0 h-0 opacity-0 pointer-events-none" />
                </div>

                <div onClick={handleCalendarClick} className="relative flex-1 h-14 bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm flex items-center px-4 hover:border-amber-300 dark:hover:border-amber-500/50 transition-colors cursor-pointer group">
                  <Calendar className="w-5 h-5 text-amber-500 ml-3 shrink-0" />
                  <div className="flex flex-col z-10 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 transition-colors">إلى تاريخ</span>
                    <span className={`font-black text-sm dir-ltr text-right transition-colors ${endDate ? 'text-amber-700 dark:text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
                      {endDate ? dayjs(endDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                    </span>
                  </div>
                  <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setActiveDateRange('custom'); }} className="absolute w-0 h-0 opacity-0 pointer-events-none" />
                </div>
              </div>

              <div className="relative bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm h-14 flex items-center transition-colors">
                <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors"><Store className="w-5 h-5" /></div>
                <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-700 dark:text-white text-sm appearance-none cursor-pointer transition-colors">
                  <option value="الكل" className="bg-white dark:bg-[#121214]">كل الفروع</option>
                  {uniqueBranchesDropdown.map((branch: any) => (<option key={branch.id} value={branch.id} className="bg-white dark:bg-[#121214]">{branch.name}</option>))}
                </select>
                <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors" />
              </div>

              <div className="relative bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm h-14 flex items-center transition-colors">
                <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors"><Package className="w-5 h-5" /></div>
                <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-700 dark:text-white text-sm appearance-none cursor-pointer transition-colors">
                  <option value="الكل" className="bg-white dark:bg-[#121214]">كل المواد</option>
                  {uniqueItemsDropdown.map((item: any) => (<option key={item} value={item} className="bg-white dark:bg-[#121214]">{item}</option>))}
                </select>
                <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors" />
              </div>
            </div>
          </div>

          {dbError && (
            <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/20 text-center text-rose-600 dark:text-rose-400 font-bold shadow-sm w-full no-print transition-colors">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500 dark:text-rose-400 transition-colors" />
              <p>{dbError}</p>
            </div>
          )}

          {!dbError && isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 w-full no-print">
              <Loader2 className="w-12 h-12 text-amber-500 dark:text-amber-400 animate-spin" />
            </div>
          ) : !dbError && (
            <div className="bg-white dark:bg-[#121214] p-4 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/5 w-full min-h-[400px] transition-colors duration-300">
              
              <div className="flex items-center justify-between mb-6 pb-5 border-b border-slate-100 dark:border-white/5 no-print transition-colors">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-amber-500 dark:text-amber-400 transition-colors" />
                  <h3 className="text-xl md:text-2xl font-black text-slate-700 dark:text-white transition-colors">جدول التوزيع المتقاطع</h3>
                </div>
                <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-5 py-2 rounded-xl font-black text-sm border border-amber-100 dark:border-amber-500/20 shadow-inner transition-colors">
                  {items.length} مادة معروضة
                </span>
              </div>

              <div className="flex flex-col xl:flex-row gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-white/5 no-print transition-colors">
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={() => setActiveAgencyTab('الكل')}
                    className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${
                      activeAgencyTab === 'الكل' 
                      ? 'bg-slate-800 dark:bg-indigo-600 text-white shadow-md' 
                      : 'bg-white dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
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
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-white dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {agency}
                    </button>
                  ))}
                </div>

                <div className="hidden xl:block w-[1px] bg-slate-200 dark:bg-white/10 h-10 transition-colors"></div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-500 dark:text-slate-400 px-2 transition-colors">
                    <Truck className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /> خط التوزيع:
                  </div>
                  <button 
                    onClick={() => setActiveSectorTab('الكل')}
                    className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${
                      activeSectorTab === 'الكل' 
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'bg-white dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    كل الخطوط
                  </button>
                  
                  {uniqueSectorsList.map(sector => (
                    <button 
                      key={sector}
                      onClick={() => setActiveSectorTab(sector)}
                      className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all outline-none cursor-pointer active:scale-95 ${
                        activeSectorTab === sector 
                        ? 'bg-emerald-500 text-white shadow-md' 
                        : 'bg-white dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {sector}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 no-print">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 rounded-xl text-xs font-bold w-fit border border-amber-100 dark:border-amber-500/20 shadow-inner transition-colors">
                  <ArrowRightLeft className="w-4 h-4 animate-pulse" /> 
                  اسحب الجدول يميناً ويساراً (Scroll) لرؤية كافة الفروع المخفية
                </div>
                
                <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-4 py-2 rounded-xl text-xs font-bold w-fit border border-orange-100 dark:border-orange-500/20 shadow-inner transition-colors">
                  <AlertTriangle className="w-4 h-4" />
                  الخلايا البرتقالية تشير إلى كشف خلل أو شذوذ بكمية سحب الفرع
                </div>
              </div>

              {items.length === 0 ? (
                <div className="py-24 text-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-white/5 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 no-print transition-colors">
                  <PackageSearch className="w-20 h-20 mx-auto mb-5 opacity-30 text-amber-400 dark:text-amber-500" />
                  <p className="text-2xl font-black text-slate-600 dark:text-slate-300 mb-2 transition-colors">لا توجد مسحوبات مطابقة للبحث</p>
                  <p className="text-sm font-bold transition-colors">حاول تغيير نطاق التاريخ أو إزالة الفلاتر المحددة.</p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full custom-scrollbar pb-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner bg-slate-50/30 dark:bg-[#0a0a0c]/50 relative transition-colors duration-300">
                  <table className="w-full text-right border-collapse min-w-max">
                    <thead className="bg-slate-100 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase transition-colors duration-300">
                      <tr>
                        <th colSpan={activeAgencyTab === 'الكل' ? 4 : 3} className="bg-slate-100 dark:bg-[#0a0a0c] border-none sticky right-0 z-20 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors duration-300"></th>
                        {branchSectors.map((sec: any, idx: number) => (
                          <th key={idx} colSpan={sec.count} className="py-2 border border-slate-700 dark:border-white/10 text-center bg-slate-800 dark:bg-[#1a1a24] text-white font-bold text-[13px] transition-colors duration-300">
                            <div className="flex items-center justify-center gap-1.5"><MapIcon className="w-4 h-4 text-emerald-400"/> {sec.name}</div>
                          </th>
                        ))}
                        <th className="bg-slate-100 dark:bg-[#0a0a0c] border-none sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors duration-300"></th>
                      </tr>

                      <tr>
                        <th className="py-4 px-3 border-b-2 border-slate-200 dark:border-white/10 text-center sticky right-0 z-20 bg-slate-100 dark:bg-[#0a0a0c] shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors duration-300">ت</th>
                        
                        {activeAgencyTab === 'الكل' && (
                          <th className="py-4 px-4 border-b-2 border-slate-200 dark:border-white/10 text-center border-r border-slate-200 dark:border-white/5 transition-colors duration-300">الوكالة</th>
                        )}
                        
                        <th className="py-4 px-5 border-b-2 border-slate-200 dark:border-white/10 text-right min-w-[200px] border-l border-slate-200 dark:border-white/5 transition-colors duration-300">المادة المطلوبة</th>
                        <th className="py-4 px-4 border-b-2 border-slate-200 dark:border-white/10 text-center text-emerald-600 dark:text-emerald-500 border-l border-slate-200 dark:border-white/5 transition-colors duration-300">وحدة الحساب</th>
                        
                        {branches.map((branch: any) => (
                          <th key={branch.id} className="py-4 px-2 border-b-2 border-slate-200 dark:border-white/10 text-center min-w-[70px] max-w-[120px] align-bottom bg-white/50 dark:bg-white/5 transition-colors duration-300">
                            <div className="flex flex-col items-center justify-end gap-1 h-full">
                              {branch.agencyName && activeAgencyTab === 'الكل' && (
                                <span className="text-[10px] text-blue-500 dark:text-blue-400 font-bold leading-tight whitespace-normal">{branch.agencyName}</span>
                              )}
                              <span className="text-indigo-700 dark:text-indigo-400 font-black text-[14px] leading-tight whitespace-normal">{branch.cleanName}</span>
                            </div>
                          </th>
                        ))}
                        
                        <th className="py-4 px-4 bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 text-center border-r border-white dark:border-transparent sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors duration-300">المجموع</th>
                      </tr>
                    </thead>
                    <tbody className="transition-colors duration-300">
                      
                      {groupedItems.map((group: any) => (
                        <React.Fragment key={group.key}>
                          
                          <tr className="bg-slate-200/60 dark:bg-[#1a1a24] border-y-[3px] border-slate-300 dark:border-white/10 transition-colors duration-300">
                            <td colSpan={(activeAgencyTab === 'الكل' ? 4 : 3) + branches.length + 1} className="py-3.5 px-5 text-right whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full shadow-inner border-2 border-white/50 dark:border-black/50" style={{ backgroundColor: group.categoryColor }}></div>
                                <span className="font-black text-[16px] text-slate-800 dark:text-white tracking-tight">
                                  {activeAgencyTab === 'الكل' ? `${group.agencyName} - ` : ''}{group.categoryName}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 font-bold text-[13px] mr-2 bg-white/50 dark:bg-black/30 px-3 py-1 rounded-lg shadow-inner">
                                  {group.items.length} مواد
                                </span>
                              </div>
                            </td>
                          </tr>

                          {group.items.map((item: any) => {
                            const index = item.globalIndex; 
                            return (
                              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1f] transition-colors bg-white dark:bg-transparent group">
                                <td className="py-3 px-3 text-slate-400 dark:text-slate-500 font-bold text-xs text-center sticky right-0 bg-inherit z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors border-b border-slate-100 dark:border-white/5">{index}</td>
                                
                                {activeAgencyTab === 'الكل' && (
                                  <td className="py-3 px-4 font-black text-blue-700 dark:text-blue-400 text-center whitespace-nowrap border-r border-b border-slate-100 dark:border-white/5 transition-colors">{item.agencyName}</td>
                                )}
                                
                                <td className="py-3 px-5 font-black text-slate-800 dark:text-white text-[15px] whitespace-normal border-l border-b border-slate-100 dark:border-white/5 transition-colors">
                                  {item.name}
                                </td>
                                <td className="py-3 px-4 text-emerald-700 dark:text-emerald-400 font-black text-[13px] text-center border-l border-b border-slate-100 dark:border-white/5 transition-colors">
                                  <span className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-1 rounded-lg shadow-inner">
                                    {item.mainUnit}
                                  </span>
                                </td>
                                
                                {branches.map((branch: any) => {
                                  const qty = item.branchesData[branch.id];
                                  const historicalAvg = historicalAverages[branch.id]?.[item.id] || 0;
                                  const currentAvg = qty / daysInView;
                                  const isAnomaly = qty > 5 && currentAvg > (historicalAvg * 1.5);

                                  return (
                                    <td key={branch.id} className={`py-3 px-3 text-center border-l border-b border-slate-100 dark:border-white/5 relative transition-colors ${isAnomaly ? 'bg-orange-50 dark:bg-orange-500/10' : ''}`}>
                                      {qty ? (
                                        <div className="flex flex-col items-center justify-center">
                                          <span className={`font-black text-[15px] en-num inline-block ${isAnomaly ? 'text-orange-600 dark:text-orange-400' : 'text-indigo-700 dark:text-indigo-400'}`}>
                                            {Number(qty).toString()}
                                          </span>
                                          {isAnomaly && (
                                            <span title={`متوسط سحب الفرع المعتاد هو ${Math.round(historicalAvg)} باليوم. الرقم الحالي أعلى بكثير!`} className="text-[9px] font-bold text-orange-500 flex items-center gap-0.5 mt-0.5 whitespace-nowrap cursor-help no-print">
                                              <AlertCircle className="w-3 h-3" /> شذوذ
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-slate-300 dark:text-slate-600 font-bold transition-colors">-</span>
                                      )}
                                    </td>
                                  )
                                })}
                                
                                <td className="py-3 px-4 text-center bg-blue-50/50 dark:bg-blue-900/10 border-b border-r border-blue-50 dark:border-blue-500/20 sticky left-0 z-10 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors">
                                  <span className="font-black text-blue-700 dark:text-blue-400 text-base en-num block transition-colors">
                                    {Number(item.rowTotal).toString()}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          
                        </React.Fragment>
                      ))}
                      
                    </tbody>
                    
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-[#0a0a0c] border-t-4 border-slate-200 dark:border-white/10 transition-colors duration-300">
                        <td colSpan={activeAgencyTab === 'الكل' ? 4 : 3} className="py-4 px-5 font-black text-slate-700 dark:text-slate-300 text-sm text-left border-l border-slate-200 dark:border-white/5 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(255,255,255,0.02)] sticky right-0 z-10 bg-slate-100 dark:bg-[#0a0a0c] transition-colors">
                          المجموع النهائي الكلي:
                        </td>
                        
                        {branches.map((branch: any) => {
                          const bTotal = branchTotals[branch.id] || 0;
                          return (
                            <td key={branch.id} className="py-4 px-3 text-center border-l border-white dark:border-[#121214] transition-colors">
                              <span className="font-black text-indigo-700 dark:text-indigo-400 text-lg en-num transition-colors">
                                {Number(bTotal).toString()}
                              </span>
                            </td>
                          )
                        })}
                        
                        <td className="py-4 px-4 text-center bg-blue-100 dark:bg-blue-500/20 border-r border-white dark:border-[#121214] sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors duration-300">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 transition-colors">المجموع الكلي</span>
                            <span className="font-black text-blue-800 dark:text-blue-400 text-2xl en-num block transition-colors">
                              {Number(grandTotal).toString()}
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
      </div>

      {/* 🟢 زر إنهاء وضع التركيز 🟢 */}
      {isZenMode && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-bottom-10 fade-in duration-500 no-print">
          <button 
            onClick={() => setIsZenMode(false)}
            className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-6 py-3.5 rounded-full font-black text-sm shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer whitespace-nowrap"
          >
            <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${isDark ? '#334155' : '#cbd5e1'}; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${isDark ? '#475569' : '#94a3b8'}; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
        .dir-ltr { direction: ltr; }
      `}} />
    </div>
  );
}