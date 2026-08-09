"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom'; 
import { supabase } from '@/lib/supabase';
import Link from 'next/link'; // 👈 تم إضافة استيراد Link
import { 
  Archive, Loader2, AlertCircle, PackageSearch, Filter, Calendar, Store, MapPin,
  FileSpreadsheet, Printer, Layers, Package, Calculator, BookOpen,
  TrendingUp, TrendingDown, Award, ChefHat, ListChecks, RotateCcw, ChevronDown,
  Edit, Trash2, X, Save, CalendarDays, BellRing, Activity, FileText,
  Eye, EyeOff, ChevronRight, ChevronLeft, Sun, Moon, LayoutGrid // 👈 تم إضافة LayoutGrid هنا
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useTheme } from '@/components/ThemeProvider'; 

dayjs.locale('ar');

const ORDER_TYPES = ['طلبية يومية', 'طارئ / سد نقص', 'تعويض / استرجاع', 'دعم / ترويج', 'تجهيز مسبق / مناسبات'];

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

interface DbItem {
  id: string;
  name: string;
  agency_id: string;
  agencyName?: string;
  categories?: { name: string };
}

type PickerTarget = 'startDate' | 'endDate' | 'selectMonth';
const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function RecordsPage() {
  const { isDark, toggleTheme } = useTheme(); 
  const [isZenMode, setIsZenMode] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [allItemsDb, setAllItemsDb] = useState<DbItem[]>([]);
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'summary' | 'detailed' | 'accounting' | 'ingredients'>('summary');

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [governorateFilter, setGovernorateFilter] = useState<string>('الكل');
  const [sectorFilter, setSectorFilter] = useState<string>('الكل');
  const [branchFilter, setBranchFilter] = useState<string>('الكل');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [itemFilter, setItemFilter] = useState<string>('الكل');

  const [showSlowMovingDetails, setShowSlowMovingDetails] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    quantity: '',
    invoiceNumber: '',
    orderType: '',
    notes: '',
    branchId: ''
  });

  const [isClient, setIsClient] = useState(false);

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, target: PickerTarget, viewDate: dayjs.Dayjs, mode: 'date' | 'month' | 'year'
  }>({ isOpen: false, target: 'startDate', viewDate: dayjs(), mode: 'date' });

  useEffect(() => {
    if (editingRecord || datePickerConfig.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [editingRecord, datePickerConfig.isOpen]);

  const fetchData = async () => {
    if (orders.length === 0) setIsLoading(true);
    setDbError(null);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id, branch_id, status, created_at, invoice_number, order_type, notes,
          branches (id, name, governorate, sector, agency_id),
          order_details (id, item_id, quantity, items (id, name, primary_unit, main_unit, measurement_type, initial_unit, product_type, agency_id, packaging_type, packaging_capacity, packaging_unit, categories(id, name, color)))
        `)
        .limit(10000)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const validOrders = (ordersData || []).filter(order => order.status !== 'pending' && order.status !== 'rejected');

      const { data: agenciesData, error: agenciesError } = await supabase.from('agencies').select('id, name');
      if (agenciesError) throw agenciesError;

      const { data: branchesData, error: branchesError } = await supabase.from('branches').select('id, name, agency_id').order('name');
      if (branchesError) throw branchesError;

      const { data: itemsData, error: itemsError } = await supabase.from('items').select('id, name, agency_id, categories(name)');
      if (itemsError) throw itemsError;

      const agMap: Record<string, string> = {};
      agenciesData?.forEach(ag => { agMap[ag.id] = ag.name; });

      const mappedItems = (itemsData || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          agency_id: item.agency_id,
          categories: item.categories,
          agencyName: item.agency_id ? (agMap[item.agency_id] || 'غير محدد') : 'غير محدد'
      })) as DbItem[];

      setAgenciesMap(agMap);
      setAllBranches(branchesData || []);
      setAllItemsDb(mappedItems);
      setOrders(validOrders);
    } catch (err: any) {
      setDbError(err?.message || "يرجى التأكد من اتصال قاعدة البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
    const today = dayjs().format('YYYY-MM-DD');
    setStartDate(startOfMonth);
    setEndDate(today);

    fetchData();
    const channel = supabase.channel('records-realtime').on('postgres_changes',{ event: '*', schema: 'public' },() => {fetchData();}).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const flattenedRecords = useMemo(() => {
    let records: any[] = [];
    orders.forEach(order => {
      order.order_details?.forEach((detail: any) => {
        const dbInit = detail.items?.initial_unit;
        const dbPrim = detail.items?.primary_unit;
        const dbMain = detail.items?.main_unit;

        let displayInitial = '-';
        let displayPrimary = '-';

        if (dbInit && dbInit !== '-' && dbInit !== 'null') {
          displayInitial = dbInit;
          displayPrimary = dbPrim || dbMain || '-';
        } else if (dbMain) {
          displayInitial = dbPrim || '-';
          displayPrimary = dbMain;
        } else {
          displayInitial = '-';
          displayPrimary = dbPrim || '-';
        }

        let catName = 'غير محدد';
        let catColor = '#cbd5e1';
        if (detail.items?.categories) {
          if (Array.isArray(detail.items.categories) && detail.items.categories.length > 0) {
            catName = detail.items.categories[0].name || 'غير محدد';
            catColor = detail.items.categories[0].color || '#cbd5e1';
          } else if (typeof detail.items.categories === 'object' && !Array.isArray(detail.items.categories)) {
            catName = detail.items.categories.name || 'غير محدد';
            catColor = detail.items.categories.color || '#cbd5e1';
          }
        }

        records.push({
          detailId: detail.id,
          orderId: order.id,
          orderType: order.order_type || 'طلبية يومية',
          invoiceNumber: order.invoice_number || '-',
          branchId: order.branch_id,
          branchName: order.branches?.name || 'غير محدد',
          branchAgencyId: order.branches?.agency_id,
          governorate: order.branches?.governorate || '-',
          sector: order.branches?.sector || '-',
          date: order.created_at, 
          notes: order.notes || '-', 
          itemId: detail.item_id,
          itemName: detail.items?.name || '-',
          quantity: detail.quantity,
          measurementType: detail.items?.measurement_type || '-',
          productType: detail.items?.product_type || '-',
          initialUnit: displayInitial,
          primaryUnit: displayPrimary,
          mainUnit: dbMain && dbMain !== '-' ? dbMain : (dbPrim || 'لم تحدد'),
          packagingType: detail.items?.packaging_type || '-',
          packagingCapacity: detail.items?.packaging_capacity || '-',
          packagingUnit: detail.items?.packaging_unit || '-',
          ingredients: detail.items?.ingredients,
          agencyName: detail.items?.agency_id ? (agenciesMap[detail.items.agency_id] || 'غير محدد') : 'غير محدد',
          itemAgencyId: detail.items?.agency_id,
          categoryName: catName,
          categoryColor: catColor,
        });
      });
    });

    records.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return 0;
    });
    
    return records;
  }, [orders, agenciesMap]);

  const filteredRecords = useMemo(() => {
    return flattenedRecords.filter(record => {
      const recordDate = dayjs(record.date).format('YYYY-MM-DD');
      const matchStartDate = !startDate || recordDate >= startDate;
      const matchEndDate = !endDate || recordDate <= endDate;
      const matchGovernorate = governorateFilter === 'الكل' || record.governorate === governorateFilter;
      const matchSector = sectorFilter === 'الكل' || record.sector === sectorFilter;
      const matchBranch = branchFilter === 'الكل' || record.branchId === branchFilter;
      const matchCategory = categoryFilter === 'الكل' || record.categoryName === categoryFilter;
      const matchItem = itemFilter === 'الكل' || record.itemName === itemFilter;
      return matchStartDate && matchEndDate && matchGovernorate && matchSector && matchBranch && matchCategory && matchItem;
    });
  }, [flattenedRecords, startDate, endDate, governorateFilter, sectorFilter, branchFilter, categoryFilter, itemFilter]);

  const slowMovingItems = useMemo(() => {
    const effectiveStartDate = startDate || dayjs().startOf('month').format('YYYY-MM-DD');
    const effectiveEndDate = endDate || dayjs().format('YYYY-MM-DD');

    const ordersInDateRange = flattenedRecords.filter(record => {
        const recordDate = dayjs(record.date).format('YYYY-MM-DD');
        return recordDate >= effectiveStartDate && recordDate <= effectiveEndDate;
    });

    const orderedItemIds = new Set(ordersInDateRange.map(r => r.itemId));
    const slowItems = allItemsDb.filter(dbItem => !orderedItemIds.has(dbItem.id));

    return {
        items: slowItems,
        daysCount: dayjs(effectiveEndDate).diff(dayjs(effectiveStartDate), 'day') + 1,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate
    };
  }, [flattenedRecords, allItemsDb, startDate, endDate]);

  const productionSummary = useMemo(() => {
    const summary: Record<string, any> = {};
    filteredRecords.forEach(record => {
      const key = `${record.agencyName}-${record.itemName}-${record.mainUnit}`;
      if (!summary[key]) {
        summary[key] = {
          itemName: record.itemName,
          totalQuantity: 0,
          mainUnit: record.mainUnit,
          categoryName: record.categoryName,
          categoryColor: record.categoryColor,
          agencyName: record.agencyName,
          branchCount: new Set()
        };
      }
      summary[key].totalQuantity = roundNumber(summary[key].totalQuantity + (Number(record.quantity) || 0));
      summary[key].branchCount.add(record.branchName);
    });
    return Object.values(summary).sort((a: any, b: any) => b.totalQuantity - a.totalQuantity);
  }, [filteredRecords]);

  const analytics = useMemo(() => {
    if (filteredRecords.length === 0) return { totalOrders: 0, topBranch: '-', lowestBranch: '-', topItem: '-' };

    const branchQty: Record<string, number> = {};
    const itemQty: Record<string, number> = {};
    const uniqueOrders = new Set();

    filteredRecords.forEach(r => {
      uniqueOrders.add(r.orderId);
      const qty = Number(r.quantity) || 0;
      branchQty[r.branchName] = roundNumber((branchQty[r.branchName] || 0) + qty);
      itemQty[r.itemName] = roundNumber((itemQty[r.itemName] || 0) + qty);
    });

    let topB = '-'; let maxB = -1;
    let lowB = '-'; let minB = Infinity;
    Object.entries(branchQty).forEach(([name, qty]) => {
      if (qty > maxB) { maxB = qty; topB = name; }
      if (qty < minB) { minB = qty; lowB = name; }
    });
    if (minB === Infinity) lowB = '-';

    let topI = '-'; let maxI = -1;
    Object.entries(itemQty).forEach(([name, qty]) => {
      if (qty > maxI) { maxI = qty; topI = name; }
    });

    return { totalOrders: uniqueOrders.size, topBranch: topB, lowestBranch: lowB, topItem: topI };
  }, [filteredRecords]);

  const uniqueGovernorates = useMemo<string[]>(() => {
    const govs: Record<string, boolean> = {};
    flattenedRecords.forEach(r => { if (r.governorate && r.governorate !== '-') govs[r.governorate] = true; });
    return Object.keys(govs).sort();
  }, [flattenedRecords]);

  const uniqueBranches = useMemo<{ id: string, name: string, agencyId: string }[]>(() => {
    const bMap: Record<string, {name: string, agencyId: string}> = {};
    orders.forEach(order => { 
      if (order.branches && order.branches.id) {
        bMap[order.branches.id] = { name: order.branches.name, agencyId: order.branches.agency_id };
      }
    });
    return Object.keys(bMap).map(key => ({ id: key, name: bMap[key].name, agencyId: bMap[key].agencyId }));
  }, [orders]);

  const uniqueCategories = useMemo<string[]>(() => {
    const cats: Record<string, boolean> = {};
    flattenedRecords.forEach(r => { if (r.categoryName && r.categoryName !== 'غير محدد') cats[r.categoryName] = true; });
    return Object.keys(cats).sort();
  }, [flattenedRecords]);

  const uniqueItems = useMemo<string[]>(() => {
    const itms: Record<string, boolean> = {};
    flattenedRecords.forEach(r => { if (r.itemName && r.itemName !== '-') itms[r.itemName] = true; });
    return Object.keys(itms).sort();
  }, [flattenedRecords]);

  const clearFilters = () => {
    setGovernorateFilter('الكل'); setSectorFilter('الكل'); setBranchFilter('الكل'); setCategoryFilter('الكل'); setItemFilter('الكل');
    setStartDate(dayjs().startOf('month').format('YYYY-MM-DD'));
    setEndDate(dayjs().format('YYYY-MM-DD'));
  };

  const formatIngredientsForExport = (ings: any) => {
    if (!ings || ings === '-' || ings === 'null' || (Array.isArray(ings) && ings.length === 0)) return 'لا توجد مكونات';
    if (Array.isArray(ings)) return ings.map((ing: any) => `${ing.name || ''} ${ing.quantity || ''} ${ing.unit || ''}`.trim()).join(' | ');
    if (typeof ings === 'object') return JSON.stringify(ings);
    return ings;
  };

  const selectedBranchName = useMemo(() => {
    if (branchFilter === 'الكل') return 'الكل';
    return uniqueBranches.find(b => b.id === branchFilter)?.name || 'محدد';
  }, [branchFilter, uniqueBranches]);

  const handleDeleteRecord = async (record: any) => {
    if (!window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف (${record.itemName}) بشكل نهائي؟`)) return;
    try {
      const { error } = await supabase.from('order_details').delete().eq('id', record.detailId);
      if (error) throw error;
      
      const remainingItems = flattenedRecords.filter(r => r.orderId === record.orderId && r.detailId !== record.detailId);
      if (remainingItems.length === 0) {
        await supabase.from('orders').delete().eq('id', record.orderId);
      }
      fetchData(); 
    } catch (err: any) {
      alert("خطأ في الحذف: " + err.message);
    }
  };

  const handleOpenEdit = (record: any) => {
    setEditingRecord(record);
    setEditForm({
      quantity: record.quantity,
      invoiceNumber: record.invoiceNumber !== '-' ? record.invoiceNumber : '',
      orderType: record.orderType,
      notes: record.notes !== '-' ? record.notes : '',
      branchId: record.branchId
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.quantity || Number(editForm.quantity) <= 0) return alert("الكمية غير صالحة.");
    if (!editForm.branchId) return alert("يرجى اختيار الفرع.");
    
    setIsSavingEdit(true);
    try {
      const { error: detailError } = await supabase.from('order_details').update({ quantity: Number(editForm.quantity) }).eq('id', editingRecord.detailId);
      if (detailError) throw detailError;

      const { error: orderError } = await supabase.from('orders').update({
        branch_id: editForm.branchId,
        invoice_number: editForm.invoiceNumber,
        order_type: editForm.orderType,
        notes: editForm.notes
      }).eq('id', editingRecord.orderId);
      
      if (orderError) throw orderError;

      setEditingRecord(null);
      fetchData();
    } catch (err: any) {
      alert("خطأ في التعديل: " + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openDatePicker = (target: PickerTarget, defaultDate: string, defaultMode: 'date' | 'month' = 'date') => {
    setDatePickerConfig({ isOpen: true, target, viewDate: dayjs(defaultDate), mode: defaultMode });
  };

  const handleDateSelection = (dateStr: string) => {
    const t = datePickerConfig.target;
    if (t === 'startDate') setStartDate(dateStr);
    else if (t === 'endDate') setEndDate(dateStr);
    else if (t === 'selectMonth') {
      setStartDate(dayjs(dateStr).startOf('month').format('YYYY-MM-DD'));
      setEndDate(dayjs(dateStr).endOf('month').format('YYYY-MM-DD'));
    }
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const handleExportPDF = async () => {
    const dataToExport = activeTab === 'summary' ? productionSummary : filteredRecords;
    if (dataToExport.length === 0) return alert("لا توجد بيانات لطباعتها.");
    
    setIsExportingPDF(true);

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const containerWidth = 1122; 
      let title = ''; 
      let tableHeaderHTML = ''; 
      
      if (activeTab === 'summary') {
        title = 'خلاصة الإنتاج الكلية';
        tableHeaderHTML = `
          <thead style="display: table-header-group;">
            <tr>
              <th style="padding: 6px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; width: 5%;">ت</th>
              <th style="padding: 6px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; width: 15%;">الوكالة</th>
              <th style="padding: 6px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; width: 15%;">القسم</th>
              <th style="padding: 6px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; width: 30%;">المادة المطلوبة</th>
              <th style="padding: 6px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; width: 15%;">الكمية الإجمالية</th>
              <th style="padding: 6px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; width: 10%;">وحدة الحساب</th>
              <th style="padding: 6px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 11px; border: 1px solid #1e293b; width: 10%;">الفروع</th>
            </tr>
          </thead>
        `;
      } else if (activeTab === 'detailed') {
        title = 'السجل الشامل (المفصل)';
        tableHeaderHTML = `
          <thead style="display: table-header-group;">
            <tr>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 3%;">ت</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 8%;">التاريخ</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 7%;">الفاتورة</th>
              <th style="padding: 6px 4px; background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 12%;">الفرع</th>
              <th style="padding: 6px 4px; background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 10%;">الوكالة</th>
              <th style="padding: 6px 4px; background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 8%;">القسم</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 10%;">النوع</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 20%;">المادة المطلوبة</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 7%;">الكمية</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 5%;">الوحدة</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 10%;">ملاحظات</th>
            </tr>
          </thead>
        `;
      } else if (activeTab === 'accounting') {
        title = 'سجل الحسابات والتدقيق';
        tableHeaderHTML = `
          <thead style="display: table-header-group;">
            <tr>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 3%;">ت</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 7%;">التاريخ</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 7%;">الفاتورة</th>
              <th style="padding: 6px 4px; background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 10%;">الفرع</th>
              <th style="padding: 6px 4px; background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 8%;">القسم</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 15%;">المادة المطلوبة</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 7%;">نوع القياس</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 5%;">أولية</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 5%;">رئيسية</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 7%;">تغليف</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 5%;">سعة</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 5%;">و.تغليف</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 8%;">الكمية</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 9px; border: 1px solid #1e293b; width: 8%;">وحدة</th>
            </tr>
          </thead>
        `;
      } else if (activeTab === 'ingredients') {
        title = 'سجل المكونات والتفاصيل الوصفية';
        tableHeaderHTML = `
          <thead style="display: table-header-group;">
            <tr>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 3%;">ت</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 10%;">التاريخ</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 10%;">الفاتورة</th>
              <th style="padding: 6px 4px; background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 15%;">الفرع</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 20%;">المادة المطلوبة</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 24%;">المكونات المفصلة</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 8%;">الكمية</th>
              <th style="padding: 6px 4px; background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center; font-size: 10px; border: 1px solid #1e293b; width: 10%;">الوحدة</th>
            </tr>
          </thead>
        `;
      }

      const chunks = [];
      let currentIndex = 0;
      let isFirstChunk = true;

      while (currentIndex < dataToExport.length) {
        const baseRows = activeTab === 'ingredients' ? 14 : 20; 
        const firstPageRows = activeTab === 'ingredients' ? 9 : 14; 
        
        const chunkSize = isFirstChunk ? firstPageRows : baseRows;
        chunks.push(dataToExport.slice(currentIndex, currentIndex + chunkSize));
        currentIndex += chunkSize;
        isFirstChunk = false;
      }

      let contentHTML = '';

      chunks.forEach((chunk, chunkIndex) => {
        let tbodysHTML = '';
        
        chunk.forEach((r: any, localIndex: number) => {
          let globalIdx = 0;
          if (chunkIndex === 0) {
            globalIdx = localIndex + 1;
          } else {
            const firstPageRows = activeTab === 'ingredients' ? 9 : 14; 
            const baseRows = activeTab === 'ingredients' ? 14 : 20; 
            globalIdx = firstPageRows + ((chunkIndex - 1) * baseRows) + localIndex + 1;
          }

          const bg = localIndex % 2 === 0 ? '#ffffff' : '#f8fafc';

          if (activeTab === 'summary') {
            const formattedQty = Number(r.totalQuantity.toFixed(3)).toString();
            tbodysHTML += `
              <tr style="background-color: ${bg}; page-break-inside: avoid; color: #0f172a;">
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 11px;">${globalIdx}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #4338ca; font-weight: bold; font-size: 11px;">${r.agencyName}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">${r.categoryName}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 12px; word-break: break-word;">${r.itemName}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 900; color: #e11d48; font-size: 12px;" dir="ltr">${formattedQty}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #059669; font-weight: bold; font-size: 11px;">${r.mainUnit}</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 11px;">${r.branchCount.size}</td>
              </tr>
            `;
          } else if (activeTab === 'detailed') {
            tbodysHTML += `
              <tr style="background-color: ${bg}; page-break-inside: avoid; color: #0f172a;">
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 10px;">${globalIdx}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px;" dir="ltr">${dayjs(r.date).format('YYYY-MM-DD')}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #b45309; font-size: 10px;" dir="ltr">${r.invoiceNumber}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10px;">${r.branchName}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10px;">${r.agencyName}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px;">${r.categoryName}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px;">${r.orderType}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 11px; word-break: break-word;">${r.itemName}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #e11d48; font-size: 11px;" dir="ltr">${Number(r.quantity).toString()}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; color: #059669; font-weight: bold; font-size: 10px;">${r.mainUnit}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; font-size: 9px; word-break: break-word;">${r.notes || '-'}</td>
              </tr>
            `;
          } else if (activeTab === 'accounting') {
            tbodysHTML += `
              <tr style="background-color: ${bg}; page-break-inside: avoid; color: #0f172a;">
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 9px;">${globalIdx}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px;" dir="ltr">${dayjs(r.date).format('YYYY-MM-DD')}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #b45309; font-size: 9px;" dir="ltr">${r.invoiceNumber}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 9px;">${r.branchName}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px;">${r.categoryName}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 10px; word-break: break-word;">${r.itemName}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px;">${r.measurementType}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px;" dir="ltr">${r.initialUnit}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px;">${r.primaryUnit}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px;">${r.packagingType}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px;" dir="ltr">${r.packagingCapacity}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 9px;">${r.packagingUnit}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #e11d48; font-size: 10px;" dir="ltr">${Number(r.quantity).toString()}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; color: #059669; font-weight: bold; font-size: 9px;">${r.mainUnit}</td>
              </tr>
            `;
          } else if (activeTab === 'ingredients') {
            let ingsText = 'لا توجد مكونات';
            if (r.ingredients && r.ingredients !== '-' && r.ingredients !== 'null') {
                if (Array.isArray(r.ingredients)) ingsText = r.ingredients.map((ing: any) => `${ing.name || ''} ${ing.quantity || ''} ${ing.unit || ''}`.trim()).join(' | ');
                else if (typeof r.ingredients === 'object') ingsText = JSON.stringify(r.ingredients);
                else ingsText = r.ingredients;
            }
            tbodysHTML += `
              <tr style="background-color: ${bg}; page-break-inside: avoid; color: #0f172a;">
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 10px;">${globalIdx}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-size: 10px;" dir="ltr">${dayjs(r.date).format('YYYY-MM-DD')}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #b45309; font-size: 10px;" dir="ltr">${r.invoiceNumber}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10px;">${r.branchName}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 11px; word-break: break-word;">${r.itemName}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; font-size: 9px; color: #92400e; word-break: break-word;">${ingsText}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #e11d48; font-size: 11px;" dir="ltr">${Number(r.quantity).toString()}</td>
                <td style="padding: 6px 4px; border: 1px solid #cbd5e1; text-align: center; color: #059669; font-weight: bold; font-size: 10px;">${r.mainUnit}</td>
              </tr>
            `;
          }
        });

        const pageBreakClass = chunkIndex > 0 ? 'page-break-before: always; padding-top: 20px;' : '';
        contentHTML += `
          <div style="${pageBreakClass}">
            <table style="width: 100%; table-layout: fixed; border-collapse: collapse; background: #ffffff; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
              ${tableHeaderHTML}
              <tbody>${tbodysHTML}</tbody>
            </table>
          </div>
        `;
      });

      const finalHTML = `
        <div id="pdf-wrapper" style="width: ${containerWidth}px; max-width: ${containerWidth}px; box-sizing: border-box; background: #ffffff; direction: rtl; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #e11d48; padding-bottom: 15px; margin-bottom: 20px;">
            <div>
              <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 900;">${title}</h1>
              <p style="margin: 5px 0 0 0; color: #e11d48; font-size: 14px; font-weight: bold;">نظام الإدارة المركزي</p>
            </div>
            <div style="text-align: left;">
              <p style="margin: 0; color: #475569; font-size: 12px; font-weight: bold;">تاريخ التصدير</p>
              <p style="margin: 3px 0 0 0; color: #94a3b8; font-size: 11px;">${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
            </div>
          </div>

          <div style="background: #f8fafc; padding: 12px 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 15px; font-size: 12px; font-weight: bold; color: #334155;">
            <div><span style="color: #e11d48;">النطاق الزمني:</span> <span dir="ltr">${startDate || 'الكل'} إلى ${endDate || 'الكل'}</span></div>
            <div><span style="color: #e11d48;">المحافظة:</span> ${governorateFilter}</div>
            <div><span style="color: #e11d48;">الفرع:</span> ${selectedBranchName}</div>
            <div><span style="color: #e11d48;">القسم:</span> ${categoryFilter}</div>
            <div><span style="color: #e11d48;">المادة:</span> ${itemFilter}</div>
          </div>

          ${contentHTML}

        </div>
      `;

      const opt: any = {
        margin:       0, 
        filename:     `${title.replace(/[\s\/\\]/g, '_')}_${dayjs().format('YYYYMMDD')}.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          logging: false, 
          windowWidth: containerWidth, 
          scrollX: 0,
          scrollY: 0
        }, 
        jsPDF:        { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'landscape' 
        },
        pagebreak:    { mode: ['css', 'legacy'] } 
      };

      await html2pdf().set(opt).from(finalHTML).save();

    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("حدث خطأ أثناء إنشاء ملف الـ PDF. تأكد من تثبيت مكتبة html2pdf.js.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    const dataToExport = activeTab === 'summary' ? productionSummary : filteredRecords;
    if (dataToExport.length === 0) return alert("لا توجد بيانات لتصديرها.");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('التقرير', { views: [{ rightToLeft: true }] });

    let title = '';
    let headers: string[] = [];
    let dataRows: any[][] = [];
    let qtyColIndex = -1;
    let unitColIndex = -1;

    if (activeTab === 'summary') {
      title = 'خلاصة الإنتاج الكلية - المطبخ المركزي';
      headers = ['ت', 'الوكالة', 'القسم', 'المادة المطلوبة', 'الكمية الإجمالية', 'وحدة الحساب', 'عدد الفروع المجهزة'];
      qtyColIndex = 5; unitColIndex = 6;
      productionSummary.forEach((r, i) => {
        dataRows.push([ i + 1, r.agencyName, r.categoryName, r.itemName, Number(r.totalQuantity.toFixed(3)), r.mainUnit, r.branchCount.size ]);
      });
    } else if (activeTab === 'detailed') {
      title = 'السجل الشامل المفصل للطلبيات';
      headers = ['ت', 'اليوم', 'التاريخ', 'الوقت', 'رقم الفاتورة', 'المحافظة', 'القاطع', 'الفرع', 'الوكالة', 'القسم', 'نوع الطلبية', 'المادة المطلوبة', 'الكمية', 'وحدة الحساب', 'الملاحظات'];
      qtyColIndex = 13; unitColIndex = 14;
      filteredRecords.forEach((r, i) => {
        dataRows.push([ i + 1, getArabicDay(r.date), dayjs(r.date).format('YYYY-MM-DD'), dayjs(r.date).format('hh:mm A'), r.invoiceNumber, r.governorate, r.sector, r.branchName, r.agencyName, r.categoryName, r.orderType, r.itemName, Number(r.quantity), r.mainUnit, r.notes || '-' ]);
      });
    } else if (activeTab === 'accounting') {
      title = 'سجل الحسابات والتدقيق المفصل';
      headers = ['ت', 'التاريخ', 'رقم الفاتورة', 'الفرع', 'القسم', 'المادة المطلوبة', 'نوع القياس', 'الوحدة الأولية', 'الوحدة الرئيسية', 'نوع التغليف', 'سعة التغليف', 'وحدة التغليف', 'الكمية', 'وحدة الحساب'];
      qtyColIndex = 13; unitColIndex = 14;
      filteredRecords.forEach((r, i) => {
        dataRows.push([ i + 1, dayjs(r.date).format('YYYY-MM-DD'), r.invoiceNumber, r.branchName, r.categoryName, r.itemName, r.measurementType, r.initialUnit, r.primaryUnit, r.packagingType, r.packagingCapacity, r.packagingUnit, Number(r.quantity), r.mainUnit ]);
      });
    } else if (activeTab === 'ingredients') {
      title = 'سجل المكونات والتفاصيل الوصفية';
      headers = ['ت', 'التاريخ', 'رقم الفاتورة', 'الفرع', 'المادة المطلوبة', 'المكونات المفصلة', 'الكمية', 'وحدة الحساب'];
      qtyColIndex = 7; unitColIndex = 8;
      filteredRecords.forEach((r, i) => {
        dataRows.push([ i + 1, dayjs(r.date).format('YYYY-MM-DD'), r.invoiceNumber, r.branchName, r.itemName, formatIngredientsForExport(r.ingredients), Number(r.quantity), r.mainUnit ]);
      });
    }

    const totalCols = headers.length;

    // عنوان التقرير (Title)
    worksheet.mergeCells(`A1:${getColLetter(totalCols)}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // تاريخ التصدير (Meta)
    worksheet.mergeCells(`A2:${getColLetter(totalCols)}2`);
    const metaCell = worksheet.getCell('A2');
    metaCell.value = `تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}`;
    metaCell.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } };
    metaCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.addRow([]);

    // معلومات الفلترة (Filters)
    const filter1Row = worksheet.addRow(['النطاق الزمني:', `${startDate || 'الكل'} إلى ${endDate || 'الكل'}`, '', 'الفرع المحدد:', selectedBranchName]);
    worksheet.mergeCells('B4:C4');
    if (totalCols > 4) worksheet.mergeCells(`E4:${getColLetter(totalCols)}4`);
    
    const filter2Row = worksheet.addRow(['القسم:', categoryFilter, '', 'المادة:', itemFilter]);
    worksheet.mergeCells('B5:C5');
    if (totalCols > 4) worksheet.mergeCells(`E5:${getColLetter(totalCols)}5`);

    [filter1Row, filter2Row].forEach(row => {
      row.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      row.getCell(4).font = { bold: true, color: { argb: 'FF334155' } };
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      row.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } };
      row.getCell(5).font = { bold: true, color: { argb: 'FF0F172A' } };
    });

    worksheet.addRow([]);

    // رأس الجدول (Headers)
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // بيانات الجدول (Data Rows)
    dataRows.forEach((rowData, idx) => {
      const row = worksheet.addRow(rowData);
      const isAlt = idx % 2 !== 0;
      
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin', color: {argb: 'FFCBD5E1'} }, left: { style: 'thin', color: {argb: 'FFCBD5E1'} }, bottom: { style: 'thin', color: {argb: 'FFCBD5E1'} }, right: { style: 'thin', color: {argb: 'FFCBD5E1'} } };
        
        if (isAlt) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }

        if (colNumber === qtyColIndex) {
          cell.font = { bold: true, color: { argb: 'FF1D4ED8' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
        } else if (colNumber === unitColIndex) {
          cell.font = { bold: true, color: { argb: 'FF059669' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        }
      });
    });

    // ضبط عرض الأعمدة (Column Widths)
    worksheet.columns.forEach((col, i) => {
      if (i === 0) col.width = 6;
      else if (activeTab === 'ingredients' && i === 5) col.width = 45; 
      else col.width = 20;
    });

    // توليد الملف النهائي (Generate File)
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${title.replace(/ /g, '_')}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const isFiltersApplied = governorateFilter !== 'الكل' || sectorFilter !== 'الكل' || branchFilter !== 'الكل' || categoryFilter !== 'الكل' || itemFilter !== 'الكل';

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-all duration-300 ease-in-out ${isZenMode ? 'bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-300 pb-10' : 'bg-slate-100 dark:bg-[#050505] text-slate-900 dark:text-white pb-[130px]'}`} dir="rtl">
        
        {/* 🌟 الخلفية المظلمة والتأثيرات 🌟 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] transition-colors duration-500 from-indigo-200/50 via-slate-100 to-slate-100 dark:from-indigo-900/20 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none transition-opacity ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-500 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🟢 الهيدر الثابت 🟢 */}
          <div className={`flex flex-col md:flex-row items-center justify-between gap-6 mb-8 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] relative z-10 no-print transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-4 text-right w-full shrink-0 flex-1">
              <Link href="/hub" className="bg-slate-100 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none cursor-pointer active:scale-95">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>

              <div className="bg-gradient-to-br from-indigo-500 to-violet-600 w-14 h-14 rounded-[1.3rem] text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center shrink-0">
                <Archive className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight">السجل الشامل ومركز العمليات</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-1 hidden sm:block">إدارة وتجميع وتصدير طلبات الفروع المعتمدة.</p>
              </div>
            </div>

            <div className="shrink-0 w-full md:w-auto">
              <button onClick={toggleTheme} className="p-3.5 rounded-2xl flex items-center justify-center transition-all border outline-none cursor-pointer active:scale-95 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm" title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}>
                {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
              </button>
            </div>
          </div>

          {/* 🟢 شريط أدوات التحكم (Toolbar) الموحد 🟢 */}
          <div className={`bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/10 p-2 md:p-3 rounded-[1.5rem] mb-8 flex flex-col-reverse xl:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-lg w-full no-print relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>

              {/* جزء الأزرار */}
              <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                  <button onClick={handleExportPDF} disabled={isExportingPDF} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none disabled:opacity-50">
                    {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4" />} طباعة PDF
                  </button>
                  <button onClick={handleExportExcel} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-emerald-300 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none">
                    <FileSpreadsheet className="w-4 h-4" /> تصدير إكسل
                  </button>
                  <button onClick={() => setIsZenMode(true)} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-black text-[12px] transition-all outline-none">
                    <Eye className="w-4 h-4" /> وضع التركيز
                  </button>
              </div>

              {/* جزء التاريخ المبرمج */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto">
                  <div onClick={() => openDatePicker('selectMonth', startDate || dayjs().format('YYYY-MM-DD'), 'month')} className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden cursor-pointer h-[46px] group hover:border-teal-400 dark:hover:border-teal-500/50 transition-colors w-full sm:w-auto shadow-sm dark:shadow-inner">
                    <div className="bg-slate-50 dark:bg-[#121214] px-4 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0 transition-colors group-hover:bg-teal-50 dark:group-hover:bg-teal-500/20">
                      <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-500" />
                    </div>
                    <div className="bg-white dark:bg-[#050505] px-4 flex items-center justify-center min-w-[90px]">
                      <span className="text-[12px] font-black text-slate-800 dark:text-white tracking-widest whitespace-nowrap">شهر محدد</span>
                    </div>
                  </div>

                  <div className="hidden sm:block w-px h-6 bg-slate-300 dark:bg-white/10 mx-1"></div>

                  <div onClick={() => openDatePicker('startDate', startDate || dayjs().format('YYYY-MM-DD'), 'date')} className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden cursor-pointer h-[46px] group hover:border-indigo-400 dark:hover:border-white/20 transition-colors w-full sm:w-auto shadow-sm dark:shadow-inner">
                    <div className="bg-slate-50 dark:bg-[#121214] w-12 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">من</span>
                    </div>
                    <div className="bg-white dark:bg-[#050505] px-4 flex items-center justify-center min-w-[130px]">
                      <span className="text-[13px] font-black text-slate-800 dark:text-white tracking-widest dir-ltr en-num whitespace-nowrap">{startDate ? dayjs(startDate).format('DD / MM / YYYY') : '-'}</span>
                    </div>
                  </div>
                  
                  <div onClick={() => openDatePicker('endDate', endDate || dayjs().format('YYYY-MM-DD'), 'date')} className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden cursor-pointer h-[46px] group hover:border-indigo-400 dark:hover:border-white/20 transition-colors w-full sm:w-auto shadow-sm dark:shadow-inner">
                    <div className="bg-slate-50 dark:bg-[#121214] w-12 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إلى</span>
                    </div>
                    <div className="bg-white dark:bg-[#050505] px-4 flex items-center justify-center min-w-[130px]">
                      <span className="text-[13px] font-black text-slate-800 dark:text-white tracking-widest dir-ltr en-num whitespace-nowrap">{endDate ? dayjs(endDate).format('DD / MM / YYYY') : '-'}</span>
                    </div>
                  </div>
              </div>

          </div>

          {/* 🟢 الفلاتر الإضافية 🟢 */}
          <div className={`bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-5 rounded-[1.5rem] flex flex-col gap-4 mb-8 shadow-sm dark:shadow-inner relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
             <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 mb-2">
               <div className="flex items-center gap-2 font-black text-slate-500 dark:text-slate-400 text-[13px]">
                 <Filter className="w-4 h-4 text-indigo-500" /> فلاتر الجرد والتصنيف
               </div>
               {isFiltersApplied && (
                 <button onClick={clearFilters} className="flex items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[11px] px-3 py-1.5 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors outline-none">
                   <RotateCcw className="w-3 h-3" /> مسح
                 </button>
               )}
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
               <div className="relative bg-slate-50 dark:bg-[#050505] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner h-12 flex items-center">
                  <div className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none"><MapPin className="w-4 h-4" /></div>
                  <select value={governorateFilter} onChange={(e) => setGovernorateFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-10 outline-none font-bold text-slate-700 dark:text-slate-300 text-xs appearance-none cursor-pointer">
                    <option value="الكل" className="bg-white dark:bg-[#121214]">المحافظات (الكل)</option>
                    {uniqueGovernorates.map(gov => (<option key={gov} value={gov} className="bg-white dark:bg-[#121214]">{gov}</option>))}
                  </select>
                  <ChevronDown className="absolute left-3 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
               </div>
               
               <div className="relative bg-slate-50 dark:bg-[#050505] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner h-12 flex items-center">
                  <div className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none"><Store className="w-4 h-4" /></div>
                  <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-10 outline-none font-bold text-slate-700 dark:text-slate-300 text-xs appearance-none cursor-pointer">
                    <option value="الكل" className="bg-white dark:bg-[#121214]">الفروع (الكل)</option>
                    {uniqueBranches.map(branch => (<option key={branch.id} value={branch.id} className="bg-white dark:bg-[#121214]">{branch.name}</option>))}
                  </select>
                  <ChevronDown className="absolute left-3 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
               </div>

               <div className="relative bg-slate-50 dark:bg-[#050505] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner h-12 flex items-center">
                  <div className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none"><Layers className="w-4 h-4" /></div>
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-10 outline-none font-bold text-slate-700 dark:text-slate-300 text-xs appearance-none cursor-pointer">
                    <option value="الكل" className="bg-white dark:bg-[#121214]">الأقسام (الكل)</option>
                    {uniqueCategories.map(cat => (<option key={cat} value={cat} className="bg-white dark:bg-[#121214]">{cat}</option>))}
                  </select>
                  <ChevronDown className="absolute left-3 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
               </div>

               <div className="relative bg-slate-50 dark:bg-[#050505] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner h-12 flex items-center">
                  <div className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none"><Package className="w-4 h-4" /></div>
                  <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-10 outline-none font-bold text-slate-700 dark:text-slate-300 text-xs appearance-none cursor-pointer">
                    <option value="الكل" className="bg-white dark:bg-[#121214]">المواد (الكل)</option>
                    {uniqueItems.map(item => (<option key={item} value={item} className="bg-white dark:bg-[#121214]">{item}</option>))}
                  </select>
                  <ChevronDown className="absolute left-3 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
               </div>
             </div>
          </div>

          {dbError && (
            <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-md w-full relative z-10">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-rose-500" /><p>{dbError}</p>
            </div>
          )}

          {!dbError && isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 w-full relative z-10">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            </div>
          ) : !dbError && (
            <>
              <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 w-full relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
                <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] shadow-sm dark:shadow-lg border border-slate-200 dark:border-white/10 flex items-center gap-4">
                  <div className="p-3.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-200 dark:border-blue-500/20 shadow-sm dark:shadow-inner"><ListChecks className="w-6 h-6" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-slate-500 mb-0.5">الطلبيات المجهزة</p>
                    <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white en-num leading-none">{analytics.totalOrders}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] shadow-sm dark:shadow-lg border border-slate-200 dark:border-white/10 flex items-center gap-4">
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner"><TrendingUp className="w-6 h-6" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-slate-500 mb-0.5">أعلى فرع طلباً</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white truncate leading-tight">{analytics.topBranch}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] shadow-sm dark:shadow-lg border border-slate-200 dark:border-white/10 flex items-center gap-4">
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-200 dark:border-rose-500/20 shadow-sm dark:shadow-inner"><TrendingDown className="w-6 h-6" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-slate-500 mb-0.5">أقل فرع طلباً</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white truncate leading-tight">{analytics.lowestBranch}</p>
                  </div>
                </div>
                <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] shadow-sm dark:shadow-lg border border-slate-200 dark:border-white/10 flex items-center gap-4">
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-200 dark:border-amber-500/20 shadow-sm dark:shadow-inner"><Award className="w-6 h-6" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-slate-500 mb-0.5">المادة الأكثر طلباً</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white truncate leading-tight">{analytics.topItem}</p>
                  </div>
                </div>
              </div>

              {slowMovingItems.items.length > 0 && (
                <div className={`bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-[2rem] mb-8 overflow-hidden transition-all duration-300 relative z-10 ${isZenMode ? 'hidden' : 'block'}`}>
                  <div 
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors"
                    onClick={() => setShowSlowMovingDetails(!showSlowMovingDetails)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-100 dark:bg-orange-500/20 p-2.5 rounded-xl text-orange-600 dark:text-orange-400 relative shadow-sm dark:shadow-inner">
                        <BellRing className="w-6 h-6 animate-pulse" />
                        <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span></span>
                      </div>
                      <div>
                        <h4 className="text-base font-black text-orange-700 dark:text-orange-400">تنبيه المخزون الراكد</h4>
                        <p className="text-sm font-bold text-orange-600/70 dark:text-orange-300/70">
                          تم رصد <span className="font-black text-rose-600 dark:text-rose-400 en-num px-1">{slowMovingItems.items.length}</span> مادة لم يتم طلبها نهائياً خلال فترة البحث (<span className="en-num">{slowMovingItems.daysCount}</span> أيام).
                        </p>
                      </div>
                    </div>
                    <button className="bg-white dark:bg-[#050505] text-orange-600 dark:text-orange-400 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 border border-orange-200 dark:border-white/10 shadow-sm dark:shadow-inner outline-none">
                      {showSlowMovingDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'} <ChevronDown className={`w-4 h-4 transition-transform ${showSlowMovingDetails ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  
                  {showSlowMovingDetails && (
                    <div className="p-5 bg-white/50 dark:bg-[#050505]/50 border-t border-orange-200 dark:border-orange-500/20">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4">هذه المواد لم تظهر في أي طلبية تم تجهيزها بين {slowMovingItems.startDate} و {slowMovingItems.endDate}:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {slowMovingItems.items.map(item => (
                          <div key={item.id} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-3 rounded-xl flex items-start gap-3 shadow-sm dark:shadow-inner hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <Activity className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-black text-slate-900 dark:text-slate-300 text-sm">{item.name}</p>
                              <div className="flex gap-2 mt-1">
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-500/20">{item.agencyName}</span>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-md shadow-sm dark:shadow-inner">{item.categories?.name || 'بدون قسم'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col xl:flex-row bg-white dark:bg-[#121214] p-2 rounded-[2rem] border border-slate-200 dark:border-white/5 w-full mb-6 shadow-sm dark:shadow-inner gap-2 relative z-10 transition-all duration-300">
                <button onClick={() => setActiveTab('summary')} className={`flex-1 px-3 py-3.5 rounded-[1.5rem] font-black text-sm transition-all flex items-center justify-center gap-2 outline-none ${activeTab === 'summary' ? 'bg-indigo-50 dark:bg-[#050505] shadow-sm dark:shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}><ChefHat className="w-4 h-4 shrink-0" /> خلاصة الإنتاج الكلية</button>
                <button onClick={() => setActiveTab('detailed')} className={`flex-1 px-3 py-3.5 rounded-[1.5rem] font-black text-sm transition-all flex items-center justify-center gap-2 outline-none ${activeTab === 'detailed' ? 'bg-blue-50 dark:bg-[#050505] shadow-sm dark:shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}><ListChecks className="w-4 h-4 shrink-0" /> السجل الشامل (المفصل)</button>
                <button onClick={() => setActiveTab('accounting')} className={`flex-1 px-3 py-3.5 rounded-[1.5rem] font-black text-sm transition-all flex items-center justify-center gap-2 outline-none ${activeTab === 'accounting' ? 'bg-emerald-50 dark:bg-[#050505] shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}><Calculator className="w-4 h-4 shrink-0" /> الحسابات والتدقيق</button>
                <button onClick={() => setActiveTab('ingredients')} className={`flex-1 px-3 py-3.5 rounded-[1.5rem] font-black text-sm transition-all flex items-center justify-center gap-2 outline-none ${activeTab === 'ingredients' ? 'bg-amber-50 dark:bg-[#050505] shadow-sm dark:shadow-[0_0_15px_rgba(245,158,11,0.3)] border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'}`}><BookOpen className="w-4 h-4 shrink-0" /> المكونات الوصفية</button>
              </div>

              <div className={`transition-all duration-500 w-full min-h-[400px]`}>
                
                {activeTab === 'summary' && (
                  <div className={`flex flex-col h-full rounded-[2.5rem] overflow-hidden transition-all duration-300 ${isZenMode ? 'bg-transparent border-none' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-md dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]'}`}>
                    <div className={`flex items-center justify-between p-6 border-b transition-colors ${isZenMode ? 'bg-slate-100/50 dark:bg-black/50 border-slate-200 dark:border-white/5' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5'}`}>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">المجموع الكلي للإنتاج والتجهيز</h3>
                      <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-full font-black text-sm border border-indigo-200 dark:border-indigo-500/20 shadow-sm dark:shadow-inner">
                        {productionSummary.length} مواد للإنتاج
                      </span>
                    </div>

                    {productionSummary.length === 0 ? (
                      <div className="py-24 text-center text-slate-400 dark:text-slate-500">
                        <ChefHat className="w-16 h-16 mx-auto mb-4 opacity-40 text-indigo-500" />
                        <p className="text-xl font-black">لا توجد مواد مطلوبة ضمن هذا النطاق.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto w-full custom-scrollbar pb-6 px-2 pt-2">
                        <table className="w-full text-right border-collapse whitespace-nowrap">
                          <thead className="bg-slate-100 dark:bg-[#050505] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase">
                            <tr>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">ت</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">الوكالة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">القسم</th>
                              <th className="py-4 px-6 text-right border-b border-slate-200 dark:border-white/10 min-w-[200px]">المادة المطلوبة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400">الكمية الإجمالية</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400">وحدة الحساب</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">عدد الفروع</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm divide-y divide-slate-100 dark:divide-white/5">
                            {productionSummary.map((item, idx) => {
                              const formattedQty = Number(item.totalQuantity.toFixed(3)).toString();
                              return (
                                <tr key={`sum-${idx}`} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors bg-transparent">
                                  <td className="py-4 px-4 text-center font-bold text-slate-500 en-num">{idx + 1}</td>
                                  <td className="py-4 px-4 text-center font-black text-indigo-600 dark:text-indigo-400">{item.agencyName}</td>
                                  <td className="py-4 px-4 text-center font-black" style={{ color: item.categoryColor || '#a78bfa' }}>{item.categoryName}</td>
                                  <td className="py-4 px-6 text-right font-black text-slate-800 dark:text-slate-200 whitespace-normal break-words max-w-[250px] leading-relaxed">{item.itemName}</td>
                                  <td className="py-4 px-4 text-center font-black text-lg text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5 en-num dir-ltr shadow-sm dark:shadow-inner">{formattedQty}</td>
                                  <td className="py-4 px-4 text-center font-black text-emerald-600 dark:text-emerald-400">{item.mainUnit}</td>
                                  <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400 en-num">{item.branchCount.size}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'detailed' && (
                  <div className={`flex flex-col h-full rounded-[2.5rem] overflow-hidden transition-all duration-300 ${isZenMode ? 'bg-transparent border-none' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-md dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]'}`}>
                    <div className={`flex items-center justify-between p-6 border-b transition-colors ${isZenMode ? 'bg-slate-100/50 dark:bg-black/50 border-slate-200 dark:border-white/5' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5'}`}>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">السجل التفصيلي لطلبات الفروع</h3>
                      <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-4 py-1.5 rounded-full font-black text-sm border border-blue-200 dark:border-blue-500/20 shadow-sm dark:shadow-inner">{filteredRecords.length} مادة</span>
                    </div>

                    {filteredRecords.length === 0 ? (
                      <div className="py-24 text-center text-slate-400 dark:text-slate-500"><PackageSearch className="w-16 h-16 mx-auto mb-4 opacity-40 text-blue-500" /><p className="text-xl font-black">لا توجد سجلات مطابقة.</p></div>
                    ) : (
                      <div className="overflow-x-auto w-full custom-scrollbar pb-6 px-2 pt-2">
                        <table className="w-full text-right border-collapse whitespace-nowrap">
                          <thead className="bg-slate-100 dark:bg-[#050505] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase">
                            <tr>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">ت</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">التاريخ</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">الوقت</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-amber-600 dark:text-amber-500">الفاتورة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">المحافظة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400">الفرع</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">الوكالة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">القسم</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">نوع الطلبية</th>
                              <th className="py-4 px-6 text-right border-b border-slate-200 dark:border-white/10 min-w-[200px]">المادة المطلوبة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400">الكمية</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400">وحدة الحساب</th>
                              <th className="py-4 px-6 text-right border-b border-slate-200 dark:border-white/10 min-w-[150px]">ملاحظات</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm divide-y divide-slate-100 dark:divide-white/5">
                            {filteredRecords.map((record, index) => (
                              <tr key={`det-${record.detailId}`} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors bg-transparent">
                                <td className="py-4 px-4 text-center font-bold text-slate-500 en-num">{index + 1}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400 en-num dir-ltr">{dayjs(record.date).format('YYYY-MM-DD')}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-500 en-num dir-ltr">{dayjs(record.date).format('hh:mm A')}</td>
                                <td className="py-4 px-4 text-center font-bold text-amber-600 dark:text-amber-400 en-num dir-ltr">{record.invoiceNumber}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-700 dark:text-slate-300">{record.governorate}</td>
                                <td className="py-4 px-4 text-center font-black text-indigo-600 dark:text-indigo-300">{record.branchName}</td>
                                <td className="py-4 px-4 text-center font-black text-indigo-500 dark:text-indigo-400">{record.agencyName}</td>
                                <td className="py-4 px-4 text-center font-black" style={{ color: record.categoryColor || '#a78bfa' }}>{record.categoryName}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400">{record.orderType}</td>
                                <td className="py-4 px-6 text-right font-black text-slate-800 dark:text-slate-200 whitespace-normal break-words max-w-[250px] leading-relaxed">{record.itemName}</td>
                                <td className="py-4 px-4 text-center font-black text-lg text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5 en-num dir-ltr shadow-sm dark:shadow-inner">{Number(record.quantity).toString()}</td>
                                <td className="py-4 px-4 text-center font-black text-emerald-600 dark:text-emerald-400">{record.mainUnit}</td>
                                <td className="py-4 px-6 text-right font-bold text-slate-500 whitespace-normal max-w-[200px] break-words">{record.notes || '-'}</td>
                                <td className="py-4 px-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => handleOpenEdit(record)} className="p-2 text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-colors outline-none" title="تعديل"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteRecord(record)} className="p-2 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors outline-none" title="حذف"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'accounting' && (
                  <div className={`flex flex-col h-full rounded-[2.5rem] overflow-hidden transition-all duration-300 ${isZenMode ? 'bg-transparent border-none' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-md dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]'}`}>
                    <div className={`flex items-center justify-between p-6 border-b transition-colors ${isZenMode ? 'bg-slate-100/50 dark:bg-black/50 border-slate-200 dark:border-white/5' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5'}`}>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">سجل الحسابات والتدقيق</h3>
                      <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-full font-black text-sm border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{filteredRecords.length} مادة</span>
                    </div>

                    {filteredRecords.length === 0 ? (
                      <div className="py-24 text-center text-slate-400 dark:text-slate-500"><Calculator className="w-16 h-16 mx-auto mb-4 opacity-40 text-emerald-500" /><p className="text-xl font-black">لا توجد سجلات مطابقة.</p></div>
                    ) : (
                      <div className="overflow-x-auto w-full custom-scrollbar pb-6 px-2 pt-2">
                        <table className="w-full text-right border-collapse whitespace-nowrap">
                          <thead className="bg-slate-100 dark:bg-[#050505] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase">
                            <tr>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">ت</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">التاريخ</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-amber-600 dark:text-amber-500">الفاتورة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400">الفرع</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">القسم</th>
                              <th className="py-4 px-6 text-right border-b border-slate-200 dark:border-white/10 min-w-[200px]">المادة المطلوبة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">نوع القياس</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">أولية</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">رئيسية</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">نوع التغليف</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">سعة التغليف</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">وحدة التغليف</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400">الكمية</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400">و.الحساب</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm divide-y divide-slate-100 dark:divide-white/5">
                            {filteredRecords.map((record, index) => (
                              <tr key={`acc-${record.detailId}`} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors bg-transparent">
                                <td className="py-4 px-4 text-center font-bold text-slate-500 en-num">{index + 1}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400 en-num dir-ltr">{dayjs(record.date).format('YYYY-MM-DD')}</td>
                                <td className="py-4 px-4 text-center font-bold text-amber-600 dark:text-amber-400 en-num dir-ltr">{record.invoiceNumber}</td>
                                <td className="py-4 px-4 text-center font-black text-indigo-600 dark:text-indigo-300">{record.branchName}</td>
                                <td className="py-4 px-4 text-center font-black" style={{ color: record.categoryColor || '#a78bfa' }}>{record.categoryName}</td>
                                <td className="py-4 px-6 text-right font-black text-slate-800 dark:text-slate-200 whitespace-normal break-words max-w-[250px] leading-relaxed">{record.itemName}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400">{record.measurementType}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-700 dark:text-slate-300 en-num dir-ltr">{record.initialUnit}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-700 dark:text-slate-300">{record.primaryUnit}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400">{record.packagingType}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-700 dark:text-slate-300 en-num dir-ltr">{record.packagingCapacity}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400">{record.packagingUnit}</td>
                                <td className="py-4 px-4 text-center font-black text-lg text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5 en-num dir-ltr shadow-sm dark:shadow-inner">{Number(record.quantity).toString()}</td>
                                <td className="py-4 px-4 text-center font-black text-emerald-600 dark:text-emerald-400">{record.mainUnit}</td>
                                <td className="py-4 px-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => handleOpenEdit(record)} className="p-2 text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-colors outline-none" title="تعديل"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteRecord(record)} className="p-2 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors outline-none" title="حذف"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'ingredients' && (
                  <div className={`flex flex-col h-full rounded-[2.5rem] overflow-hidden transition-all duration-300 ${isZenMode ? 'bg-transparent border-none' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-md dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]'}`}>
                    <div className={`flex items-center justify-between p-6 border-b transition-colors ${isZenMode ? 'bg-slate-100/50 dark:bg-black/50 border-slate-200 dark:border-white/5' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5'}`}>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">سجل المكونات والتفاصيل الوصفية</h3>
                      <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-1.5 rounded-full font-black text-sm border border-amber-200 dark:border-amber-500/20 shadow-sm dark:shadow-inner">{filteredRecords.length} مادة</span>
                    </div>

                    {filteredRecords.length === 0 ? (
                      <div className="py-24 text-center text-slate-400 dark:text-slate-500"><BookOpen className="w-16 h-16 mx-auto mb-4 opacity-40 text-amber-500" /><p className="text-xl font-black">لا توجد سجلات مطابقة للبحث.</p></div>
                    ) : (
                      <div className="overflow-x-auto w-full custom-scrollbar pb-6 px-2 pt-2">
                        <table className="w-full text-right border-collapse whitespace-nowrap">
                          <thead className="bg-slate-100 dark:bg-[#050505] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase">
                            <tr>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">ت</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">التاريخ</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-amber-600 dark:text-amber-500">الفاتورة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">الفرع</th>
                              <th className="py-4 px-6 text-right border-b border-slate-200 dark:border-white/10 min-w-[200px]">المادة المطلوبة</th>
                              <th className="py-4 px-6 text-right border-b border-slate-200 dark:border-white/10 min-w-[300px]">المكونات المفصلة</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400">الكمية</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400">و.الحساب</th>
                              <th className="py-4 px-4 text-center border-b border-slate-200 dark:border-white/10">إجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm divide-y divide-slate-100 dark:divide-white/5">
                            {filteredRecords.map((record, index) => (
                              <tr key={`ing-${record.detailId}`} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors bg-transparent">
                                <td className="py-4 px-4 text-center font-bold text-slate-500 en-num">{index + 1}</td>
                                <td className="py-4 px-4 text-center font-bold text-slate-600 dark:text-slate-400 en-num dir-ltr">{dayjs(record.date).format('YYYY-MM-DD')}</td>
                                <td className="py-4 px-4 text-center font-bold text-amber-600 dark:text-amber-400 en-num dir-ltr">{record.invoiceNumber}</td>
                                <td className="py-4 px-4 text-center font-black text-indigo-600 dark:text-indigo-300">{record.branchName}</td>
                                <td className="py-4 px-6 text-right font-black text-slate-800 dark:text-slate-200 whitespace-normal break-words max-w-[250px] leading-relaxed">{record.itemName}</td>
                                <td className="py-4 px-6 text-right font-bold text-slate-600 dark:text-slate-400 whitespace-normal leading-relaxed text-[12px] max-w-[400px]">
                                  {(() => {
                                    const ings = record.ingredients;
                                    if (!ings || ings === '-' || ings === 'null' || (Array.isArray(ings) && ings.length === 0)) {
                                      return <span className="text-slate-400 dark:text-slate-600">لا توجد مكونات مسجلة</span>;
                                    }
                                    if (Array.isArray(ings)) {
                                      return ings.map((ing: any) => `${ing.name || ''} ${ing.quantity || ''} ${ing.unit || ''}`.trim()).join(' | ');
                                    }
                                    if (typeof ings === 'object') return JSON.stringify(ings);
                                    return String(ings);
                                  })()}
                                </td>
                                <td className="py-4 px-4 text-center font-black text-lg text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5 en-num dir-ltr shadow-sm dark:shadow-inner">{Number(record.quantity).toString()}</td>
                                <td className="py-4 px-4 text-center font-black text-emerald-600 dark:text-emerald-400">{record.mainUnit}</td>
                                <td className="py-4 px-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => handleOpenEdit(record)} className="p-2 text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-colors outline-none" title="تعديل"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteRecord(record)} className="p-2 text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors outline-none" title="حذف"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </>
          )}

        </div>

        {/* 🟢 النافذة المنبثقة للتعديل (Modal) 🟢 */}
        {isClient && editingRecord && createPortal(
          <div className={`fixed inset-0 z-[9999999] flex items-center justify-center bg-slate-900/40 dark:bg-[#050505]/80 backdrop-blur-md p-4 animate-in fade-in duration-200 font-sans ${isDark ? 'dark' : ''}`} dir="rtl">
            <div className="bg-white dark:bg-[#0a0a0c] rounded-[2rem] w-full max-w-lg p-8 shadow-2xl dark:shadow-[0_0_80px_rgba(0,0,0,0.8)] relative border border-slate-200 dark:border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 dark:from-amber-500 dark:via-orange-400 dark:to-amber-600"></div>
              
              <button onClick={() => setEditingRecord(null)} className="absolute top-6 left-6 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-white bg-slate-50 dark:bg-[#121214] hover:bg-rose-100 dark:hover:bg-rose-500 border border-slate-200 dark:border-white/5 hover:border-rose-300 dark:hover:border-rose-500 p-2.5 rounded-full transition-all duration-300 outline-none">
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-3">
                <div className="bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-xl border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-500 shadow-sm dark:shadow-inner"><Edit className="w-5 h-5" /></div> 
                تعديل المادة
              </h3>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-8 bg-slate-50 dark:bg-[#121214] p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">{editingRecord.itemName}</p>
              
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">الكمية (<span className="text-emerald-600 dark:text-emerald-400">{editingRecord.mainUnit}</span>)</label>
                  <input type="number" step="any" value={editForm.quantity} onChange={(e) => setEditForm({...editForm, quantity: e.target.value})} className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 px-5 py-4 outline-none font-black text-indigo-600 dark:text-indigo-400 rounded-2xl en-num dir-ltr text-lg focus:border-indigo-400 dark:focus:border-indigo-500/50 transition-colors shadow-sm dark:shadow-inner" />
                </div>
                
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">الفرع طالب التجهيز</label>
                  <div className="relative">
                    <select 
                      value={editForm.branchId} 
                      onChange={(e) => setEditForm({...editForm, branchId: e.target.value})} 
                      className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 px-5 py-4 outline-none font-bold text-slate-700 dark:text-slate-300 rounded-2xl cursor-pointer focus:border-indigo-400 dark:focus:border-indigo-500/50 transition-colors appearance-none shadow-sm dark:shadow-inner"
                    >
                      {uniqueBranches
                        .filter(b => b.agencyId === editingRecord.itemAgencyId)
                        .map(branch => (
                          <option key={branch.id} value={branch.id} className="bg-white dark:bg-[#121214]">{branch.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">رقم الفاتورة المرجعي</label>
                  <input type="text" value={editForm.invoiceNumber} onChange={(e) => setEditForm({...editForm, invoiceNumber: e.target.value})} className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 px-5 py-4 outline-none font-black text-amber-600 dark:text-amber-400 placeholder-slate-400 dark:placeholder-slate-600 rounded-2xl en-num dir-ltr focus:border-indigo-400 dark:focus:border-indigo-500/50 transition-colors shadow-sm dark:shadow-inner" placeholder="اختياري..." />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">نوع الطلبية</label>
                  <div className="relative">
                    <select value={editForm.orderType} onChange={(e) => setEditForm({...editForm, orderType: e.target.value})} className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 px-5 py-4 outline-none font-bold text-slate-700 dark:text-slate-300 rounded-2xl cursor-pointer focus:border-indigo-400 dark:focus:border-indigo-500/50 transition-colors appearance-none shadow-sm dark:shadow-inner">
                      {ORDER_TYPES.map(t => <option key={t} value={t} className="bg-white dark:bg-[#121214]">{t}</option>)}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none w-5 h-5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">الملاحظات</label>
                  <input type="text" value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 px-5 py-4 outline-none font-bold text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 rounded-2xl focus:border-indigo-400 dark:focus:border-indigo-500/50 transition-colors shadow-sm dark:shadow-inner" placeholder="لا توجد ملاحظات..." />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
                <button onClick={() => setEditingRecord(null)} className="flex-1 bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 font-bold py-4 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors outline-none shadow-sm dark:shadow-inner">
                  إلغاء
                </button>
                <button onClick={handleSaveEdit} disabled={isSavingEdit} className="flex-1 bg-amber-500 dark:bg-amber-600 text-white font-black py-4 rounded-xl hover:bg-amber-600 dark:hover:bg-amber-500 shadow-md dark:shadow-[0_0_15px_rgba(217,119,6,0.4)] transition-all flex items-center justify-center gap-2 outline-none">
                  {isSavingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  حفظ التعديلات
                </button>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold text-center mt-5">* ملاحظة: تعديل (الفرع، الفاتورة، النوع، والملاحظات) سيتم تطبيقه على جميع مواد نفس الطلبية تلقائياً.</p>
            </div>
          </div>,
          document.body
        )}

        {/* 💡 التقويم المؤسساتي المنبثق (Modal) 💡 */}
        {isClient && datePickerConfig.isOpen && !isZenMode && createPortal(
          <div className={`fixed inset-0 z-[9999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 font-sans ${isDark ? 'dark' : ''}`} dir="rtl">
            <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] shadow-2xl dark:shadow-[0_0_50px_rgba(20,184,166,0.15)] animate-in zoom-in-95 duration-300">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-white/5 pb-5">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors outline-none">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black transition-colors outline-none ${datePickerConfig.mode === 'month' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num transition-colors outline-none ${datePickerConfig.mode === 'year' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-300'}`}
                   >
                     {datePickerConfig.viewDate.format('YYYY')}
                   </button>
                </div>

                <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors outline-none">
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
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none ${isSelected ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
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
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 flex flex-col items-center gap-1.5 outline-none ${isSelected ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
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
                      if (datePickerConfig.target === 'startDate') selectedDateStr = startDate;
                      else if (datePickerConfig.target === 'endDate') selectedDateStr = endDate;

                      const isSelected = dateStr === selectedDateStr;
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDateSelection(dateStr)}
                          className={`
                            aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num transition-all active:scale-95 outline-none
                            ${isSelected ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]' :
                              isToday ? 'text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10' :
                              'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-transparent'}
                          `}
                        >
                          {dayNum}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <button onClick={() => setDatePickerConfig(p => ({...p, isOpen: false}))} className="w-full mt-6 py-4 bg-slate-50 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-2xl font-black text-[15px] transition-colors border border-transparent outline-none">
                إلغاء
              </button>
            </div>
          </div>,
          document.body
        )}

      </div>
    </div>
  );
}