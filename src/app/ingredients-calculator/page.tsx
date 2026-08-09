"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  Loader2, AlertCircle, Filter, Calendar, Store, MapPin,
  FileSpreadsheet, Printer, Layers, Package, Scale, 
  RotateCcw, ChevronDown, ArrowUpRight, ArrowDownRight, CalendarDays,
  Building2, SplitSquareHorizontal, CheckCircle2,
  UtensilsCrossed, Receipt, Box, FileText,
  Settings, MoveHorizontal, Maximize, RefreshCw,
  Calculator, ChevronRight, ChevronLeft, History, LayoutGrid,
  Eye, EyeOff, Minus, ArrowRightLeft
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useReactToPrint } from 'react-to-print';

dayjs.locale('ar');

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

interface SourceItemData {
  itemName: string;
  orderQty: number;
  perUnitQty: number;
  contribution: number;
  agencyName: string;
}

interface IngredientSummary {
  name: string;
  unit: string;
  totalQuantity: number;
  type: 'food' | 'packaging'; 
  sourceItems: SourceItemData[];
}

interface GroupedSummary {
  groupName: string;
  totalItems: number;
  ingredients: IngredientSummary[];
  orderedItems: { name: string, qty: number }[];
  totalFoodKilos: number;
  totalPackaging: number;
}

interface ItemTabSummary {
  itemName: string;
  agencyName: string;
  itemUnit: string;
  totalOrderQty: number;
  hasStandardRecipe: boolean;
  ingredientsList: {
    ingName: string;
    ingUnit: string;
    perUnitQty: number;
    totalContribution: number;
    type: 'food' | 'packaging';
  }[];
}

const getBaseUnitQty = (qty: number, unit: string) => {
  if (qty === undefined || qty === null || isNaN(qty) || !unit) return null;
  const cleanUnit = unit.replace(/[\s\uFEFF\xA0\u200B-\u200D]/g, '').toLowerCase();
  
  if (['غرام', 'غم', 'g', 'gm', 'جرام', 'جم'].includes(cleanUnit)) return { value: qty / 1000, label: 'كغم' };
  if (['مل', 'ملي', 'ml', 'مليلتر'].includes(cleanUnit)) return { value: qty / 1000, label: 'لتر' };
  if (['كغم', 'كجم', 'كيلو', 'kg'].includes(cleanUnit)) return { value: qty, label: 'كغم' };
  if (['لتر', 'liter', 'l', 'ltr'].includes(cleanUnit)) return { value: qty, label: 'لتر' };
  
  return { value: qty, label: unit.trim() }; 
};

const convertToBaseUnit = (val: number, unit: string) => {
  if (!unit) return val;
  const cleanUnit = unit.replace(/[\s\uFEFF\xA0\u200B-\u200D]/g, '').toLowerCase();
  if (['كغم', 'كجم', 'كيلو', 'kg', 'لتر', 'liter', 'l', 'ltr'].includes(cleanUnit)) return val * 1000;
  return val; 
};

const defaultPdfSettings = {
  paperSize: 'A3', margin: '10mm', bottomMargin: 25, footerOffset: 15, zoom: 85, shiftX: 0, autoFit: true,
  i_seq: 4, i_name: 26, i_perUnit: 12, i_req: 12, i_actual: 14, i_unit: 10, i_net: 14, i_meas: 8,
  o_seq: 3, o_name: 17, o_related: 15, o_agency: 9, o_perUnit: 8, o_count: 8, o_pull: 9, o_totalPull: 9, o_unit: 7, o_net: 9, o_meas: 6
};

export default function IngredientsCalculatorPage() {
  const { isDark } = useTheme(); 
  
  const [isZenMode, setIsZenMode] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  const [agenciesList, setAgenciesList] = useState<{id: string, name: string}[]>([]);
  const [allBranches, setAllBranches] = useState<any[]>([]); // 💡 هذا هو المتغير اللي كان مفقود وسبب الخطأ
  const [recipesList, setRecipesList] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [activeTab, setActiveTab] = useState<string>('all_agencies');
  
  const currentMonthStr = dayjs().format('YYYY-MM');
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());
  const [startDate, setStartDate] = useState<string>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [activeDateRange, setActiveDateRange] = useState<string>('month');

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, 
    target: 'start' | 'end' | 'monthOnly' | null, 
    viewDate: dayjs.Dayjs, 
    mode: 'date' | 'month' | 'year'
  }>({
    isOpen: false,
    target: null,
    viewDate: dayjs(),
    mode: 'date'
  });

  const [governorateFilter, setGovernorateFilter] = useState<string>('الكل');
  const [branchFilter, setBranchFilter] = useState<string>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [itemFilter, setItemFilter] = useState<string>('الكل');
  const [activeAgencyTab, setActiveAgencyTab] = useState<string>('الكل');

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('ingredientsCalcPdfSettings_v1');
    if (savedSettings) {
      try { setPdfSettings(JSON.parse(savedSettings)); } catch (e) { console.error(e); }
    }
    applyDateRange('month', dayjs());
  }, []);

  useEffect(() => {
    if (isMounted) localStorage.setItem('ingredientsCalcPdfSettings_v1', JSON.stringify(pdfSettings));
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => { setPdfSettings(prev => ({ ...prev, [key]: value })); };
  const resetPdfSettings = () => { setPdfSettings(defaultPdfSettings); };

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const { data: agenciesData, error: agenciesError } = await supabase.from('agencies').select('id, name');
      if (agenciesError) throw agenciesError;
      
      const agMap: Record<string, string> = {};
      agenciesData?.forEach(ag => { agMap[ag.id] = ag.name; });
      
      setAgenciesMap(agMap);
      setAgenciesList(agenciesData || []);

      const { data: branchesData, error: branchesError } = await supabase.from('branches').select('id, name, governorate, sector, agency_id').order('name');
      if (branchesError) throw branchesError;
      setAllBranches(branchesData || []); // 💡 هسه صار شغال 100% وبدون مشاكل

      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, branch_id, status, created_at,
          branches (id, name, governorate, sector),
          order_details (quantity, items (id, name, main_unit, primary_unit, agency_id, categories(name)))
        `)
        .limit(10000).order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      const validOrders = (ordersData || []).filter(order => order.status !== 'pending' && order.status !== 'rejected');
      setOrders(validOrders);

      const { data: recipesData, error: recipesError } = await supabase.from('recipes').select('*').order('version', { ascending: false }); 
      if (recipesError) throw recipesError;
      
      const latestRecipesMap = new Map();
      (recipesData || []).forEach(recipe => {
        const key = recipe.item_id ? `item_${recipe.item_id}` : `name_${recipe.name}`;
        if (!latestRecipesMap.has(key)) latestRecipesMap.set(key, recipe);
      });

      setRecipesList(Array.from(latestRecipesMap.values()));

    } catch (err: any) {
      setDbError(err?.message || "يرجى التأكد من اتصال قاعدة البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('ingredients-realtime').on('postgres_changes', { event: '*', schema: 'public' }, () => { fetchData(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const applyDateRange = (type: '1' | '7' | '14' | '21' | 'month' | 'all' | 'custom', refMonth: dayjs.Dayjs = selectedMonth) => {
    setActiveDateRange(type);
    setSelectedMonth(refMonth);
    
    if (type === '1') { 
      setStartDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
      setEndDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
    }
    else if (type === '7') { 
      setStartDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
      let end = refMonth.startOf('month').add(6, 'day');
      if (end.month() !== refMonth.month()) end = refMonth.endOf('month'); 
      setEndDate(end.format('YYYY-MM-DD')); 
    }
    else if (type === '14') { 
      setStartDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
      let end = refMonth.startOf('month').add(13, 'day');
      if (end.month() !== refMonth.month()) end = refMonth.endOf('month');
      setEndDate(end.format('YYYY-MM-DD')); 
    }
    else if (type === '21') { 
      setStartDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
      let end = refMonth.startOf('month').add(20, 'day');
      if (end.month() !== refMonth.month()) end = refMonth.endOf('month');
      setEndDate(end.format('YYYY-MM-DD')); 
    }
    else if (type === 'month') { 
      setStartDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
      setEndDate(refMonth.endOf('month').format('YYYY-MM-DD')); 
    }
    else if (type === 'all') { 
      setStartDate(''); setEndDate(''); 
    }
  };

  const shiftMonth = (direction: number) => {
    const newMonth = selectedMonth.add(direction, 'month');
    const rangeToApply = ['1', '7', '14', '21', 'month'].includes(activeDateRange) ? activeDateRange : 'month';
    applyDateRange(rangeToApply as any, newMonth);
  };

  const openDatePicker = (target: 'start' | 'end' | 'monthOnly') => {
    const initialDate = target === 'monthOnly' ? selectedMonth.format('YYYY-MM-DD') : (target === 'start' ? (startDate || dayjs().format('YYYY-MM-DD')) : (endDate || dayjs().format('YYYY-MM-DD')));
    setDatePickerConfig({ isOpen: true, viewDate: dayjs(initialDate), mode: target === 'monthOnly' ? 'month' : 'date', target });
  };

  const handleDateSelection = (dateStr: string) => {
    if (datePickerConfig.target === 'start') {
      setStartDate(dateStr);
      if (endDate && dateStr > endDate) setEndDate(dateStr);
      setActiveDateRange('custom');
      setSelectedMonth(dayjs(dateStr));
    } else if (datePickerConfig.target === 'end') {
      setEndDate(dateStr);
      if (startDate && dateStr < startDate) setStartDate(dateStr);
      setActiveDateRange('custom');
    }
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  const handleMonthSelection = (newDate: dayjs.Dayjs) => {
    if (datePickerConfig.target === 'monthOnly') {
       const rangeToApply = ['1', '7', '14', '21', 'month'].includes(activeDateRange) ? activeDateRange : 'month';
       applyDateRange(rangeToApply as any, newDate);
       setDatePickerConfig(p => ({ ...p, isOpen: false }));
    } else {
       setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'date'}));
    }
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const clearFilters = () => { applyDateRange('month', dayjs()); setGovernorateFilter('الكل'); setBranchFilter('الكل'); setCategoryFilter('الكل'); setItemFilter('الكل'); setActiveAgencyTab('الكل'); };

  const flattenedRecords = useMemo(() => {
    let records: any[] = [];
    orders.forEach(order => {
      order.order_details?.forEach((detail: any) => {
        const dbMain = detail.items?.main_unit;
        const dbPrim = detail.items?.primary_unit;
        const finalUnit = dbMain && dbMain !== '-' ? dbMain : (dbPrim || 'لم تحدد');
        const itemName = detail.items?.name || '-';
        const itemId = detail.items?.id;
        const itemAgencyId = detail.items?.agency_id;
        
        const standardRecipe = recipesList.find(r => {
          if (r.item_id && r.item_id !== itemId) return false;
          if (r.agency_id && r.agency_id !== itemAgencyId) return false;
          return r.name === itemName;
        });
        
        if (!standardRecipe) return;

        let finalIngredientsToUse: any[] = [];

        const processBOM = (ingredients: any[], multiplier: number) => {
          if (!Array.isArray(ingredients)) return;
          ingredients.forEach((ing: any) => {
            const baseQty = (Number(ing.perUnitQty) || Number(ing.quantity) || 0) * multiplier;
            if (ing.type === 'sub_recipe' && ing.sub_recipe_id) {
              const subRecipe = recipesList.find(r => String(r.id) === String(ing.sub_recipe_id));
              if (subRecipe && subRecipe.ingredients) {
                const requestedBase = convertToBaseUnit(baseQty, ing.unit);
                const subRecipePieceBase = convertToBaseUnit(Number(subRecipe.piece_weight) || 1, subRecipe.piece_unit || 'غرام');
                const subMultiplier = subRecipePieceBase ? (requestedBase / subRecipePieceBase) : 0;
                processBOM(subRecipe.ingredients, subMultiplier);
              } else {
                finalIngredientsToUse.push({ name: ing.name, unit: ing.unit, quantity: baseQty, type: 'food' });
              }
            } else {
              finalIngredientsToUse.push({ name: ing.name, unit: ing.unit, quantity: baseQty, type: 'food' });
            }
          });
        };

        if (Array.isArray(standardRecipe.ingredients)) processBOM(standardRecipe.ingredients, 1);
        if (Array.isArray(standardRecipe.packaging_materials)) {
          standardRecipe.packaging_materials.forEach((pack: any) => {
            finalIngredientsToUse.push({ name: pack.name, unit: pack.unit, quantity: pack.perUnitQty || pack.quantity, type: 'packaging' });
          });
        }

        records.push({
          branchId: order.branch_id, branchName: order.branches?.name || 'غير محدد',
          governorate: order.branches?.governorate || '-', date: order.created_at, itemName: itemName, 
          mainUnit: finalUnit, quantity: detail.quantity, ingredients: finalIngredientsToUse, 
          agencyId: itemAgencyId || 'unassigned', agencyName: itemAgencyId ? (agenciesMap[itemAgencyId] || 'غير محدد') : 'غير محدد',
          categoryName: detail.items?.categories?.name || 'غير محدد', hasStandardRecipe: true 
        });
      });
    });
    return records;
  }, [orders, agenciesMap, recipesList]);

  const filteredRecords = useMemo(() => {
    return flattenedRecords.filter(record => {
      const recordDate = dayjs(record.date).format('YYYY-MM-DD');
      const matchStartDate = !startDate || recordDate >= startDate;
      const matchEndDate = !endDate || recordDate <= endDate;
      const matchGov = governorateFilter === 'الكل' || record.governorate === governorateFilter;
      const matchBranch = branchFilter === 'الكل' || record.branchId === branchFilter;
      const matchCat = categoryFilter === 'الكل' || record.categoryName === categoryFilter;
      const matchItem = itemFilter === 'الكل' || record.itemName === itemFilter;
      const matchAgency = activeAgencyTab === 'الكل' || record.agencyName === activeAgencyTab;
      return matchStartDate && matchEndDate && matchGov && matchBranch && matchCat && matchItem && matchAgency;
    });
  }, [flattenedRecords, startDate, endDate, governorateFilter, branchFilter, categoryFilter, itemFilter, activeAgencyTab]);

  const groupedCalculations = useMemo<GroupedSummary[]>(() => {
    if (activeTab === 'item') return [];

    const mainGroups: Record<string, any> = {};
    let recordsToProcess = filteredRecords;
    if (activeTab.startsWith('agency_')) {
      const selectedAgencyId = activeTab.replace('agency_', '');
      recordsToProcess = filteredRecords.filter(r => r.agencyId === selectedAgencyId);
    }

    recordsToProcess.forEach(record => {
      const groupKey = activeTab === 'branch' ? record.branchName : record.agencyName;
      if (!mainGroups[groupKey]) { mainGroups[groupKey] = { summary: {}, itemsOrdered: new Map<string, number>() }; }
      
      const groupObj = mainGroups[groupKey];
      const orderQty = Number(record.quantity) || 0; 
      
      const currentItemQty = groupObj.itemsOrdered.get(record.itemName) || 0;
      groupObj.itemsOrdered.set(record.itemName, currentItemQty + orderQty);

      const summary = groupObj.summary;
      const ings = record.ingredients;

      if (Array.isArray(ings) && ings.length > 0) {
        ings.forEach((ing: any) => {
          const ingName = ing.name?.trim() || 'مكون غير محدد';
          const ingUnit = ing.unit?.trim() || '';
          const ingQtyPerItem = parseFloat(ing.quantity) || 0;
          const ingType = ing.type || 'food';
          const key = `${ingName}-${ingUnit}-${ingType}`;

          if (!summary[key]) { summary[key] = { name: ingName, unit: ingUnit, type: ingType, sourceMap: new Map<string, any>() }; }

          const sourceKey = `${record.itemName}-${record.agencyName}`; 
          const currentData = summary[key].sourceMap.get(sourceKey) || { itemName: record.itemName, orderQty: 0, perUnitQty: ingQtyPerItem, agencyName: record.agencyName };
          summary[key].sourceMap.set(sourceKey, { ...currentData, orderQty: currentData.orderQty + orderQty });
        });
      }
    });

    return Object.entries(mainGroups).map(([groupName, groupData]) => {
      let totalFoodKilos = 0; let totalPackaging = 0;

      const ingredients = Object.values(groupData.summary).map((ing: any) => {
        let totalQuantity = 0;
        const sourceItemsArr = Array.from(ing.sourceMap.values()).map((src: any) => {
          const contribution = src.orderQty * src.perUnitQty;
          totalQuantity += contribution;
          return { ...src, contribution };
        });
        
        const isPackaging = ing.type === 'packaging';
        const finalIngTotal = isPackaging ? Math.ceil(totalQuantity) : totalQuantity;
        const baseObj = getBaseUnitQty(finalIngTotal, ing.unit);

        if (isPackaging) { totalPackaging += finalIngTotal; } 
        else {
          if (baseObj && (baseObj.label === 'كغم' || baseObj.label === 'لتر')) totalFoodKilos += baseObj.value;
          else if (baseObj && baseObj.label === 'غرام') totalFoodKilos += baseObj.value / 1000;
        }
        
        return { name: ing.name, unit: ing.unit, type: ing.type, totalQuantity, sourceItems: sourceItemsArr };
      }).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'food' ? -1 : 1;
        return b.totalQuantity - a.totalQuantity;
      });

      const orderedItems = Array.from(groupData.itemsOrdered.entries()).map((entry: any) => ({ name: String(entry[0]), qty: Number(entry[1]) }));

      return { groupName, totalItems: ingredients.length, ingredients, orderedItems, totalFoodKilos, totalPackaging };
    }).sort((a, b) => a.groupName.localeCompare(b.groupName));

  }, [filteredRecords, activeTab]);

  const itemGroupedCalculations = useMemo<ItemTabSummary[]>(() => {
    if (activeTab !== 'item') return [];
    const itemGroups: Record<string, any> = {};

    filteredRecords.forEach(record => {
      const key = `${record.itemName}-${record.agencyName}`;
      if (!itemGroups[key]) {
        itemGroups[key] = { itemName: record.itemName, agencyName: record.agencyName, itemUnit: record.mainUnit, totalOrderQty: 0, hasStandardRecipe: record.hasStandardRecipe, ingredientsMap: {} };
      }

      const group = itemGroups[key];
      const orderQty = Number(record.quantity) || 0;
      group.totalOrderQty += orderQty;

      if (Array.isArray(record.ingredients)) {
        record.ingredients.forEach((ing: any) => {
          const ingName = ing.name?.trim() || 'مكون غير محدد';
          const ingUnit = ing.unit?.trim() || '';
          const ingQtyPerItem = parseFloat(ing.quantity) || 0;
          const ingType = ing.type || 'food';
          const ingKey = `${ingName}-${ingUnit}-${ingType}`;

          if (!group.ingredientsMap[ingKey]) { group.ingredientsMap[ingKey] = { ingName, ingUnit, perUnitQty: ingQtyPerItem, type: ingType }; }
        });
      }
    });

    return Object.values(itemGroups).map((g: any) => {
      const ingredientsList = Object.values(g.ingredientsMap).map((ing: any) => {
        const totalContribution = g.totalOrderQty * ing.perUnitQty;
        return { ...ing, totalContribution };
      }).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'food' ? -1 : 1;
        return b.totalContribution - a.totalContribution;
      });

      return { itemName: g.itemName, agencyName: g.agencyName, itemUnit: g.itemUnit, totalOrderQty: g.totalOrderQty, hasStandardRecipe: g.hasStandardRecipe, ingredientsList };
    }).sort((a, b) => b.totalOrderQty - a.totalOrderQty);
  }, [filteredRecords, activeTab]);

  const uniqueGovernorates = useMemo(() => { const s = new Set<string>(); flattenedRecords.forEach(r => { if(r.governorate !== '-') s.add(r.governorate); }); return Array.from(s).sort(); }, [flattenedRecords]);
  const uniqueBranches = useMemo<{ id: string, name: string }[]>(() => { const map = new Map<string, string>(); orders.forEach(o => { if(o.branches?.id) map.set(o.branches.id, o.branches.name); }); return Array.from(map.entries()).map(([id, name]) => ({ id, name })); }, [orders]);
  const uniqueCategories = useMemo(() => { const s = new Set<string>(); flattenedRecords.forEach(r => { if(r.categoryName !== 'غير محدد') s.add(r.categoryName); }); return Array.from(s).sort(); }, [flattenedRecords]);
  const uniqueItems = useMemo(() => { const s = new Set<string>(); flattenedRecords.forEach(r => { if(r.itemName !== '-') s.add(r.itemName); }); return Array.from(s).sort(); }, [flattenedRecords]);

  const selectedBranchName = useMemo(() => {
    if (branchFilter === 'الكل') return 'الكل';
    return uniqueBranches.find(b => b.id === branchFilter)?.name || 'محدد';
  }, [branchFilter, uniqueBranches]);

  const getTabTitleString = () => {
    if (activeTab === 'all_agencies') return 'جميع الوكالات';
    if (activeTab.startsWith('agency_')) return `وكالة ${agenciesMap[activeTab.replace('agency_', '')] || ''}`;
    if (activeTab === 'branch') return 'حسب الفرع';
    return 'حسب الصنف/الطلبية';
  };

  const handleExportPDF = async () => {
    const hasData = activeTab === 'item' ? itemGroupedCalculations.length > 0 : groupedCalculations.length > 0;
    if (!hasData) return alert("لا توجد بيانات لطباعتها ضمن هذا التبويب.");
    
    setIsExportingPDF(true);
    try {
      const titleStr = getTabTitleString();
      const isItemTab = activeTab === 'item';
      const getColStyle = (widthPercent: number) => { return pdfSettings.autoFit ? `padding: 6px 2px;` : `width: ${widthPercent}%; padding: 6px 2px;`; };

      let tableColumnsRowHTML = '';
      if (isItemTab) {
        tableColumnsRowHTML = `<tr>
            <th style="${getColStyle(pdfSettings.i_seq)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; word-break: break-word;">ت</th>
            <th style="${getColStyle(pdfSettings.i_name)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; word-break: break-word;">المكون (خام/تعبئة)</th>
            <th style="${getColStyle(pdfSettings.i_perUnit)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; word-break: break-word;">كمية القطعة</th>
            <th style="${getColStyle(pdfSettings.i_req)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; word-break: break-word;">العدد المطلوب</th>
            <th style="${getColStyle(pdfSettings.i_actual)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; word-break: break-word;">إجمالي السحب الفعلي</th>
            <th style="${getColStyle(pdfSettings.i_unit)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; word-break: break-word;">وحدة الحساب</th>
            <th style="${getColStyle(pdfSettings.i_net)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; word-break: break-word;">المجموع الصافي</th>
            <th style="${getColStyle(pdfSettings.i_meas)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; word-break: break-word;">القياس</th>
          </tr>`;
      } else {
        tableColumnsRowHTML = `<tr>
            <th style="${getColStyle(pdfSettings.o_seq)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">ت</th>
            <th style="${getColStyle(pdfSettings.o_name)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">المكون (مادة السحب)</th>
            <th style="${getColStyle(pdfSettings.o_related)} background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">الصنف المرتبط</th>
            <th style="${getColStyle(pdfSettings.o_agency)} background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">الوكالة</th>
            <th style="${getColStyle(pdfSettings.o_perUnit)} background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">كمية القطعة</th>
            <th style="${getColStyle(pdfSettings.o_count)} background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">العدد</th>
            <th style="${getColStyle(pdfSettings.o_pull)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">سحب الصنف</th>
            <th style="${getColStyle(pdfSettings.o_totalPull)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">السحب الكلي</th>
            <th style="${getColStyle(pdfSettings.o_unit)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">الوحدة</th>
            <th style="${getColStyle(pdfSettings.o_net)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">الصافي</th>
            <th style="${getColStyle(pdfSettings.o_meas)} background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; word-break: break-word;">القياس</th>
          </tr>`;
      }

      let tbodysHTML = '';
      let globalIndex = 1;

      if (isItemTab) {
        itemGroupedCalculations.forEach((item, index) => {
          const recipeLabel = item.hasStandardRecipe ? `<span style="font-size:9px; color:#10b981; margin-right:4px;">(SOP)</span>` : '';
          const pageBreakStyle = index > 0 ? 'page-break-before: always;' : '';
          
          let groupRows = `
            <tr>
              <td colspan="8" style="padding: 10px 12px; border: 1px solid #1e293b; background-color:#1e293b; color:white;">
                <div style="font-size: 14px; font-weight: 900;">${item.itemName} ${recipeLabel}</div>
                <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">الوكالة: ${item.agencyName} | إجمالي الطلب: ${Number(item.totalOrderQty).toLocaleString('en-US', {maximumFractionDigits:2})}</div>
              </td>
            </tr>
            ${tableColumnsRowHTML}
          `;

          if (item.ingredientsList.length === 0) {
            groupRows += `<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding: 15px; font-size: 12px; border: 1px solid #cbd5e1; background-color:#ffffff;">لا توجد مكونات مسجلة لهذا الصنف</td></tr>`;
          } else {
            item.ingredientsList.forEach((ing, i) => {
              const isPackaging = ing.type === 'packaging';
              const typeLabel = isPackaging ? '(تعبئة)' : '';
              const finalIngTotal = isPackaging ? Math.ceil(ing.totalContribution) : ing.totalContribution;
              const baseObj = getBaseUnitQty(finalIngTotal, ing.ingUnit);

              const cellBg = isPackaging ? '#f0f9ff' : '#ffffff';
              const isFirst = i === 0;
              const isLast = i === item.ingredientsList.length - 1;
              const mergedCellTopBorder = isFirst ? `1px solid #cbd5e1` : 'none';
              const mergedCellBottomBorder = isLast ? `1px solid #cbd5e1` : 'none';
              const mergedTextColor = isFirst ? '#1e293b' : 'transparent';
              
              groupRows += `<tr>`;
              groupRows += `<td style="${getColStyle(pdfSettings.i_seq)} border: 1px solid #cbd5e1; text-align:center; font-weight:bold; font-size: 11px; color:#94a3b8; background-color:${cellBg};">${globalIndex++}</td>`;
              groupRows += `<td style="${getColStyle(pdfSettings.i_name)} border: 1px solid #cbd5e1; font-weight:900; font-size: 12px; color:#1e293b; background-color:${cellBg}; word-break: break-word;">${ing.ingName} <small style="color:#0284c7;">${typeLabel}</small></td>`;
              groupRows += `<td style="${getColStyle(pdfSettings.i_perUnit)} border: 1px solid #cbd5e1; text-align:center; font-weight:bold; font-size: 11px; background-color:${cellBg};" dir="ltr">${Number(ing.perUnitQty).toLocaleString('en-US', {maximumFractionDigits:4})}</td>`;
              groupRows += `<td style="${getColStyle(pdfSettings.i_req)} border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top: ${mergedCellTopBorder}; border-bottom: ${mergedCellBottomBorder}; text-align:center; font-weight:900; font-size: 12px; vertical-align:top; background-color:#f8fafc; color:${mergedTextColor};">${Number(item.totalOrderQty).toLocaleString('en-US', {maximumFractionDigits:2})}</td>`;
              groupRows += `<td style="${getColStyle(pdfSettings.i_actual)} border: 1px solid #cbd5e1; text-align:center; color:#e11d48; font-weight:900; font-size: 12px; background-color:${cellBg};" dir="ltr">${Number(finalIngTotal).toLocaleString('en-US', {maximumFractionDigits:2})}</td>`;
              groupRows += `<td style="${getColStyle(pdfSettings.i_unit)} border: 1px solid #cbd5e1; text-align:center; color:#059669; font-weight:bold; font-size: 11px; background-color:${cellBg};">${ing.ingUnit || '-'}</td>`;
              
              if (baseObj) {
                groupRows += `<td style="${getColStyle(pdfSettings.i_net)} border: 1px solid #cbd5e1; text-align:center; color:#4338ca; font-weight:900; font-size: 12px; background-color:#eef2ff;" dir="ltr">${Number(baseObj.value).toLocaleString('en-US', {maximumFractionDigits:3})}</td>`;
                groupRows += `<td style="${getColStyle(pdfSettings.i_meas)} border: 1px solid #cbd5e1; text-align:center; color:#4338ca; font-weight:900; font-size: 11px; background-color:#eef2ff;">${baseObj.label}</td>`;
              } else {
                groupRows += `<td style="${getColStyle(pdfSettings.i_net)} border: 1px solid #cbd5e1; text-align:center; color:#94a3b8; background-color:${cellBg};">-</td>`;
                groupRows += `<td style="${getColStyle(pdfSettings.i_meas)} border: 1px solid #cbd5e1; text-align:center; color:#94a3b8; background-color:${cellBg};">-</td>`;
              }
              groupRows += `</tr>`;
            });
          }
          tbodysHTML += `<tbody style="${pageBreakStyle} page-break-inside: auto;">${groupRows}</tbody>`;
        });
        
      } else {
        groupedCalculations.forEach((group, index) => {
          const groupLabel = activeTab === 'branch' ? 'الفرع' : 'الوكالة';
          const orderedItemsStr = group.orderedItems.map(oi => `${oi.name} (${Number(oi.qty).toLocaleString('en-US', {maximumFractionDigits:2})})`).join(' | ');
          const pageBreakStyle = index > 0 ? 'page-break-before: always;' : '';
          
          let headerHTML = `
            <tr>
              <td colspan="11" style="padding: 12px; border: 1px solid #1e293b; background-color: #1e293b; color: white;">
                 <div style="font-size: 16px; font-weight: 900; margin-bottom: 4px;">${groupLabel}: ${group.groupName}</div>
                 <div style="font-size: 11px; color: #cbd5e1;">الأصناف المطلوبة: ${orderedItemsStr}</div>
                 <div style="font-size: 11px; color: #34d399; margin-top: 4px; font-weight: bold;">
                    إجمالي الأوزان: ${Number(group.totalFoodKilos).toLocaleString('en-US', {maximumFractionDigits:2})} كغم/لتر | إجمالي التعبئة: ${Number(group.totalPackaging).toLocaleString('en-US')} قطعة
                 </div>
              </td>
            </tr>
            ${tableColumnsRowHTML}
          `;
          tbodysHTML += `<tbody style="${pageBreakStyle} page-break-inside: auto;">${headerHTML}</tbody>`;
          
          group.ingredients.forEach((ing) => {
            const sources = ing.sourceItems; 
            const rowCount = sources.length;
            const isPackaging = ing.type === 'packaging';
            const typeLabel = isPackaging ? '(تعبئة)' : '';
            const finalIngTotal = isPackaging ? Math.ceil(ing.totalQuantity) : ing.totalQuantity;
            const baseObj = getBaseUnitQty(finalIngTotal, ing.unit);
            
            let ingredientRowsHTML = '';
            sources.forEach((data, sourceIdx) => {
              const cellBg = isPackaging ? '#f0f9ff' : '#ffffff';
              const isFirst = sourceIdx === 0;
              const isLast = sourceIdx === rowCount - 1;
              const borderTop = isFirst ? `1px solid #cbd5e1` : 'none';
              const borderBottom = isLast ? `1px solid #cbd5e1` : 'none';
              const textColorLeft = isFirst ? '#94a3b8' : 'transparent';
              const textColorName = isFirst ? '#1e293b' : 'transparent';
              const textColorRed = isFirst ? '#e11d48' : 'transparent';
              const textColorGreen = isFirst ? '#059669' : 'transparent';
              const textColorBlue = isFirst ? '#4338ca' : 'transparent';
              
              ingredientRowsHTML += `<tr style="page-break-inside: avoid;">`;
              ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_seq)} border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top:${borderTop}; border-bottom:${borderBottom}; text-align:center; font-weight:bold; font-size: 11px; vertical-align: top; color:${textColorLeft}; background-color:#ffffff; word-break: break-word;">${isFirst ? globalIndex++ : '-'}</td>`;
              ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_name)} border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top:${borderTop}; border-bottom:${borderBottom}; font-weight:900; font-size: 12px; vertical-align: top; color:${textColorName}; background-color:#ffffff; word-break: break-word;">${ing.name} <br><small style="color:${isFirst ? '#0284c7' : 'transparent'}; font-size: 9px;">${typeLabel}</small></td>`;
              ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_related)} border: 1px solid #cbd5e1; font-weight:bold; color:#334155; font-size: 11px; background-color:${cellBg}; word-break: break-word;">${data.itemName}</td>`;
              ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_agency)} border: 1px solid #cbd5e1; text-align:center; color:#6366f1; font-weight:bold; font-size: 11px; background-color:${cellBg}; word-break: break-word;">${data.agencyName}</td>`;
              ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_perUnit)} border: 1px solid #cbd5e1; text-align:center; font-weight:bold; font-size: 11px; background-color:${cellBg}; word-break: break-word;" dir="ltr">${Number(data.perUnitQty).toLocaleString('en-US', {maximumFractionDigits:4})}</td>`;
              ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_count)} border: 1px solid #cbd5e1; text-align:center; font-weight:900; font-size: 11px; background-color:${cellBg}; word-break: break-word;" dir="ltr">${Number(data.orderQty).toLocaleString('en-US', {maximumFractionDigits:2})}</td>`;
              
              const itemCont = isPackaging ? Math.ceil(data.contribution) : data.contribution;
              ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_pull)} border: 1px solid #cbd5e1; text-align:center; color:#e11d48; font-weight:bold; font-size: 11px; background-color:${cellBg}; word-break: break-word;" dir="ltr">${Number(itemCont).toLocaleString('en-US', {maximumFractionDigits:2})}</td>`;
              ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_totalPull)} border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top:${borderTop}; border-bottom:${borderBottom}; text-align:center; color:${textColorRed}; font-weight:900; font-size: 12px; background-color:#fff1f2; vertical-align: top; word-break: break-word;" dir="ltr">${Number(finalIngTotal).toLocaleString('en-US', {maximumFractionDigits:2})}</td>`;
              ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_unit)} border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top:${borderTop}; border-bottom:${borderBottom}; text-align:center; color:${textColorGreen}; font-weight:bold; font-size: 11px; vertical-align: top; background-color:#f8fafc; word-break: break-word;">${ing.unit || '-'}</td>`;
              
              if (baseObj) {
                ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_net)} border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top:${borderTop}; border-bottom:${borderBottom}; text-align:center; color:${textColorBlue}; font-weight:900; font-size: 12px; background-color:#eef2ff; vertical-align: top; word-break: break-word;" dir="ltr">${Number(baseObj.value).toLocaleString('en-US', {maximumFractionDigits:3})}</td>`;
                ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_meas)} border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top:${borderTop}; border-bottom:${borderBottom}; text-align:center; color:${textColorBlue}; font-weight:900; font-size: 11px; background-color:#eef2ff; vertical-align: top; word-break: break-word;">${baseObj.label}</td>`;
              } else {
                ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_net)} border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top:${borderTop}; border-bottom:${borderBottom}; text-align:center; color:${isFirst?'#94a3b8':'transparent'}; vertical-align: top; background-color:#f8fafc; word-break: break-word;">-</td>`;
                ingredientRowsHTML += `<td style="${getColStyle(pdfSettings.o_meas)} border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; border-top:${borderTop}; border-bottom:${borderBottom}; text-align:center; color:${isFirst?'#94a3b8':'transparent'}; vertical-align: top; background-color:#f8fafc; word-break: break-word;">-</td>`;
              }
              ingredientRowsHTML += `</tr>`;
            });
            tbodysHTML += `<tbody style="page-break-inside: auto;">${ingredientRowsHTML}</tbody>`;
          });
        });
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>خطة_السحب_${titleStr.replace(/[\s\/\\]/g, '_')}_${dayjs().format('YYYYMMDD')}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
            @page { size: ${pdfSettings.paperSize} landscape; margin: ${pdfSettings.margin}; }
            body { font-family: 'Cairo', system-ui, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; background: white; }
            .print-footer { display: flex !important; position: fixed !important; bottom: 0; left: 0; right: 0; background: white; padding-top: 8px; border-top: 2px solid #e2e8f0; z-index: 1000; justify-content: space-between; font-size: 12px; font-weight: 900; color: #64748b; }
            table { width: 100% !important; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'} !important; border-collapse: collapse; page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            th, td { word-break: break-word !important; overflow-wrap: break-word !important; white-space: normal !important; }
            .print-container { padding-bottom: 40px; zoom: ${pdfSettings.zoom / 100}; width: 100%; max-width: 100%; margin-right: ${pdfSettings.shiftX}mm; }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #f97316; padding-bottom: 15px; margin-bottom: 20px;">
              <div>
                <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 900;">خطة السحب والإنتاج المجمعة</h1>
                <p style="margin: 5px 0 0 0; color: #f97316; font-size: 14px; font-weight: bold;">النوع: ${titleStr}</p>
              </div>
              <div style="text-align: left;">
                <p style="margin: 0; color: #475569; font-size: 12px; font-weight: bold;">نظام الإدارة المركزي</p>
                <p style="margin: 3px 0 0 0; color: #94a3b8; font-size: 11px;">تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>
            <div style="background: #fff7ed; padding: 12px 15px; border-radius: 8px; border: 1px solid #fed7aa; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 15px; font-size: 12px; font-weight: bold; color: #9a3412;">
              <div style="background: white; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 6px;"><span style="color: #ea580c;">الشهر/النطاق:</span> <span dir="ltr">${startDate || 'الكل'} إلى ${endDate || 'الكل'}</span></div>
              <div style="background: white; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 6px;"><span style="color: #ea580c;">المحافظة:</span> ${governorateFilter}</div>
              <div style="background: white; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 6px;"><span style="color: #ea580c;">الفرع:</span> ${selectedBranchName}</div>
              <div style="background: white; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 6px;"><span style="color: #ea580c;">القسم:</span> ${categoryFilter}</div>
              <div style="background: white; border: 1px solid #fed7aa; padding: 4px 10px; border-radius: 6px;"><span style="color: #ea580c;">الصنف:</span> ${itemFilter}</div>
            </div>
            <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
              ${tbodysHTML}
            </table>
          </div>
          <div class="print-footer">
            <div>طُبع بواسطة: <span style="color: #0f172a; margin-right: 5px;">نظام إدارة المطبخ</span></div>
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
        iframeDoc.open(); iframeDoc.write(htmlContent); iframeDoc.close();
        setTimeout(() => {
          setIsExportingPDF(false);
          if (iframe.contentWindow) { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
          setTimeout(() => { document.body.removeChild(iframe); }, 1500);
        }, 1000);
      }
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("حدث خطأ أثناء تحضير الطباعة.");
      setIsExportingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    const hasData = activeTab === 'item' ? itemGroupedCalculations.length > 0 : groupedCalculations.length > 0;
    if (!hasData) return alert("لا توجد بيانات لتصديرها ضمن هذا التبويب.");

    setIsExportingExcel(true);
    
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Enterprise B2B System';
      const worksheet = workbook.addWorksheet('خطة السحب والإنتاج', { views: [{ rightToLeft: true }] });
      const titleStr = getTabTitleString();

      worksheet.mergeCells('A1:K1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `خطة السحب والإنتاج המجمعة - ${titleStr}`;
      titleCell.font = { name: 'Cairo', size: 16, bold: true, color: { argb: 'FFF97316' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;

      worksheet.mergeCells('A2:K2');
      const dateCell = worksheet.getCell('A2');
      dateCell.value = `تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')} | النطاق: ${startDate || 'الكل'} إلى ${endDate || 'الكل'}`;
      dateCell.font = { name: 'Cairo', size: 11, color: { argb: 'FF64748B' } };
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 25;
      
      worksheet.addRow([]); 

      if (activeTab === 'item') {
        const headers = ['ت', 'المكون (خام/تعبئة)', 'كمية القطعة الواحدة', 'العدد المطلوب', 'إجمالي السحب الفعلي', 'وحدة الحساب', 'المجموع الكلي الصافي', 'وحدة القياس'];
        const headerRow = worksheet.addRow(headers);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; 
          cell.font = { name: 'Cairo', color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        worksheet.columns.forEach((col, i) => {
          if (i === 0) col.width = 6;
          else if (i === 1) col.width = 35;
          else if (i === 2) col.width = 20;
          else if (i === 3) col.width = 18;
          else if (i === 4) col.width = 22;
          else if (i === 5) col.width = 15;
          else if (i === 6) col.width = 22;
          else if (i === 7) col.width = 15;
        });

        let globalIndex = 1;
        itemGroupedCalculations.forEach((item) => {
          const groupHeaderRow = worksheet.addRow([`${item.itemName} | الوكالة: ${item.agencyName} | إجمالي الطلب: ${item.totalOrderQty}`]);
          worksheet.mergeCells(`A${groupHeaderRow.number}:H${groupHeaderRow.number}`);
          const groupHeaderCell = worksheet.getCell(`A${groupHeaderRow.number}`);
          groupHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
          groupHeaderCell.font = { name: 'Cairo', color: { argb: 'FFFFFFFF' }, bold: true, size: 14 };
          groupHeaderCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
          groupHeaderRow.height = 35;

          if (item.ingredientsList.length === 0) {
             const emptyRow = worksheet.addRow(['لا توجد مكونات']);
             worksheet.mergeCells(`A${emptyRow.number}:H${emptyRow.number}`);
             emptyRow.getCell(1).alignment = { horizontal: 'center' };
             emptyRow.getCell(1).font = { color: { argb: 'FF94A3B8' } };
          } else {
             const startMergeRow = worksheet.lastRow ? worksheet.lastRow.number + 1 : 1;
             
             item.ingredientsList.forEach((ing, i) => {
               const isPackaging = ing.type === 'packaging';
               const typeText = isPackaging ? '(تعبئة)' : '';
               const finalIngTotal = isPackaging ? Math.ceil(ing.totalContribution) : ing.totalContribution;
               const baseObj = getBaseUnitQty(finalIngTotal, ing.ingUnit);

               const rowData = [
                 globalIndex++,
                 `${ing.ingName} ${typeText}`,
                 Number(ing.perUnitQty),
                 i === 0 ? Number(item.totalOrderQty) : '',
                 Number(finalIngTotal),
                 ing.ingUnit || '-',
                 baseObj ? Number(baseObj.value) : '-',
                 baseObj ? baseObj.label : '-'
               ];

               const dataRow = worksheet.addRow(rowData);
               const rowBg = isPackaging ? 'FFF0F9FF' : 'FFFFFFFF'; 
               
               dataRow.eachCell((cell, colNum) => {
                 cell.alignment = { horizontal: 'center', vertical: 'middle' };
                 cell.border = { top: { style: 'thin', color: {argb: 'FFCBD5E1'} }, left: { style: 'thin', color: {argb: 'FFCBD5E1'} }, bottom: { style: 'thin', color: {argb: 'FFCBD5E1'} }, right: { style: 'thin', color: {argb: 'FFCBD5E1'} } };
                 cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                 cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
                 
                 if (colNum === 5) cell.font = { color: { argb: 'FFE11D48' }, bold: true }; 
                 if (colNum === 7) cell.font = { color: { argb: 'FF4338CA' }, bold: true }; 
                 if (colNum === 6 || colNum === 8) cell.font = { color: { argb: 'FF059669' } }; 
               });
             });

             if (item.ingredientsList.length > 1) {
               worksheet.mergeCells(`D${startMergeRow}:D${startMergeRow + item.ingredientsList.length - 1}`);
               worksheet.getCell(`D${startMergeRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
               worksheet.getCell(`D${startMergeRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
             }
          }
        });

      } else {
        const headers = ['ت', 'المكون (المادة المراد سحبها)', 'الصنف المرتبط بالطلب', 'الوكالة', 'كمية القطعة', 'العدد', 'سحب الصنف', 'السحب الكلي للمادة', 'وحدة الحساب', 'المجموع الكلي الصافي', 'وحدة القياس'];
        const headerRow = worksheet.addRow(headers);
        headerRow.height = 30;
        headerRow.eachCell((cell, colNum) => {
          const headerBg = [1, 2, 8, 9, 10, 11].includes(colNum) ? 'FF0F172A' : 'FF334155';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } }; 
          cell.font = { name: 'Cairo', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        worksheet.columns.forEach((col, i) => {
          if (i === 0) col.width = 6; else if (i === 1) col.width = 25; else if (i === 2) col.width = 22;
          else if (i === 3) col.width = 15; else if (i === 4) col.width = 12; else if (i === 5) col.width = 12;
          else if (i === 6) col.width = 12; else if (i === 7) col.width = 15; else if (i === 8) col.width = 12;
          else if (i === 9) col.width = 15; else if (i === 10) col.width = 12;
        });

        let globalIndex = 1;
        groupedCalculations.forEach((group, index) => {
          if (index > 0) worksheet.addRow([]); 

          const groupLabel = activeTab === 'branch' ? 'الفرع' : 'الوكالة';
          const orderedItemsStr = group.orderedItems.map(oi => `${oi.name} (${Number(oi.qty)})`).join(' | ');
          
          const groupHeaderRow = worksheet.addRow([`${groupLabel}: ${group.groupName} | إجمالي الأوزان: ${Number(group.totalFoodKilos).toFixed(2)} كغم/لتر | إجمالي التعبئة: ${Number(group.totalPackaging)} قطعة`]);
          worksheet.mergeCells(`A${groupHeaderRow.number}:K${groupHeaderRow.number}`);
          const groupHeaderCell = worksheet.getCell(`A${groupHeaderRow.number}`);
          groupHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
          groupHeaderCell.font = { name: 'Cairo', color: { argb: 'FFFFFFFF' }, bold: true, size: 14 };
          groupHeaderCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
          groupHeaderRow.height = 35;

          group.ingredients.forEach((ing) => {
            const sources = ing.sourceItems;
            const isPackaging = ing.type === 'packaging';
            const typeLabel = isPackaging ? '(تعبئة)' : '';
            const finalIngTotal = isPackaging ? Math.ceil(ing.totalQuantity) : ing.totalQuantity;
            const baseObj = getBaseUnitQty(finalIngTotal, ing.unit);

            const startMergeRow = worksheet.lastRow ? worksheet.lastRow.number + 1 : 1;

            sources.forEach((data, sourceIdx) => {
              const itemCont = isPackaging ? Math.ceil(data.contribution) : data.contribution;
              
              const rowData = [
                sourceIdx === 0 ? globalIndex++ : '',
                sourceIdx === 0 ? `${ing.name} ${typeLabel}` : '',
                data.itemName,
                data.agencyName,
                Number(data.perUnitQty),
                Number(data.orderQty),
                Number(itemCont),
                sourceIdx === 0 ? Number(finalIngTotal) : '',
                sourceIdx === 0 ? (ing.unit || '-') : '',
                sourceIdx === 0 ? (baseObj ? Number(baseObj.value) : '-') : '',
                sourceIdx === 0 ? (baseObj ? baseObj.label : '-') : ''
              ];

              const dataRow = worksheet.addRow(rowData);
              
              dataRow.eachCell((cell, colNum) => {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin', color: {argb: 'FFCBD5E1'} }, left: { style: 'thin', color: {argb: 'FFCBD5E1'} }, bottom: { style: 'thin', color: {argb: 'FFCBD5E1'} }, right: { style: 'thin', color: {argb: 'FFCBD5E1'} } };
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
                
                if (colNum === 7) cell.font = { color: { argb: 'FFE11D48' }, bold: true }; 
                if (colNum === 8) { cell.font = { color: { argb: 'FFE11D48' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }; }
                if (colNum === 10) { cell.font = { color: { argb: 'FF4338CA' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }; }
                if (colNum === 11 || colNum === 9) cell.font = { color: { argb: 'FF059669' }, bold: true };
              });
            });

            if (sources.length > 1) {
              const colsToMerge = ['A', 'B', 'H', 'I', 'J', 'K'];
              colsToMerge.forEach(col => {
                worksheet.mergeCells(`${col}${startMergeRow}:${col}${startMergeRow + sources.length - 1}`);
                worksheet.getCell(`${col}${startMergeRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
              });
            }
          });
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const safeTitle = titleStr.replace(/\s+/g, '_').replace(/[/\\?%*:|"<>]/g, '-');
      saveAs(blob, `خطة_السحب_${safeTitle}_${dayjs().format('YYYYMMDD')}.xlsx`);

    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء تصدير ملف Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const isItemTab = activeTab === 'item';
  const totalCalculatedWidth = isItemTab 
    ? (pdfSettings.i_seq + pdfSettings.i_name + pdfSettings.i_perUnit + pdfSettings.i_req + pdfSettings.i_actual + pdfSettings.i_unit + pdfSettings.i_net + pdfSettings.i_meas)
    : (pdfSettings.o_seq + pdfSettings.o_name + pdfSettings.o_related + pdfSettings.o_agency + pdfSettings.o_perUnit + pdfSettings.o_count + pdfSettings.o_pull + pdfSettings.o_totalPull + pdfSettings.o_unit + pdfSettings.o_net + pdfSettings.o_meas);

  if (!isMounted) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-colors duration-300 ease-in-out ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-40'}`} dir="rtl">
        
        {/* 🟢 الإشعاع الخلفي 🟢 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100/50 dark:from-orange-900/20 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-colors duration-300`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🌟 الهيدر 🌟 */}
          <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 w-full bg-white/80 dark:bg-white/5 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-300 origin-top no-print ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-5 text-right w-full md:w-auto">
              
              <Link href="/hub" className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-300 dark:bg-white/10 hidden md:block"></div>

              <div className="bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-500 dark:to-amber-600 p-4 rounded-[1.5rem] text-orange-600 dark:text-white shadow-sm dark:shadow-[0_0_30px_rgba(249,115,22,0.3)] shrink-0 border border-orange-200 dark:border-orange-500/20">
                <Calculator className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white mb-1 tracking-tight truncate">خطة الإنتاج وحساب السحوبات</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 truncate">مربوطة آلياً بالوصفات المعيارية (SOP) لحساب المواد الخام والتعبئة بدقة.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto flex-wrap md:flex-nowrap">
              <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-white dark:bg-[#121214] p-2 rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                
                <button 
                  onClick={() => setShowPdfSettings(!showPdfSettings)} 
                  title="إعدادات الطباعة للـ PDF"
                  className={`p-3.5 rounded-xl flex items-center justify-center transition-all outline-none border cursor-pointer active:scale-95 focus:ring-2 focus:ring-slate-500/50 ${showPdfSettings ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-50 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20'}`}
                >
                  <Settings className={`w-5 h-5 transition-transform duration-300 ${showPdfSettings ? 'rotate-90' : ''}`} />
                </button>

                <button onClick={handleExportPDF} disabled={isExportingPDF} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-rose-500/50 border ${isExportingPDF ? 'bg-slate-50 dark:bg-[#0a0a0c] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/5 cursor-not-allowed' : 'bg-rose-50 dark:bg-rose-600 text-rose-600 dark:text-white border-rose-200 dark:border-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500 hover:border-rose-300 dark:hover:border-rose-400 shadow-sm dark:shadow-[0_0_15px_rgba(225,29,72,0.4)]'}`}>
                  {isExportingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
                  {isExportingPDF ? 'جاري التصدير...' : 'طباعة تقرير (PDF)'}
                </button>

                <button onClick={handleExportExcel} disabled={isExportingExcel} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-emerald-500/50 border ${isExportingExcel ? 'bg-slate-50 dark:bg-[#0a0a0c] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/5 cursor-not-allowed' : 'bg-emerald-50 dark:bg-emerald-600 text-emerald-600 dark:text-white border-emerald-200 dark:border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500 hover:border-emerald-300 dark:hover:border-emerald-400 shadow-sm dark:shadow-[0_0_15px_rgba(5,150,105,0.4)]'}`}>
                  {isExportingExcel ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />} 
                  {isExportingExcel ? 'جاري التصدير...' : 'تصدير Excel'}
                </button>

                <button onClick={() => setIsZenMode(true)} title="وضع التركيز" className="p-3.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-[1.5rem] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner outline-none hidden md:block group cursor-pointer active:scale-95">
                  <Eye className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          {/* لوحة تحكم الطباعة */}
          {showPdfSettings && (
            <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative mb-4">
              
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                <span className="text-sm font-black text-orange-600 dark:text-orange-400 flex items-center gap-2"><Settings className="w-4 h-4"/> إعدادات الطباعة المتقدمة (تُحفظ تلقائياً)</span>
                <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-colors bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-slate-500/50">
                  <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">حجم الورق</label>
                  <div className="relative">
                    <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-orange-400 dark:focus:border-orange-500/50 appearance-none cursor-pointer">
                      <option value="A3" className="bg-white dark:bg-[#121214]">A3 (أفضل للأعمدة الكثيرة)</option>
                      <option value="A4" className="bg-white dark:bg-[#121214]">A4 (ورق قياسي)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-[14px] pointer-events-none" />
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">هوامش الورقة</label>
                  <div className="relative">
                    <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-orange-400 dark:focus:border-orange-500/50 appearance-none cursor-pointer">
                      <option value="0mm" className="bg-white dark:bg-[#121214]">بدون هوامش (0mm)</option>
                      <option value="2mm" className="bg-white dark:bg-[#121214]">ضيقة جداً (2mm)</option>
                      <option value="5mm" className="bg-white dark:bg-[#121214]">ضيقة (5mm)</option>
                      <option value="10mm" className="bg-white dark:bg-[#121214]">عادية (10mm)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-4 top-[14px] pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col justify-end gap-2">
                  <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-orange-500/50 ${pdfSettings.autoFit ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-500/30' : 'bg-slate-50 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20'}`}>
                    <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                  </button>
                </div>

                <div className="flex flex-col gap-2 w-full lg:col-span-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                    <span className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-500/20" dir="ltr">{pdfSettings.shiftX} mm</span>
                  </div>
                  <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-orange-600 dark:accent-orange-400 h-2 bg-slate-100 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-lg appearance-none cursor-pointer mt-1" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <hr className="flex-1 border-slate-100 dark:border-white/5" />
                <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest bg-orange-50 dark:bg-orange-500/10 px-3 py-1 rounded-full border border-orange-200 dark:border-orange-500/20">
                  إعدادات الأعمدة (للجدول النشط حالياً - {isItemTab ? 'حسب الصنف' : 'حسب الوكالة/الفرع'})
                </span>
                <hr className="flex-1 border-slate-100 dark:border-white/5" />
              </div>

              <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-4 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                
                <div className="flex flex-col gap-2 w-full col-span-2 md:col-span-4 lg:col-span-5 mb-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                    <span className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-500/20">{pdfSettings.zoom}%</span>
                  </div>
                  <input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-orange-600 dark:accent-orange-400 h-2 bg-slate-100 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-lg appearance-none cursor-pointer" />
                </div>

                {isItemTab ? (
                  <>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">التسلسل</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.i_seq}%</span></div><input type="range" min="1" max="15" value={pdfSettings.i_seq} onChange={e => updatePdfSetting('i_seq', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">المكون (خام/تعبئة)</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.i_name}%</span></div><input type="range" min="10" max="50" value={pdfSettings.i_name} onChange={e => updatePdfSetting('i_name', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">كمية القطعة</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.i_perUnit}%</span></div><input type="range" min="5" max="25" value={pdfSettings.i_perUnit} onChange={e => updatePdfSetting('i_perUnit', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">العدد المطلوب</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.i_req}%</span></div><input type="range" min="5" max="25" value={pdfSettings.i_req} onChange={e => updatePdfSetting('i_req', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">إجمالي السحب</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.i_actual}%</span></div><input type="range" min="5" max="30" value={pdfSettings.i_actual} onChange={e => updatePdfSetting('i_actual', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الوحدة</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.i_unit}%</span></div><input type="range" min="3" max="20" value={pdfSettings.i_unit} onChange={e => updatePdfSetting('i_unit', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الصافي</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.i_net}%</span></div><input type="range" min="5" max="30" value={pdfSettings.i_net} onChange={e => updatePdfSetting('i_net', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">القياس</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.i_meas}%</span></div><input type="range" min="3" max="20" value={pdfSettings.i_meas} onChange={e => updatePdfSetting('i_meas', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">التسلسل</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_seq}%</span></div><input type="range" min="1" max="10" value={pdfSettings.o_seq} onChange={e => updatePdfSetting('o_seq', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">المكون (مادة السحب)</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_name}%</span></div><input type="range" min="5" max="30" value={pdfSettings.o_name} onChange={e => updatePdfSetting('o_name', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الصنف المرتبط</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_related}%</span></div><input type="range" min="5" max="30" value={pdfSettings.o_related} onChange={e => updatePdfSetting('o_related', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الوكالة</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_agency}%</span></div><input type="range" min="3" max="20" value={pdfSettings.o_agency} onChange={e => updatePdfSetting('o_agency', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">كمية القطعة</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_perUnit}%</span></div><input type="range" min="3" max="20" value={pdfSettings.o_perUnit} onChange={e => updatePdfSetting('o_perUnit', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">العدد</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_count}%</span></div><input type="range" min="3" max="20" value={pdfSettings.o_count} onChange={e => updatePdfSetting('o_count', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">سحب الصنف</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_pull}%</span></div><input type="range" min="3" max="20" value={pdfSettings.o_pull} onChange={e => updatePdfSetting('o_pull', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">السحب الكلي</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_totalPull}%</span></div><input type="range" min="3" max="20" value={pdfSettings.o_totalPull} onChange={e => updatePdfSetting('o_totalPull', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الوحدة</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_unit}%</span></div><input type="range" min="3" max="15" value={pdfSettings.o_unit} onChange={e => updatePdfSetting('o_unit', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الصافي</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_net}%</span></div><input type="range" min="3" max="20" value={pdfSettings.o_net} onChange={e => updatePdfSetting('o_net', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">القياس</label><span className="text-slate-400 text-[9px] font-black">{pdfSettings.o_meas}%</span></div><input type="range" min="2" max="15" value={pdfSettings.o_meas} onChange={e => updatePdfSetting('o_meas', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                  </>
                )}
              </div>

              {!pdfSettings.autoFit && (
                <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                  <span>مجموع النسب للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-600 dark:text-emerald-500'}`}>{totalCalculatedWidth}%</span></span>
                  {totalCalculatedWidth > 100 ? (
                    <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيقوم بضغط الجدول إجبارياً)</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول منسق 100%)</span>
                  )}
                </div>
              )}
              {pdfSettings.autoFit && (
                <div className="p-3 rounded-xl border bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 text-[11px] font-black text-center">
                  الاحتواء التلقائي مفعل (المتصفح سيوزع الأعمدة بحسب طول الكلمات ويتجاهل النسب اليدوية).
                </div>
              )}
            </div>
          )}
        </div>

        {/* أزرار التجميع (Tabs) ملونة */}
        <div className="bg-white dark:bg-[#0a0a0c] p-1.5 rounded-[1.5rem] flex items-center w-full relative z-20 overflow-x-auto custom-scrollbar gap-1.5 border border-slate-200 dark:border-white/5 mb-6 shadow-sm dark:shadow-none">
          <button 
            onClick={() => setActiveTab('all_agencies')}
            className={`shrink-0 px-5 py-3 text-[14px] font-black rounded-[1.2rem] transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 border ${
              activeTab === 'all_agencies' ? 'bg-orange-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(234,88,12,0.5)] border-orange-500 dark:border-orange-400 ring-1 ring-orange-200 dark:ring-orange-500/50 scale-[1.02]' : 'bg-orange-50 dark:bg-orange-500/5 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/15 hover:text-orange-700 dark:hover:text-orange-300 border-orange-200 dark:border-orange-500/10 shadow-sm dark:shadow-inner'
            }`}
          >
            <Building2 className="w-5 h-5" /> جميع الوكالات
          </button>

          {agenciesList.map((ag: {id: string, name: string}, idx: number) => {
            const palettes = [
              { active: 'bg-blue-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(37,99,235,0.5)] border-blue-500 dark:border-blue-400 ring-1 ring-blue-200 dark:ring-blue-500/50 scale-[1.02]', inactive: 'bg-blue-50 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/15 hover:text-blue-700 dark:hover:text-blue-300 border-blue-200 dark:border-blue-500/10 shadow-sm dark:shadow-inner' },
              { active: 'bg-rose-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(225,29,72,0.5)] border-rose-500 dark:border-rose-400 ring-1 ring-rose-200 dark:ring-rose-500/50 scale-[1.02]', inactive: 'bg-rose-50 dark:bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-rose-300 border-rose-200 dark:border-rose-500/10 shadow-sm dark:shadow-inner' },
              { active: 'bg-cyan-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(6,182,212,0.5)] border-cyan-500 dark:border-cyan-400 ring-1 ring-cyan-200 dark:ring-cyan-500/50 scale-[1.02]', inactive: 'bg-cyan-50 dark:bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-500/15 hover:text-cyan-700 dark:hover:text-cyan-300 border-cyan-200 dark:border-cyan-500/10 shadow-sm dark:shadow-inner' },
              { active: 'bg-amber-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(245,158,11,0.5)] border-amber-500 dark:border-amber-400 ring-1 ring-amber-200 dark:ring-amber-500/50 scale-[1.02]', inactive: 'bg-amber-50 dark:bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 border-amber-200 dark:border-amber-500/10 shadow-sm dark:shadow-inner' },
              { active: 'bg-fuchsia-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(192,38,211,0.5)] border-fuchsia-500 dark:border-fuchsia-400 ring-1 ring-fuchsia-200 dark:ring-fuchsia-500/50 scale-[1.02]', inactive: 'bg-fuchsia-50 dark:bg-fuchsia-500/5 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-500/15 hover:text-fuchsia-700 dark:hover:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-500/10 shadow-sm dark:shadow-inner' },
            ];
            const p = palettes[idx % palettes.length];
            
            return (
              <button 
                key={ag.id}
                onClick={() => setActiveTab(`agency_${ag.id}`)}
                className={`shrink-0 px-5 py-3 text-[14px] font-black rounded-[1.2rem] transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 border ${
                  activeTab === `agency_${ag.id}` ? p.active : p.inactive
                }`}
              >
                <Building2 className="w-5 h-5" /> {ag.name}
              </button>
            )
          })}

          <div className="w-[2px] h-8 bg-slate-200 dark:bg-white/10 mx-1 shrink-0 rounded-full"></div>

          <button 
            onClick={() => setActiveTab('branch')}
            className={`shrink-0 px-5 py-3 text-[14px] font-black rounded-[1.2rem] transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 border ${
              activeTab === 'branch' ? 'bg-emerald-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(5,150,105,0.5)] border-emerald-500 dark:border-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/50 scale-[1.02]' : 'bg-emerald-50 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300 border-emerald-200 dark:border-emerald-500/10 shadow-sm dark:shadow-inner'
            }`}
          >
            <Store className="w-5 h-5" /> تجميع حسب الفرع
          </button>
          <button 
            onClick={() => setActiveTab('item')}
            className={`shrink-0 px-5 py-3 text-[14px] font-black rounded-[1.2rem] transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 border ${
              activeTab === 'item' ? 'bg-purple-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(147,51,234,0.5)] border-purple-500 dark:border-purple-400 ring-1 ring-purple-200 dark:ring-purple-500/50 scale-[1.02]' : 'bg-purple-50 dark:bg-purple-500/5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/15 hover:text-purple-700 dark:hover:text-purple-300 border-purple-200 dark:border-purple-500/10 shadow-sm dark:shadow-inner'
            }`}
          >
            <UtensilsCrossed className="w-5 h-5" /> تجميع حسب الطلبية
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full items-center mb-8 relative z-10">
          <div className="col-span-1 md:col-span-2 xl:col-span-2 flex flex-col sm:flex-row gap-3">
            <div onClick={() => openDatePicker('start')} className="relative flex-1 h-[3.5rem] bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-white/5 flex items-center px-4 hover:border-orange-300 dark:hover:border-orange-500/30 transition-all cursor-pointer group shadow-sm dark:shadow-inner active:scale-95 focus-within:ring-2 focus-within:ring-orange-500/50">
              <Calendar className="w-5 h-5 text-orange-500 ml-3 shrink-0" />
              <div className="flex flex-col z-10 pointer-events-none">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase">من تاريخ</span>
                <span className={`font-black text-sm dir-ltr text-right ${startDate ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                  {startDate ? dayjs(startDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                </span>
              </div>
            </div>

            <div onClick={() => openDatePicker('end')} className="relative flex-1 h-[3.5rem] bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-white/5 flex items-center px-4 hover:border-orange-300 dark:hover:border-orange-500/30 transition-all cursor-pointer group shadow-sm dark:shadow-inner active:scale-95 focus-within:ring-2 focus-within:ring-orange-500/50">
              <Calendar className="w-5 h-5 text-orange-500 ml-3 shrink-0" />
              <div className="flex flex-col z-10 pointer-events-none">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase">إلى تاريخ</span>
                <span className={`font-black text-sm dir-ltr text-right ${endDate ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                  {endDate ? dayjs(endDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                 </span>
              </div>
            </div>
          </div>

          <div className="relative bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-white/5 h-[3.5rem] flex items-center hover:border-orange-300 dark:hover:border-white/20 transition-colors shadow-sm dark:shadow-inner focus-within:ring-2 focus-within:ring-orange-500/50">
            <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none"><MapPin className="w-5 h-5" /></div>
            <select value={governorateFilter} onChange={(e) => setGovernorateFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-black text-slate-800 dark:text-slate-300 text-sm appearance-none cursor-pointer">
              <option value="الكل" className="bg-white dark:bg-[#121214]">المحافظات (الكل)</option>{uniqueGovernorates.map(gov => (<option key={gov} value={gov} className="bg-white dark:bg-[#121214]">{gov}</option>))}
            </select>
            <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          </div>

          <div className="relative bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-white/5 h-[3.5rem] flex items-center hover:border-orange-300 dark:hover:border-white/20 transition-colors shadow-sm dark:shadow-inner focus-within:ring-2 focus-within:ring-orange-500/50">
            <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none"><Store className="w-5 h-5" /></div>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-black text-slate-800 dark:text-slate-300 text-sm appearance-none cursor-pointer">
              <option value="الكل" className="bg-white dark:bg-[#121214]">الفروع (الكل)</option>{uniqueBranches.map(branch => (<option key={branch.id} value={branch.id} className="bg-white dark:bg-[#121214]">{branch.name}</option>))}
            </select>
            <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          </div>

          <div className="relative bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-white/5 h-[3.5rem] flex items-center hover:border-orange-300 dark:hover:border-white/20 transition-colors xl:col-span-2 shadow-sm dark:shadow-inner focus-within:ring-2 focus-within:ring-orange-500/50">
            <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none"><Layers className="w-5 h-5" /></div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-black text-slate-800 dark:text-slate-300 text-sm appearance-none cursor-pointer">
              <option value="الكل" className="bg-white dark:bg-[#121214]">الأقسام (الكل)</option>{uniqueCategories.map(cat => (<option key={cat} value={cat} className="bg-white dark:bg-[#121214]">{cat}</option>))}
            </select>
            <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          </div>

          <div className="relative bg-white dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-white/5 h-[3.5rem] flex items-center hover:border-orange-300 dark:hover:border-white/20 transition-colors xl:col-span-2 shadow-sm dark:shadow-inner focus-within:ring-2 focus-within:ring-orange-500/50">
            <div className="absolute right-4 text-slate-400 dark:text-slate-500 pointer-events-none"><Package className="w-5 h-5" /></div>
            <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-black text-slate-800 dark:text-slate-300 text-sm appearance-none cursor-pointer">
              <option value="الكل" className="bg-white dark:bg-[#121214]">الأصناف المصروفة (الكل)</option>{uniqueItems.map(item => (<option key={item} value={item} className="bg-white dark:bg-[#121214]">{item}</option>))}
            </select>
            <ChevronDown className="absolute left-4 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          </div>

          {(activeDateRange !== 'month' || governorateFilter !== 'الكل' || branchFilter !== 'الكل' || categoryFilter !== 'الكل' || itemFilter !== 'الكل' || selectedMonth.format('YYYY-MM') !== currentMonthStr) && (
            <button onClick={clearFilters} className="h-[3.5rem] flex items-center justify-center gap-2 bg-rose-600 rounded-xl text-white font-black text-sm hover:bg-rose-500 transition-all xl:col-span-4 shadow-md dark:shadow-[0_0_15px_rgba(225,29,72,0.4)] outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-rose-500/50 border border-rose-500">
              <RotateCcw className="w-5 h-5" /> استعادة فلاتر الشهر الحالي
            </button>
          )}
        </div>

        {dbError && (
          <div className="bg-white dark:bg-[#0a0a0c] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-sm w-full relative z-10">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500" /><p>{dbError}</p>
          </div>
        )}

        {!dbError && isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 w-full relative z-10">
            <Loader2 className="w-12 h-12 text-orange-600 dark:text-orange-500 animate-spin" />
            <p className="text-slate-500 font-black uppercase tracking-widest text-sm">جاري تحليل وربط الطلبيات بالوصفات المعيارية...</p>
          </div>
        ) : !dbError && (
          <div className="bg-white dark:bg-[#0a0a0c] p-4 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/5 w-full min-h-[400px] relative z-10">
            
            <div className="flex items-center justify-between mb-8 pb-5 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-2.5 rounded-xl text-slate-500 dark:text-slate-400 shadow-sm">
                  <SplitSquareHorizontal className="w-6 h-6" />
                </div>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
                  قائمة سحب المكونات <span className="text-orange-600 dark:text-orange-400 text-lg">({getTabTitleString()})</span>
                </h3>
              </div>
            </div>

            {activeTab === 'item' ? (
              itemGroupedCalculations.length === 0 ? (
                <div className="py-24 text-center text-slate-500 bg-slate-50 dark:bg-[#121214] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                  <UtensilsCrossed className="w-20 h-20 mx-auto mb-5 opacity-30 text-orange-600 dark:text-orange-500" />
                  <p className="text-2xl font-black text-slate-800 dark:text-white mb-2">لا توجد مواد مسجلة</p>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {itemGroupedCalculations.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-[#121214] rounded-[2rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-[0_5px_20px_rgba(0,0,0,0.3)]">
                      <div className="bg-slate-50 dark:bg-[#0a0a0c] text-slate-900 dark:text-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 relative overflow-hidden border-b border-slate-100 dark:border-white/5">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
                        <div className="flex items-center gap-3 relative z-10">
                          <UtensilsCrossed className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                          <div>
                            <h4 className="font-black text-xl leading-none mb-1.5 flex items-center gap-2">
                              {item.itemName}
                              {item.hasStandardRecipe && (
                                <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm dark:shadow-inner">
                                  <Receipt className="w-3 h-3"/> حسب الـ SOP
                                </span>
                              )}
                            </h4>
                            <span className="text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 px-2 py-0.5 rounded mt-1 inline-block shadow-sm dark:shadow-inner">
                              الوكالة التابع لها: {item.agencyName}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 bg-white dark:bg-[#121214] px-5 py-3 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner relative z-10">
                          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">العدد (إجمالي الطلب):</span>
                          <span className="text-3xl font-black text-orange-600 dark:text-orange-400 en-num dir-ltr drop-shadow-sm dark:drop-shadow-md">{Number(item.totalOrderQty).toLocaleString('en-US', {maximumFractionDigits:2})}</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full table-fixed text-right border-collapse">
                          <thead className="bg-slate-100 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 font-black text-xs border-b border-slate-200 dark:border-white/10 uppercase tracking-widest">
                            <tr>
                              <th className="py-4 px-2 text-center border-l border-slate-200 dark:border-white/10 w-[5%]">ت</th>
                              <th className="py-4 px-3 text-right border-l border-slate-200 dark:border-white/10 w-[25%]">المكون (خام/تعبئة)</th>
                              <th className="py-4 px-2 text-center border-l border-slate-200 dark:border-white/10 w-[12%]">كمية القطعة</th>
                              <th className="py-4 px-2 text-center border-l border-slate-200 dark:border-white/10 w-[12%] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">العدد المطلوب</th>
                              <th className="py-4 px-2 text-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-l border-slate-200 dark:border-white/10 w-[14%]">السحب الفعلي</th>
                              <th className="py-4 px-2 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-l border-slate-200 dark:border-white/10 w-[8%]">الوحدة</th>
                              <th className="py-4 px-2 text-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-l border-slate-200 dark:border-white/10 w-[16%]">الصافي</th>
                              <th className="py-4 px-2 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 w-[8%]">القياس</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {item.ingredientsList.length === 0 ? (
                              <tr><td colSpan={8} className="py-10 text-center text-slate-500">لا توجد مكونات مسجلة لهذا الصنف.</td></tr>
                            ) : (
                              item.ingredientsList.map((ing, i) => {
                                const isPackaging = ing.type === 'packaging';
                                const typeLabel = isPackaging ? '(تعبئة)' : '';
                                const finalIngTotal = isPackaging ? Math.ceil(ing.totalContribution) : ing.totalContribution;
                                const baseObj = getBaseUnitQty(finalIngTotal, ing.ingUnit);
                                
                                return (
                                  <tr key={i} className={`border-b border-slate-200 dark:border-white/10 transition-colors ${isPackaging ? 'bg-sky-50 dark:bg-sky-500/5 hover:bg-sky-100/50 dark:hover:bg-sky-500/10' : 'bg-transparent hover:bg-slate-100 dark:hover:bg-[#1a1a24]'}`}>
                                    <td className="py-5 px-2 text-center text-slate-500 en-num border-l border-slate-200 dark:border-white/10">{i + 1}</td>
                                    
                                    <td className="py-5 px-3 text-right border-l border-slate-200 dark:border-white/10 break-words">
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                        <span className={`font-black text-[15px] lg:text-[16px] leading-tight ${isPackaging ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white'}`}>{ing.ingName}</span>
                                        {isPackaging && <span className="text-[10px] w-max bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-500/20 shadow-sm dark:shadow-inner">تعبئة</span>}
                                      </div>
                                    </td>
                                    
                                    <td className="py-5 px-2 text-center border-l border-slate-200 dark:border-white/10 font-black text-slate-500 dark:text-slate-400 text-[15px] lg:text-[17px] whitespace-nowrap text-left" dir="ltr">
                                      {Number(ing.perUnitQty).toLocaleString('en-US', {maximumFractionDigits:4})}
                                    </td>
                                    
                                    {i === 0 ? (
                                      <td rowSpan={item.ingredientsList.length} className="py-5 px-2 text-center border-l border-slate-200 dark:border-white/10 align-middle bg-slate-100 dark:bg-slate-800/50">
                                        <span className="text-slate-800 dark:text-white font-black text-lg lg:text-2xl inline-block text-left whitespace-nowrap drop-shadow-sm dark:drop-shadow-md" dir="ltr">
                                          {Number(item.totalOrderQty).toLocaleString('en-US', {maximumFractionDigits:2})}
                                        </span>
                                      </td>
                                    ) : null}

                                    <td className="py-5 px-2 text-center bg-rose-50 dark:bg-rose-500/10 border-l border-slate-200 dark:border-white/10">
                                      <span className={`font-black text-lg lg:text-2xl en-num text-left inline-block whitespace-nowrap drop-shadow-sm dark:drop-shadow-md ${isPackaging ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}`} dir="ltr">
                                        {Number(finalIngTotal).toLocaleString('en-US', {maximumFractionDigits:2})}
                                      </span>
                                    </td>
                                    
                                    <td className="py-5 px-2 text-center font-black text-xs lg:text-[15px] border-l border-slate-200 dark:border-white/10 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                      {ing.ingUnit || '-'}
                                    </td>
                                    
                                    <td className="py-5 px-2 text-center bg-indigo-50 dark:bg-indigo-500/10 border-l border-slate-200 dark:border-white/10">
                                      {baseObj ? (
                                        <span className={`font-black text-lg lg:text-2xl text-left drop-shadow-sm dark:drop-shadow-md inline-block whitespace-nowrap ${isPackaging ? 'text-sky-600 dark:text-sky-400' : 'text-indigo-600 dark:text-indigo-400'}`} dir="ltr">
                                          {Number(baseObj.value).toLocaleString('en-US', {maximumFractionDigits:3})}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 dark:text-slate-600 font-bold">-</span>
                                      )}
                                    </td>
                                    
                                    <td className="py-5 px-2 text-center font-black text-xs lg:text-[15px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 whitespace-nowrap">
                                      {baseObj ? baseObj.label : <span className="text-slate-400 dark:text-slate-600">-</span>}
                                    </td>

                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              groupedCalculations.length === 0 ? (
                <div className="py-24 text-center text-slate-500 bg-slate-50 dark:bg-[#121214] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                  <Scale className="w-20 h-20 mx-auto mb-5 opacity-30 text-orange-600 dark:text-orange-500" />
                  <p className="text-2xl font-black text-slate-800 dark:text-white mb-2">لا توجد مسحوبات للاحتساب</p>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">تأكد من وجود طلبات معتمدة ومن تعيين المكونات للأصناف.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {groupedCalculations.map((group, groupIdx) => (
                    <div key={groupIdx} className="bg-white dark:bg-[#121214] rounded-[2rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-[0_5px_20px_rgba(0,0,0,0.3)]">
                      
                      <div className="bg-slate-50 dark:bg-[#0a0a0c] text-slate-900 dark:text-white p-6 flex flex-col lg:flex-row justify-between items-start gap-6 relative overflow-hidden border-b border-slate-100 dark:border-white/5">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
                        <div className="flex flex-col gap-4 relative z-10 w-full lg:w-auto">
                          <div className="flex items-center gap-3">
                            <Building2 className="w-7 h-7 text-orange-600 dark:text-orange-400" />
                            <h4 className="font-black text-2xl tracking-tight">{group.groupName}</h4>
                            <span className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-xs px-2.5 py-1 rounded-md font-bold shadow-sm dark:shadow-inner">
                              {group.totalItems} مكونات
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {group.orderedItems.map((oi, idx) => (
                              <div key={idx} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm dark:shadow-inner">
                                <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{oi.name}</span>
                                <div className="bg-slate-50 dark:bg-[#0a0a0c] text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-white/5 px-2 py-0.5 rounded text-xs font-black dir-ltr shadow-sm dark:shadow-inner">
                                  {Number(oi.qty).toLocaleString('en-US', {maximumFractionDigits:2})}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 relative z-10 w-full lg:w-auto">
                          <div className="bg-white dark:bg-[#121214] px-5 py-3 rounded-xl border border-slate-200 dark:border-white/5 text-center w-full lg:w-auto shadow-sm dark:shadow-inner">
                            <span className="block text-[11px] text-slate-500 font-black mb-1 uppercase tracking-widest">إجمالي الأوزان</span>
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 dir-ltr flex items-baseline justify-center gap-1 drop-shadow-sm dark:drop-shadow-md">
                              {Number(group.totalFoodKilos).toLocaleString('en-US', {maximumFractionDigits:2})} <span className="text-xs text-emerald-600">كغم/لتر</span>
                            </span>
                          </div>
                          <div className="bg-white dark:bg-[#121214] px-5 py-3 rounded-xl border border-slate-200 dark:border-white/5 text-center w-full lg:w-auto shadow-sm dark:shadow-inner">
                            <span className="block text-[11px] text-slate-500 font-black mb-1 uppercase tracking-widest">إجمالي التعبئة</span>
                            <span className="text-2xl font-black text-sky-600 dark:text-sky-400 dir-ltr flex items-baseline justify-center gap-1 drop-shadow-sm dark:drop-shadow-md">
                              {Number(group.totalPackaging).toLocaleString('en-US')} <span className="text-xs text-sky-600">قطعة</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full table-fixed text-right border-collapse">
                          <thead className="bg-slate-100 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 font-black text-xs border-b border-slate-200 dark:border-white/10 uppercase tracking-widest">
                            <tr>
                              <th className="py-4 px-1.5 text-center border-l border-slate-200 dark:border-white/10 w-[3%]">ت</th>
                              <th className="py-4 px-3 text-right border-l border-slate-200 dark:border-white/10 w-[16%]">المكون (السحب)</th>
                              <th className="py-4 px-2 text-right border-l border-slate-200 dark:border-white/10 w-[14%] text-slate-600 dark:text-slate-500">الصنف المرتبط</th>
                              <th className="py-4 px-2 text-center border-l border-slate-200 dark:border-white/10 w-[10%] text-slate-600 dark:text-slate-500">الوكالة</th>
                              <th className="py-4 px-2 text-center border-l border-slate-200 dark:border-white/10 w-[9%] text-slate-600 dark:text-slate-500">كمية القطعة</th>
                              <th className="py-4 px-2 text-center border-l border-slate-200 dark:border-white/10 w-[8%] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">العدد</th>
                              <th className="py-4 px-2 text-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-l border-slate-200 dark:border-white/10 w-[9%]">سحب الصنف</th>
                              <th className="py-4 px-2 text-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-l border-slate-200 dark:border-white/10 w-[9%]">السحب الكلي</th>
                              <th className="py-4 px-2 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-l border-slate-200 dark:border-white/10 w-[8%]">الوحدة</th>
                              <th className="py-4 px-2 text-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-l border-slate-200 dark:border-white/10 w-[9%]">الصافي</th>
                              <th className="py-4 px-2 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 w-[5%]">القياس</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {group.ingredients.map((ing, idx) => {
                              const sources = ing.sourceItems;
                              const rowCount = sources.length;
                              const isPackaging = ing.type === 'packaging';
                              
                              const finalIngTotal = isPackaging ? Math.ceil(ing.totalQuantity) : ing.totalQuantity;
                              const baseObj = getBaseUnitQty(finalIngTotal, ing.unit);
                              
                              return sources.map((data, sourceIdx) => {
                                const isFirst = sourceIdx === 0;
                                const isLast = sourceIdx === rowCount - 1;
                                const borderTopClass = isFirst ? `border-t border-slate-200 dark:border-white/10` : '';
                                const borderBottomClass = isLast ? `border-b border-slate-200 dark:border-white/10` : '';
                                const mainBgClass = isDark ? '#0a0a0c' : '#ffffff';
                                
                                return (
                                  <tr key={`${ing.name}-${data.itemName}-${data.agencyName}`} className={`transition-colors ${isPackaging ? 'bg-sky-50/50 dark:bg-sky-500/5 hover:bg-sky-100/50 dark:hover:bg-sky-500/10' : 'bg-transparent hover:bg-slate-100 dark:hover:bg-[#1a1a24]'}`}>
                                    
                                    <td style={{ backgroundColor: isPackaging ? '' : mainBgClass }} className={`py-5 px-1.5 text-center en-num align-top text-slate-500 border-l border-slate-200 dark:border-white/10 ${borderTopClass} ${borderBottomClass}`}>
                                      {isFirst ? idx + 1 : '-'}
                                    </td>
                                    
                                    <td style={{ backgroundColor: isPackaging ? '' : mainBgClass }} className={`py-5 px-3 text-right align-top break-words border-l border-slate-200 dark:border-white/10 ${borderTopClass} ${borderBottomClass}`}>
                                      <div className="flex flex-col gap-1">
                                        <span className={`font-black text-[14px] lg:text-[15px] leading-tight block ${isFirst ? (isPackaging ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white') : 'text-transparent'}`}>{ing.name}</span>
                                        {isPackaging && <span className={`text-[10px] w-max px-1.5 py-0.5 rounded border shadow-sm dark:shadow-inner ${isFirst ? 'text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-500/20' : 'text-transparent border-transparent'}`}>تعبئة</span>}
                                      </div>
                                    </td>

                                    <td className="py-5 px-2 text-right border-l border-t border-slate-200 dark:border-white/10 break-words">
                                      <span className="font-bold text-xs lg:text-[13px] leading-tight text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                        {data.itemName}
                                      </span>
                                    </td>
                                    
                                    <td className="py-5 px-2 text-center border-l border-t border-slate-200 dark:border-white/10 break-words">
                                      <span className="text-[10px] lg:text-[11px] font-black leading-tight text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-2 py-1 rounded-md block mx-auto w-fit shadow-sm dark:shadow-inner">
                                        {data.agencyName}
                                      </span>
                                    </td>
                                    
                                    <td className="py-5 px-2 text-center border-l border-t border-slate-200 dark:border-white/10 font-black text-slate-600 dark:text-slate-400 text-[13px] lg:text-base whitespace-nowrap" dir="ltr">
                                      {Number(data.perUnitQty).toLocaleString('en-US', {maximumFractionDigits:4})}
                                    </td>
                                    
                                    <td className="py-5 px-2 text-center border-l border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800/50">
                                      <span className="text-slate-800 dark:text-white font-black text-base lg:text-xl en-num dir-ltr inline-block drop-shadow-sm dark:drop-shadow-md whitespace-nowrap">
                                        {Number(data.orderQty).toLocaleString('en-US', {maximumFractionDigits:2})}
                                      </span>
                                    </td>

                                    <td className={`py-5 px-2 text-center align-middle border-l border-t border-slate-200 dark:border-white/10 bg-rose-50 dark:bg-rose-500/5`}>
                                      <span className={`font-black text-sm lg:text-base dir-ltr inline-block whitespace-nowrap drop-shadow-sm ${isPackaging ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {isPackaging ? Math.ceil(data.contribution).toLocaleString('en-US') : Number(data.contribution).toLocaleString('en-US', {maximumFractionDigits:2})}
                                      </span>
                                    </td>
                                    
                                    <td className={`py-5 px-2 text-center align-top font-black text-base lg:text-xl en-num dir-ltr border-l border-slate-200 dark:border-white/10 ${borderTopClass} ${borderBottomClass} bg-rose-50 dark:bg-rose-500/10`}>
                                      <span className={isFirst ? 'text-rose-600 dark:text-rose-400 drop-shadow-sm dark:drop-shadow-md' : 'text-transparent'}>
                                        {Number(finalIngTotal).toLocaleString('en-US', {maximumFractionDigits:2})}
                                      </span>
                                    </td>

                                    <td className={`py-5 px-2 text-center align-top font-black text-[11px] lg:text-sm border-l border-slate-200 dark:border-white/10 ${borderTopClass} ${borderBottomClass} bg-emerald-50 dark:bg-emerald-500/10`}>
                                      <span className={isFirst ? 'text-emerald-600 dark:text-emerald-400' : 'text-transparent'}>
                                        {ing.unit || '-'}
                                      </span>
                                    </td>
                                      
                                    <td className={`py-5 px-2 text-center align-top font-black text-base lg:text-xl dir-ltr border-l border-slate-200 dark:border-white/10 ${borderTopClass} ${borderBottomClass} bg-indigo-50 dark:bg-indigo-500/10`}>
                                      <span className={isFirst ? (isPackaging ? 'text-sky-600 dark:text-sky-400 drop-shadow-sm dark:drop-shadow-md' : 'text-indigo-600 dark:text-indigo-400 drop-shadow-sm dark:drop-shadow-md') : 'text-transparent'}>
                                        {baseObj ? Number(baseObj.value).toLocaleString('en-US', {maximumFractionDigits:3}) : '-'}
                                      </span>
                                    </td>
                                    
                                    <td className={`py-5 px-1.5 text-center align-top font-black text-[11px] lg:text-sm border-l border-slate-200 dark:border-white/10 ${borderTopClass} ${borderBottomClass} bg-emerald-50 dark:bg-emerald-500/10`}>
                                      <span className={isFirst ? 'text-emerald-600 dark:text-emerald-400' : 'text-transparent'}>
                                        {baseObj ? baseObj.label : '-'}
                                      </span>
                                    </td>

                                  </tr>
                                );
                              });
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ======================================================= */}
      {/* 🟢 التقويم المؤسساتي الشامل المبرمج (أيام، أشهر، سنوات) 🟢 */}
      {/* ======================================================= */}
      {datePickerConfig.isOpen && !isZenMode && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] z-[999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden no-print">
          <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl dark:shadow-[0_0_50px_rgba(249,115,22,0.1)] animate-in zoom-in-95 duration-300">
            
            <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/5 pb-5 shrink-0">
              <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-orange-500/10 hover:bg-slate-100 dark:hover:bg-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400 transition-colors border border-transparent outline-none cursor-pointer active:scale-95">
                <ChevronRight className="w-5 h-5"/>
              </button>
              
              <div className="flex gap-2 items-center">
                 <button 
                   onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                   className={`text-[16px] font-black transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'month' ? 'text-orange-600 dark:text-orange-400 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'text-slate-600 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-300'}`}
                 >
                   {datePickerConfig.viewDate.format('MMMM')}
                 </button>
                 <span className="text-slate-400 dark:text-slate-600">-</span>
                 <button 
                   onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                   className={`text-[18px] font-black en-num transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'year' ? 'text-orange-600 dark:text-orange-400 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'text-slate-600 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-300'}`}
                 >
                   {datePickerConfig.viewDate.format('YYYY')}
                 </button>
              </div>

              <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-orange-500/10 hover:bg-slate-100 dark:hover:bg-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400 transition-colors border border-transparent outline-none cursor-pointer active:scale-95">
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
                      className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none cursor-pointer ${isSelected ? 'bg-orange-600 text-white dark:bg-orange-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-slate-50 dark:bg-orange-500/5 text-slate-600 dark:text-orange-400/70 hover:bg-slate-100 dark:hover:bg-orange-500/15 hover:text-orange-600 dark:hover:text-orange-300 border border-slate-200 dark:border-orange-500/10'}`}
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
                      onClick={() => handleMonthSelection(datePickerConfig.viewDate.month(i))}
                      className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 outline-none cursor-pointer flex flex-col items-center gap-1.5 ${isSelected ? 'bg-orange-600 text-white dark:bg-orange-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-slate-50 dark:bg-orange-500/5 text-slate-600 dark:text-orange-400/70 hover:bg-slate-100 dark:hover:bg-orange-500/15 hover:text-orange-600 dark:hover:text-orange-300 border border-slate-200 dark:border-orange-500/10'}`}
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
                    <div key={d} className="text-center text-[10px] font-black text-slate-400 dark:text-orange-500/50 uppercase tracking-widest">{d}</div>
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
                          aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num transition-all active:scale-95 outline-none cursor-pointer
                          ${isSelected ? 'bg-orange-600 text-white dark:bg-orange-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(249,115,22,0.4)]' :
                            isToday ? 'text-orange-600 border border-orange-300 bg-orange-50 dark:text-orange-300 dark:border-orange-500/30 dark:bg-orange-500/20' :
                            'text-slate-700 hover:bg-slate-100 hover:text-orange-600 dark:bg-orange-500/5 dark:text-orange-400/80 dark:hover:bg-orange-500/15 dark:hover:text-orange-300 border border-transparent'}
                        `}
                      >
                        {dayNum}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <button onClick={() => setDatePickerConfig(p => ({...p, isOpen: false}))} className="w-full mt-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400/80 dark:hover:text-rose-400 rounded-2xl font-black text-[15px] transition-colors border border-transparent dark:border-rose-500/20 outline-none cursor-pointer active:scale-95 shadow-sm dark:shadow-inner shrink-0">
              إلغاء النافذة
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;700;900&display=swap');
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
      `}} />
    </div>
  );
}