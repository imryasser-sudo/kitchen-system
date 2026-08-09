"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  Edit2, Save, X, Search, PackageOpen, Leaf, Box, 
  DollarSign, Loader2, CheckCircle2, AlertTriangle, Plus, Layers,
  FileSpreadsheet, LayoutGrid, Eye, EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

type MaterialType = 'raw' | 'packaging';

interface Material {
  id?: string;
  name: string;
  unit: string;
  bulk_unit: string;
  bulk_price: number | string; 
  yield_quantity: number | string;
  unit_cost?: number; 
  isConfigured: boolean; 
  pack_count?: number | string;
  pack_weight?: number | string;
  pack_unit?: string;
}

const BULK_UNITS = ['كارتون', 'شوال', 'تنكة', 'كيلو', 'لتر', 'صندوق', 'كيس', 'قطعة'];
const WEIGHT_UNITS = ['غرام', 'مل', 'قطعة', 'كيلو', 'لتر'];

export default function MaterialsManagementPage() {
  const { isDark } = useTheme(); 
  const [isZenMode, setIsZenMode] = useState(false);
  
  const [activeTab, setActiveTab] = useState<MaterialType>('raw');
  
  const [dbMaterials, setDbMaterials] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  const [editForm, setEditForm] = useState<Partial<Material>>({});
  
  const [multiplePrices, setMultiplePrices] = useState<string[]>(['']);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const tableName = activeTab === 'raw' ? 'raw_materials' : 'packaging_materials';
      
      const [ { data: matsData }, { data: recData } ] = await Promise.all([
        supabase.from(tableName).select('*'),
        supabase.from('recipes').select('ingredients, packaging_materials')
      ]);

      setDbMaterials(matsData || []);
      setRecipes(recData || []);
    } catch (err: any) {
      console.error("Error fetching data:", err.message);
      alert("حدث خطأ في تحميل البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setIsEditing(null);
  }, [activeTab]);

  const combinedMaterials = useMemo(() => {
    const uniqueNames = new Set<string>();

    recipes.forEach(recipe => {
      const targetArray = activeTab === 'raw' ? recipe.ingredients : recipe.packaging_materials;
      if (!targetArray) return;
      targetArray.forEach((item: any) => {
        if (item.name && item.name.trim() !== '') {
          if (activeTab === 'raw' && item.type === 'raw') uniqueNames.add(item.name.trim());
          if (activeTab === 'packaging') uniqueNames.add(item.name.trim());
        }
      });
    });

    const finalData: Material[] = [];

    uniqueNames.forEach(name => {
      const dbMatch = dbMaterials.find(m => m.name === name);
      if (dbMatch) {
        finalData.push({ ...dbMatch, isConfigured: true });
      } else {
        finalData.push({
          name: name,
          unit: activeTab === 'raw' ? 'غرام' : 'قطعة',
          bulk_unit: 'كارتون',
          bulk_price: 0,
          yield_quantity: activeTab === 'raw' ? 1000 : 1,
          isConfigured: false
        });
      }
    });

    dbMaterials.forEach(dbMat => {
      if (!uniqueNames.has(dbMat.name)) {
        finalData.push({ ...dbMat, isConfigured: true });
      }
    });

    return finalData.sort((a, b) => {
      if (a.isConfigured === b.isConfigured) return a.name.localeCompare(b.name);
      return a.isConfigured ? 1 : -1;
    });

  }, [recipes, dbMaterials, activeTab]);

  const filteredMaterials = combinedMaterials.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const parseArabicNumber = (val: string) => {
    if (!val) return '';
    let parsed = val.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
    parsed = parsed.replace(/[^0-9.]/g, '');
    const parts = parsed.split('.');
    if (parts.length > 2) parsed = parts[0] + '.' + parts.slice(1).join('');
    return parsed;
  };

  const handleBulkUnitChange = (val: string) => {
    let newUnit = editForm.pack_unit || 'غرام';
    if (val === 'كيلو') newUnit = 'كيلو';
    else if (val === 'لتر') newUnit = 'لتر';
    else if (val === 'قطعة' || val === 'كيس') newUnit = 'قطعة';

    setEditForm(prev => ({ ...prev, bulk_unit: val, pack_unit: newUnit }));
  };

  const handlePriceChange = (index: number, val: string) => {
    const parsed = parseArabicNumber(val);
    const newPrices = [...multiplePrices];
    newPrices[index] = parsed;
    setMultiplePrices(newPrices);
  };

  const addPriceField = () => setMultiplePrices([...multiplePrices, '']);
  const removePriceField = (index: number) => {
    if (multiplePrices.length > 1) setMultiplePrices(multiplePrices.filter((_, i) => i !== index));
  };

  const calculateAveragePrice = () => {
    const validPrices = multiplePrices.map(p => Number(p)).filter(p => !isNaN(p) && p > 0);
    if (validPrices.length === 0) return 0;
    return validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
  };

  const getCalculatedYield = () => {
    const count = Number(parseArabicNumber(String(editForm.pack_count) || '1')) || 1;
    const weight = Number(parseArabicNumber(String(editForm.pack_weight) || '0')) || 0;
    const pUnit = editForm.pack_unit || 'غرام';
    const rUnit = editForm.unit || 'غرام';
    
    let total = count * weight;
    
    if (pUnit === 'كيلو' && rUnit === 'غرام') total *= 1000;
    else if (pUnit === 'لتر' && rUnit === 'مل') total *= 1000;
    else if (pUnit === 'غرام' && rUnit === 'كيلو') total /= 1000;
    else if (pUnit === 'مل' && rUnit === 'لتر') total /= 1000;
    
    return total > 0 ? parseFloat(total.toFixed(3)) : 0;
  };

  // 💡 إضافة الدالة المفقودة هنا 💡
  const calculatePreviewCost = (price: number | string, yieldQty: number | string) => {
    const p = Number(price);
    const y = Number(yieldQty);
    if (isNaN(p) || isNaN(y) || y <= 0) return 0;
    return p / y;
  };

  const handleSave = async (matName: string) => {
    const tableName = activeTab === 'raw' ? 'raw_materials' : 'packaging_materials';
    const averagePrice = calculateAveragePrice();
    const finalYieldQuantity = getCalculatedYield();

    const safePayload = {
      name: editForm.name || matName,
      bulk_unit: editForm.bulk_unit || 'كارتون',
      bulk_price: averagePrice, 
      yield_quantity: finalYieldQuantity,
      unit: editForm.unit || (activeTab === 'raw' ? 'غرام' : 'قطعة'),
      pack_count: Number(parseArabicNumber(String(editForm.pack_count) || '1')) || 1,
      pack_weight: Number(parseArabicNumber(String(editForm.pack_weight) || '0')) || 0,
      pack_unit: editForm.pack_unit || 'غرام'
    };

    if (safePayload.yield_quantity <= 0) return alert("إعدادات العبوات خاطئة، الوزن الصافي لا يمكن أن يكون صفراً.");
    if (safePayload.bulk_price <= 0) return alert("يرجى إدخال سعر واحد صحيح على الأقل.");

    try {
      if (!editForm.id) {
        const { error } = await supabase.from(tableName).insert([safePayload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName).update(safePayload).eq('id', editForm.id);
        if (error) throw error;
      }
      setIsEditing(null);
      fetchData(); 
    } catch (err: any) {
      console.error("Supabase Error Details:", err);
      alert(`فشل الحفظ. تأكد من اتصال قاعدة البيانات.\n\nرسالة الخطأ:\n${err.message || err.details || "Unknown Error"}`);
    }
  };

  const openEditor = (mat: Material) => {
    setIsEditing(mat.name);
    setEditForm({
      ...mat,
      pack_count: mat.pack_count ? String(mat.pack_count) : '1',
      pack_weight: mat.pack_weight ? String(mat.pack_weight) : (mat.yield_quantity ? String(mat.yield_quantity) : ''),
      pack_unit: mat.pack_unit || mat.unit || 'غرام', 
      unit: mat.unit || 'غرام'
    });
    setMultiplePrices([mat.bulk_price ? mat.bulk_price.toString() : '']);
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };

      const aoaData: any[][] = [
        ["ت", "📦 اسم المادة", "⚖️ وحدة الشراء", "💰 متوسط السعر (د.ع)", "📦 إعدادات العبوات", "📉 الصافي الفعلي", "💵 تكلفة الوحدة الصغرى (د.ع)", "✅ الحالة"]
      ];

      filteredMaterials.forEach((mat, idx) => {
        const currentAverage = Number(mat.bulk_price) || 0;
        const currentCalculatedYield = Number(mat.yield_quantity) || 0;
        const unitCost = Number(mat.unit_cost) || 0;
        
        let packDetails = '-';
        if (mat.pack_count && mat.pack_weight) {
          packDetails = `${mat.pack_count} قطع × ${mat.pack_weight} ${mat.pack_unit}`;
        }

        aoaData.push([
          idx + 1,
          mat.name,
          mat.bulk_unit || '-',
          currentAverage,
          packDetails,
          `${currentCalculatedYield} ${mat.unit || ''}`,
          unitCost,
          mat.isConfigured ? 'مُسعّرة' : 'تحتاج تسعير'
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoaData);

      const range = XLSX.utils.decode_range(ws['!ref']!);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[cellAddress]) continue;
          
          const isHeader = R === 0;
          let fill = { fgColor: { rgb: isHeader ? "0F172A" : (R % 2 === 0 ? "FFFFFF" : "F8FAFC") } };
          let font = { name: 'Arial', sz: 11, color: { rgb: isHeader ? "FFFFFF" : "334155" }, bold: isHeader };

          if (!isHeader && C === 7) {
             const isConfig = ws[cellAddress].v === 'مُسعّرة';
             font.color = { rgb: isConfig ? "059669" : "E11D48" };
             font.bold = true;
          }

          ws[cellAddress].s = {
            font: font,
            fill: fill,
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } }, left: { style: "thin", color: { rgb: "CBD5E1" } }, right: { style: "thin", color: { rgb: "CBD5E1" } } }
          };
          
          if (typeof ws[cellAddress].v === 'number' && !isHeader) {
            if (C === 3 || C === 6) {
               ws[cellAddress].z = '#,##0.000'; 
            } else {
               ws[cellAddress].z = '#,##0';
            }
          }
        }
      }

      ws['!cols'] = [
        { wch: 5 },  
        { wch: 30 }, 
        { wch: 15 }, 
        { wch: 20 }, 
        { wch: 25 }, 
        { wch: 18 }, 
        { wch: 22 }, 
        { wch: 15 }  
      ];

      ws['!dir'] = 'rtl';
      XLSX.utils.book_append_sheet(wb, ws, activeTab === 'raw' ? 'المواد الخام' : 'مواد التعبئة');
      XLSX.writeFile(wb, `تسعير_المستودع_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("حدث خطأ أثناء تصدير الملف.");
    }
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-colors duration-300 ease-in-out ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-[130px]'}`} dir="rtl">
        
        {/* 🌟 الخلفية المظلمة والتأثيرات 🌟 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 dark:from-indigo-900/20 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-colors duration-300 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🟢 الهيدر الثابت 🟢 */}
          <div className={`flex flex-col md:flex-row items-center justify-between gap-6 mb-8 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-5 w-full xl:w-auto shrink-0">
              <Link href="/hub" title="الرئيسية" className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shrink-0 outline-none">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
              <div className="flex items-center gap-4 text-right flex-1">
                <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 w-14 h-14 rounded-[1.3rem] text-white shadow-md dark:shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center shrink-0">
                  <PackageOpen className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight">إدارة تسعير المستودع</h2>
                  <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-1 hidden sm:block">محرك حسابات موحد لجميع أنواع العبوات والأوزان.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#050505] p-1.5 rounded-2xl w-full sm:w-auto shadow-sm dark:shadow-inner border border-slate-200 dark:border-white/10 shrink-0">
              <button 
                onClick={() => setActiveTab('raw')} 
                className={`flex-1 sm:min-w-[150px] py-3 px-4 text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'raw' ? 'bg-emerald-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-emerald-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5 border border-transparent'}`}
              >
                <Leaf className="w-4 h-4"/> مواد خام
              </button>
              <button 
                onClick={() => setActiveTab('packaging')} 
                className={`flex-1 sm:min-w-[150px] py-3 px-4 text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'packaging' ? 'bg-amber-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(245,158,11,0.4)] border border-amber-500' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-white/5 border border-transparent'}`}
              >
                <Box className="w-4 h-4"/> مواد تعبئة
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#121214] rounded-[2rem] shadow-sm dark:shadow-xl border border-slate-200 dark:border-white/5 overflow-hidden transition-colors duration-300">
            
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-[#0a0a0c] transition-colors duration-300">
              <div className="relative w-full sm:w-96 group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="text" 
                  placeholder="ابحث عن مادة تم إضافتها في الوصفات..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/10 px-12 py-3.5 rounded-2xl font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm dark:shadow-inner"
                />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => setIsZenMode(true)}
                  className="hidden md:flex items-center justify-center gap-2 text-[12px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 transition-all outline-none cursor-pointer active:scale-95 shadow-sm dark:shadow-inner"
                >
                  <Eye className="w-4 h-4"/> وضع التركيز
                </button>
                <button 
                  onClick={handleExportExcel}
                  className="flex flex-1 sm:flex-none items-center justify-center gap-2 text-[12px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-4 py-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 transition-all outline-none cursor-pointer active:scale-95 shadow-sm dark:shadow-inner"
                >
                  <FileSpreadsheet className="w-4 h-4"/> تصدير إكسل
                </button>
                
                <div className="hidden lg:flex items-center gap-2 text-[12px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-500/20 shadow-sm dark:shadow-inner transition-colors duration-300">
                  <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400"/> محرك التعبئة الذكي 
                </div>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar pb-4">
              <table className="w-full text-right whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100 dark:bg-[#050505] text-slate-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-white/10 transition-colors duration-300">
                    <th className="p-4 px-6 w-24">الحالة</th>
                    <th className="p-4 w-40">اسم المادة</th>
                    <th className="p-4 text-center w-32">وحدة الشراء</th>
                    <th className="p-4 w-60">الأسعار المتعددة (د.ع)</th>
                    <th className="p-4 text-indigo-600 dark:text-indigo-400 w-80">إعدادات العبوات والتفكيك (المحرك الذكي)</th>
                    <th className="p-4 text-emerald-600 dark:text-emerald-400 w-40">تكلفة الوحدة الصغرى</th>
                    <th className="p-4 px-6 text-center w-32">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  
                  {isLoading ? (
                    <tr><td colSpan={7} className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto"/></td></tr>
                  ) : filteredMaterials.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-slate-500 font-bold text-sm">لا توجد مواد مستخدمة بناءً على بحثك.</td></tr>
                  ) : (
                    filteredMaterials.map(mat => {
                      const isEdit = isEditing === mat.name; 
                      const currentAverage = isEdit ? calculateAveragePrice() : (Number(mat.bulk_price) || 0);
                      const currentCalculatedYield = isEdit ? getCalculatedYield() : (Number(mat.yield_quantity) || 0);
                      
                      return (
                        <tr key={mat.name} className={`border-b transition-colors duration-300 ${isEdit ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20' : (mat.isConfigured ? 'border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5' : 'bg-rose-50 dark:bg-rose-500/5 hover:bg-rose-100/50 dark:hover:bg-rose-500/10 border-rose-100 dark:border-rose-500/10')}`}>
                          
                          <td className="p-4 px-6 align-top pt-5">
                            {mat.isConfigured ? (
                              <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md w-fit border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner"><CheckCircle2 className="w-3.5 h-3.5"/> مُسعّرة</span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/10 px-2.5 py-1 rounded-md w-fit border border-rose-200 dark:border-rose-500/20 shadow-sm dark:shadow-inner animate-pulse"><AlertTriangle className="w-3.5 h-3.5"/> تحتاج تسعير</span>
                            )}
                          </td>

                          <td className="p-4 align-top pt-5">
                            <div className={`font-black text-[14px] flex items-center gap-2 whitespace-normal break-words ${mat.isConfigured ? 'text-slate-800 dark:text-slate-200' : 'text-rose-600 dark:text-rose-400'}`}>
                              {activeTab === 'raw' ? <Leaf className="w-4 h-4 opacity-70 shrink-0"/> : <Box className="w-4 h-4 opacity-70 shrink-0"/>}
                              {mat.name}
                            </div>
                          </td>
                          
                          <td className="p-4 text-center align-top pt-4">
                            {isEdit ? (
                              <select 
                                value={editForm.bulk_unit || ''} 
                                onChange={e => handleBulkUnitChange(e.target.value)} 
                                className="w-full bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-2 py-2.5 rounded-xl text-[12px] font-bold text-center cursor-pointer focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 shadow-sm dark:shadow-inner transition-colors"
                              >
                                {BULK_UNITS.map(u => <option key={u} value={u} className="bg-white dark:bg-[#121214]">{u}</option>)}
                              </select>
                            ) : (
                              <span className="bg-slate-100 dark:bg-[#050505] text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner transition-colors">{mat.bulk_unit || '-'}</span>
                            )}
                          </td>

                          <td className="p-4 align-top pt-4">
                            {isEdit ? (
                              <div className="flex flex-col gap-2">
                                {multiplePrices.map((price, idx) => (
                                  <div key={idx} className="relative flex items-center gap-1.5">
                                    <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                                    <input 
                                      type="text" 
                                      inputMode="decimal"
                                      value={price} 
                                      onChange={e => handlePriceChange(idx, e.target.value)} 
                                      className="w-28 bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/10 pr-9 pl-2 py-2 rounded-lg text-[13px] font-black dir-ltr text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 shadow-sm dark:shadow-inner transition-colors" 
                                      placeholder="سعر الشراء..." 
                                    />
                                    {multiplePrices.length > 1 && (
                                      <button onClick={() => removePriceField(idx)} className="p-1.5 bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 rounded-md transition-colors cursor-pointer outline-none"><X className="w-3.5 h-3.5"/></button>
                                    )}
                                  </div>
                                ))}
                                
                                <button onClick={addPriceField} className="flex items-center justify-center gap-1.5 w-28 py-1.5 bg-white dark:bg-[#050505] hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg text-[10px] font-bold transition-colors border border-slate-200 dark:border-white/10 border-dashed mt-1 outline-none cursor-pointer">
                                  <Plus className="w-3 h-3"/> أضف سعر آخر
                                </button>

                                <div className="mt-2 bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-xl border border-indigo-200 dark:border-indigo-500/20 flex flex-col items-start w-fit pr-3 pl-5 shadow-sm dark:shadow-inner transition-colors">
                                  <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">المتوسط المعتمد</span>
                                  <span className="font-black text-indigo-700 dark:text-indigo-300 dir-ltr text-[15px] en-num">{currentAverage.toLocaleString(undefined, {maximumFractionDigits: 2})} <span className="text-[10px] text-indigo-500/80 font-bold">د.ع</span></span>
                                </div>
                              </div>
                            ) : (
                              <span className="font-black text-slate-800 dark:text-slate-200 dir-ltr block w-fit text-[14px] en-num">{(Number(mat.bulk_price) || 0).toLocaleString(undefined, {maximumFractionDigits: 2})} <span className="text-[10px] text-slate-500 font-bold">د.ع</span></span>
                            )}
                          </td>

                          <td className="p-4 align-top pt-4">
                            {isEdit ? (
                              <div className="bg-white dark:bg-[#050505] p-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 flex flex-col gap-3 shadow-sm dark:shadow-inner w-fit transition-colors">
                                
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-16">يحتوي على:</span>
                                  <input type="text" inputMode="decimal" value={editForm.pack_count ?? '1'} onChange={e => setEditForm({...editForm, pack_count: parseArabicNumber(e.target.value)})} className="w-12 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 px-2 py-1.5 rounded-lg text-[13px] font-black text-center text-slate-900 dark:text-white focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 shadow-sm dark:shadow-inner en-num transition-colors" placeholder="عدد" />
                                  
                                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">قطع، بوزن (للقطعة الواحدة):</span>
                                  <input type="text" inputMode="decimal" value={editForm.pack_weight ?? ''} onChange={e => setEditForm({...editForm, pack_weight: parseArabicNumber(e.target.value)})} className="w-20 bg-slate-50 dark:bg-[#121214] border border-rose-200 dark:border-rose-500/30 px-2 py-1.5 rounded-lg text-[13px] font-black text-center dir-ltr text-slate-900 dark:text-white focus:outline-none focus:border-rose-400 dark:focus:border-rose-500/60 shadow-sm dark:shadow-inner en-num transition-colors" placeholder="وزن القطعة" />
                                  <select value={editForm.pack_unit || 'غرام'} onChange={e => setEditForm({...editForm, pack_unit: e.target.value})} className="w-20 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 shadow-sm dark:shadow-inner transition-colors">
                                    {WEIGHT_UNITS.map(u => <option key={u} value={u} className="bg-white dark:bg-[#0a0a0c]">{u}</option>)}
                                  </select>
                                </div>

                                <div className="flex items-center gap-2 border-t border-slate-100 dark:border-white/5 pt-3 transition-colors">
                                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-44">يُصرف بوصفات المطبخ بوحدة:</span>
                                  <select value={editForm.unit || 'غرام'} onChange={e => setEditForm({...editForm, unit: e.target.value})} className="w-24 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 px-2 py-1.5 rounded-lg text-[12px] font-bold cursor-pointer focus:outline-none shadow-sm dark:shadow-inner transition-colors">
                                    {WEIGHT_UNITS.map(u => <option key={u} value={u} className="bg-white dark:bg-[#0a0a0c]">{u}</option>)}
                                  </select>
                                </div>

                                <div className="bg-emerald-100 dark:bg-emerald-600 text-emerald-700 dark:text-white border border-emerald-200 dark:border-emerald-500 px-3 py-2 rounded-lg text-[12px] font-black flex items-center justify-center gap-1.5 mt-1 shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-colors">
                                  = إجمالي الصافي بالمطبخ: <span className="dir-ltr text-[14px] bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded shadow-sm dark:shadow-inner en-num">{currentCalculatedYield}</span> {editForm.unit}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="font-black text-indigo-600 dark:text-indigo-400 dir-ltr block w-fit text-[14px] en-num">{(Number(mat.yield_quantity) || 0).toLocaleString()} <span className="text-[10px] text-indigo-500/70 font-bold">{mat.unit || '-'}</span></span>
                                <span className="text-[10px] text-slate-500 font-bold">وحدة السحب: {mat.unit}</span>
                                {mat.pack_count && mat.pack_weight && (
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500 en-num">({mat.pack_count} قطع × {mat.pack_weight} {mat.pack_unit})</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="p-4 px-6 text-left align-top pt-5">
                            {isEdit ? (
                              <span className="font-black text-emerald-600 dark:text-emerald-400 dir-ltr bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner block w-fit en-num transition-colors">
                                {calculatePreviewCost(currentAverage, currentCalculatedYield).toLocaleString(undefined, {maximumFractionDigits: 4})} د.ع
                              </span>
                            ) : (
                              <span className="font-black text-emerald-600 dark:text-emerald-400 dir-ltr bg-slate-50 dark:bg-[#050505] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner block w-fit en-num transition-colors">
                                {(Number(mat.unit_cost) || 0).toLocaleString(undefined, {maximumFractionDigits: 4})} <span className="text-[10px] text-emerald-500/60 font-bold">د.ع / {mat.unit || '-'}</span>
                              </span>
                            )}
                          </td>

                          <td className="p-4 px-6 align-top pt-4">
                            <div className="flex justify-center gap-2">
                              {isEdit ? (
                                <div className="flex flex-col gap-2">
                                  <button onClick={() => handleSave(mat.name)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-md dark:shadow-[0_0_15px_rgba(99,102,241,0.4)] font-bold text-[12px] flex items-center justify-center gap-2 outline-none cursor-pointer active:scale-95"><Save className="w-4 h-4"/> حفظ</button>
                                  <button onClick={() => setIsEditing(null)} className="px-4 py-2 bg-white dark:bg-[#050505] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white transition-colors font-bold text-[12px] flex items-center justify-center gap-2 outline-none cursor-pointer active:scale-95 shadow-sm dark:shadow-inner"><X className="w-4 h-4"/> إلغاء</button>
                                </div>
                              ) : (
                                <button onClick={() => openEditor(mat)} className={`px-4 py-2 rounded-xl transition-all font-bold text-[12px] flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${mat.isConfigured ? 'bg-white dark:bg-[#050505] text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner hover:text-slate-800 dark:hover:text-white' : 'bg-rose-600 text-white hover:bg-rose-500 shadow-md dark:shadow-[0_0_15px_rgba(225,29,72,0.4)]'}`}>
                                  <Edit2 className="w-3.5 h-3.5"/> 
                                  {mat.isConfigured ? 'تعديل السعر' : 'أضف تسعيرة'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

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

        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
          .en-num { font-family: system-ui, -apple-system, sans-serif; }
        `}} />
      </div>
    </div>
  );
}