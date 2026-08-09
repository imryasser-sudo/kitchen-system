"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from 'sonner';
import { 
  ShieldCheck, Users, Key, Lock, Edit2, 
  Search, Eye, EyeOff, Loader2, UserPlus, CheckCircle2, 
  XCircle, Save, Building2, Store, ChefHat, UserCog, Sun, Moon, MapPin, Layers, Briefcase, Calculator, Crown
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar-iq';

dayjs.locale('ar-iq');

// الأدوار الأساسية في النظام
const ROLES_CONFIG = [
  { id: 'Admin', name: 'مدير عام', icon: <ShieldCheck className="w-5 h-5 text-indigo-500" />, color: 'indigo' },
  { id: 'AsstManager', name: 'مساعد مدير', icon: <Briefcase className="w-5 h-5 text-violet-500" />, color: 'violet' },
  { id: 'Accountant', name: 'محاسب مالي', icon: <Calculator className="w-5 h-5 text-teal-500" />, color: 'teal' },
  { id: 'BranchManager', name: 'حساب فرع', icon: <Store className="w-5 h-5 text-sky-500" />, color: 'sky' },
  { id: 'Chef', name: 'شيف المطبخ', icon: <ChefHat className="w-5 h-5 text-orange-500" />, color: 'orange' },
  { id: 'Employee', name: 'موظف كادر', icon: <Users className="w-5 h-5 text-emerald-500" />, color: 'emerald' },
];

// 💡 مصفوفة الصلاحيات الشاملة والمقترحة لنظام ERP متكامل 💡
const INITIAL_PERMISSIONS = [
  { module: 'الطلبيات اللوجستية (Orders)', actions: [
    { name: 'تقديم طلبية نواقص (من الفرع)', roles: ['Admin', 'AsstManager', 'BranchManager'] },
    { name: 'مشاهدة دورة حياة طلبية الفرع الخاص فقط', roles: ['BranchManager'] },
    { name: 'مشاهدة وتتبع كل الطلبيات (للمركز)', roles: ['Admin', 'AsstManager', 'Accountant', 'Chef'] },
    { name: 'مراجعة وتعديل واعتماد الطلبيات للتحضير', roles: ['Admin', 'AsstManager', 'Accountant'] },
    { name: 'طباعة وتصدير مذكرات التجهيز', roles: ['Admin', 'AsstManager', 'Accountant'] },
  ]},
  { module: 'المطبخ والإنتاج (Production & KDS)', actions: [
    { name: 'مشاهدة شاشة التحضير الحية (KDS)', roles: ['Admin', 'AsstManager', 'Chef', 'Employee'] },
    { name: 'تجهيز وشطب المواد المكتملة', roles: ['Admin', 'AsstManager', 'Chef'] },
    { name: 'إدارة الوصفات وهندسة المكونات (BOM)', roles: ['Admin', 'AsstManager', 'Chef'] },
    { name: 'تسجيل التالف والهالك في المطبخ', roles: ['Admin', 'AsstManager', 'Chef'] },
  ]},
  { module: 'المخازن والمواد (Inventory & Items)', actions: [
    { name: 'إضافة وتعديل وحذف بيانات المواد', roles: ['Admin', 'AsstManager'] },
    { name: 'متابعة تواريخ الصلاحية والتنبيهات (QA)', roles: ['Admin', 'AsstManager', 'Chef'] },
    { name: 'الجرد وإدخال الأرصدة الافتتاحية', roles: ['Admin', 'AsstManager', 'Accountant'] },
  ]},
  { module: 'الموارد البشرية (HR & Payroll)', actions: [
    { name: 'مشاهدة كشف الراتب والدوام الشخصي', roles: ['Admin', 'AsstManager', 'Accountant', 'Chef', 'BranchManager', 'Employee'] },
    { name: 'تقديم طلبات سلف وإجازات شخصية', roles: ['Admin', 'AsstManager', 'Accountant', 'Chef', 'BranchManager', 'Employee'] },
    { name: 'إدارة كشوفات بيانات كل الموظفين', roles: ['Admin', 'AsstManager', 'Accountant'] },
    { name: 'الاعتماد النهائي للإجازات وتحديث الأرصدة', roles: ['Admin', 'AsstManager'] },
  ]},
  { module: 'المالية والحسابات (Finance)', actions: [
    { name: 'تسجيل السلف، المكافآت، والخصومات المباشرة', roles: ['Admin', 'Accountant'] },
    { name: 'إدارة الرواتب وصرف المستحقات النهائية', roles: ['Admin', 'Accountant'] },
    { name: 'إدارة أسعار المواد والتكلفة (Pricing)', roles: ['Admin', 'Accountant'] },
    { name: 'مشاهدة الفواتير ومطابقة حسابات الفروع', roles: ['Admin', 'AsstManager', 'Accountant'] },
  ]},
  { module: 'التقارير والإحصائيات (Analytics)', actions: [
    { name: 'الوصول للطلبيات الذكية (AI Orders)', roles: ['Admin', 'AsstManager'] },
    { name: 'الوصول لملخص التجهيز المجمع (Matrix)', roles: ['Admin', 'AsstManager', 'Accountant', 'Chef'] },
    { name: 'تحليل المبيعات والمقارنات البيانية', roles: ['Admin', 'AsstManager', 'Accountant'] },
  ]},
  { module: 'إعدادات النظام (System Settings)', actions: [
    { name: 'إدارة الوكالات والفروع', roles: ['Admin'] },
    { name: 'إدارة حسابات النظام وتوزيع الصلاحيات', roles: ['Admin'] },
  ]}
];

export default function SystemAccessPage() {
  const { isDark, toggleTheme } = useTheme();
  const [isZenMode, setIsZenMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'matrix'>('users');
  const [activeEntityTab, setActiveEntityTab] = useState<'staff' | 'branches'>('branches');
  
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // حالة إدارة المصفوفة التفاعلية
  const [permissionsMatrix, setPermissionsMatrix] = useState(INITIAL_PERMISSIONS);
  const [isMatrixSaving, setIsMatrixSaving] = useState(false);

  // حالات نافذة إنشاء/تعديل الحساب الاعتيادية
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [entityType, setEntityType] = useState<'staff' | 'branches'>('staff'); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('Employee');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 💡 حالات نافذة "إنشاء حساب مدير نظام" 💡
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [newAdminData, setNewAdminData] = useState({ fullName: '', username: '', password: '' });
  const [isAdminSaving, setIsAdminSaving] = useState(false);

  useEffect(() => {
    const savedMatrix = localStorage.getItem('erp_permissions_matrix');
    if (savedMatrix) {
      try { setPermissionsMatrix(JSON.parse(savedMatrix)); } catch (e) {}
    }
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, full_name, role, branch, avatar_color, username, password, system_role')
        .order('system_role', { ascending: true }) // ترتيب المدراء أولاً عادة
        .order('full_name');
      if (staffError) throw staffError;

      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name, username, password, system_role, agencies(name)')
        .order('name');
      if (branchesError) throw branchesError;

      setStaff(staffData || []);
      setBranches(branchesData || []);
    } catch (error: any) {
      toast.error('حدث خطأ في جلب البيانات: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAccountModal = (entity: any, type: 'staff' | 'branches') => {
    setEntityType(type);
    setSelectedEntity(entity);
    setUsername(entity.username || '');
    setPassword(entity.password || '');
    
    if (entity.system_role) {
      setSelectedRole(entity.system_role);
    } else {
      setSelectedRole(type === 'branches' ? 'BranchManager' : 'Employee');
    }
    
    setIsModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return toast.error('يرجى إدخال اسم المستخدم وكلمة المرور');
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from(entityType)
        .update({ username: username.trim(), password: password.trim(), system_role: selectedRole })
        .eq('id', selectedEntity.id);

      if (error) throw error;
      toast.success(`تم حفظ بيانات الدخول بنجاح! 🔐`);
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error('حدث خطأ أثناء الحفظ: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 💡 دالة إنشاء حساب "مدير نظام" جديد مباشرة بالداتا بيس 💡
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminData.fullName.trim() || !newAdminData.username.trim() || !newAdminData.password.trim()) {
      return toast.error('يرجى تعبئة كافة الحقول لإنشاء حساب الإدارة.');
    }

    setIsAdminSaving(true);
    try {
      const { error } = await supabase.from('staff').insert([{
        full_name: newAdminData.fullName.trim(),
        role: 'إدارة عليا (نظام)',
        branch: 'المركز الرئيسي',
        avatar_color: 'from-indigo-600 to-indigo-900', // لون مميز للمدراء
        username: newAdminData.username.trim(),
        password: newAdminData.password.trim(),
        system_role: 'Admin',
        basic_salary: 0, // قيم افتراضية حتى لا يحدث خطأ بجدول الستاف
        annual_leave_balance: 30
      }]);

      if (error) throw error;
      toast.success('تم إنشاء حساب إدارة النظام بنجاح! 👑');
      setIsAdminModalOpen(false);
      setNewAdminData({ fullName: '', username: '', password: '' });
      setActiveEntityTab('staff'); // تحويل التبويب لعرض الإدمن الجديد
      fetchData();
    } catch(err: any) {
      toast.error('حدث خطأ أثناء إنشاء المدير: ' + err.message);
    } finally {
      setIsAdminSaving(false);
    }
  };

  const revokeAccess = async (id: string, type: 'staff' | 'branches') => {
    if (!window.confirm(`هل أنت متأكد من سحب صلاحيات الدخول وإيقاف الحساب؟`)) return;
    try {
      const { error } = await supabase.from(type).update({ username: null, password: null, system_role: null }).eq('id', id);
      if (error) throw error;
      toast.success('تم إيقاف الحساب وسحب الصلاحية بنجاح.');
      fetchData();
    } catch (error: any) {
      toast.error('حدث خطأ: ' + error.message);
    }
  };

  const togglePermission = (moduleIndex: number, actionIndex: number, roleId: string) => {
    const newMatrix = [...permissionsMatrix];
    const currentRoles = newMatrix[moduleIndex].actions[actionIndex].roles;
    if (currentRoles.includes(roleId)) newMatrix[moduleIndex].actions[actionIndex].roles = currentRoles.filter(r => r !== roleId);
    else newMatrix[moduleIndex].actions[actionIndex].roles.push(roleId);
    setPermissionsMatrix(newMatrix);
  };

  const handleSaveMatrix = () => {
    setIsMatrixSaving(true);
    setTimeout(() => {
      localStorage.setItem('erp_permissions_matrix', JSON.stringify(permissionsMatrix));
      toast.success('تم تحديث وحفظ هيكل الصلاحيات بنجاح! 🛡️');
      setIsMatrixSaving(false);
    }, 800); 
  };

  const filteredData = activeEntityTab === 'staff' 
    ? staff.filter(s => s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.branch?.toLowerCase().includes(searchQuery.toLowerCase()))
    : branches.filter(b => b.name?.toLowerCase().includes(searchQuery.toLowerCase()) || b.agencies?.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen transition-colors duration-300 font-sans relative overflow-x-hidden pb-40 ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white'}`} dir="rtl">
        
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] transition-colors duration-500 from-blue-100/50 via-slate-50 to-slate-50 dark:from-blue-900/15 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <header className={`shrink-0 flex flex-col border-b z-30 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl shadow-sm border-slate-200 dark:border-white/5 transition-all duration-500 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 border-none' : 'scale-y-100 opacity-100'}`}>
          <div className="h-16 px-4 md:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm dark:shadow-inner border border-blue-200 dark:border-blue-500/20 transition-colors"><ShieldCheck className="w-5 h-5" /></div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-slate-800 dark:text-white transition-colors">إدارة النظام <span className="text-blue-600 dark:text-blue-400">(Access)</span></h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="p-2 rounded-lg outline-none cursor-pointer active:scale-95 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap" title="تغيير المظهر">
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <div className="w-px h-6 mx-1 bg-slate-200 dark:bg-white/10 transition-colors"></div>
              
              <button onClick={() => setIsZenMode(true)} className="p-2 rounded-lg outline-none cursor-pointer active:scale-95 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors whitespace-nowrap" title="وضع التركيز">
                <Eye className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <div className={`p-4 md:p-6 max-w-[100rem] mx-auto w-full transition-all duration-300 ${isZenMode ? 'mt-4' : ''}`}>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 w-full">
            <div className="flex items-center gap-5 text-right w-full md:w-auto">
              <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-3xl text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-500/20 shrink-0 transition-colors">
                <UserCog className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1 transition-colors">الصلاحيات والحسابات</h2>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 transition-colors">إدارة حسابات الدخول وتخصيص الصلاحيات الديناميكية لكل دور.</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#121214] p-1.5 rounded-2xl flex items-center w-full md:w-auto overflow-x-auto shadow-inner border border-slate-200 dark:border-white/5 transition-colors duration-300">
              <button onClick={() => setActiveTab('users')} className={`px-6 py-3 min-w-max text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none active:scale-95 ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-white/5'}`}>
                <Key className="w-4 h-4" /> إدارة الحسابات
              </button>
              <button onClick={() => setActiveTab('matrix')} className={`px-6 py-3 min-w-max text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none active:scale-95 ${activeTab === 'matrix' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-white/5'}`}>
                <ShieldCheck className="w-4 h-4" /> هيكل الصلاحيات
              </button>
            </div>
          </div>

          {activeTab === 'users' && (
            <div className="bg-white dark:bg-[#121214] p-4 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/5 w-full min-h-[400px] transition-colors duration-300 animate-in fade-in">
              
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0a0a0c] p-1.5 rounded-2xl shadow-inner border border-slate-200 dark:border-white/5 w-full xl:w-auto transition-colors">
                  <button 
                    onClick={() => { setActiveEntityTab('branches'); setSearchQuery(''); }}
                    className={`flex-1 xl:flex-none px-5 py-2.5 rounded-xl text-[12px] font-black flex items-center justify-center gap-2 transition-all outline-none active:scale-95 ${activeEntityTab === 'branches' ? 'bg-white dark:bg-[#1a1a24] text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200 dark:border-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    <Store className="w-4 h-4"/> حسابات الفروع
                  </button>
                  <button 
                    onClick={() => { setActiveEntityTab('staff'); setSearchQuery(''); }}
                    className={`flex-1 xl:flex-none px-5 py-2.5 rounded-xl text-[12px] font-black flex items-center justify-center gap-2 transition-all outline-none active:scale-95 ${activeEntityTab === 'staff' ? 'bg-white dark:bg-[#1a1a24] text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    <Users className="w-4 h-4"/> حسابات الكادر
                  </button>
                </div>

                <div className="flex-1 flex gap-3 w-full xl:max-w-2xl">
                  <div className="relative flex-1">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="text" 
                      placeholder={activeEntityTab === 'branches' ? "ابحث باسم الفرع..." : "ابحث باسم الموظف..."}
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold px-4 pr-12 py-3 rounded-2xl focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-[14px] transition-all shadow-inner placeholder:text-slate-400"
                    />
                  </div>
                  {/* 💡 زر إنشاء حساب إدارة النظام المباشر 💡 */}
                  <button onClick={() => setIsAdminModalOpen(true)} className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[13px] flex items-center justify-center gap-2 transition-all shadow-md dark:shadow-[0_0_20px_rgba(79,70,229,0.3)] outline-none cursor-pointer active:scale-95 whitespace-nowrap shrink-0">
                    <Crown className="w-4 h-4"/> إضافة مدير نظام
                  </button>
                </div>

              </div>

              {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredData.map((entity) => {
                    const hasAccess = !!entity.username;
                    const isBranch = activeEntityTab === 'branches';
                    const roleConfig = ROLES_CONFIG.find(r => r.id === entity.system_role) || ROLES_CONFIG[isBranch ? 3 : 5];

                    return (
                      <div key={entity.id} className={`p-5 rounded-[2rem] border transition-all duration-300 relative group overflow-hidden ${hasAccess ? 'bg-white dark:bg-[#0a0a0c] border-blue-200 dark:border-blue-500/30 hover:border-blue-400 dark:hover:border-blue-500/60 shadow-sm' : 'bg-slate-50/50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}`}>
                        
                        {hasAccess && (
                          <div className={`absolute top-0 right-0 w-1.5 h-full shadow-[0_0_10px_rgba(59,130,246,0.5)] bg-${roleConfig.color}-500`}></div>
                        )}

                        <div className="flex items-start gap-4 mb-4">
                          {isBranch ? (
                            <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-br from-sky-400 to-sky-600 text-white flex items-center justify-center shrink-0 shadow-inner border border-white/20">
                              <Store className="w-6 h-6" />
                            </div>
                          ) : (
                            <div className={`w-12 h-12 rounded-[1.2rem] bg-gradient-to-br ${entity.avatar_color || 'from-slate-400 to-slate-600'} text-white flex items-center justify-center font-black text-lg shrink-0 shadow-inner border border-white/20`}>
                              {entity.full_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-black text-slate-900 dark:text-white text-[15px] truncate">{isBranch ? entity.name : entity.full_name}</h3>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                              {isBranch ? (
                                <><Building2 className="w-3 h-3"/> الوكالة: {entity.agencies?.name || 'غير محدد'}</>
                              ) : (
                                <><MapPin className="w-3 h-3"/> {entity.role} • {entity.branch}</>
                              )}
                            </p>
                          </div>
                        </div>

                        {hasAccess ? (
                          <div className={`bg-${roleConfig.color}-50/50 dark:bg-${roleConfig.color}-500/5 border border-${roleConfig.color}-100 dark:border-${roleConfig.color}-500/10 p-3 rounded-2xl mb-4 shadow-inner transition-colors`}>
                            <div className={`flex items-center gap-2 mb-2 text-[11px] font-black text-${roleConfig.color}-700 dark:text-${roleConfig.color}-400`}>
                              {roleConfig.icon} دور النظام: {roleConfig.name}
                            </div>
                            <div className={`flex justify-between items-center bg-white dark:bg-[#121214] p-2 rounded-xl border border-${roleConfig.color}-100 dark:border-${roleConfig.color}-500/20 shadow-sm`}>
                              <span className="text-[10px] font-bold text-slate-500 uppercase">اسم المستخدم</span>
                              <span className="font-black text-slate-800 dark:text-white en-num tracking-wider">{entity.username}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-2xl mb-4 flex flex-col items-center justify-center text-center shadow-inner h-[88px]">
                            <Lock className="w-5 h-5 text-slate-400 mb-1" />
                            <p className="text-[11px] font-bold text-slate-500">
                              {isBranch ? 'هذا الفرع لا يمتلك حساب طلبات' : 'الموظف لا يمتلك حساب دخول'}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button 
                            onClick={() => openAccountModal(entity, activeEntityTab)}
                            className={`flex-1 py-2.5 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 transition-all outline-none cursor-pointer active:scale-95 ${hasAccess ? 'bg-white dark:bg-[#121214] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm' : 'bg-blue-600 text-white shadow-md hover:bg-blue-500'}`}
                          >
                            {hasAccess ? <><Edit2 className="w-4 h-4"/> تعديل الحساب</> : <><UserPlus className="w-4 h-4"/> تفعيل الحساب</>}
                          </button>
                          
                          {hasAccess && (
                            <button onClick={() => revokeAccess(entity.id, activeEntityTab)} className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border border-rose-200 dark:border-rose-500/20 outline-none cursor-pointer active:scale-95 shadow-sm" title="سحب الصلاحية وإيقاف الدخول">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'matrix' && (
            <div className="bg-white dark:bg-[#121214] p-4 md:p-6 rounded-[2.5rem] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/5 w-full transition-colors duration-300 animate-in fade-in">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-indigo-500" />
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">مصفوفة الصلاحيات الشاملة (Interactive)</h3>
                    <p className="text-sm font-bold text-slate-500 mt-1">اضغط على المربعات بالأسفل لتفعيل (✅) أو إلغاء (❌) الصلاحية لأي دور في النظام بدقة.</p>
                  </div>
                </div>
                
                <button 
                  onClick={handleSaveMatrix} 
                  disabled={isMatrixSaving}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[13px] flex items-center justify-center gap-2 transition-all shadow-md dark:shadow-[0_0_20px_rgba(79,70,229,0.3)] outline-none cursor-pointer active:scale-95 w-full md:w-auto"
                >
                  {isMatrixSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                  حفظ تحديثات المصفوفة
                </button>
              </div>

              <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-white/10 rounded-2xl shadow-inner bg-slate-50/50 dark:bg-[#0a0a0c]">
                <table className="w-full text-right border-collapse min-w-[1000px]">
                  <thead>
                    <tr>
                      <th className="py-4 px-4 bg-slate-100 dark:bg-[#121214] border-b-2 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-[13px] sticky right-0 z-20 shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.05)] w-[360px]">الموديول / الإجراء (Action)</th>
                      {ROLES_CONFIG.map(role => (
                        <th key={role.id} className="py-4 px-2 bg-slate-100 dark:bg-[#121214] border-b-2 border-slate-200 dark:border-white/10 text-center border-r border-white dark:border-[#0a0a0c]">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className={`p-2 bg-${role.color}-100 dark:bg-${role.color}-500/20 rounded-xl`}>{role.icon}</div>
                            <span className={`text-[12px] font-black text-${role.color}-700 dark:text-${role.color}-400 whitespace-nowrap`}>{role.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permissionsMatrix.map((module, mIdx) => (
                      <React.Fragment key={mIdx}>
                        <tr className="bg-slate-200/60 dark:bg-white/5 border-y border-slate-300 dark:border-white/10">
                          <td colSpan={ROLES_CONFIG.length + 1} className="py-3 px-4 font-black text-slate-800 dark:text-white text-[14px]">
                            <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-slate-500" /> {module.module}</div>
                          </td>
                        </tr>
                        {module.actions.map((action, aIdx) => (
                          <tr key={aIdx} className="bg-white dark:bg-[#0a0a0c] hover:bg-slate-50 dark:hover:bg-[#121214] border-b border-slate-100 dark:border-white/5 transition-colors">
                            <td className="py-3 px-6 text-sm font-bold text-slate-600 dark:text-slate-400 sticky right-0 bg-inherit shadow-[-4px_0_10px_-5px_rgba(0,0,0,0.02)] border-l border-slate-100 dark:border-white/5">
                              {action.name}
                            </td>
                            {ROLES_CONFIG.map(role => {
                              const hasPermission = action.roles.includes(role.id);
                              return (
                                <td key={role.id} className="py-2 px-2 text-center border-l border-slate-50 dark:border-white/5">
                                  {/* 💡 أزرار التفعيل/الإلغاء التفاعلية 💡 */}
                                  <button 
                                    onClick={() => togglePermission(mIdx, aIdx, role.id)}
                                    className={`p-2.5 rounded-xl transition-all outline-none cursor-pointer hover:scale-110 active:scale-95 ${hasPermission ? `bg-${role.color}-50 dark:bg-${role.color}-500/10 border border-${role.color}-200 dark:border-${role.color}-500/30` : 'bg-transparent border border-transparent hover:bg-slate-100 dark:hover:bg-white/5'}`}
                                  >
                                    {hasPermission ? (
                                      <CheckCircle2 className={`w-5 h-5 text-${role.color}-500 dark:text-${role.color}-400 mx-auto`} />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-slate-300 dark:text-slate-600 mx-auto" />
                                    )}
                                  </button>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 🟢 نافذة إضافة حساب "مدير نظام" مباشرة 🟢 */}
      {isAdminModalOpen && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] z-[100] flex items-center justify-center px-4 py-10 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#121214] w-full max-w-[500px] rounded-[2.5rem] shadow-2xl dark:shadow-[0_0_50px_rgba(79,70,229,0.2)] border border-slate-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-300 transition-colors">
            
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-[#0a0a0c] transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  <Crown className="w-6 h-6"/>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">إنشاء حساب (إدارة عليا)</h3>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">يتمتع هذا الحساب بالوصول الكامل لكل مرافق النظام.</p>
                </div>
              </div>
              <button onClick={() => setIsAdminModalOpen(false)} className="p-2 bg-slate-200 dark:bg-white/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 rounded-xl transition-colors active:scale-95 outline-none cursor-pointer"><XCircle className="w-5 h-5"/></button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-6 space-y-5">
              <div>
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-widest">الاسم الكامل للمدير</label>
                <div className="relative">
                  <Users className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    value={newAdminData.fullName}
                    onChange={(e) => setNewAdminData({...newAdminData, fullName: e.target.value})}
                    placeholder="مثال: ياسر سعدون"
                    className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black text-sm px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-colors shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-widest">اسم المستخدم (للدخول)</label>
                <div className="relative">
                  <UserCog className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    value={newAdminData.username}
                    onChange={(e) => setNewAdminData({...newAdminData, username: e.target.value})}
                    placeholder="مثال: admin_yasser"
                    className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black text-sm px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-colors shadow-inner dir-ltr text-right"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-widest">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={newAdminData.password}
                    onChange={(e) => setNewAdminData({...newAdminData, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black text-sm px-4 pr-12 pl-12 py-3.5 rounded-2xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-colors shadow-inner dir-ltr text-right en-num"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 outline-none cursor-pointer">
                    {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                  </button>
                </div>
              </div>

              <div className="pt-2 mt-4 border-t border-slate-100 dark:border-white/10">
                <button type="submit" disabled={isAdminSaving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 transition-all shadow-md dark:shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50 active:scale-95 outline-none cursor-pointer">
                  {isAdminSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <ShieldCheck className="w-5 h-5"/>} تسجيل حساب الإدارة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟢 نافذة التعديل الاعتيادية (كادر أو فروع) 🟢 */}
      {isModalOpen && selectedEntity && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] z-[100] flex items-center justify-center px-4 py-10 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#121214] w-full max-w-[500px] rounded-[2.5rem] shadow-2xl dark:shadow-[0_0_50px_rgba(59,130,246,0.15)] border border-slate-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-300 transition-colors">
            
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-[#0a0a0c] transition-colors">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${entityType === 'branches' ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400' : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                  {entityType === 'branches' ? <Store className="w-5 h-5"/> : <Users className="w-5 h-5"/>}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    {selectedEntity.username ? 'تعديل الحساب لـ' : 'إنشاء حساب لـ'} {entityType === 'branches' ? 'الفرع' : 'الموظف'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">{entityType === 'branches' ? selectedEntity.name : selectedEntity.full_name}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-200 dark:bg-white/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 rounded-xl transition-colors active:scale-95 outline-none cursor-pointer"><XCircle className="w-5 h-5"/></button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-6 space-y-5">
              
              <div>
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-widest">الدور وصلاحيات النظام</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {ROLES_CONFIG.map(role => {
                    return (
                      <button 
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRole(role.id)}
                        className={`p-2.5 rounded-xl border font-black text-[11px] flex flex-col items-center gap-1.5 transition-all outline-none cursor-pointer active:scale-95 ${selectedRole === role.id ? `bg-${role.color}-50 dark:bg-${role.color}-500/10 border-${role.color}-300 dark:border-${role.color}-500/50 text-${role.color}-700 dark:text-${role.color}-400 shadow-sm` : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5 text-slate-500 hover:border-slate-300 dark:hover:border-white/20'}`}
                      >
                        {role.icon} {role.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-widest">اسم المستخدم (للدخول)</label>
                <div className="relative">
                  <UserCog className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={entityType === 'branches' ? "مثال: mansour_branch" : "مثال: ahmed_ali"}
                    className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black text-sm px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-colors shadow-inner dir-ltr text-right"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 mb-2 block uppercase tracking-widest">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black text-sm px-4 pr-12 pl-12 py-3.5 rounded-2xl focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-colors shadow-inner dir-ltr text-right en-num"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 outline-none cursor-pointer">
                    {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                  </button>
                </div>
                <p className="text-[10px] font-bold text-amber-500 mt-2">ملاحظة: زوّد هذه البيانات للمسؤول المختص ليتمكن من الدخول للبوابة المخصصة له.</p>
              </div>

              <div className="pt-2 mt-4 border-t border-slate-100 dark:border-white/10">
                <button type="submit" disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-[14px] flex items-center justify-center gap-2 transition-all shadow-md dark:shadow-[0_0_20px_rgba(37,99,235,0.3)] disabled:opacity-50 active:scale-95 outline-none cursor-pointer">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ بيانات الدخول
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 🟢 زر إنهاء وضع التركيز 🟢 */}
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

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
        .dir-ltr { direction: ltr; }
      `}} />
    </div>
  );
}