"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  Building2, PackageOpen, Leaf, Box, ArrowLeftRight, 
  Layers, Loader2, Calendar, Info, FileText, FileSpreadsheet, DollarSign, Filter,
  Settings, MoveHorizontal, Maximize, RefreshCw, AlertCircle, CheckCircle2, PieChart,
  LayoutGrid, RotateCcw, Eye, EyeOff, ChevronRight, ChevronLeft, CalendarDays,
  Flame, Store
} from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx-js-style';
import 'dayjs/locale/ar';

dayjs.locale('ar');

interface Recipe {
  id: string;
  name: string;
  agency_id: string | null;
  category_id: string | null;
  item_id: string | null;
  ingredients: any[];
  packaging_materials: any[];
  batch_weight: number;
  batch_unit: string;
  piece_weight: number;
  piece_unit: string;
}

const formatIQD = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 0
  }).format(Math.round(val || 0));
};

const formatIQDNum = (val: number) => Math.round(val || 0);

const formatQty = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 3
  }).format(val || 0);
}; 

const formatOrder = (val: number) => Number((val || 0).toFixed(2)).toLocaleString('en-US'); 

const toBaseUnit = (qty: number, unit: string) => {
  if (!unit) return qty;
  const u = unit.trim().toLowerCase();
  if (['كغم', 'كيلو', 'kg', 'kilo', 'kilogram', 'كيلوغرام', 'كيلو غرام', 'كغ'].includes(u)) return qty * 1000;
  if (['لتر', 'l', 'liter', 'litre'].includes(u)) return qty * 1000;
  return qty; 
};

const getBaseUnitCost = (dbMat: any) => {
  if (!dbMat || !dbMat.unit_cost) return 0;
  const cost = Number(dbMat.unit_cost);
  const u = (dbMat.unit || '').trim().toLowerCase();
  
  if (['كغم', 'كيلو', 'kg', 'kilo', 'kilogram', 'كيلوغرام', 'كيلو غرام', 'كغ'].includes(u)) return cost / 1000; 
  if (['لتر', 'l', 'liter', 'litre'].includes(u)) return cost / 1000; 
  return cost; 
};

const formatSmartDisplay = (baseQty: number, originalUnitType: string) => {
  const u = (originalUnitType || '').trim().toLowerCase();
  const isWeight = ['غرام', 'كغم', 'كيلو', 'kg', 'g', 'gram', 'gm', 'kilogram', 'كيلوغرام', 'كيلو غرام', 'كغ'].includes(u);
  const isVolume = ['مل', 'لتر', 'l', 'ml', 'liter', 'litre'].includes(u);

  if (isWeight && baseQty >= 1000) return { qty: baseQty / 1000, unit: 'كغم' };
  if (isWeight) return { qty: baseQty, unit: 'غرام' };

  if (isVolume && baseQty >= 1000) return { qty: baseQty / 1000, unit: 'لتر' };
  if (isVolume) return { qty: baseQty, unit: 'مل' };

  return { qty: baseQty, unit: originalUnitType || 'قطعة' };
};

const defaultPdfSettings = {
  paperSize: 'A4',
  margin: '10mm',
  zoom: 90,
  shiftX: 0,
  autoFit: false,
  colRecipe: 30,
  colAgency: 25,
  colOrders: 15,
  colQty: 15,
  colCost: 15
};

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
type PickerTarget = 'startDate' | 'endDate' | 'selectMonth';

export default function MaterialsTrackingPage() {
  const { isDark } = useTheme(); 
  const [isZenMode, setIsZenMode] = useState(false);
  
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [dbMaterials, setDbMaterials] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedMaterialType, setSelectedMaterialType] = useState<'raw' | 'packaging'>('raw');
  const [startDate, setStartDate] = useState<string>(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [orders, setOrders] = useState<any[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  const [filterAgency, setFilterAgency] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMaterial, setFilterMaterial] = useState<string>('all');

  const [isExporting, setIsExporting] = useState(false);

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, target: PickerTarget, viewDate: dayjs.Dayjs, mode: 'date' | 'month' | 'year'
  }>({ isOpen: false, target: 'startDate', viewDate: dayjs(), mode: 'date' });

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('materialsTrackingPdfSettings_v1');
    if (savedSettings) {
      try { setPdfSettings(JSON.parse(savedSettings)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('materialsTrackingPdfSettings_v1', JSON.stringify(pdfSettings));
    }
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => {
    setPdfSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetPdfSettings = () => {
    setPdfSettings(defaultPdfSettings);
  };

  const clearFilters = () => {
    setStartDate(dayjs().startOf('month').format('YYYY-MM-DD'));
    setEndDate(dayjs().format('YYYY-MM-DD'));
    setFilterAgency('all');
    setFilterCategory('all');
    setFilterMaterial('all');
    setSelectedMaterialType('raw');
  };

  useEffect(() => {
    setFilterMaterial('all');
  }, [selectedMaterialType]);

  useEffect(() => {
    const fetchBaseData = async () => {
      setIsLoading(true);
      try {
        const fetchAll = async (tableName: string) => {
          const { data } = await supabase.from(tableName).select('*');
          return data || [];
        };

        const [recData, agData, catData, rawMats, packMats] = await Promise.all([
          fetchAll('recipes'),
          fetchAll('agencies'),
          fetchAll('categories'),
          supabase.from('raw_materials').select('name, unit_cost, unit').order('name', { ascending: true }).then(r => r.data || []),
          supabase.from('packaging_materials').select('name, unit_cost, unit').order('name', { ascending: true }).then(r => r.data || [])
        ]);
        
        const getOrderVal = (obj: any) => {
          if (!obj) return 0;
          const keys = ['sort_order', 'order_index', 'order', 'seq', 'sequence', 'display_order', 'arrangement'];
          for (let k of keys) {
            if (obj[k] !== undefined && obj[k] !== null) return Number(obj[k]);
          }
          return Number(obj.id) || 0; 
        };

        const sortByOrder = (a: any, b: any) => getOrderVal(a) - getOrderVal(b);

        setRecipes(recData || []);
        setAgencies((agData || []).sort(sortByOrder));
        setCategories((catData || []).sort(sortByOrder));
        setDbMaterials([...(rawMats || []), ...(packMats || [])]);
      } catch (error) {
        console.error("Error fetching base data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBaseData();
  }, []);

  useEffect(() => {
    const fetchOrders = async () => {
      setIsOrdersLoading(true);
      try {
        const startQuery = dayjs(startDate).startOf('day').toISOString();
        const endQuery = dayjs(endDate).endOf('day').toISOString();
        
        const { data, error } = await supabase
          .from('orders')
          .select(`id, status, order_details ( item_id, quantity )`)
          .gte('created_at', startQuery)
          .lte('created_at', endQuery)
          .neq('status', 'rejected');
        
        if (!error) setOrders(data || []);
      } catch (err) {
        console.error("Error fetching orders:", err);
      } finally {
        setIsOrdersLoading(false);
      }
    };
    fetchOrders();
  }, [startDate, endDate]);

  const actualItemDemand = useMemo(() => {
    const demand: Record<string, number> = {};
    orders.forEach(order => {
      order.order_details?.forEach((detail: any) => {
        if (detail.item_id) {
          demand[detail.item_id] = (demand[detail.item_id] || 0) + (Number(detail.quantity) || 0);
        }
      });
    });
    Object.keys(demand).forEach(k => { demand[k] = Number(demand[k].toFixed(3)); });
    return demand;
  }, [orders]);

  const actualMaterialUsage = useMemo(() => {
    const usageMap = new Map();

    const addUsage = (materialName: string, recipeUnit: string, recipeQty: number, recipeName: string, agencyName: string, catName: string, requestedPieces: number) => {
      if (!usageMap.has(materialName)) {
        const dbMat = dbMaterials.find(m => m.name === materialName);
        usageMap.set(materialName, { 
          materialName, 
          dbUnitType: dbMat?.unit || recipeUnit || 'غرام', 
          baseUnitCost: getBaseUnitCost(dbMat), 
          totalBaseConsumed: 0, 
          usages: [],
          hasPriceError: !dbMat || !dbMat.unit_cost
        });
      }
      
      const record = usageMap.get(materialName);
      const qtyInBaseUnit = toBaseUnit(recipeQty, recipeUnit);
      
      record.totalBaseConsumed += qtyInBaseUnit;
      const thisExpenseCost = qtyInBaseUnit * record.baseUnitCost;

      const existingUsage = record.usages.find((u: any) => u.recipe_name === recipeName && u.agency_name === agencyName && u.category_name === catName);
      if (existingUsage) {
        existingUsage.base_expense += qtyInBaseUnit; 
        existingUsage.financial_cost += thisExpenseCost; 
        existingUsage.requested_pieces += requestedPieces;
      } else {
        record.usages.push({
          recipe_name: recipeName,
          agency_name: agencyName,
          category_name: catName,
          requested_pieces: requestedPieces, 
          base_expense: qtyInBaseUnit, 
          financial_cost: thisExpenseCost
        });
      }
    };

    const processRecipe = (recipe: Recipe, multiplier: number, topRecipeName: string, agencyName: string, catName: string, originalPieces: number, isPackaging = false) => {
      const targetArray = isPackaging ? recipe.packaging_materials : recipe.ingredients;
      if (!targetArray) return;

      targetArray.forEach(ing => {
        const requiredQty = (Number(ing.perUnitQty) || 0) * multiplier;
        if (requiredQty <= 0) return;
        
        if (isPackaging) {
           if (ing.name) addUsage(ing.name, ing.unit, requiredQty, topRecipeName, agencyName, catName, originalPieces);
        } else {
          if (ing.type === 'raw' && ing.name) {
            addUsage(ing.name, ing.unit, requiredQty, topRecipeName, agencyName, catName, originalPieces);
          } else if (ing.type === 'sub_recipe' && ing.sub_recipe_id) {
            const subRecipe = recipes.find(r => String(r.id) === String(ing.sub_recipe_id));
            if (subRecipe) {
              const requestedBase = toBaseUnit(requiredQty, ing.unit);
              let subRecipeBatchBase = toBaseUnit(Number(subRecipe.batch_weight) || 1, subRecipe.batch_unit || 'غرام');
              
              if ((ing.unit || '').trim().toLowerCase() === 'قطعة') {
                 const pieceWeightBase = toBaseUnit(Number(subRecipe.piece_weight) || 1, subRecipe.piece_unit || 'غرام');
                 const totalPiecesInBatch = subRecipeBatchBase / pieceWeightBase;
                 subRecipeBatchBase = totalPiecesInBatch > 0 ? totalPiecesInBatch : 1;
              }

              const subMultiplier = subRecipeBatchBase ? (requestedBase / subRecipeBatchBase) : 0;
              processRecipe(subRecipe, subMultiplier, topRecipeName, agencyName, catName, originalPieces, false);
            }
          }
        }
      });
    };

    Object.entries(actualItemDemand).forEach(([itemId, orderedQty]) => {
      if (orderedQty <= 0) return;
      const topRecipe = recipes.find(r => String(r.item_id) === String(itemId));
      if (topRecipe) {
        const agencyName = agencies.find(a => String(a.id) === String(topRecipe.agency_id))?.name || 'مادة عامة';
        const catName = categories.find(c => String(c.id) === String(topRecipe.category_id))?.name || 'غير محدد';
        
        if (selectedMaterialType === 'raw') {
          processRecipe(topRecipe, orderedQty, topRecipe.name, agencyName, catName, orderedQty, false);
        } else {
          processRecipe(topRecipe, orderedQty, topRecipe.name, agencyName, catName, orderedQty, true);
        }
      }
    });

    return Array.from(usageMap.values());
  }, [actualItemDemand, recipes, selectedMaterialType, agencies, categories, dbMaterials]);

  const filterOptions = useMemo(() => {
    const agSet = new Set<string>();
    const catSet = new Set<string>();
    const matSet = new Set<string>();

    actualMaterialUsage.forEach(mat => {
      matSet.add(mat.materialName);
      mat.usages.forEach((u: any) => {
        agSet.add(u.agency_name);
        catSet.add(u.category_name);
      });
    });

    const sortedAgencies = agencies.map(a => a.name).filter(n => agSet.has(n));
    if (agSet.has('مادة عامة')) sortedAgencies.push('مادة عامة');

    const sortedCategories = categories.map(c => c.name).filter(n => catSet.has(n));
    if (catSet.has('غير محدد')) sortedCategories.push('غير محدد');

    return {
      agencies: sortedAgencies,
      categories: sortedCategories,
      materials: Array.from(matSet).sort()
    };
  }, [actualMaterialUsage, agencies, categories]);

  const filteredMaterialUsage = useMemo(() => {
    let mats = actualMaterialUsage.map(mat => {
      const fUsages = mat.usages.filter((u: any) => {
         const matchAg = filterAgency === 'all' || u.agency_name === filterAgency;
         const matchCat = filterCategory === 'all' || u.category_name === filterCategory;
         return matchAg && matchCat;
      });
      return {
        ...mat,
        usages: fUsages,
        totalBaseConsumed: fUsages.reduce((sum: number, u: any) => sum + u.base_expense, 0),
        totalFinancialCost: fUsages.reduce((sum: number, u: any) => sum + u.financial_cost, 0),
      };
    });

    mats = mats.filter(mat => {
       const matchMat = filterMaterial === 'all' || mat.materialName === filterMaterial;
       return mat.usages.length > 0 && matchMat;
    });

    return mats.sort((a, b) => b.totalFinancialCost - a.totalFinancialCost);
  }, [actualMaterialUsage, filterAgency, filterCategory, filterMaterial]);

  const grandTotalFilteredCost = filteredMaterialUsage.reduce((sum, mat) => sum + mat.totalFinancialCost, 0);

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

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };

      const applyStyles = (ws: any, highlightCols: number[]) => {
        ws['!dir'] = 'rtl'; 
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
            if (!ws[cellAddress]) continue;
            const isHeader = R === 0;
            const isHighlight = highlightCols.includes(C);
            
            let font = { sz: 11, color: { rgb: "334155" }, bold: false, name: 'Arial' };
            let fill = { fgColor: { rgb: "FFFFFF" } };
            
            if (isHeader) {
              fill = { fgColor: { rgb: "0F172A" } }; font = { color: { rgb: "FFFFFF" }, bold: true, sz: 12, name: 'Arial' };
            } else if (isHighlight) {
              fill = { fgColor: { rgb: "ECFDF5" } }; font = { color: { rgb: "059669" }, bold: true, sz: 11, name: 'Arial' };
            }

            ws[cellAddress].s = {
              font: font, fill: fill,
              alignment: { horizontal: "center", vertical: "center", wrapText: true },
              border: { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } }, left: { style: "thin", color: { rgb: "CBD5E1" } }, right: { style: "thin", color: { rgb: "CBD5E1" } } }
            };
            if (typeof ws[cellAddress].v === 'number' && !isHeader) {
              ws[cellAddress].z = (ws[cellAddress].v % 1 === 0 && C !== 1 && C !== 7 && C !== 4) ? '#,##0' : '#,##0.000';
            }
          }
        }
      };

      const aoaData: any[][] = [["📦 المادة", "📊 الاستهلاك الكلي", "⚖️ الوحدة", "🍔 الصنف المباع", "🏢 الوكالة", "🏷️ التصنيف", "🛒 الطلبات", "📉 الكمية للصنف", "💰 التكلفة (د.ع)"]];
      const merges: XLSX.Range[] = [];
      let currentRow = 1;

      filteredMaterialUsage.forEach(mat => {
        const startRow = currentRow; 
        const displayTotal = formatSmartDisplay(mat.totalBaseConsumed, mat.dbUnitType);
        
        mat.usages.forEach((u: any) => {
          const displayUsage = formatSmartDisplay(u.base_expense, mat.dbUnitType);
          aoaData.push([
            mat.materialName, Number(displayTotal.qty.toFixed(3)), displayTotal.unit,
            u.recipe_name, u.agency_name, u.category_name, Number(u.requested_pieces.toFixed(2)),
            Number(displayUsage.qty.toFixed(3)), formatIQDNum(u.financial_cost) 
          ]);
          currentRow++;
        });
        
        if (currentRow - 1 > startRow) {
          merges.push({ s: { r: startRow, c: 0 }, e: { r: currentRow - 1, c: 0 } }, { s: { r: startRow, c: 1 }, e: { r: currentRow - 1, c: 1 } }, { s: { r: startRow, c: 2 }, e: { r: currentRow - 1, c: 2 } }); 
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(aoaData);
      if (merges.length > 0) ws['!merges'] = merges; 

      const colWidths = aoaData[0].map((_, colIndex) => {
        let maxLen = 12;
        aoaData.forEach(row => {
          const val = row[colIndex] ? row[colIndex].toString() : '';
          if (val.length > maxLen) maxLen = val.length;
        });
        return { wch: Math.min(maxLen + 6, 50) }; 
      });
      ws['!cols'] = colWidths;

      ws['!pageSetup'] = { 
        fitToPage: true, 
        fitToWidth: 1, 
        fitToHeight: 0, 
        orientation: 'landscape',
        paperSize: 9 
      };

      applyStyles(ws, [1, 8]); 
      XLSX.utils.book_append_sheet(wb, ws, "تقرير المصروف الفعلي");
      XLSX.writeFile(wb, `تقرير_المصروف_${startDate}.xlsx`);
        
    } catch (err) { alert("حدث خطأ أثناء التصدير."); console.error(err); }
  };

  const handleExportPDF = () => {
    setIsExporting(true);

    const filterAgName = filterAgency === 'all' ? 'الكل' : filterAgency;
    const filterCatName = filterCategory === 'all' ? 'الكل' : filterCategory;

    const getColStyle = (widthPercent: number) => {
      return pdfSettings.autoFit ? `padding: 10px 15px;` : `width: ${widthPercent}%; padding: 10px 15px;`;
    };

    const tablesHTML = filteredMaterialUsage.map(mat => {
      const displayTotal = formatSmartDisplay(mat.totalBaseConsumed, mat.dbUnitType);
      return `
        <div style="margin-bottom: 30px; border: 2px solid #10b981; border-radius: 12px; background: white; page-break-inside: avoid !important; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          
          <div style="background-color: #064e3b; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #047857; direction: rtl;">
            <h4 style="margin: 0; font-size: 20px; font-weight: 900;">${mat.materialName}</h4>
            <div style="font-size: 14px; font-weight: 900; background-color: #022c22; padding: 6px 16px; border-radius: 8px; display: flex; gap: 20px; align-items: center;">
              
              <div style="display: flex; gap: 6px; align-items: center; white-space: nowrap;">
                <span>الاستهلاك:</span>
                <span dir="ltr" style="color: #ffffff;">${formatQty(displayTotal.qty)}</span>
                <span style="color: #cbd5e1; font-size: 12px;">${displayTotal.unit}</span>
              </div>
              
              <div style="display: flex; gap: 6px; align-items: center; color: #6ee7b7; white-space: nowrap;">
                <span>التكلفة:</span>
                <span dir="ltr" style="color: #6ee7b7;">${formatIQD(mat.totalFinancialCost)}</span>
                <span style="font-size: 12px;">د.ع</span>
              </div>

            </div>
          </div>
          
          <div style="padding: 0;">
            <table style="width: 100%; border-collapse: collapse; text-align: right; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'}; direction: rtl;">
              <thead style="display: table-header-group;">
                <tr style="background-color: #f8fafc; font-size: 13px; color: #475569; border-bottom: 2px solid #cbd5e1;">
                  <th style="${getColStyle(pdfSettings.colRecipe)} text-align: right; word-break: break-word;">الصنف المباع / الوصفة</th>
                  <th style="${getColStyle(pdfSettings.colAgency)} text-align: right; word-break: break-word;">الوكالة / القسم</th>
                  <th style="${getColStyle(pdfSettings.colOrders)} text-align: center; word-break: break-word;">الطلبات</th>
                  <th style="${getColStyle(pdfSettings.colQty)} text-align: right; word-break: break-word;">الكمية المصروفة</th>
                  <th style="${getColStyle(pdfSettings.colCost)} text-align: right; word-break: break-word;">التكلفة (د.ع)</th>
                </tr>
              </thead>
              <tbody>
                ${mat.usages.map((u: any, idx: number) => {
                  const uDisplay = formatSmartDisplay(u.base_expense, mat.dbUnitType);
                  const isLast = idx === mat.usages.length - 1;
                  const borderBottom = isLast ? 'none' : '1px solid #e2e8f0';
                  const bgCol = idx % 2 === 0 ? '#ffffff' : '#f1f5f9';
                  
                  return `
                    <tr style="background-color: ${bgCol}; border-bottom: ${borderBottom}; page-break-inside: avoid;">
                      <td style="${getColStyle(pdfSettings.colRecipe)} font-size: 14px; font-weight: 900; color: #0f172a; text-align: right; word-break: break-word;">
                        ${u.recipe_name}
                      </td>
                      
                      <td style="${getColStyle(pdfSettings.colAgency)} font-size: 14px; color: #475569; text-align: right; word-break: break-word;">
                        <bdi style="color: #1e293b; font-weight: 900;">${u.agency_name}</bdi>
                        <span style="color: #cbd5e1; margin: 0 5px;">|</span>
                        <bdi style="font-size: 12px;">${u.category_name}</bdi>
                      </td>
                      
                      <td style="${getColStyle(pdfSettings.colOrders)} text-align: center; font-size: 15px; font-weight: 900; color: #0f172a; word-break: break-word;">
                        <span dir="ltr">${formatOrder(u.requested_pieces)}</span>
                      </td>
                      
                      <td style="${getColStyle(pdfSettings.colQty)} text-align: right; font-size: 15px; font-weight: 900; color: #334155; word-break: break-word;">
                        <div style="display: flex; gap: 4px; justify-content: flex-start; align-items: baseline; direction: rtl;">
                          <span dir="ltr">${formatQty(uDisplay.qty)}</span>
                          <span style="font-size: 11px; color: #64748b;">${displayTotal.unit}</span>
                        </div>
                      </td>
                      
                      <td style="${getColStyle(pdfSettings.colCost)} text-align: right; font-size: 15px; font-weight: 900; color: #059669; word-break: break-word;">
                        <span dir="ltr">${formatIQD(u.financial_cost)}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    const contentHTML = `
      <div style="margin-bottom: 25px; border-bottom: 4px solid #10b981; padding-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start; background: white; direction: rtl;">
        <div style="flex: 1;">
          <h1 style="margin: 0 0 15px 0; font-size: 26px; font-weight: 900; color: #0f172a;">تقرير المصروف المالي والكمي</h1>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            
            <div style="background: #f1f5f9; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #475569; border: 1px solid #cbd5e1; display: flex; gap: 6px; align-items: center; white-space: nowrap;">
              <span>📅 الفترة:</span>
              <span dir="ltr">${startDate}</span>
              <span>إلى</span>
              <span dir="ltr">${endDate}</span>
            </div>
            
            <div style="background: #e0e7ff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #4338ca; border: 1px solid #c7d2fe; display: flex; gap: 6px; align-items: center; white-space: nowrap;">
              <span>🏢 الوكالة:</span>
              <span><bdi>${filterAgName}</bdi></span>
            </div>
            
            <div style="background: #f3e8ff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #7e22ce; border: 1px solid #e9d5ff; display: flex; gap: 6px; align-items: center; white-space: nowrap;">
              <span>📑 القسم:</span>
              <span><bdi>${filterCatName}</bdi></span>
            </div>

          </div>
        </div>
        
        <div style="background: #ecfdf5; padding: 15px 25px; border-radius: 12px; border: 2px solid #10b981; text-align: center; min-width: 180px;">
          <p style="margin: 0; font-size: 12px; color: #047857; font-weight: 900;">إجمالي التكلفة للفترة</p>
          <div style="margin: 8px 0 0 0; display: flex; justify-content: center; align-items: baseline; gap: 6px; direction: rtl; white-space: nowrap;">
            <span style="font-size: 26px; font-weight: 900; color: #065f46;" dir="ltr">${formatIQD(grandTotalFilteredCost)}</span>
            <span style="font-size: 14px; font-weight: bold; color: #065f46;">د.ع</span>
          </div>
        </div>
      </div>
      
      ${tablesHTML || '<div style="text-align: center; padding: 50px; background: #f8fafc; border-radius: 16px; border: 2px dashed #cbd5e1; color: #64748b; font-size: 18px; font-weight: 700;">لا توجد بيانات للاستهلاك بناءً على الفلاتر المحددة.</div>'}
    `;

    const htmlWrapper = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>تقرير_المصروفات_${startDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            
            @page { size: ${pdfSettings.paperSize} portrait; margin: ${pdfSettings.margin}; }
            
            *, *:before, *:after { box-sizing: border-box; }
            body { 
              font-family: 'Cairo', sans-serif; 
              background: #ffffff; 
              margin: 0;
              padding: 0;
              color: #0f172a;
              direction: rtl;
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
            
            .print-footer { 
               display: flex !important; 
               position: fixed !important; 
               bottom: 0; 
               left: 0; 
               right: 0; 
               background: white; 
               padding-top: 8px; 
               border-top: 2px solid #e2e8f0;
               z-index: 1000;
               justify-content: space-between;
               font-size: 11px;
               font-weight: 900;
               color: #64748b;
            }
            
            .print-container { 
              padding-bottom: 50px; 
              zoom: ${pdfSettings.zoom / 100}; 
              margin-right: ${pdfSettings.shiftX}mm;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${contentHTML}
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
      iframeDoc.write(htmlWrapper); 
      iframeDoc.close();
      
      setTimeout(() => {
        setIsExporting(false);
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

  const totalCalculatedWidth = pdfSettings.colRecipe + pdfSettings.colAgency + pdfSettings.colOrders + pdfSettings.colQty + pdfSettings.colCost;

  if (!isMounted) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-colors duration-300 ease-in-out ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-[130px]'}`} dir="rtl">
        
        {/* 🌟 الخلفية المظلمة والتأثيرات 🌟 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-100/50 dark:from-teal-900/20 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-colors duration-300 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🟢 الهيدر الثابت 🟢 */}
          <div className={`flex flex-col md:flex-row items-center justify-between gap-6 mb-8 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] relative z-10 no-print transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-5 w-full">
              <Link href="/hub" title="الرئيسية" className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shrink-0 outline-none">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-4 flex-1 text-right">
                <div className="bg-gradient-to-br from-teal-500 to-emerald-600 w-14 h-14 rounded-[1.3rem] text-white shadow-md dark:shadow-[0_0_20px_rgba(20,184,166,0.4)] flex items-center justify-center shrink-0">
                  <PieChart className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight">إدارة وسحب المواد</h2>
                  <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-1 hidden sm:block">تقرير المصروفات الفعلي مع فلاتر ذكية</p>
                </div>
              </div>
            </div>
          </div>

          {/* 🟢 شريط أدوات التحكم (Toolbar) الموحد 🟢 */}
          <div className={`bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/10 p-2 md:p-3 rounded-[1.5rem] mb-8 flex flex-col-reverse xl:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-lg w-full no-print relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>

              {/* جزء الأزرار (يسار الشاشة بالـ RTL) */}
              <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                  <button onClick={clearFilters} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-black text-[12px] transition-all outline-none cursor-pointer active:scale-95">
                    <RotateCcw className="w-4 h-4" /> تصفير
                  </button>
                  <button onClick={() => setShowPdfSettings(!showPdfSettings)} className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none border cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-slate-100 dark:bg-slate-800 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-500/50' : 'bg-transparent text-slate-500 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                    <Settings className={`w-4 h-4 transition-transform duration-300 ${showPdfSettings ? 'rotate-90' : ''}`} /> إعدادات PDF
                  </button>
                  <button onClick={handleExportPDF} disabled={isExporting || filteredMaterialUsage.length === 0} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none disabled:opacity-50 cursor-pointer active:scale-95">
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4" />} تصدير PDF
                  </button>
                  <button onClick={handleExportExcel} disabled={filteredMaterialUsage.length === 0} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none disabled:opacity-50 cursor-pointer active:scale-95">
                    <FileSpreadsheet className="w-4 h-4" /> تصدير إكسل
                  </button>
                  <button onClick={() => setIsZenMode(true)} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-black text-[12px] transition-all outline-none cursor-pointer active:scale-95">
                    <Eye className="w-4 h-4" /> وضع التركيز
                  </button>
              </div>

              {/* جزء التاريخ (يمين الشاشة بالـ RTL) */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto">
                  
                  {/* 💡 الزر الجديد: اختيار شهر محدد 💡 */}
                  <div onClick={() => openDatePicker('selectMonth', startDate, 'month')} className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden cursor-pointer h-[50px] group hover:border-teal-300 dark:hover:border-teal-500/50 transition-colors w-full sm:w-auto shadow-sm dark:shadow-inner active:scale-95">
                    <div className="bg-slate-50 dark:bg-[#121214] px-4 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0 transition-colors group-hover:bg-teal-50 dark:group-hover:bg-teal-500/20">
                      <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-500" />
                    </div>
                    <div className="bg-white dark:bg-[#050505] px-4 flex items-center justify-center min-w-[90px]">
                      <span className="text-[12px] font-black text-slate-800 dark:text-white tracking-widest whitespace-nowrap">شهر محدد</span>
                    </div>
                  </div>

                  <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-white/10 mx-1"></div>

                  <div onClick={() => openDatePicker('startDate', startDate, 'date')} className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden cursor-pointer h-[50px] group hover:border-slate-300 dark:hover:border-white/20 transition-colors w-full sm:w-auto shadow-sm dark:shadow-inner active:scale-95">
                    <div className="bg-slate-50 dark:bg-[#121214] w-12 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">من</span>
                    </div>
                    <div className="bg-white dark:bg-[#050505] px-4 flex items-center justify-center min-w-[130px]">
                      <span className="text-[13px] font-black text-slate-800 dark:text-white tracking-widest dir-ltr en-num whitespace-nowrap">{dayjs(startDate).format('DD / MM / YYYY')}</span>
                    </div>
                  </div>
                  
                  <div onClick={() => openDatePicker('endDate', endDate, 'date')} className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden cursor-pointer h-[50px] group hover:border-slate-300 dark:hover:border-white/20 transition-colors w-full sm:w-auto shadow-sm dark:shadow-inner active:scale-95">
                    <div className="bg-slate-50 dark:bg-[#121214] w-12 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إلى</span>
                    </div>
                    <div className="bg-white dark:bg-[#050505] px-4 flex items-center justify-center min-w-[130px]">
                      <span className="text-[13px] font-black text-slate-800 dark:text-white tracking-widest dir-ltr en-num whitespace-nowrap">{dayjs(endDate).format('DD / MM / YYYY')}</span>
                    </div>
                  </div>
              </div>

          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4"><Loader2 className="w-12 h-12 text-teal-500 animate-spin" /><p className="text-slate-500 font-bold">جاري تحميل السجلات والأسعار...</p></div>
          ) : (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              
              {/* 💡 لوحة تحكم الطباعة الشاملة 💡 */}
              {showPdfSettings && !isZenMode && (
                <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative mb-8 no-print transition-colors">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                    <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><Settings className="w-4 h-4 text-teal-600 dark:text-teal-400"/> إعدادات الطباعة المتقدمة (تُحفظ تلقائياً)</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1 transition-colors bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-slate-500/50">
                      <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">حجم الورق</label>
                      <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-teal-400 dark:focus:border-teal-500/50 cursor-pointer shadow-sm dark:shadow-inner">
                        <option value="A4" className="bg-white dark:bg-[#121214]">A4 (ورق قياسي)</option>
                        <option value="A3" className="bg-white dark:bg-[#121214]">A3 (أفضل للأعمدة الكثيرة)</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">هوامش الورقة</label>
                      <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-teal-400 dark:focus:border-teal-500/50 cursor-pointer shadow-sm dark:shadow-inner">
                        <option value="0mm" className="bg-white dark:bg-[#121214]">بدون هوامش (0mm)</option>
                        <option value="2mm" className="bg-white dark:bg-[#121214]">ضيقة جداً (2mm)</option>
                        <option value="5mm" className="bg-white dark:bg-[#121214]">ضيقة (5mm)</option>
                        <option value="10mm" className="bg-white dark:bg-[#121214]">عادية (10mm)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-teal-500/50 ${pdfSettings.autoFit ? 'bg-teal-50 dark:bg-teal-600 border-teal-200 dark:border-teal-500 text-teal-700 dark:text-white shadow-sm dark:shadow-[0_0_10px_rgba(20,184,166,0.3)]' : 'bg-slate-50 dark:bg-[#050505] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                        <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                        <span className="bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 text-[11px] font-black px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-500/30 shadow-sm dark:shadow-inner" dir="ltr">{pdfSettings.shiftX} mm</span>
                      </div>
                      <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-teal-500 h-2 bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer mt-1" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <hr className="flex-1 border-slate-100 dark:border-white/5" />
                    <span className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest bg-teal-50 dark:bg-teal-500/10 px-3 py-1 rounded-full border border-teal-200 dark:border-teal-500/20 shadow-sm dark:shadow-inner">
                      إعدادات أعمدة الجداول الداخلية للطباعة
                    </span>
                    <hr className="flex-1 border-slate-100 dark:border-white/5" />
                  </div>

                  <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    
                    <div className="flex flex-col gap-2 w-full col-span-2 md:col-span-3 lg:col-span-6 mb-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                        <span className="bg-teal-50 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 text-[11px] font-black px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-500/30 shadow-sm dark:shadow-inner">{pdfSettings.zoom}%</span>
                      </div>
                      <input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-teal-500 h-2 bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الصنف/الوصفة</label><span className="text-slate-500 text-[9px] font-black">{pdfSettings.colRecipe}%</span></div><input type="range" min="10" max="60" value={pdfSettings.colRecipe} onChange={e => updatePdfSetting('colRecipe', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الوكالة/القسم</label><span className="text-slate-500 text-[9px] font-black">{pdfSettings.colAgency}%</span></div><input type="range" min="10" max="50" value={pdfSettings.colAgency} onChange={e => updatePdfSetting('colAgency', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الطلبات</label><span className="text-slate-500 text-[9px] font-black">{pdfSettings.colOrders}%</span></div><input type="range" min="5" max="30" value={pdfSettings.colOrders} onChange={e => updatePdfSetting('colOrders', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الكمية المصروفة</label><span className="text-slate-500 text-[9px] font-black">{pdfSettings.colQty}%</span></div><input type="range" min="5" max="40" value={pdfSettings.colQty} onChange={e => updatePdfSetting('colQty', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">التكلفة (د.ع)</label><span className="text-slate-500 text-[9px] font-black">{pdfSettings.colCost}%</span></div><input type="range" min="5" max="40" value={pdfSettings.colCost} onChange={e => updatePdfSetting('colCost', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                  </div>

                  {!pdfSettings.autoFit && (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                      <span>مجموع النسب للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{totalCalculatedWidth}%</span></span>
                      {totalCalculatedWidth > 100 ? (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيقوم بضغط الجدول إجبارياً)</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول منسق 100%)</span>
                      )}
                    </div>
                  )}
                  {pdfSettings.autoFit && (
                    <div className="p-3 rounded-xl border bg-slate-50 dark:bg-[#050505] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 text-[11px] font-black text-center shadow-sm dark:shadow-inner">
                      الاحتواء التلقائي مفعل (المتصفح سيوزع الأعمدة بحسب طول الكلمات ويتجاهل النسب اليدوية).
                    </div>
                  )}
                </div>
              )}

              {/* شريط الفلاتر الذكية */}
              <div className={`bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-5 rounded-[2rem] flex flex-col md:flex-row gap-4 mb-8 shadow-sm dark:shadow-[0_5px_20px_rgba(0,0,0,0.3)] relative z-10 no-print transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 p-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
                <div className="flex-1">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400"/> تصفية الوكالة</label>
                  <select 
                    value={filterAgency} 
                    onChange={(e) => { setFilterAgency(e.target.value); setFilterCategory('all'); }} 
                    className={`w-full font-bold px-4 py-3 rounded-xl outline-none transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none ${filterAgency !== 'all' ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/10' : 'bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-500/30'}`}
                  >
                    <option value="all" className="bg-white dark:bg-[#121214] text-slate-800 dark:text-white">جميع الوكالات</option>
                    {filterOptions.agencies.map(ag => <option key={ag} value={ag} className="bg-white dark:bg-[#121214] text-slate-800 dark:text-white">{ag}</option>)}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400"/> تصفية القسم</label>
                  <select 
                    value={filterCategory} 
                    onChange={(e) => setFilterCategory(e.target.value)} 
                    className={`w-full font-bold px-4 py-3 rounded-xl outline-none transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none ${filterCategory !== 'all' ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/10' : 'bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:border-violet-300 dark:hover:border-violet-500/30'}`}
                  >
                    <option value="all" className="bg-white dark:bg-[#121214] text-slate-800 dark:text-white">جميع الأقسام</option>
                    {filterOptions.categories.map(cat => <option key={cat} value={cat} className="bg-white dark:bg-[#121214] text-slate-800 dark:text-white">{cat}</option>)}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Filter className={`w-3.5 h-3.5 ${selectedMaterialType === 'raw' ? 'text-rose-500 dark:text-rose-400' : 'text-amber-500 dark:text-amber-400'}`}/> تحديد المادة حصراً</label>
                  <select 
                    value={filterMaterial} 
                    onChange={(e) => setFilterMaterial(e.target.value)} 
                    className={`w-full font-bold px-4 py-3 rounded-xl outline-none transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none ${filterMaterial !== 'all' ? (selectedMaterialType === 'raw' ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/10' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/10') : 'bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:border-slate-300 dark:hover:border-slate-500/30'}`}
                  >
                    <option value="all" className="bg-white dark:bg-[#121214] text-slate-800 dark:text-white">جميع المواد</option>
                    {filterOptions.materials.map(mat => <option key={mat} value={mat} className="bg-white dark:bg-[#121214] text-slate-800 dark:text-white">{mat}</option>)}
                  </select>
                </div>

                {/* أزرار نوع المادة ضمن الفلاتر */}
                <div className="flex-1 flex flex-col justify-end">
                  <div className="flex bg-slate-50 dark:bg-[#050505] p-1 rounded-xl shadow-sm dark:shadow-inner border border-slate-200 dark:border-white/10 h-[46px] w-full mt-2 md:mt-0">
                    <button onClick={() => setSelectedMaterialType('raw')} className={`flex-1 px-4 text-[12px] font-black rounded-lg flex items-center justify-center gap-2 outline-none transition-colors cursor-pointer active:scale-95 ${selectedMaterialType === 'raw' ? 'bg-rose-600 text-white shadow-md dark:shadow-[0_0_10px_rgba(225,29,72,0.4)] border border-rose-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'}`}><Leaf className="w-4 h-4"/> مواد خام</button>
                    <button onClick={() => setSelectedMaterialType('packaging')} className={`flex-1 px-4 text-[12px] font-black rounded-lg flex items-center justify-center gap-2 outline-none transition-colors cursor-pointer active:scale-95 ${selectedMaterialType === 'packaging' ? 'bg-amber-600 text-white shadow-md dark:shadow-[0_0_10px_rgba(217,119,6,0.4)] border border-amber-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'}`}><Box className="w-4 h-4"/> مواد تعبئة</button>
                  </div>
                </div>
              </div>

              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
                <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 p-4 rounded-2xl flex items-center gap-3 shadow-sm dark:shadow-inner">
                  <Info className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <p className="text-[12px] font-bold text-indigo-800 dark:text-indigo-200">
                    هذا التقرير يمثل <strong className="text-white bg-indigo-600 px-1.5 py-0.5 rounded mx-1">الاستهلاك الفعلي</strong> بعد تصفية <strong dir="ltr" className="mx-1 text-indigo-600 dark:text-indigo-300">{orders.length}</strong> طلب في هذه الفترة الزمنية وحسب الفلاتر المختارة أعلاه.
                  </p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between shadow-sm dark:shadow-inner">
                  <div>
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">إجمالي التكلفة للفترة والفلتر</p>
                    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <span className="text-2xl font-black text-slate-800 dark:text-white dir-ltr drop-shadow-sm">{formatIQD(grandTotalFilteredCost)}</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-500">د.ع</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-full shadow-inner flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30"><DollarSign className="w-6 h-6"/></div>
                </div>
              </div>

              <div className={`transition-all duration-300 w-full min-h-[400px]`}>
                {filteredMaterialUsage.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 relative z-10 print-container">
                    {filteredMaterialUsage.map((mat, idx) => {
                      const totalMatCost = mat.totalFinancialCost;
                      const hasPriceError = mat.hasPriceError;
                      const displayTotal = formatSmartDisplay(mat.totalBaseConsumed, mat.dbUnitType);

                      return (
                        <div key={idx} className={`border rounded-[1.5rem] overflow-hidden transition-all duration-300 ${isZenMode ? 'bg-transparent border-slate-300 dark:border-white/5' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)]'} ${hasPriceError ? 'border-rose-300 dark:border-rose-500/50 shadow-sm dark:shadow-[0_0_15px_rgba(244,63,94,0.1)]' : ''}`}>
                          
                          <div className={`p-4 px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b ${hasPriceError ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' : isZenMode ? 'bg-slate-50 dark:bg-black/50 border-slate-200 dark:border-white/5' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5'}`}>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl shadow-sm dark:shadow-inner ${hasPriceError ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30' : 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30'}`}>
                                  {selectedMaterialType === 'raw' ? <Leaf className="w-5 h-5"/> : <Box className="w-5 h-5"/>}
                                </div>
                                <h4 className="text-[18px] md:text-[20px] font-black text-slate-900 dark:text-white">{mat.materialName}</h4>
                                {hasPriceError && (<span className="bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-rose-400 shadow-sm">المادة غير مسعرة</span>)}
                              </div>
                            </div>

                            <div className="flex gap-2 w-full md:w-auto">
                              <div className="border rounded-2xl p-3 px-4 flex flex-col items-center justify-center flex-1 md:w-[150px] bg-white dark:bg-[#050505] border-slate-200 dark:border-white/5 whitespace-nowrap shadow-sm dark:shadow-inner">
                                <span className="text-[10px] font-black mb-1 text-slate-500">الكمية المسحوبة</span>
                                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                                  <span className="text-xl font-black dir-ltr text-teal-600 dark:text-teal-400 drop-shadow-sm dark:drop-shadow-md">{formatQty(displayTotal.qty)}</span>
                                  <span className="text-[10px] text-slate-500">{displayTotal.unit}</span>
                                </div>
                              </div>
                              <div className={`border rounded-2xl p-3 px-4 flex flex-col items-center justify-center flex-1 md:min-w-[180px] shadow-sm dark:shadow-inner whitespace-nowrap ${hasPriceError ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/20'}`}>
                                <span className={`text-[10px] font-black mb-1 ${hasPriceError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-500'}`}>التكلفة الفعلية (د.ع)</span>
                                <div className="flex items-baseline justify-center gap-1.5 whitespace-nowrap w-full">
                                  <span className="text-2xl font-black dir-ltr text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-md">{formatIQD(totalMatCost)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className={`p-4 md:p-6 ${isZenMode ? 'bg-transparent' : 'bg-white dark:bg-[#0a0a0c]'}`}>
                            <h5 className="text-[12px] font-black text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2"><ArrowLeftRight className="w-4 h-4"/> تفصيل الصرف حسب الأصناف المباعة</h5>
                            <div className={`overflow-x-auto rounded-xl border bg-slate-50 dark:bg-[#121214] ${isZenMode ? 'border-slate-200 dark:border-white/5' : 'border-slate-200 dark:border-white/5'}`}>
                              <table className="w-full text-right whitespace-nowrap">
                                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#050505] shadow-sm">
                                  <tr className="text-slate-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-white/5">
                                    <th className="p-3 px-4">الصنف المباع / الوصفة</th>
                                    <th className="p-3">الوكالة / القسم</th>
                                    <th className="p-3 text-center">الطلبات</th>
                                    <th className="p-3 text-left border-r border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c]">الكمية المصروفة</th>
                                    <th className="p-3 px-4 text-left bg-emerald-50 dark:bg-emerald-500/10 border-r border-slate-200 dark:border-white/5 text-emerald-600 dark:text-emerald-400">التكلفة (د.ع)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mat.usages.map((usage: any, uIdx: number) => {
                                    const usageDisplay = formatSmartDisplay(usage.base_expense, mat.dbUnitType);
                                    return (
                                      <tr key={uIdx} className="border-b border-slate-200 dark:border-white/5 last:border-none hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-3 px-4 font-black text-[13px] text-slate-800 dark:text-slate-200">{usage.recipe_name}</td>
                                        <td className="p-3">
                                          <div className="flex items-center gap-1.5">
                                            <span className="bg-white dark:bg-[#050505] text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 px-2 py-0.5 rounded flex items-center gap-1 text-[10px] font-bold shadow-sm dark:shadow-inner"><Building2 className="w-3 h-3"/> {usage.agency_name}</span>
                                            <span className="bg-white dark:bg-[#050505] text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 px-2 py-0.5 rounded flex items-center gap-1 text-[10px] font-bold shadow-sm dark:shadow-inner"><Layers className="w-3 h-3"/> {usage.category_name}</span>
                                          </div>
                                        </td>
                                        <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-400 dir-ltr">{formatOrder(usage.requested_pieces)}</td>
                                        <td className="p-3 text-left border-r border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#0a0a0c] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                          <span className="dir-ltr inline-block">{formatQty(usageDisplay.qty)}</span> <span className="text-[9px] text-slate-500">{displayTotal.unit}</span>
                                        </td>
                                        <td className="p-3 px-4 text-left border-r border-slate-200 dark:border-white/5 bg-emerald-50 dark:bg-emerald-900/10 whitespace-nowrap">
                                          <span className={`text-[14px] font-black dir-ltr inline-block drop-shadow-sm ${hasPriceError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {formatIQD(usage.financial_cost)}
                                          </span>
                                          <span className={`text-[10px] font-bold mr-1 ${hasPriceError ? 'text-rose-500/50' : 'text-emerald-600/50 dark:text-emerald-500/50'}`}>د.ع</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`text-center py-24 rounded-[2.5rem] border-2 border-dashed shadow-sm dark:shadow-inner transition-all duration-300 ${isZenMode ? 'bg-slate-50 dark:bg-black border-slate-300 dark:border-white/5' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10'}`}>
                    <Filter className="w-16 h-16 mx-auto mb-4 text-slate-400 dark:text-slate-600" />
                    <p className="text-xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">لا يوجد استهلاك يطابق الفلاتر المحددة!</p>
                    <p className="text-sm font-bold text-slate-500">جرب تغيير الوكالة أو القسم أو المادة للحصول على نتائج.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 💡 زر الخروج من وضع التركيز (يظهر فقط عند التفعيل) 💡 */}
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

        {/* 💡 التقويم المؤسساتي المنبثق (Modal) 💡 */}
        {datePickerConfig.isOpen && !isZenMode && (
          <div className="fixed top-0 left-0 w-full h-[100dvh] z-[999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden no-print">
            <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl dark:shadow-[0_0_50px_rgba(20,184,166,0.15)] animate-in zoom-in-95 duration-300">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/5 pb-5 shrink-0">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-teal-600 dark:text-teal-400 transition-colors outline-none cursor-pointer active:scale-95">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'month' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-800 dark:text-white hover:text-teal-500 dark:hover:text-teal-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'year' ? 'text-teal-600 dark:text-teal-400' : 'text-slate-800 dark:text-white hover:text-teal-500 dark:hover:text-teal-300'}`}
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
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none cursor-pointer ${isSelected ? 'bg-teal-500 text-white shadow-md dark:shadow-lg dark:shadow-teal-500/30' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
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
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 flex flex-col items-center gap-1.5 outline-none cursor-pointer ${isSelected ? 'bg-teal-500 text-white shadow-md dark:shadow-lg dark:shadow-teal-500/30' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5'}`}
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
                            ${isSelected ? 'bg-teal-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(20,184,166,0.4)]' :
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
    </div>
  );
}