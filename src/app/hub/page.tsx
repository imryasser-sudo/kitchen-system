"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase'; 
import { playNotificationSound } from '@/components/AudioAlert'; 
import { toast } from 'sonner'; 
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  Search, LayoutGrid, Activity, ChevronLeft, Wallet, UserCheck, BarChart2, PieChart,
  Building2, Store, Package, ShoppingCart, ChefHat, Shapes, Archive,
  Sun, Moon, Eye, EyeOff, ClipboardCheck, MonitorPlay, TabletSmartphone, TrendingUp, 
  ListChecks, Calculator, Receipt, LineChart, DollarSign, Users, ReceiptText, ShieldAlert, 
  Lightbulb, MapPin, ShieldCheck, LogOut, Settings 
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar-iq';

dayjs.locale('ar-iq');

const roleNames: Record<string, string> = {
  Admin: 'إدارة عليا (نظام)',
  AsstManager: 'مساعد مدير',
  Accountant: 'محاسب مالي',
  BranchManager: 'مدير فرع',
  Chef: 'شيف المطبخ',
  Employee: 'موظف كادر'
};

export default function FullyResponsiveDashboard() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [isZenMode, setIsZenMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [activeTab, setActiveTab] = useState('all');
  const [currentTime, setCurrentTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [stats, setStats] = useState({ 
    agencies: 0, branches: 0, categories: 0, items: 0, 
    pendingRequests: 0, todaysOrders: 0, pendingApprovals: 0, 
    activeKds: 0, monthAdjustments: 0
  });

  // 💡 التحقق من تسجيل الدخول وحفظ الجلسة (Session Guard) 💡
  useEffect(() => {
    const session = localStorage.getItem('erp_session');
    if (!session) {
      router.push('/login');
    } else {
      setCurrentUser(JSON.parse(session));
      setMounted(true);
    }
  }, [router]);

  useEffect(() => {
    setCurrentTime(dayjs().format('hh:mm A'));
    const timer = setInterval(() => setCurrentTime(dayjs().format('hh:mm A')), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchStats = async () => {
      try {
        const startOfDay = dayjs().startOf('day').toISOString();
        const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD');
        
        const [agenciesRes, branchesRes, categoriesRes, itemsRes, requestsRes, todaysOrdersRes, approvalsRes, kdsRes, adjustmentsRes] = await Promise.all([
          supabase.from('agencies').select('id', { count: 'exact', head: true }),
          supabase.from('branches').select('id', { count: 'exact', head: true }),
          supabase.from('categories').select('id', { count: 'exact', head: true }),
          supabase.from('items').select('id', { count: 'exact', head: true }),
          supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', startOfDay),
          supabase.from('branch_orders').select('id', { count: 'exact', head: true }).eq('status', 'قيد المراجعة'),
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'قيد التجهيز'),
          supabase.from('payroll_adjustments').select('id', { count: 'exact', head: true }).gte('record_date', startOfMonth)
        ]);

        setStats({
          agencies: agenciesRes.count || 0, branches: branchesRes.count || 0, categories: categoriesRes.count || 0,
          items: itemsRes.count || 0, pendingRequests: requestsRes.count || 0, todaysOrders: todaysOrdersRes.count || 0,
          pendingApprovals: approvalsRes.count || 0, activeKds: kdsRes.count || 0, monthAdjustments: adjustmentsRes.count || 0
        });
      } catch (error) {}
    };

    fetchStats();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const channel = supabase
      .channel('realtime_requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, () => {
          playNotificationSound();
          toast.success('تم استلام طلبية جديدة من أحد الفروع!', { description: 'يرجى مراجعة بوابة الطلبيات.', duration: 5000 });
          setStats(prev => ({ ...prev, pendingRequests: prev.pendingRequests + 1 }));
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('erp_session');
    router.push('/login');
  };

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2) : '؟';

  // 💡 القوائم مربوطة بصلاحيات محددة (RBAC Filtering) 💡
  const MENU_GROUPS = useMemo(() => [
    {
      id: 'kitchen',
      title: "العمليات الأساسية (المطبخ المركزي)",
      items: [
        { href: '/database/agencies', icon: <Building2 className="w-6 h-6" />, title: 'الوكالات', desc: 'إدارة الشركات والوكالات الرئيسية', color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30', count: stats.agencies, roles: ['Admin', 'AsstManager', 'Accountant'] },
        { href: '/database/branches', icon: <Store className="w-6 h-6" />, title: 'الفروع والمنافذ', desc: 'التوزيع الجغرافي للفروع المرتبطة', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30', count: stats.branches, roles: ['Admin', 'AsstManager'] },
        { href: '/database/categories', icon: <Shapes className="w-6 h-6" />, title: 'أقسام المواد', desc: 'تصنيفات المطبخ (صلصات، دجاج...)', color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30', count: stats.categories, roles: ['Admin', 'AsstManager', 'Chef'] },
        { href: '/database/items', icon: <Package className="w-6 h-6" />, title: 'الأصناف', desc: 'قائمة المواد الأولية والمقادير', color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30', count: stats.items, roles: ['Admin', 'AsstManager', 'Chef'] },
        { href: '/shelf-life', icon: <ShieldAlert className="w-6 h-6" />, title: 'متابعة الصلاحيات (QA)', desc: 'تتبع وحساب تواريخ انتهاء الصلاحية للمواد وتنبيهات الاستهلاك.', color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/30', roles: ['Admin', 'AsstManager', 'Chef'] },
        { href: '/recipe-calculator', icon: <Calculator className="w-6 h-6" />, title: 'هندسة الوصفات (BOM)', desc: 'تصميم وحساب شجرة مكونات الأصناف بدقة وتفصيل.', color: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30', roles: ['Admin', 'AsstManager', 'Chef'] },
        { href: '/materials-management', icon: <DollarSign className="w-6 h-6" />, title: 'تسعير المستودع (Pricing)', desc: 'إدارة وتسعير المواد الخام ومواد التعبئة وحساب تكلفة الوحدة الصغرى.', color: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400 border border-green-200 dark:border-green-500/30', roles: ['Admin', 'Accountant'] },
        { href: '/branch-portal', icon: <TabletSmartphone className="w-6 h-6" />, title: 'بوابة الفروع (Portal)', desc: 'نظام الطلب المباشر المخصص لمدراء الفروع', color: 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30', roles: ['Admin', 'AsstManager', 'BranchManager'] },
        { href: '/requests', icon: <ShoppingCart className="w-6 h-6" />, title: 'الطلبيات الحية', desc: 'متابعة طلبات الفروع المباشرة', color: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30', badge: stats.pendingRequests, roles: ['Admin', 'AsstManager', 'Chef'] },
        { href: '/approvals', icon: <ClipboardCheck className="w-6 h-6" />, title: 'الاعتمادات والموافقات', desc: 'مراجعة، تعديل وتأكيد الطلبيات لتحويلها للمطبخ', color: 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30', badge: stats.pendingApprovals, roles: ['Admin', 'AsstManager', 'Accountant'] },
        { href: '/kds', icon: <MonitorPlay className="w-6 h-6" />, title: 'شاشة المطبخ (KDS)', desc: 'شاشة الشيف التفاعلية لتجهيز وشطب المواد', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30', count: stats.activeKds, roles: ['Admin', 'AsstManager', 'Chef', 'Employee'] },
        { href: '/branch-summary', icon: <ListChecks className="w-6 h-6" />, title: 'التجهيز المجمع القديم', desc: 'جدول متقاطع يعرض الكميات المطلوبة لتسهيل التحميل والتجهيز', color: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30', roles: ['Admin', 'AsstManager', 'Chef', 'Accountant'] },
        { href: '/records', icon: <Archive className="w-6 h-6" />, title: 'السجل الشامل', desc: 'إدارة وتدقيق الطلبيات المجهزة، وتصدير تقارير الجرد (PDF / Excel)', color: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30', count: stats.todaysOrders, roles: ['Admin', 'AsstManager', 'Accountant', 'BranchManager'] }
      ]
    },
    {
      id: 'hr',
      title: "الموارد البشرية والمالية (HR & Finance)",
      items: [
        { href: '/staff', icon: <Users className="w-6 h-6" />, title: 'شؤون الموظفين (HR)', desc: 'إدارة الكادر، الرواتب، الإجازات، وتصفية المستحقات.', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30', roles: ['Admin', 'AsstManager', 'Accountant'] },
        { href: '/payroll', icon: <ReceiptText className="w-6 h-6" />, title: 'كشف الرواتب والدوام (Payroll)', desc: 'السجل الجداري المفصل للدوام وحساب صافي الرواتب.', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30', roles: ['Admin', 'AsstManager', 'Accountant', 'Chef', 'BranchManager', 'Employee'] },
        { href: '/hr-approvals', icon: <ClipboardCheck className="w-6 h-6" />, title: 'موافقات الإدارة (HR)', desc: 'مراجعة واعتماد طلبات السلف والإجازات الخاصة بالموظفين.', color: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-500/30', roles: ['Admin', 'AsstManager'] },
        { href: '/hr/adjustments', icon: <Wallet className="w-6 h-6" />, title: 'السلف والمكافآت', desc: 'سجل الحركات المالية والإضافيات والخصومات المباشرة للموظفين', color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30', count: stats.monthAdjustments, roles: ['Admin', 'Accountant'] }
      ]
    },
    {
      id: 'analytics',
      title: "التقارير والتحليلات (Analytics)",
      items: [
        { href: '/summary', icon: <MapPin className="w-6 h-6" />, title: 'ملخص التوزيع (Matrix)', desc: 'جدول متقاطع مدعوم بخطوط السير والتنبيهات الذكية للشذوذ.', color: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30', roles: ['Admin', 'AsstManager', 'Accountant', 'Chef'] },
        { href: '/suggestions', icon: <Lightbulb className="w-6 h-6" />, title: 'اقتراح الطلبيات (Suggestions)', desc: 'توقع ذكي للكميات بناءً على الماضي مع نسبة زيادة أو نقصان مرنة.', color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30', roles: ['Admin', 'AsstManager', 'Accountant'] },
        { href: '/smart-orders', icon: <TrendingUp className="w-6 h-6" />, title: 'الطلبيات الذكية (AI)', desc: 'نظام توقع الكميات المبني على ظروف الطقس والأحداث والعوامل الاقتصادية.', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30', roles: ['Admin', 'AsstManager'] },
        { href: '/analytics', icon: <BarChart2 className="w-6 h-6" />, title: 'التحليلات والمقارنات', desc: 'مقارنة فترات السحب، تحليل أيام الشهر، وتتبع مسار حركة المواد بدقة', color: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-500/30', roles: ['Admin', 'AsstManager', 'Accountant'] },
        { href: '/averages', icon: <TrendingUp className="w-6 h-6" />, title: 'متوسط الطلبات (Averages)', desc: 'تحليل وحساب المتوسط اليومي للطلبات حسب الأفرع وأيام الأسبوع', color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30', roles: ['Admin', 'AsstManager', 'Accountant'] },
        { href: '/comparisons', icon: <PieChart className="w-6 h-6" />, title: 'مقارنة الفروع والأقسام (Comparisons)', desc: 'لوحة تحكم استراتيجية متقدمة لعرض ومقارنة حركة السحوبات بدقة عالية.', color: 'bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400 border border-pink-200 dark:border-pink-500/30', roles: ['Admin', 'AsstManager', 'Accountant'] },
        { href: '/ingredients-calculator', icon: <Calculator className="w-6 h-6" />, title: 'خطة الإنتاج (Ingredients)', desc: 'حساب مسحوبات المواد الخام والتعبئة بناءً على الوصفات المعيارية (SOP).', color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30', roles: ['Admin', 'AsstManager', 'Chef'] },
        { href: '/invoices', icon: <Receipt className="w-6 h-6" />, title: 'الفواتير والمذكرات (Invoices)', desc: 'إصدار واستعراض الفواتير المالية ومذكرات التجهيز اللوجستية للفروع.', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30', roles: ['Admin', 'AsstManager', 'Accountant'] },
        { href: '/material-analysis', icon: <LineChart className="w-6 h-6" />, title: 'تحليل المواد (Material)', desc: 'مراقبة وتحليل الاستهلاك الفعلي للمواد الخام والتعبئة بدقة.', color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30', roles: ['Admin', 'AsstManager', 'Accountant'] }
      ]
    },
    {
      id: 'system',
      title: "إعدادات النظام (System)",
      items: [
        { href: '/system-access', icon: <ShieldCheck className="w-6 h-6" />, title: 'إدارة النظام (Access)', desc: 'إدارة حسابات الدخول، تعيين الأدوار وتخصيص الصلاحيات الديناميكية.', color: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white border border-slate-300 dark:border-white/20', roles: ['Admin'] }
      ]
    }
  ], [stats]);

  const NAV_ITEMS = [
    { id: 'all', label: 'الرئيسية', icon: <LayoutGrid className="w-5 h-5" /> },
    { id: 'kitchen', label: 'العمليات', icon: <ChefHat className="w-5 h-5" /> },
    { id: 'hr', label: 'المالية', icon: <UserCheck className="w-5 h-5" /> },
    { id: 'analytics', label: 'التحليلات', icon: <PieChart className="w-5 h-5" /> },
    { id: 'system', label: 'النظام', icon: <Settings className="w-5 h-5" /> }
  ];

  // 💡 تطبيق الفلترة حسب الصلاحية 💡
  const filteredGroups = useMemo(() => {
    if (!currentUser) return [];
    
    let groups = MENU_GROUPS.map(group => {
      const allowedItems = group.items.filter(item => item.roles.includes(currentUser.role));
      return { ...group, items: allowedItems };
    }).filter(group => group.items.length > 0);

    if (!searchQuery.trim() && activeTab !== 'all') {
      groups = groups.filter(g => g.id === activeTab);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      groups = groups.map(group => {
        const searchedItems = group.items.filter(item => 
          item.title.toLowerCase().includes(query) || 
          item.desc.toLowerCase().includes(query)
        );
        return { ...group, items: searchedItems };
      }).filter(group => group.items.length > 0);
    }

    return groups;
  }, [searchQuery, activeTab, MENU_GROUPS, currentUser]);

  if (!mounted || !currentUser) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`flex min-h-screen font-sans selection:bg-indigo-500/30 relative transition-colors duration-300 ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-900 dark:text-slate-300' : 'bg-slate-50 dark:bg-[#050505] text-slate-800 dark:text-white'}`} dir="rtl">
        
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 dark:from-indigo-900/15 via-transparent dark:via-[#050505] to-transparent dark:to-[#050505] -z-10 pointer-events-none transition-opacity duration-500 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <aside className={`hidden lg:flex w-[280px] bg-white dark:bg-[#0a0a0c] border-l border-slate-200 dark:border-white/5 flex-col shrink-0 z-20 shadow-2xl transition-all duration-300 ${isZenMode ? '!hidden translate-x-full' : 'translate-x-0'}`}>
          <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center gap-4 shrink-0 transition-colors duration-300 relative group overflow-hidden">
            <div className={`absolute top-0 right-0 w-1.5 h-full ${currentUser.role === 'Admin' ? 'bg-indigo-500' : currentUser.role === 'BranchManager' ? 'bg-sky-500' : 'bg-emerald-500'}`}></div>
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentUser.avatar || 'from-indigo-500 to-indigo-700'} text-white flex items-center justify-center font-black text-xl shadow-inner border border-white/20`}>
              {getInitials(currentUser.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-black text-slate-900 dark:text-white truncate leading-tight tracking-tight mb-0.5">{currentUser.name}</h1>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{roleNames[currentUser.role] || currentUser.role}</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            {NAV_ITEMS.filter(nav => {
              if (nav.id === 'system' && currentUser.role !== 'Admin') return false;
              return true;
            }).map((nav) => (
              <button 
                key={nav.id}
                onClick={() => { setActiveTab(nav.id); setSearchQuery(''); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-[14px] transition-all outline-none ${activeTab === nav.id && !searchQuery ? 'bg-indigo-50 dark:bg-[#121214] text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-white/10 shadow-sm' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent'}`}
              >
                {nav.icon}
                {nav.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className={`flex-1 flex flex-col h-full relative z-10 overflow-hidden transition-all duration-500 ${isZenMode ? 'w-full px-2' : ''}`}>
          
          <header className={`sticky top-0 z-40 bg-white/80 dark:bg-[#050505]/80 backdrop-blur-3xl border-b border-slate-200 dark:border-white/5 px-5 md:px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 shrink-0 transition-colors duration-300 ${isZenMode ? 'hidden' : 'flex'}`}>
            <div className="flex justify-between items-center w-full md:w-auto">
              <div>
                <p className="lg:hidden text-[10px] font-black text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1.5 transition-colors duration-300">
                  <Activity className="w-3.5 h-3.5" /> المطبخ المركزي (B2B)
                </p>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white drop-shadow-sm flex items-center gap-2 transition-colors duration-300">
                  مرحباً بك ✨
                </h2>
                <p className="hidden lg:block text-[12px] font-bold text-slate-500 mt-1 en-num dir-ltr text-right">
                  {dayjs().format('DD MMM YYYY')} - {currentTime}
                </p>
              </div>
              <div className="lg:hidden text-right flex flex-col items-end gap-1">
                <button onClick={handleLogout} className="text-[10px] text-rose-500 font-bold flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-md"><LogOut className="w-3 h-3"/> خروج</button>
                <p className="text-xl font-black text-slate-900 dark:text-white en-num tracking-widest dir-ltr mt-1 transition-colors duration-300">{currentTime}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
              <div className="relative flex-1 md:w-[300px] xl:w-[350px] group">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-600 dark:group-focus-within:text-indigo-400 transition-colors" />
                </div>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن شاشة (التحليلات، الفروع)..." 
                  className="w-full bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-white/10 focus:border-indigo-500/50 focus:bg-white dark:focus:bg-[#1a1a24] rounded-2xl h-12 pr-12 pl-4 outline-none transition-all font-bold text-[13px] text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 shadow-inner focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              {/* أزرار الثيم والتركيز والخروج */}
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={toggleTheme} className="shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm transition-colors outline-none cursor-pointer active:scale-95">
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button onClick={() => setIsZenMode(true)} title="وضع التركيز" className="shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm transition-colors outline-none cursor-pointer active:scale-95">
                  <Eye className="w-5 h-5" />
                </button>
                <button onClick={handleLogout} title="تسجيل الخروج" className="hidden md:flex shrink-0 items-center justify-center w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:text-rose-700 shadow-sm transition-colors outline-none cursor-pointer active:scale-95">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 pb-8">
            <div className={`max-w-[1400px] mx-auto flex flex-col gap-8 transition-all duration-500 ${isZenMode ? 'mt-4' : ''}`}>

              {filteredGroups.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-[#121214] rounded-[2rem] border border-slate-200 dark:border-white/10 border-dashed shadow-sm animate-in fade-in transition-colors duration-300">
                  <Search className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-slate-600 dark:text-slate-400 font-bold text-lg mb-1">عفواً، لا توجد شاشات متاحة</h3>
                  <p className="text-[12px] font-bold text-slate-500">ليس لديك الصلاحية أو أن البحث لم يطابق أي نتيجة...</p>
                </div>
              ) : (
                filteredGroups.map((group, gIdx) => (
                  <div key={gIdx} className="flex flex-col gap-4 animate-in fade-in duration-500">
                    <h3 className="text-[13px] md:text-[15px] font-black text-slate-500 dark:text-slate-400 tracking-widest px-2 flex items-center gap-2 transition-colors duration-300">
                      {group.title}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {group.items.map((item: any, iIdx: number) => (
                        <Link 
                          key={iIdx} 
                          href={item.href} 
                          className={`flex flex-col justify-between gap-4 p-5 rounded-[1.5rem] border hover:shadow-lg transition-all duration-300 group outline-none active:scale-[0.98] relative overflow-hidden ${isZenMode ? 'bg-white dark:bg-[#0a0a0c] border-slate-300 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 shadow-md' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-[#1a1a24] hover:border-slate-300 dark:hover:border-white/10 shadow-sm'}`}
                        >
                          <div className="flex items-start justify-between relative z-10">
                            <div className={`p-4 rounded-[1.2rem] shadow-inner group-hover:scale-110 transition-transform duration-300 relative ${item.color}`}>
                              {item.icon}
                              {item.badge !== undefined && item.badge > 0 && (
                                <span className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-white dark:border-[#121214] shadow-sm animate-pulse en-num">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            
                            {item.count !== undefined ? (
                              <span className="text-xl font-black en-num text-slate-800 dark:text-white bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-inner">
                                {item.count}
                              </span>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-white/10 transition-colors">
                                <ChevronLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
                              </div>
                            )}
                          </div>
                          <div className="relative z-10">
                            <h4 className="text-[16px] font-black text-slate-900 dark:text-white mb-1.5 leading-tight transition-colors duration-300">{item.title}</h4>
                            <p className="text-[12px] font-bold text-slate-500 leading-relaxed group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">{item.desc}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))
              )}

            </div>
          </div>
        </main>

        {/* 🟢 زر إنهاء وضع التركيز 🟢 */}
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

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
        
        @media (max-width: 1024px) {
          .custom-scrollbar::-webkit-scrollbar { display: none; }
          .custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        }

        .en-num { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; direction: ltr; display: inline-block; }
      `}} />
    </div>
  );
}