"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, UploadCloud, Building2, Image as ImageIcon, Trash2 } from 'lucide-react';

export default function AgenciesSettingsPage() {
  const [agencies, setAgencies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('agencies').select('*').order('name');
    if (!error && data) setAgencies(data);
    setIsLoading(false);
  };

  const handleLogoUpload = async (event: any, agencyId: string) => {
    try {
      setUploadingId(agencyId);
      const file = event.target.files[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${agencyId}_${Date.now()}.${fileExt}`;

      // رفع الصورة للـ Storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // أخذ الرابط العام للصورة
      const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      const logoUrl = publicUrlData.publicUrl;

      // تحديث الجدول بالرابط
      const { error: updateError } = await supabase
        .from('agencies')
        .update({ logo_url: logoUrl })
        .eq('id', agencyId);

      if (updateError) throw updateError;

      alert("تم رفع اللوجو بنجاح! 🚀");
      fetchAgencies(); 
    } catch (error: any) {
      alert("حدث خطأ أثناء الرفع: " + error.message);
    } finally {
      setUploadingId(null);
    }
  };

  // 💡 دالة جديدة لحذف اللوجو 💡
  const handleLogoDelete = async (agencyId: string, logoUrl: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا اللوجو؟")) return;

    try {
      setDeletingId(agencyId);

      // مسح الصورة من التخزين لتوفير المساحة
      try {
        const urlParts = logoUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from('logos').remove([fileName]);
      } catch (e) {
        console.log("Error removing file from storage, proceeding to update DB...", e);
      }

      // تحديث الجدول وإزالة الرابط
      const { error: updateError } = await supabase
        .from('agencies')
        .update({ logo_url: null })
        .eq('id', agencyId);

      if (updateError) throw updateError;

      alert("تم حذف اللوجو بنجاح! 🗑️");
      fetchAgencies(); 
    } catch (error: any) {
      alert("حدث خطأ أثناء الحذف: " + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto font-sans" dir="rtl">
      <div className="flex items-center gap-4 mb-8 border-b pb-4">
        <div className="p-4 bg-sky-100 text-sky-600 rounded-2xl"><Building2 className="w-8 h-8" /></div>
        <div>
          <h1 className="text-3xl font-black text-slate-800">إدارة الوكالات واللوجوات</h1>
          <p className="text-slate-500 font-bold mt-1">ارفع اللوجو الخاص بكل وكالة ليتم طباعته تلقائياً في الفواتير.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agencies.map((agency) => (
          <div key={agency.id} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex items-center gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-3 h-full" style={{ backgroundColor: agency.color || '#0284c7' }}></div>
            
            <div className="w-28 h-28 shrink-0 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group">
              {agency.logo_url ? (
                <>
                  <img src={agency.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                  
                  {/* 💡 خيارات الرفع والحذف تظهر عند تمرير الماوس 💡 */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                    <label className="flex flex-col items-center justify-center text-white cursor-pointer hover:text-sky-300 transition-colors p-2">
                      {uploadingId === agency.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                      <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleLogoUpload(e, agency.id)} disabled={uploadingId === agency.id || deletingId === agency.id} />
                    </label>
                    
                    <div className="w-px h-6 bg-white/30"></div>
                    
                    <button 
                      onClick={() => handleLogoDelete(agency.id, agency.logo_url)}
                      disabled={deletingId === agency.id || uploadingId === agency.id}
                      className="flex flex-col items-center justify-center text-white cursor-pointer hover:text-rose-400 transition-colors p-2"
                      title="حذف اللوجو"
                    >
                      {deletingId === agency.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                  <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity">
                    {uploadingId === agency.id ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                    <span className="text-[10px] font-bold mt-1">رفع اللوجو</span>
                    <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={(e) => handleLogoUpload(e, agency.id)} disabled={uploadingId === agency.id} />
                  </label>
                </>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-black text-slate-700 mb-1">{agency.name}</h2>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs font-bold text-slate-500">لون الوكالة:</span>
                <div className="w-6 h-6 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: agency.color || '#0284c7' }}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}