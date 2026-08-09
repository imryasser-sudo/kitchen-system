"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';
import { 
  Lightbulb, Loader2, AlertCircle, PackageSearch, Filter, Calendar, 
  FileSpreadsheet, Printer, Store, Package, CalendarDays, ArrowRightLeft, Building2,
  ChevronDown, RotateCcw, Percent, Settings, MoveHorizontal, Maximize, RefreshCw, Layers, Sun, Moon, Eye, EyeOff, CheckCircle2
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar-iq';

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

export default function SuggestionsPage() {
  const { isDark, toggleTheme } = useTheme();
  const [isZenMode, setIsZenMode] = useState(false);

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
  const [viewType, setViewType] = useState<'weekdays' | 'branches'>('branches');
  
  const [increasePercent, setIncreasePercent] = useState<number>(0);

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const weekdays = [
    { id: 0, name: 'الأحد' }, { id: 1, name: 'الإثنين' }, { id: 2, name: 'الثلاثاء' },
    { id: 3, name: 'الأربعاء' }, { id: 4, name: 'الخميس' }, { id: 5, name: 'الجمعة' }, { id: 6, name: 'السبت' }
  ];

  const quickPercentages = [-50, -20, -10, 0, 10, 20, 50, 100];

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('smartOrdersSuggestionsPdfSettings_v1');
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
      localStorage.setItem('smartOrdersSuggestionsPdfSettings_v1', JSON.stringify(pdfSettings));
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
          branches (id, name, sector, agency_id, sequence),
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
        .select('id, name, agency_id, sequence')
        .order('sequence', { ascending: true })
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
      return { id: b.id, name: b.name, sequence: b.sequence }; 
    }).sort((a, b) => {
      const seqA = a.sequence ?? 999;
      const seqB = b.sequence ?? 999;
      return seqA - seqB;
    });
    
    return { 
      uniqueBranchesDropdown: bList, 
      uniqueCategoriesDropdown: Array.from(categoriesSet).sort(),
      uniqueItemsDropdown: Array.from(itemsSet).sort() 
    };
  }, [orders, allBranches]);

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
        sequence: b.sequence ?? 999,
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
          sequence: order.branches?.sequence ?? 999,
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
      if (aAg === bAg) return a.sequence - b.sequence;
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
  }, [orders, allBranches, startDate, endDate, branchFilter, categoryFilter, itemFilter, agenciesMap, activeAgencyTab]);

  // 💡 المعالجة المتقدمة לעزل المواد حسب الأقسام (Category Grouping) 💡
  const groupedItems = useMemo(() => {
    const groups: { groupKey: string, agencyName: string, categoryName: string, categoryColor: string, categorySequence: number, items: any[] }[] = [];
    items.forEach(item => {
      const key = `${item.agencyName}-${item.categoryName}`;
      let group = groups.find(g => g.groupKey === key);
      if (!group) {
        group = { 
          groupKey: key, 
          agencyName: item.agencyName, 
          categoryName: item.categoryName, 
          categoryColor: item.categoryColor, 
          categorySequence: item.categorySequence, 
          items: [] 
        };
        groups.push(group);
      }
      group.items.push(item);
    });
    
    // ترتيب الأقسام نفسها حسب التسلسل الدقيق
    groups.sort((a, b) => {
       if (a.agencyName !== b.agencyName) return a.agencyName.localeCompare(b.agencyName);
       return a.categorySequence - b.categorySequence;
    });
    
    return groups;
  }, [items]);

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
    setIncreasePercent(0);
  };

  const handleOpenDatePicker = (ref: any) => {
    if (ref && ref.current) {
      try { ref.current.showPicker(); } 
      catch (e) { ref.current.focus(); ref.current.click(); }
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
    if (branchFilter === 'الكل') return 'كل الفروع';
    const branch = uniqueBranchesDropdown.find(b => b.id === branchFilter);
    return branch ? branch.name : 'فرع محدد';
  };

  const formatSuggestion = (sum: number, count: number) => {
    if (!count || count === 0) return '-';
    const avg = sum / count;
    if (avg === 0) return '-';
    const suggestion = avg * (1 + (increasePercent / 100));
    
    const rounded = Math.round(suggestion);
    return rounded <= 0 ? '-' : rounded.toString();
  };

  const handleExportExcel = () => {
    if (items.length === 0) return alert("لا توجد بيانات لتصديرها.");
    
    const isBranches = viewType === 'branches';
    const viewTitle = isBranches ? 'حسب الأفرع' : 'حسب أيام الأسبوع';
    const agencyTitle = activeAgencyTab !== 'الكل' ? `لوظائف وكالة (${activeAgencyTab})` : 'الكلي (كل الوكالات)';
    const branchName = getBranchFilterName();
    const catName = categoryFilter === 'الكل' ? 'كل الأقسام' : categoryFilter;
    const itemName = itemFilter === 'الكل' ? 'كل المواد' : itemFilter;

    let dynamicHeaders = isBranches 
      ? branches.map(b => `<th width="10%">${b.agencyName && activeAgencyTab === 'الكل' ? b.agencyName + '<br/>' : ''}${b.cleanName}</th>`).join('')
      : weekdays.map(d => `<th width="10%">${d.name}</th>`).join('');

    const baseCols = activeAgencyTab === 'الكل' ? 5 : 4; // لأن مسحنا عامود القسم من الإكسل وراح نخلي صف عريض
    const totalCols = (isBranches ? branches.length : 7) + baseCols;
    const remainingCols = Math.max(1, totalCols - 6);

    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar">
      <head><meta charset="utf-8" /><style>
        table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; }
        th { background-color: #f59e0b; color: #ffffff; font-weight: bold; font-size: 14px; padding: 12px; border: 1px solid #cbd5e1; text-align: center; }
        td { padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-size: 13px; color: #1e293b; }
        .alt-row { background-color: #f8fafc; }
        .total-col { background-color: #fef3c7; font-weight: bold; color: #b45309; }
        .footer-row td { background-color: #fde68a; font-weight: bold; color: #92400e; }
        .title { font-size: 22px; font-weight: bold; color: #d97706; text-align: center; padding: 15px; border:none; }
        .category-row td { background-color: #f1f5f9; color: #0f172a; font-weight: bold; font-size: 15px; text-align: right; padding: 12px; }
        
        .meta-label { background-color: #fef3c7; color: #92400e; font-weight: bold; text-align: right; padding-right: 15px; border: 1px solid #fde68a; }
        .meta-value { text-align: right; font-weight: bold; color: #1e293b; padding-right: 10px; border: 1px solid #fde68a; background-color: #fffbeb; }
        .meta-highlight { text-align: left; font-weight: bold; color: #d97706; font-size: 14px; padding-left: 15px; border: 1px solid #fde68a; background-color: #fffbeb; }
      </style></head>
      <body>
        <table>
          <tr><td colspan="${totalCols}" class="title">اقتراحات التجهيز المستقبلية (${viewTitle}) ${agencyTitle} - المطبخ المركزي</td></tr>
          
          <tr>
            <td colspan="2" class="meta-label">الفرع المختار:</td>
            <td colspan="2" class="meta-value">${branchName}</td>
            <td colspan="2" class="meta-label">التعديل المطبق:</td>
            <td colspan="${remainingCols}" class="meta-highlight" dir="ltr">${increasePercent > 0 ? '+' : ''}${increasePercent}%</td>
          </tr>
          <tr>
            <td colspan="2" class="meta-label">القسم:</td>
            <td colspan="2" class="meta-value">${catName}</td>
            <td colspan="2" class="meta-label">أيام العمل الفعلية:</td>
            <td colspan="${remainingCols}" class="meta-value" style="color: #d97706;">${totalDaysCount} يوم</td>
          </tr>
          <tr>
            <td colspan="2" class="meta-label">المادة المحددة:</td>
            <td colspan="2" class="meta-value">${itemName}</td>
            <td colspan="2" class="meta-label">نطاق التقرير (البيانات):</td>
            <td colspan="${remainingCols}" style="text-align: left; font-weight: bold; color: #64748b; padding-left: 15px; border: 1px solid #fde68a; background-color: #fffbeb;">${getDateRangeText()}</td>
          </tr>
          
          <tr><td colspan="${totalCols}" style="border:none; height: 15px;"></td></tr>

          <thead>
            <tr>
              <th width="3%">ت</th>
              ${activeAgencyTab === 'الكل' ? '<th width="10%">الوكالة</th>' : ''}
              <th width="20%">المادة المطلوبة</th>
              <th width="8%">وحدة الحساب</th>
              ${dynamicHeaders}
              <th width="10%">الاقتراح الكلي</th>
            </tr>
          </thead>
          <tbody>
    `;

    let globalIndex = 0;
    groupedItems.forEach(group => {
      tableHTML += `
        <tr class="category-row">
          <td colspan="${totalCols}">
            ${activeAgencyTab === 'الكل' ? group.agencyName + ' - ' : ''}${group.categoryName}
          </td>
        </tr>
      `;

      group.items.forEach((item) => {
        globalIndex++;
        const rowClass = globalIndex % 2 === 0 ? '' : 'alt-row';
        let dynamicCells = isBranches 
          ? branches.map(b => `<td style="${formatSuggestion(item.branchesSum[b.id] || 0, totalDaysCount) !== '-' ? 'background-color: #fef9c3; color: #b45309; font-weight: bold;' : ''}" dir="ltr">${formatSuggestion(item.branchesSum[b.id] || 0, totalDaysCount)}</td>`).join('')
          : weekdays.map(d => `<td dir="ltr">${formatSuggestion(item.weekdaysSum[d.id] || 0, weekdayCounts[d.id])}</td>`).join('');

        tableHTML += `
          <tr class="${rowClass}">
            <td>${globalIndex}</td>
            ${activeAgencyTab === 'الكل' ? `<td style="color: #1d4ed8; font-weight: bold;">${item.agencyName}</td>` : ''}
            <td style="text-align: right; font-weight: bold;">${item.name}</td>
            <td style="color: #059669; font-weight: bold;">${item.mainUnit}</td>
            ${dynamicCells}
            <td class="total-col" dir="ltr">${formatSuggestion(item.totalSum, totalDaysCount)}</td>
          </tr>
        `;
      });
    });

    let dynamicFooterCells = isBranches
      ? branches.map(b => `<td dir="ltr">${formatSuggestion(branchTotals[b.id] || 0, totalDaysCount)}</td>`).join('')
      : weekdays.map(d => `<td dir="ltr">${formatSuggestion(weekdayTotals[d.id] || 0, weekdayCounts[d.id])}</td>`).join('');

    tableHTML += `
          <tr class="footer-row">
            <td colspan="${baseCols - 1}" style="text-align: left; padding-left: 20px;">الاقتراح الكلي المقدر باليوم:</td>
            ${dynamicFooterCells}
            <td class="total-col" dir="ltr" style="font-size: 16px;">${formatSuggestion(grandTotal, totalDaysCount)}</td>
          </tr>
        </tbody></table></body></html>
    `;

    const blob = new Blob(['\uFEFF' + tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `اقتراحات_التجهيز_${viewType === 'branches' ? 'الافروع' : 'الايام'}_تعديل_${increasePercent}بالمئة.xls`;
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
    const catName = categoryFilter === 'الكل' ? 'كل الأقسام' : categoryFilter;
    const itemName = itemFilter === 'الكل' ? 'كل المواد' : itemFilter;

    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) return alert("يرجى السماح بالنوافذ المنبثقة (Pop-ups) بالمتصفح للطباعة.");

    const hasAgencyCol = activeAgencyTab === 'الكل';
    const getColStyle = (widthPercent: number) => {
      return pdfSettings.autoFit ? `padding: 6px 4px;` : `width: ${widthPercent}%; padding: 6px 4px;`;
    };

    let dynamicHeaders = isBranches 
      ? branches.map(b => `<th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.dynamicColWidth)} background-color: #f59e0b; color: white; word-break: break-word; white-space: normal;"><span style="font-size:13px; font-weight: 900;">${b.cleanName}</span>${b.agencyName && activeAgencyTab === 'الكل' ? `<span style="font-size:9px; color:#fde68a; display:block; line-height:1.2;">${b.agencyName}</span>` : ''}</th>`).join('')
      : weekdays.map(d => `<th style="text-align: center; border: 1px solid #cbd5e1; ${getColStyle(pdfSettings.dynamicColWidth)} background-color: #f59e0b; color: white; font-size: 13px; font-weight: 900; word-break: break-word; white-space: normal;">${d.name}</th>`).join('');

    let tableRowsHTML = '';
    let globalIndex = 0;

    groupedItems.forEach(group => {
      tableRowsHTML += `
        <tr style="background-color: #f1f5f9; border-top: 2px solid #94a3b8; border-bottom: 2px solid #94a3b8;">
          <td colspan="${hasAgencyCol ? 4 + (isBranches ? branches.length : 7) : 3 + (isBranches ? branches.length : 7)}" style="padding: 12px 15px; text-align: right; font-size: 15px; font-weight: 900; color: #1e293b; white-space: nowrap !important;">
            <span style="display:inline-block; width:12px; height:12px; background-color:${group.categoryColor}; border-radius:50%; margin-left:8px;"></span>
            ${activeAgencyTab === 'الكل' ? group.agencyName + ' - ' : ''}${group.categoryName}
          </td>
        </tr>
      `;

      group.items.forEach((item) => {
        globalIndex++;
        const rowClass = globalIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
        let dynamicCells = isBranches 
          ? branches.map(b => {
              const val = formatSuggestion(item.branchesSum[b.id] || 0, totalDaysCount);
              const isMax = val !== '-';
              return `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: ${isMax ? '900' : '700'}; color: ${isMax ? '#b45309' : '#cbd5e1'}; background-color: ${isMax ? '#fef9c3' : 'transparent'}; border: 1px solid #e2e8f0; font-size: 14px;" dir="ltr">${val}</td>`;
            }).join('')
          : weekdays.map(d => {
              const val = formatSuggestion(item.weekdaysSum[d.id] || 0, weekdayCounts[d.id]);
              const isMax = val !== '-';
              return `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: ${isMax ? '900' : '700'}; color: ${isMax ? '#b45309' : '#cbd5e1'}; background-color: ${isMax ? '#fef9c3' : 'transparent'}; border: 1px solid #e2e8f0; font-size: 14px;" dir="ltr">${val}</td>`;
            }).join('');

        tableRowsHTML += `
          <tr style="background-color: ${rowClass}; page-break-inside: avoid;">
            <td style="${getColStyle(pdfSettings.seqWidth)} color: #64748b; font-weight: bold; text-align: center; border: 1px solid #e2e8f0; font-size: 13px;">${globalIndex}</td>
            ${hasAgencyCol ? `<td style="${getColStyle(pdfSettings.agencyWidth)} text-align: center; color: #1d4ed8; font-weight: bold; border: 1px solid #e2e8f0; font-size: 13px;">${item.agencyName}</td>` : ''}
            
            <td style="${getColStyle(pdfSettings.itemWidth)} font-weight: 900; color: #1e293b; text-align: right; border: 1px solid #e2e8f0; font-size: 15px; word-break: break-word;">${item.name}</td>
            
            <td style="${getColStyle(pdfSettings.unitWidth)} text-align: center; color: #059669; font-weight: 900; border: 1px solid #e2e8f0; font-size: 13px;">${item.mainUnit}</td>
            ${dynamicCells}
            <td style="${getColStyle(pdfSettings.totalWidth)} text-align: center; background-color: #fef3c7; color: #b45309; font-weight: 900; border: 1px solid #e2e8f0; font-size: 16px;" dir="ltr">${formatSuggestion(item.totalSum, totalDaysCount)}</td>
          </tr>
        `;
      });
    });

    let dynamicFooterCells = isBranches
      ? branches.map(b => `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: 900; border: 1px solid #e2e8f0; font-size: 15px;" dir="ltr">${formatSuggestion(branchTotals[b.id] || 0, totalDaysCount)}</td>`).join('')
      : weekdays.map(d => `<td style="${getColStyle(pdfSettings.dynamicColWidth)} text-align: center; font-weight: 900; border: 1px solid #e2e8f0; font-size: 15px;" dir="ltr">${formatSuggestion(weekdayTotals[d.id] || 0, weekdayCounts[d.id])}</td>`).join('');

    const baseColsCount = hasAgencyCol ? 4 : 3;

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>اقتراحات_الطلبيات_${dayjs().format('YYYYMMDD')}</title>
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
          </style>
        </head>
        <body>
          <div class="print-container">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #f59e0b; padding-bottom: 12px; margin-bottom: 15px;">
              <div>
                <h1 style="margin: 0; color: #d97706; font-size: 28px; font-weight: 900;">اقتراحات التجهيز المستقبلية (${viewTitle}) ${agencyTitle}</h1>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 15px; font-weight: bold;">توقع ذكي للكميات بناءً على الماضي للمطبخ المركزي</p>
              </div>
              <div style="text-align: left;">
                <p style="margin: 0; color: #475569; font-size: 13px; font-weight: bold;">المطبخ المركزي</p>
                <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 11px;">تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>

            <div style="background: #fffbeb; padding: 10px 15px; border-radius: 8px; border: 1px solid #fde68a; margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; font-weight: bold; color: #92400e;">
              <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 5px 12px; border-radius: 6px;">التعديل المطبق: <span dir="ltr" style="color: #d97706; font-weight: 900; font-size: 15px;">${increasePercent > 0 ? '+' : ''}${increasePercent}%</span></div>
              <div style="background: white; border: 1px solid #fde68a; padding: 5px 12px; border-radius: 6px;">الفرع المختار: <span style="color: #d97706; font-weight: 900;">${branchName}</span></div>
              <div style="background: white; border: 1px solid #fde68a; padding: 5px 12px; border-radius: 6px;">القسم: <span style="color: #d97706; font-weight: 900;">${catName}</span></div>
              <div style="background: white; border: 1px solid #fde68a; padding: 5px 12px; border-radius: 6px;">المادة المحددة: <span style="color: #d97706; font-weight: 900;">${itemName}</span></div>
              <div style="background: white; border: 1px solid #fde68a; padding: 5px 12px; border-radius: 6px;">نطاق التقرير: <span dir="ltr" style="color: #d97706; font-weight: 900;">${getDateRangeText()}</span></div>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f59e0b; color: #ffffff;">
                  <th style="${getColStyle(pdfSettings.seqWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">ت</th>
                  ${hasAgencyCol ? `<th style="${getColStyle(pdfSettings.agencyWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">الوكالة</th>` : ''}
                  <th style="${getColStyle(pdfSettings.itemWidth)} text-align: right; border: 1px solid #cbd5e1; font-size: 15px;">المادة المطلوبة</th>
                  <th style="${getColStyle(pdfSettings.unitWidth)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px;">الوحدة</th>
                  ${dynamicHeaders}
                  <th style="${getColStyle(pdfSettings.totalWidth)} text-align: center; border: 1px solid #cbd5e1; background-color: #d97706; font-size: 15px;">الاقتراح الكلي</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHTML}
                <tr style="background-color: #fde68a; color: #92400e; border-top: 2px solid #f59e0b;">
                  <td colspan="${baseColsCount}" style="text-align: left; padding: 12px 15px; font-weight: 900; font-size: 15px; border: 1px solid #e2e8f0;">الاقتراح الكلي المقدر باليوم:</td>
                  ${dynamicFooterCells}
                  <td style="padding: 12px 4px; text-align: center; font-weight: 900; font-size: 17px; border: 1px solid #e2e8f0; background-color: #fef3c7;" dir="ltr">${formatSuggestion(grandTotal, totalDaysCount)}</td>
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

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const hasAgency = activeAgencyTab === 'الكل';
  const dynamicHeadersCount = viewType === 'branches' ? branches.length : 7;
  const totalCalculatedWidth = pdfSettings.seqWidth + (hasAgency ? pdfSettings.agencyWidth : 0) + pdfSettings.categoryWidth + pdfSettings.itemWidth + pdfSettings.unitWidth + pdfSettings.totalWidth + (pdfSettings.dynamicColWidth * dynamicHeadersCount);

  if (!isMounted) return null;

  let globalTrackingIdx = 0;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen transition-colors duration-300 font-sans relative overflow-x-hidden pb-40 ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white'}`} dir="rtl">
        
        {/* خلفية الإضاءة المشعة */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] transition-colors duration-500 from-amber-100/50 via-slate-50 to-slate-50 dark:from-amber-900/15 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        {/* 🟢 الهيدر الثابت المزدوج (إذا أردت وضع هيدر للتركيز والثيم) 🟢 */}
        <header className={`shrink-0 flex flex-col border-b z-30 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl shadow-sm border-slate-200 dark:border-white/5 transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 border-none' : 'scale-y-100 opacity-100'}`}>
          <div className="h-16 px-4 md:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg shadow-sm dark:shadow-inner border border-amber-200 dark:border-amber-500/20 transition-colors"><Lightbulb className="w-5 h-5" /></div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-800 dark:text-white transition-colors">اقتراح الطلبيات الذكي <span className="text-amber-600 dark:text-amber-400">(AI)</span></h2>
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
          
          {/* الترويسة و ازرار الطباعة */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 w-full">
            <div className="flex items-center gap-5 text-right w-full md:w-auto">
              <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-3xl text-amber-600 dark:text-amber-400 shadow-sm border border-amber-100 dark:border-amber-500/20 shrink-0 transition-colors">
                <Lightbulb className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1 transition-colors">اقتراح الطلبيات</h2>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors">توقع ذكي للكميات بناءً على الماضي مع نسبة زيادة أو نقصان مرنة.</p>
              </div>
            </div>

            {/* أزرار الطباعة والتصدير وإعداداتها */}
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-slate-50 dark:bg-[#121214] p-2 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors">
                
                {/* 💡 زر إعدادات الطباعة 💡 */}
                <button 
                  onClick={() => setShowPdfSettings(!showPdfSettings)} 
                  title="إعدادات القياس للـ PDF"
                  className={`p-3.5 rounded-xl transition-all shadow-sm border outline-none cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-amber-500 text-white border-amber-600 dark:bg-amber-600 dark:border-amber-700' : 'bg-white dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >
                  <Settings className={`w-5 h-5 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} />
                </button>

                <button onClick={handleExportPDF} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-[#0a0a0c] shadow-sm border border-slate-200 dark:border-white/10 px-5 py-3.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-black text-sm transition-all active:scale-95 outline-none cursor-pointer">
                  <Printer className="w-5 h-5" /> طباعة الاقتراحات (PDF)
                </button>
                <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white dark:bg-[#0a0a0c] shadow-sm border border-slate-200 dark:border-white/10 px-5 py-3.5 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 font-black text-sm transition-all active:scale-95 outline-none cursor-pointer">
                  <FileSpreadsheet className="w-5 h-5" /> تصدير لجداول (Excel)
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
                      <div className="flex justify-between text-[9px] font-bold text-slate-400"><span>إلى اليمين (-50)</span><span>إلى اليسار (+50)</span></div>
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

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض التسلسل (ت)</label>
                        <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.seqWidth}%</span>
                      </div>
                      <input type="range" min="1" max="10" value={pdfSettings.seqWidth} onChange={e => updatePdfSetting('seqWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    {hasAgency && (
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الوكالة</label>
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.agencyWidth}%</span>
                        </div>
                        <input type="range" min="3" max="20" value={pdfSettings.agencyWidth} onChange={e => updatePdfSetting('agencyWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                      </div>
                    )}

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض القسم</label>
                        <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.categoryWidth}%</span>
                      </div>
                      <input type="range" min="4" max="20" value={pdfSettings.categoryWidth} onChange={e => updatePdfSetting('categoryWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض المادة</label>
                        <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.itemWidth}%</span>
                      </div>
                      <input type="range" min="10" max="40" value={pdfSettings.itemWidth} onChange={e => updatePdfSetting('itemWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الوحدة</label>
                        <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.unitWidth}%</span>
                      </div>
                      <input type="range" min="3" max="15" value={pdfSettings.unitWidth} onChange={e => updatePdfSetting('unitWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الاقتراح العام</label>
                        <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 transition-colors">{pdfSettings.totalWidth}%</span>
                      </div>
                      <input type="range" min="4" max="20" value={pdfSettings.totalWidth} onChange={e => updatePdfSetting('totalWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-amber-500 dark:text-amber-400 uppercase tracking-wider">عرض (حقل الفرع/اليوم)</label>
                        <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20 transition-colors">{pdfSettings.dynamicColWidth}%</span>
                      </div>
                      <input type="range" min="2" max="25" value={pdfSettings.dynamicColWidth} onChange={e => updatePdfSetting('dynamicColWidth', Number(e.target.value))} className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] rounded-lg appearance-none cursor-pointer" />
                    </div>
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

          {/* 💡 لوحة التعديل والزيادة/النقصان (تحديث لدعم الأرقام السالبة) 💡 */}
          <div className="bg-amber-50/50 dark:bg-amber-500/5 p-5 md:p-6 rounded-[2.5rem] mb-6 w-full border border-amber-200 dark:border-amber-500/20 shadow-sm flex flex-col md:flex-row gap-6 items-center justify-between transition-colors">
            <div className="w-full md:w-1/3 flex flex-col gap-1">
              <h3 className="font-black text-amber-700 dark:text-amber-400 text-lg flex items-center gap-2 transition-colors">
                <Percent className="w-5 h-5" /> نسبة التعديل المقترحة
              </h3>
              <p className="text-xs font-bold text-amber-600/80 dark:text-amber-500/80 leading-relaxed transition-colors">
                حدد نسبة الزيادة أو النقصان المرغوبة فوق المعدل الطبيعي لتفادي النقص (مثلاً للخميس) أو لتخفيض الكميات وقت الركود.
              </p>
            </div>
            
            <div className="w-full md:w-2/3 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="-100" max="100" step="5"
                  value={increasePercent}
                  onChange={(e) => setIncreasePercent(parseInt(e.target.value))}
                  className="w-full h-3 bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-lg appearance-none cursor-pointer shadow-inner accent-amber-500 transition-colors"
                />
                <div className={`shrink-0 w-20 text-center bg-white dark:bg-[#121214] shadow-sm border border-slate-200 dark:border-white/10 py-1.5 rounded-xl font-black text-lg transition-colors ${increasePercent > 0 ? 'text-amber-600 dark:text-amber-400' : increasePercent < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`} dir="ltr">
                  {increasePercent > 0 ? '+' : ''}{increasePercent}%
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-end">
                {quickPercentages.map(pct => (
                  <button 
                    key={pct}
                    onClick={() => setIncreasePercent(pct)}
                    className={`px-4 py-1.5 rounded-xl font-black text-xs transition-all border outline-none cursor-pointer active:scale-95 ${increasePercent === pct ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-white dark:bg-[#121214] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-amber-600 dark:hover:text-amber-400'}`}
                    dir="ltr"
                  >
                    {pct === 0 ? 'طبيعي (0%)' : pct > 0 ? `+${pct}%` : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#121214] p-6 rounded-[2.5rem] mb-8 border border-slate-200 dark:border-white/5 flex flex-col gap-5 w-full shadow-inner transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-white/10 pb-5 transition-colors">
              <div className="flex items-center gap-2 font-black text-slate-600 dark:text-slate-300 text-base transition-colors">
                <Filter className="w-5 h-5 text-amber-500" /> فرز وتحديد النطاق (الماضي):
              </div>
              
              <div className="flex flex-col lg:flex-row gap-3 items-center w-full md:w-auto">
                <div className="flex items-center gap-2 bg-white dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-x-auto hide-scrollbar max-w-full w-full lg:w-fit transition-colors">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 px-2 shrink-0 transition-colors">نوع العرض:</span>
                  <button 
                    onClick={() => setViewType('weekdays')}
                    className={`px-4 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${viewType === 'weekdays' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                  >
                    حسب أيام الأسبوع
                  </button>
                  <button 
                    onClick={() => setViewType('branches')}
                    className={`px-4 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${viewType === 'branches' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                  >
                    حسب الأفرع
                  </button>
                </div>
                
                <div className="flex items-center gap-1 bg-white dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-x-auto hide-scrollbar max-w-full w-full lg:w-fit transition-colors">
                  <div className="px-2 text-[11px] font-black text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0 transition-colors">
                    <CalendarDays className="w-4 h-4" /> النطاق:
                  </div>
                  <button onClick={() => applyDateRange('today')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === 'today' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>اليوم</button>
                  <button onClick={() => applyDateRange('7days')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === '7days' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>آخر 7 أيام</button>
                  <button onClick={() => applyDateRange('14days')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === '14days' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>14 يوم</button>
                  <button onClick={() => applyDateRange('21days')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === '21days' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>21 يوم</button>
                  <button onClick={() => applyDateRange('28days')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === '28days' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>28 يوم</button>
                  <button onClick={() => applyDateRange('month')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === 'month' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>الشهر</button>
                  <button onClick={() => applyDateRange('all')} className={`px-3 py-2 rounded-xl text-[11px] font-black transition-colors shrink-0 outline-none cursor-pointer active:scale-95 ${activeDateRange === 'all' ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-[#050505] shadow-md' : 'bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>كل الأيام</button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
              <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row gap-3">
                <div onClick={() => handleOpenDatePicker(startDateRef)} className="relative flex-1 h-14 bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm flex items-center px-4 hover:border-amber-300 dark:hover:border-amber-500/50 transition-colors cursor-pointer group">
                  <Calendar className="w-5 h-5 text-amber-500 ml-3 shrink-0" />
                  <div className="flex flex-col z-10 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 transition-colors">من تاريخ</span>
                    <span className={`font-black text-sm dir-ltr text-right transition-colors ${startDate ? 'text-amber-700 dark:text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
                      {startDate ? dayjs(startDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                    </span>
                  </div>
                  <input type="date" ref={startDateRef} value={startDate} onChange={(e) => { setStartDate(e.target.value); setActiveDateRange('custom'); }} className="absolute w-0 h-0 opacity-0 pointer-events-none" />
                </div>

                <div onClick={() => handleOpenDatePicker(endDateRef)} className="relative flex-1 h-14 bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm flex items-center px-4 hover:border-amber-300 dark:hover:border-amber-500/50 transition-colors cursor-pointer group">
                  <Calendar className="w-5 h-5 text-amber-500 ml-3 shrink-0" />
                  <div className="flex flex-col z-10 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 transition-colors">إلى تاريخ</span>
                    <span className={`font-black text-sm dir-ltr text-right transition-colors ${endDate ? 'text-amber-700 dark:text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
                      {endDate ? dayjs(endDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                    </span>
                  </div>
                  <input type="date" ref={endDateRef} value={endDate} onChange={(e) => { setEndDate(e.target.value); setActiveDateRange('custom'); }} className="absolute w-0 h-0 opacity-0 pointer-events-none" />
                </div>
              </div>

              <div className="relative bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm h-14 flex items-center transition-colors">
                <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors"><Store className="w-5 h-5" /></div>
                <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-700 dark:text-white text-sm appearance-none cursor-pointer transition-colors">
                  <option value="الكل" className="bg-white dark:bg-[#121214]">كل الفروع</option>
                  {uniqueBranchesDropdown.map(b => <option key={b.id} value={b.id} className="bg-white dark:bg-[#121214]">{b.name}</option>)}
                </select>
                <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors" />
              </div>

              <div className="relative bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm h-14 flex items-center transition-colors">
                <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors"><Layers className="w-5 h-5" /></div>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-700 dark:text-white text-sm appearance-none cursor-pointer transition-colors">
                  <option value="الكل" className="bg-white dark:bg-[#121214]">كل الأقسام</option>
                  {uniqueCategoriesDropdown.map(cat => <option key={cat} value={cat} className="bg-white dark:bg-[#121214]">{cat}</option>)}
                </select>
                <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors" />
              </div>

              <div className="relative bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm h-14 flex items-center transition-colors">
                <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors"><Package className="w-5 h-5" /></div>
                <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-700 dark:text-white text-[13px] appearance-none cursor-pointer transition-colors">
                  <option value="الكل" className="bg-white dark:bg-[#121214]">كل المواد</option>
                  {uniqueItemsDropdown.map(item => <option key={item} value={item} className="bg-white dark:bg-[#121214]">{item}</option>)}
                </select>
                <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors" />
              </div>

              {(startDate !== '' || endDate !== '' || branchFilter !== 'الكل' || categoryFilter !== 'الكل' || itemFilter !== 'الكل' || activeAgencyTab !== 'الكل') && (
                <button onClick={clearFilters} className="h-14 flex items-center justify-center gap-2 px-5 bg-rose-50 dark:bg-rose-500/10 rounded-[1.5rem] border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 font-black text-sm hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors lg:col-span-5 shadow-sm outline-none cursor-pointer active:scale-95">
                  <RotateCcw className="w-5 h-5" /> مسح جميع الفلاتر
                </button>
              )}
            </div>
            
            <div className="mt-4 flex items-center justify-center sm:justify-start gap-2 bg-amber-100/50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-2xl w-fit shadow-sm transition-colors">
              <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 transition-colors" />
              <span className="font-bold text-amber-800 dark:text-amber-500 text-sm transition-colors">
                أيام العمل الفعلية المحسوبة: <span className="text-rose-600 dark:text-rose-400 font-black px-2 py-0.5 text-base bg-white dark:bg-black/20 border border-transparent dark:border-white/5 rounded-lg shadow-sm ml-1 transition-colors">{totalDaysCount}</span> يوم
              </span>
            </div>
          </div>

          {dbError && (
            <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/20 text-center text-rose-600 dark:text-rose-400 font-bold shadow-sm w-full transition-colors">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500 dark:text-rose-400" />
              <p>{dbError}</p>
            </div>
          )}

          {!dbError && isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 w-full">
              <Loader2 className="w-12 h-12 text-amber-500 dark:text-amber-400 animate-spin" />
            </div>
          ) : !dbError && (
            <div className="bg-white dark:bg-[#121214] p-4 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/5 w-full min-h-[400px] transition-colors duration-300">
              
              <div className="flex items-center justify-between mb-6 pb-5 border-b border-slate-100 dark:border-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <Lightbulb className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                  <h3 className="text-xl md:text-2xl font-black text-slate-700 dark:text-white transition-colors">جدول الاقتراحات المتقاطع</h3>
                </div>
                <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-5 py-2 rounded-xl font-black text-sm border border-amber-100 dark:border-amber-500/20 shadow-inner transition-colors">
                  {items.length} مادة مقترحة
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-6">
                <button 
                  onClick={() => setActiveAgencyTab('الكل')}
                  className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${
                    activeAgencyTab === 'الكل' 
                    ? 'bg-slate-800 dark:bg-indigo-600 text-white border-transparent shadow-md' 
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
                      ? 'bg-amber-500 dark:bg-amber-600 text-white border-transparent shadow-md' 
                      : 'bg-white dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {agency}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 px-4 py-2 rounded-xl text-xs font-bold w-fit mb-4 transition-colors shadow-inner">
                <ArrowRightLeft className="w-4 h-4 animate-pulse" /> 
                اسحب الجدول يميناً ويساراً (Scroll) لرؤية كافة الأعمدة المخفية
              </div>

              {items.length === 0 ? (
                <div className="py-24 text-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-white/5 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 transition-colors">
                  <PackageSearch className="w-20 h-20 mx-auto mb-5 opacity-30 text-amber-400 dark:text-amber-500" />
                  <p className="text-2xl font-black text-slate-600 dark:text-slate-300 mb-2 transition-colors">لا توجد مسحوبات ماضية مطابقة للبحث</p>
                  <p className="text-sm font-bold transition-colors">لا يمكن اقتراح كميات بدون وجود بيانات سابقة.</p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full custom-scrollbar pb-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner bg-slate-50/30 dark:bg-[#0a0a0c]/50 transition-colors duration-300">
                  <table className="w-full text-right border-collapse min-w-max">
                    <thead className="bg-slate-100 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase transition-colors duration-300">
                      <tr>
                        <th className="py-4 px-3 border-b-2 border-slate-200 dark:border-white/10 text-center sticky right-0 z-20 bg-slate-100 dark:bg-[#0a0a0c] shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors duration-300">ت</th>
                        
                        {activeAgencyTab === 'الكل' && (
                          <th className="py-4 px-4 border-b-2 border-slate-200 dark:border-white/10 text-center border-r border-slate-200 dark:border-white/5 transition-colors duration-300">الوكالة</th>
                        )}
                        
                        <th className="py-4 px-5 border-b-2 border-slate-200 dark:border-white/10 text-right min-w-[200px] border-l border-slate-200 dark:border-white/5 transition-colors duration-300">المادة المطلوبة</th>
                        <th className="py-4 px-4 border-b-2 border-slate-200 dark:border-white/10 text-center text-emerald-600 dark:text-emerald-500 border-l border-slate-200 dark:border-white/5 transition-colors duration-300">وحدة الحساب</th>
                        
                        {viewType === 'branches' 
                          ? branches.map(branch => (
                              <th key={branch.id} className="py-4 px-2 border-b-2 border-slate-200 dark:border-white/10 text-center min-w-[70px] max-w-[120px] align-bottom transition-colors duration-300">
                                <div className="flex flex-col items-center justify-end gap-1 h-full">
                                  {branch.agencyName && activeAgencyTab === 'الكل' && (
                                    <span className="text-[10px] text-blue-500 dark:text-blue-400 font-bold leading-tight whitespace-normal">{branch.agencyName}</span>
                                  )}
                                  <span className="text-indigo-700 dark:text-indigo-400 font-black text-[14px] leading-tight whitespace-normal">{branch.cleanName}</span>
                                </div>
                              </th>
                            ))
                          : weekdays.map(day => (
                              <th key={day.id} className="py-4 px-3 border-b-2 border-slate-200 dark:border-white/10 text-center text-indigo-700 dark:text-indigo-400 font-black text-[14px] min-w-[80px] transition-colors duration-300">
                                {day.name}
                              </th>
                            ))
                        }
                        
                        <th className="py-4 px-4 bg-amber-100 dark:bg-amber-500/10 border-b-2 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-center border-r border-white dark:border-transparent sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors duration-300">الاقتراح العام</th>
                      </tr>
                    </thead>
                    <tbody className="transition-colors duration-300">
                      {groupedItems.map((group, gIdx) => (
                        <React.Fragment key={`group-${group.groupKey}`}>
                          {/* 💡 شريط عنوان القسم 💡 */}
                          <tr className="bg-slate-200/60 dark:bg-[#1a1a24] border-y-[3px] border-slate-300 dark:border-white/10 transition-colors duration-300">
                            <td colSpan={viewType === 'branches' ? (activeAgencyTab === 'الكل' ? 4 : 3) + branches.length + 1 : (activeAgencyTab === 'الكل' ? 4 : 3) + 7 + 1} className="py-3.5 px-5 text-right whitespace-nowrap">
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
                          
                          {/* 💡 مواد القسم 💡 */}
                          {group.items.map((item, idx) => {
                            // للحصول على تسلسل مستمر للجدول كله أو داخل كل قسم
                            // حالياً سنضع التسلسل الخاص بالقسم
                            return (
                              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-[#1a1a1f] transition-colors bg-white dark:bg-transparent">
                                <td className="py-3 px-3 text-slate-400 dark:text-slate-500 font-bold text-xs text-center sticky right-0 bg-inherit z-10 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors border-b border-slate-100 dark:border-white/5">{idx + 1}</td>
                                
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
                                
                                {viewType === 'branches'
                                  ? branches.map(branch => {
                                      const val = formatSuggestion(item.branchesSum[branch.id] || 0, totalDaysCount);
                                      return (
                                        <td key={branch.id} className="py-3 px-3 text-center border-l border-b border-slate-100 dark:border-white/5 transition-colors">
                                          {val !== '-' ? (
                                            <span className={`font-black text-[15px] en-num inline-block px-2 py-0.5 rounded-lg shadow-sm border transition-colors ${increasePercent > 0 ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' : increasePercent < 0 ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' : 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10'}`}>
                                              {val}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300 dark:text-slate-600 font-bold transition-colors">-</span>
                                          )}
                                        </td>
                                      )
                                    })
                                  : weekdays.map(day => {
                                      const val = formatSuggestion(item.weekdaysSum[day.id] || 0, weekdayCounts[day.id]);
                                      return (
                                        <td key={day.id} className="py-3 px-3 text-center border-l border-b border-slate-100 dark:border-white/5 transition-colors">
                                          {val !== '-' ? (
                                            <span className={`font-black text-[15px] en-num inline-block px-2 py-0.5 rounded-lg shadow-sm border transition-colors ${increasePercent > 0 ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' : increasePercent < 0 ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' : 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10'}`}>
                                              {val}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300 dark:text-slate-600 font-bold transition-colors">-</span>
                                          )}
                                        </td>
                                      )
                                    })
                                }
                                
                                <td className="py-3 px-4 text-center bg-amber-50/50 dark:bg-amber-900/10 border-b border-r border-amber-100 dark:border-amber-500/20 sticky left-0 z-10 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors">
                                  <span className={`font-black text-base en-num px-3 py-1 rounded-xl shadow-sm inline-block border transition-colors ${increasePercent > 0 ? 'text-amber-700 dark:text-amber-400 bg-white dark:bg-[#121214] border-amber-200 dark:border-amber-500/30' : increasePercent < 0 ? 'text-rose-700 dark:text-rose-400 bg-white dark:bg-[#121214] border-rose-200 dark:border-rose-500/30' : 'text-slate-700 dark:text-slate-200 bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10'}`}>
                                    {formatSuggestion(item.totalSum, totalDaysCount)}
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
                        <td colSpan={activeAgencyTab === 'الكل' ? 4 : 3} className="py-4 px-5 font-black text-slate-700 dark:text-slate-300 text-sm text-left border-l border-slate-200 dark:border-white/5 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors">
                          الاقتراح الكلي المقدر باليوم:
                        </td>
                        
                        {viewType === 'branches'
                          ? branches.map(branch => (
                              <td key={branch.id} className="py-4 px-3 text-center border-l border-white dark:border-[#121214] transition-colors">
                                <span className="font-black text-indigo-700 dark:text-indigo-400 text-lg en-num transition-colors">
                                  {formatSuggestion(branchTotals[branch.id] || 0, totalDaysCount)}
                                </span>
                              </td>
                            ))
                          : weekdays.map(day => (
                              <td key={day.id} className="py-4 px-3 text-center border-l border-white dark:border-[#121214] transition-colors">
                                <span className="font-black text-indigo-700 dark:text-indigo-400 text-lg en-num transition-colors">
                                  {formatSuggestion(weekdayTotals[day.id] || 0, weekdayCounts[day.id])}
                                </span>
                              </td>
                            ))
                        }
                        
                        <td className="py-4 px-4 text-center bg-amber-100 dark:bg-amber-500/10 border-r border-white dark:border-[#121214] sticky left-0 z-20 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors duration-300">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 transition-colors">المجموع الكلي</span>
                            <span className="font-black text-amber-800 dark:text-amber-400 text-2xl en-num block transition-colors">
                              {formatSuggestion(grandTotal, totalDaysCount)}
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