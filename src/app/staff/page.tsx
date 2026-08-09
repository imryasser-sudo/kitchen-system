"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  Users, UserPlus, Search, Filter, Phone, MapPin, 
  Building2, Briefcase, Mail, ShieldCheck, MoreVertical, 
  Edit, Trash2, Calendar, Wallet, CheckCircle2, AlertCircle, X,
  BadgeCheck, Clock, DownloadCloud, Save, Loader2, ContactRound, UserCog,
  Globe, Home, Network, Cake, FileSpreadsheet, Printer, Settings, Maximize, MoveHorizontal, RefreshCw, TableProperties,
  UserX, UserCheck, ArchiveRestore, Moon, Sun, Calculator, Receipt, Coins, Ban, CalendarDays, FileText, Heart, UsersRound,
  ChevronRight, ChevronLeft, ChevronDown
} from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx-js-style';

interface Employee {
  id: string;
  full_name: string; 
  phone: string;
  birth_date: string; 
  country: string;      
  address: string;
  accommodation_type: string;
  department: string;   
  role: string;         
  branch: string;
  status: 'نشط' | 'مجاز' | 'منهى خدماته';
  join_date: string;    
  salary: number;
  avatar_color: string;
  gender?: string;
  marital_status?: string;
}

interface FormState extends Omit<Employee, 'id'> {
  id?: string;
  nationality_type: 'عراقي' | 'مغترب';
  expat_country: string;
  iraqi_gov: string;
  iraqi_area: string;
  address_details: string;
}

const DEPARTMENTS = [
  'الإدارة العليا (Executive Management)',
  'الإنتاج والمطبخ (Production & Kitchen)',
  'المبيعات (Sales)',
  'التسويق (Marketing)',
  'التشغيل والعمليات (Operations)',
  'اللوجستيات والمخازن (Logistics & Warehousing)',
  'الموارد البشرية (HR)',
  'المالية والحسابات (Finance & Accounting)',
  'تكنولوجيا المعلومات (IT)',
  'الصيانة (Maintenance)',
  'الجودة والتطوير (QA / QC)',
  'خدمة العملاء (Customer Service)',
  'الشؤون القانونية (Legal)',
  'المشتريات (Procurement)',
  'البحث والتطوير (R&D)'
];

const ROLES = [
  'المدير العام (CEO/GM)', 'مدير تنفيذي (COO)', 'مدير مالي (CFO)', 'مدير إداري (CAO)',
  'مدير إنتاج', 'شيف تنفيذي', 'شيف رئيسي', 'شيف قسم', 'مساعد شيف', 'طباخ', 'قصاب', 'عامل تحضير', 'خَباز / حلواني', 'عامل تعبئة وتغليف',
  'مدير تشغيل', 'مدير فرع', 'مشرف فرع', 'كابتن صالة', 'ويتر (نادل)', 'كاشير', 'باريستا', 'عامل نظافة / ستيوارد',
  'مدير مخازن', 'أمين مخزن', 'مشرف حركة', 'سائق / مندوب توصيل', 'عامل تحميل وتفريغ',
  'مدير موارد بشرية', 'مسؤول توظيف', 'محاسب عام', 'محاسب تكاليف', 'أمين صندوق', 'مدقق مالي', 'محصل ديون',
  'مدير جودة', 'مشرف جودة (QA)', 'مراقب جودة (QC)', 'مدير صيانة', 'فني صيانة', 'مهندس IT', 'دعم فني (IT Support)',
  'مدير تسويق', 'مدير مبيعات', 'مندوب مبيعات', 'صانع محتوى', 'خدمة عملاء'
];

const IRAQ_LOCATIONS: Record<string, string[]> = {
  'بغداد': ['الكرخ', 'الرصافة', 'المنصور', 'الكاظمية', 'الاعظمية', 'مدينة الصدر', 'الدورة', 'الكرادة', 'الجادرية', 'السيدية', 'العامرية', 'حي الجامعة', 'الغزالية', 'الشعب', 'الشعلة', 'البياع', 'حي العدل', 'حي الخضراء', 'حي الجهاد', 'حي العامل', 'حي التراث', 'أبو غريب', 'التاجي', 'المحمودية', 'المدائن', 'النهروان', 'الحسينية', 'الزعفرانية', 'أخرى'],
  'البصرة': ['مركز البصرة', 'العشار', 'المعقل', 'القبلة', 'الزبير', 'أبي الخصيب', 'القرنة', 'شط العرب', 'الفاو', 'أم قصر', 'سفوان', 'المدينة', 'أخرى'],
  'نينوى': ['الموصل القديمة', 'الجانب الأيسر', 'الجانب الأيمن', 'تلعفر', 'الحمدانية', 'سنجار', 'الشيخان', 'مخمور', 'البعاج', 'تلكيف', 'أخرى'],
  'أربيل': ['مركز أربيل', 'عنكاوا', 'بختياري', 'شورش', 'شقلاوة', 'سوران', 'رواندز', 'كوي سنجق', 'أخرى'],
  'النجف': ['مركز النجف', 'الكوفة', 'المشخاب', 'المناذرة', 'الحيرة', 'العباسية', 'أخرى'],
  'ذي قار': ['الناصرية', 'الشامية', 'الجزيرة', 'سوق الشيوخ', 'الشطرة', 'الرفاعي', 'الجبايش', 'أخرى'],
  'كركوك': ['مركز كركوك', 'رحيم آوة', 'الشورجة', 'تسعين', 'طريق بغداد', 'الحويجة', 'داقوق', 'الدبس', 'أخرى'],
  'الأنبار': ['الرمادي', 'الفلوجة', 'هيت', 'حديثة', 'الرطبة', 'عانة', 'راوة', 'القائم', 'الخالدية', 'أخرى'],
  'ديالى': ['بعقوبة', 'الخالص', 'المقدادية', 'جلولاء', 'خانقين', 'بلدروز', 'السعدية', 'أخرى'],
  'المثنى': ['السماوة', 'الرميثة', 'الخضر', 'الوركاء', 'السلمان', 'أخرى'],
  'بابل': ['الحلة', 'المسيب', 'المحاويل', 'الهاشمية', 'القاسم', 'كوثى', 'الإسكندرية', 'أخرى'],
  'ميسان': ['العمارة', 'المجر الكبير', 'الميمونة', 'قلعة صالح', 'الكحلاء', 'علي الغربي', 'أخرى'],
  'كربلاء': ['مركز كربلاء', 'طويريج (الهندية)', 'الحسينية', 'الحر', 'عين التمر', 'حي الموظفين', 'حي الحسين', 'أخرى'],
  'واسط': ['الكوت', 'الصويرة', 'النعمانية', 'الحي', 'العزيزية', 'الزبيدية', 'بدرة', 'أخرى'],
  'صلاح الدين': ['تكريت', 'سامراء', 'بيجي', 'طوزخورماتو', 'الدجيل', 'بلد', 'الشرقاط', 'أخرى'],
  'الديوانية': ['مركز الديوانية', 'الشامية', 'عفك', 'الحمزة', 'الشنافية', 'السدير', 'أخرى'],
  'السليمانية': ['مركز السليمانية', 'بختياري', 'سرجنار', 'حلبجة', 'كلار', 'رانية', 'بنجوين', 'دوكان', 'أخرى'],
  'دهوك': ['مركز دهوك', 'زاخو', 'العمادية', 'سميل', 'عقرة', 'شيخان', 'أخرى']
};

const GRADIENTS = ['from-indigo-400 to-violet-600', 'from-emerald-400 to-teal-600', 'from-rose-400 to-red-600', 'from-sky-400 to-blue-600', 'from-amber-400 to-orange-500', 'from-fuchsia-400 to-pink-600'];

const INITIAL_FORM_STATE: FormState = {
  full_name: '', 
  phone: '',
  birth_date: '', 
  country: 'العراق', 
  address: '',
  accommodation_type: 'سكن شخصي (خارجي)',
  department: '',
  role: '',
  branch: '',
  status: 'نشط',
  join_date: dayjs().format('YYYY-MM-DD'),
  salary: 0,
  avatar_color: '',
  nationality_type: 'عراقي',
  expat_country: '',
  iraqi_gov: 'بغداد',
  iraqi_area: '',
  address_details: '',
  gender: 'ذكر',
  marital_status: 'أعزب'
};

const defaultPdfSettings = {
  paperSize: 'A4',
  margin: '10mm',
  zoom: 90,
  shiftX: 0,
  autoFit: false,
  c_seq: 4, c_name: 18, c_phone: 12, c_birth: 10, c_dept: 12, c_role: 12, c_branch: 10, c_join: 10, c_salary: 6, c_status: 6
};

// 💡 إعدادات التقويم المنبثق 💡
type PickerTarget = 'birth_date' | 'join_date';
const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function StaffDirectoryPage() {
  const { isDark } = useTheme();
  const [mainTab, setMainTab] = useState<'directory' | 'list' | 'terminated' | 'form'>('directory');
  
  const [staff, setStaff] = useState<Employee[]>([]);
  const [dbAgencies, setDbAgencies] = useState<any[]>([]);
  const [dbBranches, setDbBranches] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [settlementData, setSettlementData] = useState<any>(null);

  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // 💡 حالة التقويم المنبثق 💡
  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, target: PickerTarget, viewDate: dayjs.Dayjs, mode: 'date' | 'month' | 'year'
  }>({ isOpen: false, target: 'join_date', viewDate: dayjs(), mode: 'date' });

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('staffTablePdfSettings_v1');
    if (savedSettings) {
      try { setPdfSettings(JSON.parse(savedSettings)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('staffTablePdfSettings_v1', JSON.stringify(pdfSettings));
    }
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => {
    setPdfSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetPdfSettings = () => {
    setPdfSettings(defaultPdfSettings);
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [staffRes, agenciesRes, branchesRes, categoriesRes] = await Promise.all([
        supabase.from('staff').select('*'),
        supabase.from('agencies').select('id, name'),
        supabase.from('branches').select('id, name'),
        supabase.from('categories').select('id, name')
      ]);
      
      if (staffRes.error) {
        console.error("Fetch Staff Error:", staffRes.error);
        setStaff([]); 
      } else {
        const sortedStaff = (staffRes.data || []).sort((a, b) => new Date(b.join_date || 0).getTime() - new Date(a.join_date || 0).getTime());
        setStaff(sortedStaff);
      }

      setDbAgencies(agenciesRes.data || []);
      setDbBranches(branchesRes.data || []);
      setDbCategories(categoriesRes.data || []);

    } catch (err) {
      console.error(err);
      setStaff([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const channel = supabase
      .channel('staff-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => {
        fetchAllData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const activeStaff = useMemo(() => staff.filter(e => e.status !== 'منهى خدماته'), [staff]);
  const terminatedStaff = useMemo(() => staff.filter(e => e.status === 'منهى خدماته'), [staff]);

  const filteredStaff = useMemo(() => {
    return activeStaff.filter(emp => {
      const matchSearch = (emp.full_name || '').includes(searchQuery) || (emp.phone || '').includes(searchQuery) || (emp.address && emp.address.includes(searchQuery));
      const matchDept = departmentFilter ? emp.department === departmentFilter : true;
      const matchStatus = statusFilter ? emp.status === statusFilter : true;
      return matchSearch && matchDept && matchStatus;
    });
  }, [activeStaff, searchQuery, departmentFilter, statusFilter]);

  const filteredTerminatedStaff = useMemo(() => {
    return terminatedStaff.filter(emp => {
      const matchSearch = (emp.full_name || '').includes(searchQuery) || (emp.phone || '').includes(searchQuery) || (emp.address && emp.address.includes(searchQuery));
      const matchDept = departmentFilter ? emp.department === departmentFilter : true;
      return matchSearch && matchDept;
    });
  }, [terminatedStaff, searchQuery, departmentFilter]);

  const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2) : '?';

  // 💡 دوال التقويم المخصص 💡
  const openDatePicker = (target: PickerTarget, defaultDate: string) => {
    setDatePickerConfig({ isOpen: true, target, viewDate: defaultDate ? dayjs(defaultDate) : dayjs(), mode: 'date' });
  };

  const handleDateSelection = (dateStr: string) => {
    setFormData(prev => ({ ...prev, [datePickerConfig.target]: dateStr }));
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const handleSaveEmployee = async () => {
    if (!formData.full_name.trim() || !formData.phone.trim() || !formData.role || !formData.branch || !formData.department) {
      alert('يرجى تعبئة جميع الحقول الأساسية (الاسم، الهاتف، القسم، المنصب، الفرع)');
      return;
    }

    if (formData.id && ['1', '2', '3'].includes(formData.id)) {
      alert('لا يمكن تعديل البيانات التجريبية (Mock Data). يرجى الذهاب لتبويب "إضافة موظف" وإضافة موظف حقيقي جديد.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      let finalCountry = '';
      let finalAddress = '';

      if (formData.nationality_type === 'عراقي') {
        finalCountry = 'العراق';
        const parts = [formData.iraqi_gov, formData.iraqi_area, formData.address_details].filter(Boolean);
        finalAddress = parts.join(' - ');
      } else {
        finalCountry = formData.expat_country || 'غير محدد';
        finalAddress = formData.address_details || '';
      }

      const payload = {
        full_name: formData.full_name, 
        phone: formData.phone,
        birth_date: formData.birth_date,
        country: finalCountry,
        address: finalAddress,
        accommodation_type: formData.accommodation_type || 'سكن شخصي (خارجي)',
        department: formData.department,
        role: formData.role,
        branch: formData.branch,
        status: formData.status,
        join_date: formData.join_date,
        salary: Number(formData.salary),
        avatar_color: formData.avatar_color || GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
        gender: formData.gender || 'ذكر',
        marital_status: formData.marital_status || 'أعزب'
      };

      if (formData.id) {
        const { error } = await supabase.from('staff').update(payload).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('staff').insert([payload]);
        if (error) throw error;
      }

      setSaveSuccess(true);
      fetchAllData(); 
      
      setTimeout(() => {
        setSaveSuccess(false);
        setMainTab('directory'); 
        setFormData(INITIAL_FORM_STATE);
      }, 1500);

    } catch (error: any) {
      console.error("Save Error:", error);
      alert(`حدث خطأ أثناء حفظ البيانات: ${error?.message || 'تأكد من تطبيق تحديثات قاعدة البيانات.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const openSettlementModal = (emp: Employee) => {
    const start = dayjs(emp.join_date || dayjs());
    const end = dayjs();
    
    const years = end.diff(start, 'year');
    const startPlusYears = start.add(years, 'year');
    const months = end.diff(startPlusYears, 'month');
    const startPlusMonths = startPlusYears.add(months, 'month');
    const days = end.diff(startPlusMonths, 'day');

    const totalDaysWorked = end.diff(start, 'day');
    const baseEOS = Math.round((emp.salary / 365) * totalDaysWorked);

    setSettlementData({
      employee: emp,
      years,
      months,
      days,
      baseEOS: baseEOS > 0 ? baseEOS : 0,
      attendedDays: 0,
      unpaidSalary: 0,
      deductions: 0,
      notes: ''
    });
  };

  const currentMonthPay = settlementData ? Math.round((settlementData.employee.salary / 30) * (settlementData.attendedDays || 0)) : 0;
  const netTotal = settlementData ? ((Number(settlementData.baseEOS) || 0) + currentMonthPay + (Number(settlementData.unpaidSalary) || 0) - (Number(settlementData.deductions) || 0)) : 0;

  const confirmTermination = async () => {
    if (!settlementData) return;
    if (!window.confirm(`هل أنت متأكد من إنهاء خدمة الموظف "${settlementData.employee.full_name}" ونقله لأرشيف المفصولين؟`)) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('staff').update({ status: 'منهى خدماته' }).eq('id', settlementData.employee.id);
      if (error) throw error;
      
      setSettlementData(null);
      setSelectedEmployee(null);
      fetchAllData();
    } catch (error: any) {
      console.error("Terminate Error:", error);
      alert(`حدث خطأ أثناء تخليص خدمة الموظف: ${error?.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const printSettlementSlip = () => {
    if (!settlementData) return;
    
    const emp = settlementData.employee;
    const printWindow = document.createElement('iframe');
    printWindow.style.display = 'none';
    document.body.appendChild(printWindow);
    
    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <title>وصل تصفية مستحقات - ${emp.full_name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body { font-family: 'Cairo', sans-serif; padding: 40px; color: #1e293b; background: white; }
            .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #059669; margin: 0; font-size: 28px; font-weight: 900; }
            .header p { color: #64748b; margin: 5px 0 0 0; font-size: 14px; }
            .section-title { background: #f1f5f9; padding: 10px 15px; font-weight: bold; color: #0f172a; border-radius: 8px; margin: 25px 0 15px 0; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            .label { font-weight: bold; color: #64748b; width: 30%; }
            .value { font-weight: 900; color: #0f172a; }
            .net-total { background: #0f172a; color: white; padding: 20px; text-align: center; border-radius: 12px; margin-top: 30px; }
            .net-total h2 { margin: 0; font-size: 36px; }
            .net-total p { margin: 5px 0 0 0; color: #94a3b8; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; text-align: center; }
            .sig-box { width: 45%; }
            .sig-line { border-bottom: 1px dashed #cbd5e1; height: 50px; margin-bottom: 10px; }
            .print-date { text-align: left; font-size: 11px; color: #94a3b8; margin-top: 40px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>إدارة المطبخ المركزي - نظام الموارد البشرية</h1>
            <p>وصل تصفية مستحقات مالية ونهاية خدمة</p>
          </div>

          <div class="section-title">المعلومات الإدارية للموظف</div>
          <table>
            <tr><td class="label">اسم الموظف الرباعي:</td><td class="value">${emp.full_name}</td><td class="label">رقم الهاتف:</td><td class="value dir-ltr" dir="ltr" style="text-align: right;">${emp.phone}</td></tr>
            <tr><td class="label">القسم التنظيمي:</td><td class="value">${emp.department}</td><td class="label">المنصب الوظيفي:</td><td class="value">${emp.role}</td></tr>
            <tr><td class="label">موقع العمل (الفرع):</td><td class="value">${emp.branch}</td><td class="label">نوع السكن:</td><td class="value">${emp.accommodation_type || 'سكن شخصي'}</td></tr>
            <tr><td class="label">تاريخ المباشرة:</td><td class="value dir-ltr" dir="ltr" style="text-align: right;">${emp.join_date}</td><td class="label">الراتب الأساسي:</td><td class="value dir-ltr" dir="ltr" style="text-align: right;">$${emp.salary}</td></tr>
          </table>

          <div class="section-title">التفاصيل المالية والتصفية</div>
          <table>
            <tr><td class="label">مدة الخدمة الفعلية:</td><td class="value">${settlementData.years} سنوات، ${settlementData.months} أشهر، ${settlementData.days} أيام</td></tr>
            <tr><td class="label">مكافأة نهاية الخدمة:</td><td class="value dir-ltr" dir="ltr" style="text-align: right; color:#059669;">$${settlementData.baseEOS}</td></tr>
            <tr><td class="label">أيام الحضور (الشهر الحالي):</td><td class="value">${settlementData.attendedDays} أيام (يعادل $${currentMonthPay})</td></tr>
            <tr><td class="label">إضافات ومكافآت أخرى:</td><td class="value dir-ltr" dir="ltr" style="text-align: right; color:#0ea5e9;">$${settlementData.unpaidSalary}</td></tr>
            <tr><td class="label">الخصومات والسلف:</td><td class="value dir-ltr" dir="ltr" style="text-align: right; color:#e11d48;">-$${settlementData.deductions}</td></tr>
            ${settlementData.notes ? `<tr><td class="label">ملاحظات إدارية:</td><td class="value" colspan="3">${settlementData.notes}</td></tr>` : ''}
          </table>

          <div class="net-total">
            <p>المبلغ الصافي المستحق الدفع</p>
            <h2 dir="ltr">$${netTotal.toLocaleString()}</h2>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-line"></div>
              <strong>توقيع الموظف المستلم</strong>
              <p style="font-size: 12px; color: #64748b; margin-top:5px;">أقر بأني استلمت كافة مستحقاتي المذكورة أعلاه.</p>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <strong>توقيع ومصادقة الإدارة</strong>
            </div>
          </div>

          <div class="print-date">تاريخ ووقت إصدار الوصل: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</div>
        </body>
      </html>
    `;
    
    const doc = printWindow.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        printWindow.contentWindow?.focus();
        printWindow.contentWindow?.print();
        setTimeout(() => document.body.removeChild(printWindow), 1000);
      }, 500);
    }
  };

  const handleRestoreEmployee = async (id: string, empName: string) => {
    if (!window.confirm(`هل أنت متأكد من إعادة الموظف "${empName}" للخدمة مرة أخرى؟`)) return;
    try {
      const { error } = await supabase.from('staff').update({ status: 'نشط' }).eq('id', id);
      if (error) throw error;
      setSelectedEmployee(null);
      fetchAllData();
    } catch (error: any) {
      console.error("Restore Error:", error);
      alert(`حدث خطأ أثناء إعادة الموظف: ${error?.message}`);
    }
  };

  const handleAddNew = () => {
    setFormData(INITIAL_FORM_STATE);
    setMainTab('form');
  };

  const handleEdit = (employee: Employee) => {
    const isIraqi = employee.country === 'العراق' || !employee.country;
    let parsedGov = 'بغداد';
    let parsedArea = '';
    let parsedDetails = employee.address || '';

    if (isIraqi && employee.address && employee.address.includes(' - ')) {
       const parts = employee.address.split(' - ');
       if (parts.length >= 1 && Object.keys(IRAQ_LOCATIONS).includes(parts[0])) {
         parsedGov = parts[0];
         if (parts.length >= 2) parsedArea = parts[1];
         if (parts.length >= 3) parsedDetails = parts.slice(2).join(' - ');
       }
    }

    setFormData({
      ...employee,
      nationality_type: isIraqi ? 'عراقي' : 'مغترب',
      expat_country: isIraqi ? '' : employee.country,
      iraqi_gov: isIraqi ? parsedGov : 'بغداد',
      iraqi_area: isIraqi ? parsedArea : '',
      address_details: isIraqi ? parsedDetails : employee.address || '',
      gender: employee.gender || 'ذكر',
      marital_status: employee.marital_status || 'أعزب'
    });
    setSelectedEmployee(null); 
    setMainTab('form'); 
  };

  const handleExportExcel = (dataset: Employee[], title: string) => {
    if (dataset.length === 0) return alert("لا توجد بيانات لتصديرها.");

    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="ar">
      <head><meta charset="utf-8" /><style>
        table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; }
        th { background-color: #10b981; color: #ffffff; font-weight: bold; font-size: 14px; padding: 12px; border: 1px solid #cbd5e1; text-align: center; }
        td { padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-size: 13px; color: #1e293b; font-weight: bold; }
        .title { font-size: 20px; font-weight: bold; color: #059669; text-align: center; margin-bottom: 10px; background-color: #ecfdf5; border: 2px solid #10b981;}
      </style></head>
      <body>
        <table>
          <tr><td colspan="12" class="title">${title}</td></tr>
          <tr><td colspan="12" style="text-align:center; color:#64748b; font-size: 12px; padding: 10px; border:none;">تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</td></tr>
          <tr><td colspan="12" style="border:none; height: 10px;"></td></tr>
          <thead>
            <tr>
              <th width="4%">ت</th>
              <th width="15%">اسم الموظف</th>
              <th width="12%">رقم الهاتف</th>
              <th width="8%">الجنس</th>
              <th width="8%">الحالة الاجتماعية</th>
              <th width="10%">المواليد</th>
              <th width="12%">القسم التنظيمي</th>
              <th width="12%">المنصب/الوظيفة</th>
              <th width="10%">الفرع/موقع العمل</th>
              <th width="10%">نوع السكن</th>
              <th width="10%">تاريخ المباشرة</th>
              <th width="8%">الراتب الأساسي ($)</th>
            </tr>
          </thead>
          <tbody>
    `;

    dataset.forEach((emp, index) => {
      tableHTML += `
        <tr>
          <td>${index + 1}</td>
          <td style="text-align: right;">${emp.full_name}</td>
          <td dir="ltr">${emp.phone}</td>
          <td>${emp.gender || '-'}</td>
          <td>${emp.marital_status || '-'}</td>
          <td dir="ltr">${emp.birth_date || '-'}</td>
          <td style="color: #4f46e5;">${emp.department || '-'}</td>
          <td style="color: #0f172a;">${emp.role}</td>
          <td style="color: #059669;">${emp.branch}</td>
          <td style="color: ${emp.accommodation_type?.includes('داخل الموقع') ? '#0284c7' : '#64748b'};">${emp.accommodation_type || 'سكن شخصي'}</td>
          <td dir="ltr">${emp.join_date || '-'}</td>
          <td dir="ltr" style="color: #e11d48;">${emp.salary}</td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table></body></html>`;
    const blob = new Blob(['\uFEFF' + tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}_${dayjs().format('YYYY-MM-DD')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = (dataset: Employee[], title: string, themeColor: string) => {
    if (dataset.length === 0) return alert("لا توجد بيانات لطباعتها.");
    setIsExportingPDF(true);

    const getColStyle = (widthPercent: number) => {
      return pdfSettings.autoFit ? `padding: 8px 4px;` : `width: ${widthPercent}%; padding: 8px 4px;`;
    };

    let trRows = '';
    dataset.forEach((emp, index) => {
      const rowClass = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      
      const statusStyle = emp.status === 'منهى خدماته' ? 'color: #e11d48; background: #ffe4e6;' :
                          emp.status === 'مجاز' ? 'color: #d97706; background: #fef3c7;' :
                          'color: #059669; background: #d1fae5;';

      trRows += `
        <tr style="background-color: ${rowClass}; page-break-inside: avoid;">
          <td style="${getColStyle(pdfSettings.c_seq)} color: #64748b; font-weight: bold; text-align: center; border: 1px solid #e2e8f0; font-size: 11px;">${index + 1}</td>
          <td style="${getColStyle(pdfSettings.c_name)} font-weight: 900; text-align: right; border: 1px solid #e2e8f0; font-size: 12px; color: #1e293b;">${emp.full_name} <div style="font-size: 8px; color: #94a3b8; margin-top: 2px;">${emp.accommodation_type || 'سكن شخصي'}</div></td>
          <td dir="ltr" style="${getColStyle(pdfSettings.c_phone)} text-align: center; font-weight: bold; color: #475569; border: 1px solid #e2e8f0; font-size: 11px;">${emp.phone}</td>
          <td dir="ltr" style="${getColStyle(pdfSettings.c_birth)} text-align: center; font-weight: bold; color: #64748b; border: 1px solid #e2e8f0; font-size: 11px;">${emp.birth_date || '-'}</td>
          <td style="${getColStyle(pdfSettings.c_dept)} text-align: center; font-weight: 900; color: #4f46e5; border: 1px solid #e2e8f0; font-size: 11px;">${emp.department || '-'}</td>
          <td style="${getColStyle(pdfSettings.c_role)} text-align: center; font-weight: bold; color: #0f172a; border: 1px solid #e2e8f0; font-size: 11px;">${emp.role}</td>
          <td style="${getColStyle(pdfSettings.c_branch)} text-align: center; font-weight: 900; color: #059669; border: 1px solid #e2e8f0; font-size: 11px;">${emp.branch}</td>
          <td dir="ltr" style="${getColStyle(pdfSettings.c_join)} text-align: center; border: 1px solid #e2e8f0; font-size: 11px; font-weight: bold; color: #475569;">${emp.join_date || '-'}</td>
          <td dir="ltr" style="${getColStyle(pdfSettings.c_salary)} text-align: center; font-weight: 900; border: 1px solid #e2e8f0; font-size: 12px; color: #e11d48;">${emp.salary}</td>
          <td style="${getColStyle(pdfSettings.c_status)} text-align: center; font-weight: 900; font-size: 11px; border: 1px solid #e2e8f0; ${statusStyle}">${emp.status}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            
            @page { size: ${pdfSettings.paperSize} landscape; margin: ${pdfSettings.margin}; }
            
            body { font-family: 'Cairo', system-ui, sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; background: white; }
            .print-footer { display: flex !important; position: fixed !important; bottom: 0; left: 0; right: 0; background: white; padding-top: 6px; border-top: 2px solid #e2e8f0; z-index: 1000; justify-content: space-between; font-size: 12px; font-weight: 900; color: #64748b; }
            table { width: 100% !important; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'} !important; border-collapse: collapse; page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            th, td { word-break: break-word !important; overflow-wrap: break-word !important; white-space: normal !important; }
            .print-container { padding-bottom: 50px; zoom: ${pdfSettings.zoom / 100}; width: 100%; max-width: 100%; margin-right: ${pdfSettings.shiftX}mm; }
          </style>
        </head>
        <body>
          <div class="print-container">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid ${themeColor}; padding-bottom: 12px; margin-bottom: 25px;">
              <div>
                <h1 style="margin: 0; color: ${themeColor}; font-size: 26px; font-weight: 900;">${title}</h1>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold;">يحتوي على الأقسام والفروع والرواتب الأساسية</p>
              </div>
              <div style="text-align: left;">
                <p style="margin: 0; color: #475569; font-size: 12px; font-weight: bold;">نظام الإدارة المركزي</p>
                <p style="margin: 2px 0 0 0; color: #94a3b8; font-size: 10px;">تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #1e293b; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: ${themeColor}; color: #ffffff;">
                  <th style="${getColStyle(pdfSettings.c_seq)} text-align: center; border: 1px solid #cbd5e1; font-size: 12px;">ت</th>
                  <th style="${getColStyle(pdfSettings.c_name)} text-align: right; border: 1px solid #cbd5e1; font-size: 12px; padding-right: 8px !important;">اسم الموظف</th>
                  <th style="${getColStyle(pdfSettings.c_phone)} text-align: center; border: 1px solid #cbd5e1; font-size: 12px;">رقم الهاتف</th>
                  <th style="${getColStyle(pdfSettings.c_birth)} text-align: center; border: 1px solid #cbd5e1; font-size: 12px;">المواليد</th>
                  <th style="${getColStyle(pdfSettings.c_dept)} text-align: center; border: 1px solid #cbd5e1; font-size: 12px;">القسم</th>
                  <th style="${getColStyle(pdfSettings.c_role)} text-align: center; border: 1px solid #cbd5e1; font-size: 12px;">المنصب</th>
                  <th style="${getColStyle(pdfSettings.c_branch)} text-align: center; border: 1px solid #cbd5e1; font-size: 12px;">الفرع</th>
                  <th style="${getColStyle(pdfSettings.c_join)} text-align: center; border: 1px solid #cbd5e1; font-size: 12px;">المباشرة</th>
                  <th style="${getColStyle(pdfSettings.c_salary)} text-align: center; border: 1px solid #cbd5e1; font-size: 12px;">الراتب ($)</th>
                  <th style="${getColStyle(pdfSettings.c_status)} text-align: center; border: 1px solid #cbd5e1; font-size: 12px;">الحالة</th>
                </tr>
              </thead>
              <tbody>
                ${trRows}
              </tbody>
            </table>
            
          </div>
          
          <div class="print-footer">
            <div>طُبع بواسطة: <span style="color: #0f172a; margin-right: 5px;">YASIR SAADOUN</span></div>
            <div dir="ltr">تاريخ الطباعة: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</div>
          </div>
          
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      setTimeout(() => {
        setIsExportingPDF(false);
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);
      }, 1000);
    }
  };

  const totalCalculatedWidth = pdfSettings.c_seq + pdfSettings.c_name + pdfSettings.c_phone + pdfSettings.c_birth + pdfSettings.c_dept + pdfSettings.c_role + pdfSettings.c_branch + pdfSettings.c_join + pdfSettings.c_salary + pdfSettings.c_status;

  if (!isMounted) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="p-4 md:p-8 max-w-[100rem] mx-auto w-full font-sans pb-[130px] min-h-screen bg-slate-50 dark:bg-[#050505] transition-colors duration-300" dir="rtl">
        
        <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-white/5 flex flex-col xl:flex-row justify-between items-center gap-6 mb-8 transition-colors duration-300">
          <div className="flex items-center gap-4 text-right w-full xl:w-auto">
            <div className="bg-gradient-to-br from-teal-400 via-emerald-500 to-teal-700 w-14 h-14 rounded-[1.3rem] text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center shrink-0">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-[22px] font-black text-slate-800 dark:text-white tracking-tight transition-colors">نظام الموارد البشرية (HR)</h2>
              <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">إدارة بيانات ورواتب الكادر والموظفين</p>
            </div>
          </div>

          <div className="bg-slate-100/80 dark:bg-[#050505] p-1.5 rounded-2xl flex items-center w-full xl:w-auto overflow-x-auto hide-scrollbar shadow-inner border border-slate-200/50 dark:border-white/10 transition-colors duration-300">
            <button 
              onClick={() => setMainTab('directory')} 
              className={`px-5 py-3 min-w-max text-[12px] md:text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 ${mainTab === 'directory' ? 'bg-white dark:bg-[#121214] text-emerald-600 dark:text-emerald-400 shadow-md border border-slate-200/50 dark:border-white/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
            >
              <ContactRound className="w-[18px] h-[18px]" /> دليل البطاقات
            </button>
            
            <button 
              onClick={() => setMainTab('list')} 
              className={`px-5 py-3 min-w-max text-[12px] md:text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 ${mainTab === 'list' ? 'bg-white dark:bg-[#121214] text-emerald-600 dark:text-emerald-400 shadow-md border border-slate-200/50 dark:border-white/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
            >
              <TableProperties className="w-[18px] h-[18px]" /> جدول الكادر النشط
            </button>

            <div className="w-px h-6 bg-slate-300 dark:bg-white/10 mx-1 shrink-0 transition-colors"></div>

            <button 
              onClick={() => setMainTab('terminated')} 
              className={`px-5 py-3 min-w-max text-[12px] md:text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 ${mainTab === 'terminated' ? 'bg-white dark:bg-[#121214] text-rose-600 dark:text-rose-400 shadow-md border border-slate-200/50 dark:border-white/5' : 'text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10'}`}
            >
              <UserX className="w-[18px] h-[18px]" /> أرشيف المفصولين
            </button>

            <div className="w-px h-6 bg-slate-300 dark:bg-white/10 mx-1 shrink-0 transition-colors"></div>

            <button 
              onClick={handleAddNew} 
              className={`px-5 py-3 min-w-max text-[12px] md:text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95 ${mainTab === 'form' ? 'bg-white dark:bg-[#121214] text-emerald-600 dark:text-emerald-400 shadow-md border border-slate-200/50 dark:border-white/5' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
            >
              <UserCog className="w-[18px] h-[18px]" /> {formData.id ? 'تعديل الملف' : 'إضافة موظف'}
            </button>
          </div>
        </div>

        {mainTab === 'directory' && (
          <div className="animate-in fade-in duration-300">
            <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-4 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] mb-8 flex flex-col md:flex-row items-center gap-4 transition-colors duration-300">
              <div className="relative w-full md:w-96 shrink-0">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="ابحث بالاسم، رقم الهاتف، أو السكن..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 text-[14px] transition-all shadow-sm dark:shadow-inner"
                />
              </div>
              
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block mx-2 transition-colors"></div>

              <div className="flex w-full gap-3 overflow-x-auto custom-island-scroll pb-2 md:pb-0">
                <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all min-w-[150px] cursor-pointer appearance-none shadow-sm dark:shadow-inner">
                  <option value="" className="bg-white dark:bg-[#121214]">كل الأقسام</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept} className="bg-white dark:bg-[#121214]">{dept}</option>)}
                </select>
                
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all min-w-[150px] cursor-pointer appearance-none shadow-sm dark:shadow-inner">
                  <option value="" className="bg-white dark:bg-[#121214]">حالة الدوام (الكل)</option>
                  <option value="نشط" className="bg-white dark:bg-[#121214]">نشط (على رأس العمل)</option>
                  <option value="مجاز" className="bg-white dark:bg-[#121214]">مجاز</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4"><Loader2 className="w-12 h-12 text-emerald-500 animate-spin" /><p className="text-slate-500 dark:text-slate-400 font-bold transition-colors">جاري تحميل دليل الكادر...</p></div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center py-32 bg-white/50 dark:bg-[#121214]/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 transition-colors duration-300">
                <Search className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600 transition-colors" />
                <p className="text-xl font-black text-slate-500 dark:text-slate-400 mb-1 transition-colors">لا يوجد موظف نشط بهذا الوصف</p>
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 transition-colors">حاول تغيير كلمات البحث أو الفلاتر.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {filteredStaff.map((emp) => (
                  <div 
                    key={emp.id} 
                    className="bg-white dark:bg-[#0a0a0c] border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 shadow-sm hover:shadow-md dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] hover:border-emerald-200 dark:hover:border-emerald-500/50 transition-all duration-300 flex flex-col group relative overflow-hidden"
                  >
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${emp.avatar_color || 'from-slate-200 to-slate-300'} opacity-5 dark:opacity-[0.03] rounded-bl-[100px] pointer-events-none group-hover:opacity-10 dark:group-hover:opacity-10 transition-opacity`}></div>
                    
                    <div className="flex items-start justify-between mb-5 relative z-10 cursor-pointer" onClick={() => setSelectedEmployee(emp)}>
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-[1.2rem] bg-gradient-to-br ${emp.avatar_color || 'from-slate-700 to-slate-800'} text-white flex items-center justify-center font-black text-xl shadow-md relative`}>
                          {getInitials(emp.full_name)}
                          {emp.accommodation_type?.includes('داخل الموقع') && (
                            <div className="absolute -bottom-2 -right-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-1 rounded-full border border-emerald-200 dark:border-emerald-500/30 shadow-sm" title="مبيت داخل الموقع">
                              <Moon className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {emp.accommodation_type?.includes('خارجي') && (
                            <div className="absolute -bottom-2 -right-2 bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 p-1 rounded-full border border-sky-200 dark:border-sky-500/30 shadow-sm" title="سكن خارجي (يرجع لبيته)">
                              <Sun className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-[17px] font-black text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{emp.full_name}</h4>
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5"><Network className="w-3.5 h-3.5"/> {emp.department || 'قسم غير محدد'}</p>
                        </div>
                      </div>
                      
                      <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 border shadow-sm dark:shadow-inner shrink-0 ${
                        emp.status === 'نشط' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 
                        'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                      }`}>
                        {emp.status === 'نشط' && <BadgeCheck className="w-3 h-3" />}
                        {emp.status === 'مجاز' && <Clock className="w-3 h-3" />}
                        {emp.status}
                      </div>
                    </div>

                    <div className="space-y-3 mt-auto relative z-10">
                      <div className="bg-slate-50 dark:bg-[#121214] p-3 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center gap-3 transition-colors shadow-sm dark:shadow-inner">
                        <div className="p-2 bg-white dark:bg-[#050505] rounded-xl shadow-sm dark:shadow-inner text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-white/5"><Briefcase className="w-4 h-4"/></div>
                        <div><span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">المنصب</span><span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{emp.role}</span></div>
                      </div>
                      
                      <div className="flex gap-2">
                        <div className="bg-slate-50 dark:bg-[#121214] p-3 rounded-2xl border border-slate-100 dark:border-white/5 flex-1 flex items-center gap-3 transition-colors shadow-sm dark:shadow-inner">
                          <div className="p-2 bg-white dark:bg-[#050505] rounded-xl shadow-sm dark:shadow-inner text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-white/5"><MapPin className="w-4 h-4"/></div>
                          <div><span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">موقع العمل</span><span className="text-[12px] font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{emp.branch}</span></div>
                        </div>
                        <button onClick={() => openSettlementModal(emp)} className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-600 dark:hover:bg-emerald-500 hover:text-white dark:hover:text-white rounded-2xl transition-all shadow-sm outline-none cursor-pointer active:scale-95 flex items-center justify-center shrink-0" title="حاسبة المستحقات والتصفية">
                          <Calculator className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mainTab === 'list' && (
          <div className="animate-in fade-in duration-300">
            
            <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] mb-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 transition-colors duration-300">
              <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                <div className="relative w-full md:w-80 shrink-0">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="ابحث بالاسم، رقم الهاتف..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 pr-12 py-3 rounded-xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 text-[13px] transition-all shadow-sm dark:shadow-inner placeholder-slate-400 dark:placeholder-slate-600"
                  />
                </div>
                <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="w-full md:w-auto bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all text-[13px] cursor-pointer appearance-none shadow-sm dark:shadow-inner">
                  <option value="" className="bg-white dark:bg-[#121214]">كل الأقسام</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept} className="bg-white dark:bg-[#121214]">{dept}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full md:w-auto bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all text-[13px] cursor-pointer appearance-none shadow-sm dark:shadow-inner">
                  <option value="" className="bg-white dark:bg-[#121214]">حالة الدوام (الكل)</option>
                  <option value="نشط" className="bg-white dark:bg-[#121214]">نشط</option>
                  <option value="مجاز" className="bg-white dark:bg-[#121214]">مجاز</option>
                </select>
              </div>

              <div className="flex items-center gap-3 w-full xl:w-auto shrink-0 bg-slate-50 dark:bg-[#050505] p-2 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors">
                <button onClick={() => setShowPdfSettings(!showPdfSettings)} className={`p-3 rounded-xl transition-all shadow-sm border outline-none cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-500 dark:border-emerald-400' : 'bg-white dark:bg-[#121214] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}><Settings className={`w-4 h-4 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} /></button>
                <button onClick={() => handleExportPDF(filteredStaff, 'سجل بيانات الكادر النشط الشامل', '#10b981')} disabled={isExportingPDF || filteredStaff.length === 0} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-500 dark:hover:bg-emerald-400 px-5 py-3 rounded-xl font-black text-[13px] transition-all shadow-sm disabled:opacity-50 outline-none cursor-pointer active:scale-95">
                  {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4"/>} {isExportingPDF ? 'جاري التحضير...' : 'طباعة الجدول'}
                </button>
                <button onClick={() => handleExportExcel(filteredStaff, 'سجل بيانات الكادر النشط')} disabled={filteredStaff.length === 0} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-5 py-3 rounded-xl font-black text-[13px] transition-all shadow-sm disabled:opacity-50 outline-none cursor-pointer active:scale-95"><FileSpreadsheet className="w-4 h-4"/> إكسل</button>
              </div>
            </div>

            {showPdfSettings && (
              <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.15)] dark:shadow-[0_10px_40px_-10px_rgba(16,185,129,0.1)] flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative mb-8 transition-colors duration-300">
                
                <div className="flex items-center justify-between border-b border-emerald-50 dark:border-emerald-500/10 pb-3">
                  <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2"><Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/> إعدادات طباعة الجدول المتقدمة</span>
                  <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-emerald-500/50">
                    <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">حجم الورق</label>
                    <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 cursor-pointer appearance-none transition-colors shadow-sm dark:shadow-inner">
                      <option value="A4" className="bg-white dark:bg-[#121214]">A4 (ورق قياسي)</option>
                      <option value="A3" className="bg-white dark:bg-[#121214]">A3 (أفضل للأعمدة الكثيرة)</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">هوامش الورقة</label>
                    <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 cursor-pointer appearance-none transition-colors shadow-sm dark:shadow-inner">
                      <option value="0mm" className="bg-white dark:bg-[#121214]">بدون هوامش (0mm)</option>
                      <option value="2mm" className="bg-white dark:bg-[#121214]">ضيقة جداً (2mm)</option>
                      <option value="5mm" className="bg-white dark:bg-[#121214]">ضيقة (5mm)</option>
                      <option value="10mm" className="bg-white dark:bg-[#121214]">عادية (10mm)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-emerald-500/50 ${pdfSettings.autoFit ? 'bg-emerald-600 dark:bg-emerald-500 border-emerald-700 dark:border-emerald-400 text-white shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                      <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 w-full lg:col-span-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                      <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/30 shadow-sm dark:shadow-inner" dir="ltr">{pdfSettings.shiftX} mm</span>
                    </div>
                    <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-emerald-600 dark:accent-emerald-500 h-2 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer mt-1 border border-transparent dark:border-white/5" />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <hr className="flex-1 border-slate-100 dark:border-white/5" />
                  <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">إعدادات الأعمدة (للاحتواء اليدوي)</span>
                  <hr className="flex-1 border-slate-100 dark:border-white/5" />
                </div>

                <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex flex-col gap-2 w-full col-span-2 md:col-span-3 lg:col-span-6 mb-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                      <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/30 shadow-sm dark:shadow-inner">{pdfSettings.zoom}%</span>
                    </div>
                    <input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-emerald-600 dark:accent-emerald-500 h-2 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" />
                  </div>

                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">التسلسل</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_seq}%</span></div><input type="range" min="2" max="10" value={pdfSettings.c_seq} onChange={e => updatePdfSetting('c_seq', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">اسم الموظف</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_name}%</span></div><input type="range" min="10" max="40" value={pdfSettings.c_name} onChange={e => updatePdfSetting('c_name', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الهاتف</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_phone}%</span></div><input type="range" min="5" max="20" value={pdfSettings.c_phone} onChange={e => updatePdfSetting('c_phone', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">المواليد</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_birth}%</span></div><input type="range" min="5" max="20" value={pdfSettings.c_birth} onChange={e => updatePdfSetting('c_birth', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">القسم</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_dept}%</span></div><input type="range" min="5" max="25" value={pdfSettings.c_dept} onChange={e => updatePdfSetting('c_dept', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">المنصب</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_role}%</span></div><input type="range" min="5" max="25" value={pdfSettings.c_role} onChange={e => updatePdfSetting('c_role', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الفرع</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_branch}%</span></div><input type="range" min="5" max="20" value={pdfSettings.c_branch} onChange={e => updatePdfSetting('c_branch', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">تاريخ المباشرة</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_join}%</span></div><input type="range" min="5" max="20" value={pdfSettings.c_join} onChange={e => updatePdfSetting('c_join', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الراتب ($)</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_salary}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_salary} onChange={e => updatePdfSetting('c_salary', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الحالة</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_status}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_status} onChange={e => updatePdfSetting('c_status', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                </div>

                {!pdfSettings.autoFit && (() => {
                  const totalCalculatedWidth = pdfSettings.c_seq + pdfSettings.c_name + pdfSettings.c_phone + pdfSettings.c_birth + pdfSettings.c_dept + pdfSettings.c_role + pdfSettings.c_branch + pdfSettings.c_join + pdfSettings.c_salary + pdfSettings.c_status;
                  return (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors shadow-sm dark:shadow-inner ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
                      <span>مجموع النسب للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-700 dark:text-rose-500' : 'text-emerald-800 dark:text-emerald-500'}`}>{totalCalculatedWidth}%</span></span>
                      {totalCalculatedWidth > 100 ? (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيضغط الجدول)</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول منسق)</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="overflow-x-auto w-full custom-island-scroll bg-white dark:bg-[#0a0a0c] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner pb-4 transition-colors duration-300">
              <table className="w-full text-right border-collapse min-w-[1100px]">
                <thead className="bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase transition-colors duration-300">
                  <tr>
                    <th className="py-4 px-3 border-b border-slate-200 dark:border-white/10 text-center">ت</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-right">اسم الموظف</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">رقم الهاتف</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">المواليد</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">القسم</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">المنصب</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">الفرع</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">تاريخ المباشرة</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">الراتب ($)</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">الحالة</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center sticky left-0 bg-slate-50 dark:bg-[#121214] z-10 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 transition-colors duration-300">
                  {isLoading ? (
                    <tr><td colSpan={11} className="py-16 text-center"><Loader2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 animate-spin mx-auto"/></td></tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr><td colSpan={11} className="py-16 text-center text-slate-400 dark:text-slate-500 font-bold">لا توجد بيانات تطابق بحثك</td></tr>
                  ) : (
                    filteredStaff.map((emp, idx) => (
                      <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-[#121214]/50 transition-colors bg-white dark:bg-[#0a0a0c]">
                        <td className="py-3 px-3 text-slate-400 dark:text-slate-500 font-bold text-xs text-center">{idx + 1}</td>
                        <td className="py-3 px-4 font-black text-slate-800 dark:text-slate-200 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${emp.avatar_color || 'from-slate-700 to-slate-800'} text-white flex items-center justify-center font-black text-xs shrink-0 relative shadow-sm`}>
                            {getInitials(emp.full_name)}
                            {emp.accommodation_type?.includes('داخل الموقع') && (
                              <div className="absolute -bottom-1 -right-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30" title="مبيت داخل الموقع"><Moon className="w-2.5 h-2.5" /></div>
                            )}
                          </div>
                          {emp.full_name}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 text-center dir-ltr">{emp.phone}</td>
                        <td className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 text-center dir-ltr">{emp.birth_date || '-'}</td>
                        <td className="py-3 px-4 font-black text-indigo-600 dark:text-indigo-400 text-center">{emp.department || '-'}</td>
                        <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 text-center">{emp.role}</td>
                        <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400 text-center">{emp.branch}</td>
                        <td className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 text-center dir-ltr">{emp.join_date || '-'}</td>
                        <td className="py-3 px-4 font-black text-rose-600 dark:text-rose-400 text-center dir-ltr">${emp.salary}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black border shadow-sm dark:shadow-inner inline-block ${
                            emp.status === 'نشط' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center sticky left-0 z-10 bg-white dark:bg-[#0a0a0c] shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setSelectedEmployee(emp)} className="p-1.5 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors outline-none cursor-pointer active:scale-95" title="عرض الملف"><Users className="w-4 h-4"/></button>
                            <button onClick={() => openSettlementModal(emp)} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors outline-none cursor-pointer active:scale-95" title="حاسبة المستحقات"><Calculator className="w-4 h-4"/></button>
                            <button onClick={() => handleEdit(emp)} className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-colors outline-none cursor-pointer active:scale-95" title="تعديل"><Edit className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {mainTab === 'terminated' && (
          <div className="animate-in fade-in duration-300">
            
            <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-6 rounded-[2rem] border border-white dark:border-white/5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] mb-8 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 transition-colors duration-300">
              <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
                <div className="relative w-full md:w-80 shrink-0">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="ابحث بالاسم، رقم الهاتف..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 pr-12 py-3 rounded-xl focus:outline-none focus:border-rose-400 dark:focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/10 text-[13px] transition-all shadow-sm dark:shadow-inner placeholder-slate-400 dark:placeholder-slate-600"
                  />
                </div>
                <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="w-full md:w-auto bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-rose-400 dark:focus:border-rose-500/50 transition-all text-[13px] cursor-pointer appearance-none shadow-sm dark:shadow-inner">
                  <option value="" className="bg-white dark:bg-[#121214]">كل الأقسام</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept} className="bg-white dark:bg-[#121214]">{dept}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-3 w-full xl:w-auto shrink-0 bg-slate-50 dark:bg-[#050505] p-2 rounded-2xl border border-slate-200 dark:border-white/5 transition-colors">
                <button 
                  onClick={() => setShowPdfSettings(!showPdfSettings)} 
                  title="إعدادات القياس للـ PDF"
                  className={`p-3 rounded-xl transition-all shadow-sm border outline-none cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-rose-600 text-white border-rose-700 dark:bg-rose-500 dark:border-rose-400' : 'bg-white dark:bg-[#121214] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                >
                  <Settings className={`w-4 h-4 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} />
                </button>
                <button onClick={() => handleExportPDF(filteredTerminatedStaff, 'أرشيف الموظفين المفصولين ومنهى خدماتهم', '#e11d48')} disabled={isExportingPDF || filteredTerminatedStaff.length === 0} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-rose-600 dark:bg-rose-500 text-white hover:bg-rose-500 dark:hover:bg-rose-400 px-5 py-3 rounded-xl font-black text-[13px] transition-all shadow-sm disabled:opacity-50 outline-none cursor-pointer active:scale-95">
                  {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin"/> : <Printer className="w-4 h-4"/>} 
                  {isExportingPDF ? 'جاري التحضير...' : 'طباعة الجدول'}
                </button>
                <button onClick={() => handleExportExcel(filteredTerminatedStaff, 'أرشيف المفصولين')} disabled={filteredTerminatedStaff.length === 0} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 px-5 py-3 rounded-xl font-black text-[13px] transition-all shadow-sm disabled:opacity-50 outline-none cursor-pointer active:scale-95">
                  <FileSpreadsheet className="w-4 h-4"/> إكسل
                </button>
              </div>
            </div>

            {showPdfSettings && (
              <div className="bg-white dark:bg-[#121214] p-5 rounded-2xl border border-rose-100 dark:border-rose-500/20 shadow-[0_10px_40px_-10px_rgba(225,29,72,0.15)] dark:shadow-[0_10px_40px_-10px_rgba(225,29,72,0.1)] flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative mb-8 transition-colors duration-300">
                
                <div className="flex items-center justify-between border-b border-rose-50 dark:border-rose-500/10 pb-3">
                  <span className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2"><Settings className="w-4 h-4 text-rose-600 dark:text-rose-400"/> إعدادات طباعة الجدول المتقدمة</span>
                  <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 transition-colors bg-slate-50 dark:bg-[#0a0a0c] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-rose-500/50">
                    <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">حجم الورق</label>
                    <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-rose-400 dark:focus:border-rose-500/50 cursor-pointer appearance-none transition-colors shadow-sm dark:shadow-inner">
                      <option value="A4" className="bg-white dark:bg-[#121214]">A4 (ورق قياسي)</option>
                      <option value="A3" className="bg-white dark:bg-[#121214]">A3 (أفضل للأعمدة الكثيرة)</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">هوامش الورقة</label>
                    <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-rose-400 dark:focus:border-rose-500/50 cursor-pointer appearance-none transition-colors shadow-sm dark:shadow-inner">
                      <option value="0mm" className="bg-white dark:bg-[#121214]">بدون هوامش (0mm)</option>
                      <option value="2mm" className="bg-white dark:bg-[#121214]">ضيقة جداً (2mm)</option>
                      <option value="5mm" className="bg-white dark:bg-[#121214]">ضيقة (5mm)</option>
                      <option value="10mm" className="bg-white dark:bg-[#121214]">عادية (10mm)</option>
                    </select>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-rose-500/50 ${pdfSettings.autoFit ? 'bg-rose-600 dark:bg-rose-500 border-rose-700 dark:border-rose-400 text-white shadow-md dark:shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                      <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 w-full lg:col-span-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                      <span className="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-500/30 shadow-sm dark:shadow-inner" dir="ltr">{pdfSettings.shiftX} mm</span>
                    </div>
                    <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-rose-600 dark:accent-rose-500 h-2 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer mt-1 border border-transparent dark:border-white/5" />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <hr className="flex-1 border-slate-100 dark:border-white/5" />
                  <span className="text-[10px] font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-full border border-rose-100 dark:border-rose-500/20 shadow-sm dark:shadow-inner">إعدادات الأعمدة (للاحتواء اليدوي)</span>
                  <hr className="flex-1 border-slate-100 dark:border-white/5" />
                </div>

                <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex flex-col gap-2 w-full col-span-2 md:col-span-3 lg:col-span-6 mb-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                      <span className="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-500/30 shadow-sm dark:shadow-inner">{pdfSettings.zoom}%</span>
                    </div>
                    <input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-rose-600 dark:accent-rose-500 h-2 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" />
                  </div>

                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">التسلسل</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_seq}%</span></div><input type="range" min="2" max="10" value={pdfSettings.c_seq} onChange={e => updatePdfSetting('c_seq', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">اسم الموظف</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_name}%</span></div><input type="range" min="10" max="40" value={pdfSettings.c_name} onChange={e => updatePdfSetting('c_name', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الهاتف</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_phone}%</span></div><input type="range" min="5" max="20" value={pdfSettings.c_phone} onChange={e => updatePdfSetting('c_phone', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">المواليد</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_birth}%</span></div><input type="range" min="5" max="20" value={pdfSettings.c_birth} onChange={e => updatePdfSetting('c_birth', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">القسم</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_dept}%</span></div><input type="range" min="5" max="25" value={pdfSettings.c_dept} onChange={e => updatePdfSetting('c_dept', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">المنصب</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_role}%</span></div><input type="range" min="5" max="25" value={pdfSettings.c_role} onChange={e => updatePdfSetting('c_role', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الفرع</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_branch}%</span></div><input type="range" min="5" max="20" value={pdfSettings.c_branch} onChange={e => updatePdfSetting('c_branch', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">تاريخ المباشرة</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_join}%</span></div><input type="range" min="5" max="20" value={pdfSettings.c_join} onChange={e => updatePdfSetting('c_join', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الراتب ($)</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_salary}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_salary} onChange={e => updatePdfSetting('c_salary', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                  <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">الحالة</label><span className="text-slate-600 dark:text-slate-500 text-[9px] font-black">{pdfSettings.c_status}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_status} onChange={e => updatePdfSetting('c_status', Number(e.target.value))} className="w-full accent-slate-500 dark:accent-slate-400 h-1.5 bg-slate-200 dark:bg-[#050505] rounded-lg appearance-none cursor-pointer border border-transparent dark:border-white/5" /></div>
                </div>

                {!pdfSettings.autoFit && (() => {
                  const totalCalculatedWidth = pdfSettings.c_seq + pdfSettings.c_name + pdfSettings.c_phone + pdfSettings.c_birth + pdfSettings.c_dept + pdfSettings.c_role + pdfSettings.c_branch + pdfSettings.c_join + pdfSettings.c_salary + pdfSettings.c_status;
                  return (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors shadow-sm dark:shadow-inner ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
                      <span>مجموع النسب للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-700 dark:text-rose-500' : 'text-emerald-800 dark:text-emerald-500'}`}>{totalCalculatedWidth}%</span></span>
                      {totalCalculatedWidth > 100 ? (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيضغط الجدول)</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول منسق)</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="overflow-x-auto w-full custom-island-scroll bg-white dark:bg-[#0a0a0c] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner pb-4 transition-colors duration-300">
              <table className="w-full text-right border-collapse min-w-[1100px]">
                <thead className="bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 font-black text-[12px] uppercase transition-colors duration-300">
                  <tr>
                    <th className="py-4 px-3 border-b border-slate-200 dark:border-white/10 text-center">ت</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-right">اسم الموظف</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">رقم الهاتف</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">المواليد</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">القسم</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">المنصب</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">الفرع</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">تاريخ المباشرة</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">الراتب ($)</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center">الحالة</th>
                    <th className="py-4 px-4 border-b border-slate-200 dark:border-white/10 text-center sticky left-0 bg-slate-50 dark:bg-[#121214] z-10 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 transition-colors duration-300">
                  {isLoading ? (
                    <tr><td colSpan={11} className="py-16 text-center"><Loader2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 animate-spin mx-auto"/></td></tr>
                  ) : filteredTerminatedStaff.length === 0 ? (
                    <tr><td colSpan={11} className="py-16 text-center text-slate-400 dark:text-slate-500 font-bold">لا يوجد موظفين في قائمة المفصولين</td></tr>
                  ) : (
                    filteredTerminatedStaff.map((emp, idx) => (
                      <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-[#121214]/50 transition-colors bg-rose-50/20 dark:bg-rose-500/5">
                        <td className="py-3 px-3 text-slate-400 dark:text-slate-500 font-bold text-xs text-center">{idx + 1}</td>
                        <td className="py-3 px-4 font-black text-slate-800 dark:text-slate-200 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${emp.avatar_color || 'from-slate-700 to-slate-800'} opacity-80 text-white flex items-center justify-center font-black text-xs shrink-0 relative shadow-sm`}>
                            {getInitials(emp.full_name)}
                            {emp.accommodation_type?.includes('داخل الموقع') && (
                              <div className="absolute -bottom-1 -right-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30" title="مبيت داخل الموقع"><Moon className="w-2.5 h-2.5" /></div>
                            )}
                          </div>
                          {emp.full_name}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 text-center dir-ltr">{emp.phone}</td>
                        <td className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 text-center dir-ltr">{emp.birth_date || '-'}</td>
                        <td className="py-3 px-4 font-black text-indigo-600/70 dark:text-indigo-400/70 text-center">{emp.department || '-'}</td>
                        <td className="py-3 px-4 font-bold text-slate-700/70 dark:text-slate-300/70 text-center">{emp.role}</td>
                        <td className="py-3 px-4 font-black text-emerald-600/70 dark:text-emerald-400/70 text-center">{emp.branch}</td>
                        <td className="py-3 px-4 font-bold text-slate-500 dark:text-slate-400 text-center dir-ltr">{emp.join_date || '-'}</td>
                        <td className="py-3 px-4 font-black text-rose-600/70 dark:text-rose-400/70 text-center dir-ltr">${emp.salary}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-1 rounded-md text-[10px] font-black border bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20 shadow-sm dark:shadow-inner inline-block">
                            {emp.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center sticky left-0 z-10 bg-white dark:bg-[#0a0a0c] shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)] dark:shadow-[4px_0_10px_-5px_rgba(255,255,255,0.02)] transition-colors">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setSelectedEmployee(emp)} className="p-1.5 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors outline-none cursor-pointer active:scale-95" title="عرض الملف"><Users className="w-4 h-4"/></button>
                            <button onClick={() => handleRestoreEmployee(emp.id, emp.full_name)} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors outline-none cursor-pointer active:scale-95" title="إعادة للخدمة"><UserCheck className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 🟢 التبويب الرابع: فورم إضافة وتعديل موظف المطور */}
        {/* ========================================================= */}
        {mainTab === 'form' && (
          <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white dark:border-white/5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-300 transition-colors">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-bl-[120px] pointer-events-none transition-colors duration-300"></div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner transition-colors duration-300"><UserCog className="w-7 h-7" /></div>
                <div>
                  <h3 className="text-[22px] font-black text-slate-800 dark:text-white transition-colors duration-300">{formData.id ? 'تحديث ملف الموظف' : 'تسجيل موظف جديد'}</h3>
                  <p className="text-[12px] font-bold text-slate-400 dark:text-slate-500 mt-1 transition-colors duration-300">يرجى تعبئة كافة الحقول لبناء السجل الوظيفي الشامل</p>
                </div>
              </div>

              <button 
                onClick={handleSaveEmployee} 
                disabled={isSaving} 
                className={`flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-black text-[14px] transition-all duration-300 z-10 outline-none cursor-pointer active:scale-95 ${saveSuccess ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30' : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-xl shadow-teal-500/30 text-white hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100'}`}
              >
                {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الحفظ...</> : saveSuccess ? <><CheckCircle2 className="w-5 h-5" /> تم الحفظ بنجاح!</> : <><Save className="w-5 h-5" /> {formData.id ? 'حفظ التعديلات' : 'إضافة الموظف'}</>}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 relative z-10">
              {/* قسم البيانات الشخصية ووسائل الاتصال */}
              <div className="space-y-6">
                <h4 className="text-[14px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-6 border-b border-emerald-100 dark:border-emerald-500/20 pb-3 flex items-center gap-2 transition-colors duration-300"><Users className="w-4 h-4"/> البيانات الشخصية والإتصال</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">اسم الموظف الرباعي</label>
                    <div className="relative">
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition-colors duration-300"><Users className="w-5 h-5"/></div>
                      <input 
                        type="text" 
                        value={formData.full_name}
                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                        placeholder="مثال: علي محمد حسين" 
                        className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner" 
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">رقم الهاتف الأساسي</label>
                    <div className="relative">
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition-colors duration-300"><Phone className="w-5 h-5"/></div>
                      <input 
                        type="text" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="07XX XXX XXXX" 
                        className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner dir-ltr text-right" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">المواليد (التولد)</label>
                    <div className="relative group cursor-pointer active:scale-95 transition-all" onClick={() => openDatePicker('birth_date', formData.birth_date)}>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors duration-300 pointer-events-none"><Cake className="w-5 h-5"/></div>
                      <div className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold px-4 pr-12 py-3.5 rounded-2xl group-hover:border-emerald-400 dark:group-hover:border-emerald-500/50 transition-all shadow-sm dark:shadow-inner min-h-[50px] flex items-center">
                         {formData.birth_date ? <span className="dir-ltr">{formData.birth_date}</span> : <span className="text-slate-400 dark:text-slate-600">اختر التاريخ...</span>}
                      </div>
                    </div>
                  </div>

                  {/* 💡 الحقول الجديدة: الجنس والحالة الاجتماعية 💡 */}
                  <div>
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">الجنس</label>
                    <div className="relative">
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition-colors duration-300 pointer-events-none"><UsersRound className="w-5 h-5"/></div>
                      <select 
                        value={formData.gender || 'ذكر'}
                        onChange={(e) => setFormData({...formData, gender: e.target.value})}
                        className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                      >
                        <option value="ذكر" className="bg-white dark:bg-[#121214]">ذكر</option>
                        <option value="أنثى" className="bg-white dark:bg-[#121214]">أنثى</option>
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">الحالة الاجتماعية</label>
                    <div className="relative">
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition-colors duration-300 pointer-events-none"><Heart className="w-5 h-5"/></div>
                      <select 
                        value={formData.marital_status || 'أعزب'}
                        onChange={(e) => setFormData({...formData, marital_status: e.target.value})}
                        className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                      >
                        <option value="أعزب" className="bg-white dark:bg-[#121214]">أعزب</option>
                        <option value="متزوج" className="bg-white dark:bg-[#121214]">متزوج</option>
                        <option value="مطلق" className="bg-white dark:bg-[#121214]">مطلق</option>
                        <option value="أرمل" className="bg-white dark:bg-[#121214]">أرمل</option>
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="sm:col-span-2 mt-2">
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">المنشأ / نوع الموظف (الجنسية)</label>
                    <div className="flex bg-slate-100/80 dark:bg-[#050505] p-1.5 rounded-2xl w-full border border-slate-200/50 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">
                      <button 
                        onClick={() => setFormData({...formData, nationality_type: 'عراقي'})} 
                        className={`flex-1 py-3 rounded-xl font-black text-[13px] transition-all flex items-center justify-center gap-2 outline-none cursor-pointer active:scale-95 ${formData.nationality_type === 'عراقي' ? 'bg-white dark:bg-[#121214] text-emerald-600 dark:text-emerald-400 border border-slate-200/50 dark:border-white/5 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}
                      >
                        <MapPin className="w-4 h-4" /> عراقي (محلي)
                      </button>
                      <button 
                        onClick={() => setFormData({...formData, nationality_type: 'مغترب'})} 
                        className={`flex-1 py-3 rounded-xl font-black text-[13px] transition-all flex items-center justify-center gap-2 outline-none cursor-pointer active:scale-95 ${formData.nationality_type === 'مغترب' ? 'bg-white dark:bg-[#121214] text-emerald-600 dark:text-emerald-400 border border-slate-200/50 dark:border-white/5 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}
                      >
                        <Globe className="w-4 h-4" /> مغترب (أجنبي)
                      </button>
                    </div>
                  </div>

                  {formData.nationality_type === 'عراقي' ? (
                    <>
                      <div className="sm:col-span-1">
                        <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">المحافظة</label>
                        <div className="relative">
                          <select 
                            value={formData.iraqi_gov} 
                            onChange={(e) => setFormData({...formData, iraqi_gov: e.target.value, iraqi_area: ''})} 
                            className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                          >
                            {Object.keys(IRAQ_LOCATIONS).map(gov => <option key={gov} value={gov} className="bg-white dark:bg-[#121214]">{gov}</option>)}
                          </select>
                          <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                        </div>
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">المنطقة / القضاء</label>
                        <div className="relative">
                          <select 
                            value={formData.iraqi_area} 
                            onChange={(e) => setFormData({...formData, iraqi_area: e.target.value})} 
                            className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                          >
                            <option value="" disabled className="bg-white dark:bg-[#121214]">-- اختر المنطقة --</option>
                            {(IRAQ_LOCATIONS[formData.iraqi_gov] || []).map(area => <option key={area} value={area} className="bg-white dark:bg-[#121214]">{area}</option>)}
                          </select>
                          <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2 animate-in fade-in zoom-in-95">
                      <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">دولة الأصل (الجنسية)</label>
                      <div className="relative">
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition-colors duration-300"><Globe className="w-5 h-5"/></div>
                        <input 
                          type="text" 
                          value={formData.expat_country}
                          onChange={(e) => setFormData({...formData, expat_country: e.target.value})}
                          placeholder="مثال: مصر، سوريا، بنغلادش..." 
                          className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner" 
                        />
                      </div>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">عنوان السكن التفصيلي <span className="text-slate-400 dark:text-slate-600">(الزقاق، المحلة، أقرب نقطة دالة)</span></label>
                    <div className="relative">
                      <div className="absolute right-4 top-[18px] text-slate-400 dark:text-slate-500 transition-colors duration-300"><Home className="w-5 h-5"/></div>
                      <textarea 
                        value={formData.address_details}
                        onChange={(e) => setFormData({...formData, address_details: e.target.value})}
                        placeholder="مثال: محلة XX زقاق XX دار XX..." 
                        rows={2}
                        className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-bold px-4 pr-12 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner resize-none custom-scrollbar" 
                      />
                    </div>
                  </div>
                  
                  {/* حقل نوع السكن */}
                  <div className="sm:col-span-2 pt-2">
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">توفير المبيت (مكان المنام)</label>
                    <div className="relative">
                      <select 
                        value={formData.accommodation_type || 'سكن شخصي (خارجي)'}
                        onChange={(e) => setFormData({...formData, accommodation_type: e.target.value})}
                        className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                      >
                        <option value="سكن شخصي (خارجي)" className="bg-white dark:bg-[#121214]">سكن شخصي (مبيت خارجي في بيته)</option>
                        <option value="سكن شركة (داخل الموقع)" className="bg-white dark:bg-[#121214]">سكن شركة (مبيت داخل موقع العمل)</option>
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                </div>
              </div>

              {/* قسم البيانات الوظيفية والمالية */}
              <div className="space-y-6">
                <h4 className="text-[14px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-6 border-b border-emerald-100 dark:border-emerald-500/20 pb-3 flex items-center gap-2 transition-colors duration-300"><Briefcase className="w-4 h-4"/> البيانات الوظيفية والمالية</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">القسم التنظيمي</label>
                    <div className="relative">
                      <select 
                        value={formData.department}
                        onChange={(e) => setFormData({...formData, department: e.target.value})}
                        className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                      >
                        <option value="" disabled className="bg-white dark:bg-[#121214]">-- اختر القسم --</option>
                        {DEPARTMENTS.map(d => <option key={d} value={d} className="bg-white dark:bg-[#121214]">{d}</option>)}
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">المنصب / الوظيفة</label>
                    <div className="relative">
                      <select 
                        value={formData.role}
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                        className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                      >
                        <option value="" disabled className="bg-white dark:bg-[#121214]">-- اختر المنصب --</option>
                        {ROLES.map(r => <option key={r} value={r} className="bg-white dark:bg-[#121214]">{r}</option>)}
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">مكان العمل (الفرع/الوكالة)</label>
                    <div className="relative">
                      <select 
                        value={formData.branch}
                        onChange={(e) => setFormData({...formData, branch: e.target.value})}
                        className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                      >
                        <option value="" disabled className="bg-white dark:bg-[#121214]">-- اختر مكان العمل --</option>
                        <optgroup label="مواقع مركزية" className="bg-slate-100 dark:bg-[#1a1a24]">
                          <option value="المطبخ المركزي" className="bg-white dark:bg-[#121214]">المطبخ المركزي</option>
                          <option value="الإدارة المركزية" className="bg-white dark:bg-[#121214]">الإدارة المركزية</option>
                        </optgroup>
                        {dbAgencies.length > 0 && (
                          <optgroup label="الوكالات" className="bg-slate-100 dark:bg-[#1a1a24]">
                            {dbAgencies.map(a => <option key={a.id} value={`وكالة: ${a.name}`} className="bg-white dark:bg-[#121214]">وكالة: {a.name}</option>)}
                          </optgroup>
                        )}
                        {dbBranches.length > 0 && (
                          <optgroup label="الفروع" className="bg-slate-100 dark:bg-[#1a1a24]">
                            {dbBranches.map(b => <option key={b.id} value={`فرع: ${b.name}`} className="bg-white dark:bg-[#121214]">فرع: {b.name}</option>)}
                          </optgroup>
                        )}
                        {dbCategories.length > 0 && (
                          <optgroup label="الأقسام" className="bg-slate-100 dark:bg-[#1a1a24]">
                            {dbCategories.map(c => <option key={c.id} value={`قسم: ${c.name}`} className="bg-white dark:bg-[#121214]">قسم: {c.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">حالة الدوام</label>
                    <div className="relative">
                      <select 
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                        className={`w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 font-bold px-4 py-3.5 rounded-2xl focus:outline-none focus:ring-4 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none ${
                          formData.status === 'نشط' ? 'text-emerald-600 dark:text-emerald-400 focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-emerald-500/10' : 
                          formData.status === 'مجاز' ? 'text-amber-600 dark:text-amber-400 focus:border-amber-400 dark:focus:border-amber-500/50 focus:ring-amber-500/10' : 
                          'text-rose-600 dark:text-rose-400 focus:border-rose-400 dark:focus:border-rose-500/50 focus:ring-rose-500/10'
                        }`}
                      >
                        <option value="نشط" className="bg-white dark:bg-[#121214]">نشط (مداوم)</option>
                        <option value="مجاز" className="bg-white dark:bg-[#121214]">مجاز</option>
                      </select>
                      <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">تاريخ المباشرة بالعمل</label>
                    <div className="relative group cursor-pointer active:scale-95 transition-all" onClick={() => openDatePicker('join_date', formData.join_date)}>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors duration-300 pointer-events-none"><Calendar className="w-5 h-5"/></div>
                      <div className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold px-4 pr-12 py-3.5 rounded-2xl group-hover:border-emerald-400 dark:group-hover:border-emerald-500/50 transition-all shadow-sm dark:shadow-inner min-h-[50px] flex items-center">
                         {formData.join_date ? <span className="dir-ltr">{formData.join_date}</span> : <span className="text-slate-400 dark:text-slate-600">اختر التاريخ...</span>}
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 transition-colors duration-300">الراتب الأساسي ($)</label>
                    <input 
                      type="number" 
                      value={formData.salary || ''}
                      onChange={(e) => setFormData({...formData, salary: Number(e.target.value)})}
                      placeholder="مثال: 500" 
                      className="w-full bg-slate-50/50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-emerald-600 dark:text-emerald-400 placeholder-slate-400 dark:placeholder-slate-600 font-black px-4 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm dark:shadow-inner dir-ltr text-center" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 🌟 النافذة المنبثقة: الملف الشخصي للموظف 🌟 */}
        {/* ========================================================= */}
        {selectedEmployee && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-10 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300 no-print">
            
            <div className="bg-white dark:bg-[#0a0a0c] w-full max-w-[600px] rounded-[2.5rem] shadow-2xl dark:shadow-[0_0_80px_rgba(79,70,229,0.15)] relative border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 transition-colors">
              <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${selectedEmployee.avatar_color || 'from-slate-400 to-slate-500'}`}></div>
              
              <button onClick={() => setSelectedEmployee(null)} className="absolute top-6 left-6 text-slate-400 dark:text-slate-500 hover:text-white bg-slate-100 dark:bg-[#121214] hover:bg-rose-500 dark:hover:bg-rose-500 border border-slate-200 dark:border-white/5 hover:border-rose-500 p-2.5 rounded-full transition-all duration-300 z-20 outline-none cursor-pointer active:scale-95"><X className="w-5 h-5" /></button>

              <div className="p-8 pb-6 z-10 shrink-0 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#121214]/50 flex flex-col items-center text-center mt-4 transition-colors duration-300">
                <div className={`w-28 h-28 rounded-[2rem] bg-gradient-to-br ${selectedEmployee.avatar_color || 'from-slate-700 to-slate-800'} ${selectedEmployee.status === 'منهى خدماته' ? 'opacity-50 grayscale' : ''} text-white flex items-center justify-center font-black text-5xl shadow-xl shadow-indigo-500/20 mb-4 ring-4 ring-white dark:ring-[#0a0a0c] relative transition-colors`}>
                  {getInitials(selectedEmployee.full_name)}
                  {selectedEmployee.accommodation_type?.includes('داخل الموقع') && (
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-xl border-2 border-white dark:border-[#0a0a0c] shadow-lg transition-colors" title="مبيت داخل الموقع"><Moon className="w-4 h-4" /></div>
                  )}
                  {selectedEmployee.accommodation_type?.includes('خارجي') && (
                    <div className="absolute -bottom-2 -right-2 bg-sky-500 text-white p-2 rounded-xl border-2 border-white dark:border-[#0a0a0c] shadow-lg transition-colors" title="سكن خارجي (يرجع لبيته)"><Sun className="w-4 h-4" /></div>
                  )}
                </div>
                <h3 className={`text-[26px] font-black ${selectedEmployee.status === 'منهى خدماته' ? 'text-slate-400 dark:text-slate-600 line-through' : 'text-slate-800 dark:text-white'}`}>{selectedEmployee.full_name}</h3>
                <p className="text-[15px] font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center justify-center gap-1.5"><Briefcase className="w-4 h-4"/> {selectedEmployee.role}</p>
                
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className="bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm dark:shadow-inner transition-colors"><Network className="w-3.5 h-3.5"/> {selectedEmployee.department || 'قسم غير محدد'}</span>
                  <span className="bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm dark:shadow-inner transition-colors"><MapPin className="w-3.5 h-3.5"/> {selectedEmployee.branch}</span>
                  <span className={`border text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm dark:shadow-inner transition-colors ${selectedEmployee.status === 'نشط' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : selectedEmployee.status === 'مجاز' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400'}`}>
                    {selectedEmployee.status === 'نشط' ? <BadgeCheck className="w-3.5 h-3.5"/> : selectedEmployee.status === 'مجاز' ? <Clock className="w-3.5 h-3.5"/> : <AlertCircle className="w-3.5 h-3.5"/>}
                    {selectedEmployee.status}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-island-scroll p-8 space-y-6">
                
                <div>
                  <h4 className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-3">معلومات السكن والإتصال</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4 sm:col-span-2 shadow-sm dark:shadow-inner transition-colors">
                      <div className="p-3 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl text-slate-400 dark:text-slate-500 shrink-0 transition-colors"><Phone className="w-5 h-5"/></div>
                      <div className="overflow-hidden"><p className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">الهاتف</p><p className="text-[16px] font-black text-slate-800 dark:text-slate-200 dir-ltr text-right truncate">{selectedEmployee.phone}</p></div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4 sm:col-span-2 shadow-sm dark:shadow-inner transition-colors">
                      <div className="p-3 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl text-slate-400 dark:text-slate-500 shrink-0 transition-colors"><Cake className="w-5 h-5"/></div>
                      <div className="overflow-hidden"><p className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">المواليد (التولد)</p><p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate">{selectedEmployee.birth_date || 'غير مدرج'}</p></div>
                    </div>
                    
                    {/* 💡 إضافة الجنس والحالة الاجتماعية في البروفايل */}
                    <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4 shadow-sm dark:shadow-inner transition-colors">
                      <div className="p-3 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl text-slate-400 dark:text-slate-500 shrink-0 transition-colors"><UsersRound className="w-5 h-5"/></div>
                      <div className="overflow-hidden"><p className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">الجنس</p><p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate">{selectedEmployee.gender || '-'}</p></div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4 shadow-sm dark:shadow-inner transition-colors">
                      <div className="p-3 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl text-slate-400 dark:text-slate-500 shrink-0 transition-colors"><Heart className="w-5 h-5"/></div>
                      <div className="overflow-hidden"><p className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">الحالة الاجتماعية</p><p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate">{selectedEmployee.marital_status || '-'}</p></div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4 sm:col-span-2 shadow-sm dark:shadow-inner transition-colors">
                      <div className="p-3 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl text-slate-400 dark:text-slate-500 shrink-0 transition-colors"><Globe className="w-5 h-5"/></div>
                      <div className="overflow-hidden"><p className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">الجنسية</p><p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate">{selectedEmployee.country || 'العراق'}</p></div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-2xl p-4 flex items-center gap-4 sm:col-span-2 shadow-sm dark:shadow-inner transition-colors">
                      <div className="p-3 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 shadow-sm rounded-xl text-slate-400 dark:text-slate-500 shrink-0 transition-colors"><Home className="w-5 h-5"/></div>
                      <div className="overflow-hidden">
                        <p className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">السكن: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedEmployee.accommodation_type || 'سكن شخصي'}</span></p>
                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 leading-tight">{selectedEmployee.address || 'العنوان التفصيلي غير مدرج'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-3">السجل الوظيفي والمالي</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-2xl p-4 shadow-sm dark:shadow-inner transition-colors">
                      <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-sky-500 dark:text-sky-400"/><span className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">تاريخ المباشرة</span></div>
                      <p className="text-[15px] font-black text-slate-800 dark:text-slate-300 dir-ltr">{selectedEmployee.join_date}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-2xl p-4 shadow-sm dark:shadow-inner transition-colors">
                      <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/><span className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">الراتب الأساسي</span></div>
                      <p className="text-[15px] font-black text-slate-800 dark:text-slate-300 dir-ltr">${selectedEmployee.salary}</p>
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-6 pt-5 border-t border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-[#121214]/80 flex gap-3 shrink-0 backdrop-blur-md transition-colors duration-300">
                <button onClick={() => handleEdit(selectedEmployee)} className="flex-1 bg-white dark:bg-[#050505] hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 py-3.5 rounded-xl font-black text-[13px] transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 hover:border-emerald-200 dark:hover:border-emerald-500/30 shadow-sm outline-none cursor-pointer active:scale-95"><Edit className="w-4 h-4"/> تعديل الملف</button>
                
                {selectedEmployee.status !== 'منهى خدماته' && (
                  <button onClick={() => { setSelectedEmployee(null); openSettlementModal(selectedEmployee); }} className="flex-1 bg-white dark:bg-[#050505] hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 py-3.5 rounded-xl font-black text-[13px] transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-white/10 hover:border-blue-200 dark:hover:border-blue-500/30 shadow-sm outline-none cursor-pointer active:scale-95">
                    <Calculator className="w-4 h-4"/> حاسبة المستحقات
                  </button>
                )}

                {selectedEmployee.status !== 'منهى خدماته' ? (
                  <button onClick={() => { setSelectedEmployee(null); openSettlementModal(selectedEmployee); }} className="p-3.5 bg-white dark:bg-[#050505] hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all border border-slate-200 dark:border-white/10 hover:border-rose-200 dark:hover:border-rose-500/30 shadow-sm outline-none cursor-pointer active:scale-95" title="تخليص / إنهاء خدمة">
                    <UserX className="w-5 h-5"/>
                  </button>
                ) : (
                  <button onClick={() => handleRestoreEmployee(selectedEmployee.id, selectedEmployee.full_name)} className="flex-1 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all border border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-300 dark:hover:border-emerald-500/50 font-black text-[13px] flex items-center justify-center gap-2 shadow-sm outline-none cursor-pointer active:scale-95">
                    <UserCheck className="w-5 h-5"/> إعادة للخدمة
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ⚠️ حاسبة التخليص ونهاية الخدمة الخرافية ⚠️ */}
        {/* ========================================================= */}
        {settlementData && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-10 bg-slate-900/60 dark:bg-[#050505]/80 backdrop-blur-md animate-in fade-in duration-300 no-print">
            <div className="bg-white dark:bg-[#0a0a0c] w-full max-w-[700px] rounded-[2.5rem] shadow-[0_0_80px_rgba(0,0,0,0.2)] dark:shadow-[0_0_80px_rgba(79,70,229,0.15)] relative border border-slate-200 dark:border-white/10 flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300 transition-colors">
              
              <div className="p-6 md:p-8 shrink-0 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#121214]/50 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 rounded-2xl shadow-sm dark:shadow-inner border border-sky-200 dark:border-sky-500/30"><Calculator className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">حاسبة المستحقات المالية والتصفية</h3>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">تصفية شاملة لكل متعلقات الموظف</p>
                  </div>
                </div>
                <button onClick={() => setSettlementData(null)} className="p-2.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all outline-none cursor-pointer active:scale-95"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-island-scroll p-6 md:p-8 space-y-6">
                
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="bg-slate-50 dark:bg-[#050505] border border-slate-100 dark:border-white/5 p-3 rounded-2xl shadow-sm dark:shadow-inner transition-colors">
                    <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">اسم الموظف</span>
                    <span className="text-[13px] font-black text-slate-700 dark:text-slate-300">{settlementData.employee.full_name}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#050505] border border-slate-100 dark:border-white/5 p-3 rounded-2xl shadow-sm dark:shadow-inner transition-colors">
                    <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">المنصب / الفرع</span>
                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{settlementData.employee.role} - {settlementData.employee.branch}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm dark:shadow-inner transition-colors">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="bg-slate-50 dark:bg-[#050505] p-3 rounded-xl text-sky-500 dark:text-sky-400 border border-slate-100 dark:border-white/5 shadow-sm dark:shadow-inner"><Calendar className="w-5 h-5"/></div>
                    <div>
                      <span className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase">تاريخ المباشرة</span>
                      <span className="text-sm font-black text-slate-700 dark:text-slate-300 dir-ltr block">{settlementData.employee.join_date}</span>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-white/10 hidden md:block transition-colors"></div>
                  <div className="flex gap-4 w-full md:w-auto justify-around md:justify-end">
                    <div className="text-center"><span className="block text-2xl font-black text-sky-600 dark:text-sky-400">{settlementData.years}</span><span className="text-[10px] font-black text-slate-400 dark:text-slate-500">سنوات</span></div>
                    <div className="text-center"><span className="block text-2xl font-black text-sky-600 dark:text-sky-400">{settlementData.months}</span><span className="text-[10px] font-black text-slate-400 dark:text-slate-500">أشهر</span></div>
                    <div className="text-center"><span className="block text-2xl font-black text-sky-600 dark:text-sky-400">{settlementData.days}</span><span className="text-[10px] font-black text-slate-400 dark:text-slate-500">أيام</span></div>
                  </div>
                </div>

                <div className="space-y-4">
                  
                  <div className="bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-5 rounded-2xl shadow-sm dark:shadow-inner transition-colors">
                    <label className="text-[12px] font-black text-indigo-700 dark:text-indigo-400 flex items-center justify-between mb-3">
                      <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4"/> أيام الحضور (الشهر الحالي)</span>
                      <span className="bg-white dark:bg-[#050505] border border-indigo-200 dark:border-indigo-500/30 px-2 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 text-[10px] shadow-sm dark:shadow-inner">الراتب الكلي: ${settlementData.employee.salary}</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1">
                        <input 
                          type="number" 
                          min="0" max="31"
                          placeholder="أدخل عدد الأيام..."
                          value={settlementData.attendedDays || ''}
                          onChange={e => setSettlementData({...settlementData, attendedDays: Number(e.target.value)})}
                          className="w-full bg-white dark:bg-[#050505] border border-indigo-200 dark:border-indigo-500/30 text-indigo-900 dark:text-indigo-300 font-black text-lg px-4 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-center dir-ltr shadow-sm dark:shadow-inner transition-colors" 
                        />
                      </div>
                      <div className="bg-indigo-600 text-white rounded-xl px-6 py-3.5 flex flex-col justify-center items-center shrink-0 min-w-[140px] shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                        <span className="text-[9px] text-indigo-200 uppercase tracking-widest mb-1">الراتب المستحق</span>
                        <span className="font-black text-xl dir-ltr drop-shadow-sm">${currentMonthPay}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-black text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2 transition-colors"><Receipt className="w-4 h-4 text-emerald-500 dark:text-emerald-400"/> مكافأة نهاية الخدمة <span className="text-[10px] text-slate-400 dark:text-slate-500">(تلقائي: راتب شهر عن كل سنة)</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 dark:text-slate-500 pointer-events-none">$</span>
                      <input 
                        type="number" 
                        value={settlementData.baseEOS === 0 ? '' : settlementData.baseEOS}
                        onChange={e => setSettlementData({...settlementData, baseEOS: Number(e.target.value)})}
                        className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-lg px-4 pl-10 py-3.5 rounded-2xl focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 dir-ltr text-left shadow-sm dark:shadow-inner transition-all" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[12px] font-black text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2 transition-colors"><Coins className="w-4 h-4 text-sky-500 dark:text-sky-400"/> إضافات ومكافآت <span className="text-[10px] text-slate-400 dark:text-slate-500">(جمع)</span></label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 dark:text-slate-500 pointer-events-none">$</span>
                        <input 
                          type="number" 
                          value={settlementData.unpaidSalary === 0 ? '' : settlementData.unpaidSalary}
                          onChange={e => setSettlementData({...settlementData, unpaidSalary: Number(e.target.value)})}
                          className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-black text-lg px-4 pl-10 py-3.5 rounded-2xl focus:outline-none focus:border-sky-400 dark:focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/10 dir-ltr text-left shadow-sm dark:shadow-inner transition-all" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[12px] font-black text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-2 transition-colors"><Ban className="w-4 h-4 text-rose-500 dark:text-rose-400"/> خصومات وسلف <span className="text-[10px] text-slate-400 dark:text-slate-500">(طرح)</span></label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 dark:text-slate-500 pointer-events-none">$</span>
                        <input 
                          type="number" 
                          value={settlementData.deductions === 0 ? '' : settlementData.deductions}
                          onChange={e => setSettlementData({...settlementData, deductions: Number(e.target.value)})}
                          className="w-full bg-rose-50/30 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-black text-lg px-4 pl-10 py-3.5 rounded-2xl focus:outline-none focus:border-rose-400 dark:focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/10 dir-ltr text-left shadow-sm dark:shadow-inner transition-all" 
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[12px] font-black text-slate-600 dark:text-slate-400 mb-2 block transition-colors">ملاحظات التصفية <span className="text-[10px] text-slate-400 dark:text-slate-500">(تظهر في الوصل المطبوع)</span></label>
                    <textarea 
                      value={settlementData.notes}
                      onChange={e => setSettlementData({...settlementData, notes: e.target.value})}
                      placeholder="اكتب أي ملاحظات إدارية هنا..."
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 font-bold px-4 py-3 rounded-2xl focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 resize-none shadow-sm dark:shadow-inner transition-all custom-scrollbar"
                    />
                  </div>

                </div>
              </div>

              <div className="p-6 md:p-8 pt-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-[#121214]/80 shrink-0 transition-colors">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
                  <div>
                    <span className="block text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">المبلغ النهائي المستحق</span>
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1">يجب تسليم هذا المبلغ للموظف</span>
                  </div>
                  <div className="bg-slate-900 dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl shadow-xl shadow-slate-900/20 dark:shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-colors">
                    <span className="text-3xl font-black dir-ltr block text-center">${netTotal.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={printSettlementSlip} className="flex-1 bg-white dark:bg-[#050505] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10 py-3.5 rounded-xl font-black text-[13px] transition-all flex items-center justify-center gap-2 shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95">
                    <Printer className="w-4 h-4" /> طباعة وصل التصفية
                  </button>
                  <button onClick={confirmTermination} disabled={isSaving} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-3.5 rounded-xl font-black text-[13px] transition-all flex items-center justify-center gap-2 shadow-md dark:shadow-[0_0_15px_rgba(225,29,72,0.4)] disabled:opacity-70 outline-none cursor-pointer active:scale-95">
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserX className="w-5 h-5" />} تأكيد التخليص وإنهاء الخدمة
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 💡 التقويم المؤسساتي المنبثق (Modal) 💡 */}
        {datePickerConfig.isOpen && (
          <div className="fixed top-0 left-0 w-full h-[100dvh] z-[999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden no-print">
            <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl dark:shadow-[0_0_50px_rgba(16,185,129,0.15)] animate-in zoom-in-95 duration-300">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/5 pb-5 shrink-0 transition-colors">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-emerald-600 dark:text-emerald-400 transition-colors outline-none cursor-pointer active:scale-95">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'month' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'year' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-300'}`}
                   >
                     {datePickerConfig.viewDate.format('YYYY')}
                   </button>
                </div>

                <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-emerald-600 dark:text-emerald-400 transition-colors outline-none cursor-pointer active:scale-95">
                  <ChevronLeft className="w-5 h-5"/>
                </button>
              </div>

              {datePickerConfig.mode === 'year' && (
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const year = datePickerConfig.viewDate.year() - 7 + i;
                    const isSelected = datePickerConfig.viewDate.year() === year;
                    return (
                      <button
                        key={year}
                        onClick={() => {
                          const newDate = datePickerConfig.viewDate.year(year);
                          setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'month'}));
                        }}
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none cursor-pointer ${isSelected ? 'bg-emerald-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner'}`}
                      >
                        {year}
                      </button>
                    )
                  })}
                </div>
              )}

              {datePickerConfig.mode === 'month' && (
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const isSelected = datePickerConfig.viewDate.month() === i;
                    const monthName = dayjs().month(i).format('MMMM');
                    const monthNum = String(i + 1).padStart(2, '0');
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          const newDate = datePickerConfig.viewDate.month(i);
                          setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'date'}));
                        }}
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 flex flex-col items-center gap-1.5 outline-none cursor-pointer ${isSelected ? 'bg-emerald-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-50 dark:bg-[#121214] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner'}`}
                      >
                        <span>{monthName}</span>
                        <span className="text-[10px] en-num opacity-50 font-bold">{monthNum}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {datePickerConfig.mode === 'date' && (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-3">
                    {WEEK_DAYS.map(d => (
                      <div key={d} className="text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: datePickerConfig.viewDate.startOf('month').day() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: datePickerConfig.viewDate.daysInMonth() }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = datePickerConfig.viewDate.date(dayNum).format('YYYY-MM-DD');
                      
                      const selectedDateStr = formData[datePickerConfig.target] as string;
                      const isSelected = dateStr === selectedDateStr;
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDateSelection(dateStr)}
                          className={`
                            aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num transition-all active:scale-95 outline-none cursor-pointer
                            ${isSelected ? 'bg-emerald-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.4)]' :
                              isToday ? 'text-emerald-600 border border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/10' :
                              'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white border border-transparent'}
                          `}
                        >
                          {dayNum}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <button onClick={() => setDatePickerConfig(p => ({...p, isOpen: false}))} className="w-full mt-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/5 dark:hover:bg-rose-500/20 dark:text-slate-400 dark:hover:text-rose-400 rounded-2xl font-black text-[15px] transition-colors border border-transparent outline-none cursor-pointer active:scale-95 shrink-0">
                إلغاء النافذة
              </button>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-island-scroll::-webkit-scrollbar { width: 5px; height: 5px;}
        .custom-island-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-island-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-island-scroll::-webkit-scrollbar-thumb { background: #334155; }
        .custom-island-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        html.dark .custom-island-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }

        .en-num { font-family: system-ui, -apple-system, sans-serif; }
      `}} />
    </div>
  );
}