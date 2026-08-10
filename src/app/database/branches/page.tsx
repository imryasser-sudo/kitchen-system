"use client";

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; // 👈 ضروري لكسر قيود النافذة وتوسيطها إجبارياً
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Store, Plus, Edit2, Trash2, Loader2, X, AlertCircle, MapPin, Building2, Map,
  LayoutGrid, LayoutList, Power, Check, ChevronDown, Type, Filter,
  FileSpreadsheet, FileText, ShoppingCart, Sun, Moon, Eye, EyeOff
} from 'lucide-react';

import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useTheme } from '@/components/ThemeProvider'; 

const iraqGeography: Record<string, Record<string, string[]>> = {
  "بغداد": { "الكرخ": ["المنصور", "اليرموك", "الحارثية", "الكاظمية", "السيدية", "العامرية", "الجهاد", "حي الجامعة", "الغزالية", "الدورة", "الاسكان", "حي العدل", "البياع", "حي العامل"], "الرصافة": ["الكرادة", "الجادرية", "زيونة", "الاعظمية", "شارع فلسطين", "بغداد الجديدة", "الشعب", "البلديات", "مدينة الصدر", "الزعفرانية", "الوزيرية"] },
  "البصرة": { "المركز": ["العشار", "الجزائر", "المعقل", "الطويسة", "البراضعية", "الجبيلة", "الخورة"], "الزبير": ["مركز الزبير", "سفوان", "خور الزبير", "ام قصر"], "أبي الخصيب": ["مركز أبي الخصيب", "السيبة"], "القرنة": ["مركز القرنة", "الشرش"] },
  "نينوى": { "الموصل (الايمن)": ["الموصل القديمة", "حي الدواسة", "حي الطيران", "الجديدة", "الغزلاني"], "الموصل (الايسر)": ["حي الجامعة", "الزهور", "النور", "المثنى", "المهندسين", "الحدباء"], "تلعفر": ["مركز تلعفر", "زمار"], "الحمدانية": ["بخديدا", "برطلة", "الكوير"] },
  "أربيل": { "أربيل المركز": ["عينكاوا", "بختياري", "الوزيران", "روناكي", "الاسكان", "ازادي"], "سوران": ["مركز سوران", "خليفان", "راوندوز"], "شقلاوة": ["مركز شقلاوة", "صلاح الدين"] },
  "السليمانية": { "المركز": ["بختياري", "سرجنار", "رزكاري", "عقاري", "توي مليك"], "حلبجة": ["مركز حلبجة", "سيروان"], "جمجمال": ["مركز جمجمال", "شورش"] },
  "دهوك": { "المركز": ["زاخو", "سميل", "العمادية", "مركز دهوك"] },
  "كركوك": { "المركز": ["طريق بغداد", "الشورجة", "الرحيم اوا", "تسعين", "حي الواسطي", "عرفه"], "الحويجة": ["مركز الحويجة", "الرياض", "العباسي"], "داقوق": ["مركز داقوق"] },
  "النجف": { "المركز": ["المدينة القديمة", "حي الامير", "حي السعد", "حي الحنانة", "حي الغدير", "حي المكرمة"], "الكوفة": ["مركز الكوفة", "مسجد الكوفة"], "المناذرة": ["مركز المناذرة", "الحيرة"] },
  "كربلاء": { "المركز": ["المدينة القديمة", "حي الحسين", "حي الموظفين", "حي البلدية", "حي المعلمين", "حي النقيب"], "الهندية (طويريج)": ["مركز الهندية", "الجدول الغربي"], "عين التمر": ["مركز عين التمر"] },
  "بابل": { "الحلة (المركز)": ["حي بابل", "الكرامة", "الجمعية", "الطيارة", "حي المهندسين", "نادر"], "المسيب": ["مركز المسيب", "الاسكندرية", "سدة الهندية", "جرف الصخر"], "المحاويل": ["مركز المحاويل", "الامام"], "الهاشمية": ["مركز الهاشمية", "القاسم", "المدحتية"] },
  "ذي قار": { "الناصرية (المركز)": ["الحبوبي", "الشامية", "الجزيرة", "حي سومر", "حي اور", "حي المتنبي"], "الشطرة": ["مركز الشطرة", "الغراف"], "سوق الشيوخ": ["مركز سوق الشيوخ", "الفضلية"], "الرفاعي": ["مركز الرفاعي", "قلعة سكر", "الفجر"] },
  "ميسان": { "العمارة (المركز)": ["عواشة", "المجر الكبير", "حي الحسين", "المحمودية", "الماجدية"], "علي الغربي": ["مركز علي الغربي", "علي الشرقي"], "الميمونة": ["مركز الميمونة"] },
  "الديوانية": { "المركز": ["حي العروبة", "حي الفرات", "حي النهضة", "حي الجامعة"], "عفك": ["مركز عفك", "سومر", "نفر"], "الشامية": ["مركز الشامية", "المهناوية", "غماس"] },
  "واسط": { "الكوت (المركز)": ["حي الربيع", "حي الهورة", "حي الزهراء", "حي العمارات", "مشروع الكوت"], "الصويرة": ["مركز الصويرة", "الزبيدية", "الشحيمية"], "العزيزية": ["مركز العزيزية"], "الحي": ["مركز الحي", "الموفقية"] },
  "المثنى": { "السماوة (المركز)": ["حي الحسين", "حي المعلمين", "حي الغدير", "الشرقي"], "الرميثة": ["مركز الرميثة", "المجد", "النجمي"], "الخضر": ["مركز الخضر", "الدراجي"] },
  "الأنبار": { "الرمادي (المركز)": ["التاميم", "حي الضباط", "حي الاندلس", "حي الملعب", "الحوز"], "الفلوجة": ["حي الجولان", "حي العسكري", "حي الشهداء", "النزال", "حي المعلمين"], "هيت": ["مركز هيت", "البغدادي", "كبيسة"], "حديثة": ["مركز حديثة", "الحقلانية", "بروانة"] },
  "صلاح الدين": { "تكريت (المركز)": ["حي القادسية", "حي الزهور", "حي الجامعة", "حي الضباط"], "سامراء": ["الخضراء", "الضباط", "حي المعتصم", "حي المعلمين"], "بلد": ["مركز بلد", "الاسحاقي", "الدجيل"], "بيجي": ["مركز بيجي", "الصينية"], "الطوز": ["مركز طوزخورماتو", "امرلي"] },
  "ديالى": { "بعقوبة (المركز)": ["بعقوبة الجديدة", "حي المصطفى", "حي المعلمين", "المفرق", "بهرز"], "الخالص": ["مركز الخالص", "هبهب", "العظيم"], "المقدادية": ["مركز المقدادية", "ابي صيدا", "الوجيهية"], "خانقين": ["مركز خانقين", "جلولاء", "السعدية"] }
};

const hexToRgba = (hex: string, alpha: number = 1) => {
  let r = 16, g = 185, b = 129; 
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

function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getBranchColor(id: string) {
  if (!id) return '#4f46e5';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360; 
  const s = 70 + (Math.abs(hash) % 25); 
  const l = 55 + (Math.abs(hash) % 10); 
  return hslToHex(h, s, l);
}

export default function BranchesPage() {
  const { isDark, toggleTheme } = useTheme(); 
  const [isZenMode, setIsZenMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false); // 👈 حالة الـ Mount للتوافق مع Portal
  
  const [branches, setBranches] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [layoutView, setLayoutView] = useState<'grid' | 'table'>('grid');
  const [selectedAgencyFilter, setSelectedAgencyFilter] = useState<string>('الكل');

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [sector, setSector] = useState('');
  const [city, setCity] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select(`*, agencies(name, color), requests(id)`)
        .order('name');
      if (branchesError) throw branchesError;

      const { data: agenciesData, error: agenciesError } = await supabase
        .from('agencies')
        .select('id, name, color')
        .order('name');
      if (agenciesError) throw agenciesError;

      setBranches(branchesData || []);
      setAgencies(agenciesData || []);
    } catch (err: any) {
      setDbError(err?.message || "حدث خطأ في الاتصال بقاعدة البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBranches = useMemo(() => {
    if (selectedAgencyFilter === 'الكل') return branches;
    return branches.filter(b => b.agency_id === selectedAgencyFilter);
  }, [branches, selectedAgencyFilter]);

  const availableGovernorates = Object.keys(iraqGeography);
  const availableSectors = governorate ? Object.keys(iraqGeography[governorate] || {}) : [];
  const availableCities = (governorate && sector) ? (iraqGeography[governorate][sector] || []) : [];

  const handleGovernorateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGovernorate(e.target.value);
    setSector('');
    setCity('');
  };

  const handleSectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSector(e.target.value);
    setCity('');
  };

  const openAddModal = () => {
    setIsEditing(false); setEditId(null); 
    setName(''); setAgencyId(''); 
    setGovernorate(''); setSector(''); setCity(''); 
    setIsModalOpen(true);
  };

  const openEditModal = (branch: any) => {
    setIsEditing(true); setEditId(branch.id); 
    setName(branch.name); setAgencyId(branch.agency_id || ''); 
    setGovernorate(branch.governorate || ''); setSector(branch.sector || ''); setCity(branch.city || ''); 
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false); 
    setName(''); setAgencyId(''); 
    setGovernorate(''); setSector(''); setCity(''); 
    setEditId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const payload: any = { 
        name: name.trim(), 
        agency_id: agencyId || null, 
        governorate, 
        sector, 
        city
      };

      if (isEditing && editId) {
        const { error } = await supabase.from('branches').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('branches').insert([payload]);
        if (error) throw error;
      }
      
      await fetchData();
      closeModal();
    } catch (error: any) {
      alert("تأكد من تحديث جدول الفروع (branches) في Supabase لإضافة أعمدة (governorate, sector, city).\n" + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, branchName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الفرع (${branchName})؟`)) return;
    try {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
    } catch (error: any) {
      alert("لا يمكن حذف الفرع لوجود سجلات مرتبطة به.");
    }
  };

  const handleExportExcel = async () => {
    if (filteredBranches.length === 0) return alert("لا توجد بيانات لتصديرها.");
    setIsExportingExcel(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Enterprise B2B System';
      const worksheet = workbook.addWorksheet('قائمة الفروع', { views: [{ rightToLeft: true }] });

      const headers = ['ت', 'اسم الفرع', 'الوكالة التابع لها', 'عدد الطلبيات', 'المحافظة', 'القاطع', 'المدينة', 'الحالة'];
      
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `تقرير فروع المطبخ المركزي وعدد الطلبيات`;
      titleCell.font = { name: 'Cairo', size: 16, bold: true, color: { argb: 'FF0F172A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;
      worksheet.addRow([]); 

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; 
        cell.font = { name: 'Arial', color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      filteredBranches.forEach((branch, index) => {
        const rowData = [
          index + 1,
          branch.name,
          branch.agencies?.name || 'بدون وكالة',
          branch.requests?.length || 0,
          branch.governorate || '-',
          branch.sector || '-',
          branch.city || '-',
          branch.is_active !== false ? 'نشط' : 'موقوف'
        ];

        const dataRow = worksheet.addRow(rowData);
        const isEven = index % 2 === 0;
        const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        dataRow.eachCell((cell, colNum) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin', color: {argb: 'FFCBD5E1'} }, left: { style: 'thin', color: {argb: 'FFCBD5E1'} }, bottom: { style: 'thin', color: {argb: 'FFCBD5E1'} }, right: { style: 'thin', color: {argb: 'FFCBD5E1'} } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          if (colNum === 2) cell.font = { bold: true };
          if (colNum === 4) cell.font = { bold: true, color: { argb: 'FF4F46E5' } };
          if (colNum === 8) cell.font = { bold: true, color: { argb: branch.is_active !== false ? 'FF10B981' : 'FFE11D48' } };
        });
      });

      worksheet.columns.forEach((col, i) => {
        if (i === 0) col.width = 6;  
        else if (i === 1) col.width = 32; 
        else if (i === 2) col.width = 22; 
        else if (i === 3) col.width = 15; 
        else if (i === 4) col.width = 16; 
        else if (i === 5) col.width = 16; 
        else if (i === 6) col.width = 16; 
        else if (i === 7) col.width = 12; 
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `قائمة_الفروع_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (e) {
      alert("حدث خطأ أثناء تصدير ملف Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (filteredBranches.length === 0) return alert("لا توجد بيانات للتصدير.");
    setIsExportingPDF(true);
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;
      const dateStr = new Date().toLocaleDateString('ar-IQ');

      let tbody = '';
      filteredBranches.forEach((b, i) => {
        const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
        const statusColor = b.is_active !== false ? '#059669' : '#e11d48';
        const statusText = b.is_active !== false ? 'نشط' : 'موقوف';
        const locationText = b.governorate ? `${b.governorate} ${b.sector ? '- ' + b.sector : ''} ${b.city ? '- ' + b.city : ''}` : 'غير محدد';
        const ordersCount = b.requests?.length || 0;

        tbody += `
          <tr style="background-color: ${bg}; page-break-inside: avoid;">
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align:center; font-weight:bold; font-size: 14px;">${i + 1}</td>
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; font-weight:900; font-size: 15px;">${b.name}</td>
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align:center; font-size: 14px;">${b.agencies?.name || 'بدون وكالة'}</td>
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align:center; font-weight:900; font-size: 14px; color:#4f46e5;">${ordersCount}</td>
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align:center; font-size: 14px; color:#475569;">${locationText}</td>
            <td style="padding: 12px 10px; border: 1px solid #cbd5e1; text-align:center; font-weight:bold; font-size: 14px; color:${statusColor};">${statusText}</td>
          </tr>
        `;
      });

      const finalHTML = `
        <div id="pdf-wrapper" dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; padding: 40px 30px;">
          <h1 style="text-align:center; color:#0f172a; margin-bottom: 5px;">تقرير الفروع وعدد الطلبيات المسجلة</h1>
          <p style="text-align:center; color:#64748b; margin-bottom: 30px; font-weight:bold;">المرجع الزمني: ${dateStr} | إجمالي الفروع: ${filteredBranches.length}</p>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff;">
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">ت</th>
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">اسم الفرع</th>
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">الوكالة التابع لها</th>
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">عدد الطلبيات</th>
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">الموقع الجغرافي التفصيلي</th>
                <th style="padding: 15px 10px; border: 1px solid #cbd5e1;">حالة الفرع</th>
              </tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      `;

      const opt: any = {
        margin: 10, filename: `الفروع_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
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
      <div className={`min-h-screen font-sans relative transition-colors duration-300 ease-in-out ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-[130px]'}`} dir="rtl">
        
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] transition-colors duration-500 from-indigo-100/50 dark:from-indigo-900/15 via-transparent dark:via-[#050505] to-transparent dark:to-[#050505] -z-10 pointer-events-none transition-opacity ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 bg-white/80 dark:bg-white/5 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-4 text-right flex-1 w-full md:w-auto">
              <Link href="/hub" className="bg-slate-100 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none cursor-pointer active:scale-95">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
              <div className="bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-500/20 dark:to-indigo-900/40 border border-indigo-200 dark:border-indigo-500/30 w-14 h-14 rounded-[1.3rem] text-indigo-600 dark:text-indigo-400 shadow-inner flex items-center justify-center shrink-0">
                 <Store className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight mb-1 truncate transition-colors duration-300">إدارة الفروع</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 truncate">إدارة فروع المطاعم وتوزيعها الجغرافي.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button onClick={toggleTheme} className="p-3.5 rounded-2xl flex items-center justify-center transition-all border outline-none cursor-pointer active:scale-95 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm" title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}>
                {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
              </button>
              <button onClick={() => setIsZenMode(true)} className="p-3.5 rounded-2xl flex items-center justify-center transition-all border outline-none cursor-pointer active:scale-95 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400" title="وضع التركيز">
                <Eye className="w-5 h-5" />
              </button>
              <button onClick={openAddModal} className="w-full md:w-auto flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 h-14 rounded-[1.5rem] font-black text-sm shadow-[0_4px_15px_rgba(79,70,229,0.3)] dark:shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.4)] dark:hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] hover:scale-105 active:scale-95 transition-all outline-none border border-indigo-500 cursor-pointer">
                <Plus className="w-5 h-5" /> إضافة فرع جديد
              </button>
            </div>
          </div>

          {dbError && (
            <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-sm dark:shadow-md w-full transition-colors duration-300">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-500" />
              <p className="text-lg">{dbError}</p>
            </div>
          )}

          {!dbError && isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-5 w-full">
              <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
              <p className="text-slate-500 font-black tracking-widest text-sm uppercase">جاري تحميل الفروع...</p>
            </div>
          ) : !dbError && branches.length === 0 ? (
            <div className="py-24 text-center text-slate-500 bg-white dark:bg-[#121214] rounded-[2.5rem] border-2 border-dashed border-slate-300 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">
              <Store className="w-20 h-20 mx-auto mb-5 opacity-30 text-indigo-500" />
              <p className="text-2xl font-black text-slate-800 dark:text-white mb-2">لا توجد فروع مسجلة</p>
              <p className="text-sm font-bold text-slate-500">اضغط على زر الإضافة لإنشاء أول فرع.</p>
            </div>
          ) : !dbError && (
            
            <div className="w-full relative z-10">
              {/* العنوان وأزرار العرض والتصدير */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-5 px-2 gap-4">
                 <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 transition-colors duration-300">
                   قائمة الفروع
                   <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-500/20 shadow-sm dark:shadow-inner en-num">{filteredBranches.length}</span>
                 </h3>

                 <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                   <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-1.5 rounded-[1.2rem] shadow-sm dark:shadow-inner h-12 transition-colors duration-300">
                      <button onClick={handleExportPDF} disabled={isExportingPDF} title="تصدير كملف PDF" className="flex items-center justify-center gap-1.5 px-3 h-full rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-transparent dark:hover:border-rose-500/30 transition-all font-bold text-xs outline-none cursor-pointer active:scale-95 disabled:opacity-50">
                        {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
                      </button>
                      <button onClick={handleExportExcel} disabled={isExportingExcel} title="تصدير كملف Excel" className="flex items-center justify-center gap-1.5 px-3 h-full rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-transparent dark:hover:border-emerald-500/30 transition-all font-bold text-xs outline-none cursor-pointer active:scale-95 disabled:opacity-50">
                        {isExportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
                      </button>
                   </div>
                   <div className="w-px h-8 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
                   <div className="bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-1.5 rounded-[1.2rem] shadow-sm dark:shadow-inner flex gap-1 shrink-0 h-12 items-center transition-colors duration-300">
                     <button onClick={() => setLayoutView('grid')} className={`p-2 rounded-xl transition-all outline-none cursor-pointer active:scale-95 ${layoutView === 'grid' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-500/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-white/5'}`}><LayoutGrid className="w-4 h-4" /></button>
                     <button onClick={() => setLayoutView('table')} className={`p-2 rounded-xl transition-all outline-none cursor-pointer active:scale-95 ${layoutView === 'table' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-500/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-white/5'}`}><LayoutList className="w-4 h-4" /></button>
                   </div>
                 </div>
              </div>

              {/* تبويبات الفلترة حسب الوكالة */}
              <div className="flex flex-wrap items-center gap-2 mb-8 px-2">
                <button 
                  onClick={() => setSelectedAgencyFilter('الكل')}
                  style={selectedAgencyFilter === 'الكل' ? {
                    backgroundColor: '#4f46e5', color: '#ffffff', borderColor: '#4f46e5', boxShadow: `0 4px 15px ${hexToRgba('#4f46e5', 0.3)}`, transform: 'scale(1.02)'
                  } : {}}
                  className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-300 flex items-center gap-2 outline-none border cursor-pointer active:scale-95 ${selectedAgencyFilter !== 'الكل' ? 'bg-white dark:bg-[#0a0a0c] text-slate-600 dark:text-[#818cf8] border-slate-200 dark:border-[#4f46e5]/30 shadow-sm dark:shadow-[inset_0_0_10px_rgba(79,70,229,0.05)] hover:bg-slate-50 dark:hover:brightness-125' : ''}`}
                >
                  <Building2 className="w-4 h-4" /> كل الوكالات
                </button>
                
                {agencies.map(a => {
                  const isActive = selectedAgencyFilter === a.id;
                  const aColor = a.color || '#4f46e5';
                  return (
                    <button 
                      key={a.id}
                      onClick={() => setSelectedAgencyFilter(a.id)}
                      style={isActive ? {
                        backgroundColor: aColor, color: '#ffffff', borderColor: aColor, boxShadow: `0 4px 15px ${hexToRgba(aColor, 0.3)}`, transform: 'scale(1.02)'
                      } : {}}
                      className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-300 outline-none border cursor-pointer active:scale-95 ${!isActive ? 'bg-white dark:bg-[#0a0a0c] text-slate-600 dark:text-[#e2e8f0] border-slate-200 shadow-sm dark:shadow-none hover:bg-slate-50 dark:hover:brightness-125' : ''}`}
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = aColor; e.currentTarget.style.borderColor = aColor; } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = ''; } }}
                    >
                      {a.name}
                    </button>
                  )
                })}
              </div>

              {filteredBranches.length === 0 ? (
                 <div className="py-20 text-center text-slate-500 bg-white dark:bg-[#121214] rounded-[2.5rem] border border-dashed border-slate-300 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">
                   <Filter className="w-16 h-16 mx-auto mb-4 opacity-30 text-indigo-500" />
                   <p className="text-xl font-black text-slate-800 dark:text-white mb-2">لا توجد فروع مطابقة للفلتر</p>
                   <p className="text-sm font-bold text-slate-500">جرب اختيار وكالة أخرى أو إضافة فرع جديد.</p>
                 </div>
              ) : layoutView === 'grid' ? (
                /* العرض الشبكي */
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredBranches.map((branch) => {
                    const bColor = getBranchColor(branch.id);
                    const isBranchActive = branch.is_active !== false; 
                    const ordersCount = branch.requests?.length || 0;
                    
                    return (
                      <div 
                        key={branch.id} 
                        style={{ borderColor: hexToRgba(bColor, isBranchActive ? 0.3 : 0.1), boxShadow: isBranchActive ? `0 10px 30px -10px ${hexToRgba(bColor, 0.15)}` : 'none' }}
                        className={`bg-white dark:bg-[#121214] p-6 rounded-[2rem] border relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 flex flex-col ${!isBranchActive ? 'opacity-70 grayscale-[30%]' : ''}`}
                      >
                        <div className="absolute top-0 right-0 w-2 h-full rounded-r-3xl transition-colors duration-300" style={{ backgroundColor: bColor }}></div>
                        <div className="absolute top-0 left-0 w-32 h-32 rounded-full blur-[40px] -ml-10 -mt-10 opacity-20 pointer-events-none transition-colors duration-300" style={{ backgroundColor: bColor }}></div>

                        <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
                          <div className="flex items-start gap-4">
                            <div style={{ backgroundColor: hexToRgba(bColor, 0.1), color: bColor, borderColor: hexToRgba(bColor, 0.2) }} className="w-14 h-14 rounded-[1.2rem] border shadow-sm dark:shadow-inner shrink-0 flex items-center justify-center">
                              <Store className="w-7 h-7" />
                            </div>
                            <div className="pt-1 w-full overflow-hidden">
                              <h3 className="text-[17px] font-black text-slate-900 dark:text-white truncate mb-1" title={branch.name}>{branch.name}</h3>
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-lg inline-flex items-center gap-1.5 shadow-sm dark:shadow-inner">
                                <Building2 className="w-3.5 h-3.5" style={{ color: bColor }} />
                                {branch.agencies?.name || 'بدون وكالة'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 rounded-2xl p-2.5 px-3.5 flex items-center justify-between mb-3 relative z-10 shadow-sm dark:shadow-inner">
                          <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <ShoppingCart className="w-3.5 h-3.5" style={{ color: bColor }} /> عدد الطلبيات:
                          </span>
                          <span className="text-xs font-black bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 rounded-lg en-num shadow-sm dark:shadow-inner" style={{ color: bColor }}>
                            {ordersCount} طلبية
                          </span>
                        </div>

                        <div className="bg-slate-50 dark:bg-[#0a0a0c] p-3 rounded-2xl border border-slate-200 dark:border-white/5 mt-auto relative z-10 shadow-sm dark:shadow-inner group-hover:border-slate-300 dark:group-hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 mb-2 uppercase tracking-widest">
                            <MapPin className="w-3.5 h-3.5" /> الموقع الجغرافي
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[12px] font-bold text-slate-700 dark:text-slate-300">
                            {branch.governorate ? (
                              <>
                                <span className="bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent px-2 py-1 rounded-md shadow-sm dark:shadow-none">{branch.governorate}</span>
                                {branch.sector && <span className="bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent px-2 py-1 rounded-md shadow-sm dark:shadow-none">{branch.sector}</span>}
                                {branch.city && <span className="px-2 py-1 rounded-md shadow-sm dark:shadow-inner border" style={{ backgroundColor: hexToRgba(bColor, 0.1), color: bColor, borderColor: hexToRgba(bColor, 0.2) }}>{branch.city}</span>}
                              </>
                            ) : (
                              <span className="text-slate-500">غير محدد</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-4 relative z-10 pt-4 border-t border-slate-200 dark:border-white/5">
                          <button onClick={() => openEditModal(branch)} className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white py-2.5 rounded-xl text-[12px] font-black flex items-center justify-center gap-2 transition-colors outline-none cursor-pointer active:scale-95 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none">
                            <Edit2 className="w-4 h-4" /> تعديل
                          </button>
                          <button onClick={() => handleDelete(branch.id, branch.name)} className="w-12 h-10 shrink-0 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 rounded-xl flex items-center justify-center transition-colors outline-none cursor-pointer active:scale-95 border border-rose-200 dark:border-rose-500/20 shadow-sm dark:shadow-none">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* العرض العامودي */
                <div className="overflow-x-auto w-full custom-scrollbar pb-10 bg-white dark:bg-transparent rounded-[2rem] p-4 shadow-sm dark:shadow-none border border-slate-200 dark:border-transparent transition-colors duration-300">
                  <table className="w-full text-right border-separate" style={{ borderSpacing: '0 12px' }}>
                    <thead className="sticky top-0 z-20">
                      <tr className="text-slate-500 dark:text-slate-400 text-[12px] font-black uppercase tracking-widest">
                        <th className="px-6 w-16 text-center pb-2">#</th>
                        <th className="px-6 w-[28%] pb-2">اسم الفرع</th>
                        <th className="px-6 w-[22%] pb-2">الوكالة التابع لها</th>
                        <th className="px-6 w-28 text-center pb-2">عدد الطلبيات</th>
                        <th className="px-6 w-[28%] pb-2">الموقع الجغرافي</th>
                        <th className="px-6 w-32 text-center pb-2">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="text-[14px]">
                      {filteredBranches.map((branch, idx) => {
                        const bColor = getBranchColor(branch.id);
                        const isBranchActive = branch.is_active !== false;
                        const ordersCount = branch.requests?.length || 0;
                        
                        return (
                          <tr key={branch.id} className={`bg-slate-50 dark:bg-[#121214] shadow-sm dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)] hover:bg-slate-100 dark:hover:bg-[#1e1e2d] hover:-translate-y-0.5 transition-all duration-300 group ${!isBranchActive ? 'opacity-70 grayscale-[30%]' : ''}`}>
                            <td className="py-4 px-6 text-center rounded-r-[2rem] border-y border-r border-slate-200 dark:border-white/5 text-slate-500 font-bold en-num">{idx + 1}</td>
                            <td className="py-4 px-6 border-y border-slate-200 dark:border-white/5">
                              <div className="flex items-center gap-4">
                                <div style={{ backgroundColor: hexToRgba(bColor, 0.1), color: bColor, borderColor: hexToRgba(bColor, 0.2) }} className="w-10 h-10 rounded-[1rem] border shadow-inner shrink-0 flex items-center justify-center">
                                  <Store className="w-5 h-5" />
                                </div>
                                <h4 className="font-black text-[15px] text-slate-900 dark:text-white truncate max-w-[200px]" title={branch.name}>{branch.name}</h4>
                              </div>
                            </td>
                            <td className="py-4 px-6 border-y border-slate-200 dark:border-white/5">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-xl inline-flex items-center gap-2 shadow-sm dark:shadow-inner">
                                <Building2 className="w-4 h-4" style={{ color: bColor }} />
                                {branch.agencies?.name || 'بدون وكالة'}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center border-y border-slate-200 dark:border-white/5">
                              <span className="text-xs font-black bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1 rounded-xl en-num shadow-sm dark:shadow-inner" style={{ color: bColor }}>{ordersCount}</span>
                            </td>
                            <td className="py-4 px-6 border-y border-slate-200 dark:border-white/5">
                              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                {branch.governorate ? (
                                  <>
                                    <span className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 px-2 py-1 rounded-md shadow-sm dark:shadow-none">{branch.governorate}</span>
                                    {branch.sector && <span className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 px-2 py-1 rounded-md shadow-sm dark:shadow-none">{branch.sector}</span>}
                                    {branch.city && <span className="px-2 py-1 rounded-md shadow-sm dark:shadow-inner border" style={{ backgroundColor: hexToRgba(bColor, 0.1), color: bColor, borderColor: hexToRgba(bColor, 0.2) }}>{branch.city}</span>}
                                  </>
                                ) : <span className="text-slate-500">غير محدد</span>}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center rounded-l-[2rem] border-y border-l border-slate-200 dark:border-white/5">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => openEditModal(branch)} className="p-2.5 bg-white dark:bg-white/5 hover:bg-slate-200 text-slate-700 dark:hover:bg-white/10 dark:text-white rounded-xl transition-colors outline-none cursor-pointer active:scale-95 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDelete(branch.id, branch.name)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 text-rose-600 dark:hover:bg-rose-500/20 dark:text-rose-400 rounded-xl transition-colors outline-none cursor-pointer active:scale-95 border border-rose-200 dark:border-rose-500/20 shadow-sm dark:shadow-none" title="حذف"><Trash2 className="w-4 h-4" /></button>
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

        {/* زر إنهاء وضع التركيز */}
        {isZenMode && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-bottom-10 fade-in duration-500 no-print">
            <button 
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-6 py-3.5 rounded-full font-black text-sm shadow-[0_10px_40px_rgba(0,0,0,0.2)] hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer whitespace-nowrap"
            >
              <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

      </div>

      {/* النافذة المنبثقة (Modal) 💡 تـم تعديلها لضمان التوسيط وعدم الخروج من الشاشة 💡 */}
      {isMounted && isModalOpen && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-[420px] max-h-[90vh] bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* الهيدر الثابت */}
            <div className="flex justify-between items-center p-5 md:p-6 border-b border-slate-200 dark:border-white/5 shrink-0 bg-slate-50 dark:bg-[#0a0a0c]">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                {isEditing ? <><Edit2 className="w-5 h-5 text-amber-500 dark:text-amber-400" /> تعديل فرع</> : <><Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> إضافة فرع جديد</>}
              </h3>
              <button onClick={closeModal} className="p-2 bg-white dark:bg-white/5 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 dark:hover:text-rose-400 rounded-xl transition-colors outline-none cursor-pointer active:scale-95 border border-slate-200 dark:border-white/10 shadow-sm">
                <X className="w-4 h-4"/>
              </button>
            </div>
            
            {/* المحتوى القابل للتمرير */}
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-4">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-indigo-500" /> اسم الفرع <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="مثال: فرع المنصور الرئيسي..." 
                    className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 focus:border-indigo-500/50 rounded-xl h-12 px-4 outline-none transition-all font-bold text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner focus:ring-2 focus:ring-indigo-500/20" 
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" /> الوكالة التابع لها
                  </label>
                  <div className="relative">
                    <select 
                      value={agencyId} 
                      onChange={(e) => setAgencyId(e.target.value)} 
                      className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 focus:border-indigo-500/50 rounded-xl h-12 pl-4 pr-10 outline-none transition-all font-bold text-[13px] text-slate-900 dark:text-white shadow-inner focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-white dark:bg-[#121214] text-slate-500">-- اختر الوكالة --</option>
                      {agencies.map(a => (
                        <option key={a.id} value={a.id} className="bg-white dark:bg-[#121214] font-bold">{a.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-[14px] w-4 h-4 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-white/5 pt-4 mt-2">
                  <label className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                    <Map className="w-3.5 h-3.5 text-indigo-500" /> الموقع الجغرافي للفرع
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    
                    <div className="relative">
                      <select value={governorate} onChange={handleGovernorateChange} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 focus:border-indigo-500/50 rounded-xl h-12 pl-4 pr-10 outline-none transition-all font-bold text-[12px] text-slate-900 dark:text-white shadow-inner focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer">
                        <option value="" className="bg-white dark:bg-[#121214] text-slate-500">-- اختر المحافظة --</option>
                        {availableGovernorates.map(gov => <option key={gov} value={gov} className="bg-white dark:bg-[#121214]">{gov}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-[14px] w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>

                    <div className="relative">
                      <select value={sector} onChange={handleSectorChange} disabled={!governorate} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 focus:border-indigo-500/50 rounded-xl h-12 pl-4 pr-10 outline-none transition-all font-bold text-[12px] text-slate-900 dark:text-white shadow-inner focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                        <option value="" className="bg-white dark:bg-[#121214] text-slate-500">-- اختر القاطع --</option>
                        {availableSectors.map(sec => <option key={sec} value={sec} className="bg-white dark:bg-[#121214]">{sec}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-[14px] w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>

                    <div className="relative">
                      <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!sector} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 focus:border-indigo-500/50 rounded-xl h-12 pl-4 pr-10 outline-none transition-all font-bold text-[12px] text-slate-900 dark:text-white shadow-inner focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                        <option value="" className="bg-white dark:bg-[#121214] text-slate-500">-- اختر المدينة / المنطقة --</option>
                        {availableCities.map(c => <option key={c} value={c} className="bg-white dark:bg-[#121214]">{c}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-[14px] w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>

                  </div>
                </div>

              </div>

              {/* الأزرار السفلية الثابتة */}
              <div className="flex items-center gap-3 p-5 md:p-6 border-t border-slate-100 dark:border-white/5 shrink-0 bg-slate-50 dark:bg-[#0a0a0c]">
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="flex-1 bg-indigo-600 text-white h-12 rounded-[1rem] font-black text-[14px] shadow-[0_4px_15px_rgba(79,70,229,0.2)] dark:shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.4)] dark:hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] transition-all outline-none cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ البيانات'}
                </button>
                <button 
                  type="button" 
                  onClick={closeModal} 
                  disabled={isSaving}
                  className="px-6 h-12 bg-white dark:bg-[#121214] hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-[1rem] font-black text-[14px] transition-colors outline-none cursor-pointer active:scale-95 border border-slate-200 dark:border-white/10 hover:border-rose-200 dark:hover:border-rose-500/20 disabled:opacity-50 shadow-sm"
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
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
      `}} />
    </div>
  );
}