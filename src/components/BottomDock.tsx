"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutGrid, History, ShoppingCart, BarChart3, 
  UserCheck, LineChart, Sun, Moon, LogOut,
  ChevronDown, Menu, MonitorPlay, User, TabletSmartphone, Wallet, ClipboardCheck
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider'; 

export default function BottomDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme(); 
  
  const [isDockHidden, setIsDockHidden] = useState(false);
  const [role, setRole] = useState<string>('Employee');
  const [currentHash, setCurrentHash] = useState('');
  
  const [badges, setBadges] = useState({ cart: 0, approvals: 0, history: 0 });
  const pendingOrdersCount = 0; 

  useEffect(() => {
    const session = localStorage.getItem('erp_session');
    if (session) setRole(JSON.parse(session).role || 'Employee');

    const savedBadges = sessionStorage.getItem('portal_badges');
    if (savedBadges) setBadges(JSON.parse(savedBadges));

    const badgeHandler = (e: any) => {
      setBadges(e.detail);
      sessionStorage.setItem('portal_badges', JSON.stringify(e.detail));
    };
    window.addEventListener('update-portal-badges', badgeHandler);

    const onHashChange = () => setCurrentHash(window.location.hash.replace('#', ''));
    
    setTimeout(onHashChange, 100);
    window.addEventListener('hashchange', onHashChange);

    return () => {
      window.removeEventListener('update-portal-badges', badgeHandler);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [pathname]);

  if (pathname?.startsWith('/login')) return null;

  const isAdmin = ['Admin', 'AsstManager', 'Accountant'].includes(role);
  const isEmployee = role === 'Employee' || role === 'Chef';
  const isBranch = role === 'BranchManager';

  const isHub = pathname === '/hub' || pathname === '/';
  const isRecords = pathname?.includes('/records');
  const isRequests = pathname?.includes('/requests') || pathname?.includes('/approvals');
  const isAttendance = pathname?.includes('/attendance');
  const isAverages = pathname?.includes('/averages'); 
  const isAnalytics = pathname?.includes('/analytics') || pathname?.includes('/adjustments');

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(50); 
  };

  const handleNav = (path: string, hash: string) => {
    triggerHaptic();
    setCurrentHash(hash); 
    
    if (pathname === path) {
      window.dispatchEvent(new CustomEvent('change-tab', { detail: hash }));
      router.push(`${path}#${hash}`, { scroll: false });
    } else {
      router.push(`${path}#${hash}`);
    }
  };

  const handleLogout = async () => {
    triggerHaptic();
    if (window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج من النظام؟')) {
      await supabase.auth.signOut();
      localStorage.removeItem('erp_session');
      sessionStorage.clear();
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }
      window.location.replace('/login'); 
    }
  };

  const activeColor = isAdmin ? 'indigo' : 'emerald';

  if (!isAdmin) {
    return (
      <nav className="fixed bottom-0 left-0 w-full z-[999999] bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center h-[70px] max-w-[600px] mx-auto px-1 sm:px-4">
          
          {/* 👨‍🍳 أدوات الموظف العادي 👨‍🍳 */}
          {isEmployee && (
            <>
              <button onClick={() => handleNav('/my-profile', 'id_card')} className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group ${pathname === '/my-profile' && currentHash !== 'payroll' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <div className={`p-1.5 rounded-xl transition-all duration-300 mb-0.5 ${pathname === '/my-profile' && currentHash !== 'payroll' ? 'bg-indigo-100 dark:bg-indigo-500/20 shadow-inner' : 'bg-transparent'}`}>
                  <User className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </div>
                <span className={`text-[10px] font-black transition-all ${pathname === '/my-profile' && currentHash !== 'payroll' ? 'opacity-100' : 'opacity-70'}`}>الرئيسية</span>
              </button>

              <button onClick={() => handleNav('/my-profile', 'payroll')} className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group ${pathname === '/my-profile' && currentHash === 'payroll' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                <div className={`p-1.5 rounded-xl transition-all duration-300 mb-0.5 ${pathname === '/my-profile' && currentHash === 'payroll' ? 'bg-emerald-100 dark:bg-emerald-500/20 shadow-inner' : 'bg-transparent'}`}>
                  <Wallet className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </div>
                <span className={`text-[10px] font-black transition-all ${pathname === '/my-profile' && currentHash === 'payroll' ? 'opacity-100' : 'opacity-70'}`}>الراتب</span>
              </button>

              <button onClick={() => handleNav('/kds', '')} className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group ${pathname === '/kds' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'}`}>
                <div className={`p-1.5 rounded-xl transition-all duration-300 mb-0.5 ${pathname === '/kds' ? 'bg-rose-100 dark:bg-rose-500/20 shadow-inner' : 'bg-transparent'}`}>
                  <MonitorPlay className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </div>
                <span className={`text-[10px] font-black transition-all ${pathname === '/kds' ? 'opacity-100' : 'opacity-70'}`}>المطبخ</span>
              </button>

              <button onClick={() => { triggerHaptic(); toggleTheme(); }} className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group text-slate-400 hover:text-amber-500 dark:hover:text-amber-400">
                <div className="p-1.5 rounded-xl transition-all duration-300 mb-0.5 bg-transparent group-hover:bg-amber-50 dark:group-hover:bg-amber-500/10">
                  {isDark ? <Sun className="w-5 h-5 md:w-5.5 md:h-5.5" /> : <Moon className="w-5 h-5 md:w-5.5 md:h-5.5" />}
                </div>
                <span className="text-[10px] font-black opacity-70">المظهر</span>
              </button>

              <button onClick={handleLogout} className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group text-slate-400 hover:text-rose-600 dark:hover:text-rose-500">
                <div className="p-1.5 rounded-xl transition-all duration-300 mb-0.5 bg-transparent group-hover:bg-rose-50 dark:group-hover:bg-rose-500/10">
                  <LogOut className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </div>
                <span className="text-[10px] font-black opacity-70">خروج</span>
              </button>
            </>
          )}

          {/* 🏪 أدوات مدير الفرع (تم استبدال الاعتمادات بشاشة المطبخ) 🏪 */}
          {isBranch && (
            <>
              <button onClick={() => handleNav('/branch-portal', 'menu')} className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group ${pathname === '/branch-portal' && (!currentHash || currentHash === 'menu') ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400'}`}>
                <div className={`p-1.5 rounded-xl transition-all duration-300 mb-0.5 ${pathname === '/branch-portal' && (!currentHash || currentHash === 'menu') ? 'bg-indigo-100 dark:bg-indigo-500/20 shadow-inner' : 'bg-transparent'}`}>
                  <LayoutGrid className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </div>
                <span className="text-[9px] md:text-[10px] font-black">الأصناف</span>
              </button>

              <button onClick={() => handleNav('/kds', '')} className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group ${pathname === '/kds' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 hover:text-rose-500 dark:hover:text-rose-400'}`}>
                <div className={`p-1.5 rounded-xl transition-all duration-300 mb-0.5 ${pathname === '/kds' ? 'bg-rose-100 dark:bg-rose-500/20 shadow-inner' : 'bg-transparent'}`}>
                  <MonitorPlay className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </div>
                <span className="text-[9px] md:text-[10px] font-black">المطبخ</span>
              </button>

              <button onClick={() => handleNav('/branch-portal', 'cart')} className="flex flex-col items-center justify-start flex-1 h-full gap-1 transition-all outline-none group relative z-10 -mt-5">
                <div className={`relative bg-gradient-to-b from-indigo-500 to-blue-600 dark:from-indigo-500 dark:to-violet-600 p-2.5 md:p-3 rounded-full shadow-[0_10px_20px_rgba(79,70,229,0.3)] border-[3px] border-slate-50 dark:border-[#050505] transition-all duration-300 mb-0.5 ${pathname === '/branch-portal' && currentHash === 'cart' ? 'scale-105' : ''}`}>
                  <ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  {badges.cart > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-slate-50 dark:border-[#050505] shadow-sm en-num">{badges.cart}</span>}
                </div>
                <span className={`text-[9px] md:text-[10px] font-black ${pathname === '/branch-portal' && currentHash === 'cart' ? 'text-indigo-600 dark:text-violet-400' : 'text-slate-400'}`}>السلة</span>
              </button>

              <button onClick={() => handleNav('/branch-portal', 'history')} className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group ${pathname === '/branch-portal' && currentHash === 'history' ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 hover:text-sky-500 dark:hover:text-sky-400'}`}>
                <div className={`p-1.5 rounded-xl transition-all duration-300 mb-0.5 relative ${pathname === '/branch-portal' && currentHash === 'history' ? 'bg-sky-100 dark:bg-sky-500/20 shadow-inner' : 'bg-transparent'}`}>
                  <History className="w-5 h-5 md:w-5.5 md:h-5.5" />
                  {badges.history > 0 && <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[8px] font-black min-w-[14px] h-[14px] flex items-center justify-center rounded-full border border-white dark:border-[#121214] shadow-sm en-num">{badges.history}</span>}
                </div>
                <span className="text-[9px] md:text-[10px] font-black">السجل</span>
              </button>

              <button onClick={() => handleNav('/my-profile', 'id_card')} className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group ${pathname === '/my-profile' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400'}`}>
                <div className={`p-1.5 rounded-xl transition-all duration-300 mb-0.5 ${pathname === '/my-profile' ? 'bg-emerald-100 dark:bg-emerald-500/20 shadow-inner' : 'bg-transparent'}`}>
                  <User className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </div>
                <span className="text-[9px] md:text-[10px] font-black">حسابي</span>
              </button>

              <button onClick={handleLogout} className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all outline-none group text-slate-400 hover:text-rose-600 dark:hover:text-rose-500">
                <div className="p-1.5 rounded-xl transition-all duration-300 mb-0.5 bg-transparent group-hover:bg-rose-50 dark:group-hover:bg-rose-500/10">
                  <LogOut className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </div>
                <span className="text-[9px] md:text-[10px] font-black">خروج</span>
              </button>
            </>
          )}

        </div>
      </nav>
    );
  }

  // ==========================================
  // 👑 2️⃣ الشريط الفخم المخصص للإدارة العليا 👑
  // ==========================================
  return (
    <>
      <button 
        onClick={() => { triggerHaptic(); setIsDockHidden(false); }}
        className={`fixed bottom-6 right-6 z-[100000] p-4 rounded-full shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] outline-none border border-white/10 flex items-center justify-center
          ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-800 text-white hover:bg-slate-700'}
          ${isDockHidden ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-20 scale-50 opacity-0 pointer-events-none'}
        `}
      >
        <Menu className="w-6 h-6" />
      </button>

      <div 
        className={`fixed bottom-0 left-0 right-0 z-[99999] w-full bg-white/95 dark:bg-[#0a0a0c]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] no-print border-t border-slate-200/80 dark:border-white/5 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_-5px_20px_rgba(0,0,0,0.3)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]
          ${isDockHidden ? 'translate-y-[120%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}
        `}
      >
        <div className="flex items-center justify-between h-[56px] px-2 sm:px-6 max-w-[600px] mx-auto relative mt-1">
          
          <Link href="/" onClick={triggerHaptic} className="flex flex-col items-center justify-center w-11 h-full gap-0.5 group outline-none">
            <div className={`p-1.5 rounded-full transition-all duration-300 ${isHub ? `bg-${activeColor}-100 text-${activeColor}-600 dark:bg-${activeColor}-500/20 dark:text-${activeColor}-400 -translate-y-1` : `text-slate-400 group-hover:text-${activeColor}-500`}`}>
              <LayoutGrid className="w-[18px] h-[18px]" strokeWidth={isHub ? 2.5 : 2} />
            </div>
            <span className={`text-[8.5px] font-black tracking-widest text-${activeColor}-600 dark:text-${activeColor}-400 transition-all duration-300 ${isHub ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0 overflow-hidden'}`}>الرئيسية</span>
          </Link>
          
          <Link href="/records" onClick={triggerHaptic} className="flex flex-col items-center justify-center w-11 h-full gap-0.5 group outline-none">
            <div className={`p-1.5 rounded-full transition-all duration-300 ${isRecords ? 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 -translate-y-1' : 'text-slate-400 group-hover:text-sky-500'}`}>
              <History className="w-[18px] h-[18px]" strokeWidth={isRecords ? 2.5 : 2} />
            </div>
            <span className={`text-[8.5px] font-black tracking-widest text-sky-600 dark:text-sky-400 transition-all duration-300 ${isRecords ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0 overflow-hidden'}`}>السجل</span>
          </Link>

          <Link href="/attendance" onClick={triggerHaptic} className="flex flex-col items-center justify-center w-11 h-full gap-0.5 group outline-none">
            <div className={`p-1.5 rounded-full transition-all duration-300 ${isAttendance ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 -translate-y-1' : 'text-slate-400 group-hover:text-rose-500'}`}>
              <UserCheck className="w-[18px] h-[18px]" strokeWidth={isAttendance ? 2.5 : 2} />
            </div>
            <span className={`text-[8.5px] font-black tracking-widest text-rose-600 dark:text-rose-400 transition-all duration-300 ${isAttendance ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0 overflow-hidden'}`}>الحضور</span>
          </Link>

          <div className="relative w-14 h-full flex flex-col items-center">
            <Link href="/requests" onClick={triggerHaptic} className="absolute -top-4 flex flex-col items-center justify-center active:scale-95 transition-transform outline-none z-10 group">
              <div className={`relative flex items-center justify-center w-[48px] h-[48px] rounded-full text-white transition-all duration-300 shadow-lg border-[3px] border-white dark:border-[#0a0a0c]
                ${isRequests ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-emerald-500/40 -translate-y-1' : 'bg-slate-800 dark:bg-slate-700 hover:bg-emerald-500 shadow-slate-500/20'}
              `}>
                <ShoppingCart className="w-[22px] h-[22px]" strokeWidth={2.5} />
                {pendingOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-[#0a0a0c]">
                    {pendingOrdersCount}
                  </span>
                )}
              </div>
              <span className={`text-[8.5px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 mt-0.5 transition-all duration-300 ${isRequests ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0 overflow-hidden'}`}>الطلبيات</span>
            </Link>
          </div>

          <Link href="/averages" onClick={triggerHaptic} className="flex flex-col items-center justify-center w-11 h-full gap-0.5 group outline-none">
            <div className={`p-1.5 rounded-full transition-all duration-300 ${isAverages ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 -translate-y-1' : 'text-slate-400 group-hover:text-cyan-500'}`}>
              <LineChart className="w-[18px] h-[18px]" strokeWidth={isAverages ? 2.5 : 2} />
            </div>
            <span className={`text-[8.5px] font-black tracking-widest text-cyan-600 dark:text-cyan-400 transition-all duration-300 ${isAverages ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0 overflow-hidden'}`}>متوسط</span>
          </Link>

          <Link href="/analytics-days" onClick={triggerHaptic} className="flex flex-col items-center justify-center w-11 h-full gap-0.5 group outline-none">
            <div className={`p-1.5 rounded-full transition-all duration-300 ${isAnalytics ? 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 -translate-y-1' : 'text-slate-400 group-hover:text-fuchsia-500'}`}>
              <BarChart3 className="w-[18px] h-[18px]" strokeWidth={isAnalytics ? 2.5 : 2} />
            </div>
            <span className={`text-[8.5px] font-black tracking-widest text-fuchsia-600 dark:text-fuchsia-400 transition-all duration-300 ${isAnalytics ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0 overflow-hidden'}`}>التحليل</span>
          </Link>

          <button onClick={() => { triggerHaptic(); toggleTheme(); }} className="flex flex-col items-center justify-center w-11 h-full gap-0.5 group outline-none cursor-pointer">
            <div className="p-1.5 rounded-full transition-all duration-300 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-white/5 dark:hover:text-amber-300">
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </div>
          </button>

          <button onClick={handleLogout} className="flex flex-col items-center justify-center w-11 h-full gap-0.5 group outline-none cursor-pointer">
            <div className="p-1.5 rounded-full transition-all duration-300 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 dark:hover:text-rose-500">
              <LogOut className="w-[18px] h-[18px]" />
            </div>
          </button>

          <button onClick={() => { triggerHaptic(); setIsDockHidden(true); }} className="flex flex-col items-center justify-center w-11 h-full gap-0.5 group outline-none cursor-pointer">
            <div className="p-1.5 rounded-full transition-all duration-300 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white/5 dark:hover:text-indigo-500">
              <ChevronDown className="w-[18px] h-[18px]" />
            </div>
          </button>

        </div>
      </div>
    </>
  );
}