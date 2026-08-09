"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { 
  Lock, User, Eye, EyeOff, Loader2, ArrowLeft, 
  ChefHat, ShieldCheck, Store, Activity 
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // إذا كان المستخدم مسجل دخول مسبقاً، حوله للداشبورد مباشرة
  useEffect(() => {
    const session = localStorage.getItem('erp_session');
    if (session) {
      router.push('/');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      toast.error('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);

    try {
      // 1. البحث في جدول الموظفين (الكادر والإدارة)
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('username', username.trim())
        .single();

      if (staffData) {
        // التحقق من كلمة المرور
        if (staffData.password === password.trim()) {
          const role = staffData.system_role || 'Employee';
          // تسجيل دخول ناجح كموظف/مدير
          const sessionData = {
            id: staffData.id,
            name: staffData.full_name,
            role: role,
            type: 'staff',
            branch: staffData.branch,
            avatar: staffData.avatar_color
          };
          localStorage.setItem('erp_session', JSON.stringify(sessionData));
          toast.success(`أهلاً بك، ${staffData.full_name}! ✨`);
          
          // 💡 التوجيه الذكي حسب الدور 💡
          if (role === 'Admin' || role === 'AsstManager' || role === 'Accountant') {
            router.push('/'); // الإدارة تروح للداشبورد الرئيسي
          } else if (role === 'BranchManager') {
            router.push('/branch-portal'); // مدير الفرع يروح لبوابته
          } else if (role === 'Chef') {
            router.push('/kds'); // الشيف يروح لشاشة المطبخ
          } else {
            router.push('/my-profile'); // الموظف العادي يروح لكشف راتبه
          }
          return;
        } else {
          toast.error('كلمة المرور غير صحيحة.');
          setIsLoading(false);
          return;
        }
      }

      // 2. إذا لم يتم العثور عليه في الموظفين، البحث في جدول الفروع
      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('*, agencies(name)')
        .eq('username', username.trim())
        .single();

      if (branchData) {
        // التحقق من كلمة المرور
        if (branchData.password === password.trim()) {
          // تسجيل دخول ناجح كفرع
          const sessionData = {
            id: branchData.id,
            name: branchData.name,
            role: branchData.system_role || 'BranchManager', 
            type: 'branch',
            agency: branchData.agencies?.name || 'غير محدد'
          };
          localStorage.setItem('erp_session', JSON.stringify(sessionData));
          toast.success(`أهلاً بك، فرع ${branchData.name}! 🏪`);
          
          // 💡 الفرع دائماً يروح لبوابة الفروع 💡
          router.push('/branch-portal');
          return;
        } else {
          toast.error('كلمة المرور غير صحيحة.');
          setIsLoading(false);
          return;
        }
      }

      // 3. إذا لم يتم العثور عليه في كلا الجدولين
      toast.error('اسم المستخدم غير موجود في النظام.');

    } catch (error: any) {
      console.error("Login Error:", error);
      toast.error('حدث خطأ أثناء محاولة تسجيل الدخول.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#050505] font-sans relative overflow-hidden" dir="rtl">
      
      {/* 🟢 خلفية متحركة وإضاءة 🟢 */}
      <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[70%] h-[70%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-fuchsia-500/20 via-transparent to-transparent rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-[1000px] bg-white dark:bg-[#121214] rounded-[3rem] shadow-2xl dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] flex flex-col md:flex-row overflow-hidden relative z-10 m-4 border border-slate-200 dark:border-white/5 animate-in zoom-in-95 duration-500">
        
        {/* 🟢 القسم الأيمن: نموذج تسجيل الدخول 🟢 */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          
          <div className="mb-10 text-center md:text-right">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-6 shadow-inner border border-indigo-100 dark:border-indigo-500/20">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">تسجيل الدخول</h1>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">أدخل بيانات الاعتماد الخاصة بك للوصول إلى النظام.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            
            <div className="space-y-2">
              <label className="text-[12px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mr-1">اسم المستخدم</label>
              <div className="relative group">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم..." 
                  required
                  className="w-full h-14 bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold px-4 pr-12 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner placeholder:text-slate-400 dir-ltr text-right"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mr-1">كلمة المرور</label>
              <div className="relative group">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  required
                  className="w-full h-14 bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black px-4 pr-12 pl-12 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner placeholder:text-slate-400 dir-ltr text-right en-num tracking-widest"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-4 flex items-center text-slate-400 hover:text-indigo-500 transition-colors outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-14 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[15px] flex items-center justify-center gap-2 transition-all shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] disabled:opacity-50 active:scale-95 outline-none cursor-pointer group"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>تسجيل الدخول الموحد <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /></>
              )}
            </button>

          </form>

        </div>

        {/* 🟢 القسم الأيسر: الواجهة التعريفية (يختفي في الموبايل) 🟢 */}
        <div className="hidden md:flex w-1/2 bg-slate-900 dark:bg-black p-12 relative overflow-hidden flex-col justify-between">
          {/* تأثيرات الإضاءة بداخل المربع الأسود */}
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white backdrop-blur-sm border border-white/10">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg tracking-wide">نظام إدارة המركزي</h2>
              <p className="text-indigo-300 font-bold text-[10px] tracking-widest uppercase">Central Kitchen ERP</p>
            </div>
          </div>

          <div className="relative z-10 space-y-6">
            <h3 className="text-4xl font-black text-white leading-tight">
              أهلاً بك في <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400">بوابة العمليات المتكاملة</span>
            </h3>
            <p className="text-slate-400 font-bold text-sm leading-relaxed max-w-sm">
              نظام B2B مصمم خصيصاً لإدارة المطبخ المركزي، تنظيم الطلبيات، وتتبع دورة حياة المواد بدقة عالية من التحضير إلى التوصيل.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <ChefHat className="w-6 h-6 text-fuchsia-400 mb-3" />
                <h4 className="text-white font-black text-sm mb-1">المطبخ والإنتاج</h4>
                <p className="text-slate-500 text-[10px] font-bold">شاشات KDS تفاعلية</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <Store className="w-6 h-6 text-indigo-400 mb-3" />
                <h4 className="text-white font-black text-sm mb-1">بوابة الفروع</h4>
                <p className="text-slate-500 text-[10px] font-bold">طلبات مباشرة ومتابعة</p>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 mt-10">
            <p className="text-slate-500 text-[11px] font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              النظام متصل وقيد التشغيل
            </p>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .dir-ltr { direction: ltr; }
        .en-num { font-family: system-ui, -apple-system, sans-serif; }
      `}} />
    </div>
  );
}