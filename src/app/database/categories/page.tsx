"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // 👈 تقنية البورتال لكسر قيود النافذة
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Layers, Plus, Edit2, Trash2, Loader2, X, AlertCircle, Package,
  LayoutGrid, LayoutList, FileSpreadsheet, FileText, Check, Type,
  Beef, Flame, Snowflake, Droplet, Box, Coffee, Pizza, ChefHat,
  Fish, Carrot, Apple, Wheat, Croissant, Milk, Cake, CupSoda, 
  CookingPot, Truck, Sparkles, UtensilsCrossed, Sandwich, Soup, 
  Salad, Egg, Cookie, Cherry, Citrus, Grape, 
  Leaf, GlassWater, Store, ShoppingCart, Utensils, IceCream,
  Drumstick, Bird, Bone, Scale, Thermometer, Timer, ShieldCheck,
  Droplets 
} from 'lucide-react';

import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useTheme } from '@/components/ThemeProvider'; // 👈 استيراد الثيم الرئيسي

// ألوان الأقسام
const colorPresets = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'
];

// مكتبة الأيقونات
const iconList = [
  { name: 'Layers', icon: Layers, label: 'عام' },
  { name: 'Drumstick', icon: Drumstick, label: 'دجاج مقلي' },
  { name: 'Sandwich', icon: Sandwich, label: 'سندويشات' },
  { name: 'Salad', icon: Salad, label: 'مقبلات وسلطات' },
  { name: 'Droplets', icon: Droplets, label: 'صوصات وكريمات' },
  { name: 'Droplet', icon: Droplet, label: 'تتبيلة وزيت' },
  { name: 'Bird', icon: Bird, label: 'دواجن طازجة' },
  { name: 'Bone', icon: Bone, label: 'مسحب وبعظم' },
  { name: 'Wheat', icon: Wheat, label: 'طحين وبقسماط' },
  { name: 'Flame', icon: Flame, label: 'قلايات وحار' },
  { name: 'Thermometer', icon: Thermometer, label: 'حرارة الزيت' },
  { name: 'Timer', icon: Timer, label: 'توقيت القلي' },
  { name: 'Scale', icon: Scale, label: 'أوزان ومقادير' },
  { name: 'ShieldCheck', icon: ShieldCheck, label: 'رقابة الجودة' },
  { name: 'Beef', icon: Beef, label: 'لحوم حمراء' },
  { name: 'Fish', icon: Fish, label: 'أسماك وبحريات' },
  { name: 'Egg', icon: Egg, label: 'بيض' },
  { name: 'Carrot', icon: Carrot, label: 'خضار طازجة' },
  { name: 'Leaf', icon: Leaf, label: 'ورقيات وأعشاب' },
  { name: 'Apple', icon: Apple, label: 'فواكه' },
  { name: 'Cherry', icon: Cherry, label: 'فواكه حمراء' },
  { name: 'Citrus', icon: Citrus, label: 'حمضيات' },
  { name: 'Grape', icon: Grape, label: 'عنب وتوت' },
  { name: 'Croissant', icon: Croissant, label: 'مخبوزات' },
  { name: 'Cookie', icon: Cookie, label: 'بسكويت' },
  { name: 'Cake', icon: Cake, label: 'حلويات وكيك' },
  { name: 'IceCream', icon: IceCream, label: 'مثلجات' },
  { name: 'Milk', icon: Milk, label: 'ألبان' },
  { name: 'Snowflake', icon: Snowflake, label: 'مجمدات' },
  { name: 'Pizza', icon: Pizza, label: 'معجنات وبيتزا' },
  { name: 'Soup', icon: Soup, label: 'شوربات' },
  { name: 'CupSoda', icon: CupSoda, label: 'مشروبات غازية' },
  { name: 'Coffee', icon: Coffee, label: 'قهوة وحار' },
  { name: 'GlassWater', icon: GlassWater, label: 'مياه وسوائل' },
  { name: 'CookingPot', icon: CookingPot, label: 'طبخ وتجهيز' },
  { name: 'ChefHat', icon: ChefHat, label: 'شيف مركزي' },
  { name: 'Utensils', icon: Utensils, label: 'تقديم ومائدة' },
  { name: 'UtensilsCrossed', icon: UtensilsCrossed, label: 'أدوات مطبخ' },
  { name: 'Store', icon: Store, label: 'بقالة وتموين' },
  { name: 'ShoppingCart', icon: ShoppingCart, label: 'مشتريات' },
  { name: 'Package', icon: Package, label: 'تغليف وتعبئة' },
  { name: 'Box', icon: Box, label: 'مخزن جاف' },
  { name: 'Truck', icon: Truck, label: 'شحن وتوزيع' },
  { name: 'Sparkles', icon: Sparkles, label: 'مواد تنظيف' },
];

const hexToRgba = (hex: string, alpha: number = 1) => {
  let r = 139, g = 92, b = 246; 
  if (hex && hex.startsWith('#')) {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
    if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    }
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [layoutView, setLayoutView] = useState<'grid' | 'table'>('grid');
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [color, setColor] = useState(colorPresets[0]);
  const [selectedIcon, setSelectedIcon] = useState('Layers'); 
  const [sequence, setSequence] = useState<string>('999');
  const [isSaving, setIsSaving] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  // 👈 سحب الوضع الليلي والنهاري من الثيم الرئيسي
  const { isDark } = useTheme();

  // منع تمرير الصفحة عند فتح النافذة
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  const fetchCategories = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const { data: cats, error } = await supabase
        .from('categories')
        .select('*')
        .order('sequence', { ascending: true });
      
      if (error) throw error;

      const { data: items } = await supabase.from('items').select('category_id');
      
      const categoriesWithCount = (cats || []).map(cat => ({
        ...cat,
        itemsCount: items ? items.filter(item => item.category_id === cat.id).length : 0
      }));

      setCategories(categoriesWithCount);
    } catch (err: any) {
      setDbError(err?.message || "يرجى التأكد من إضافة عمود الأيقونة (icon) في قاعدة البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchCategories();
  }, []);

  const openAddModal = () => {
    setIsEditing(false); setEditId(null); 
    setName(''); setColor(colorPresets[0]); setSelectedIcon('Layers'); setSequence('999');
    setIsModalOpen(true);
  };

  const openEditModal = (cat: any) => {
    setIsEditing(true); setEditId(cat.id); 
    setName(cat.name || ''); 
    setColor(cat.color || colorPresets[0]); 
    setSelectedIcon(cat.icon || 'Layers');
    setSequence(cat.sequence?.toString() || '999');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false); setEditId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const payload = { 
        name: name.trim(), 
        color, 
        icon: selectedIcon, 
        sequence: parseInt(sequence) || 999 
      };
      
      if (isEditing && editId) {
        const { error } = await supabase.from('categories').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert([payload]);
        if (error) throw error;
      }
      
      await fetchCategories();
      closeModal();
    } catch (error: any) {
      alert("حدث خطأ أثناء الحفظ: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, categoryName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف القسم (${categoryName || 'بدون اسم'})؟`)) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      await fetchCategories();
    } catch (error: any) {
      alert("لا يمكن حذف القسم لارتباطه بأصناف أخرى.");
    }
  };

  const handleExportExcel = async () => {
    if (categories.length === 0) return alert("لا توجد بيانات لتصديرها.");
    setIsExportingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Enterprise B2B System';
      const worksheet = workbook.addWorksheet('قائمة الأقسام', { views: [{ rightToLeft: true }] });

      const headers = ['ت', 'التسلسل', 'اسم القسم', 'عدد الأصناف المرتبطة'];
      
      worksheet.mergeCells('A1:D1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `تقرير أقسام المطبخ المركزي وعدد الأصناف`;
      titleCell.font = { name: 'Cairo', size: 16, bold: true, color: { argb: 'FF0F172A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;
      worksheet.addRow([]); 

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }; 
        cell.font = { name: 'Arial', color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      categories.forEach((cat, index) => {
        const rowData = [
          index + 1,
          cat.sequence === 999 ? '-' : cat.sequence,
          cat.name,
          cat.itemsCount
        ];

        const dataRow = worksheet.addRow(rowData);
        const isEven = index % 2 === 0;
        const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        dataRow.eachCell((cell, colNum) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin', color: {argb: 'FFCBD5E1'} }, left: { style: 'thin', color: {argb: 'FFCBD5E1'} }, bottom: { style: 'thin', color: {argb: 'FFCBD5E1'} }, right: { style: 'thin', color: {argb: 'FFCBD5E1'} } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          if (colNum === 3) cell.font = { bold: true };
          if (colNum === 4) cell.font = { bold: true, color: { argb: 'FF8B5CF6' } };
        });
      });

      worksheet.columns.forEach((col, i) => {
        if (i === 0) col.width = 6;  
        else if (i === 1) col.width = 12; 
        else if (i === 2) col.width = 35; 
        else if (i === 3) col.width = 25; 
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `قائمة_الأقسام_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (e) {
      alert("حدث خطأ أثناء تصدير ملف Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (categories.length === 0) return alert("لا توجد بيانات للتصدير.");
    setIsExportingPDF(true);
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;
      const dateStr = new Date().toLocaleDateString('ar-IQ');

      let tbody = '';
      categories.forEach((cat, i) => {
        const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
        tbody += `
          <tr style="background-color: ${bg}; page-break-inside: avoid;">
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align:center; font-weight:bold; font-size: 14px;">${i + 1}</td>
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align:center; font-size: 14px;">${cat.sequence === 999 ? '-' : cat.sequence}</td>
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; font-weight:900; font-size: 15px;">${cat.name}</td>
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align:center; font-weight:900; font-size: 14px; color:#8b5cf6;">${cat.itemsCount}</td>
          </tr>
        `;
      });

      const finalHTML = `
        <div id="pdf-wrapper" dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; padding: 40px 30px;">
          <h1 style="text-align:center; color:#0f172a; margin-bottom: 5px;">تقرير أقسام المطبخ المركزي</h1>
          <p style="text-align:center; color:#64748b; margin-bottom: 30px; font-weight:bold;">المرجع الزمني: ${dateStr} | إجمالي الأقسام: ${categories.length}</p>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff;">
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">ت</th>
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">التسلسل</th>
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">اسم القسم</th>
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">عدد الأصناف المرتبطة</th>
              </tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      `;

      const opt: any = {
        margin: 10, filename: `الأقسام_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
      };
      await html2pdf().set(opt).from(finalHTML).save();

    } catch (e) {
      alert("حدث خطأ أثناء تصدير الـ PDF.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white font-sans relative overflow-x-hidden pb-40" dir="rtl">
        
        {/* خلفية بوهج بنفسجي خفيف */}
        <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] transition-colors duration-500 from-purple-200/50 via-slate-50 to-slate-50 dark:from-purple-900/15 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none"></div>

        <div className="p-4 md:p-8 max-w-[100rem] mx-auto w-full relative z-10">
          
          {/* الهيدر */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 bg-white/80 dark:bg-white/5 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-4 text-right flex-1 w-full md:w-auto">
              <Link href="/hub" className="bg-slate-100 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none cursor-pointer active:scale-95">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
              <div className="bg-gradient-to-br from-purple-400/20 dark:from-purple-500/20 to-fuchsia-600/30 dark:to-fuchsia-900/40 border border-purple-400/30 dark:border-purple-500/30 w-14 h-14 rounded-[1.3rem] text-purple-600 dark:text-purple-400 shadow-inner flex items-center justify-center shrink-0">
                 <Layers className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight mb-1 truncate">إدارة الأقسام</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 truncate">إدارة أقسام المخزن وتصنيفات المواد وتحديد أيقوناتها.</p>
              </div>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              <button onClick={openAddModal} className="w-full md:w-auto flex items-center justify-center gap-2 bg-purple-600 text-white px-6 h-14 rounded-[1.5rem] font-black text-sm shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] hover:scale-105 active:scale-95 transition-all outline-none border border-purple-500 cursor-pointer">
                <Plus className="w-5 h-5" /> إضافة قسم جديد
              </button>
            </div>
          </div>

          {dbError && (
            <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-md w-full">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-500" />
              <p className="text-lg">{dbError}</p>
            </div>
          )}

          {!dbError && isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-5 w-full">
              <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
              <p className="text-slate-500 font-black tracking-widest text-sm uppercase">جاري تحميل الأقسام...</p>
            </div>
          ) : !dbError && categories.length === 0 ? (
            <div className="py-24 text-center text-slate-500 bg-white dark:bg-[#121214] rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner">
              <Layers className="w-20 h-20 mx-auto mb-5 opacity-30 text-purple-500" />
              <p className="text-2xl font-black text-slate-900 dark:text-white mb-2">لا توجد أقسام مسجلة</p>
              <p className="text-sm font-bold text-slate-500">اضغط على زر الإضافة لإنشاء أول قسم.</p>
            </div>
          ) : !dbError && (
            
            <div className="w-full relative z-10">
              {/* العنوان وأزرار العرض والتصدير */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 px-2 gap-4">
                 <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                   قائمة الأقسام
                   <span className="bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs px-2.5 py-0.5 rounded-lg border border-purple-200 dark:border-purple-500/20 shadow-inner en-num">{categories.length}</span>
                 </h3>

                 <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                   <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-1.5 rounded-[1.2rem] shadow-inner h-12">
                      <button onClick={handleExportPDF} disabled={isExportingPDF} title="تصدير كملف PDF" className="flex items-center justify-center gap-1.5 px-3 h-full rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/30 transition-all font-bold text-xs outline-none cursor-pointer active:scale-95 disabled:opacity-50">
                        {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
                      </button>
                      <button onClick={handleExportExcel} disabled={isExportingExcel} title="تصدير كملف Excel" className="flex items-center justify-center gap-1.5 px-3 h-full rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all font-bold text-xs outline-none cursor-pointer active:scale-95 disabled:opacity-50">
                        {isExportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
                      </button>
                   </div>
                   <div className="w-px h-8 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
                   <div className="bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-1.5 rounded-[1.2rem] shadow-inner flex gap-1 shrink-0 h-12 items-center">
                     <button onClick={() => setLayoutView('grid')} className={`p-2 rounded-xl transition-all outline-none cursor-pointer active:scale-95 ${layoutView === 'grid' ? 'bg-purple-200/50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 shadow-sm border border-purple-300 dark:border-purple-500/30' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-white/5'}`}><LayoutGrid className="w-4 h-4" /></button>
                     <button onClick={() => setLayoutView('table')} className={`p-2 rounded-xl transition-all outline-none cursor-pointer active:scale-95 ${layoutView === 'table' ? 'bg-purple-200/50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 shadow-sm border border-purple-300 dark:border-purple-500/30' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-white/5'}`}><LayoutList className="w-4 h-4" /></button>
                   </div>
                 </div>
              </div>

              {layoutView === 'grid' ? (
                /* 🟢 العرض الشبكي (Grid View) 🟢 */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {categories.map((cat) => {
                    const bColor = cat.color || '#8b5cf6';
                    const IconCmp = iconList.find(i => i.name === cat.icon)?.icon || Layers;
                    
                    return (
                      <div 
                        key={cat.id} 
                        style={{ borderColor: hexToRgba(bColor, 0.3), boxShadow: `0 10px 30px -10px ${hexToRgba(bColor, 0.15)}` }}
                        className="bg-white dark:bg-[#121214] p-6 rounded-[2rem] border relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 flex flex-col"
                      >
                        <div className="absolute top-0 right-0 w-2 h-full rounded-r-3xl transition-colors duration-300" style={{ backgroundColor: bColor }}></div>
                        <div className="absolute top-0 left-0 w-32 h-32 rounded-full blur-[40px] -ml-10 -mt-10 opacity-20 pointer-events-none transition-colors duration-300" style={{ backgroundColor: bColor }}></div>

                        <div className="flex justify-between items-start mb-6 relative z-10">
                          <div className="w-10 h-10 bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 rounded-xl flex items-center justify-center font-black shrink-0 text-sm shadow-inner" style={{ color: bColor }} title="تسلسل القسم">
                            {cat.sequence === 999 ? '-' : cat.sequence}
                          </div>
                          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm dark:shadow-inner" style={{ color: bColor }}>
                            {cat.itemsCount} صنف <Package className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mb-6 relative z-10">
                          <div className="w-12 h-12 rounded-[1.2rem] flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/10 shadow-inner" style={{ backgroundColor: isDark ? hexToRgba(bColor, 0.1) : hexToRgba(bColor, 0.05), color: bColor }}>
                            <IconCmp className="w-6 h-6" />
                          </div>
                          <div className="w-full overflow-hidden pt-1">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white truncate">{cat.name || 'بدون اسم'}</h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-auto relative z-10 pt-4 border-t border-slate-100 dark:border-white/5">
                          <button onClick={() => openEditModal(cat)} className="flex-1 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-white py-2.5 rounded-xl text-[12px] font-black flex items-center justify-center gap-2 transition-colors outline-none cursor-pointer active:scale-95 border border-slate-200 dark:border-white/5">
                            <Edit2 className="w-4 h-4" /> تعديل
                          </button>
                          <button onClick={() => handleDelete(cat.id, cat.name)} className="w-12 h-10 shrink-0 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center transition-colors outline-none cursor-pointer active:scale-95 border border-rose-200 dark:border-rose-500/20">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* 🟢 العرض العامودي (Table View) 🟢 */
                <div className="overflow-x-auto w-full custom-scrollbar pb-10">
                  <table className="w-full text-right border-separate" style={{ borderSpacing: '0 12px' }}>
                    <thead className="sticky top-0 z-20">
                      <tr className="text-slate-500 dark:text-slate-400 text-[12px] font-black uppercase tracking-widest bg-slate-50 dark:bg-transparent">
                        <th className="px-6 w-16 text-center pb-2 pt-2">#</th>
                        <th className="px-6 w-24 text-center pb-2 pt-2">التسلسل</th>
                        <th className="px-6 w-[40%] pb-2 pt-2">اسم القسم</th>
                        <th className="px-6 w-40 text-center pb-2 pt-2">عدد الأصناف</th>
                        <th className="px-6 w-32 text-center pb-2 pt-2">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="text-[14px]">
                      {categories.map((cat, idx) => {
                        const bColor = cat.color || '#8b5cf6';
                        const IconCmp = iconList.find(i => i.name === cat.icon)?.icon || Layers;
                        
                        return (
                          <tr key={cat.id} className="bg-white dark:bg-[#121214] shadow-sm dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)] hover:bg-slate-50 dark:hover:bg-[#1e1e2d] hover:-translate-y-0.5 transition-all duration-300 group">
                            <td className="py-4 px-6 text-center rounded-r-[2rem] border-y border-r border-slate-200 dark:border-white/5 text-slate-500 font-bold en-num">{idx + 1}</td>
                            <td className="py-4 px-6 text-center border-y border-slate-200 dark:border-white/5">
                              <span className="text-[13px] font-black text-slate-500 dark:text-slate-400 en-num">{cat.sequence === 999 ? '-' : cat.sequence}</span>
                            </td>
                            <td className="py-4 px-6 border-y border-slate-200 dark:border-white/5">
                              <div className="flex items-center gap-4">
                                <div style={{ backgroundColor: isDark ? hexToRgba(bColor, 0.1) : hexToRgba(bColor, 0.05), color: bColor, borderColor: isDark ? hexToRgba(bColor, 0.2) : hexToRgba(bColor, 0.1) }} className="w-10 h-10 rounded-[1rem] border shadow-inner shrink-0 flex items-center justify-center">
                                  <IconCmp className="w-5 h-5" />
                                </div>
                                <h4 className="font-black text-[15px] text-slate-900 dark:text-white truncate max-w-[250px]">{cat.name}</h4>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center border-y border-slate-200 dark:border-white/5">
                              <span className="text-xs font-black bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1 rounded-xl en-num shadow-inner flex items-center justify-center gap-1.5 w-fit mx-auto" style={{ color: bColor }}>
                                 {cat.itemsCount} صنف <Package className="w-3.5 h-3.5" />
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center rounded-l-[2rem] border-y border-l border-slate-200 dark:border-white/5">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => openEditModal(cat)} className="p-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-xl transition-colors outline-none cursor-pointer active:scale-95 border border-slate-200 dark:border-white/5" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(cat.id, cat.name)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl transition-colors outline-none cursor-pointer active:scale-95 border border-rose-200 dark:border-rose-500/20" title="حذف"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 🟢 النافذة المنبثقة الحرة بتقنية Portals لكسر قيود الشاشة وتغطية الشريط السفلي 🟢 */}
        {isMounted && isModalOpen && createPortal(
          <div className={`fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 font-sans ${isDark ? 'dark' : ''}`} dir="rtl">
            <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-4 md:p-5 rounded-[2rem] w-full max-w-[460px] shadow-2xl dark:shadow-[0_0_50px_rgba(139,92,246,0.15)] animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
              
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  {isEditing ? <><Edit2 className="w-4 h-4 text-amber-500 dark:text-amber-400" /> تعديل قسم</> : <><Plus className="w-4 h-4 text-purple-600 dark:text-purple-400" /> إضافة قسم جديد</>}
                </h3>
                <button onClick={closeModal} className="p-2 bg-slate-100 dark:bg-white/5 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors outline-none cursor-pointer active:scale-95">
                  <X className="w-4 h-4"/>
                </button>
              </div>
              
              <form onSubmit={handleSave} className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
                
                <div className="flex gap-3 items-end">
                  <div className="w-20 shrink-0 flex flex-col gap-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">التسلسل</label>
                    <input 
                      type="number" 
                      value={sequence} 
                      onChange={(e) => setSequence(e.target.value)} 
                      placeholder="1" 
                      className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 focus:border-purple-400 dark:focus:border-purple-500/50 rounded-xl h-11 px-2 outline-none transition-all font-bold text-[13px] text-center text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm dark:shadow-inner focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-500/20 en-num" 
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-purple-600 dark:text-purple-500" /> اسم القسم <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      autoFocus // 👈 تركيز تلقائي على هذا الحقل
                      required
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="مثال: التقطيع، الصوصات..." 
                      className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 focus:border-purple-400 dark:focus:border-purple-500/50 rounded-xl h-11 px-4 outline-none transition-all font-bold text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm dark:shadow-inner focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-500/20" 
                    />
                  </div>
                </div>

                {/* 💡 قسم اختيار الأيقونة (مضغوط ومصغر) 💡 */}
                <div className="flex flex-col gap-2 pt-1">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">أيقونة القسم</label>
                  <div className="grid grid-cols-5 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                    {iconList.map((ic) => {
                      const IconComponent = ic.icon;
                      const isActive = selectedIcon === ic.name;
                      return (
                        <button
                          key={ic.name} 
                          type="button" 
                          onClick={() => setSelectedIcon(ic.name)}
                          className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-all duration-300 border-2 outline-none cursor-pointer ${isActive ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-400 dark:border-purple-500/50 shadow-inner' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20'}`}
                          title={ic.label}
                        >
                          <IconComponent className={`w-5 h-5 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500'}`} />
                          <span className={`text-[9px] font-black text-center leading-tight truncate w-full ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500'}`}>{ic.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* قسم اختيار اللون (مصغر) */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-white/5 mt-1">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">اللون المميز للقسم</label>
                  <div className="flex flex-wrap gap-2.5">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset} 
                        type="button" 
                        onClick={() => setColor(preset)}
                        className={`relative w-8 h-8 rounded-full transition-all duration-300 border-2 flex items-center justify-center outline-none cursor-pointer ${color === preset ? 'scale-110' : 'border-slate-200 dark:border-white/10 hover:scale-105'}`}
                        style={{ 
                          backgroundColor: preset, 
                          borderColor: color === preset ? (isDark ? 'white' : '#334155') : 'transparent', 
                          boxShadow: color === preset ? `0 0 15px ${hexToRgba(preset, 0.6)}` : 'inset 0 4px 6px rgba(0,0,0,0.3)' 
                        }}
                      >
                        {color === preset && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-white/5 shrink-0 mt-1">
                  <button 
                    type="submit" 
                    disabled={isSaving} 
                    className="flex-1 bg-purple-600 text-white h-11 rounded-[1rem] font-black text-[13px] shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all outline-none cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ البيانات'}
                  </button>
                  <button 
                    type="button" 
                    onClick={closeModal} 
                    disabled={isSaving}
                    className="px-6 h-11 bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-[1rem] font-black text-[13px] transition-colors outline-none cursor-pointer active:scale-95 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                </div>

              </form>
            </div>
          </div>,
          document.body
        )}

        <style dangerouslySetInnerHTML={{__html: `
          @import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;700;900&display=swap');
          .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
          .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
        `}} />
      </div>
    </div>
  );
}