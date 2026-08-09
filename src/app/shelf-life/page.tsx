"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  ShieldAlert, Loader2, AlertCircle, Search, Filter, 
  Store, PackageOpen, AlertTriangle, CheckCircle2, Clock, CalendarX,
  Printer, FileSpreadsheet, Building2, RotateCcw, ChevronDown,
  Settings, Maximize, RefreshCw, CheckSquare, Sun, Moon, Eye, EyeOff,
  Database, Activity, Layers, Snowflake, ThermometerSnowflake, Box, Infinity
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ar-iq';

import * as XLSX from 'xlsx-js-style';

dayjs.extend(relativeTime);
dayjs.locale('ar-iq');

// ==========================================
// 💡 واجهات البيانات (Interfaces) 💡
// ==========================================
interface TrackedItem {
  uniqueId: string;
  orderId: string;
  branchName: string;
  branchSequence: number; 
  agencyName: string;
  categoryName: string;
  categoryColor: string;
  categorySequence: number; 
  itemName: string;
  itemSequence: number;     
  mainUnit: string;
  orderDate: string;
  quantity: string;
  shelfLifeDays: number | ''; 
  storageMethod: string; 
  expiryDate: string;
  daysRemaining: number;
  progressPercent: number;
  isInfinite: boolean;
  status: 'valid' | 'warning' | 'expired' | 'infinite';
}

interface MasterItem {
  id: string;
  name: string;
  agencyName: string;
  categoryName: string;
  categoryColor: string;
  categorySequence: number;
  itemSequence: number;     
  mainUnit: string;
  shelfLifeDays: number | '';
  storageMethod: string;
}

interface ItemSettings {
  shelfLife: number | '';
  storageMethod: string;
}

// ==========================================
// 💡 دوال مساعدة 💡
// ==========================================
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

const parseShelfLife = (str: string | number | null | undefined): number | '' => {
  if (str === '' || str === null || str === undefined) return '';
  if (typeof str === 'number') return str === 0 ? '' : str;
  const text = String(str).toLowerCase();
  if (text.includes('بدون')) return '';
  const match = text.match(/\d+/);
  if (match) {
    const num = parseInt(match[0]);
    return num === 0 ? '' : num;
  }
  if (text.includes('شهرين')) return 60;
  if (text.includes('شهر')) return 30;
  if (text.includes('اسبوعين') || text.includes('أسبوعين')) return 14;
  if (text.includes('اسبوع') || text.includes('أسبوع')) return 7;
  if (text.includes('يومين')) return 2;
  if (text.includes('يوم')) return 1;
  return '';
};

const getStorageIcon = (method: string) => {
  if (method === 'مبرد') return <ThermometerSnowflake className="w-5 h-5 text-sky-500" />;
  if (method === 'مجمد') return <Snowflake className="w-5 h-5 text-indigo-500" />;
  if (method === 'جاف') return <Box className="w-5 h-5 text-amber-600" />;
  return <PackageOpen className="w-5 h-5 text-slate-400" />;
};

const defaultPdfSettings = {
  paperSize: 'A3', margin: '10mm', zoom: 85, shiftX: 0, autoFit: false,
  c_seq: 3, c_agency: 9, c_branch: 10, c_cat: 8, c_item: 20, c_storage: 8, c_qty: 6, c_unit: 6, c_odate: 9, c_shelf: 8, c_edate: 9, c_status: 10
};

export default function ShelfLifePage() {
  const { isDark, toggleTheme } = useTheme(); 
  const [isZenMode, setIsZenMode] = useState(false);

  const [activeMainTab, setActiveMainTab] = useState<'tracking' | 'master_data'>('tracking');

  const [trackedItems, setTrackedItems] = useState<TrackedItem[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  
  const [modifiedSettings, setModifiedSettings] = useState<Record<string, ItemSettings>>({});
  
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  
  const [dbBranches, setDbBranches] = useState<string[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('الكل');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [activeAgencyTab, setActiveAgencyTab] = useState('الكل');

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const [clearedItems, setClearedItems] = useState<string[]>([]);

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('shelfLifePdfSettings_v1');
    if (savedSettings) try { setPdfSettings(JSON.parse(savedSettings)); } catch (e) {}
    
    const savedCleared = localStorage.getItem('qa_cleared_items_v1');
    if (savedCleared) try { setClearedItems(JSON.parse(savedCleared)); } catch (e) {}
  }, []);

  useEffect(() => {
    if (isMounted) localStorage.setItem('shelfLifePdfSettings_v1', JSON.stringify(pdfSettings));
  }, [pdfSettings, isMounted]);

  const handleDismissItem = (uniqueId: string) => {
    if (!window.confirm('هل أنت متأكد من إخفاء هذه المادة؟ (سيتم اعتبارها مستهلكة أو تالفة ولن تظهر بالتقارير)')) return;
    const newCleared = [...clearedItems, uniqueId];
    setClearedItems(newCleared);
    localStorage.setItem('qa_cleared_items_v1', JSON.stringify(newCleared));
  };

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => setPdfSettings(prev => ({ ...prev, [key]: value }));
  const resetPdfSettings = () => setPdfSettings(defaultPdfSettings);

  const fetchData = async () => {
    setIsLoading(true); setDbError(null);
    try {
      const savedSettingsStr = localStorage.getItem('qa_item_settings_v2');
      let localSettings: Record<string, ItemSettings> = savedSettingsStr ? JSON.parse(savedSettingsStr) : {};

      const oldSettingsStr = localStorage.getItem('qa_custom_shelf_lives_v1');
      if (oldSettingsStr && !savedSettingsStr) {
        const oldSettings = JSON.parse(oldSettingsStr);
        Object.keys(oldSettings).forEach(id => {
          localSettings[id] = { shelfLife: oldSettings[id] === 0 ? '' : oldSettings[id], storageMethod: 'غير محدد' };
        });
        localStorage.setItem('qa_item_settings_v2', JSON.stringify(localSettings));
      }

      const [agenciesRes, categoriesRes, branchesRes] = await Promise.all([
        supabase.from('agencies').select('id, name'),
        supabase.from('categories').select('name, sequence').order('sequence', { ascending: true }),
        supabase.from('branches').select('name, agency_id, sequence').order('sequence', { ascending: true })
      ]);

      const agMap: Record<string, string> = {};
      agenciesRes.data?.forEach(ag => { agMap[ag.id] = ag.name; });
      setAgenciesMap(agMap);

      if (categoriesRes.data) {
        setDbCategories(categoriesRes.data.map(c => c.name));
      }

      if (branchesRes.data) {
        const bList = branchesRes.data.map(b => getCleanBranchName(b.name, b.agency_id ? agMap[b.agency_id] : ''));
        setDbBranches(Array.from(new Set(bList))); 
      }

      const { data: recipesData } = await supabase.from('recipes').select('item_id, shelf_life').not('item_id', 'is', null);
      const recipeShelfLifeMap: Record<string, number | ''> = {};
      if (recipesData) {
        recipesData.forEach((r: any) => {
          if (r.item_id) {
            const parsed = parseShelfLife(r.shelf_life);
            if (typeof parsed === 'number' && parsed > 0) {
              const current = recipeShelfLifeMap[r.item_id];
              recipeShelfLifeMap[r.item_id] = typeof current === 'number' ? Math.max(parsed, current) : parsed;
            }
          }
        });
      }

      const { data: rawItemsData, error: itemsErr } = await supabase.from('items').select(`
        id, name, primary_unit, main_unit, agency_id, sequence,
        categories (name, color, sequence)
      `);
      if (itemsErr) throw itemsErr;

      const masterList: MasterItem[] = [];
      
      rawItemsData?.forEach((item: any) => {
        const agencyName = item.agency_id ? agMap[item.agency_id] : 'غير محدد';
        const defaultShelf = recipeShelfLifeMap[item.id] !== undefined ? recipeShelfLifeMap[item.id] : '';
        
        const finalShelf = localSettings[item.id] !== undefined ? localSettings[item.id].shelfLife : defaultShelf;
        const finalStorage = localSettings[item.id] !== undefined ? localSettings[item.id].storageMethod : 'غير محدد';
        
        const catSeq = (item.categories?.sequence !== null && item.categories?.sequence !== undefined) ? Number(item.categories.sequence) : 999;
        const itemSeq = (item.sequence !== null && item.sequence !== undefined) ? Number(item.sequence) : 999;

        masterList.push({
          id: item.id,
          name: item.name || 'غير معروف',
          agencyName: agencyName,
          categoryName: item.categories?.name || 'غير محدد',
          categoryColor: item.categories?.color || '#cbd5e1',
          categorySequence: catSeq,
          itemSequence: itemSeq,
          mainUnit: (item.main_unit && item.main_unit !== '-' && item.main_unit !== 'null') ? item.main_unit : (item.primary_unit || 'لم تحدد'),
          shelfLifeDays: finalShelf,
          storageMethod: finalStorage
        });
      });

      masterList.sort((a, b) => {
        if (a.agencyName !== b.agencyName) return a.agencyName.localeCompare(b.agencyName);
        if (a.categorySequence !== b.categorySequence) return a.categorySequence - b.categorySequence;
        if (a.itemSequence !== b.itemSequence) return a.itemSequence - b.itemSequence;
        return a.name.localeCompare(b.name);
      });
      setMasterItems(masterList);

      const { data: ordersData, error: ordersError } = await supabase.from('orders').select(`
          id, branch_id, created_at, status, branches (id, name, agency_id, sequence),
          order_details (item_id, quantity, items (id, name, primary_unit, main_unit, agency_id, sequence, categories(name, color, sequence)))
        `).limit(100000).order('created_at', { ascending: false });
      if (ordersError) throw ordersError;

      const validOrders = (ordersData || []).filter((order: any) => order.status !== 'pending' && order.status !== 'rejected');
      const itemsList: TrackedItem[] = [];
      const today = dayjs();
      
      const seenCombos = new Set<string>();

      validOrders.forEach((order: any) => {
        const branchAgencyName = order.branches?.agency_id ? agMap[order.branches.agency_id] : '';
        const bName = getCleanBranchName(order.branches?.name, branchAgencyName);
        const branchSeq = (order.branches?.sequence !== null && order.branches?.sequence !== undefined) ? Number(order.branches.sequence) : 999;

        order.order_details?.forEach((detail: any) => {
          if (!detail.items) return;

          const itemId = detail.items.id;
          
          let shelfLife = localSettings[itemId] !== undefined ? localSettings[itemId].shelfLife : (recipeShelfLifeMap[itemId] || '');
          let storageMethod = localSettings[itemId] !== undefined ? localSettings[itemId].storageMethod : 'غير محدد';
          
          if (shelfLife === '' || typeof shelfLife !== 'number' || shelfLife <= 0) return;

          const branchId = order.branch_id;
          const comboKey = `${branchId}_${itemId}`; 
          const uniqueTrackingId = `${order.id}_${itemId}`; 
          
          if (seenCombos.has(comboKey)) return;
          seenCombos.add(comboKey);

          const itemName = detail.items.name || 'غير معروف';
          const itemAgencyName = detail.items.agency_id ? agMap[detail.items.agency_id] : 'غير محدد';
          const catName = detail.items.categories?.name || 'غير محدد';
          const catColor = detail.items.categories?.color || '#cbd5e1';
          const dbPrim = detail.items.primary_unit; const dbMain = detail.items.main_unit;
          const calculatedMainUnit = dbMain && dbMain !== '-' && dbMain !== 'null' ? dbMain : (dbPrim || 'لم تحدد');
          const rawCatSequence = detail.items.categories?.sequence; const catSequence = (rawCatSequence !== null && rawCatSequence !== undefined) ? Number(rawCatSequence) : 999;
          const rawItemSequence = detail.items.sequence; const itemSequence = (rawItemSequence !== null && rawItemSequence !== undefined) ? Number(rawItemSequence) : 999;

          const orderDate = dayjs(order.created_at); 
          const expiryDate = orderDate.add(shelfLife, 'day'); 
          const daysRemaining = expiryDate.diff(today, 'day');
          
          let status: 'valid' | 'warning' | 'expired' = 'valid';
          if (daysRemaining <= 0) status = 'expired'; 
          else if (daysRemaining <= 3) status = 'warning';

          let progressPercent = 0;
          if (daysRemaining > 0) {
            progressPercent = Math.min(100, Math.max(0, (daysRemaining / shelfLife) * 100));
          }

          itemsList.push({
            uniqueId: uniqueTrackingId, orderId: order.id, branchName: bName, branchSequence: branchSeq, agencyName: itemAgencyName, categoryName: catName, categoryColor: catColor, categorySequence: catSequence, itemName: itemName, itemSequence: itemSequence, mainUnit: calculatedMainUnit, quantity: detail.quantity || '-', shelfLifeDays: shelfLife, storageMethod, orderDate: order.created_at, expiryDate: expiryDate.toISOString(), daysRemaining, progressPercent, isInfinite: false, status
          });
        });
      });

      itemsList.sort((a, b) => {
        if (a.agencyName !== b.agencyName) return a.agencyName.localeCompare(b.agencyName);
        if (a.categorySequence !== b.categorySequence) return a.categorySequence - b.categorySequence;
        if (a.itemSequence !== b.itemSequence) return a.itemSequence - b.itemSequence;
        if (a.branchSequence !== b.branchSequence) return a.branchSequence - b.branchSequence;
        return a.itemName.localeCompare(b.itemName);
      });
      
      setTrackedItems(itemsList);
      setModifiedSettings({}); 
    } catch (err: any) { setDbError(err?.message || "يرجى التأكد من اتصال قاعدة البيانات."); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, [activeMainTab]);

  const handleSettingChange = (itemId: string, field: 'shelfLife' | 'storageMethod', value: any) => {
    setModifiedSettings(prev => {
      const existing = prev[itemId] || { 
        shelfLife: masterItems.find(i => i.id === itemId)?.shelfLifeDays ?? '', 
        storageMethod: masterItems.find(i => i.id === itemId)?.storageMethod || 'غير محدد' 
      };
      
      const updatedItem = { ...existing, [field]: value };
      
      try {
        const savedCustomStr = localStorage.getItem('qa_item_settings_v2');
        const currentCustom = savedCustomStr ? JSON.parse(savedCustomStr) : {};
        const newCustom = { ...currentCustom, [itemId]: updatedItem };
        localStorage.setItem('qa_item_settings_v2', JSON.stringify(newCustom));
      } catch (err) { console.error("خطأ في الحفظ التلقائي", err); }

      return { ...prev, [itemId]: updatedItem };
    });
  };

  const uniqueAgenciesList = useMemo(() => {
    const agencies = new Set<string>();
    masterItems.forEach(item => { if (item.agencyName && item.agencyName !== 'غير محدد') agencies.add(item.agencyName); });
    return Array.from(agencies).sort();
  }, [masterItems]);

  const filteredTrackingItems = useMemo(() => {
    return trackedItems.filter(item => {
      if (clearedItems.includes(item.uniqueId)) return false;
      const matchSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBranch = branchFilter === 'الكل' || item.branchName === branchFilter;
      const matchStatus = statusFilter === 'الكل' || item.status === statusFilter;
      const matchAgency = activeAgencyTab === 'الكل' || item.agencyName === activeAgencyTab;
      const matchCat = categoryFilter === 'الكل' || item.categoryName === categoryFilter;
      return matchSearch && matchBranch && matchStatus && matchAgency && matchCat;
    });
  }, [trackedItems, searchTerm, branchFilter, statusFilter, activeAgencyTab, categoryFilter, clearedItems]);

  const filteredMasterItems = useMemo(() => {
    return masterItems.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchAgency = activeAgencyTab === 'الكل' || item.agencyName === activeAgencyTab;
      const matchCategory = categoryFilter === 'الكل' || item.categoryName === categoryFilter;
      return matchSearch && matchAgency && matchCategory;
    });
  }, [masterItems, searchTerm, activeAgencyTab, categoryFilter]);

  const groupedTrackingItems = useMemo(() => {
    const groups: { groupKey: string, agencyName: string, categoryName: string, categoryColor: string, categorySequence: number, items: TrackedItem[] }[] = [];
    filteredTrackingItems.forEach(item => {
      const key = `${item.agencyName}-${item.categoryName}`;
      let group = groups.find(g => g.groupKey === key);
      if (!group) {
        group = { groupKey: key, agencyName: item.agencyName, categoryName: item.categoryName, categoryColor: item.categoryColor, categorySequence: item.categorySequence, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });
    
    groups.sort((a, b) => {
       if (a.agencyName !== b.agencyName) return a.agencyName.localeCompare(b.agencyName);
       return a.categorySequence - b.categorySequence;
    });
    
    return groups;
  }, [filteredTrackingItems]);

  const groupedMasterItems = useMemo(() => {
    const groups: { groupKey: string, agencyName: string, categoryName: string, categoryColor: string, categorySequence: number, items: MasterItem[] }[] = [];
    filteredMasterItems.forEach(item => {
      const key = `${item.agencyName}-${item.categoryName}`;
      let group = groups.find(g => g.groupKey === key);
      if (!group) {
        group = { groupKey: key, agencyName: item.agencyName, categoryName: item.categoryName, categoryColor: item.categoryColor, categorySequence: item.categorySequence, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });
    
    groups.sort((a, b) => {
       if (a.agencyName !== b.agencyName) return a.agencyName.localeCompare(b.agencyName);
       return a.categorySequence - b.categorySequence;
    });

    return groups;
  }, [filteredMasterItems]);

  const stats = useMemo(() => ({
    total: filteredTrackingItems.length,
    expired: filteredTrackingItems.filter(i => i.status === 'expired').length,
    warning: filteredTrackingItems.filter(i => i.status === 'warning').length,
    valid: filteredTrackingItems.filter(i => i.status === 'valid').length,
  }), [filteredTrackingItems]);

  const clearFilters = () => { 
    setSearchTerm(''); setBranchFilter('الكل'); setStatusFilter('الكل'); 
    setCategoryFilter('الكل'); setActiveAgencyTab('الكل'); 
  };
  
  const getStatusText = (val: string) => val === 'expired' ? 'منتهية الصلاحية' : val === 'warning' ? 'قاربت على الانتهاء' : val === 'valid' ? 'صالحة' : 'كل الحالات';

  // ==========================================
  // 💡 دوال التصدير 💡
  // ==========================================
  const handleExportExcel = () => {
    if (filteredTrackingItems.length === 0) return alert("لا توجد بيانات لتصديرها.");
    try {
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };
      const agencyTitle = activeAgencyTab !== 'الكل' ? `وكالة ${activeAgencyTab}` : 'كل الوكالات';
      const branchText = branchFilter === 'الكل' ? 'كل الفروع' : branchFilter;
      const statusTextFiltered = getStatusText(statusFilter);

      const aoaData: any[][] = [
        [`تقرير متابعة صلاحية المواد والحفظ (QA) - ${agencyTitle}`],
        [`تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}`], [],
        ["الفرع المختار:", branchText, "", "حالة الصلاحية:", statusTextFiltered], []
      ];

      const headers = [ "🔢 ت", activeAgencyTab === 'الكل' ? "🏢 الوكالة" : null, "🏪 الفرع", "📑 القسم", "📦 المادة / الصنف", "🧊 الحفظ", "⚖️ الكمية", "📏 الوحدة", "📅 تاريخ التجهيز", "⏳ الصلاحية الكلية", "⏰ الانتهاء", "📊 الحالة والوقت المتبقي" ].filter(Boolean);
      aoaData.push(headers);
      const dataStartIndex = aoaData.length;

      filteredTrackingItems.forEach((item, index) => {
        const statusText = item.status === 'expired' ? `منتهي منذ ${Math.abs(item.daysRemaining)} يوم` : item.status === 'warning' ? `متبقي ${item.daysRemaining} يوم (تحذير)` : `متبقي ${item.daysRemaining} يوم`;
        
        const row = [ 
          index + 1, activeAgencyTab === 'الكل' ? item.agencyName : null, item.branchName, item.categoryName, item.itemName, item.storageMethod, 
          item.quantity, item.mainUnit, dayjs(item.orderDate).format('YYYY-MM-DD'), `${item.shelfLifeDays} يوم`, dayjs(item.expiryDate).format('YYYY-MM-DD'), statusText 
        ].filter(v => v !== null);
        aoaData.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoaData);
      ws['!dir'] = 'rtl';
      const numCols = headers.length;
      ws['!cols'] = [ { wch: 6 }, activeAgencyTab === 'الكل' ? { wch: 20 } : null, { wch: 20 }, { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 } ].filter(Boolean) as any;

      XLSX.utils.book_append_sheet(wb, ws, "QA - الصلاحيات");
      XLSX.writeFile(wb, `تقرير_تتبع_الصلاحيات_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
    } catch (err) { alert("حدث خطأ أثناء التصدير."); console.error(err); }
  };

  const handleExportPDF = () => {
    if (filteredTrackingItems.length === 0) return alert("لا توجد بيانات لطباعتها.");
    setIsExportingPDF(true);
    const agencyTitle = activeAgencyTab !== 'الكل' ? `(وكالة ${activeAgencyTab})` : '(كل الوكالات)';
    const branchText = branchFilter === 'الكل' ? 'كل الفروع' : branchFilter;
    const statusTextFiltered = getStatusText(statusFilter);
    const hasAgencyCol = activeAgencyTab === 'الكل';
    const getColStyle = (widthPercent: number) => pdfSettings.autoFit ? `padding: 10px 4px;` : `width: ${widthPercent}%; padding: 10px 4px;`;

    let trRows = '';
    let globalIndex = 0;

    groupedTrackingItems.forEach(group => {
      trRows += `
        <tr style="background-color: #f1f5f9; border-top: 2px solid #94a3b8; border-bottom: 2px solid #94a3b8;">
          <td colspan="${hasAgencyCol ? 10 : 9}" style="padding: 12px 15px; text-align: right; font-size: 15px; font-weight: 900; color: #1e293b; white-space: nowrap !important;">
            <span style="display:inline-block; width:12px; height:12px; background-color:${group.categoryColor}; border-radius:50%; margin-left:8px;"></span>
            ${activeAgencyTab === 'الكل' ? group.agencyName + ' - ' : ''}${group.categoryName}
          </td>
        </tr>
      `;

      group.items.forEach(item => {
        globalIndex++;
        const rowClass = globalIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
        const statusText = item.status === 'expired' ? `منتهي منذ ${Math.abs(item.daysRemaining)} يوم` : item.status === 'warning' ? `متبقي ${item.daysRemaining} يوم` : `متبقي ${item.daysRemaining} يوم`;
        const statusStyle = item.status === 'expired' ? 'color: #e11d48; background: #ffe4e6;' : item.status === 'warning' ? 'color: #d97706; background: #fef3c7;' : 'color: #059669; background: #d1fae5;';

        trRows += `
          <tr style="background-color: ${rowClass}; page-break-inside: avoid;">
            <td style="${getColStyle(pdfSettings.c_seq)} color: #64748b; font-weight: bold; text-align: center; border: 1px solid #cbd5e1; font-size: 13px; white-space: nowrap !important;">${globalIndex}</td>
            ${hasAgencyCol ? `<td style="${getColStyle(pdfSettings.c_agency)} text-align: center; color: #1d4ed8; font-weight: bold; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">${item.agencyName}</td>` : ''}
            <td style="${getColStyle(pdfSettings.c_branch)} font-weight: 900; text-align: center; border: 1px solid #cbd5e1; font-size: 14px; color: #1e293b; white-space: nowrap !important;">${item.branchName}</td>
            <td style="${getColStyle(pdfSettings.c_item)} text-align: right; font-weight: 900; color: #1e293b; border: 1px solid #cbd5e1; font-size: 16px; white-space: nowrap !important;">${item.itemName}</td>
            <td style="${getColStyle(pdfSettings.c_storage)} text-align: center; font-weight: bold; color: #475569; border: 1px solid #cbd5e1; font-size: 13px; white-space: nowrap !important;">${item.storageMethod}</td>
            <td dir="ltr" style="${getColStyle(pdfSettings.c_qty)} text-align: center; color: #059669; font-weight: 900; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">${item.quantity}</td>
            <td style="${getColStyle(pdfSettings.c_unit)} text-align: center; font-weight: bold; border: 1px solid #cbd5e1; font-size: 13px; white-space: nowrap !important;">${item.mainUnit}</td>
            <td dir="ltr" style="${getColStyle(pdfSettings.c_odate)} text-align: center; border: 1px solid #cbd5e1; font-size: 13px; font-weight: bold; color: #475569; white-space: nowrap !important;">${dayjs(item.orderDate).format('YYYY-MM-DD')}</td>
            <td style="${getColStyle(pdfSettings.c_shelf)} text-align: center; border: 1px solid #cbd5e1; font-size: 13px; font-weight: bold; color: #4f46e5; white-space: nowrap !important;">${item.shelfLifeDays} يوم</td>
            <td dir="ltr" style="${getColStyle(pdfSettings.c_edate)} text-align: center; font-weight: 900; border: 1px solid #cbd5e1; font-size: 13px; color: #0f172a; white-space: nowrap !important;">${dayjs(item.expiryDate).format('YYYY-MM-DD')}</td>
            <td style="${getColStyle(pdfSettings.c_status)} text-align: center; font-weight: 900; font-size: 13px; border: 1px solid #cbd5e1; ${statusStyle} white-space: nowrap !important;">${statusText}</td>
          </tr>
        `;
      });
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>تقرير_الصلاحيات_${dayjs().format('YYYYMMDD')}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            @page { size: ${pdfSettings.paperSize} landscape; margin: ${pdfSettings.margin}; }
            body { font-family: 'Cairo', system-ui, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; background: white; }
            .print-footer { display: flex !important; position: fixed !important; bottom: 0; left: 0; right: 0; background: white; padding-top: 6px; border-top: 2px solid #e2e8f0; z-index: 1000; justify-content: space-between; font-size: 12px; font-weight: 900; color: #64748b; }
            table { width: 100% !important; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'} !important; border-collapse: collapse; page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            th, td { white-space: nowrap !important; }
            .print-container { padding-bottom: 50px; zoom: ${pdfSettings.zoom / 100}; width: 100%; max-width: 100%; margin-right: ${pdfSettings.shiftX}mm; }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #e11d48; padding-bottom: 12px; margin-bottom: 15px;">
              <div><h1 style="margin: 0; color: #e11d48; font-size: 26px; font-weight: 900;">تقرير متابعة صلاحية المواد والحفظ (QA)</h1><p style="margin: 4px 0 0 0; color: #f43f5e; font-size: 14px; font-weight: bold;">النطاق: ${agencyTitle}</p></div>
              <div style="text-align: left;"><p style="margin: 0; color: #475569; font-size: 12px; font-weight: bold;">المطبخ المركزي</p><p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 10px;">تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p></div>
            </div>
            <div style="background: #fff1f2; padding: 10px 15px; border-radius: 8px; border: 1px solid #fecdd3; margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; font-weight: bold; color: #881337;">
              <div style="background: white; border: 1px solid #fecdd3; padding: 5px 12px; border-radius: 6px;">الفرع المختار: <span style="color: #e11d48; font-weight: 900;">${branchText}</span></div>
              <div style="background: white; border: 1px solid #fecdd3; padding: 5px 12px; border-radius: 6px;">حالة الصلاحية: <span style="color: #e11d48; font-weight: 900;">${statusTextFiltered}</span></div>
            </div>
            <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f43f5e; color: #ffffff;">
                  <th style="${getColStyle(pdfSettings.c_seq)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">ت</th>
                  ${hasAgencyCol ? `<th style="${getColStyle(pdfSettings.c_agency)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">الوكالة</th>` : ''}
                  <th style="${getColStyle(pdfSettings.c_branch)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">الفرع</th>
                  <th style="${getColStyle(pdfSettings.c_item)} text-align: right; border: 1px solid #cbd5e1; font-size: 14px; padding-right: 8px !important; white-space: nowrap !important;">المادة / الصنف</th>
                  <th style="${getColStyle(pdfSettings.c_storage)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">الحفظ</th>
                  <th style="${getColStyle(pdfSettings.c_qty)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">الكمية</th>
                  <th style="${getColStyle(pdfSettings.c_unit)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">الوحدة</th>
                  <th style="${getColStyle(pdfSettings.c_odate)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">تاريخ التجهيز</th>
                  <th style="${getColStyle(pdfSettings.c_shelf)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">الصلاحية</th>
                  <th style="${getColStyle(pdfSettings.c_edate)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">الانتهاء</th>
                  <th style="${getColStyle(pdfSettings.c_status)} text-align: center; border: 1px solid #cbd5e1; font-size: 14px; white-space: nowrap !important;">الحالة</th>
                </tr>
              </thead>
              <tbody>${trRows}</tbody>
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

  if (dbError) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <div className="p-6 text-center min-h-screen pb-[130px] flex items-center justify-center bg-slate-50 dark:bg-[#050505] transition-colors duration-300">
          <div className="bg-white dark:bg-[#121214] shadow-sm p-6 rounded-2xl border border-rose-200 dark:border-rose-500/20 text-rose-500 font-bold max-w-lg mx-auto">
            <AlertCircle className="w-10 h-10 mx-auto mb-3" />
            <p>{dbError}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isMounted) return null;

  let globalTrackingIdx = 0;
  let globalMasterIdx = 0;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`flex flex-col min-h-screen overflow-hidden font-sans relative transition-colors duration-300 ease-in-out pb-[130px] ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white'}`} dir="rtl">
        
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-100/50 dark:from-rose-900/20 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-colors duration-300 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <header className={`shrink-0 flex flex-col border-b z-30 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl shadow-sm border-slate-200 dark:border-white/5 transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 border-none' : 'scale-y-100 opacity-100'}`}>
          <div className="h-16 px-4 md:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg shadow-sm dark:shadow-inner border border-rose-200 dark:border-rose-500/20 transition-colors"><ShieldAlert className="w-5 h-5" /></div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-800 dark:text-white transition-colors">متابعة الصلاحيات <span className="text-rose-600 dark:text-rose-400">(QA)</span></h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="p-2 rounded-lg outline-none cursor-pointer active:scale-95 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap" title="تغيير المظهر">
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <div className="w-px h-6 mx-1 bg-slate-200 dark:bg-white/10 transition-colors"></div>
              
              {activeMainTab === 'tracking' && (
                <>
                  <button onClick={() => setShowPdfSettings(!showPdfSettings)} className={`p-2 rounded-lg outline-none cursor-pointer active:scale-95 transition-colors whitespace-nowrap ${showPdfSettings ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white'}`} title="إعدادات الطباعة">
                    <Settings className={`w-5 h-5 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} />
                  </button>
                  <button onClick={handleExportPDF} disabled={isExportingPDF} className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[13px] outline-none cursor-pointer active:scale-95 disabled:opacity-50 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap">
                    {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4" />} طباعة
                  </button>
                  <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[13px] outline-none cursor-pointer active:scale-95 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap">
                    <FileSpreadsheet className="w-4 h-4" /> إكسل
                  </button>
                </>
              )}
              <button onClick={() => setIsZenMode(true)} className="p-2 rounded-lg outline-none cursor-pointer active:scale-95 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap" title="وضع التركيز">
                <Eye className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="px-4 md:px-6 pt-2 pb-3">
             <div className="flex bg-slate-100 dark:bg-[#050505] p-1.5 rounded-2xl w-fit shadow-inner border border-slate-200 dark:border-white/5 transition-colors">
               <button 
                 onClick={() => setActiveMainTab('tracking')} 
                 className={`px-5 py-2.5 rounded-xl font-black text-[14px] flex items-center gap-2 outline-none cursor-pointer transition-colors active:scale-95 whitespace-nowrap ${activeMainTab === 'tracking' ? 'bg-white dark:bg-[#121214] text-rose-600 dark:text-rose-400 shadow-sm border border-slate-200 dark:border-white/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5'}`}
               >
                 <Activity className="w-4 h-4" /> تتبع الفروع
               </button>
               <button 
                 onClick={() => setActiveMainTab('master_data')} 
                 className={`px-5 py-2.5 rounded-xl font-black text-[14px] flex items-center gap-2 outline-none cursor-pointer transition-colors active:scale-95 whitespace-nowrap ${activeMainTab === 'master_data' ? 'bg-white dark:bg-[#121214] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-white/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5'}`}
               >
                 <Database className="w-4 h-4" /> أعمار المواد وطرق الحفظ
               </button>
             </div>
          </div>
        </header>

        {showPdfSettings && !isZenMode && activeMainTab === 'tracking' && (
          <div className="shrink-0 p-5 border-b bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner z-20 animate-in slide-in-from-top-2 transition-colors duration-300">
             <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[14px] font-black text-rose-600 dark:text-rose-400 flex items-center gap-2 transition-colors"><Settings className="w-4 h-4"/> إعدادات الطباعة المتقدمة</span>
                  <button onClick={resetPdfSettings} className="text-[12px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg border outline-none cursor-pointer active:scale-95 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-50 dark:bg-[#050505] border-slate-200 dark:border-white/10 transition-colors whitespace-nowrap">
                    <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 items-end">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 transition-colors">حجم الورق</label>
                    <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="border font-bold text-[13px] px-3 py-2 rounded-lg outline-none cursor-pointer appearance-none bg-white dark:bg-[#050505] border-slate-200 dark:border-white/10 text-slate-800 dark:text-white transition-colors shadow-sm dark:shadow-inner">
                      <option value="A3" className="bg-white dark:bg-[#121214]">A3 (أفضل للأعمدة الكثيرة)</option><option value="A4" className="bg-white dark:bg-[#121214]">A4 (ورق قياسي)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 transition-colors">الهوامش</label>
                    <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="border font-bold text-[13px] px-3 py-2 rounded-lg outline-none cursor-pointer appearance-none bg-white dark:bg-[#050505] border-slate-200 dark:border-white/10 text-slate-800 dark:text-white transition-colors shadow-sm dark:shadow-inner">
                      <option value="0mm" className="bg-white dark:bg-[#121214]">بدون</option><option value="2mm" className="bg-white dark:bg-[#121214]">ضيقة جداً</option><option value="5mm" className="bg-white dark:bg-[#121214]">ضيقة</option><option value="10mm" className="bg-white dark:bg-[#121214]">عادية</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                     <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border text-[13px] font-black outline-none cursor-pointer active:scale-95 transition-colors whitespace-nowrap ${pdfSettings.autoFit ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' : 'bg-slate-50 dark:bg-[#050505] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'}`}>
                      <Maximize className="w-3.5 h-3.5" /> {pdfSettings.autoFit ? 'احتواء: تلقائي' : 'احتواء: يدوي'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1 lg:col-span-2">
                    <div className="flex justify-between items-center"><label className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 transition-colors">إزاحة أفقية</label><span className="text-[11px] font-black px-1.5 py-0.5 rounded border dir-ltr bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20 transition-colors shadow-sm dark:shadow-inner whitespace-nowrap">{pdfSettings.shiftX} mm</span></div>
                    <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-rose-500 h-1.5 rounded-lg appearance-none cursor-pointer mt-1 bg-slate-200 dark:bg-white/10" />
                  </div>
                </div>
             </div>
          </div>
        )}

        <main className={`flex-1 w-full overflow-y-auto custom-scrollbar flex flex-col relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : ''}`}>
          <div className={`flex-1 w-full max-w-[100rem] mx-auto flex flex-col gap-5 ${isZenMode ? '' : 'p-4 md:p-6'}`}>
            
            {/* 🔴 التبويب الأول: تتبع الفروع 🔴 */}
            {activeMainTab === 'tracking' && (
              <>
                <section className={`shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3 transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden' : 'scale-y-100 opacity-100'}`}>
                  <div className="p-5 rounded-2xl border flex items-center justify-between bg-white dark:bg-[#121214] border-slate-300 dark:border-white/10 shadow-sm dark:shadow-lg transition-colors">
                    <div><p className="text-[13px] font-bold mb-0.5 text-slate-500 dark:text-slate-400 transition-colors whitespace-nowrap">المواد المراقبة</p><h3 className="text-2xl font-black en-num text-slate-800 dark:text-white transition-colors">{stats.total}</h3></div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-500 shadow-sm dark:shadow-inner transition-colors"><PackageOpen className="w-6 h-6" /></div>
                  </div>
                  <div onClick={() => setStatusFilter('expired')} className={`p-5 rounded-2xl flex items-center justify-between cursor-pointer transition-colors shadow-sm dark:shadow-lg ${statusFilter === 'expired' ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-400 dark:border-rose-500/30 ring-1 ring-rose-300 dark:ring-rose-500/50' : 'bg-white dark:bg-[#121214] border border-slate-300 dark:border-white/10 hover:border-rose-400 dark:hover:border-rose-500/30'}`}>
                    <div><p className="text-[13px] font-bold mb-0.5 text-rose-600 dark:text-rose-400 transition-colors whitespace-nowrap">منتهية الصلاحية</p><h3 className="text-2xl font-black en-num text-rose-600 dark:text-rose-500 transition-colors">{stats.expired}</h3></div>
                    <div className="p-3 rounded-xl border bg-white dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-500 dark:text-rose-400 animate-pulse shadow-sm dark:shadow-inner transition-colors"><CalendarX className="w-6 h-6" /></div>
                  </div>
                  <div onClick={() => setStatusFilter('warning')} className={`p-5 rounded-2xl flex items-center justify-between cursor-pointer transition-colors shadow-sm dark:shadow-lg ${statusFilter === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-400 dark:border-amber-500/30 ring-1 ring-amber-300 dark:ring-amber-500/50' : 'bg-white dark:bg-[#121214] border border-slate-300 dark:border-white/10 hover:border-amber-400 dark:hover:border-amber-500/30'}`}>
                    <div><p className="text-[13px] font-bold mb-0.5 text-amber-600 dark:text-amber-400 transition-colors whitespace-nowrap">قاربت على الانتهاء</p><h3 className="text-2xl font-black en-num text-amber-600 dark:text-amber-500 transition-colors">{stats.warning}</h3></div>
                    <div className="p-3 rounded-xl border bg-white dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-500 dark:text-amber-400 shadow-sm dark:shadow-inner transition-colors"><AlertTriangle className="w-6 h-6" /></div>
                  </div>
                  <div onClick={() => setStatusFilter('valid')} className={`p-5 rounded-2xl flex items-center justify-between cursor-pointer transition-colors shadow-sm dark:shadow-lg ${statusFilter === 'valid' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400 dark:border-emerald-500/30 ring-1 ring-emerald-300 dark:ring-emerald-500/50' : 'bg-white dark:bg-[#121214] border border-slate-300 dark:border-white/10 hover:border-emerald-400 dark:hover:border-emerald-500/30'}`}>
                    <div><p className="text-[13px] font-bold mb-0.5 text-emerald-600 dark:text-emerald-400 transition-colors whitespace-nowrap">سارية وصالحة</p><h3 className="text-2xl font-black en-num text-emerald-600 dark:text-emerald-500 transition-colors">{stats.valid}</h3></div>
                    <div className="p-3 rounded-xl border bg-white dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-500 dark:text-emerald-400 shadow-sm dark:shadow-inner transition-colors"><CheckCircle2 className="w-6 h-6" /></div>
                  </div>
                </section>

                <section className={`shrink-0 flex flex-col gap-3 transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden' : 'scale-y-100 opacity-100'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setActiveAgencyTab('الكل')} className={`px-4 py-3 rounded-xl font-black text-[14px] flex items-center gap-1.5 outline-none border cursor-pointer active:scale-95 transition-colors whitespace-nowrap ${activeAgencyTab === 'الكل' ? 'bg-slate-800 dark:bg-indigo-600 text-white border-slate-700 dark:border-indigo-500 shadow-sm' : 'bg-white dark:bg-[#121214] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <Building2 className="w-5 h-5" /> كل الوكالات
                      </button>
                      {uniqueAgenciesList.map(agency => (
                        <button key={agency} onClick={() => setActiveAgencyTab(agency)} className={`px-4 py-3 rounded-xl font-black text-[14px] outline-none border cursor-pointer active:scale-95 transition-colors whitespace-nowrap ${activeAgencyTab === agency ? 'bg-rose-50 dark:bg-rose-600 text-rose-700 dark:text-white border-rose-300 dark:border-rose-500 shadow-sm' : 'bg-white dark:bg-[#121214] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                          {agency}
                        </button>
                      ))}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 rounded-[1.5rem] border bg-white dark:bg-[#121214] border-slate-300 dark:border-white/10 shadow-sm dark:shadow-lg transition-colors">
                      <div className="relative w-full flex items-center">
                        <Search className="absolute right-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                        <input type="text" placeholder="بحث عن مادة..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-14 border pl-4 pr-12 outline-none font-bold text-[15px] rounded-[1rem] bg-slate-50 dark:bg-[#050505] border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-indigo-500/50 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-inner transition-colors" />
                      </div>
                      
                      <div className="relative w-full flex items-center">
                        <Layers className="absolute right-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full h-14 border pl-4 pr-12 outline-none font-bold text-[15px] rounded-[1rem] appearance-none cursor-pointer bg-slate-50 dark:bg-[#050505] border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-indigo-500/50 dark:focus:border-indigo-500/50 shadow-sm dark:shadow-inner transition-colors">
                          <option value="الكل" className="bg-white dark:bg-[#121214]">كل الأقسام</option>
                          {dbCategories.map(cat => <option key={cat} value={cat} className="bg-white dark:bg-[#121214]">{cat}</option>)}
                        </select>
                        <ChevronDown className="absolute left-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                      </div>

                      <div className="relative w-full flex items-center">
                        <Store className="absolute right-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-full h-14 border pl-4 pr-12 outline-none font-bold text-[15px] rounded-[1rem] appearance-none cursor-pointer bg-slate-50 dark:bg-[#050505] border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-indigo-500/50 dark:focus:border-indigo-500/50 shadow-sm dark:shadow-inner transition-colors">
                          <option value="الكل" className="bg-white dark:bg-[#121214]">كل الفروع</option>
                          {dbBranches.map(b => <option key={b} value={b} className="bg-white dark:bg-[#121214]">{b}</option>)}
                        </select>
                        <ChevronDown className="absolute left-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                      </div>
                      <div className="relative w-full flex items-center gap-2">
                        <div className="relative flex-1 flex items-center">
                          <Filter className="absolute right-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full h-14 border pl-4 pr-12 outline-none font-bold text-[15px] rounded-[1rem] appearance-none cursor-pointer bg-slate-50 dark:bg-[#050505] border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-indigo-500/50 dark:focus:border-indigo-500/50 shadow-sm dark:shadow-inner transition-colors">
                            <option value="الكل" className="bg-white dark:bg-[#121214]">الحالة: الكل</option>
                            <option value="valid" className="bg-white dark:bg-[#121214]">صالحة 🟢</option>
                            <option value="warning" className="bg-white dark:bg-[#121214]">تحذير 🟠</option>
                            <option value="expired" className="bg-white dark:bg-[#121214]">منتهية 🔴</option>
                          </select>
                          <ChevronDown className="absolute left-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                        </div>
                        {(searchTerm || branchFilter !== 'الكل' || statusFilter !== 'الكل' || categoryFilter !== 'الكل' || activeAgencyTab !== 'الكل') && (
                          <button onClick={clearFilters} className="h-14 px-4 rounded-[1rem] border flex items-center justify-center outline-none shrink-0 cursor-pointer active:scale-95 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap" title="مسح الفلاتر"><RotateCcw className="w-5 h-5" /></button>
                        )}
                      </div>
                  </div>
                </section>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 w-full">
                    <Loader2 className="w-14 h-14 text-rose-500 dark:text-rose-400 animate-spin" />
                    <p className="text-slate-500 dark:text-slate-400 font-bold transition-colors text-[16px]">جاري تحميل السجلات...</p>
                  </div>
                ) : filteredTrackingItems.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-400 dark:border-white/20 bg-white/50 dark:bg-[#121214]/50 min-h-[300px] transition-colors duration-300">
                    <ShieldAlert className="w-24 h-24 mb-4 text-rose-200 dark:text-rose-500/30 transition-colors" />
                    <p className="text-3xl font-black mb-2 tracking-tight text-slate-800 dark:text-slate-200 transition-colors">لا توجد مواد مطابقة للبحث</p>
                    <p className="text-[16px] font-bold text-slate-500 dark:text-slate-400 transition-colors">تأكد من إعدادات الفلتر أو أنه تم استهلاك/أرشفة جميع المواد.</p>
                  </div>
                ) : (
                  <section className="flex-1 flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-300 dark:border-white/10 bg-white dark:bg-[#121214] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] min-h-[400px] transition-colors duration-300">
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                      <table className="w-full text-right border-collapse min-w-[1400px]">
                        <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-[#0a0a0c] backdrop-blur-md transition-colors duration-300">
                          <tr>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-16">ت</th>
                            {activeAgencyTab === 'الكل' && <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-32">الوكالة</th>}
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-48">الفرع</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-right font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap">المادة / الصنف</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-36">الحفظ</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-24">الكمية</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-24">الوحدة</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-40">تاريخ آخر تجهيز</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 whitespace-nowrap w-64">شريط الصلاحية المتبقية</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider sticky left-0 bg-slate-100 dark:bg-[#0a0a0c] z-20 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] dark:shadow-[-4px_0_10px_rgba(255,255,255,0.02)] whitespace-nowrap w-48">الحالة والإجراء</th>
                          </tr>
                        </thead>
                        <tbody className="transition-colors duration-300">
                          {groupedTrackingItems.map((group, gIdx) => (
                            <React.Fragment key={`group-${group.groupKey}`}>
                              <tr className="bg-slate-200/60 dark:bg-[#1a1a24] border-y-[3px] border-slate-300 dark:border-white/10">
                                <td colSpan={activeAgencyTab === 'الكل' ? 10 : 9} className="py-3.5 px-5 text-right whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full shadow-inner border-2 border-white/50 dark:border-black/50" style={{ backgroundColor: group.categoryColor }}></div>
                                    <span className="font-black text-[18px] text-slate-800 dark:text-white tracking-tight">
                                      {activeAgencyTab === 'الكل' ? `${group.agencyName} - ` : ''}{group.categoryName}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400 font-bold text-[14px] mr-2 bg-white/50 dark:bg-black/30 px-3 py-1 rounded-lg">
                                      {group.items.length} مواد
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              
                              {group.items.map((item, idx) => {
                                globalTrackingIdx++;
                                const isExpired = item.status === 'expired';
                                const isWarning = item.status === 'warning';
                                
                                const rowBg = isExpired 
                                    ? 'bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-500/5 dark:hover:bg-rose-500/10' 
                                    : 'bg-white hover:bg-slate-50 dark:bg-[#121214] dark:hover:bg-[#1a1a1f]';
                                    
                                let barColor = 'bg-emerald-500';
                                if (isExpired) barColor = 'bg-rose-500';
                                else if (item.progressPercent <= 20) barColor = 'bg-rose-500'; 
                                else if (item.progressPercent <= 50) barColor = 'bg-amber-500'; 

                                return (
                                  <tr key={item.uniqueId} className={`group/row transition-colors ${rowBg}`}>
                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center font-bold text-[15px] text-slate-600 dark:text-slate-400 transition-colors whitespace-nowrap">{globalTrackingIdx}</td>
                                    
                                    {activeAgencyTab === 'الكل' && (
                                      <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[16px] text-indigo-600 dark:text-indigo-400 transition-colors whitespace-nowrap">{item.agencyName}</td>
                                    )}
                                    
                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center font-black transition-colors whitespace-nowrap">
                                      <span className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border text-[15px] bg-slate-100 border-slate-300 text-slate-800 dark:bg-[#050505] dark:border-white/10 dark:text-slate-300 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap">
                                        <Store className="w-4 h-4 text-slate-500 dark:text-slate-400" /> {item.branchName}
                                      </span>
                                    </td>
                                    
                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-right transition-colors whitespace-nowrap">
                                      <div className="font-black text-[18px] text-slate-900 dark:text-white leading-tight">{item.itemName}</div>
                                    </td>

                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center transition-colors whitespace-nowrap">
                                      <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white dark:bg-[#050505] border-slate-300 dark:border-white/10 text-[14px] font-bold text-slate-700 dark:text-slate-400 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap">
                                        {getStorageIcon(item.storageMethod)} {item.storageMethod}
                                      </span>
                                    </td>
                                    
                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center transition-colors whitespace-nowrap">
                                      <span className="text-[15px] font-black px-3 py-1.5 rounded-lg border en-num text-emerald-700 bg-emerald-50 border-emerald-300 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap">
                                        {item.quantity}
                                      </span>
                                    </td>

                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center transition-colors whitespace-nowrap">
                                      <span className="text-[14px] font-black px-3 py-1.5 rounded-lg border bg-slate-100 border-slate-300 text-slate-700 dark:bg-[#050505] dark:border-white/10 dark:text-slate-300 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap">
                                        {item.mainUnit}
                                      </span>
                                    </td>

                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center transition-colors whitespace-nowrap">
                                      <span className="text-[15px] font-bold en-num dir-ltr text-slate-600 dark:text-slate-400 transition-colors">
                                        {dayjs(item.orderDate).format('YYYY-MM-DD')}
                                      </span>
                                    </td>
                                    
                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center transition-colors min-w-[250px] whitespace-nowrap">
                                      <div className="flex flex-col gap-2 w-full px-2">
                                        <div className="flex justify-between items-center text-[13px] font-black">
                                          <span className="text-slate-600 dark:text-slate-400">إجمالي الأيام المعتمدة: {item.shelfLifeDays}</span>
                                          <span className={isExpired ? 'text-rose-600 dark:text-rose-400' : isWarning ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                            {isExpired ? 'منتهي' : `المتبقي: ${item.daysRemaining}`}
                                          </span>
                                        </div>
                                        <div className="w-full h-3.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden shadow-inner">
                                          <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${barColor}`} 
                                            style={{ width: `${item.progressPercent}%` }}
                                          ></div>
                                        </div>
                                      </div>
                                    </td>
                                    
                                    <td className={`py-5 px-4 border border-slate-300 dark:border-white/10 text-center sticky left-0 z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.03)] dark:shadow-[-4px_0_15px_rgba(255,255,255,0.02)] transition-colors whitespace-nowrap ${isExpired ? 'bg-rose-50/90 dark:bg-[#1a0f12]' : 'bg-white dark:bg-[#121214]'}`}>
                                      <div className="flex items-center justify-center gap-3">
                                        {isExpired && (
                                          <div className="flex items-center justify-center gap-1.5 font-black px-3 py-1.5 rounded-lg border text-[14px] text-rose-700 bg-white border-rose-300 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/30 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap">
                                            <CalendarX className="w-4 h-4" /> تجاوز بـ {Math.abs(item.daysRemaining)} يوم
                                          </div>
                                        )}
                                        {isWarning && (
                                          <div className="flex items-center justify-center gap-1.5 font-black px-3 py-1.5 rounded-lg border text-[14px] text-amber-700 bg-white border-amber-300 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap">
                                            <AlertTriangle className="w-4 h-4 animate-pulse" /> تحذير
                                          </div>
                                        )}
                                        {!isExpired && !isWarning && (
                                          <div className="flex items-center justify-center gap-1.5 font-bold px-3 py-1.5 rounded-lg border text-[14px] text-emerald-700 bg-white border-emerald-300 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/30 shadow-sm dark:shadow-inner transition-colors whitespace-nowrap">
                                            <Clock className="w-4 h-4" /> ساري
                                          </div>
                                        )}

                                        <button 
                                          onClick={() => handleDismissItem(item.uniqueId)}
                                          title="تأشير كـ مستهلك (إخفاء المادة)"
                                          className="p-2 rounded-lg outline-none border shrink-0 bg-slate-100 border-slate-300 text-slate-500 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-600 dark:bg-[#050505] dark:border-white/10 dark:text-slate-400 dark:hover:bg-emerald-500/20 dark:hover:border-emerald-500/50 dark:hover:text-emerald-400 cursor-pointer active:scale-95 transition-all shadow-sm"
                                        >
                                          <CheckSquare className="w-5 h-5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}

            {/* 🔴 التبويب الثاني: إعدادات أعمار المواد (الماستر) 🔴 */}
            {activeMainTab === 'master_data' && (
              <>
                <section className="shrink-0 flex flex-col gap-3 transition-all duration-500 origin-top">
                   <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setActiveAgencyTab('الكل')} className={`px-4 py-3 rounded-xl font-black text-[14px] flex items-center gap-1.5 outline-none border cursor-pointer active:scale-95 transition-colors whitespace-nowrap ${activeAgencyTab === 'الكل' ? 'bg-indigo-600 text-white border-indigo-500 shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-white dark:bg-[#121214] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <Building2 className="w-5 h-5" /> كل الوكالات
                      </button>
                      {uniqueAgenciesList.map(agency => (
                        <button key={agency} onClick={() => setActiveAgencyTab(agency)} className={`px-4 py-3 rounded-xl font-black text-[14px] outline-none border cursor-pointer active:scale-95 transition-colors whitespace-nowrap ${activeAgencyTab === agency ? 'bg-indigo-600 text-white border-indigo-500 shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'bg-white dark:bg-[#121214] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                          {agency}
                        </button>
                      ))}
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-[1.5rem] border bg-white dark:bg-[#121214] border-slate-300 dark:border-white/10 shadow-sm dark:shadow-lg transition-colors">
                      <div className="relative w-full flex items-center">
                        <Search className="absolute right-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                        <input type="text" placeholder="بحث باسم المادة..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-14 border pl-4 pr-12 outline-none font-bold text-[15px] rounded-[1rem] bg-slate-50 dark:bg-[#050505] border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-indigo-500/50 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm dark:shadow-inner transition-colors" />
                      </div>
                      
                      <div className="relative w-full flex items-center">
                        <Layers className="absolute right-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full h-14 border pl-4 pr-12 outline-none font-bold text-[15px] rounded-[1rem] appearance-none cursor-pointer bg-slate-50 dark:bg-[#050505] border-slate-300 dark:border-white/10 text-slate-800 dark:text-white focus:border-indigo-500/50 dark:focus:border-indigo-500/50 shadow-sm dark:shadow-inner transition-colors">
                          <option value="الكل" className="bg-white dark:bg-[#121214]">كل الأقسام</option>
                          {dbCategories.map(cat => <option key={cat} value={cat} className="bg-white dark:bg-[#121214]">{cat}</option>)}
                        </select>
                        <ChevronDown className="absolute left-4 w-5 h-5 text-slate-500 dark:text-slate-400 pointer-events-none transition-colors" />
                      </div>

                      <div className="flex justify-end items-center px-3">
                         <div className="text-[14px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 whitespace-nowrap">
                           <CheckCircle2 className="w-6 h-6 text-emerald-500"/> أي تعديل يتم حفظه وتطبيقه فوراً.
                         </div>
                      </div>
                   </div>
                </section>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 w-full">
                    <Loader2 className="w-14 h-14 text-indigo-500 dark:text-indigo-400 animate-spin" />
                    <p className="text-slate-500 dark:text-slate-400 font-bold transition-colors text-[16px]">جاري تحميل المواد...</p>
                  </div>
                ) : filteredMasterItems.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-400 dark:border-white/20 bg-white/50 dark:bg-[#121214]/50 min-h-[300px] transition-colors duration-300">
                    <Database className="w-24 h-24 mb-4 text-indigo-200 dark:text-indigo-500/30 transition-colors" />
                    <p className="text-3xl font-black mb-2 tracking-tight text-slate-800 dark:text-slate-200 transition-colors">لا توجد مواد مطابقة</p>
                  </div>
                ) : (
                  <section className="flex-1 flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-300 dark:border-white/10 bg-white dark:bg-[#121214] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] min-h-[400px] transition-colors duration-300">
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                      <table className="w-full text-right border-collapse min-w-[1000px]">
                        <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-[#0a0a0c] backdrop-blur-md transition-colors duration-300">
                          <tr>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-16">ت</th>
                            {activeAgencyTab === 'الكل' && <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-40">الوكالة</th>}
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-right font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap">اسم المادة</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-32">الوحدة</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-slate-600 dark:text-slate-400 whitespace-nowrap w-48">طريقة الحفظ</th>
                            <th className="py-4 px-4 border border-slate-300 dark:border-white/10 text-center font-black text-[14px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 whitespace-nowrap w-56 bg-indigo-50/50 dark:bg-indigo-900/10">مدة الصلاحية (أيام)</th>
                          </tr>
                        </thead>
                        <tbody className="transition-colors duration-300">
                          {groupedMasterItems.map((group, gIdx) => (
                            <React.Fragment key={`group-master-${group.groupKey}`}>
                              <tr className="bg-slate-200/60 dark:bg-[#1a1a24] border-y-[3px] border-slate-300 dark:border-white/10">
                                <td colSpan={activeAgencyTab === 'الكل' ? 6 : 5} className="py-3.5 px-5 text-right whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full shadow-inner border-2 border-white/50 dark:border-black/50" style={{ backgroundColor: group.categoryColor }}></div>
                                    <span className="font-black text-[18px] text-slate-800 dark:text-white tracking-tight">
                                      {activeAgencyTab === 'الكل' ? `${group.agencyName} - ` : ''}{group.categoryName}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400 font-bold text-[14px] mr-2 bg-white/50 dark:bg-black/30 px-3 py-1 rounded-lg">
                                      {group.items.length} مواد
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              
                              {group.items.map((item, idx) => {
                                 globalMasterIdx++;
                                 const localMod = modifiedSettings[item.id];
                                 const currentShelfLife = localMod !== undefined ? localMod.shelfLife : item.shelfLifeDays;
                                 const currentStorage = localMod !== undefined ? localMod.storageMethod : item.storageMethod;
                                 
                                 const displayValue = currentShelfLife === '' ? '' : currentShelfLife;
                                 const isModified = localMod !== undefined;

                                 return (
                                  <tr key={item.id} className="hover:bg-slate-50 dark:bg-transparent hover:dark:bg-[#1a1a1f] transition-colors">
                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center font-bold text-[15px] text-slate-600 dark:text-slate-400 transition-colors whitespace-nowrap">{globalMasterIdx}</td>
                                    
                                    {activeAgencyTab === 'الكل' && (
                                      <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center font-black whitespace-nowrap text-[16px] text-slate-800 dark:text-slate-300 transition-colors">{item.agencyName}</td>
                                    )}
                                    
                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-right transition-colors whitespace-nowrap">
                                      <div className="font-black text-[18px] text-slate-900 dark:text-white leading-tight">{item.name}</div>
                                    </td>
                                    
                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center transition-colors whitespace-nowrap">
                                      <span className="text-[14px] font-black px-3 py-1.5 rounded-lg border bg-slate-100 border-slate-300 text-slate-700 dark:bg-[#050505] dark:border-white/10 dark:text-slate-300 shadow-sm dark:shadow-inner transition-colors">
                                        {item.mainUnit}
                                      </span>
                                    </td>

                                    <td className="py-5 px-4 border border-slate-300 dark:border-white/10 text-center transition-colors whitespace-nowrap">
                                      <div className="relative w-full max-w-[160px] mx-auto">
                                        <select 
                                          value={currentStorage}
                                          onChange={(e) => handleSettingChange(item.id, 'storageMethod', e.target.value)}
                                          className={`w-full h-12 border outline-none font-bold text-[15px] pl-4 pr-10 rounded-xl appearance-none cursor-pointer shadow-sm focus:ring-2 ${isModified && localMod.storageMethod !== item.storageMethod ? 'bg-amber-50 border-amber-400 text-amber-700 focus:border-amber-500 focus:ring-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400' : 'bg-white border-slate-300 text-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20 dark:bg-[#050505] dark:border-white/10 dark:text-slate-300'}`}
                                        >
                                          <option value="غير محدد">غير محدد</option>
                                          <option value="جاف">📦 جاف</option>
                                          <option value="مبرد">🧊 مبرد (ثلاجة)</option>
                                          <option value="مجمد">❄️ مجمد (فريزر)</option>
                                        </select>
                                        <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                      </div>
                                    </td>
                                    
                                    <td className="py-3 px-4 border border-slate-300 dark:border-white/10 text-center bg-indigo-50/30 dark:bg-indigo-900/5 transition-colors whitespace-nowrap">
                                      <div className="relative max-w-[140px] mx-auto">
                                        <input 
                                          type="text" 
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          value={displayValue}
                                          placeholder="بدون"
                                          title="اترك الحقل فارغاً للمواد الدائمية (بدون صلاحية)"
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^[0-9]+$/.test(val)) {
                                              handleSettingChange(item.id, 'shelfLife', val === '' ? '' : Number(val));
                                            }
                                          }}
                                          className={`w-full h-12 border outline-none font-black text-[18px] rounded-xl text-center en-num transition-all shadow-sm focus:ring-2 ${isModified && localMod?.shelfLife !== item.shelfLifeDays ? 'bg-amber-50 border-amber-400 text-amber-700 focus:border-amber-500 focus:ring-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400' : 'bg-white border-slate-300 text-indigo-700 focus:border-indigo-500 focus:ring-indigo-500/20 dark:bg-[#050505] dark:border-white/10 dark:text-indigo-400'} placeholder:text-slate-400 dark:placeholder:text-slate-600 placeholder:text-[14px] placeholder:font-bold`}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                 );
                              })}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}
            
          </div>
        </main>

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
          
          .en-num { font-family: system-ui, -apple-system, sans-serif; }
        `}} />
      </div>
    </div>
  );
}