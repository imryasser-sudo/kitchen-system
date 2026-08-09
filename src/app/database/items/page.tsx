"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom'; 
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
  Package, Plus, Edit2, Trash2, Loader2, X, AlertCircle, Building2, Layers, Scale, PackageOpen, Printer, FileSpreadsheet, ShieldCheck, CheckCircle2, RefreshCw, Maximize, MoveHorizontal, Settings, ChevronDown, LayoutGrid, LayoutList,
  Drumstick, Sandwich, Droplets, Droplet, Pizza, Beef, Fish, Bird, Bone, Wheat, Salad, Soup, Egg, Milk, Carrot, Leaf, Apple, Citrus, Cherry, Grape, Croissant, Cake, Cookie, IceCream, CupSoda, Coffee, GlassWater, Flame, Snowflake, Box, Store, Utensils, CookingPot, Truck, Sparkles, ChefHat, ShoppingCart, UtensilsCrossed, Sun, Moon, AlertTriangle
} from 'lucide-react';
import dayjs from 'dayjs';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useTheme } from '@/components/ThemeProvider'; 

// قائمة وحدات القياس المعتمدة
const COMMON_UNITS = [
  "غم", "كغم", "طن", "مل", "لتر", "قطعة", "عدد", "حبة", "بلانك", "علبة", "كيس", "كيس صغير", "سطل", "صندوق", "لفة", "شريط", "شيش", "باكيت"
];

// خريطة شاملة لكل الأيقونات للتعرف عليها
const allIconsMap: Record<string, any> = {
  Layers, Drumstick, Sandwich, Droplets, Droplet, Pizza, Beef, Fish, Bird, Bone, Wheat, Salad, Soup, Egg, Milk, Carrot, Leaf, Apple, Citrus, Cherry, Grape, Croissant, Cake, Cookie, IceCream, CupSoda, Coffee, GlassWater, Flame, Snowflake, Box, Store, Utensils, CookingPot, Truck, Sparkles, Package, PackageOpen, ChefHat, ShoppingCart, UtensilsCrossed
};

// قائمة الأيقونات المخصصة للمواد مع تصنيفاتها
const itemIconList = [
  { name: 'Drumstick', icon: Drumstick, label: 'كنتاكي', category: 'لحوم' },
  { name: 'Bird', icon: Bird, label: 'دجاج خام', category: 'لحوم' },
  { name: 'Beef', icon: Beef, label: 'لحوم / ستيك', category: 'لحوم' },
  { name: 'Bone', icon: Bone, label: 'مسحب / بعظم', category: 'لحوم' },
  { name: 'Fish', icon: Fish, label: 'بحريات / سمك', category: 'لحوم' },
  { name: 'Egg', icon: Egg, label: 'بيض / دواجن', category: 'لحوم' },

  { name: 'Carrot', icon: Carrot, label: 'خضار / بصل', category: 'خضار' },
  { name: 'Leaf', icon: Leaf, label: 'خس / ورقيات', category: 'خضار' },
  { name: 'Apple', icon: Apple, label: 'فواكه', category: 'خضار' },
  { name: 'Citrus', icon: Citrus, label: 'حمضيات', category: 'خضار' },
  { name: 'Cherry', icon: Cherry, label: 'تزيين / كرز', category: 'خضار' },
  { name: 'Grape', icon: Grape, label: 'عنب / زبيب', category: 'خضار' },

  { name: 'Sandwich', icon: Sandwich, label: 'برغر / صمون', category: 'وجبات' },
  { name: 'Pizza', icon: Pizza, label: 'بيتزا / معجنات', category: 'وجبات' },
  { name: 'Wheat', icon: Wheat, label: 'بريدنج / طحين', category: 'وجبات' },
  { name: 'Croissant', icon: Croissant, label: 'مخبوزات', category: 'وجبات' },
  { name: 'Salad', icon: Salad, label: 'مقبلات / فنكر', category: 'وجبات' },

  { name: 'Cake', icon: Cake, label: 'كيك / حلويات', category: 'مشروبات' },
  { name: 'Cookie', icon: Cookie, label: 'بسكويت', category: 'مشروبات' },
  { name: 'IceCream', icon: IceCream, label: 'مثلجات', category: 'مشروبات' },
  { name: 'CupSoda', icon: CupSoda, label: 'مشروبات غازية', category: 'مشروبات' },
  { name: 'Coffee', icon: Coffee, label: 'قهوة / شاي', category: 'مشروبات' },
  { name: 'GlassWater', icon: GlassWater, label: 'مياه معدنية', category: 'مشروبات' },
  { name: 'Milk', icon: Milk, label: 'ألبان / أجبان', category: 'مشروبات' },

  { name: 'Droplets', icon: Droplets, label: 'صوصات', category: 'إضافات' },
  { name: 'Droplet', icon: Droplet, label: 'زيت / تتبيلة', category: 'إضافات' },
  { name: 'Soup', icon: Soup, label: 'شوربة / حار', category: 'إضافات' },
  { name: 'Flame', icon: Flame, label: 'سبايسي / حار', category: 'إضافات' },
  { name: 'Snowflake', icon: Snowflake, label: 'مجمدات / ثلج', category: 'إضافات' },

  { name: 'PackageOpen', icon: PackageOpen, label: 'سفري / أكياس', category: 'تغليف' },
  { name: 'Box', icon: Box, label: 'كارتون / صناديق', category: 'تغليف' },
  { name: 'Package', icon: Package, label: 'مادة عامة', category: 'تغليف' },
  { name: 'Store', icon: Store, label: 'مواد بقالة', category: 'تغليف' },
  { name: 'CookingPot', icon: CookingPot, label: 'طبخ / قدور', category: 'تغليف' },
  { name: 'Sparkles', icon: Sparkles, label: 'مواد تنظيف', category: 'تغليف' }
];

const defaultPdfSettings = {
  paperSize: 'A3', margin: '10mm', zoom: 85, shiftX: 0, autoFit: false,
  c_seq: 4, c_cat: 12, c_name: 20, c_mType: 8, c_initial: 8, c_primary: 8, c_main: 10, c_pType: 8, c_pCap: 7, c_pUnit: 7, c_prodType: 8
};

const hexToRgba = (hex: string, alpha: number = 1) => {
  let r = 249, g = 115, b = 22; 
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

export default function ItemsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [selectedAgencyKey, setSelectedAgencyKey] = useState<string | null>(null);
  const [layoutView, setLayoutView] = useState<'grid' | 'table'>('grid');
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editItemObj, setEditItemObj] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Package');
  const [mainUnit, setMainUnit] = useState(''); 
  const [measurementType, setMeasurementType] = useState('الوزن');
  const [initialUnit, setInitialUnit] = useState('');
  const [primaryUnit, setPrimaryUnit] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [packagingCapacity, setPackagingCapacity] = useState('');
  const [packagingUnit, setPackagingUnit] = useState('');
  const [productType, setProductType] = useState('جاف');
  const [sequence, setSequence] = useState<string>('999');

  const [isSaving, setIsSaving] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [iconCategory, setIconCategory] = useState('الكل');
  const iconTabs = ['الكل', 'لحوم', 'خضار', 'وجبات', 'مشروبات', 'إضافات', 'تغليف'];

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);
  
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('itemsPagePdfSettings_v1');
    if (savedSettings) {
      try { setPdfSettings(JSON.parse(savedSettings)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isMounted) localStorage.setItem('itemsPagePdfSettings_v1', JSON.stringify(pdfSettings));
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => {
    setPdfSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetPdfSettings = () => { setPdfSettings(defaultPdfSettings); };

  const fetchData = async () => {
    if (items.length === 0) setIsLoading(true);
    setDbError(null);
    try {
      // 💡 السطر الجوهري: شلت فلتر eq('is_active', true) حتى يجلب كل المواد بما فيها المحذوفة وهمياً 💡
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select(`*, agencies(id, name, color, sequence), categories(id, name, color, sequence, icon)`);
        
      if (itemsError) throw itemsError;

      const { data: agenciesData } = await supabase.from('agencies').select('id, name, sequence, color').order('sequence', { ascending: true }).order('name');
      const { data: categoriesData } = await supabase.from('categories').select('id, name, sequence, color, icon').order('sequence', { ascending: true }).order('name');

      setItems(itemsData || []);
      setAgencies(agenciesData || []);
      setCategories(categoriesData || []);
    } catch (err: any) {
      setDbError(err?.message || "يرجى التأكد من اتصال قاعدة البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const computedGroups = useMemo(() => {
    const grouped = items.reduce((acc: any, item: any) => {
      const agencyName = item.agencies?.name || 'أخرى (بدون وكالة)';
      const agencySeq = item.agencies?.sequence ?? 999;
      const categoryName = item.categories?.name || 'أخرى (بدون قسم)';
      const categorySeq = item.categories?.sequence ?? 999;
      const categoryIcon = item.categories?.icon || 'Layers';

      if (!acc[agencyName]) {
        acc[agencyName] = { color: item.agencies?.color || '#f97316', sequence: agencySeq, categories: {} };
      }
      if (!acc[agencyName].categories[categoryName]) {
        acc[agencyName].categories[categoryName] = { 
          color: item.categories?.color || '#cbd5e1', 
          sequence: categorySeq, 
          icon: categoryIcon, 
          items: [] 
        };
      }

      acc[agencyName].categories[categoryName].items.push(item);
      return acc;
    }, {});

    return Object.keys(grouped)
      .map(agencyKey => ({ name: agencyKey, ...grouped[agencyKey] }))
      .sort((a, b) => a.sequence - b.sequence)
      .map(agencyData => {
        let totalAgencyItems = 0;
        const cats = Object.keys(agencyData.categories)
          .map(catKey => ({ name: catKey, ...agencyData.categories[catKey] }))
          .sort((a, b) => a.sequence - b.sequence)
          .map(catData => {
            const sortedItems = catData.items.sort((a: any, b: any) => {
              const seqA = a.sequence != null ? a.sequence : 999;
              const seqB = b.sequence != null ? b.sequence : 999;
              return seqA - seqB; 
            });
            totalAgencyItems += sortedItems.length;
            return { ...catData, items: sortedItems };
          });
        return { ...agencyData, categories: cats, totalItems: totalAgencyItems };
      });
  }, [items]);

  useEffect(() => {
    if (computedGroups.length > 0 && !selectedAgencyKey) {
      setSelectedAgencyKey(computedGroups[0].name);
    }
  }, [computedGroups, selectedAgencyKey]);

  const activeAgency = useMemo(() => {
    return computedGroups.find(g => g.name === selectedAgencyKey) || computedGroups[0];
  }, [computedGroups, selectedAgencyKey]);

  const autoDistributeIcons = async () => {
    if (!window.confirm("🪄 السحر: هل تريد أن يقوم النظام بتوزيع الأيقونات تلقائياً على كل المواد المخزونة بناءً على أسمائها؟")) return;
    setIsAutoAssigning(true);
    try {
      let updateCount = 0;
      for (const item of items) {
         let newIcon = null;
         const n = item.name.toLowerCase();
         
         if (n.includes('دجاج') || n.includes('صدر') || n.includes('فخذ') || n.includes('مسحب') || n.includes('دياي')) newIcon = 'Bird';
         else if (n.includes('كنتاكي') || n.includes('مقلي') || n.includes('ستربس')) newIcon = 'Drumstick';
         else if (n.includes('صوص') || n.includes('مايونيز') || n.includes('ثومية') || n.includes('كتشب') || n.includes('خردل')) newIcon = 'Droplets';
         else if (n.includes('زيت') || n.includes('تتبيلة') || n.includes('خل')) newIcon = 'Droplet';
         else if (n.includes('لحم') || n.includes('كباب') || n.includes('ستيك') || n.includes('مفروم')) newIcon = 'Beef';
         else if (n.includes('سمك') || n.includes('روبيان')) newIcon = 'Fish';
         else if (n.includes('طحين') || n.includes('بريدنج') || n.includes('بقسماط')) newIcon = 'Wheat';
         else if (n.includes('جبن') || n.includes('حليب') || n.includes('قشطة') || n.includes('موزاريلا')) newIcon = 'Milk';
         else if (n.includes('بطاطا') || n.includes('فنكر') || n.includes('بصل') || n.includes('طماط')) newIcon = 'Carrot';
         else if (n.includes('خس') || n.includes('لهانة') || n.includes('ورق')) newIcon = 'Leaf';
         else if (n.includes('خبز') || n.includes('صمون') || n.includes('توست') || n.includes('بركر') || n.includes('برغر') || n.includes('ساندويش')) newIcon = 'Sandwich';
         else if (n.includes('علب') || n.includes('كارتون') || n.includes('كيس') || n.includes('نايلون') || n.includes('سفري') || n.includes('تغليف')) newIcon = 'PackageOpen';
         else if (n.includes('عصير') || n.includes('بيبسي') || n.includes('سفن') || n.includes('كولا') || n.includes('مشروب')) newIcon = 'CupSoda';
         else if (n.includes('مي ') || n.includes('ماء')) newIcon = 'GlassWater';
         else if (n.includes('ملح') || n.includes('بهار') || n.includes('فلفل') || n.includes('حار') || n.includes('سبايسي')) newIcon = 'Flame';
         else if (n.includes('مجمد') || n.includes('ثلج')) newIcon = 'Snowflake';
         else if (n.includes('منظف') || n.includes('قاصر') || n.includes('زاهي') || n.includes('صابون') || n.includes('ديتول')) newIcon = 'Sparkles';
         else if (n.includes('بيتزا') || n.includes('عجين')) newIcon = 'Pizza';
         else if (n.includes('مقبلات') || n.includes('سلطة') || n.includes('حمص')) newIcon = 'Salad';
         else if (n.includes('شوربة') || n.includes('حساء')) newIcon = 'Soup';
         else if (n.includes('كيك') || n.includes('حلو')) newIcon = 'Cake';
         else if (n.includes('تفاح') || n.includes('فواكه') || n.includes('برتقال')) newIcon = 'Apple';

         if (newIcon && item.icon !== newIcon) {
           await supabase.from('items').update({ icon: newIcon }).eq('id', item.id);
           updateCount++;
         }
      }
      alert(`✅ السحر اكتمل: تم التعرف على (${updateCount}) مادة وتوزيع الأيقونات عليها بنجاح!`);
      fetchData();
    } catch (err) {
      alert("حدث خطأ أثناء التوزيع التلقائي.");
    } finally {
      setIsAutoAssigning(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false); setEditItemObj(null); 
    setName(''); setAgencyId(''); setCategoryId(''); 
    setSelectedIcon('Package'); 
    setIconCategory('الكل'); 
    setMeasurementType('الوزن'); setInitialUnit(''); setPrimaryUnit(''); 
    setMainUnit(''); 
    setPackagingType(''); setPackagingCapacity(''); setPackagingUnit('');
    setProductType('جاف');
    setSequence('999'); 
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setIsEditing(true); setEditItemObj(item); 
    setName(item.name || ''); 
    setAgencyId(item.agency_id || ''); 
    setCategoryId(item.category_id || ''); 
    setSelectedIcon(item.icon || 'Package');
    setIconCategory('الكل'); 
    setMeasurementType(item.measurement_type || item.unit_type || 'الوزن'); 
    setInitialUnit(item.initial_unit || ''); 
    setPrimaryUnit(item.primary_unit || ''); 
    setMainUnit(item.main_unit || ''); 
    setPackagingType(item.packaging_type || ''); 
    setPackagingCapacity(item.packaging_capacity || '');
    setPackagingUnit(item.packaging_unit || '');
    setProductType(item.product_type || item.storage_type || 'جاف');
    setSequence(item.sequence?.toString() || '999');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false); setEditItemObj(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const payload = { 
        name, 
        agency_id: agencyId || null, 
        category_id: categoryId || null,
        icon: selectedIcon, 
        measurement_type: measurementType, 
        initial_unit: initialUnit, 
        primary_unit: primaryUnit,
        main_unit: mainUnit,
        packaging_type: packagingType, 
        packaging_capacity: packagingCapacity === "" ? null : Number(packagingCapacity),
        packaging_unit: packagingUnit,
        product_type: productType,
        unit_type: measurementType, 
        storage_type: productType, 
        sequence: sequence === "" ? 999 : Number(sequence),
        is_active: true // 💡 لضمان إن المادة الجديدة أو المعدلة تكون فعالة دائماً
      };

      if (isEditing && editItemObj) {
        const { error } = await supabase.from('items').update(payload).eq('id', editItemObj.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('items').insert([payload]);
        if (error) throw error;
      }
      closeModal();
      fetchData(); 
    } catch (error: any) {
      alert("حدث خطأ أثناء الحفظ: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 💡 الحذف الجذري والنهائي 💡
  const handleDelete = async (id: string, itemName: string) => {
    if (!window.confirm(`⚠️ تحذير ⚠️\n\nهل أنت متأكد من الحذف الجذري للصنف (${itemName}) نهائياً من قاعدة البيانات؟\n\nتنبيه: لا يمكن التراجع عن هذا الإجراء!`)) return;
    
    try {
      // استخدام أمر .delete() لمسح السطر من جذوره
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) throw error;
      
      fetchData(); // تحديث الشاشة
    } catch (error: any) {
      alert("❌ لا يمكن حذف الصنف جذرياً لأنه مستخدم ومسجل في طلبيات أو فواتير سابقة. (قاعدة البيانات تمنع الحذف لحماية السجلات المالية).");
    }
  };

  // 💡 استرجاع الصنف (إذا جانت المادة ممسوحة وهمي ويريد يرجعها للعمل بدل ما يحذفها جذري)
  const handleRestore = async (id: string, itemName: string) => {
    if (!window.confirm(`هل تريد استرجاع الصنف (${itemName}) وتفعيله مرة أخرى؟`)) return;
    try {
      const { error } = await supabase.from('items').update({ is_active: true }).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert("حدث خطأ أثناء الاسترجاع.");
    }
  };

  const getStorageColor = (type: string) => {
    if (type === 'مبرد') return 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20';
    if (type === 'جامد') return 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20';
    if (type === 'مصنعات') return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20';
    return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
  };

  const handleExportExcel = async () => {
    if (computedGroups.length === 0) return alert("لا توجد بيانات لتصديرها.");
    setIsExportingExcel(true);
    
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Enterprise B2B System';
      const worksheet = workbook.addWorksheet('دليل المواد', { views: [{ rightToLeft: true }] });

      const headers = ['التسلسل', 'الوكالة', 'القسم', 'اسم الصنف', 'القياس', 'القيمة الأولية', 'الوحدة الرئيسية', 'وحدة الحساب (المعتمدة)', 'الغلاف الخارجي', 'السعة', 'وحدة الداخل', 'حالة الخزن'];
      
      worksheet.mergeCells('A1:L1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `دليل الأصناف والمواد الشامل - المطبخ المركزي (${dayjs().format('YYYY-MM-DD')})`;
      titleCell.font = { name: 'Cairo', size: 16, bold: true, color: { argb: 'FF0F172A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;
      worksheet.addRow([]); 

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF97316' } }; 
        cell.font = { name: 'Arial', color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      let rowIndex = 4;
      computedGroups.forEach(agency => {
        agency.categories.forEach((cat: any) => {
          cat.items.forEach((item: any) => {
            const rowData = [
              item.sequence === 999 ? '-' : item.sequence,
              agency.name,
              cat.name,
              item.name,
              item.measurement_type || item.unit_type || '-',
              item.initial_unit || '-',
              item.primary_unit || '-',
              item.main_unit || '-',
              item.packaging_type || '-',
              item.packaging_capacity || '-',
              item.packaging_unit || '-',
              item.product_type || item.storage_type || '-'
            ];

            const dataRow = worksheet.addRow(rowData);
            const isEven = rowIndex % 2 === 0;
            const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

            dataRow.eachCell((cell, colNum) => {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              cell.border = { top: { style: 'thin', color: {argb: 'FFCBD5E1'} }, left: { style: 'thin', color: {argb: 'FFCBD5E1'} }, bottom: { style: 'thin', color: {argb: 'FFCBD5E1'} }, right: { style: 'thin', color: {argb: 'FFCBD5E1'} } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
              if (colNum === 4) cell.font = { bold: true };
              if (colNum === 8) cell.font = { bold: true, color: { argb: 'FF059669' } }; 
            });
            rowIndex++;
          });
        });
      });

      worksheet.columns.forEach((col, i) => {
        if (i === 0) col.width = 8;  
        else if (i === 1) col.width = 20; 
        else if (i === 2) col.width = 20; 
        else if (i === 3) col.width = 30; 
        else if (i === 4) col.width = 12; 
        else if (i === 5) col.width = 15; 
        else if (i === 6) col.width = 15; 
        else if (i === 7) col.width = 25; 
        else if (i === 8) col.width = 15; 
        else if (i === 9) col.width = 10; 
        else if (i === 10) col.width = 15; 
        else if (i === 11) col.width = 15; 
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `دليل_المواد_${new Date().toISOString().split('T')[0]}.xlsx`);

    } catch (e) {
      alert("حدث خطأ أثناء تصدير ملف Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPDF = () => {
    if (computedGroups.length === 0) return alert("لا توجد بيانات لطباعتها.");

    const printWindow = window.open('', '', 'width=1200,height=800');
    if (!printWindow) return alert("يرجى السماح بالنوافذ المنبثقة (Pop-ups) بالمتصفح للطباعة.");

    const getColStyle = (widthPercent: number) => {
      return pdfSettings.autoFit ? `padding: 8px 4px;` : `width: ${widthPercent}%; padding: 8px 4px;`;
    };

    let htmlContent = `
      <html dir="rtl" lang="ar">
        <head>
          <title>دليل المواد - ${dayjs().format('YYYY-MM-DD')}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            
            @page { size: ${pdfSettings.paperSize} landscape; margin: ${pdfSettings.margin}; }
            
            body { font-family: 'Cairo', sans-serif; padding: 0; margin: 0; color: #1e293b; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f97316; padding-bottom: 15px; margin-bottom: 20px; }
            .header-info h1 { margin: 0; color: #f97316; font-size: 26px; font-weight: 900; }
            .header-info p { margin: 5px 0 0 0; color: #64748b; font-size: 13px; font-weight: 700; }
            
            .agency-section { margin-bottom: 30px; }
            .agency-title { background: #1e293b; color: white; padding: 8px 15px; border-radius: 6px; font-size: 16px; font-weight: 900; margin-bottom: 10px; }
            
            table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'}; }
            th, td { text-align: right; border: 1px solid #e2e8f0; word-break: break-word; overflow-wrap: break-word; }
            th { background-color: #f1f5f9; color: #334155; font-weight: 900; font-size: 11px; text-align: center; }
            
            tr:hover { background-color: #f8fafc; }
            .seq-badge { background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-weight: 900; color: #64748b; }
            
            .print-footer { display: flex !important; position: fixed !important; bottom: 0; left: 0; right: 0; background: white; padding-top: 6px; border-top: 2px solid #e2e8f0; z-index: 1000; justify-content: space-between; font-size: 12px; font-weight: 900; color: #64748b; }
            .print-container { padding-bottom: 40px; zoom: ${pdfSettings.zoom / 100}; margin-right: ${pdfSettings.shiftX}mm; }
            
            tr, td, th { page-break-inside: avoid !important; }
            thead { display: table-header-group !important; }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="header">
              <div class="header-info">
                <h1>دليل الأصناف والمواد الشامل</h1>
                <p>تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>
    `;

    computedGroups.forEach(agency => {
      htmlContent += `
        <div class="agency-section">
          <div class="agency-title">الوكالة: ${agency.name} <span style="font-size: 11px; font-weight: normal; margin-right: 10px;">(${agency.totalItems} مادة)</span></div>
          <table>
            <thead>
              <tr>
                <th style="${getColStyle(pdfSettings.c_seq)}">ت</th>
                <th style="${getColStyle(pdfSettings.c_cat)} text-align: right;">القسم</th>
                <th style="${getColStyle(pdfSettings.c_name)} text-align: right;">اسم الصنف</th>
                <th style="${getColStyle(pdfSettings.c_mType)}">القياس</th>
                <th style="${getColStyle(pdfSettings.c_initial)}">الأولية</th>
                <th style="${getColStyle(pdfSettings.c_primary)}">الرئيسية</th>
                <th style="${getColStyle(pdfSettings.c_main)} color: #059669;">وحدة الحساب</th>
                <th style="${getColStyle(pdfSettings.c_pType)} color: #f97316;">التغليف</th>
                <th style="${getColStyle(pdfSettings.c_pCap)} color: #f97316;">سعة الغلاف</th>
                <th style="${getColStyle(pdfSettings.c_pUnit)} color: #f97316;">وحدة الداخل</th>
                <th style="${getColStyle(pdfSettings.c_prodType)}">الحالة</th>
              </tr>
            </thead>
            <tbody>
      `;

      agency.categories.forEach((cat: any) => {
        cat.items.forEach((item: any) => {
          htmlContent += `
            <tr>
              <td style="text-align: center;"><span class="seq-badge">${item.sequence === 999 ? '-' : item.sequence}</span></td>
              <td style="font-weight: 700; color: #475569;">${cat.name}</td>
              <td style="font-weight: 900; color: #0f172a;">${item.name}</td>
              <td style="text-align: center;">${item.measurement_type || item.unit_type || '-'}</td>
              <td style="text-align: center;" dir="ltr"><b>${item.initial_unit || '-'}</b></td>
              <td style="text-align: center; font-weight: 700; color: #475569; background: #f8fafc;">${item.primary_unit || '-'}</td>
              <td style="text-align: center; font-weight: 900; color: #059669; background: #ecfdf5;">${item.main_unit || '-'}</td>
              <td style="text-align: center; color: #f97316; font-weight: 700;">${item.packaging_type || '-'}</td>
              <td style="text-align: center; color: #f97316; font-weight: bold;" dir="ltr">${item.packaging_capacity || '-'}</td>
              <td style="text-align: center; color: #f97316;">${item.packaging_unit || '-'}</td>
              <td style="text-align: center;">${item.product_type || item.storage_type || '-'}</td>
            </tr>
          `;
        });
      });

      htmlContent += `</tbody></table></div>`;
    });

    htmlContent += `
          </div>
          <div class="print-footer">
            <div>طُبع بواسطة: <span style="color: #0f172a; margin-right: 5px;">نظام إدارة المطابخ</span></div>
            <div dir="ltr">تاريخ الطباعة: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</div>
          </div>
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const totalCalculatedWidth = pdfSettings.c_seq + pdfSettings.c_cat + pdfSettings.c_name + pdfSettings.c_mType + pdfSettings.c_initial + pdfSettings.c_primary + pdfSettings.c_main + pdfSettings.c_pType + pdfSettings.c_pCap + pdfSettings.c_pUnit + pdfSettings.c_prodType;
  const filteredIcons = iconCategory === 'الكل' ? itemIconList : itemIconList.filter(ic => ic.category === iconCategory);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white font-sans relative overflow-x-hidden pb-40" dir="rtl">
        
        {/* خلفية بوهج برتقالي خفيف */}
        <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] transition-colors duration-500 from-orange-200/50 via-slate-50 to-slate-50 dark:from-orange-900/15 dark:via-[#050505] dark:to-[#050505] -z-10 pointer-events-none"></div>

        <div className="p-4 md:p-8 max-w-[100rem] mx-auto w-full relative z-10">
          
          {/* الترويسة العليا */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 mb-8 bg-white/80 dark:bg-white/5 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-4 text-right flex-1 w-full xl:w-auto">
              <Link href="/hub" className="bg-slate-100 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none cursor-pointer active:scale-95">
                <Building2 className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>
              <div className="bg-gradient-to-br from-orange-400/20 dark:from-orange-500/20 to-amber-600/30 dark:to-amber-900/40 border border-orange-400/30 dark:border-orange-500/30 w-14 h-14 rounded-[1.3rem] text-orange-500 dark:text-orange-400 shadow-inner flex items-center justify-center shrink-0">
                 <Package className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight mb-1 truncate">دليل الأصناف والمواد</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 truncate">إدارة المواد والتعليب مقسمة حسب الوكالات والأقسام وتحديد أيقوناتها.</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-3 w-full xl:w-auto">
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                
                {/* زر التبديل بين الوضع الليلي والنهاري مرتبط بالثيم الرئيسي */}
                <button onClick={toggleTheme} className="p-3.5 rounded-2xl flex items-center justify-center transition-all border outline-none cursor-pointer active:scale-95 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm" title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}>
                  {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
                </button>

                <button 
                  onClick={() => setShowPdfSettings(!showPdfSettings)} 
                  title="إعدادات القياس للـ PDF"
                  className={`p-3.5 rounded-2xl flex items-center justify-center transition-all border outline-none cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/30 shadow-inner' : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <Settings className={`w-5 h-5 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} />
                </button>

                <button onClick={handleExportPDF} className="px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/20 font-black transition-all flex-1 md:flex-none outline-none cursor-pointer active:scale-95">
                  <Printer className="w-5 h-5" /> <span className="hidden sm:inline">PDF</span>
                </button>
                
                <button onClick={handleExportExcel} disabled={isExportingExcel} className="px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20 font-black transition-all flex-1 md:flex-none outline-none cursor-pointer active:scale-95 disabled:opacity-50">
                  {isExportingExcel ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />} <span className="hidden sm:inline">Excel</span>
                </button>

                <button onClick={autoDistributeIcons} disabled={isAutoAssigning || items.length === 0} className="px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 border border-purple-200 dark:border-purple-500/20 font-black transition-all flex-1 md:flex-none outline-none cursor-pointer active:scale-95 disabled:opacity-50" title="توزيع الأيقونات بذكاء على المواد الموجودة">
                  {isAutoAssigning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} 
                  <span className="hidden xl:inline">توزيع ذكي</span>
                </button>

                <div className="w-px h-8 bg-slate-200 dark:bg-white/10 hidden md:block mx-1"></div>
                <div className="bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-1.5 rounded-[1.2rem] shadow-inner flex gap-1 shrink-0 h-[52px] items-center">
                  <button onClick={() => setLayoutView('grid')} className={`p-2.5 rounded-xl transition-all outline-none cursor-pointer active:scale-95 ${layoutView === 'grid' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 shadow-sm border border-orange-200 dark:border-orange-500/30' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-white/5'}`} title="عرض الشبكة"><LayoutGrid className="w-5 h-5" /></button>
                  <button onClick={() => setLayoutView('table')} className={`p-2.5 rounded-xl transition-all outline-none cursor-pointer active:scale-95 ${layoutView === 'table' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 shadow-sm border border-orange-200 dark:border-orange-500/30' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-white/5'}`} title="عرض اللستة"><LayoutList className="w-5 h-5" /></button>
                </div>

                <button onClick={openAddModal} className="px-6 py-3.5 rounded-2xl flex items-center justify-center gap-3 text-white bg-orange-600 border border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] font-black transition-all w-full md:w-auto mt-2 xl:mt-0 outline-none cursor-pointer active:scale-95 hover:scale-105">
                  <Plus className="w-5 h-5" />
                  <span>إضافة صنف جديد</span>
                </button>
              </div>

              {showPdfSettings && (
                <div className="bg-white dark:bg-[#121214] p-5 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative mt-2">
                  
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                    <span className="text-sm font-black text-orange-500 dark:text-orange-400 flex items-center gap-2"><Settings className="w-4 h-4"/> إعدادات الطباعة المتقدمة (تُحفظ تلقائياً)</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 flex items-center gap-1 transition-colors bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 outline-none cursor-pointer">
                      <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">حجم الورق</label>
                      <div className="relative">
                        <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 cursor-pointer appearance-none">
                          <option value="A3">A3 (أفضل للأعمدة الكثيرة)</option>
                          <option value="A4">A4 (ورق قياسي)</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute left-4 top-[14px] pointer-events-none" />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">هوامش الورقة</label>
                      <div className="relative">
                        <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="w-full bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 cursor-pointer appearance-none">
                          <option value="0mm">بدون هوامش (0mm)</option>
                          <option value="2mm">ضيقة جداً (2mm)</option>
                          <option value="5mm">ضيقة (5mm)</option>
                          <option value="10mm">عادية (10mm)</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute left-4 top-[14px] pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 ${pdfSettings.autoFit ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'}`}>
                        <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                        <span className="bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-500/20" dir="ltr">{pdfSettings.shiftX} mm</span>
                      </div>
                      <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-orange-500 h-2 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer mt-1" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <hr className="flex-1 border-slate-200 dark:border-white/5" />
                    <span className="text-[10px] font-black text-orange-600 dark:text-orange-500 uppercase tracking-widest bg-orange-100 dark:bg-orange-500/10 px-3 py-1 rounded-full border border-orange-200 dark:border-orange-500/20">إعدادات الأعمدة (تعمل مع الاحتواء اليدوي)</span>
                    <hr className="flex-1 border-slate-200 dark:border-white/5" />
                  </div>

                  <div className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-4 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    
                    <div className="flex flex-col gap-2 w-full col-span-2 sm:col-span-4 lg:col-span-6 mb-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                        <span className="bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-500/20">{pdfSettings.zoom}%</span>
                      </div>
                      <input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-orange-500 h-2 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">التسلسل</label><span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-black">{pdfSettings.c_seq}%</span></div><input type="range" min="1" max="10" value={pdfSettings.c_seq} onChange={e => updatePdfSetting('c_seq', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">القسم</label><span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-black">{pdfSettings.c_cat}%</span></div><input type="range" min="3" max="25" value={pdfSettings.c_cat} onChange={e => updatePdfSetting('c_cat', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">اسم الصنف</label><span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-black">{pdfSettings.c_name}%</span></div><input type="range" min="10" max="40" value={pdfSettings.c_name} onChange={e => updatePdfSetting('c_name', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">القياس</label><span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-black">{pdfSettings.c_mType}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_mType} onChange={e => updatePdfSetting('c_mType', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">الأولية</label><span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-black">{pdfSettings.c_initial}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_initial} onChange={e => updatePdfSetting('c_initial', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">الرئيسية</label><span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-black">{pdfSettings.c_primary}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_primary} onChange={e => updatePdfSetting('c_primary', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">وحدة الحساب</label><span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-black">{pdfSettings.c_main}%</span></div><input type="range" min="3" max="20" value={pdfSettings.c_main} onChange={e => updatePdfSetting('c_main', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">التغليف</label><span className="text-indigo-600 dark:text-indigo-400 text-[9px] font-black">{pdfSettings.c_pType}%</span></div><input type="range" min="3" max="20" value={pdfSettings.c_pType} onChange={e => updatePdfSetting('c_pType', Number(e.target.value))} className="w-full accent-indigo-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">سعة الغلاف</label><span className="text-indigo-600 dark:text-indigo-400 text-[9px] font-black">{pdfSettings.c_pCap}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_pCap} onChange={e => updatePdfSetting('c_pCap', Number(e.target.value))} className="w-full accent-indigo-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">وحدة الداخل</label><span className="text-indigo-600 dark:text-indigo-400 text-[9px] font-black">{pdfSettings.c_pUnit}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_pUnit} onChange={e => updatePdfSetting('c_pUnit', Number(e.target.value))} className="w-full accent-indigo-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">حالة المنتج</label><span className="text-slate-500 dark:text-slate-400 text-[9px] font-black">{pdfSettings.c_prodType}%</span></div><input type="range" min="3" max="15" value={pdfSettings.c_prodType} onChange={e => updatePdfSetting('c_prodType', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-500 h-1.5 bg-slate-200 dark:bg-[#0a0a0c] border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                  </div>

                  {!pdfSettings.autoFit && (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                      <span>مجموع النسب المئوية للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{totalCalculatedWidth}%</span></span>
                      {totalCalculatedWidth > 100 ? (
                        <span className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيقوم بضغط الجدول إجبارياً)</span>
                      ) : (
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول منسق 100%)</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {dbError && (
            <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-md w-full">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-500" />
              <p className="text-lg">{dbError}</p>
            </div>
          )}

          {!dbError && isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
              <p className="text-slate-500 font-black tracking-widest text-sm uppercase">جاري تحميل المواد...</p>
            </div>
          ) : !dbError && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-500 bg-white dark:bg-[#121214] rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-white/10 text-center shadow-sm dark:shadow-inner">
              <Package className="w-20 h-20 opacity-30 text-orange-500 mb-4" />
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">دليل المواد فارغ</h3>
              <p className="font-bold text-sm">ابدأ بإضافة أول مادة ليتم عرضها هنا.</p>
            </div>
          ) : !dbError && computedGroups.length > 0 && activeAgency && (
            
            <div className="space-y-6 relative z-10">
              
              {/* تبويبات الوكالات */}
              <div className="bg-white dark:bg-[#121214] p-3 rounded-[2rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                  {computedGroups.map((agency) => {
                    const isActive = selectedAgencyKey === agency.name;
                    const aColor = agency.color || '#f97316';
                    return (
                      <button
                        key={agency.name}
                        onClick={() => setSelectedAgencyKey(agency.name)}
                        className={`flex items-center gap-3 px-6 py-3.5 rounded-[1.5rem] font-black shrink-0 transition-all whitespace-nowrap outline-none border cursor-pointer active:scale-95 ${
                          isActive 
                            ? 'border-transparent text-white dark:text-[#050505]' 
                            : 'bg-slate-50 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                        }`}
                        style={isActive ? { 
                          backgroundColor: aColor, 
                          boxShadow: `0 0 20px ${hexToRgba(aColor, 0.4)}`,
                          transform: 'scale(1.02)'
                        } : {}}
                      >
                        <Building2 className="w-5 h-5" />
                        <span>{agency.name}</span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] shadow-inner ${isActive ? 'bg-black/20 text-white dark:text-[#050505]' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'}`}>
                          {agency.totalItems} مادة
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* محتوى الوكالة والأقسام */}
              <div 
                className="bg-white dark:bg-[#121214] rounded-[2.5rem] p-4 md:p-8 shadow-lg dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-all border border-slate-200 dark:border-white/10 border-t-[6px]" 
                style={{ borderTopColor: activeAgency.color || '#f97316' }}
              >
                <div className="space-y-10">
                  {activeAgency.categories.map((category: any) => (
                    <div key={category.name} className="space-y-4">
                      
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3 pl-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-[#0a0a0c] shadow-inner border border-slate-200 dark:border-white/5" style={{ backgroundColor: isDark ? hexToRgba(category.color || '#64748b', 0.1) : hexToRgba(category.color || '#64748b', 0.05) }}>
                            {(() => {
                              const CatIcon = allIconsMap[category.icon] || Layers;
                              return <CatIcon className="w-5 h-5" style={{ color: category.color || '#94a3b8' }} />;
                            })()}
                          </div>
                          <h3 className="text-xl font-black text-slate-900 dark:text-white">{category.name}</h3>
                        </div>
                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-xl shadow-inner">
                          {category.items.length} صنف
                        </span>
                      </div>

                      <div className="flex flex-col gap-3">
                        {layoutView === 'grid' ? (
                          /* عرض الشبكة (Cards) */
                          category.items.map((item: any) => {
                            const ItemIcon = allIconsMap[item.icon] || Package;

                            return (
                              <div 
                                key={item.id} 
                                className={`rounded-2xl p-4 shadow-sm border transition-all flex flex-col xl:flex-row xl:items-center gap-4 relative overflow-hidden group ${item.is_active === false ? 'border-rose-400 dark:border-rose-500/50 bg-rose-50/50 dark:bg-rose-500/5' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5 hover:border-orange-400 dark:hover:border-white/20'}`}
                              >
                                {/* 💡 باج التحذير للمواد الممسوحة وهمياً */}
                                {item.is_active === false && (
                                  <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] px-2.5 py-1 rounded-lg font-black shadow-md z-20 flex items-center gap-1.5 animate-pulse">
                                    <AlertTriangle className="w-3 h-3" /> ممسوح وهمي
                                  </div>
                                )}

                                <div className="absolute right-0 top-0 bottom-0 w-1.5 transition-colors duration-300 group-hover:w-2" style={{ backgroundColor: category.color || '#475569' }}></div>
                                <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[40px] opacity-10 pointer-events-none transition-colors duration-300" style={{ backgroundColor: category.color || '#475569' }}></div>
                                
                                <div className="flex items-center gap-4 xl:w-3/12 shrink-0 pr-2 relative z-10">
                                  <div className="w-12 h-12 rounded-[1rem] bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-orange-500 dark:text-orange-400 font-black shrink-0 shadow-inner relative group-hover:scale-105 transition-transform">
                                    <ItemIcon className="w-6 h-6" />
                                    <div className="absolute -top-2 -right-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black shadow-sm dark:shadow-md en-num">
                                      {item.sequence === 999 ? '-' : item.sequence}
                                    </div>
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <h4 className="font-black text-lg text-slate-900 dark:text-white truncate group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors">
                                      {item.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border shadow-inner ${getStorageColor(item.product_type || item.storage_type)}`}>
                                        {item.product_type || item.storage_type}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 xl:border-r border-t xl:border-t-0 border-slate-200 dark:border-white/10 xl:pr-4 pt-3 xl:pt-0 relative z-10">
                                  <div className="bg-white dark:bg-white/5 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center gap-3 shadow-sm dark:shadow-inner">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100 dark:border-blue-500/20 shrink-0"><Scale className="w-4 h-4 text-blue-500 dark:text-blue-400"/></div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">القياس ({item.measurement_type || item.unit_type || '-'})</span>
                                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                        {item.initial_unit || '-'} {item.primary_unit ? ` ${item.primary_unit}` : ''}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-3 shadow-sm dark:shadow-inner">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg border border-emerald-200 dark:border-emerald-500/30 shrink-0">
                                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500">وحدة الحساب</span>
                                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 truncate">
                                        {item.main_unit || 'لم تحدد'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-500/20 flex items-center gap-3 shadow-sm dark:shadow-inner">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg border border-indigo-200 dark:border-indigo-500/30 shrink-0"><PackageOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400"/></div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">التغليف ({item.packaging_type || 'بدون'})</span>
                                      <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 truncate">
                                        {item.packaging_capacity && item.packaging_unit ? <span dir="ltr">{item.packaging_capacity} {item.packaging_unit}</span> : '-'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between xl:justify-end gap-4 xl:w-2/12 shrink-0 border-t xl:border-t-0 xl:border-r border-slate-200 dark:border-white/10 pt-3 xl:pt-0 xl:pr-4 relative z-10">
                                  <div className="flex gap-2 shrink-0 w-full xl:w-auto justify-end">
                                    {item.is_active === false ? (
                                      <>
                                        <button onClick={() => handleRestore(item.id, item.name)} className="px-3 py-2.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors shadow-inner border border-emerald-200 dark:border-emerald-500/20 outline-none cursor-pointer active:scale-95 font-black text-xs flex items-center gap-1.5" title="استرجاع المادة"><RefreshCw className="w-4 h-4" /> استرجاع</button>
                                        <button onClick={() => handleDelete(item.id, item.name)} className="px-3 py-2.5 text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors shadow-md border border-rose-700 outline-none cursor-pointer active:scale-95 font-black text-xs flex items-center gap-1.5" title="حذف جذري نهائي من النظام"><Trash2 className="w-4 h-4" /> حذف نهائي</button>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={() => openEditModal(item)} className="p-2.5 text-slate-600 dark:text-white bg-slate-100 dark:bg-white/5 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-colors shadow-inner border border-slate-200 dark:border-white/10 outline-none cursor-pointer active:scale-95" title="تعديل"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(item.id, item.name)} className="p-2.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors shadow-inner border border-rose-200 dark:border-rose-500/20 outline-none cursor-pointer active:scale-95" title="حذف جذري"><Trash2 className="w-4 h-4" /></button>
                                      </>
                                    )}
                                  </div>
                                </div>

                              </div>
                            )
                          })
                        ) : (
                          /* عرض اللستة (Table) */
                          <div className="overflow-x-auto w-full custom-scrollbar pb-2">
                            <table className="w-full text-right border-separate" style={{ borderSpacing: '0 8px' }}>
                              <thead className="sticky top-0 z-20">
                                <tr className="text-slate-600 dark:text-slate-400 text-[11px] font-black uppercase tracking-widest bg-slate-100 dark:bg-[#0a0a0c]">
                                  <th className="px-4 py-3 text-center rounded-r-xl border-y border-r border-slate-200 dark:border-white/5">ت</th>
                                  <th className="px-4 py-3 border-y border-slate-200 dark:border-white/5">اسم الصنف</th>
                                  <th className="px-4 py-3 text-center border-y border-slate-200 dark:border-white/5">حالة الخزن</th>
                                  <th className="px-4 py-3 text-center border-y border-slate-200 dark:border-white/5">القياس</th>
                                  <th className="px-4 py-3 text-center border-y border-slate-200 dark:border-white/5">الوحدة الرئيسية</th>
                                  <th className="px-4 py-3 text-center border-y border-slate-200 dark:border-white/5 text-emerald-600 dark:text-emerald-500">وحدة الحساب</th>
                                  <th className="px-4 py-3 text-center border-y border-slate-200 dark:border-white/5 text-indigo-600 dark:text-indigo-400">التغليف (السعة)</th>
                                  <th className="px-4 py-3 text-center rounded-l-xl border-y border-l border-slate-200 dark:border-white/5">إجراءات</th>
                                </tr>
                              </thead>
                              <tbody className="text-[13px]">
                                {category.items.map((item: any) => {
                                  const ItemIcon = allIconsMap[item.icon] || Package;

                                  return (
                                    <tr key={item.id} className={`${item.is_active === false ? 'bg-rose-50/50 dark:bg-rose-500/5' : 'bg-white dark:bg-[#0a0a0c]'} shadow-sm dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 transition-all duration-300 group`}>
                                      <td className="py-3 px-4 text-center rounded-r-[1rem] border-y border-r border-slate-200 dark:border-white/5 text-slate-500 font-black text-[12px] en-num">{item.sequence === 999 ? '-' : item.sequence}</td>
                                      
                                      <td className="py-3 px-4 border-y border-slate-200 dark:border-white/5">
                                        <div className="flex items-center gap-3">
                                          <div className="p-1.5 bg-slate-50 dark:bg-[#121214] rounded-lg border border-slate-200 dark:border-white/5 shadow-inner shrink-0 group-hover:bg-orange-50 dark:group-hover:bg-orange-500/10 transition-colors">
                                            <ItemIcon className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="font-black text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate max-w-[200px]">{item.name}</span>
                                            {item.is_active === false && <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm w-fit mt-1 font-bold">ممسوح وهمي</span>}
                                          </div>
                                        </div>
                                      </td>

                                      <td className="py-3 px-4 text-center border-y border-slate-200 dark:border-white/5"><span className={`px-2 py-1 rounded-md text-[10px] font-black border shadow-inner inline-block ${getStorageColor(item.product_type || item.storage_type)}`}>{item.product_type || item.storage_type}</span></td>
                                      <td className="py-3 px-4 text-center border-y border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300 font-bold text-xs">{item.measurement_type || item.unit_type || '-'}</td>
                                      <td className="py-3 px-4 text-center border-y border-slate-200 dark:border-white/5 font-black text-slate-700 dark:text-slate-300 en-num" dir="ltr">{item.initial_unit || '-'} {item.primary_unit}</td>
                                      <td className="py-3 px-4 text-center border-y border-slate-200 dark:border-white/5 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 shadow-inner">{item.main_unit || '-'}</td>
                                      <td className="py-3 px-4 text-center border-y border-slate-200 dark:border-white/5 font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/5">{item.packaging_type ? `${item.packaging_type} (${item.packaging_capacity} ${item.packaging_unit})` : '-'}</td>
                                      <td className="py-3 px-4 text-center rounded-l-[1rem] border-y border-l border-slate-200 dark:border-white/5">
                                        <div className="flex items-center justify-center gap-2">
                                          {item.is_active === false ? (
                                            <>
                                              <button onClick={() => handleRestore(item.id, item.name)} className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors shadow-inner border border-emerald-200 dark:border-emerald-500/20 outline-none cursor-pointer active:scale-95" title="استرجاع"><RefreshCw className="w-3.5 h-3.5" /></button>
                                              <button onClick={() => handleDelete(item.id, item.name)} className="p-2 text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors shadow-md border border-rose-700 outline-none cursor-pointer active:scale-95" title="حذف جذري نهائي"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </>
                                          ) : (
                                            <>
                                              <button onClick={() => openEditModal(item)} className="p-2 text-slate-600 dark:text-white bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors shadow-inner border border-slate-200 dark:border-white/10 outline-none cursor-pointer active:scale-95" title="تعديل"><Edit2 className="w-3.5 h-3.5" /></button>
                                              <button onClick={() => handleDelete(item.id, item.name)} className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors shadow-inner border border-rose-200 dark:border-rose-500/20 outline-none cursor-pointer active:scale-95" title="حذف جذري"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </>
                                          )}
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

                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

          {/* 🟢 النافذة المنبثقة الحرة بتقنية Portals لكسر قيود الشريط السفلي وتغطيته بالكامل 🟢 */}
          {isMounted && isModalOpen && createPortal(
            <div className={`fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm h-[100dvh] overflow-hidden font-sans ${isDark ? 'dark' : ''}`} dir="rtl">
              <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-4 md:p-5 rounded-[1.5rem] w-full max-w-3xl max-h-[82dvh] flex flex-col shadow-2xl dark:shadow-[0_0_50px_rgba(249,115,22,0.15)] animate-in zoom-in-95 duration-300 mx-auto my-auto relative">
                
                <div className="flex justify-between items-center mb-3 shrink-0 border-b border-slate-100 dark:border-white/5 pb-2.5">
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-500" />
                    {isEditing ? `تعديل صنف` : 'إضافة صنف جديد'}
                  </h3>
                  <button onClick={closeModal} className="p-1.5 bg-slate-100 dark:bg-white/5 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors outline-none cursor-pointer active:scale-95"><X className="w-4 h-4" /></button>
                </div>
                
                <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1.5 space-y-2.5">
                    
                    {/* معلومات أساسية */}
                    <div className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 p-2.5 rounded-xl shadow-inner">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <div className="md:col-span-2">
                          <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 px-1 mb-0.5 uppercase tracking-widest">التسلسل</label>
                          <input type="number" value={sequence} onChange={(e) => setSequence(e.target.value)} placeholder="1" className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 h-8 px-2 outline-none font-black text-slate-900 dark:text-white text-[11px] rounded-lg text-center focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 shadow-sm dark:shadow-inner en-num" />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 px-1 mb-0.5 uppercase tracking-widest">اسم الصنف <span className="text-rose-500">*</span></label>
                          <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} required placeholder="مثال: دجاج كامل..." className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 h-8 px-2 outline-none font-black text-slate-900 dark:text-white text-[11px] rounded-lg focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 shadow-sm dark:shadow-inner" />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 px-1 mb-0.5 uppercase tracking-widest">الوكالة</label>
                          <div className="relative">
                            <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 h-8 px-2 outline-none font-black text-slate-900 dark:text-white text-[11px] rounded-lg appearance-none cursor-pointer focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 shadow-sm dark:shadow-inner">
                              <option value="">-- الوكالة --</option>
                              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            <ChevronDown className="w-3 h-3 text-slate-500 absolute left-2 top-2.5 pointer-events-none" />
                          </div>
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 px-1 mb-0.5 uppercase tracking-widest">القسم</label>
                          <div className="relative">
                            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 h-8 px-2 outline-none font-black text-slate-900 dark:text-white text-[11px] rounded-lg appearance-none cursor-pointer focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 shadow-sm dark:shadow-inner">
                              <option value="">-- القسم --</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <ChevronDown className="w-3 h-3 text-slate-500 absolute left-2 top-2.5 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 💡 قسم اختيار الأيقونة (مع تبويبات التوزيع) 💡 */}
                    <div className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 p-2.5 rounded-xl shadow-inner flex flex-col gap-2">
                      <div className="flex items-center justify-between px-1 border-b border-slate-200 dark:border-white/5 pb-2">
                        <label className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest shrink-0">أيقونة الصنف</label>
                        <div className="flex gap-1 overflow-x-auto custom-scrollbar no-scrollbar">
                          {iconTabs.map(tab => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setIconCategory(tab)}
                              className={`px-2 py-1 rounded-lg text-[8px] font-black transition-colors outline-none shrink-0 ${iconCategory === tab ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 shadow-inner' : 'bg-white dark:bg-[#121214] text-slate-500 border border-slate-200 dark:border-white/5 hover:text-slate-700 dark:hover:text-slate-300 shadow-sm dark:shadow-none'}`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-6 sm:grid-cols-9 lg:grid-cols-12 gap-1 max-h-[85px] overflow-y-auto custom-scrollbar pr-1 pt-1">
                        {filteredIcons.map((ic) => {
                          const IconComponent = ic.icon;
                          const isActive = selectedIcon === ic.name;
                          return (
                            <button
                              key={ic.name} 
                              type="button" 
                              title={ic.label}
                              onClick={() => setSelectedIcon(ic.name)}
                              className={`flex flex-col items-center justify-center gap-1 p-1 rounded-lg transition-all duration-300 border outline-none cursor-pointer ${isActive ? 'bg-orange-100 dark:bg-orange-500/20 border-orange-300 dark:border-orange-500/50 shadow-inner scale-105' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/20 shadow-sm dark:shadow-none'}`}
                            >
                              <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500'}`} />
                              <span className={`text-[7.5px] font-black text-center leading-tight truncate w-full px-0.5 ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500'}`}>{ic.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                      {/* العمود الأول (يمين) */}
                      <div className="flex flex-col gap-2.5">
                        
                        {/* وحدة الحساب المعتمدة */}
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2.5 rounded-xl shadow-inner relative overflow-hidden">
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                          <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> وحدة الحساب والجرد (المعتمدة)
                          </h4>
                          <div className="relative">
                            <select value={mainUnit} onChange={(e) => setMainUnit(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0c] border border-emerald-200 dark:border-emerald-500/30 h-8 px-2 outline-none font-black text-emerald-700 dark:text-emerald-400 text-[11px] rounded-lg appearance-none cursor-pointer shadow-sm dark:shadow-inner focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/20">
                              <option value="">-- تحديد وحدة الحساب --</option>
                              {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <ChevronDown className="w-3 h-3 text-emerald-600 absolute left-2 top-2.5 pointer-events-none" />
                          </div>
                        </div>

                        {/* القياس ووزن الصنف */}
                        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-2.5 rounded-xl shadow-inner">
                          <h4 className="text-[11px] font-black text-slate-800 dark:text-white mb-1.5 flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-blue-500" /> قياس ووزن الصنف
                          </h4>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[8px] font-black text-slate-500 dark:text-slate-400 px-1 mb-0.5 uppercase tracking-widest">نوع القياس</label>
                              <div className="relative">
                                <select value={measurementType} onChange={(e) => setMeasurementType(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 h-8 px-2 outline-none font-black text-slate-900 dark:text-white text-[10px] rounded-lg appearance-none cursor-pointer shadow-sm dark:shadow-inner focus:border-blue-500/50">
                                  <option value="الوزن">الوزن</option>
                                  <option value="العدد">العدد</option>
                                  <option value="قطعة">قطعة</option>
                                  <option value="سائل">سائل</option>
                                </select>
                                <ChevronDown className="w-3 h-3 text-slate-500 absolute left-2 top-2.5 pointer-events-none" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[8px] font-black text-slate-500 dark:text-slate-400 px-1 mb-0.5 uppercase tracking-widest">القيمة (الأولية)</label>
                              <input type="text" value={initialUnit} onChange={(e) => setInitialUnit(e.target.value)} placeholder="150" className="w-full bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 h-8 px-2 outline-none font-black text-slate-900 dark:text-white text-[10px] rounded-lg shadow-sm dark:shadow-inner focus:border-blue-500/50 text-center" />
                            </div>
                            <div>
                              <label className="block text-[8px] font-black text-slate-500 dark:text-slate-400 px-1 mb-0.5 uppercase tracking-widest">الوحدة (الرئيسية)</label>
                              <div className="relative">
                                <select value={primaryUnit} onChange={(e) => setPrimaryUnit(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 h-8 px-2 outline-none font-black text-slate-900 dark:text-white text-[10px] rounded-lg appearance-none cursor-pointer shadow-sm dark:shadow-inner focus:border-blue-500/50">
                                  <option value="">-- اختر --</option>
                                  {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <ChevronDown className="w-3 h-3 text-slate-500 absolute left-2 top-2.5 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* العمود الثاني (يسار) */}
                      <div className="flex flex-col gap-2.5">
                        
                        {/* التغليف والتعليب */}
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 p-2.5 rounded-xl shadow-inner flex flex-col h-full">
                          <h4 className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 mb-1.5 flex items-center gap-1.5">
                            <PackageOpen className="w-3.5 h-3.5 text-indigo-500" /> التغليف والتعليب
                          </h4>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <div>
                              <label className="block text-[8px] font-black text-indigo-500 dark:text-indigo-300 px-1 mb-0.5 uppercase tracking-widest">الغلاف الخارجي</label>
                              <div className="relative">
                                <select value={packagingType} onChange={(e) => setPackagingType(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0c] border border-indigo-200 dark:border-indigo-500/30 h-8 px-2 outline-none font-black text-indigo-700 dark:text-indigo-400 text-[10px] rounded-lg appearance-none cursor-pointer shadow-sm dark:shadow-inner focus:border-indigo-400">
                                  <option value="">-- لا يوجد --</option>
                                  {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <ChevronDown className="w-3 h-3 text-indigo-500 dark:text-indigo-600 absolute left-2 top-2.5 pointer-events-none" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[8px] font-black text-indigo-500 dark:text-indigo-300 px-1 mb-0.5 uppercase tracking-widest">السعة (العدد)</label>
                              <input type="number" value={packagingCapacity} onChange={(e) => setPackagingCapacity(e.target.value)} placeholder="100" className="w-full bg-white dark:bg-[#0a0a0c] border border-indigo-200 dark:border-indigo-500/30 h-8 px-2 outline-none font-black text-indigo-700 dark:text-indigo-400 text-[10px] rounded-lg dir-ltr text-center shadow-sm dark:shadow-inner focus:border-indigo-400" />
                            </div>
                            <div>
                              <label className="block text-[8px] font-black text-indigo-500 dark:text-indigo-300 px-1 mb-0.5 uppercase tracking-widest">وحدة الداخل</label>
                              <div className="relative">
                                <select value={packagingUnit} onChange={(e) => setPackagingUnit(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0c] border border-indigo-200 dark:border-indigo-500/30 h-8 px-2 outline-none font-black text-indigo-700 dark:text-indigo-400 text-[10px] rounded-lg appearance-none cursor-pointer shadow-sm dark:shadow-inner focus:border-indigo-400">
                                  <option value="">-- اختر --</option>
                                  {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <ChevronDown className="w-3 h-3 text-indigo-500 dark:text-indigo-600 absolute left-2 top-2.5 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                          
                          {packagingType && packagingCapacity && packagingUnit && (
                            <div className="mt-auto bg-indigo-100/50 dark:bg-[#0a0a0c] border border-indigo-200 dark:border-indigo-500/20 p-1.5 rounded-lg flex items-center gap-1.5 justify-center text-indigo-700 dark:text-indigo-400 text-[10px] shadow-inner">
                              <span className="font-bold">التعبئة:</span>
                              <span className="font-black bg-indigo-200/50 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded shadow-sm border border-indigo-300 dark:border-indigo-500/30">1 {packagingType} = <span dir="ltr">{packagingCapacity}</span> {packagingUnit}</span>
                            </div>
                          )}
                        </div>

                        {/* حالة الخزن */}
                        <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-2.5 rounded-xl shadow-inner">
                          <div className="flex flex-col gap-0.5">
                            <label className="block text-[9px] font-black text-slate-500 dark:text-slate-400 px-1 uppercase tracking-widest">حالة المنتج (الخزن)</label>
                            <div className="relative mt-1">
                              <select value={productType} onChange={(e) => setProductType(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 h-8 px-2 outline-none font-black text-slate-900 dark:text-white text-[11px] rounded-lg appearance-none cursor-pointer shadow-sm dark:shadow-inner focus:border-orange-500/50">
                                <option value="جاف">جاف</option>
                                <option value="مبرد">مبرد</option>
                                <option value="جامد">جامد</option>
                                <option value="مصنعات">مصنعات</option>
                              </select>
                              <ChevronDown className="w-3 h-3 text-slate-500 absolute left-2 top-2.5 pointer-events-none" />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>

                  <div className="flex gap-2 pt-2.5 mt-2.5 border-t border-slate-200 dark:border-white/5 shrink-0">
                    <button type="submit" disabled={isSaving} className="flex-1 bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_25px_rgba(249,115,22,0.5)] h-10 rounded-xl font-black flex justify-center items-center gap-2 disabled:opacity-50 text-xs transition-all outline-none cursor-pointer active:scale-95">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
                    </button>
                    <button type="button" onClick={closeModal} className="px-6 bg-slate-100 dark:bg-white/5 hover:bg-rose-100 dark:hover:bg-rose-500/10 border border-slate-200 dark:border-transparent hover:border-rose-300 dark:hover:border-rose-500/20 h-10 rounded-xl text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-black text-xs transition-colors outline-none cursor-pointer active:scale-95">إلغاء</button>
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
            .dir-ltr { direction: ltr; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `}} />
        </div>
      </div>
    </div>
  );
}