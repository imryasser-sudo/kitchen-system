"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Settings, Clock, Lock, Key, Store, Loader2, Save, 
  ShieldCheck, AlertTriangle, CheckCircle2, User, Building2,
  Users, UserCheck, LayoutPanelLeft, ChevronLeft, CalendarClock,
  Eye, EyeOff, Bell
} from 'lucide-react';

export default function OrderPortalSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // إعدادات البوابة
  const [portalStatus, setPortalStatus] = useState<'مفتوح دائم' | 'مغلق' | 'مجدول'>('مفتوح دائم');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('23:00');

  // التبويبات الجانبية
  const [activeTab, setActiveTab] = useState<'portal' | 'branches' | 'staff'>('portal');

  // البيانات
  const [branches, setBranches] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);

  // حالة تتبع إظهار/إخفاء كلمات المرور
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data: settingsData } = await supabase.from('order_portal_settings').select('*').single();
      if (settingsData) {
        setPortalStatus(settingsData.status);
        setOpenTime(settingsData.open_time);
        setCloseTime(settingsData.close_time);
      }

      const [branchesRes, agenciesRes, staffRes] = await Promise.all([
        supabase.from('branches').select('*').order('name'),
        supabase.from('agencies').select('*').order('name'),
        supabase.from('staff').select('*').eq('status', 'نشط').order('full_name')
      ]);

      if (branchesRes.data) setBranches(branchesRes.data);
      if (agenciesRes.data) setAgencies(agenciesRes.data);
      if (staffRes.data) setStaffList(staffRes.data);

    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const savePortalSettings = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('order_portal_settings').upsert({
        id: 1, status: portalStatus, open_time: openTime, close_time: closeTime
      });
      if (error) throw error;
      alert('تم حفظ إعدادات البوابة بنجاح!');
    } catch (err: any) {
      alert(`حدث خطأ أثناء حفظ الإعدادات: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBranchUpdate = (id: string, field: string, value: string) => {
    setBranches(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const saveBranchCredentials = async (branch: any) => {
    if (!branch.username) return alert('اسم المستخدم مطلوب');
    if (!branch.agency_id) return alert('يرجى تحديد الوكالة التي يتبع لها هذا الفرع');
    
    const isDuplicate = branches.some(b => b.id !== branch.id && b.username === branch.username);
    if (isDuplicate) return alert('اسم المستخدم محجوز لفرع آخر، يرجى اختيار اسم مختلف.');

    try {
      const { error } = await supabase.from('branches')
        .update({ username: branch.username, password: branch.password, agency_id: branch.agency_id })
        .eq('id', branch.id);
      
      if (error) throw error;
      alert(`تم حفظ بيانات الدخول والوكالة لـ ${branch.name}`);
    } catch (err: any) {
      if (err.code === '23505') alert('اسم المستخدم محجوز مسبقاً في قاعدة البيانات!');
      else alert(`حدث خطأ: ${err.message}`);
    }
  };

  const handleStaffUpdate = (id: string, field: string, value: any) => {
    setStaffList(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const saveStaffCredentials = async (staffMember: any) => {
    if (!staffMember.username) return alert('اسم المستخدم مطلوب للموظف');
    
    const isDuplicate = staffList.some(s => s.id !== staffMember.id && s.username === staffMember.username);
    if (isDuplicate) return alert('اسم المستخدم محجوز لموظف آخر.');

    try {
      const { error } = await supabase.from('staff')
        .update({ 
          username: staffMember.username, 
          password: staffMember.password, 
          can_approve_orders: staffMember.can_approve_orders || false,
          can_manage_catalog: staffMember.can_manage_catalog || false, 
          can_view_reports: staffMember.can_view_reports || false,
          can_view_kitchen_only: staffMember.can_view_kitchen_only || false,
          receives_order_alerts: staffMember.receives_order_alerts || false
        })
        .eq('id', staffMember.id);
      
      if (error) throw error;
      alert(`تم حفظ بيانات وصلاحيات الموظف: ${staffMember.full_name}`);
    } catch (err: any) {
      if (err.code === '23505') alert('اسم المستخدم محجوز مسبقاً!');
      else alert(`حدث خطأ: ${err.message}`);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 font-sans pb-32 relative" dir="rtl">
      
      {/* 🌟 الخلفية المظلمة والتأثيرات 🌟 */}
      <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#050505] to-[#050505] -z-10 pointer-events-none"></div>

      <div className="max-w-[85rem] mx-auto relative z-10">
        
        {/* 🌟 الهيدر الاحترافي 🌟 */}
        <div className="mb-10 bg-[#121214]/80 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-white/5 shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-4 text-right">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 w-14 h-14 rounded-[1.3rem] text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center shrink-0">
              <Settings className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">إعدادات النظام والبوابة</h1>
              <p className="text-[13px] font-bold text-slate-400 mt-1">التحكم المركزي في أوقات العمل، صلاحيات الفروع، وكادر المطبخ</p>
            </div>
          </div>
        </div>

        {/* 🌟 الهيكل الرئيسي: قائمة يمنى + محتوى يسار 🌟 */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* القائمة الجانبية للإعدادات */}
          <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3 sticky top-8">
            <button 
              onClick={() => setActiveTab('portal')}
              className={`flex items-center justify-between w-full p-4 rounded-2xl transition-all duration-300 font-black text-[14px] outline-none ${activeTab === 'portal' ? 'bg-[#121214] shadow-[0_0_20px_rgba(99,102,241,0.2)] border border-indigo-500/50 text-indigo-400 scale-[1.02]' : 'bg-[#0a0a0c] text-slate-400 hover:bg-white/5 hover:text-white border border-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${activeTab === 'portal' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[#121214] text-slate-500 border border-white/5'}`}><CalendarClock className="w-4 h-4"/></div>
                حالة عمل البوابة
              </div>
              {activeTab === 'portal' && <ChevronLeft className="w-4 h-4 opacity-50"/>}
            </button>

            <button 
              onClick={() => setActiveTab('branches')}
              className={`flex items-center justify-between w-full p-4 rounded-2xl transition-all duration-300 font-black text-[14px] outline-none ${activeTab === 'branches' ? 'bg-[#121214] shadow-[0_0_20px_rgba(59,130,246,0.2)] border border-blue-500/50 text-blue-400 scale-[1.02]' : 'bg-[#0a0a0c] text-slate-400 hover:bg-white/5 hover:text-white border border-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${activeTab === 'branches' ? 'bg-blue-500/20 text-blue-400' : 'bg-[#121214] text-slate-500 border border-white/5'}`}><Store className="w-4 h-4"/></div>
                صلاحيات الفروع
              </div>
              {activeTab === 'branches' && <ChevronLeft className="w-4 h-4 opacity-50"/>}
            </button>

            <button 
              onClick={() => setActiveTab('staff')}
              className={`flex items-center justify-between w-full p-4 rounded-2xl transition-all duration-300 font-black text-[14px] outline-none ${activeTab === 'staff' ? 'bg-[#121214] shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-500/50 text-emerald-400 scale-[1.02]' : 'bg-[#0a0a0c] text-slate-400 hover:bg-white/5 hover:text-white border border-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl transition-colors ${activeTab === 'staff' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#121214] text-slate-500 border border-white/5'}`}><Users className="w-4 h-4"/></div>
                صلاحيات الكادر
              </div>
              {activeTab === 'staff' && <ChevronLeft className="w-4 h-4 opacity-50"/>}
            </button>
          </div>

          {/* مساحة المحتوى */}
          <div className="flex-1 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* 🟢 قسم حالة البوابة 🟢 */}
            {activeTab === 'portal' && (
              <div className="bg-[#121214] rounded-[2rem] p-6 md:p-8 shadow-lg border border-white/10">
                <div className="mb-8 border-b border-white/5 pb-6">
                  <h3 className="font-black text-white text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-400" /> توقيتات بوابة الفروع
                  </h3>
                  <p className="text-[12px] font-bold text-slate-400 mt-2">حدد متى يمكن لمدراء الفروع الدخول وتقديم الطلبيات للمطبخ المركزي.</p>
                </div>
                
                <div className="space-y-4 mb-8">
                  {/* كارت مفتوح دائم */}
                  <div 
                    onClick={() => setPortalStatus('مفتوح دائم')}
                    className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group overflow-hidden ${portalStatus === 'مفتوح دائم' ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-white/5 hover:border-white/20 bg-[#050505]'}`}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${portalStatus === 'مفتوح دائم' ? 'border-indigo-400' : 'border-slate-600'}`}>
                        {portalStatus === 'مفتوح دائم' && <div className="w-3 h-3 bg-indigo-400 rounded-full" />}
                      </div>
                      <div>
                        <h4 className={`font-black text-[15px] transition-colors ${portalStatus === 'مفتوح دائم' ? 'text-indigo-300' : 'text-slate-300'}`}>مفتوح دائم (24/7)</h4>
                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">يمكن للفروع إرسال الطلبات في أي وقت دون قيود.</p>
                      </div>
                    </div>
                  </div>

                  {/* كارت مجدول */}
                  <div 
                    onClick={() => setPortalStatus('مجدول')}
                    className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all group overflow-hidden ${portalStatus === 'مجدول' ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-white/5 hover:border-white/20 bg-[#050505]'}`}
                  >
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${portalStatus === 'مجدول' ? 'border-amber-400' : 'border-slate-600'}`}>
                          {portalStatus === 'مجدول' && <div className="w-3 h-3 bg-amber-400 rounded-full" />}
                        </div>
                        <div>
                          <h4 className={`font-black text-[15px] transition-colors ${portalStatus === 'مجدول' ? 'text-amber-300' : 'text-slate-300'}`}>مجدول (توقيت محدد)</h4>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">البوابة تفتح وتغلق أوتوماتيكياً حسب التوقيت أدناه.</p>
                        </div>
                      </div>
                    </div>
                    
                    {portalStatus === 'مجدول' && (
                      <div className="mt-6 pl-2 md:pl-10 flex flex-col md:flex-row gap-4 animate-in fade-in duration-300 relative z-10">
                        <div className="flex-1 bg-[#050505] p-3 rounded-xl border border-white/5 shadow-inner">
                          <label className="text-[11px] font-black text-emerald-400 mb-2 block flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> وقت الفتح</label>
                          <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} className="w-full bg-[#121214] border border-white/10 text-white font-black px-4 py-2.5 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all dir-ltr text-center" />
                        </div>
                        <div className="flex-1 bg-[#050505] p-3 rounded-xl border border-white/5 shadow-inner">
                          <label className="text-[11px] font-black text-rose-400 mb-2 block flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> وقت الإغلاق</label>
                          <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} className="w-full bg-[#121214] border border-white/10 text-white font-black px-4 py-2.5 rounded-lg focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none transition-all dir-ltr text-center" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* كارت مغلق */}
                  <div 
                    onClick={() => setPortalStatus('مغلق')}
                    className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group overflow-hidden ${portalStatus === 'مغلق' ? 'border-rose-500 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'border-white/5 hover:border-white/20 bg-[#050505]'}`}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${portalStatus === 'مغلق' ? 'border-rose-400' : 'border-slate-600'}`}>
                        {portalStatus === 'مغلق' && <div className="w-3 h-3 bg-rose-400 rounded-full" />}
                      </div>
                      <div>
                        <h4 className={`font-black text-[15px] transition-colors ${portalStatus === 'مغلق' ? 'text-rose-400' : 'text-slate-300'}`}>إغلاق قسري للطوارئ</h4>
                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">إغلاق البوابة فوراً لإجراء أعمال جرد أو صيانة في المطبخ.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-end">
                  <button onClick={savePortalSettings} disabled={isSaving} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black py-3.5 px-8 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all outline-none disabled:opacity-70 text-[14px]">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ الإعدادات
                  </button>
                </div>
              </div>
            )}

            {/* 🟢 قسم الفروع 🟢 */}
            {activeTab === 'branches' && (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl mb-6 flex items-start gap-3">
                  <Store className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-blue-300/80 leading-relaxed">
                    من هنا يمكنك تعيين "الوكالة/البراند" لكل فرع ليتم فلترة المواد التي تخصه فقط، بالإضافة لتعيين اسم مستخدم وكلمة مرور لدخوله للبوابة.
                  </p>
                </div>

                {branches.map(branch => (
                  <div key={branch.id} className="bg-[#121214] rounded-[1.5rem] p-5 md:p-6 shadow-lg border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                      
                      <div className="flex items-center gap-4 w-full xl:w-1/3 shrink-0">
                        <div className="w-12 h-12 bg-[#050505] text-blue-400 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 shadow-inner">
                          <Store className="w-6 h-6"/>
                        </div>
                        <div>
                          <h4 className="font-black text-white text-[15px] leading-tight">{branch.name}</h4>
                          <p className="text-[11px] font-bold text-slate-500 mt-1">تهيئة صلاحيات الفرع</p>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">الوكالة / البراند</label>
                          <div className="relative">
                            <Building2 className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select 
                              value={branch.agency_id || ''} 
                              onChange={(e) => handleBranchUpdate(branch.id, 'agency_id', e.target.value)} 
                              className="w-full bg-[#050505] border border-white/10 font-bold px-3 pr-9 py-2.5 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-[12px] text-white appearance-none shadow-inner [&>option]:bg-[#121214]"
                            >
                              <option value="">غير محدد</option>
                              {agencies.map(ag => <option key={ag.id} value={ag.id}>{ag.name}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">المستخدم (User)</label>
                          <div className="relative">
                            <User className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input 
                              type="text" 
                              placeholder="username" 
                              value={branch.username || ''} 
                              onChange={(e) => handleBranchUpdate(branch.id, 'username', e.target.value)} 
                              className="w-full bg-[#050505] border border-white/10 font-bold px-3 pr-9 py-2.5 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-[13px] text-white dir-ltr text-left placeholder:text-slate-600 shadow-inner"
                            />
                          </div>
                        </div>

                        {/* العين السحرية لكلمة المرور */}
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">المرور (Pass)</label>
                          <div className="relative">
                            <Key className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input 
                              type={showPasswords[branch.id] ? "text" : "password"} 
                              placeholder="password" 
                              value={branch.password || ''} 
                              onChange={(e) => handleBranchUpdate(branch.id, 'password', e.target.value)} 
                              className="w-full bg-[#050505] border border-white/10 font-bold px-3 pr-9 pl-10 py-2.5 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-[13px] text-white dir-ltr text-left placeholder:text-slate-600 shadow-inner"
                            />
                            <button 
                              type="button"
                              onClick={() => togglePasswordVisibility(branch.id)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors outline-none cursor-pointer"
                            >
                              {showPasswords[branch.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-end w-full xl:w-auto mt-2 xl:mt-0 pt-6">
                        <button 
                          onClick={() => saveBranchCredentials(branch)} 
                          className="w-full xl:w-auto bg-[#0a0a0c] hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-transparent font-black py-2.5 px-6 rounded-xl text-[12px] transition-all duration-300 shadow-sm outline-none"
                        >
                          تحديث
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 🟢 قسم الكادر والموظفين (الصلاحيات المتقدمة) 🟢 */}
            {activeTab === 'staff' && (
              <div className="space-y-4">
                
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl mb-6 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-emerald-300/80 leading-relaxed">
                    خصص صلاحيات الدخول لموظفي المطبخ المركزي بتفصيل دقيق. يمكنك منحهم صلاحيات الاعتماد، التحكم بالأسعار، استلام إشعارات الطلبات الجديدة، أو مراقبة شاشة المطبخ.
                  </p>
                </div>

                {staffList.map(staff => (
                  <div key={staff.id} className="bg-[#121214] rounded-[1.5rem] p-5 md:p-6 shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300">
                    
                    {/* الصف الأول: معلومات الموظف + اليوزر والباسوورد */}
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 mb-5">
                      <div className="flex items-center gap-4 w-full xl:w-1/3 shrink-0">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner bg-[#050505] text-emerald-500 border-white/5">
                          <UserCheck className="w-6 h-6"/>
                        </div>
                        <div>
                          <h4 className="font-black text-white text-[15px] leading-tight">{staff.full_name}</h4>
                          <p className="text-[11px] font-bold text-slate-500 mt-1">{staff.role}</p>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">المستخدم (User)</label>
                          <div className="relative">
                            <User className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input 
                              type="text" 
                              placeholder="username" 
                              value={staff.username || ''} 
                              onChange={(e) => handleStaffUpdate(staff.id, 'username', e.target.value)} 
                              className="w-full bg-[#050505] border border-white/10 font-bold px-3 pr-9 py-2.5 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-[13px] text-white dir-ltr text-left placeholder:text-slate-600 shadow-inner"
                            />
                          </div>
                        </div>

                        {/* العين السحرية لكلمة المرور (الموظفين) */}
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">المرور (Pass)</label>
                          <div className="relative">
                            <Key className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input 
                              type={showPasswords[staff.id] ? "text" : "password"} 
                              placeholder="password" 
                              value={staff.password || ''} 
                              onChange={(e) => handleStaffUpdate(staff.id, 'password', e.target.value)} 
                              className="w-full bg-[#050505] border border-white/10 font-bold px-3 pr-9 pl-10 py-2.5 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all text-[13px] text-white dir-ltr text-left placeholder:text-slate-600 shadow-inner"
                            />
                            <button 
                              type="button"
                              onClick={() => togglePasswordVisibility(staff.id)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition-colors outline-none cursor-pointer"
                            >
                              {showPasswords[staff.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 💡 الصف الثاني: الصلاحيات المتقدمة (Roles) مرتبة بـ Grid 💡 */}
                    <div className="w-full border-t border-white/5 pt-5 mt-2">
                       <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                         <ShieldCheck className="w-3.5 h-3.5" /> صلاحيات الموظف في النظام
                       </h5>
                       
                       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          
                          {/* الصلاحية 1: اعتماد الطلبيات */}
                          <div 
                            onClick={() => handleStaffUpdate(staff.id, 'can_approve_orders', !staff.can_approve_orders)}
                            className="flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-white/5 cursor-pointer group hover:border-white/10 transition-colors shadow-inner"
                          >
                             <span className={`text-[11px] font-black transition-colors ${staff.can_approve_orders ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                               اعتماد الطلبيات (المطبخ)
                             </span>
                             <div className={`w-9 h-5 rounded-full p-1 transition-colors duration-300 flex items-center border ${staff.can_approve_orders ? 'bg-emerald-500/20 border-emerald-500/50 justify-start rtl:justify-end' : 'bg-[#121214] border-white/10 justify-end rtl:justify-start'}`}>
                               <div className={`w-3 h-3 rounded-full transition-transform duration-300 ${staff.can_approve_orders ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                             </div>
                          </div>
                          
                          {/* الصلاحية 2: إدارة الأصناف والأسعار */}
                          <div 
                            onClick={() => handleStaffUpdate(staff.id, 'can_manage_catalog', !staff.can_manage_catalog)}
                            className="flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-white/5 cursor-pointer group hover:border-white/10 transition-colors shadow-inner"
                          >
                             <span className={`text-[11px] font-black transition-colors ${staff.can_manage_catalog ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                               إدارة الأصناف والأسعار
                             </span>
                             <div className={`w-9 h-5 rounded-full p-1 transition-colors duration-300 flex items-center border ${staff.can_manage_catalog ? 'bg-blue-500/20 border-blue-500/50 justify-start rtl:justify-end' : 'bg-[#121214] border-white/10 justify-end rtl:justify-start'}`}>
                               <div className={`w-3 h-3 rounded-full transition-transform duration-300 ${staff.can_manage_catalog ? 'bg-blue-400' : 'bg-slate-600'}`} />
                             </div>
                          </div>

                          {/* الصلاحية 3: التقارير المالية */}
                          <div 
                            onClick={() => handleStaffUpdate(staff.id, 'can_view_reports', !staff.can_view_reports)}
                            className="flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-white/5 cursor-pointer group hover:border-white/10 transition-colors shadow-inner"
                          >
                             <span className={`text-[11px] font-black transition-colors ${staff.can_view_reports ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                               الاطلاع على التقارير المالية
                             </span>
                             <div className={`w-9 h-5 rounded-full p-1 transition-colors duration-300 flex items-center border ${staff.can_view_reports ? 'bg-amber-500/20 border-amber-500/50 justify-start rtl:justify-end' : 'bg-[#121214] border-white/10 justify-end rtl:justify-start'}`}>
                               <div className={`w-3 h-3 rounded-full transition-transform duration-300 ${staff.can_view_reports ? 'bg-amber-400' : 'bg-slate-600'}`} />
                             </div>
                          </div>

                          {/* الصلاحية 4: مراقبة شاشة المطبخ (عرض فقط) */}
                          <div 
                            onClick={() => handleStaffUpdate(staff.id, 'can_view_kitchen_only', !staff.can_view_kitchen_only)}
                            className="flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-white/5 cursor-pointer group hover:border-white/10 transition-colors shadow-inner"
                          >
                             <span className={`text-[11px] font-black transition-colors ${staff.can_view_kitchen_only ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                               شاشة المطبخ (مراقبة فقط)
                             </span>
                             <div className={`w-9 h-5 rounded-full p-1 transition-colors duration-300 flex items-center border ${staff.can_view_kitchen_only ? 'bg-cyan-500/20 border-cyan-500/50 justify-start rtl:justify-end' : 'bg-[#121214] border-white/10 justify-end rtl:justify-start'}`}>
                               <div className={`w-3 h-3 rounded-full transition-transform duration-300 ${staff.can_view_kitchen_only ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                             </div>
                          </div>

                          {/* الصلاحية 5: استلام الإشعارات والتنبيهات */}
                          <div 
                            onClick={() => handleStaffUpdate(staff.id, 'receives_order_alerts', !staff.receives_order_alerts)}
                            className="flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-white/5 cursor-pointer group hover:border-white/10 transition-colors shadow-inner"
                          >
                             <span className={`flex items-center gap-1.5 text-[11px] font-black transition-colors ${staff.receives_order_alerts ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                               <Bell className={`w-3 h-3 ${staff.receives_order_alerts ? 'animate-pulse' : ''}`} /> إشعارات الطلبات
                             </span>
                             <div className={`w-9 h-5 rounded-full p-1 transition-colors duration-300 flex items-center border ${staff.receives_order_alerts ? 'bg-violet-500/20 border-violet-500/50 justify-start rtl:justify-end' : 'bg-[#121214] border-white/10 justify-end rtl:justify-start'}`}>
                               <div className={`w-3 h-3 rounded-full transition-transform duration-300 ${staff.receives_order_alerts ? 'bg-violet-400' : 'bg-slate-600'}`} />
                             </div>
                          </div>

                       </div>
                       
                       <div className="flex justify-end mt-4">
                          <button 
                            onClick={() => saveStaffCredentials(staff)} 
                            className="w-full sm:w-auto font-black py-2.5 px-8 rounded-xl text-[12px] transition-all duration-300 outline-none bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                          >
                            حفظ بيانات الموظف
                          </button>
                       </div>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}