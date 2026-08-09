"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // 👈 لكسر قيود النافذة وتغطية الشريط السفلي
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Building2, Plus, Edit2, Trash2, Loader2, X, AlertCircle, LayoutGrid, Palette, Type,
  Image as ImageIcon, Store, Package, Power, Check, Sun, Moon // 👈 أيقونات الوضع الليلي
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider'; // 👈 استيراد الثيم الرئيسي

// مجموعة ألوان مميزة ومناسبة للتصميم
const colorPresets = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'
];

// دالة جمالية لتحويل اللون إلى شفاف علمود الوهج (Glow)
const hexToRgba = (hex: string, alpha: number = 1) => {
  let r = 59, g = 130, b = 246; 
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

export default function AgenciesPage() {
  const [agencies, setAgencies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [color, setColor] = useState(colorPresets[0]);
  const [logoUrl, setLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  // 👈 سحب الوضع الليلي والنهاري من الثيم الرئيسي
  const { isDark, toggleTheme } = useTheme();

  // منع تمرير الصفحة عند فتح النافذة
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  const fetchAgencies = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('*, branches(id), items(id)')
        .order('name');
      
      if (error) throw error;
      setAgencies(data || []);
    } catch (err: any) {
      setDbError(err?.message || "لا يمكن الاتصال بقاعدة البيانات. (تأكد من وجود الأعمدة is_active و logo_url)");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchAgencies();
  }, []);

  const openAddModal = () => {
    setIsEditing(false); 
    setEditId(null); 
    setName(''); 
    setColor(colorPresets[0]); 
    setLogoUrl('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (agency: any) => {
    setIsEditing(true); 
    setEditId(agency.id); 
    setName(agency.name || ''); 
    setColor(agency.color || colorPresets[0]); 
    setLogoUrl(agency.logo_url || '');
    setIsActive(agency.is_active !== false); 
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false); 
    setName(''); 
    setEditId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const payload = { 
        name, 
        color, 
        logo_url: logoUrl.trim() || null, 
        is_active: isActive 
      };

      if (isEditing && editId) {
        const { error } = await supabase.from('agencies').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('agencies').insert([payload]);
        if (error) throw error;
      }
      
      await fetchAgencies();
      closeModal();
    } catch (error: any) {
      alert("حدث خطأ أثناء الحفظ: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, agencyName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الوكالة (${agencyName || 'بدون اسم'})؟`)) return;
    try {
      const { error } = await supabase.from('agencies').delete().eq('id', id);
      if (error) throw error;
      await fetchAgencies();
    } catch (error: any) {
      alert("لا يمكن حذف الوكالة لارتباطها بفروع أو أصناف أخرى.");
    }
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white font-sans relative overflow-x-hidden pb-40" dir="rtl">
        
        {/* خلفية بوهج أزرق خفيف */}
        <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] transition-colors duration-500 from-blue-200/50 via-slate-50 to-slate-50 dark:from-blue-900/15 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none"></div>

        <div className="p-4 md:p-8 max-w-[100rem] mx-auto w-full relative z-10">
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 bg-white/80 dark:bg-white/5 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-4 text-right flex-1 w-full md:w-auto">
              <Link href="/hub" className="bg-slate-100 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none cursor-pointer active:scale-95">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>

              <div className="bg-gradient-to-br from-blue-400/20 dark:from-blue-500/20 to-indigo-600/30 dark:to-blue-900/40 border border-blue-400/30 dark:border-blue-500/30 w-14 h-14 rounded-[1.3rem] text-blue-600 dark:text-blue-400 shadow-inner flex items-center justify-center shrink-0">
                 <Building2 className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight mb-1 truncate">الوكالات</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 truncate">إدارة الشركات والوكالات الرئيسية.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto">
              <div className="flex flex-wrap items-center justify-end gap-3 w-full">
                
                {/* 👈 زر التبديل بين الوضع الليلي والنهاري */}
                <button onClick={toggleTheme} className="p-3.5 rounded-2xl flex items-center justify-center transition-all border outline-none cursor-pointer active:scale-95 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm" title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}>
                  {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
                </button>

                <button 
                  onClick={openAddModal}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-6 h-14 rounded-[1.5rem] font-black text-sm shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:scale-105 active:scale-95 transition-all outline-none border border-blue-500 cursor-pointer"
                >
                  <Plus className="w-5 h-5" /> إضافة وكالة
                </button>
              </div>
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
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
              <p className="text-slate-500 font-black tracking-widest text-sm uppercase">جاري تحميل الوكالات...</p>
            </div>
          ) : !dbError && agencies.length === 0 ? (
            <div className="py-24 text-center text-slate-500 bg-white dark:bg-[#121214] rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner">
              <Building2 className="w-20 h-20 mx-auto mb-5 opacity-30 text-blue-500" />
              <p className="text-2xl font-black text-slate-900 dark:text-white mb-2">لا توجد وكالات مسجلة</p>
              <p className="text-sm font-bold text-slate-500">اضغط على زر الإضافة لإنشاء أول وكالة.</p>
            </div>
          ) : !dbError && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {agencies.map((agency) => {
                const aColor = agency.color || colorPresets[0];
                const isAgencyActive = agency.is_active !== false;
                
                return (
                  <div 
                    key={agency.id} 
                    style={{ borderColor: isDark ? hexToRgba(aColor, isAgencyActive ? 0.3 : 0.1) : hexToRgba(aColor, isAgencyActive ? 0.4 : 0.2), boxShadow: isAgencyActive ? `0 10px 30px -10px ${hexToRgba(aColor, 0.15)}` : 'none' }}
                    className={`bg-white dark:bg-[#121214] p-6 rounded-[2rem] border relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 flex flex-col shadow-sm ${!isAgencyActive ? 'opacity-70 grayscale-[30%]' : ''}`}
                  >
                    <div className="absolute top-0 right-0 w-2 h-full rounded-r-3xl transition-colors duration-300" style={{ backgroundColor: aColor }}></div>
                    <div className="absolute top-0 left-0 w-32 h-32 rounded-full blur-[40px] -ml-10 -mt-10 opacity-20 pointer-events-none transition-colors duration-300" style={{ backgroundColor: aColor }}></div>

                    <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
                      <div className="flex items-start gap-4">
                        {agency.logo_url ? (
                          <div className="w-16 h-16 rounded-[1.2rem] bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-2 shadow-sm dark:shadow-inner shrink-0 flex items-center justify-center overflow-hidden">
                            <img src={agency.logo_url} alt={agency.name} className="max-w-full max-h-full object-contain drop-shadow-md" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          </div>
                        ) : (
                          <div style={{ backgroundColor: isDark ? hexToRgba(aColor, 0.1) : hexToRgba(aColor, 0.05), color: aColor, borderColor: isDark ? hexToRgba(aColor, 0.2) : hexToRgba(aColor, 0.1) }} className="w-16 h-16 rounded-[1.2rem] border shadow-inner shrink-0 flex items-center justify-center">
                            <Building2 className="w-8 h-8" />
                          </div>
                        )}
                        
                        <div className="pt-1 w-full overflow-hidden">
                          <h3 className="text-[17px] font-black text-slate-900 dark:text-white truncate mb-1" title={agency.name}>{agency.name || 'بدون اسم'}</h3>
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1"><Palette className="w-3.5 h-3.5" /></span>
                            <span className="px-2 py-0.5 rounded-md text-white dark:text-black en-num shadow-sm" style={{ backgroundColor: aColor }}>{aColor.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border shadow-inner ${isAgencyActive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20'}`}>
                         <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'currentColor' }}></span>
                         {isAgencyActive ? 'نشط' : 'موقوف'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                       <div className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm dark:shadow-inner group-hover:border-blue-300 dark:group-hover:border-white/10 transition-colors">
                         <Store className="w-4 h-4 text-slate-400 mb-1.5" />
                         <span className="text-lg font-black text-slate-900 dark:text-white en-num">{agency.branches?.length || 0}</span>
                         <span className="text-[10px] font-bold text-slate-500">فرع مرتبط</span>
                       </div>
                       <div className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm dark:shadow-inner group-hover:border-blue-300 dark:group-hover:border-white/10 transition-colors">
                         <Package className="w-4 h-4 text-slate-400 mb-1.5" />
                         <span className="text-lg font-black text-slate-900 dark:text-white en-num">{agency.items?.length || 0}</span>
                         <span className="text-[10px] font-bold text-slate-500">صنف مخصص</span>
                       </div>
                    </div>

                    <div className="flex items-center gap-2 mt-auto relative z-10 pt-4 border-t border-slate-100 dark:border-white/5">
                      <button 
                        onClick={() => openEditModal(agency)}
                        className="flex-1 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-white py-2.5 rounded-xl text-[12px] font-black flex items-center justify-center gap-2 transition-colors outline-none cursor-pointer active:scale-95 border border-slate-200 dark:border-white/5"
                      >
                        <Edit2 className="w-4 h-4" /> تعديل
                      </button>
                      <button 
                        onClick={() => handleDelete(agency.id, agency.name)}
                        className="w-12 h-10 shrink-0 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center transition-colors outline-none cursor-pointer active:scale-95 border border-rose-200 dark:border-rose-500/20"
                        title="حذف الوكالة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 🟢 النافذة المنبثقة الحرة (Modal) المدمجة بالـ Portal 🟢 */}
        {isMounted && isModalOpen && createPortal(
          <div className={`fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 font-sans ${isDark ? 'dark' : ''}`} dir="rtl">
            <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-5 md:p-6 rounded-[2rem] w-full max-w-[420px] shadow-2xl dark:shadow-[0_0_50px_rgba(59,130,246,0.15)] animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden relative">
              
              {/* هيدر المودل */}
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-white/5 pb-4 shrink-0">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  {isEditing ? <><Edit2 className="w-5 h-5 text-amber-500 dark:text-amber-400" /> تعديل وكالة</> : <><Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" /> إضافة وكالة</>}
                </h3>
                <button onClick={closeModal} className="p-2 bg-slate-100 dark:bg-white/5 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors outline-none cursor-pointer active:scale-95">
                  <X className="w-4 h-4"/>
                </button>
              </div>
              
              {/* فورم المودل (مصغر وملموم) */}
              <form onSubmit={handleSave} className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
                
                {/* حقل الاسم */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" /> اسم الوكالة <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    autoFocus // 👈 تركيز تلقائي مباشر
                    required
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="مثال: كودو كودو..." 
                    className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 focus:border-blue-400 dark:focus:border-blue-500/50 rounded-xl h-12 px-4 outline-none transition-all font-bold text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm dark:shadow-inner focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20" 
                  />
                </div>

                {/* 💡 حقل الشعار (Logo) 💡 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" /> رابط الشعار (URL)</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-600 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-transparent">اختياري</span>
                  </label>
                  <input 
                    type="url" 
                    value={logoUrl} 
                    onChange={(e) => setLogoUrl(e.target.value)} 
                    placeholder="https://example.com/logo.png" 
                    dir="ltr"
                    className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 focus:border-blue-400 dark:focus:border-blue-500/50 rounded-xl h-12 px-4 outline-none transition-all font-bold text-[12px] text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm dark:shadow-inner focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20" 
                  />
                  {logoUrl && (
                    <div className="mt-1 p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5 flex items-center justify-center min-h-[40px] shadow-sm dark:shadow-none">
                      <img src={logoUrl} alt="Preview" className="h-8 object-contain drop-shadow-md" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    </div>
                  )}
                </div>

                {/* 💡 حقل اللون مع منتقي الألوان الحر 💡 */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" /> اللون المميز للوكالة
                  </label>
                  <div className="flex items-center justify-center gap-2.5 p-3 bg-slate-50 dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                    {colorPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setColor(preset)}
                        className={`w-8 h-8 rounded-full transition-all duration-300 outline-none cursor-pointer ${color === preset ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-60 dark:opacity-50 hover:opacity-100 hover:scale-105'}`}
                        style={{ 
                          backgroundColor: preset, 
                          boxShadow: color === preset ? `0 0 10px ${preset}` : 'none' 
                        }}
                      />
                    ))}
                    <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-0.5"></div>
                    <div className={`relative w-8 h-8 rounded-full overflow-hidden shrink-0 transition-all ${!colorPresets.includes(color) ? 'ring-2 ring-white scale-110 shadow-lg' : 'border-2 border-slate-300 dark:border-white/20 hover:scale-105'}`}>
                       <input 
                         type="color" 
                         value={color} 
                         onChange={e => setColor(e.target.value)} 
                         className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer outline-none" 
                       />
                    </div>
                  </div>
                </div>

                {/* 💡 حقل حالة الوكالة 💡 */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#0a0a0c] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                    <div>
                      <h4 className="text-[13px] font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Power className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-500'}`} /> حالة الوكالة
                      </h4>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{isActive ? 'الوكالة نشطة وتظهر في النظام.' : 'الوكالة موقوفة ومخفية.'}</p>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer active:scale-95 transition-transform">
                      <input type="checkbox" className="sr-only peer" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                      <div className="w-12 h-6 bg-slate-300 dark:bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner flex items-center justify-between px-1.5">
                        <Check className={`w-2.5 h-2.5 text-emerald-800 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                        <X className={`w-2.5 h-2.5 text-slate-400 ${!isActive ? 'opacity-100' : 'opacity-0'}`} />
                      </div>
                    </label>
                  </div>
                </div>

                {/* أزرار الحفظ والإلغاء */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-white/5 shrink-0 mt-2">
                  <button 
                    type="submit" 
                    disabled={isSaving} 
                    className="flex-1 bg-blue-600 text-white h-12 rounded-[1rem] font-black text-[14px] shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] transition-all outline-none cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ البيانات'}
                  </button>
                  <button 
                    type="button" 
                    onClick={closeModal} 
                    disabled={isSaving}
                    className="px-6 h-12 bg-slate-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-[1rem] font-black text-[14px] transition-colors outline-none cursor-pointer active:scale-95 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 disabled:opacity-50"
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