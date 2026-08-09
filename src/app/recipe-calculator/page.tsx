"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  ChefHat, Scale, Calculator, Plus, Trash2, PieChart, 
  Save, Utensils, Beaker, AlertTriangle, 
  TrendingDown, CheckCircle2, Loader2, BookOpen, DownloadCloud, 
  Search, PackageOpen, Link as LinkIcon, Edit3, Receipt, 
  ClipboardList, ThermometerSnowflake, CalendarClock, X, Printer, 
  FileSpreadsheet, Edit, History, Layers, Sparkles, BrainCircuit, TrendingUp, Box, Database, Building2, ChevronDown, ChevronRight, Share2, Target, Focus, Blocks, Leaf, Filter,
  Settings, MoveHorizontal, Maximize, RefreshCw, AlertCircle, Eye, EyeOff, LayoutList, Grid2X2 // 💡 أيقونات الـ View
} from 'lucide-react';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx-js-style';

interface RecipeIngredient {
  id: string;
  type: 'raw' | 'sub_recipe';
  sub_recipe_id?: string;
  name: string;
  quantity: number | '';
  unit: string;
}

const getBaseUnitQty = (qty: number, unit: string) => {
  if (qty === undefined || qty === null || isNaN(qty) || !unit) return null;
  const cleanUnit = unit.replace(/[\s\uFEFF\xA0\u200B-\u200D]/g, '').toLowerCase();
  
  if (['غرام', 'غم', 'g', 'gm', 'جرام', 'جم'].includes(cleanUnit)) return { value: qty / 1000, label: 'كغم' };
  if (['مل', 'ملي', 'ml', 'مليلتر'].includes(cleanUnit)) return { value: qty / 1000, label: 'لتر' };
  if (['كغم', 'كجم', 'كيلو', 'kg'].includes(cleanUnit)) return { value: qty, label: 'كغم' };
  if (['لتر', 'liter', 'l', 'ltr'].includes(cleanUnit)) return { value: qty, label: 'لتر' };
  
  return { value: qty, label: unit.trim() }; 
};

const convertToBaseUnit = (val: number, unit: string) => {
  if (!unit) return val;
  const cleanUnit = unit.replace(/[\s\uFEFF\xA0\u200B-\u200D]/g, '').toLowerCase();
  if (['كغم', 'كجم', 'كيلو', 'kg', 'لتر', 'liter', 'l', 'ltr'].includes(cleanUnit)) return val * 1000;
  return val; 
};

const defaultPdfSettings = {
  paperSize: 'A4',
  margin: '10mm',
  zoom: 90,
  shiftX: 0,
  autoFit: false,
  colName: 40,
  colVersion: 10,
  colBatch: 20,
  colPiece: 20,
  colIngCount: 10
};

export default function RecipeCalculatorPage() {
  const { isDark } = useTheme(); 
  const [isZenMode, setIsZenMode] = useState(false);
  const [mainTab, setMainTab] = useState<'calculator' | 'archive_items' | 'archive_free' | 'raw_materials' | 'packaging_materials'>('calculator');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); // 💡 حالة الـ View

  const [dbAgencies, setDbAgencies] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]); 
  const [dbItemsList, setDbItemsList] = useState<any[]>([]);
  
  const [dbRawMaterials, setDbRawMaterials] = useState<any[]>([]);
  const [dbPackagingMaterials, setDbPackagingMaterials] = useState<any[]>([]);

  const [newRawName, setNewRawName] = useState('');
  const [isAddingRaw, setIsAddingRaw] = useState(false);
  const [editingRawId, setEditingRawId] = useState<string | null>(null);
  const [editRawName, setEditRawName] = useState('');

  const [newPackName, setNewPackName] = useState('');
  const [isAddingPack, setIsAddingPack] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [editPackName, setEditPackName] = useState('');

  const [recipeSource, setRecipeSource] = useState<'db' | 'custom'>('db');
  const [selectedAgency, setSelectedAgency] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(''); 
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');

  const resolvedRecipeName = useMemo(() => {
    if (recipeSource === 'db') {
      const item = dbItemsList.find(i => String(i.id) === String(selectedItem));
      return item ? item.name : '';
    }
    return customName;
  }, [recipeSource, selectedItem, customName, dbItemsList]);

  const [batchWeight, setBatchWeight] = useState<number | ''>('');
  const [batchUnit, setBatchUnit] = useState<string>('كغم');
  const [pieceWeight, setPieceWeight] = useState<number | ''>('');
  const [pieceUnit, setPieceUnit] = useState<string>('غرام');
  const [wastePercent, setWastePercent] = useState<number | ''>(0);
  
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { id: '1', type: 'raw', name: '', quantity: '', unit: 'غرام' }
  ]);

  const [packaging, setPackaging] = useState<RecipeIngredient[]>([]);

  const [shelfLife, setShelfLife] = useState<string>('');
  const [storageMethod, setStorageMethod] = useState<string>('تبريد (ثلاجة)');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [originalRecipeVersion, setOriginalRecipeVersion] = useState<number>(1);

  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [filterAgency, setFilterAgency] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [viewRecipeModal, setViewRecipeModal] = useState<any | null>(null);
  const [targetProduction, setTargetProduction] = useState<number | ''>(1);

  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('recipeCalcPdfSettings_v1');
    if (savedSettings) {
      try { setPdfSettings(JSON.parse(savedSettings)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('recipeCalcPdfSettings_v1', JSON.stringify(pdfSettings));
    }
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => {
    setPdfSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetPdfSettings = () => {
    setPdfSettings(defaultPdfSettings);
  };

  useEffect(() => {
    setFilterAgency('all');
    setFilterCategory('all');
    setSearchQuery('');
  }, [mainTab]);

  const agMap = useMemo(() => {
    const map: Record<string, string> = {};
    dbAgencies.forEach(ag => map[ag.id] = ag.name);
    return map;
  }, [dbAgencies]);

  const catMap = useMemo(() => {
    const map: Record<string, string> = {};
    dbCategories.forEach(cat => map[cat.id] = cat.name);
    return map;
  }, [dbCategories]);

  const fetchDropdownData = async () => {
    try {
      const fetchAll = async (tableName: string) => {
        const { data } = await supabase.from(tableName).select('*');
        return data || [];
      };

      const [agData, catData, itData, rawData, packData] = await Promise.all([
        fetchAll('agencies'),
        fetchAll('categories'),
        fetchAll('items'),
        supabase.from('raw_materials').select('*').order('name', { ascending: true }).then(r => r.data || []),
        supabase.from('packaging_materials').select('*').order('name', { ascending: true }).then(r => r.data || [])
      ]);
      
      const getOrderVal = (obj: any) => {
        if (!obj) return 0;
        const keys = ['sort_order', 'order_index', 'order', 'seq', 'sequence', 'display_order', 'arrangement'];
        for (let k of keys) {
          if (obj[k] !== undefined && obj[k] !== null) return Number(obj[k]);
        }
        return Number(obj.id) || 0; 
      };

      const sortByOrder = (a: any, b: any) => getOrderVal(a) - getOrderVal(b);

      setDbAgencies(agData.sort(sortByOrder));
      setDbCategories(catData.sort(sortByOrder));
      setDbItemsList(itData.sort(sortByOrder));
      
      setDbRawMaterials(rawData);
      setDbPackagingMaterials(packData);
    } catch (error) { 
      console.error("Error fetching DB:", error); 
    }
  };

  useEffect(() => { fetchDropdownData(); }, []);

  const fetchArchive = async () => {
    setIsLoadingArchive(true);
    try {
      const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setSavedRecipes(data || []);
    } catch (error: any) { console.error('Error fetching recipes:', error); } finally { setIsLoadingArchive(false); }
  };

  useEffect(() => { fetchArchive(); }, []);

  const handleAddRawMaterial = async () => {
    const trimmedName = newRawName.trim();
    if (!trimmedName) return;
    if (dbRawMaterials.some(rm => rm.name === trimmedName)) { alert('هذه المادة موجودة مسبقاً في القائمة!'); return; }
    setIsAddingRaw(true);
    try {
      const { error } = await supabase.from('raw_materials').insert([{ name: trimmedName }]);
      if (error) throw error;
      setNewRawName('');
      await fetchDropdownData(); 
    } catch (e: any) { alert('حدث خطأ أثناء إضافة المادة الخام: ' + e.message); } finally { setIsAddingRaw(false); }
  };

  const handleUpdateRawMaterial = async (id: string) => {
    const trimmed = editRawName.trim();
    if (!trimmed) return;
    if (dbRawMaterials.some(rm => rm.name === trimmed && rm.id !== id)) { alert('هذا الاسم موجود مسبقاً!'); return; }
    try {
      const { error } = await supabase.from('raw_materials').update({ name: trimmed }).eq('id', id);
      if (error) throw error;
      setDbRawMaterials(prev => prev.map(rm => rm.id === id ? { ...rm, name: trimmed } : rm));
      setEditingRawId(null);
    } catch (e: any) { alert('حدث خطأ أثناء التعديل: ' + e.message); }
  };

  const handleDeleteRawMaterial = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المادة "${name}"؟ قد يؤثر ذلك على الوصفات المرتبطة بها.`)) return;
    try {
      const { error } = await supabase.from('raw_materials').delete().eq('id', id);
      if (error) throw error;
      setDbRawMaterials(prev => prev.filter(rm => rm.id !== id));
    } catch (e: any) { alert('حدث خطأ أثناء الحذف: ' + e.message); }
  };

  const handleAddPackMaterial = async () => {
    const trimmedName = newPackName.trim();
    if (!trimmedName) return;
    if (dbPackagingMaterials.some(pm => pm.name === trimmedName)) { alert('هذه المادة موجودة مسبقاً في القائمة!'); return; }
    setIsAddingPack(true);
    try {
      const { error } = await supabase.from('packaging_materials').insert([{ name: trimmedName }]);
      if (error) throw error;
      setNewPackName('');
      await fetchDropdownData(); 
    } catch (e: any) { alert('حدث خطأ أثناء إضافة المادة: ' + e.message); } finally { setIsAddingPack(false); }
  };

  const handleUpdatePackMaterial = async (id: string) => {
    const trimmed = editPackName.trim();
    if (!trimmed) return;
    if (dbPackagingMaterials.some(pm => pm.name === trimmed && pm.id !== id)) { alert('هذا الاسم موجود مسبقاً!'); return; }
    try {
      const { error } = await supabase.from('packaging_materials').update({ name: trimmed }).eq('id', id);
      if (error) throw error;
      setDbPackagingMaterials(prev => prev.map(pm => pm.id === id ? { ...pm, name: trimmed } : pm));
      setEditingPackId(null);
    } catch (e: any) { alert('حدث خطأ أثناء التعديل: ' + e.message); }
  };

  const handleDeletePackMaterial = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المادة "${name}"؟ قد يؤثر ذلك على الوصفات المرتبطة بها.`)) return;
    try {
      const { error } = await supabase.from('packaging_materials').delete().eq('id', id);
      if (error) throw error;
      setDbPackagingMaterials(prev => prev.filter(pm => pm.id !== id));
    } catch (e: any) { alert('حدث خطأ أثناء الحذف: ' + e.message); }
  };

  const addIngredient = () => { setIngredients([...ingredients, { id: Math.random().toString(), type: 'raw', name: '', quantity: '', unit: 'غرام' }]); };
  const removeIngredient = (id: string) => { if (ingredients.length > 1) setIngredients(ingredients.filter(ing => ing.id !== id)); };
  const updateIngredient = (id: string, field: keyof RecipeIngredient, value: string | number) => { setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, [field]: value } : ing)); };

  const addPackaging = () => { setPackaging([...packaging, { id: Math.random().toString(), type: 'raw', name: '', quantity: 1, unit: 'قطعة' }]); };
  const removePackaging = (id: string) => { setPackaging(packaging.filter(ing => ing.id !== id)); };
  const updatePackaging = (id: string, field: keyof RecipeIngredient, value: string | number) => { setPackaging(packaging.map(ing => ing.id === id ? { ...ing, [field]: value } : ing)); };

  const { standardizedRecipe, standardizedPackaging } = useMemo(() => {
    const bWeight = Number(batchWeight) || 0;
    const pWeight = Number(pieceWeight) || 0;
    const waste = Number(wastePercent) || 0;

    if (bWeight === 0 || pWeight === 0) {
      return { 
        standardizedRecipe: ingredients.map(ing => ({ ...ing, perUnitQty: 0 })),
        standardizedPackaging: packaging.map(p => ({ ...p, perUnitQty: 0 }))
      };
    }

    const totalBatchInBase = convertToBaseUnit(bWeight, batchUnit);
    const basePieceInBase = convertToBaseUnit(pWeight, pieceUnit);
    const effectivePieceWeight = basePieceInBase * (1 + (waste / 100));
    const ratio = effectivePieceWeight / totalBatchInBase;

    const calculatedIngredients = ingredients.map(ing => {
      const qty = Number(ing.quantity) || 0;
      return { ...ing, perUnitQty: qty * ratio };
    });

    const calculatedPackaging = packaging.map(p => {
      const qty = Number(p.quantity) || 0;
      return { ...p, perUnitQty: qty * ratio };
    });

    return { standardizedRecipe: calculatedIngredients, standardizedPackaging: calculatedPackaging };
  }, [ingredients, packaging, batchWeight, batchUnit, pieceWeight, pieceUnit, wastePercent]);

  const handleCancelEdit = () => {
    setEditingRecipeId(null);
    setOriginalRecipeVersion(1);
    setRecipeSource('db');
    setSelectedAgency('');
    setSelectedCategory('');
    setSelectedItem('');
    setCustomName('');
    setBatchWeight('');
    setBatchUnit('كغم');
    setPieceWeight('');
    setPieceUnit('غرام');
    setWastePercent(0);
    setIngredients([{ id: '1', type: 'raw', name: '', quantity: '', unit: 'غرام' }]);
    setPackaging([]);
    setShelfLife('');
    setStorageMethod('تبريد (ثلاجة)');
  };

  const handleSaveRecipe = async (saveMode: 'new_recipe' | 'overwrite' | 'new_version') => {
    if (!resolvedRecipeName.trim()) { alert("يرجى تحديد اسم الصنف أو إدخال مادة أولية قبل الحفظ!"); return; }
    const validIngredients = ingredients.filter(ing => ing.name.trim() !== '' && ing.quantity !== '');
    if (validIngredients.length === 0) { alert("يرجى إضافة مكون واحد على الأقل قبل الحفظ!"); return; }
    const validPackaging = packaging.filter(p => p.name.trim() !== '' && p.quantity !== '');

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const newPackNames = validPackaging.map(p => p.name.trim()).filter(name => !dbPackagingMaterials.some(pm => pm.name === name));
      const uniqueNewPack = Array.from(new Set(newPackNames));
      if (uniqueNewPack.length > 0) {
        await supabase.from('packaging_materials').upsert(uniqueNewPack.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true });
        setDbPackagingMaterials(prev => [...prev, ...uniqueNewPack.map(name => ({ name }))]);
      }

      let existingRecipeConflict = null;
      if (recipeSource === 'db' && selectedItem) {
        existingRecipeConflict = savedRecipes.find(r => r.item_id === selectedItem && r.id !== editingRecipeId);
      } else {
        existingRecipeConflict = savedRecipes.find(r => !r.item_id && r.name.trim() === resolvedRecipeName.trim() && r.id !== editingRecipeId);
      }

      if (existingRecipeConflict) {
        alert(recipeSource === 'db' ? "عذراً، توجد وصفة محفوظة مسبقاً لهذا الصنف في هذه الوكالة بالذات!" : "عذراً، يوجد اسم مطابق لوصفة حرة أخرى في الأرشيف!");
        setIsSaving(false);
        return;
      }

      let finalVersion = 1;
      if (editingRecipeId) {
        finalVersion = saveMode === 'new_version' ? originalRecipeVersion + 1 : originalRecipeVersion;
      }

      const payload = {
        name: resolvedRecipeName, 
        item_id: recipeSource === 'db' && selectedItem ? selectedItem : null, 
        agency_id: recipeSource === 'db' && selectedAgency ? selectedAgency : null, 
        category_id: recipeSource === 'db' && selectedCategory ? selectedCategory : null,
        version: finalVersion, 
        batch_weight: Number(batchWeight) || 0, 
        batch_unit: batchUnit, 
        piece_weight: Number(pieceWeight) || 0, 
        piece_unit: pieceUnit, 
        waste_percent: Number(wastePercent) || 0, 
        total_cost: 0, 
        ingredients: standardizedRecipe, 
        packaging_materials: validPackaging.length > 0 ? standardizedPackaging : null, 
        prep_time: null, 
        shelf_life: shelfLife, 
        storage_method: storageMethod, 
        instructions: null
      };

      if (editingRecipeId) {
        const { error } = await supabase.from('recipes').update(payload).eq('id', editingRecipeId);
        if (error) throw error;
        setOriginalRecipeVersion(finalVersion);
      } else {
        const { error } = await supabase.from('recipes').insert([payload]);
        if (error) throw error;
        handleCancelEdit(); 
      }

      setSaveSuccess(true);
      fetchArchive(); 
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) { alert("حدث خطأ أثناء حفظ الوصفة: " + error.message); } finally { setIsSaving(false); }
  };

  const handleLoadToCalculator = (recipe: any) => {
    setViewRecipeModal(null);
    let matchedItem = null;
    if (recipe.item_id) { matchedItem = dbItemsList.find(i => String(i.id) === String(recipe.item_id)); } 
    else { matchedItem = dbItemsList.find(i => i.name === recipe.name && (!recipe.agency_id || String(i.agency_id) === String(recipe.agency_id))); }

    if (matchedItem) {
      setRecipeSource('db'); setSelectedAgency(matchedItem.agency_id); setSelectedCategory(matchedItem.category_id || ''); setSelectedItem(matchedItem.id); setCustomName('');
    } else {
      setRecipeSource('custom'); setCustomName(recipe.name); setSelectedAgency(''); setSelectedCategory(''); setSelectedItem('');
    }

    setBatchWeight(recipe.batch_weight); setBatchUnit(recipe.batch_unit);
    setPieceWeight(recipe.piece_weight); setPieceUnit(recipe.piece_unit);
    setWastePercent(recipe.waste_percent);
    setShelfLife(recipe.shelf_life || ''); setStorageMethod(recipe.storage_method || 'تبريد (ثلاجة)');

    if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
      setIngredients(recipe.ingredients.map((ing: any) => ({
        id: Math.random().toString(), type: ing.type || 'raw', sub_recipe_id: ing.sub_recipe_id || undefined, name: ing.name || '', quantity: ing.quantity || '', unit: ing.unit || 'غرام'
      })));
    } else { setIngredients([{ id: '1', type: 'raw', name: '', quantity: '', unit: 'كغم' }]); }
    
    if (Array.isArray(recipe.packaging_materials) && recipe.packaging_materials.length > 0) {
      setPackaging(recipe.packaging_materials.map((p: any) => ({
        id: Math.random().toString(), type: 'raw', name: p.name || '', quantity: p.quantity || '', unit: p.unit || 'قطعة'
      })));
    } else { setPackaging([]); }

    setEditingRecipeId(recipe.id);
    setOriginalRecipeVersion(recipe.version || 1);

    setMainTab('calculator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRecipe = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف وصفة "${name}" بشكل نهائي؟`)) return;
    try { const { error } = await supabase.from('recipes').delete().eq('id', id); if (error) throw error; fetchArchive(); } catch (error: any) { alert("حدث خطأ أثناء الحذف: " + error.message); }
  };

  const handleOpenModal = (recipe: any) => { setTargetProduction(1); setViewRecipeModal(recipe); };

  const RecursiveIngredientRow = ({ ing, level = 0, multiplier = 1, isLast = false }: { ing: any, level?: number, multiplier?: number, isLast?: boolean }) => {
    const [expanded, setExpanded] = useState(false);
    const isSubRecipe = ing.type === 'sub_recipe' && ing.sub_recipe_id;
    const subRecipeObj = isSubRecipe ? savedRecipes.find(r => String(r.id) === String(ing.sub_recipe_id)) : null;
    
    const totalRequiredQty = Number(ing.perUnitQty) * multiplier;

    let subMultiplier = 1;
    if (subRecipeObj) {
      const requestedBase = convertToBaseUnit(totalRequiredQty, ing.unit);
      const subRecipePieceBase = convertToBaseUnit(subRecipeObj.piece_weight, subRecipeObj.piece_unit);
      subMultiplier = requestedBase / subRecipePieceBase;
    }

    return (
      <div className={`relative ${level > 0 ? 'mt-3' : ''}`}>
        {level > 0 && (
          <div className="absolute right-[-16px] top-[-14px] w-[16px] h-[40px] border-b-[2px] border-r-[2px] border-slate-300 dark:border-white/10 rounded-br-2xl pointer-events-none"></div>
        )}
        
        <div className={`bg-white dark:bg-[#121214] hover:bg-slate-50 dark:hover:bg-[#1a1a24] transition-colors border ${isSubRecipe ? 'border-indigo-200 dark:border-indigo-500/40 shadow-sm dark:shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'border-slate-200 dark:border-white/5 shadow-sm'} p-3.5 rounded-[1.2rem] flex items-center justify-between group relative overflow-hidden z-10`}>
          <div className={`absolute right-0 top-0 w-1.5 h-full opacity-0 group-hover:opacity-100 transition-opacity ${isSubRecipe ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
          
          <div className="flex items-center gap-4 w-full">
            {isSubRecipe ? (
              <button onClick={() => setExpanded(!expanded)} className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-all shrink-0 outline-none cursor-pointer">
                {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#050505] border border-slate-200 dark:border-white/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm dark:shadow-inner"><Utensils className="w-4 h-4" /></div>
            )}
            
            <div className="flex-1">
              <p className="text-[15px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                {ing.name} 
                {isSubRecipe && <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 font-bold shadow-sm dark:shadow-inner">وصفة حرة (مركبة)</span>}
              </p>
            </div>
            
            <div className={`px-5 py-2 rounded-xl text-center min-w-[100px] shadow-sm dark:shadow-inner ${isSubRecipe ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300'}`}>
              <span dir="ltr" className="block text-[17px] font-black leading-none tracking-tight drop-shadow-sm">
                {new Intl.NumberFormat('en-US', { maximumFractionDigits: 3, useGrouping: true }).format(totalRequiredQty)}
              </span>
              <span className={`block text-[10px] font-bold mt-1 opacity-80 ${isSubRecipe ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{ing.unit}</span>
            </div>
          </div>
        </div>

        {expanded && subRecipeObj && subRecipeObj.ingredients && (
          <div className="mr-8 relative pt-4 pb-2 border-r-[2px] border-indigo-200 dark:border-indigo-500/30 pr-5 mt-1 bg-slate-50 dark:bg-[#050505] rounded-l-3xl shadow-sm dark:shadow-inner">
            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold mb-4 flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 inline-flex px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-500/20 shadow-sm dark:shadow-inner">
              <BrainCircuit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>تحليل ذكي: مكونات <strong className="drop-shadow-sm"><span dir="ltr">{new Intl.NumberFormat('en-US', { maximumFractionDigits: 3, useGrouping: true }).format(totalRequiredQty)}</span> {ing.unit}</strong> من {ing.name}.</span>
            </div>
            
            {subRecipeObj.ingredients.map((childIng: any, idx: number) => (
              <RecursiveIngredientRow key={idx} ing={childIng} level={level + 1} multiplier={subMultiplier} isLast={idx === subRecipeObj.ingredients.length - 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const filteredItemsArchive = savedRecipes.filter(r => r.item_id !== null && r.item_id !== undefined).filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFreeArchive = savedRecipes.filter(r => r.item_id === null || r.item_id === undefined).filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredRawMaterials = dbRawMaterials.filter(rm => rm.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredPackMaterials = dbPackagingMaterials.filter(pm => pm.name.toLowerCase().includes(searchQuery.toLowerCase())); 

  const agencyCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filteredItemsArchive.length };
    filteredItemsArchive.forEach(r => {
      const ag = r.agency_id || 'عام';
      counts[ag] = (counts[ag] || 0) + 1;
    });
    return counts;
  }, [filteredItemsArchive]);

  const categoryCounts = useMemo(() => {
    const filteredByAg = filterAgency === 'all' 
      ? filteredItemsArchive 
      : filteredItemsArchive.filter(r => (r.agency_id || 'عام') === filterAgency);
    
    const counts: Record<string, number> = { all: filteredByAg.length };
    filteredByAg.forEach(r => {
      const cat = r.category_id || 'بدون_قسم';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [filteredItemsArchive, filterAgency]);

  const finalFilteredArchive = useMemo(() => {
    let filtered = filteredItemsArchive;
    if (filterAgency !== 'all') {
      filtered = filtered.filter(r => (r.agency_id || 'عام') === filterAgency);
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter(r => (r.category_id || 'بدون_قسم') === filterCategory);
    }
    return filtered;
  }, [filteredItemsArchive, filterAgency, filterCategory]);

  const groupedArchive = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};

    finalFilteredArchive.forEach(recipe => {
      const agId = recipe.agency_id || 'عام';
      const catId = recipe.category_id || 'بدون_قسم';

      if (!groups[agId]) groups[agId] = {};
      if (!groups[agId][catId]) groups[agId][catId] = [];
      
      groups[agId][catId].push(recipe);
    });

    return groups;
  }, [finalFilteredArchive]);

  const getOrderValForFilter = (id: string, list: any[]) => {
    const item = list.find(x => String(x.id) === id);
    if (!item) return 999;
    const keys = ['sort_order', 'order_index', 'order', 'seq', 'sequence', 'display_order', 'arrangement'];
    for (let k of keys) {
      if (item[k] !== undefined && item[k] !== null) return Number(item[k]);
    }
    return Number(item.id) || 999;
  };

  const sortedAgenciesForFilter = Object.keys(agencyCounts).filter(k => k !== 'all').sort((a, b) => {
    if (a === 'عام') return 1; if (b === 'عام') return -1;
    return getOrderValForFilter(a, dbAgencies) - getOrderValForFilter(b, dbAgencies);
  });

  const sortedCategoriesForFilter = Object.keys(categoryCounts).filter(k => k !== 'all').sort((a, b) => {
    if (a === 'بدون_قسم') return 1; if (b === 'بدون_قسم') return -1;
    return getOrderValForFilter(a, dbCategories) - getOrderValForFilter(b, dbCategories);
  });

  const executePrint = (htmlContent: string, documentTitle: string) => {
    const iframe = document.createElement('iframe'); 
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open(); 
      iframeDoc.write(htmlContent); 
      iframeDoc.close();
      
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.document.title = documentTitle;
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);
      }, 1000);
    }
  };

  const handleExportAllPDF = () => {
    if (finalFilteredArchive.length === 0) return alert('لا توجد وصفات لطباعتها!');

    let contentHTML = '';
    const getColStyle = (widthPercent: number) => {
      return pdfSettings.autoFit ? `padding: 10px;` : `width: ${widthPercent}%; padding: 10px;`;
    };
    
    Object.keys(groupedArchive).sort((a, b) => {
      if (a === 'عام') return 1; if (b === 'عام') return -1;
      return getOrderValForFilter(a, dbAgencies) - getOrderValForFilter(b, dbAgencies);
    }).forEach(agId => {
      
      contentHTML += `<h2 style="background: #1e293b; color: white; padding: 12px 20px; font-size: 18px; font-weight: 900; margin-top: 30px; border-radius: 8px;">${agId === 'عام' ? 'أصناف عامة (بدون وكالة)' : (agMap[agId] || 'وكالة غير معروفة')}</h2>`;
      
      Object.keys(groupedArchive[agId]).sort((a, b) => {
        if (a === 'بدون_قسم') return 1; if (b === 'بدون_قسم') return -1;
        return getOrderValForFilter(a, dbCategories) - getOrderValForFilter(b, dbCategories);
      }).forEach(catId => {
        
        contentHTML += `<h3 style="color: #4f46e5; font-size: 16px; font-weight: 900; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #e0e7ff; padding-bottom: 5px; display: inline-block;">${catId === 'بدون_قسم' ? 'أصناف بدون قسم' : (catMap[catId] || 'قسم غير معروف')}</h3>`;
        
        contentHTML += `
          <table style="width: 100%; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'}; border-collapse: collapse; margin-bottom: 20px; text-align: right; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background: #f1f5f9; color: #475569; font-size: 12px; border-bottom: 2px solid #94a3b8;">
                <th style="${getColStyle(pdfSettings.colName)} border: 1px solid #cbd5e1; word-break: break-word;">اسم الصنف / المنتج النهائي</th>
                <th style="${getColStyle(pdfSettings.colVersion)} border: 1px solid #cbd5e1; text-align: center; word-break: break-word;">الإصدار</th>
                <th style="${getColStyle(pdfSettings.colBatch)} border: 1px solid #cbd5e1; text-align: center; word-break: break-word;">الطبخة (كلي)</th>
                <th style="${getColStyle(pdfSettings.colPiece)} border: 1px solid #cbd5e1; text-align: center; word-break: break-word;">القطعة / النسبة</th>
                <th style="${getColStyle(pdfSettings.colIngCount)} border: 1px solid #cbd5e1; text-align: center; word-break: break-word;">عدد المكونات</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        groupedArchive[agId][catId].forEach((recipe: any, rIdx: number) => {
          const bgCol = rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
          contentHTML += `
            <tr style="background: ${bgCol}; page-break-inside: avoid;">
              <td style="${getColStyle(pdfSettings.colName)} border: 1px solid #e2e8f0; font-weight: 900; color: #0f172a; font-size: 14px; word-break: break-word;">${recipe.name}</td>
              <td style="${getColStyle(pdfSettings.colVersion)} border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #059669; font-size: 12px; word-break: break-word;" dir="ltr">V${recipe.version || 1}</td>
              <td style="${getColStyle(pdfSettings.colBatch)} border: 1px solid #e2e8f0; text-align: center; font-weight: 900; color: #475569; font-size: 13px; word-break: break-word;" dir="ltr">${recipe.batch_weight} <span style="font-size: 10px; color: #94a3b8;">${recipe.batch_unit}</span></td>
              <td style="${getColStyle(pdfSettings.colPiece)} border: 1px solid #e2e8f0; text-align: center; font-weight: 900; color: #475569; font-size: 13px; word-break: break-word;" dir="ltr">${recipe.piece_weight} <span style="font-size: 10px; color: #94a3b8;">${recipe.piece_unit}</span></td>
              <td style="${getColStyle(pdfSettings.colIngCount)} border: 1px solid #e2e8f0; text-align: center; font-weight: 900; color: #3b82f6; font-size: 14px; word-break: break-word;">${recipe.ingredients ? recipe.ingredients.length : 0}</td>
            </tr>
          `;
        });
        
        contentHTML += `</tbody></table>`;
      });
    });

    const fullHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            
            /* 💡 تطبيق إعدادات الورقة 💡 */
            @page { size: ${pdfSettings.paperSize} portrait; margin: ${pdfSettings.margin}; }
            
            body { font-family: 'Cairo', sans-serif; background: #ffffff; margin: 0; padding: 0; color: #0f172a; direction: rtl; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-footer { display: flex !important; position: fixed !important; bottom: 0; left: 0; right: 0; background: white; padding-top: 8px; border-top: 2px solid #e2e8f0; z-index: 1000; justify-content: space-between; font-size: 12px; font-weight: 900; color: #64748b; }
            
            /* 💡 تطبيق الزووم والازاحة 💡 */
            .print-container { 
               padding-bottom: 50px; 
               zoom: ${pdfSettings.zoom / 100}; 
               margin-right: ${pdfSettings.shiftX}mm;
            }
            
            tr, td, th { page-break-inside: avoid !important; }
            thead { display: table-header-group !important; }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div style="border-bottom: 3px solid #4f46e5; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #0f172a;">دليل أرشيف الوصفات (SOP)</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #4f46e5;">قائمة الأصناف المعتمدة والفعالة</p>
              </div>
              <div style="text-align: left;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569;">نظام الإدارة المركزي</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8;">تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>
            ${contentHTML}
          </div>
          <div class="print-footer">
            <div>طُبع بواسطة: <span style="color: #0f172a; margin-right: 5px;">YASIR SAADOUN</span></div>
            <div dir="ltr">تاريخ الطباعة: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</div>
          </div>
        </body>
      </html>
    `;
    executePrint(fullHTML, `دليل_الوصفات_${dayjs().format('YYYYMMDD')}`);
  };

  const handleExportAllExcel = () => {
    if (finalFilteredArchive.length === 0) return alert('لا توجد وصفات لتصديرها!');

    try {
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };

      const aoaData: any[][] = [
        ["📦 اسم الصنف", "🏢 الوكالة", "📑 القسم", "🔄 الإصدار", "⚖️ الطبخة الإجمالية", "📏 وحدة الطبخة", "🍔 وزن القطعة", "📐 وحدة القطعة", "🗑️ نسبة الهدر %", "🧪 عدد المكونات"]
      ];

      finalFilteredArchive.forEach(recipe => {
        aoaData.push([
          recipe.name,
          recipe.agency_id ? agMap[recipe.agency_id] : 'عام',
          recipe.category_id ? catMap[recipe.category_id] : 'بدون قسم',
          recipe.version || 1,
          recipe.batch_weight,
          recipe.batch_unit,
          recipe.piece_weight,
          recipe.piece_unit,
          recipe.waste_percent || 0,
          recipe.ingredients ? recipe.ingredients.length : 0
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoaData);
      ws['!dir'] = 'rtl';
      ws['!cols'] = [
        { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
      ];

      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[cellAddress]) continue;
          const isHeader = R === 0;
          ws[cellAddress].s = {
            font: { bold: isHeader, color: { rgb: isHeader ? "FFFFFF" : "334155" }, sz: 12, name: 'Arial' },
            fill: { fgColor: { rgb: isHeader ? "0F172A" : "FFFFFF" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } }, left: { style: "thin", color: { rgb: "CBD5E1" } }, right: { style: "thin", color: { rgb: "CBD5E1" } } }
          };
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, "أرشيف الوصفات");
      XLSX.writeFile(wb, `قاعدة_بيانات_الوصفات_${dayjs().format('YYYYMMDD')}.xlsx`);
    } catch (err) { alert("حدث خطأ أثناء التصدير."); console.error(err); }
  };

  const handlePrintRecipe = (recipe: any) => {
    const multiplier = Number(targetProduction) || 1;
    
    const buildTreeHTML = (ingredients: any[], level = 0, currentMultiplier = 1): string => {
      let html = '';
      ingredients.forEach((ing, idx) => {
        const totalRequiredQty = Number(ing.perUnitQty) * currentMultiplier;
        const isSubRecipe = ing.type === 'sub_recipe' && ing.sub_recipe_id;
        const subRecipeObj = isSubRecipe ? savedRecipes.find(r => String(r.id) === String(ing.sub_recipe_id)) : null;
        
        let subMultiplier = 1;
        if (subRecipeObj) {
          const requestedBase = convertToBaseUnit(totalRequiredQty, ing.unit);
          const subRecipePieceBase = convertToBaseUnit(subRecipeObj.piece_weight, subRecipeObj.piece_unit);
          subMultiplier = requestedBase / subRecipePieceBase;
        }

        const paddingRight = level * 25 + 15;
        const bg = level === 0 ? '#ffffff' : '#f8fafc';
        const indicator = level > 0 ? '↪ ' : '';
        const borderLeft = level > 0 ? '4px solid #cbd5e1' : '1px solid #e2e8f0';
        
        html += `
          <tr style="background: ${bg}; page-break-inside: avoid;">
            <td style="padding: 10px 15px; border: 1px solid #e2e8f0; border-right: ${borderLeft}; text-align: right; padding-right: ${paddingRight}px; font-weight: ${level === 0 ? '900' : 'bold'}; color: ${level === 0 ? '#0f172a' : '#475569'}; font-size: ${level === 0 ? '14px' : '12px'};">
              <span style="color:#94a3b8; font-size:10px;">${indicator}</span>${ing.name} ${isSubRecipe ? '<span style="font-size:10px; color:#6366f1; background:#e0e7ff; padding:2px 6px; border-radius:4px; margin-right:8px;">مركب</span>' : ''}
            </td>
            <td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: center; font-weight: 900; color: #0f172a; font-size: 15px;" dir="ltr">
              ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(totalRequiredQty)}
            </td>
            <td style="padding: 10px 15px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #64748b; font-size: 12px;">
              ${ing.unit}
            </td>
          </tr>
        `;

        if (isSubRecipe && subRecipeObj && subRecipeObj.ingredients) {
          html += buildTreeHTML(subRecipeObj.ingredients, level + 1, subMultiplier);
        }
      });
      return html;
    };

    let packagingHTML = '';
    if (recipe.packaging_materials && recipe.packaging_materials.length > 0) {
      packagingHTML = `
        <h3 style="font-size: 14px; font-weight: 900; color: #0284c7; margin-top: 30px; margin-bottom: 10px; border-bottom: 2px solid #bae6fd; padding-bottom: 5px;">مواد التعبئة والتغليف المطلوبة</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #e0f2fe; color: #0369a1; font-size: 12px;">
              <th style="padding: 10px; border: 1px solid #bae6fd; text-align: right;">المادة</th>
              <th style="padding: 10px; border: 1px solid #bae6fd; text-align: center; width: 120px;">الكمية (عدد)</th>
              <th style="padding: 10px; border: 1px solid #bae6fd; text-align: center; width: 120px;">الوحدة</th>
            </tr>
          </thead>
          <tbody>
            ${recipe.packaging_materials.map((p: any) => `
              <tr style="page-break-inside: avoid;">
                <td style="padding: 10px; border: 1px solid #bae6fd; text-align: right; font-weight: bold; color: #0f172a; font-size: 13px;">${p.name}</td>
                <td style="padding: 10px; border: 1px solid #bae6fd; text-align: center; font-weight: 900; color: #0284c7; font-size: 15px;" dir="ltr">${Math.ceil(Number(p.perUnitQty) * multiplier)}</td>
                <td style="padding: 10px; border: 1px solid #bae6fd; text-align: center; font-weight: bold; color: #0369a1; font-size: 12px;">${p.unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            
            /* 💡 تطبيق إعدادات الورقة على أمر التشغيل أيضاً 💡 */
            @page { size: ${pdfSettings.paperSize} portrait; margin: ${pdfSettings.margin}; }
            
            body { font-family: 'Cairo', sans-serif; margin: 0; padding: 0; color: #0f172a; direction: rtl; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: white; }
            .print-footer { display: flex !important; position: fixed !important; bottom: 0; left: 0; right: 0; background: white; padding-top: 8px; border-top: 2px solid #e2e8f0; z-index: 1000; justify-content: space-between; font-size: 11px; font-weight: 900; color: #64748b; }
            
            /* 💡 تطبيق التزحيف والزوم 💡 */
            .print-container { 
               padding-bottom: 50px; 
               zoom: ${pdfSettings.zoom / 100}; 
               margin-right: ${pdfSettings.shiftX}mm;
            }
            
            tr, td, th { page-break-inside: avoid !important; }
            thead { display: table-header-group !important; }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div style="border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a;">أمر تشغيل إنتاج (BOM)</h1>
                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #10b981;">الصنف المستهدف: ${recipe.name} (V${recipe.version || 1})</p>
              </div>
              <div style="text-align: left;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569;">الوكالة: ${recipe.agency_id ? agMap[recipe.agency_id] : 'عام'}</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #94a3b8;">تاريخ الإصدار: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</p>
              </div>
            </div>

            <div style="display: flex; gap: 15px; margin-bottom: 25px;">
              <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 15px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 4px;">الكمية المطلوب إنتاجها الآن</p>
                <p style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a;" dir="ltr">${multiplier}</p>
              </div>
              <div style="flex: 1; background: #f0fdf4; border: 1px solid #a7f3d0; padding: 10px 15px; border-radius: 8px; text-align: center;">
                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #047857; margin-bottom: 4px;">وزن القطعة (الصافي + الهدر)</p>
                <p style="margin: 0; font-size: 16px; font-weight: 900; color: #059669;" dir="ltr">
                  ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Number(recipe.piece_weight) * (1 + (Number(recipe.waste_percent)/100)))} <span style="font-size: 10px;">${recipe.piece_unit}</span>
                </p>
              </div>
            </div>

            <h3 style="font-size: 14px; font-weight: 900; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px;">مقادير المواد الخام والسحوبات</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background: #0f172a; color: white; font-size: 12px;">
                  <th style="padding: 10px; border: 1px solid #1e293b; text-align: right;">المادة / الوصفة الفرعية</th>
                  <th style="padding: 10px; border: 1px solid #1e293b; text-align: center; width: 120px;">الكمية</th>
                  <th style="padding: 10px; border: 1px solid #1e293b; text-align: center; width: 120px;">الوحدة</th>
                </tr>
              </thead>
              <tbody>
                ${buildTreeHTML(recipe.ingredients || [], 0, multiplier)}
              </tbody>
            </table>

            ${packagingHTML}
            
            <div style="margin-top: 40px; display: flex; justify-content: space-around; page-break-inside: avoid;">
              <div style="text-align: center; border-top: 1px dashed #94a3b8; padding-top: 10px; width: 200px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569;">توقيع مسؤول التحضير</p>
              </div>
              <div style="text-align: center; border-top: 1px dashed #94a3b8; padding-top: 10px; width: 200px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold; color: #475569;">توقيع الاستلام</p>
              </div>
            </div>

          </div>
          <div class="print-footer">
            <div>طُبع بواسطة: <span style="color: #0f172a; margin-right: 5px;">YASIR SAADOUN</span></div>
            <div dir="ltr">تاريخ الطباعة: ${dayjs().format('YYYY-MM-DD | hh:mm A')}</div>
          </div>
        </body>
      </html>
    `;
    
    executePrint(htmlContent, `أمر_تشغيل_${recipe.name.replace(/\s+/g, '_')}`);
  };

  const handleExportRecipeExcel = (recipe: any) => {
    const multiplier = Number(targetProduction) || 1;
    try {
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };

      const aoaData: any[][] = [
        ["📦 المادة / الوصفة الفرعية", "⚖️ الكمية", "📏 الوحدة", "📑 المستوى"]
      ];

      const buildTreeArray = (ingredients: any[], level = 0, currentMultiplier = 1) => {
        ingredients.forEach((ing) => {
          const totalRequiredQty = Number(ing.perUnitQty) * currentMultiplier;
          const isSubRecipe = ing.type === 'sub_recipe' && ing.sub_recipe_id;
          const subRecipeObj = isSubRecipe ? savedRecipes.find(r => String(r.id) === String(ing.sub_recipe_id)) : null;
          
          let subMultiplier = 1;
          if (subRecipeObj) {
            const requestedBase = convertToBaseUnit(totalRequiredQty, ing.unit);
            const subRecipePieceBase = convertToBaseUnit(subRecipeObj.piece_weight, subRecipeObj.piece_unit);
            subMultiplier = requestedBase / subRecipePieceBase;
          }

          const prefix = " ".repeat(level * 4) + (level > 0 ? "↪ " : "");
          aoaData.push([
            prefix + ing.name + (isSubRecipe ? ' (مركب)' : ''),
            Number(totalRequiredQty.toFixed(3)),
            ing.unit,
            level === 0 ? 'رئيسي' : `فرعي (${level})`
          ]);

          if (isSubRecipe && subRecipeObj && subRecipeObj.ingredients) {
            buildTreeArray(subRecipeObj.ingredients, level + 1, subMultiplier);
          }
        });
      };

      buildTreeArray(recipe.ingredients || [], 0, multiplier);

      if (recipe.packaging_materials && recipe.packaging_materials.length > 0) {
        aoaData.push([""]);
        aoaData.push(["📦 مواد التعبئة والتغليف", "⚖️ الكمية", "📏 الوحدة", "📑 المستوى"]);
        recipe.packaging_materials.forEach((p: any) => {
          aoaData.push([
            p.name,
            Math.ceil(Number(p.perUnitQty) * multiplier),
            p.unit,
            "تعبئة"
          ]);
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(aoaData);
      ws['!dir'] = 'rtl';
      ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[cellAddress]) continue;
          
          if (ws[cellAddress].v && String(ws[cellAddress].v).includes("📦")) {
            ws[cellAddress].s = {
              font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12, name: 'Arial' },
              fill: { fgColor: { rgb: "0F172A" } },
              alignment: { horizontal: "center", vertical: "center", wrapText: true },
              border: { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } }, left: { style: "thin", color: { rgb: "CBD5E1" } }, right: { style: "thin", color: { rgb: "CBD5E1" } } }
            };
          } else if (ws[cellAddress].v !== "") {
            ws[cellAddress].s = {
              font: { bold: true, color: { rgb: "334155" }, sz: 11, name: 'Arial' },
              alignment: { horizontal: C === 0 ? "right" : "center", vertical: "center", wrapText: true },
              border: { top: { style: "thin", color: { rgb: "CBD5E1" } }, bottom: { style: "thin", color: { rgb: "CBD5E1" } }, left: { style: "thin", color: { rgb: "CBD5E1" } }, right: { style: "thin", color: { rgb: "CBD5E1" } } }
            };
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, ws, "أمر التشغيل");
      XLSX.writeFile(wb, `أمر_تشغيل_${recipe.name.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.xlsx`);
    } catch (err) { alert("حدث خطأ أثناء التصدير."); console.error(err); }
  };

  const totalCalculatedWidth = pdfSettings.colName + pdfSettings.colVersion + pdfSettings.colBatch + pdfSettings.colPiece + pdfSettings.colIngCount;

  if (!isMounted) return null;

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-colors duration-300 ease-in-out ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-[130px]'}`} dir="rtl">
        
        {/* 🌟 الخلفية المظلمة 🌟 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/50 dark:from-indigo-900/20 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-colors duration-300 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🟢 الهيدر الثابت والتنقل 🟢 */}
          <div className={`flex flex-col xl:flex-row justify-between items-center gap-6 mb-8 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] relative z-10 no-print transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-4 text-right w-full xl:w-auto shrink-0">
              <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 w-14 h-14 rounded-[1.3rem] text-white shadow-md dark:shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center shrink-0">
                <PieChart className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight">إدارة ووصفات المطبخ</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">النظام المتقدم لحساب وتوثيق المقادير (BOM & SOP)</p>
              </div>
            </div>

            <div className="w-full xl:w-auto overflow-hidden">
              <div className="bg-slate-50 dark:bg-[#050505] p-1.5 rounded-[1.25rem] flex items-center overflow-x-auto hide-scrollbar border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner w-full xl:w-max transition-colors duration-300">
                <div className="flex items-center gap-1 min-w-max">
                  
                  <button onClick={() => setMainTab('calculator')} className={`px-5 py-2.5 text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 whitespace-nowrap outline-none cursor-pointer active:scale-95 ${mainTab === 'calculator' ? 'bg-white dark:bg-[#121214] text-indigo-600 dark:text-indigo-400 shadow-sm dark:shadow-md border border-slate-200 dark:border-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <Calculator className="w-[18px] h-[18px]" /> هندسة الوصفات
                  </button>

                  <button onClick={() => setMainTab('archive_items')} className={`px-5 py-2.5 text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 whitespace-nowrap outline-none cursor-pointer active:scale-95 ${mainTab === 'archive_items' ? 'bg-white dark:bg-[#121214] text-emerald-600 dark:text-emerald-400 shadow-sm dark:shadow-md border border-slate-200 dark:border-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <PackageOpen className="w-[18px] h-[18px]" /> أرشيف الأصناف
                  </button>

                  <button onClick={() => setMainTab('archive_free')} className={`px-5 py-2.5 text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 whitespace-nowrap outline-none cursor-pointer active:scale-95 ${mainTab === 'archive_free' ? 'bg-white dark:bg-[#121214] text-violet-600 dark:text-violet-400 shadow-sm dark:shadow-md border border-slate-200 dark:border-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <Blocks className="w-[18px] h-[18px]" /> أرشيف الوصفات الحرة
                  </button>

                  <button onClick={() => setMainTab('raw_materials')} className={`px-5 py-2.5 text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 whitespace-nowrap outline-none cursor-pointer active:scale-95 ${mainTab === 'raw_materials' ? 'bg-white dark:bg-[#121214] text-rose-600 dark:text-rose-400 shadow-sm dark:shadow-md border border-slate-200 dark:border-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <Leaf className="w-[18px] h-[18px]" /> المواد الخام
                  </button>

                  <button onClick={() => setMainTab('packaging_materials')} className={`px-5 py-2.5 text-[13px] font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 whitespace-nowrap outline-none cursor-pointer active:scale-95 ${mainTab === 'packaging_materials' ? 'bg-white dark:bg-[#121214] text-amber-600 dark:text-amber-400 shadow-sm dark:shadow-md border border-slate-200 dark:border-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <Box className="w-[18px] h-[18px]" /> مواد التعبئة
                  </button>

                  <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1"></div>
                  
                  <button onClick={() => setIsZenMode(true)} className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors outline-none cursor-pointer active:scale-95" title="وضع التركيز">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {mainTab === 'raw_materials' && (
            <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] min-h-[500px] animate-in fade-in zoom-in-95 duration-300 transition-colors">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 rounded-2xl shadow-sm dark:shadow-inner"><Leaf className="w-7 h-7" /></div>
                  <div><h3 className="text-[22px] font-black text-slate-900 dark:text-white">إدارة المواد الخام المركزية</h3><p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-1">قاعدة بيانات المواد الأولية لتجنب التكرار والأخطاء الإملائية</p></div>
                </div>
                <div className="relative w-full md:w-72 ml-2">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input type="text" placeholder="ابحث عن مادة خام..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 pr-11 py-3.5 rounded-xl focus:outline-none focus:border-rose-400 dark:focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/10 text-[13px] shadow-sm dark:shadow-inner transition-all" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 p-5 rounded-[1.5rem] flex flex-col sm:flex-row items-center gap-4 mb-8 shadow-sm dark:shadow-inner transition-colors duration-300">
                <div className="relative w-full flex-1">
                  <Leaf className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="اكتب اسم المادة الخام الجديدة هنا (مثال: طحين صفر, زيت ذرة)..." 
                    value={newRawName} 
                    onChange={(e) => setNewRawName(e.target.value)} 
                    className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-bold px-4 pr-12 py-3.5 rounded-xl focus:outline-none focus:border-rose-400 dark:focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/10 transition-all shadow-sm"
                  />
                </div>
                <button 
                  onClick={handleAddRawMaterial} 
                  disabled={isAddingRaw || !newRawName.trim()}
                  className="w-full sm:w-auto px-8 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-[14px] transition-all shadow-md dark:shadow-[0_0_15px_rgba(225,29,72,0.4)] flex items-center justify-center gap-2 disabled:opacity-50 outline-none cursor-pointer active:scale-95"
                >
                  {isAddingRaw ? <Loader2 className="w-5 h-5 animate-spin"/> : <Plus className="w-5 h-5"/>} إضافة المادة
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {filteredRawMaterials.map((rm, idx) => (
                  <div key={rm.id} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 p-3 md:p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-100 dark:hover:bg-white/5 transition-all group">
                    
                    {editingRawId === rm.id ? (
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-500 font-black shrink-0 shadow-sm dark:shadow-inner">
                          <span dir="ltr">{idx + 1}</span>
                        </div>
                        <input 
                          type="text" 
                          autoFocus
                          value={editRawName} 
                          onChange={(e) => setEditRawName(e.target.value)} 
                          className="flex-1 bg-white dark:bg-[#121214] border border-rose-300 dark:border-rose-500/50 text-slate-800 dark:text-white font-bold px-4 py-2.5 rounded-xl focus:outline-none shadow-sm dark:shadow-inner transition-all"
                        />
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleUpdateRawMaterial(rm.id)} className="p-2.5 bg-rose-600 text-white hover:bg-rose-500 rounded-xl transition-colors shadow-md outline-none cursor-pointer active:scale-95"><CheckCircle2 className="w-5 h-5"/></button>
                          <button onClick={() => setEditingRawId(null)} className="p-2.5 bg-white dark:bg-[#121214] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors outline-none cursor-pointer active:scale-95"><X className="w-5 h-5"/></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-[15px] flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 font-black shrink-0 shadow-sm dark:shadow-inner">
                            <span dir="ltr">{idx + 1}</span>
                          </div> 
                          {rm.name}
                        </span>
                        <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingRawId(rm.id); setEditRawName(rm.name); }} className="p-2.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors outline-none cursor-pointer active:scale-95"><Edit className="w-4 h-4"/></button>
                          <button onClick={() => handleDeleteRawMaterial(rm.id, rm.name)} className="p-2.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors outline-none cursor-pointer active:scale-95"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    )}
                    
                  </div>
                ))}
                {filteredRawMaterials.length === 0 && (
                   <div className="text-center py-10 text-slate-500 font-bold text-[14px] bg-slate-50 dark:bg-[#050505] rounded-2xl border border-dashed border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">لا توجد مواد خام محفوظة بهذا الاسم.</div>
                )}
              </div>
            </div>
          )}

          {mainTab === 'packaging_materials' && (
            <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] min-h-[500px] animate-in fade-in zoom-in-95 duration-300 transition-colors">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 rounded-2xl shadow-sm dark:shadow-inner"><Box className="w-7 h-7" /></div>
                  <div><h3 className="text-[22px] font-black text-slate-900 dark:text-white">إدارة مواد التعبئة والتغليف</h3><p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-1">قاعدة بيانات مركزية للعلب، الأكياس، والليبلات</p></div>
                </div>
                <div className="relative w-full md:w-72 ml-2">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input type="text" placeholder="ابحث عن مادة تعبئة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 pr-11 py-3.5 rounded-xl focus:outline-none focus:border-amber-400 dark:focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10 text-[13px] shadow-sm dark:shadow-inner transition-all" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 p-5 rounded-[1.5rem] flex flex-col sm:flex-row items-center gap-4 mb-8 shadow-sm dark:shadow-inner transition-colors duration-300">
                <div className="relative w-full flex-1">
                  <Box className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="اكتب اسم العبوة الجديدة هنا (مثال: كيس ورقي كبير, علبة بلاستيك صوص)..." 
                    value={newPackName} 
                    onChange={(e) => setNewPackName(e.target.value)} 
                    className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-bold px-4 pr-12 py-3.5 rounded-xl focus:outline-none focus:border-amber-400 dark:focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
                  />
                </div>
                <button 
                  onClick={handleAddPackMaterial} 
                  disabled={isAddingPack || !newPackName.trim()}
                  className="w-full sm:w-auto px-8 py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-[14px] transition-all shadow-md dark:shadow-[0_0_15px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 disabled:opacity-50 outline-none cursor-pointer active:scale-95"
                >
                  {isAddingPack ? <Loader2 className="w-5 h-5 animate-spin"/> : <Plus className="w-5 h-5"/>} إضافة المادة
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {filteredPackMaterials.map((pm, idx) => (
                  <div key={pm.id} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 p-3 md:p-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-100 dark:hover:bg-white/5 transition-all group">
                    
                    {editingPackId === pm.id ? (
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-500 font-black shrink-0 shadow-sm dark:shadow-inner">
                          <span dir="ltr">{idx + 1}</span>
                        </div>
                        <input 
                          type="text" 
                          autoFocus
                          value={editPackName} 
                          onChange={(e) => setEditPackName(e.target.value)} 
                          className="flex-1 bg-white dark:bg-[#121214] border border-amber-300 dark:border-amber-500/50 text-slate-800 dark:text-white font-bold px-4 py-2.5 rounded-xl focus:outline-none shadow-sm dark:shadow-inner transition-all"
                        />
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleUpdatePackMaterial(pm.id)} className="p-2.5 bg-amber-600 text-white hover:bg-amber-500 rounded-xl transition-colors shadow-md outline-none cursor-pointer active:scale-95"><CheckCircle2 className="w-5 h-5"/></button>
                          <button onClick={() => setEditingPackId(null)} className="p-2.5 bg-white dark:bg-[#121214] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors outline-none cursor-pointer active:scale-95"><X className="w-5 h-5"/></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-[15px] flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-500 font-black shrink-0 shadow-sm dark:shadow-inner">
                            <span dir="ltr">{idx + 1}</span>
                          </div> 
                          {pm.name}
                        </span>
                        <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingPackId(pm.id); setEditPackName(pm.name); }} className="p-2.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors outline-none cursor-pointer active:scale-95"><Edit className="w-4 h-4"/></button>
                          <button onClick={() => handleDeletePackMaterial(pm.id, pm.name)} className="p-2.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors outline-none cursor-pointer active:scale-95"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    )}
                    
                  </div>
                ))}
                {filteredPackMaterials.length === 0 && (
                   <div className="text-center py-10 text-slate-500 font-bold text-[14px] bg-slate-50 dark:bg-[#050505] rounded-2xl border border-dashed border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">لا توجد مواد تعبئة محفوظة بهذا الاسم.</div>
                )}
              </div>
            </div>
          )}

          {mainTab === 'calculator' && (
            <>
              <div className="relative">
                {saveSuccess && (
                  <div className="absolute -top-4 right-1/2 translate-x-1/2 bg-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-black shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-in slide-in-from-top-4 flex items-center gap-2 z-50">
                    <CheckCircle2 className="w-4 h-4"/> تم الحفظ بنجاح!
                  </div>
                )}
                
                <div className={`flex flex-wrap justify-end gap-3 mb-6 p-4 rounded-[2rem] border shadow-sm items-center transition-colors duration-300 ${editingRecipeId ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/30' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10'}`}>
                  {editingRecipeId ? (
                    <>
                      <div className="flex-1 text-right flex items-center gap-2 px-2 hidden sm:flex">
                        <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.6)]"></span>
                        <span className="text-[13px] font-black text-slate-500 dark:text-slate-400">وضع التعديل لـ: <span className="text-slate-900 dark:text-white">{resolvedRecipeName}</span></span>
                      </div>
                      <button onClick={() => handleSaveRecipe('overwrite')} disabled={isSaving} className="w-full sm:w-auto px-6 py-3.5 bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl font-black text-[13px] transition-all flex justify-center items-center gap-2 shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 
                        <span dir="ltr">تحديث نفس النسخة (V{originalRecipeVersion})</span>
                      </button>
                      <button onClick={() => handleSaveRecipe('new_version')} disabled={isSaving} className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)] rounded-xl font-black text-[13px] transition-all flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>} 
                        <span dir="ltr">حفظ كإصدار جديد (V{originalRecipeVersion + 1})</span>
                      </button>
                      <button onClick={handleCancelEdit} disabled={isSaving} className="w-full sm:w-auto px-5 py-3.5 bg-slate-50 dark:bg-[#050505] hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 text-rose-600 dark:text-rose-500 rounded-xl border border-slate-200 dark:border-white/10 font-black text-[13px] transition-all flex justify-center items-center gap-2 outline-none cursor-pointer active:scale-95">
                        <X className="w-4 h-4"/> إلغاء التعديل
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleSaveRecipe('new_recipe')} disabled={isSaving} className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-md dark:shadow-[0_0_20px_rgba(16,185,129,0.4)] rounded-2xl font-black text-[14px] transition-all flex justify-center items-center gap-2 outline-none active:scale-95 cursor-pointer">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} حفظ الوصفة الجديدة
                      </button>
                      <button onClick={handleCancelEdit} disabled={isSaving} className="w-full sm:w-auto px-5 py-4 bg-slate-50 dark:bg-[#050505] hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-200 dark:hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-400 text-slate-500 border border-slate-200 dark:border-white/10 rounded-2xl font-black text-[13px] transition-all flex justify-center items-center gap-2 outline-none shadow-sm dark:shadow-inner cursor-pointer active:scale-95">
                        <Trash2 className="w-4 h-4"/> إفراغ الحقول
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                <div className="lg:col-span-8 flex flex-col gap-6">
                  
                  <div className={`backdrop-blur-xl p-8 rounded-[2.5rem] shadow-sm dark:shadow-xl relative overflow-hidden transition-colors duration-300 border ${editingRecipeId ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-500/20' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/5'}`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] pointer-events-none transition-colors ${editingRecipeId ? 'bg-indigo-100 dark:bg-indigo-500/10' : 'bg-slate-50 dark:bg-white/5'}`}></div>
                    
                    <div className="flex items-center gap-3 mb-8 relative z-10">
                      <div className={`p-2.5 rounded-xl transition-colors shadow-sm dark:shadow-inner ${editingRecipeId ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30' : 'bg-slate-50 dark:bg-[#050505] text-indigo-600 dark:text-indigo-500 border border-slate-200 dark:border-white/10'}`}><Beaker className="w-6 h-6" /></div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">البيانات الأساسية للوصفة</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 relative z-10">
                      <div onClick={() => setRecipeSource('db')} className={`cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 flex items-center gap-4 active:scale-95 ${recipeSource === 'db' ? 'border-indigo-300 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-500/10 shadow-sm dark:shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050505] hover:border-slate-300 dark:hover:border-white/20'}`}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-sm dark:shadow-inner ${recipeSource === 'db' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 text-slate-500'}`}><LinkIcon className="w-5 h-5"/></div>
                        <div><h4 className={`font-black text-[14px] ${recipeSource === 'db' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>ربط بصنف متوفر</h4><p className="text-[11px] font-bold text-slate-500 mt-1">منتج نهائي (له وكالة وقسم)</p></div>
                      </div>
                      <div onClick={() => setRecipeSource('custom')} className={`cursor-pointer p-4 rounded-[1.5rem] border transition-all duration-300 flex items-center gap-4 active:scale-95 ${recipeSource === 'custom' ? 'border-violet-300 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-500/10 shadow-sm dark:shadow-[0_0_15px_rgba(139,92,246,0.2)]' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050505] hover:border-slate-300 dark:hover:border-white/20'}`}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-sm dark:shadow-inner ${recipeSource === 'custom' ? 'bg-violet-600 text-white' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 text-slate-500'}`}><Edit3 className="w-5 h-5"/></div>
                        <div><h4 className={`font-black text-[14px] ${recipeSource === 'custom' ? 'text-violet-600 dark:text-violet-400' : 'text-slate-700 dark:text-slate-300'}`}>تأسيس وصفة حرة</h4><p className="text-[11px] font-bold text-slate-500 mt-1">منتج وسيط أو خلطة خاصة بك</p></div>
                      </div>
                    </div>

                    <div className="mb-8 relative z-10">
                      {recipeSource === 'db' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50 dark:bg-[#050505] p-6 rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">
                          <div>
                            <label className={`block text-[12px] font-black uppercase tracking-wider mb-2 transition-colors ${selectedAgency ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>تحديد الوكالة</label>
                            <select 
                              value={selectedAgency} 
                              onChange={(e) => { 
                                setSelectedAgency(e.target.value); 
                                setSelectedCategory(''); 
                                setSelectedItem(''); 
                              }} 
                              className={`w-full font-bold px-4 py-3.5 rounded-2xl outline-none transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none ${selectedAgency ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/50 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:border-indigo-300 dark:hover:border-indigo-500/30'}`}
                            >
                              <option value="" className="bg-white dark:bg-[#121214]">اختر الوكالة...</option>
                              {dbAgencies.map(ag => <option key={ag.id} value={ag.id} className="bg-white dark:bg-[#121214]">{ag.name}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className={`block text-[12px] font-black uppercase tracking-wider mb-2 transition-colors ${selectedCategory ? 'text-violet-600 dark:text-violet-400' : 'text-slate-500'}`}>تحديد القسم</label>
                            <select 
                              value={selectedCategory} 
                              onChange={(e) => { 
                                setSelectedCategory(e.target.value); 
                                setSelectedItem(''); 
                              }} 
                              disabled={!selectedAgency} 
                              className={`w-full font-bold px-4 py-3.5 rounded-2xl outline-none transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none disabled:opacity-50 ${selectedCategory ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-500/50 text-violet-700 dark:text-violet-300' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:border-violet-300 dark:hover:border-violet-500/30'}`}
                            >
                              <option value="" className="bg-white dark:bg-[#121214]">{selectedAgency ? 'اختر القسم...' : 'اختر الوكالة أولاً'}</option>
                              {dbCategories
                                .filter(cat => !cat.agency_id || String(cat.agency_id) === 'null' || String(cat.agency_id) === String(selectedAgency))
                                .map(category => (
                                  <option key={category.id} value={category.id} className="bg-white dark:bg-[#121214]">{category.name}</option>
                                ))
                              }
                            </select>
                          </div>

                          <div>
                            <label className={`block text-[12px] font-black uppercase tracking-wider mb-2 transition-colors ${selectedItem ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>تحديد الصنف</label>
                            <select 
                              value={selectedItem} 
                              onChange={(e) => setSelectedItem(e.target.value)} 
                              disabled={!selectedCategory} 
                              className={`w-full font-bold px-4 py-3.5 rounded-2xl outline-none transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none disabled:opacity-50 ${selectedItem ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white hover:border-emerald-300 dark:hover:border-emerald-500/30'}`}
                            >
                              <option value="" className="bg-white dark:bg-[#121214]">{selectedCategory ? 'اختر الصنف...' : 'اختر القسم أولاً'}</option>
                              {dbItemsList
                                .filter(i => String(i.agency_id) === String(selectedAgency) && String(i.category_id) === String(selectedCategory))
                                .map(item => <option key={item.id} value={item.id} className="bg-white dark:bg-[#121214]">{item.name}</option>)
                              }
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 dark:bg-[#050505] p-6 rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">
                          <label className={`block text-[12px] font-black uppercase tracking-wider mb-2 transition-colors ${customName ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-slate-500'}`}>اسم الوصفة الحرة المخصصة</label>
                          <input 
                            type="text" 
                            value={customName} 
                            onChange={(e) => setCustomName(e.target.value)} 
                            placeholder="مثال: نشا مطبوخ، خلطة بهارات سرية..." 
                            className={`w-full font-black text-[15px] px-5 py-4 rounded-2xl outline-none transition-all shadow-sm dark:shadow-inner placeholder-slate-400 dark:placeholder-slate-600 ${customName ? 'bg-fuchsia-50 dark:bg-fuchsia-900/10 border border-fuchsia-200 dark:border-fuchsia-500/50 text-slate-900 dark:text-white' : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:border-fuchsia-400 dark:focus:border-fuchsia-500/50'}`} 
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#050505] p-6 rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner relative z-10 transition-colors duration-300">
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">الكمية الإجمالية للطبخة</label>
                        <div className="flex bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner focus-within:border-indigo-400 dark:focus-within:border-indigo-500/50 transition-all overflow-hidden">
                          <input type="number" dir="ltr" placeholder="مثال: 50" value={batchWeight} onChange={(e) => setBatchWeight(e.target.value ? Number(e.target.value) : '')} className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-black text-[15px] px-4 py-3.5 outline-none text-center" />
                          <div className="w-px bg-slate-200 dark:bg-white/10 my-2"></div>
                          <select value={batchUnit} onChange={(e) => setBatchUnit(e.target.value)} className="bg-white dark:bg-[#121214] text-slate-600 dark:text-slate-300 font-bold px-3 outline-none cursor-pointer"><option value="كغم">كغم</option><option value="لتر">لتر</option><option value="غرام">غرام</option><option value="مل">مل</option></select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">وزن القطعة / الحصة</label>
                        <div className="flex bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner focus-within:border-emerald-400 dark:focus-within:border-emerald-500/50 transition-all overflow-hidden">
                          <input type="number" dir="ltr" placeholder="مثال: 100" value={pieceWeight} onChange={(e) => setPieceWeight(e.target.value ? Number(e.target.value) : '')} className="w-full bg-transparent text-emerald-600 dark:text-emerald-400 placeholder-slate-400 dark:placeholder-slate-600 font-black text-[15px] px-4 py-3.5 outline-none text-center" />
                          <div className="w-px bg-slate-200 dark:bg-white/10 my-2"></div>
                          <select value={pieceUnit} onChange={(e) => setPieceUnit(e.target.value)} className="bg-white dark:bg-[#121214] text-slate-600 dark:text-slate-300 font-bold px-3 outline-none cursor-pointer"><option value="غرام">غرام</option><option value="مل">مل</option><option value="كغم">كغم</option><option value="لتر">لتر</option></select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">نسبة التبخر / الهدر</label>
                        <div className="relative bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner focus-within:border-rose-400 dark:focus-within:border-rose-500/50 transition-all overflow-hidden">
                          <input type="number" dir="ltr" placeholder="مثال: 5" value={wastePercent} onChange={(e) => setWastePercent(e.target.value ? Number(e.target.value) : '')} className="w-full bg-transparent text-rose-600 dark:text-rose-400 placeholder-slate-400 dark:placeholder-slate-600 font-black text-[15px] px-4 py-3.5 pr-10 outline-none text-center" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-black">%</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-colors duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/20 shadow-sm dark:shadow-inner rounded-xl"><Layers className="w-6 h-6" /></div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">المكونات وتصميم الشجرة (BOM)</h3>
                      </div>
                      <span className="text-xs font-bold bg-slate-50 dark:bg-[#050505] text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">
                        <span dir="ltr">{ingredients.length}</span> مقادير مدخلة
                      </span>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="hidden sm:flex items-center gap-4 px-4 pb-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        <div className="w-10 shrink-0 text-center">ت</div><div className="flex-[2.5] flex gap-2">المصدر واسم المادة</div><div className="flex-[1.5]">الكمية للطبخة الإجمالية</div><div className="w-12 shrink-0"></div>
                      </div>
                      
                      {ingredients.map((ing, index) => (
                        <div key={ing.id} className="bg-slate-50 dark:bg-[#0a0a0c] p-4 rounded-[1.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.2)] flex flex-col sm:flex-row items-center gap-4 group hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden">
                          <div className={`absolute right-0 top-0 bottom-0 w-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${ing.type === 'sub_recipe' ? 'bg-violet-500' : 'bg-indigo-500'}`}></div>
                          
                          <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-[#121214] rounded-xl text-slate-500 font-black text-sm shrink-0 shadow-sm dark:shadow-inner border border-slate-200 dark:border-white/5 transition-colors">
                            <span dir="ltr">{index + 1}</span>
                          </div>
                          
                          <div className="flex-[2.5] w-full flex flex-col sm:flex-row gap-3">
                            <select 
                              value={ing.type} 
                              onChange={(e) => {
                                const newType = e.target.value as 'raw' | 'sub_recipe';
                                setIngredients(prev => prev.map(item => item.id === ing.id ? { ...item, type: newType, sub_recipe_id: '', name: '' } : item));
                              }} 
                              className={`bg-white dark:bg-[#050505] border outline-none font-black px-4 py-3.5 rounded-xl transition-colors text-[13px] shadow-sm dark:shadow-inner appearance-none cursor-pointer ${ing.type === 'sub_recipe' ? 'text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/30 focus:border-violet-400 dark:focus:border-violet-500/70' : 'text-slate-800 dark:text-slate-300 border-slate-200 dark:border-white/10 focus:border-indigo-400 dark:focus:border-indigo-500/50'}`}
                            >
                              <option value="raw" className="bg-white dark:bg-[#121214]">مادة خام</option>
                              <option value="sub_recipe" className="bg-white dark:bg-[#121214]">وصفة حرة</option>
                            </select>
                            
                            {ing.type === 'sub_recipe' ? (
                              <select 
                                value={ing.sub_recipe_id || ''} 
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  const subRecipe = savedRecipes.find(r => String(r.id) === String(selectedId));
                                  setIngredients(prev => prev.map(item => item.id === ing.id ? { 
                                    ...item, 
                                    sub_recipe_id: selectedId, 
                                    name: subRecipe ? subRecipe.name : '', 
                                    unit: subRecipe ? subRecipe.piece_unit : item.unit 
                                  } : item));
                                }} 
                                className="flex-1 bg-white dark:bg-[#121214] border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 font-black px-4 py-3.5 rounded-xl outline-none focus:border-violet-400 dark:focus:border-violet-500/70 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                              >
                                <option value="" className="bg-white dark:bg-[#050505]">اختر الوصفة الحرة...</option>
                                {savedRecipes
                                  .filter(r => r.item_id === null || r.item_id === undefined)
                                  .map(r => <option key={r.id} value={r.id} className="bg-white dark:bg-[#050505]">{r.name} (V{r.version || 1})</option>)
                                }
                              </select>
                            ) : (
                              <select 
                                value={ing.name} 
                                onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)} 
                                className="flex-1 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 py-3.5 rounded-xl outline-none focus:border-indigo-400 dark:focus:border-indigo-500/50 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                              >
                                <option value="" className="bg-white dark:bg-[#050505]">اختر المادة الخام من القائمة...</option>
                                {dbRawMaterials.map(rm => (
                                  <option key={rm.id} value={rm.name} className="bg-white dark:bg-[#050505]">{rm.name}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          <div className="flex-[1.5] w-full flex bg-white dark:bg-[#050505] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner focus-within:border-indigo-400 dark:focus-within:border-indigo-500/50 transition-all overflow-hidden">
                            <input type="number" dir="ltr" placeholder="الكمية" value={ing.quantity} onChange={(e) => updateIngredient(ing.id, 'quantity', e.target.value ? Number(e.target.value) : '')} className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-black px-4 py-3.5 text-center outline-none" />
                            <div className="w-px bg-slate-200 dark:bg-white/10 my-2"></div>
                            <select value={ing.unit} onChange={(e) => updateIngredient(ing.id, 'unit', e.target.value)} className="bg-white dark:bg-[#121214] text-slate-600 dark:text-slate-300 font-bold px-3 outline-none cursor-pointer transition-colors">
                              <option value="كغم">كغم</option><option value="غرام">غرام</option><option value="لتر">لتر</option><option value="مل">مل</option><option value="قطعة">قطعة</option>
                            </select>
                          </div>
                          
                          <button onClick={() => removeIngredient(ing.id)} className="w-12 h-12 flex items-center justify-center text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all shrink-0 outline-none border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 cursor-pointer active:scale-95"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      ))}
                    </div>
                    
                    <button onClick={addIngredient} className="mt-5 w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 py-4 rounded-[1.5rem] font-black text-[14px] transition-all outline-none cursor-pointer active:scale-95"><Plus className="w-5 h-5" /> إضافة مكون جديد للخلطة</button>
                  </div>

                  <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-colors duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner rounded-xl"><PackageOpen className="w-6 h-6" /></div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">مواد التعبئة والتغليف</h3>
                      </div>
                      <span className="text-xs font-bold bg-slate-50 dark:bg-[#050505] text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300">
                        <span dir="ltr">{packaging.length}</span> مواد
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="hidden sm:flex items-center gap-4 px-4 pb-2 text-[11px] font-black text-slate-500 uppercase tracking-wider"><div className="w-10 shrink-0 text-center">ت</div><div className="flex-[2.5]">نوع العبوة / الليبل</div><div className="flex-[1.5]">العدد للطبخة كاملة</div><div className="w-12 shrink-0"></div></div>
                      {packaging.map((p, index) => (
                        <div key={p.id} className="bg-slate-50 dark:bg-[#0a0a0c] p-4 rounded-[1.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.2)] flex flex-col sm:flex-row items-center gap-4 group hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-md dark:hover:shadow-emerald-500/10 transition-all duration-300 relative overflow-hidden">
                          <div className="absolute right-0 top-0 bottom-0 w-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-500"></div>
                          <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-[#121214] rounded-xl text-slate-500 font-black text-sm shrink-0 shadow-sm dark:shadow-inner border border-slate-200 dark:border-white/5 transition-colors">
                            <span dir="ltr">{index + 1}</span>
                          </div>
                          
                          <select 
                            value={p.name} 
                            onChange={(e) => updatePackaging(p.id, 'name', e.target.value)} 
                            className="flex-[2.5] w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-4 py-3.5 rounded-xl outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none"
                          >
                            <option value="" className="bg-white dark:bg-[#050505]">اختر مادة التعبئة والتغليف...</option>
                            {dbPackagingMaterials.map(pm => (
                              <option key={pm.id} value={pm.name} className="bg-white dark:bg-[#050505]">{pm.name}</option>
                            ))}
                          </select>
                          
                          <div className="flex-[1.5] w-full flex bg-white dark:bg-[#050505] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner focus-within:border-emerald-400 dark:focus-within:border-emerald-500/50 transition-all overflow-hidden">
                            <input type="number" dir="ltr" placeholder="العدد" value={p.quantity} onChange={(e) => updatePackaging(p.id, 'quantity', e.target.value ? Number(e.target.value) : '')} className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-black px-4 py-3.5 text-center outline-none" />
                            <div className="w-px bg-slate-200 dark:bg-white/10 my-2"></div>
                            <select value={p.unit} onChange={(e) => updatePackaging(p.id, 'unit', e.target.value)} className="bg-white dark:bg-[#121214] text-slate-600 dark:text-slate-300 font-bold px-3 outline-none cursor-pointer transition-colors"><option value="قطعة">قطعة</option><option value="رول">رول</option><option value="كارتون">كارتون</option></select>
                          </div>
                          <button onClick={() => removePackaging(p.id)} className="w-12 h-12 flex items-center justify-center text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all shrink-0 outline-none border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 cursor-pointer active:scale-95"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={addPackaging} className="mt-5 w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 py-4 rounded-[1.5rem] font-black text-[14px] transition-all outline-none cursor-pointer active:scale-95"><Plus className="w-5 h-5" /> إضافة مادة تعبئة أو غلاف</button>
                  </div>

                  <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 shadow-sm dark:shadow-inner rounded-xl"><CalendarClock className="w-6 h-6" /></div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">بروتوكول التخزين (SOP)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[12px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><ThermometerSnowflake className="w-4 h-4"/> طريقة الحفظ المعتمدة</label>
                        <select value={storageMethod} onChange={(e) => setStorageMethod(e.target.value)} className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold px-5 py-4 rounded-2xl outline-none focus:border-amber-400 dark:focus:border-amber-500/50 transition-all shadow-sm dark:shadow-inner cursor-pointer appearance-none">
                          <option value="تبريد (ثلاجة)" className="bg-white dark:bg-[#121214]">تبريد (ثلاجة)</option>
                          <option value="تجميد (فريزر)" className="bg-white dark:bg-[#121214]">تجميد (فريزر)</option>
                          <option value="درجة حرارة الغرفة" className="bg-white dark:bg-[#121214]">درجة حرارة الغرفة</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[12px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Target className="w-4 h-4"/> مدة الصلاحية القياسية</label>
                        <input type="text" placeholder="مثال: 3 أيام، أو شهر واحد" value={shelfLife} onChange={(e) => setShelfLife(e.target.value)} className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-bold px-5 py-4 rounded-2xl outline-none focus:border-amber-400 dark:focus:border-amber-500/50 transition-all shadow-sm dark:shadow-inner text-right" />
                      </div>
                    </div>
                  </div>

                </div>

                <div className="lg:col-span-4 flex flex-col gap-6 sticky top-8">
                  <div className="bg-slate-50 dark:bg-[#0a0a0c] rounded-[2.5rem] shadow-lg dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative border border-slate-200 dark:border-white/5 flex flex-col h-[calc(100vh-100px)] max-h-[850px] overflow-hidden transition-colors duration-300">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500"></div>
                    
                    <div className="p-8 pb-4 z-10 shrink-0">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-md dark:shadow-[0_0_20px_rgba(16,185,129,0.4)]"><Share2 className="w-7 h-7 text-white" /></div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-wide">التحليل المعماري</h3>
                          <p className="text-[12px] font-bold text-slate-500 mt-1">شجرة المواد والتكاليف (BOM)</p>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-2xl p-5 flex items-center justify-between shadow-sm dark:shadow-inner transition-colors duration-300">
                        <div>
                          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">المنتج النهائي</p>
                          <p className="text-xl font-black text-slate-900 dark:text-white">{resolvedRecipeName || 'بانتظار التحديد...'}</p>
                        </div>
                        <Focus className="w-8 h-8 text-slate-300 dark:text-slate-700 opacity-50" />
                      </div>
                    </div>

                    <div className="px-8 py-2 shrink-0 z-10">
                      <div className="bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/5 rounded-[1.5rem] p-6 shadow-sm dark:shadow-inner relative overflow-hidden flex flex-col gap-1 transition-colors duration-300">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-slate-500 text-[11px] font-black uppercase tracking-widest">وزن القطعة (الصافي)</span>
                        <div className="text-left flex items-baseline gap-1.5 mt-1">
                          <span dir="ltr" className="text-[40px] font-black text-emerald-600 dark:text-emerald-400 tracking-tighter leading-none drop-shadow-sm dark:drop-shadow-md">
                            {pieceWeight ? (Number(pieceWeight) * (1 + (Number(wastePercent)/100))).toFixed(2) : 0}
                          </span>
                          <span className="text-sm font-bold text-emerald-600/70 dark:text-emerald-500/70">{pieceUnit}</span>
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold mt-2 bg-slate-50 dark:bg-[#121214] px-2 py-1 rounded border border-slate-200 dark:border-white/5 w-max shadow-sm dark:shadow-inner transition-colors">
                          يتضمن <span dir="ltr">{wastePercent}</span>% نسبة هدر
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-island-scroll mt-4 px-8 pb-8 relative z-10">
                      <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 sticky top-0 bg-slate-50/90 dark:bg-[#0a0a0c]/90 backdrop-blur-md py-3 z-20 transition-colors duration-300">الهيكل الداخلي (Tree View)</h4>
                      <div className="space-y-4">
                        {standardizedRecipe.map((ing, i) => (
                          <RecursiveIngredientRow key={i} ing={ing} multiplier={1} />
                        ))}
                      </div>

                      {standardizedPackaging.length > 0 && (
                        <div className="mt-8 border-t border-slate-200 dark:border-white/10 pt-6 transition-colors">
                          <h4 className="text-[11px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-4">مواد التغليف المعتمدة</h4>
                          <div className="space-y-3">
                            {standardizedPackaging.map((p, i) => (
                              <div key={i} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-sm dark:shadow-inner transition-colors duration-300">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/5 flex items-center justify-center text-xs font-black text-slate-500 shadow-sm dark:shadow-inner transition-colors">
                                    <span dir="ltr">{i + 1}</span>
                                  </div>
                                  <p className="text-[14px] font-bold text-slate-800 dark:text-slate-200">{p.name || <span className="text-slate-400 dark:text-slate-600 italic">مادة بدون اسم</span>}</p>
                                </div>
                                <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 px-4 py-2 rounded-xl text-center min-w-[90px] shadow-sm dark:shadow-inner transition-colors">
                                  <span dir="ltr" className="block text-[17px] font-black text-sky-600 dark:text-sky-400 leading-none">
                                    {new Intl.NumberFormat('en-US', { numberingSystem: 'latn', useGrouping: true }).format(Math.ceil(Number(p.perUnitQty)))}
                                  </span>
                                  <span className="block text-[10px] font-bold text-sky-600/70 dark:text-sky-500/70 mt-1 uppercase">{p.unit}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {(!batchWeight || !pieceWeight) && (
                        <div className="text-center py-16 opacity-40">
                          <Share2 className="w-12 h-12 mx-auto text-slate-500 dark:text-slate-600 mb-4" />
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-500">أدخل الأوزان ليتم بناء وهندسة الشجرة تلقائياً.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}

          {mainTab === 'archive_items' && (
            <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] min-h-[500px] transition-colors duration-300">
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl shadow-sm dark:shadow-inner"><PackageOpen className="w-7 h-7" /></div>
                  <div><h3 className="text-[22px] font-black text-slate-900 dark:text-white">أرشيف الأصناف النهائية</h3><p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-1">منتجات مقسمة حسب الوكالات والأقسام</p></div>
                </div>

                {/* 💡 أزرار التبديل بين الـ List و Grid 💡 */}
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#050505] p-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner">
                  <button 
                    onClick={() => setViewMode('list')} 
                    className={`p-2 rounded-lg transition-all outline-none ${viewMode === 'list' ? 'bg-white dark:bg-[#121214] text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    title="عرض كقائمة"
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('grid')} 
                    className={`p-2 rounded-lg transition-all outline-none ${viewMode === 'grid' ? 'bg-white dark:bg-[#121214] text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    title="عرض كشبكة"
                  >
                    <Grid2X2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 🟢 شريط أدوات التحكم والأرشيف (Toolbar) 🟢 */}
              <div className={`bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 p-2 md:p-3 rounded-[1.5rem] mb-8 flex flex-col-reverse xl:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-lg w-full relative z-10 transition-all duration-500`}>
                  <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                      <button onClick={() => setShowPdfSettings(!showPdfSettings)} className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none border cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-slate-200 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/50' : 'bg-transparent text-slate-500 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                        <Settings className={`w-4 h-4 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} /> إعدادات PDF
                      </button>
                      <button onClick={handleExportAllPDF} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none cursor-pointer active:scale-95">
                        <Printer className="w-4 h-4" /> طباعة الدليل
                      </button>
                      <button onClick={handleExportAllExcel} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none cursor-pointer active:scale-95">
                        <Database className="w-4 h-4" /> تصدير قاعدة البيانات
                      </button>
                  </div>

                  <div className="relative w-full xl:w-auto flex-1 max-w-md">
                      <div className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden h-[46px] group hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-colors w-full shadow-sm dark:shadow-inner bg-white dark:bg-[#121214]">
                        <div className="bg-slate-50 dark:bg-[#050505] w-12 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0 transition-colors group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10">
                          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 dark:group-focus-within:text-emerald-400 transition-colors" />
                        </div>
                        <input type="text" placeholder="ابحث عن وصفة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent font-bold text-slate-900 dark:text-white px-4 outline-none text-[13px] placeholder-slate-400 dark:placeholder-slate-600" />
                      </div>
                  </div>
              </div>

              {/* 💡 لوحة تحكم الطباعة الشاملة (لجدول الأرشيف) 💡 */}
              {showPdfSettings && (
                <div className="bg-slate-50 dark:bg-[#050505] p-5 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative mb-8 transition-colors duration-300">
                  
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
                    <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><Settings className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/> إعدادات طباعة الأرشيف المتقدمة</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors bg-white dark:bg-[#121214] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-slate-500/50">
                      <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase">حجم الورق</label>
                      <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 cursor-pointer shadow-sm dark:shadow-inner appearance-none transition-colors">
                        <option value="A4" className="bg-white dark:bg-[#050505]">A4 (ورق قياسي)</option>
                        <option value="A3" className="bg-white dark:bg-[#050505]">A3 (أفضل للأعمدة الكثيرة)</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase">هوامش الورقة</label>
                      <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-emerald-400 dark:focus:border-emerald-500/50 cursor-pointer shadow-sm dark:shadow-inner appearance-none transition-colors">
                        <option value="0mm" className="bg-white dark:bg-[#050505]">بدون هوامش (0mm)</option>
                        <option value="2mm" className="bg-white dark:bg-[#050505]">ضيقة جداً (2mm)</option>
                        <option value="5mm" className="bg-white dark:bg-[#050505]">ضيقة (5mm)</option>
                        <option value="10mm" className="bg-white dark:bg-[#050505]">عادية (10mm)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-emerald-500/50 ${pdfSettings.autoFit ? 'bg-emerald-50 dark:bg-emerald-600 border-emerald-200 dark:border-emerald-500 text-emerald-700 dark:text-white shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                        <span className="bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/30 shadow-sm dark:shadow-inner" dir="ltr">{pdfSettings.shiftX} mm</span>
                      </div>
                      <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white dark:bg-[#121214] rounded-lg appearance-none cursor-pointer mt-1 border border-slate-200 dark:border-white/5" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <hr className="flex-1 border-slate-200 dark:border-white/5" />
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">إعدادات الأعمدة لجدول دليل الأرشيف</span>
                    <hr className="flex-1 border-slate-200 dark:border-white/5" />
                  </div>

                  <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    
                    <div className="flex flex-col gap-2 w-full col-span-2 md:col-span-3 lg:col-span-6 mb-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                        <span className="bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/30 shadow-sm dark:shadow-inner">{pdfSettings.zoom}%</span>
                      </div>
                      <input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-emerald-500 h-2 bg-white dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                    </div>

                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">اسم الصنف</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colName}%</span></div><input type="range" min="10" max="60" value={pdfSettings.colName} onChange={e => updatePdfSetting('colName', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الإصدار (V)</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colVersion}%</span></div><input type="range" min="5" max="25" value={pdfSettings.colVersion} onChange={e => updatePdfSetting('colVersion', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الطبخة (كلي)</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colBatch}%</span></div><input type="range" min="5" max="35" value={pdfSettings.colBatch} onChange={e => updatePdfSetting('colBatch', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">القطعة/النسبة</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colPiece}%</span></div><input type="range" min="5" max="35" value={pdfSettings.colPiece} onChange={e => updatePdfSetting('colPiece', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">عدد المكونات</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colIngCount}%</span></div><input type="range" min="5" max="30" value={pdfSettings.colIngCount} onChange={e => updatePdfSetting('colIngCount', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                  </div>

                  {!pdfSettings.autoFit && (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'} shadow-sm dark:shadow-inner`}>
                      <span>مجموع النسب للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{totalCalculatedWidth}%</span></span>
                      {totalCalculatedWidth > 100 ? (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (سيضغط المتصفح الجدول)</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول منسق)</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 🟢 فلاتر الوكالة والقسم 🟢 */}
              <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-4 rounded-[1.5rem] mb-8 flex flex-col gap-3 shadow-sm dark:shadow-inner transition-colors duration-300">
                <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-1">
                  <div className="flex items-center gap-1.5 shrink-0 ml-2 bg-slate-50 dark:bg-[#050505] px-3 py-2 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner"><Filter className="w-4 h-4 text-slate-400 dark:text-slate-500"/><span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">تصفية حسب الوكالة:</span></div>
                  <button onClick={() => { setFilterAgency('all'); setFilterCategory('all'); }} className={`shrink-0 px-5 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${filterAgency === 'all' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-500' : 'bg-transparent text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                    الكل <span dir="ltr" className={`px-2 py-0.5 rounded-md text-[10px] shadow-inner border ${filterAgency === 'all' ? 'bg-black/20 border-transparent' : 'bg-white dark:bg-[#050505] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-500'}`}>{agencyCounts['all'] || 0}</span>
                  </button>
                  {sortedAgenciesForFilter.map(agId => (
                    <button key={agId} onClick={() => { setFilterAgency(agId); setFilterCategory('all'); }} className={`shrink-0 px-5 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${filterAgency === agId ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-500' : 'bg-transparent text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                      {agId === 'عام' ? 'أصناف عامة' : agMap[agId]} <span dir="ltr" className={`px-2 py-0.5 rounded-md text-[10px] shadow-inner border ${filterAgency === agId ? 'bg-black/20 border-transparent' : 'bg-white dark:bg-[#050505] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-500'}`}>{agencyCounts[agId]}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pt-1">
                  <div className="flex items-center gap-1.5 shrink-0 ml-2 bg-slate-50 dark:bg-[#050505] px-3 py-2 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner"><Layers className="w-4 h-4 text-slate-400 dark:text-slate-500"/><span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">تصفية حسب القسم:</span></div>
                  <button onClick={() => setFilterCategory('all')} className={`shrink-0 px-5 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${filterCategory === 'all' ? 'bg-violet-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(139,92,246,0.4)] border border-violet-500' : 'bg-transparent text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/30 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                    جميع الأقسام <span dir="ltr" className={`px-2 py-0.5 rounded-md text-[10px] shadow-inner border ${filterCategory === 'all' ? 'bg-black/20 border-transparent' : 'bg-white dark:bg-[#050505] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-500'}`}>{categoryCounts['all'] || 0}</span>
                  </button>
                  {sortedCategoriesForFilter.map(catId => (
                    <button key={catId} onClick={() => setFilterCategory(catId)} className={`shrink-0 px-5 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${filterCategory === catId ? 'bg-violet-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(139,92,246,0.4)] border border-violet-500' : 'bg-transparent text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:border-violet-300 dark:hover:border-violet-500/30 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                      {catId === 'بدون_قسم' ? 'أصناف بدون قسم' : catMap[catId]} <span dir="ltr" className={`px-2 py-0.5 rounded-md text-[10px] shadow-inner border ${filterCategory === catId ? 'bg-black/20 border-transparent' : 'bg-white dark:bg-[#050505] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-500'}`}>{categoryCounts[catId]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingArchive ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="w-12 h-12 text-indigo-500 animate-spin" /><p className="text-slate-500 font-bold">جاري تحميل الأرشيف...</p></div>
              ) : finalFilteredArchive.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-[#121214] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300"><Search className="w-16 h-16 mx-auto mb-4 text-slate-400 dark:text-slate-600" /><p className="text-xl font-black text-slate-500 dark:text-slate-400 mb-2 tracking-tight">لا توجد أصناف مطابقة للفلتر أو البحث</p></div>
              ) : (
                <div className="flex flex-col gap-12">
                  {Object.keys(groupedArchive).sort((a, b) => {
                    if (a === 'عام') return 1; if (b === 'عام') return -1;
                    const indexA = dbAgencies.findIndex(ag => String(ag.id) === a);
                    const indexB = dbAgencies.findIndex(ag => String(ag.id) === b);
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                  }).map(agId => {
                    const categoriesObj = groupedArchive[agId];
                    return (
                      <div key={agId} className="bg-slate-50 dark:bg-[#121214]/50 rounded-[2.5rem] p-6 md:p-8 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner transition-colors duration-300">
                        <div className="flex items-center gap-3 mb-8 border-b border-slate-200 dark:border-white/10 pb-5">
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm dark:shadow-inner border border-indigo-200 dark:border-indigo-500/20"><Building2 className="w-6 h-6" /></div>
                          <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{agId === 'عام' ? 'أصناف عامة (بدون وكالة)' : (agMap[agId] || 'وكالة غير معروفة')}</h4>
                        </div>
                        
                        <div className="flex flex-col gap-10">
                          {Object.keys(categoriesObj).sort((a, b) => {
                            if (a === 'بدون_قسم') return 1; if (b === 'بدون_قسم') return -1;
                            const indexA = dbCategories.findIndex(c => String(c.id) === a);
                            const indexB = dbCategories.findIndex(c => String(c.id) === b);
                            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                          }).map(catId => {
                            const recipes = categoriesObj[catId];
                            return (
                              <div key={catId}>
                                <div className="flex items-center gap-2 mb-6 px-2">
                                  <Layers className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                                  <h5 className="text-[17px] font-black text-slate-800 dark:text-slate-200">{catId === 'بدون_قسم' ? 'أصناف بدون قسم' : (catMap[catId] || 'قسم غير معروف')}</h5>
                                  <span className="text-[11px] font-bold bg-white dark:bg-[#050505] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 mr-2 shadow-sm dark:shadow-inner transition-colors">
                                    <span dir="ltr">{recipes.length}</span> وصفة
                                  </span>
                                </div>
                                
                                {/* 💡 التبديل بين Grid و List 💡 */}
                                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" : "flex flex-col gap-3"}>
                                  {recipes.map((recipe) => (
                                    <div key={recipe.id} className={`bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all duration-300 group relative overflow-hidden ${viewMode === 'grid' ? 'rounded-3xl p-6 flex flex-col' : 'rounded-2xl p-4 md:p-5 flex flex-col xl:flex-row items-start xl:items-center gap-5'}`}>
                                      <div className={`absolute right-0 bg-gradient-to-b from-indigo-400 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity ${viewMode === 'grid' ? 'top-0 w-full h-1.5 bg-gradient-to-r' : 'top-0 w-1.5 h-full'}`}></div>
                                      
                                      <div className={`flex-1 w-full ${viewMode === 'grid' ? 'mb-6' : ''}`}>
                                        <div className="flex items-center gap-3">
                                          <h4 className="text-[17px] font-black text-slate-800 dark:text-slate-200 leading-tight">{recipe.name}</h4>
                                        </div>
                                        <div className="mt-2.5 inline-flex bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 items-center gap-1 shadow-sm dark:shadow-inner">
                                          <History className="w-3 h-3"/> V{recipe.version || 1}
                                        </div>
                                      </div>

                                      <div className={`flex items-center gap-4 shrink-0 bg-slate-50 dark:bg-[#050505] p-3 rounded-xl border border-slate-200 dark:border-white/5 justify-center shadow-sm dark:shadow-inner transition-colors ${viewMode === 'grid' ? 'w-full mb-6' : 'w-full xl:w-auto'}`}>
                                        <div className="text-center px-4">
                                          <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">الطبخة الإجمالية</span>
                                          <span dir="ltr" className="text-[15px] font-black text-slate-700 dark:text-slate-300">{recipe.batch_weight} <span className="text-[10px] text-slate-500">{recipe.batch_unit}</span></span>
                                        </div>
                                        <div className="w-px h-8 bg-slate-200 dark:bg-white/10"></div>
                                        <div className="text-center px-4">
                                          <span className="block text-[10px] font-black text-emerald-600 dark:text-emerald-500/70 uppercase tracking-wider mb-1">القطعة الواحدة</span>
                                          <span dir="ltr" className="text-[15px] font-black text-emerald-600 dark:text-emerald-400">{recipe.piece_weight} <span className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70">{recipe.piece_unit}</span></span>
                                        </div>
                                      </div>

                                      <div className={`flex items-center gap-2 shrink-0 ${viewMode === 'grid' ? 'w-full mt-auto' : 'w-full xl:w-auto mt-2 xl:mt-0'}`}>
                                        <button onClick={() => handleOpenModal(recipe)} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 px-5 py-3.5 rounded-xl font-black text-[12px] transition-all shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95">
                                          <Share2 className="w-4 h-4" /> الشجرة
                                        </button>
                                        <button onClick={() => handleLoadToCalculator(recipe)} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-5 py-3.5 rounded-xl font-black text-[12px] transition-all shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95">
                                          <Edit className="w-4 h-4" /> تعديل
                                        </button>
                                        <button onClick={() => handleDeleteRecipe(recipe.id, recipe.name)} className="p-3.5 text-slate-500 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all shrink-0 shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {mainTab === 'archive_free' && (
            <div className="bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] min-h-[500px] transition-colors duration-300">
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 rounded-2xl shadow-sm dark:shadow-inner"><Blocks className="w-7 h-7" /></div>
                  <div><h3 className="text-[22px] font-black text-slate-900 dark:text-white">أرشيف الوصفات الحرة</h3><p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-1">الخلطات والمنتجات الوسيطة المستقلة</p></div>
                </div>

                {/* 💡 أزرار التبديل بين الـ List و Grid 💡 */}
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#050505] p-1.5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner">
                  <button 
                    onClick={() => setViewMode('list')} 
                    className={`p-2 rounded-lg transition-all outline-none ${viewMode === 'list' ? 'bg-white dark:bg-[#121214] text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    title="عرض كقائمة"
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('grid')} 
                    className={`p-2 rounded-lg transition-all outline-none ${viewMode === 'grid' ? 'bg-white dark:bg-[#121214] text-violet-600 dark:text-violet-400 shadow-sm' : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    title="عرض كشبكة"
                  >
                    <Grid2X2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 🟢 شريط أدوات التحكم والأرشيف الحر (Toolbar) 🟢 */}
              <div className={`bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-white/10 p-2 md:p-3 rounded-[1.5rem] mb-8 flex flex-col-reverse xl:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-lg w-full relative z-10 transition-all duration-500`}>
                  <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                      <button onClick={() => setShowPdfSettings(!showPdfSettings)} className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none border cursor-pointer active:scale-95 ${showPdfSettings ? 'bg-slate-200 dark:bg-slate-800 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-500/50' : 'bg-transparent text-slate-500 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                        <Settings className={`w-4 h-4 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} /> إعدادات PDF
                      </button>
                      <button onClick={handleExportAllPDF} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none cursor-pointer active:scale-95">
                        <Printer className="w-4 h-4" /> طباعة الدليل
                      </button>
                      <button onClick={handleExportAllExcel} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-transparent border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 px-4 py-2.5 rounded-xl font-black text-[12px] transition-all outline-none cursor-pointer active:scale-95">
                        <Database className="w-4 h-4" /> تصدير قاعدة البيانات
                      </button>
                  </div>

                  <div className="relative w-full xl:w-auto flex-1 max-w-md">
                      <div className="flex items-stretch border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden h-[46px] group hover:border-violet-400 dark:hover:border-violet-500/50 transition-colors w-full shadow-sm dark:shadow-inner bg-white dark:bg-[#121214]">
                        <div className="bg-slate-50 dark:bg-[#050505] w-12 flex items-center justify-center border-l border-slate-200 dark:border-white/5 shrink-0 transition-colors group-hover:bg-violet-50 dark:group-hover:bg-violet-500/10">
                          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-violet-500 dark:group-focus-within:text-violet-400 transition-colors" />
                        </div>
                        <input type="text" placeholder="ابحث عن وصفة حرة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent font-bold text-slate-900 dark:text-white px-4 outline-none text-[13px] placeholder-slate-400 dark:placeholder-slate-600" />
                      </div>
                  </div>
              </div>

              {/* 💡 لوحة تحكم الطباعة الشاملة (لجدول الأرشيف الحر) 💡 */}
              {showPdfSettings && (
                <div className="bg-slate-50 dark:bg-[#050505] p-5 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative mb-8 transition-colors duration-300">
                  
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-3">
                    <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><Settings className="w-4 h-4 text-violet-600 dark:text-violet-400"/> إعدادات طباعة الأرشيف المتقدمة</span>
                    <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 flex items-center gap-1 transition-colors bg-white dark:bg-[#121214] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-slate-500/50">
                      <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase">حجم الورق</label>
                      <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-violet-400 dark:focus:border-violet-500/50 cursor-pointer shadow-sm dark:shadow-inner appearance-none transition-colors">
                        <option value="A4" className="bg-white dark:bg-[#050505]">A4 (ورق قياسي)</option>
                        <option value="A3" className="bg-white dark:bg-[#050505]">A3 (أفضل للأعمدة الكثيرة)</option>
                      </select>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase">هوامش الورقة</label>
                      <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-violet-400 dark:focus:border-violet-500/50 cursor-pointer shadow-sm dark:shadow-inner appearance-none transition-colors">
                        <option value="0mm" className="bg-white dark:bg-[#050505]">بدون هوامش (0mm)</option>
                        <option value="2mm" className="bg-white dark:bg-[#050505]">ضيقة جداً (2mm)</option>
                        <option value="5mm" className="bg-white dark:bg-[#050505]">ضيقة (5mm)</option>
                        <option value="10mm" className="bg-white dark:bg-[#050505]">عادية (10mm)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end gap-2">
                      <button onClick={() => updatePdfSetting('autoFit', !pdfSettings.autoFit)} className={`flex items-center justify-center gap-2 h-[42px] px-4 rounded-xl border text-sm font-black transition-all outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-violet-500/50 ${pdfSettings.autoFit ? 'bg-violet-50 dark:bg-violet-600 border-violet-200 dark:border-violet-500 text-violet-700 dark:text-white shadow-sm dark:shadow-[0_0_15px_rgba(139,92,246,0.4)]' : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <Maximize className="w-4 h-4" /> {pdfSettings.autoFit ? 'الاحتواء: تلقائي' : 'الاحتواء: يدوي'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 w-full lg:col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة أفقية (يمين/يسار)</label>
                        <span className="bg-violet-50 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-violet-200 dark:border-violet-500/30 shadow-sm dark:shadow-inner" dir="ltr">{pdfSettings.shiftX} mm</span>
                      </div>
                      <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-violet-500 h-2 bg-white dark:bg-[#121214] rounded-lg appearance-none cursor-pointer mt-1 border border-slate-200 dark:border-white/5" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <hr className="flex-1 border-slate-200 dark:border-white/5" />
                    <span className="text-[10px] font-black text-violet-600 dark:text-violet-500 uppercase tracking-widest bg-violet-50 dark:bg-violet-500/10 px-3 py-1 rounded-full border border-violet-200 dark:border-violet-500/20 shadow-sm dark:shadow-inner">إعدادات الأعمدة لجدول دليل الأرشيف</span>
                    <hr className="flex-1 border-slate-200 dark:border-white/5" />
                  </div>

                  <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 items-end transition-opacity duration-300 ${pdfSettings.autoFit ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    
                    <div className="flex flex-col gap-2 w-full col-span-2 md:col-span-3 lg:col-span-6 mb-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الجدول (Zoom)</label>
                        <span className="bg-violet-50 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-[11px] font-black px-2 py-0.5 rounded-md border border-violet-200 dark:border-violet-500/30 shadow-sm dark:shadow-inner">{pdfSettings.zoom}%</span>
                      </div>
                      <input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-violet-500 h-2 bg-white dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                    </div>

                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">اسم الصنف</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colName}%</span></div><input type="range" min="10" max="60" value={pdfSettings.colName} onChange={e => updatePdfSetting('colName', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الإصدار (V)</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colVersion}%</span></div><input type="range" min="5" max="25" value={pdfSettings.colVersion} onChange={e => updatePdfSetting('colVersion', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">الطبخة (كلي)</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colBatch}%</span></div><input type="range" min="5" max="35" value={pdfSettings.colBatch} onChange={e => updatePdfSetting('colBatch', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">القطعة/النسبة</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colPiece}%</span></div><input type="range" min="5" max="35" value={pdfSettings.colPiece} onChange={e => updatePdfSetting('colPiece', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="flex flex-col gap-2 w-full"><div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-wider">عدد المكونات</label><span className="text-slate-500 dark:text-slate-500 text-[9px] font-black">{pdfSettings.colIngCount}%</span></div><input type="range" min="5" max="30" value={pdfSettings.colIngCount} onChange={e => updatePdfSetting('colIngCount', Number(e.target.value))} className="w-full accent-slate-400 dark:accent-slate-600 h-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/5 rounded-lg appearance-none cursor-pointer" /></div>
                  </div>

                  {!pdfSettings.autoFit && (
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20 text-violet-600 dark:text-violet-400'} shadow-sm dark:shadow-inner`}>
                      <span>مجموع النسب للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400'}`}>{totalCalculatedWidth}%</span></span>
                      {totalCalculatedWidth > 100 ? (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (سيضغط المتصفح الجدول)</span>
                      ) : (
                        <span className="text-violet-600 dark:text-violet-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول منسق)</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isLoadingArchive ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4"><Loader2 className="w-12 h-12 text-violet-500 animate-spin" /><p className="text-slate-500 font-bold">جاري تحميل الأرشيف...</p></div>
              ) : filteredFreeArchive.length === 0 ? (
                <div className="text-center py-32 bg-white dark:bg-[#121214] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors duration-300"><Blocks className="w-20 h-20 mx-auto mb-6 text-slate-400 dark:text-slate-600" /><p className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">لا توجد وصفات حرة محفوظة</p></div>
              ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" : "flex flex-col gap-3"}>
                  {filteredFreeArchive.map((recipe) => (
                    <div key={recipe.id} className={`bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] hover:border-violet-300 dark:hover:border-violet-500/50 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] transition-all duration-300 group relative overflow-hidden ${viewMode === 'grid' ? 'rounded-3xl p-6 flex flex-col' : 'rounded-2xl p-4 md:p-5 flex flex-col xl:flex-row items-start xl:items-center gap-5'}`}>
                      <div className={`absolute right-0 bg-gradient-to-b from-violet-400 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity ${viewMode === 'grid' ? 'top-0 w-full h-1.5 bg-gradient-to-r' : 'top-0 w-1.5 h-full'}`}></div>
                      
                      <div className={`flex-1 w-full ${viewMode === 'grid' ? 'mb-6' : ''}`}>
                        <div className="flex items-center gap-3 mb-2.5">
                          <h4 className="text-[17px] font-black text-slate-800 dark:text-slate-200">{recipe.name}</h4>
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1 shadow-sm dark:shadow-inner">
                            <History className="w-3 h-3"/> <span dir="ltr">V{recipe.version || 1}</span>
                          </span>
                        </div>
                        <span className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-400 text-[10px] font-black px-2.5 py-1 rounded-md flex items-center gap-1 w-max shadow-sm dark:shadow-inner"><Blocks className="w-3 h-3"/> وصفة حرة (غير مرتبطة بصنف)</span>
                      </div>

                      <div className={`flex items-center gap-4 shrink-0 bg-slate-50 dark:bg-[#050505] p-3 rounded-xl border border-slate-200 dark:border-white/5 justify-center shadow-sm dark:shadow-inner transition-colors ${viewMode === 'grid' ? 'w-full mb-6' : 'w-full xl:w-auto'}`}>
                        <div className="text-center px-4">
                          <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">الطبخة الإجمالية</span>
                          <span dir="ltr" className="text-[15px] font-black text-slate-700 dark:text-slate-300">{recipe.batch_weight} <span className="text-[10px] text-slate-500">{recipe.batch_unit}</span></span>
                        </div>
                        <div className="w-px h-8 bg-slate-200 dark:bg-white/10"></div>
                        <div className="text-center px-4">
                          <span className="block text-[10px] font-black text-violet-600 dark:text-violet-500/70 uppercase tracking-wider mb-1">القطعة / النسبة</span>
                          <span dir="ltr" className="text-[15px] font-black text-violet-600 dark:text-violet-400">{recipe.piece_weight} <span className="text-[10px] text-violet-600/70 dark:text-violet-500/70">{recipe.piece_unit}</span></span>
                        </div>
                      </div>

                      <div className={`flex items-center gap-2 shrink-0 ${viewMode === 'grid' ? 'w-full mt-auto' : 'w-full xl:w-auto mt-2 xl:mt-0'}`}>
                        <button onClick={() => handleOpenModal(recipe)} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 px-5 py-3.5 rounded-xl font-black text-[12px] transition-all shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95">
                          <Layers className="w-4 h-4" /> الشجرة
                        </button>
                        <button onClick={() => handleLoadToCalculator(recipe)} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-violet-400 dark:hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 px-5 py-3.5 rounded-xl font-black text-[12px] transition-all shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95">
                          <Edit className="w-4 h-4" /> تعديل
                        </button>
                        <button onClick={() => handleDeleteRecipe(recipe.id, recipe.name)} className="p-3.5 text-slate-500 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-all shrink-0 shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewRecipeModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-10 bg-slate-900/40 dark:bg-[#050505]/80 backdrop-blur-md animate-in fade-in duration-300 no-print">
              
              <div className="bg-white dark:bg-[#0a0a0c] w-full max-w-[600px] rounded-[2.5rem] shadow-2xl dark:shadow-[0_0_80px_rgba(0,0,0,0.8)] relative border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500"></div>
                
                <button onClick={() => setViewRecipeModal(null)} className="absolute top-6 left-6 text-slate-400 hover:text-white bg-slate-100 dark:bg-[#121214] hover:bg-rose-500 border border-slate-200 dark:border-white/10 hover:border-rose-500 p-2.5 rounded-full transition-all duration-300 z-20 outline-none cursor-pointer active:scale-95"><X className="w-5 h-5" /></button>

                <div className="p-8 pb-6 z-10 shrink-0 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#121214]/50 transition-colors">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 w-14 h-14 rounded-2xl flex items-center justify-center shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.4)]"><Share2 className="w-7 h-7 text-white" /></div>
                    <div>
                      <h3 className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight">خطة الإنتاج (BOM)</h3>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/20 mt-1.5 inline-flex items-center gap-1 shadow-sm dark:shadow-inner"><BrainCircuit className="w-3.5 h-3.5"/> حساب ديناميكي معتمد للشجرة</span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-sm dark:shadow-inner transition-colors">
                    <div>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1.5">المنتج المستهدف للتصنيع</p>
                      <p className="text-[18px] font-black text-slate-900 dark:text-white">{viewRecipeModal.name} <span dir="ltr" className="text-emerald-600 dark:text-emerald-500 text-xs ml-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded shadow-sm dark:shadow-inner border border-emerald-200 dark:border-emerald-500/20">V{viewRecipeModal.version || 1}</span></p>
                      {viewRecipeModal.agency_id && <p className="text-indigo-600 dark:text-indigo-400 text-[11px] font-bold mt-2 flex items-center gap-1"><Building2 className="w-3 h-3"/> {agMap[viewRecipeModal.agency_id] || ''}</p>}
                    </div>
                    <div className="text-left bg-slate-50 dark:bg-[#121214] px-4 py-3 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner transition-colors">
                       <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">القطعة (بما فيها الهدر)</p>
                       <p dir="ltr" className="text-[15px] font-black text-emerald-600 dark:text-emerald-400 drop-shadow-sm dark:drop-shadow-md">
                         {new Intl.NumberFormat('en-US', { numberingSystem: 'latn', maximumFractionDigits: 2 }).format(Number(viewRecipeModal.piece_weight) * (1 + (Number(viewRecipeModal.waste_percent)/100)))}
                         <span className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 mr-1">{viewRecipeModal.piece_unit}</span>
                       </p>
                    </div>
                  </div>
                </div>

                <div className="px-8 py-5 shrink-0 z-10 border-b border-slate-100 dark:border-white/5 transition-colors">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <label className="text-[13px] font-black text-slate-700 dark:text-slate-300">الكمية المطلوبة للإنتاج الآن:</label>
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#121214] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner transition-colors">
                      <button onClick={() => setTargetProduction(Math.max(1, Number(targetProduction) - 1))} className="w-12 h-12 rounded-xl bg-white dark:bg-[#050505] text-slate-500 font-black hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white transition-colors border border-slate-200 dark:border-white/5 outline-none cursor-pointer active:scale-95">-</button>
                      <input type="number" dir="ltr" value={targetProduction} onChange={(e) => setTargetProduction(e.target.value ? Number(e.target.value) : '')} className="w-24 bg-transparent text-slate-900 dark:text-white font-black text-[22px] px-2 py-1 text-center focus:outline-none"/>
                      <button onClick={() => setTargetProduction(Number(targetProduction) + 1)} className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-black hover:bg-emerald-500 hover:text-white transition-colors outline-none cursor-pointer active:scale-95">+</button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-island-scroll mt-2 px-8 pb-6 relative z-10 space-y-6">
                  <div>
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 sticky top-0 bg-white/90 dark:bg-[#0a0a0c]/90 backdrop-blur-md py-3 z-20 transition-colors">جدول سحب المقادير من المخزن</h4>
                    <div className="space-y-4">
                      {(viewRecipeModal.ingredients || []).map((ing: any, i: number) => (
                        <RecursiveIngredientRow key={i} ing={ing} multiplier={Number(targetProduction) || 1} />
                      ))}
                    </div>
                  </div>

                  {viewRecipeModal.packaging_materials && viewRecipeModal.packaging_materials.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-4 sticky top-0 bg-white/90 dark:bg-[#0a0a0c]/90 backdrop-blur-md py-3 z-20 transition-colors">مواد التعبئة والتغليف المطلوبة</h4>
                      <div className="space-y-3">
                        {viewRecipeModal.packaging_materials.map((p: any, i: number) => {
                          const totalRequired = Math.ceil(Number(p.perUnitQty) * (Number(targetProduction) || 1));
                          return (
                            <div key={i} className="bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-sm dark:shadow-inner transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/5 flex items-center justify-center text-xs font-black text-slate-500 shadow-sm dark:shadow-inner transition-colors">
                                  <span dir="ltr">{i + 1}</span>
                                </div>
                                <p className="text-[14px] font-bold text-slate-800 dark:text-slate-200">{p.name}</p>
                              </div>
                              <div className="bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 px-4 py-2 rounded-xl text-center min-w-[90px] shadow-sm dark:shadow-inner transition-colors">
                                <span dir="ltr" className="block text-[17px] font-black text-sky-600 dark:text-sky-400 leading-none drop-shadow-sm dark:drop-shadow-md">
                                  {new Intl.NumberFormat('en-US', { numberingSystem: 'latn', useGrouping: true }).format(totalRequired)}
                                </span>
                                <span className="block text-[10px] font-bold text-sky-600/70 dark:text-sky-500/70 mt-1 uppercase">{p.unit}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 pt-5 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#121214]/50 z-10 shrink-0 backdrop-blur-md transition-colors">
                  <div className="flex gap-4">
                    <button onClick={() => handlePrintRecipe(viewRecipeModal)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-4 rounded-xl font-black text-[13px] transition-all shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.4)] outline-none cursor-pointer active:scale-95"><Printer className="w-4 h-4" /> طباعة أمر التشغيل</button>
                    <button onClick={() => handleExportRecipeExcel(viewRecipeModal)} className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-[#050505] hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-4 py-4 rounded-xl font-black text-[13px] transition-all border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner outline-none cursor-pointer active:scale-95"><FileSpreadsheet className="w-4 h-4" /> تصدير للإكسل</button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        <style dangerouslySetInnerHTML={{__html: `
          .custom-island-scroll::-webkit-scrollbar { width: 5px; height: 5px;}
          .custom-island-scroll::-webkit-scrollbar-track { background: transparent; }
          .custom-island-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
          html.dark .custom-island-scroll::-webkit-scrollbar-thumb { background: #334155; }
          .custom-island-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          html.dark .custom-island-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }
          
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />
      </div>
    </div>
  );
}