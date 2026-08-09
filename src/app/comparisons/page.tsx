"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; 
import { 
  Loader2, AlertCircle, Calendar, Store, Filter, CalendarDays, 
  TrendingUp, TrendingDown, Trophy, Flame, Activity, Layers, 
  Hash, LayoutList, Target, ChevronDown, ChevronUp, FileSpreadsheet,
  Minus, Clock, FileText, ReceiptText, Package, AlertTriangle, Building2, 
  RotateCcw, LayoutGrid, Award, Box, Zap, AlignLeft, ArrowUpRight, ArrowDownRight, Maximize2,
  PieChart, Grid, List, Archive, ChevronLeft, ChevronRight, Eye, EyeOff, ArrowRightLeft
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

dayjs.locale('ar');

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const getColLetter = (colIndex: number) => {
  let temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp - 1) / 26);
  }
  return letter;
};

const roundNum = (num: number) => Math.round(num * 1000) / 1000;
const formatNum = (num: number) => Number(num).toLocaleString('en-US', { maximumFractionDigits: 2 });

const hexToRgba = (hex: string, alpha: number = 1) => {
  let r = 6, g = 182, b = 212; 
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

const getSmartIcon = (name: string) => {
  if (!name) return '📦';
  const n = name.toLowerCase();
  if (n.includes('دجاج') || n.includes('تندر') || n.includes('زنكر')) return '🍗';
  if (n.includes('لحم') || n.includes('بقر') || n.includes('ستيك')) return '🥩';
  if (n.includes('بركر') || n.includes('برجر') || n.includes('سماش')) return '🍔';
  if (n.includes('صوص') || n.includes('ثومية') || n.includes('صلصة')) return '🏺';
  if (n.includes('جبن') || n.includes('شيدر') || n.includes('موزريلا')) return '🧀';
  if (n.includes('خبز') || n.includes('صمون') || n.includes('تورتيلا')) return '🥖';
  if (n.includes('بطاطا') || n.includes('فرايز') || n.includes('فنكر')) return '🍟';
  if (n.includes('عصير') || n.includes('بيبسي') || n.includes('مشروب')) return '🥤';
  if (n.includes('علب') || n.includes('تغليف') || n.includes('سفري')) return '🛍️';
  if (n.includes('مقبلات') || n.includes('سلطة')) return '🥗';
  return '📦';
};

const COLORS_1 = ['bg-indigo-500/20 text-indigo-400', 'bg-emerald-500/20 text-emerald-400', 'bg-rose-500/20 text-rose-400', 'bg-amber-500/20 text-amber-400', 'bg-cyan-500/20 text-cyan-400'];

const FilterSelect = ({ icon, value, onChange, options, label }: any) => (
  <div className="relative bg-white dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-cyan-500/20 h-14 flex items-center flex-1 min-w-[140px] hover:border-indigo-300 dark:hover:border-cyan-500/50 hover:bg-slate-50 dark:hover:bg-cyan-500/5 transition-all shadow-sm dark:shadow-inner focus-within:ring-4 focus-within:ring-indigo-500/10 dark:focus-within:ring-cyan-500/10 focus-within:border-indigo-400 dark:focus-within:border-cyan-500 group cursor-pointer active:scale-[0.98]">
    <div className="absolute right-4 text-slate-400 dark:text-cyan-500/70 group-hover:text-indigo-500 dark:group-hover:text-cyan-400 transition-colors pointer-events-none w-5 h-5">{icon}</div>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-full bg-transparent pl-4 pr-12 outline-none font-bold text-slate-800 dark:text-cyan-100 text-[13px] appearance-none cursor-pointer">
      <option value="الكل" className="bg-white dark:bg-[#121214]">{label} (الكل)</option>
      {options.map((o:string) => <option key={o} value={o} className="bg-white dark:bg-[#121214]">{o}</option>)}
    </select>
    <ChevronDown className="absolute left-4 w-4 h-4 text-slate-400 dark:text-cyan-500/50 pointer-events-none group-hover:text-indigo-500 dark:group-hover:text-cyan-400 transition-colors" />
  </div>
);

export default function ComparisonsPage() {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState<any[]>([]);
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  const [agenciesColorMap, setAgenciesColorMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'branches' | 'agencies' | 'categories' | 'items'>('items');
  const [layoutView, setLayoutView] = useState<'table' | 'grid'>('table'); 
  const [isZenMode, setIsZenMode] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  
  const [selectedAgency, setSelectedAgency] = useState<string>('الكل');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [selectedItem, setSelectedItem] = useState<string>('الكل');
  const [selectedBranch, setSelectedBranch] = useState<string>('الكل');

  const [expandedPeriod, setExpandedPeriod] = useState<number | null>(null);

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, 
    viewDate: dayjs.Dayjs, 
    mode: 'date' | 'month' | 'year'
  }>({ isOpen: false, viewDate: dayjs(), mode: 'date' });

  const isTimeTab = ['daily', 'weekly', 'monthly'].includes(activeTab);
  const isMonthPicker = ['monthly', 'branches', 'agencies', 'categories', 'items'].includes(activeTab);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { setExpandedPeriod(null); }, [activeTab, selectedDate, selectedAgency, selectedCategory, selectedItem, selectedBranch, layoutView]);

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    try {
      const { data: agData, error: agError } = await supabase.from('agencies').select('*');
      if (agError) throw agError;
      
      const aMap: Record<string, string> = {};
      const cMap: Record<string, string> = {};
      agData?.forEach((a: any) => { 
        aMap[a.id] = a.name; 
        cMap[a.id] = a.color || '#06b6d4'; 
      });
      setAgenciesMap(aMap);
      setAgenciesColorMap(cMap);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, branch_id, status, created_at,
          branches (name, agency_id),
          order_details (quantity, items(id, name, agency_id, categories(name, color)))
        `)
        .neq('status', 'pending')
        .neq('status', 'rejected')
        .order('created_at', { ascending: true }); 

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      setDbError(err?.message || "حدث خطأ في جلب البيانات من قاعدة البيانات.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedAgency('الكل');
    setSelectedCategory('الكل');
    setSelectedItem('الكل');
    setSelectedBranch('الكل');
    setSelectedDate(dayjs().startOf('month').format('YYYY-MM-DD'));
  };

  const uniqueAgenciesList = useMemo(() => {
    const agencies = new Map<string, string>();
    orders.forEach(o => {
      const agId = o.branches?.agency_id;
      if(agId) {
        const agName = agenciesMap[agId];
        const agColor = agenciesColorMap[agId];
        if(agName && !agencies.has(agName)) agencies.set(agName, agColor || '#06b6d4');
      }
    });
    return Array.from(agencies.entries())
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, agenciesMap, agenciesColorMap]);

  const quickCategoriesTabs = useMemo(() => {
    const uniqueItemsMap = new Map<string, any>();
    orders.forEach(order => {
      order.order_details?.forEach((detail: any) => {
        const agId = detail.items?.agency_id;
        const agencyName = agId ? (agenciesMap[agId] || 'غير محدد') : 'غير محدد';
        if (selectedAgency === 'الكل' || agencyName === selectedAgency) {
          const catName = detail.items?.categories?.name || 'غير محدد';
          const catColor = detail.items?.categories?.color || '#10b981';
          const iName = detail.items?.name || 'غير محدد';
          const compKey = `${agencyName}-${catName}-${iName}`;
          if (!uniqueItemsMap.has(compKey)) {
            uniqueItemsMap.set(compKey, { categoryName: catName, categoryColor: catColor });
          }
        }
      });
    });
    const counts: Record<string, { count: number, color: string }> = {};
    Array.from(uniqueItemsMap.values()).forEach(item => {
      if (!counts[item.categoryName]) counts[item.categoryName] = { count: 0, color: item.categoryColor };
      counts[item.categoryName].count += 1;
    });
    return Object.entries(counts)
      .map(([name, data]) => ({ name, count: data.count, color: data.color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, selectedAgency, agenciesMap]);

  const filterOptions = useMemo(() => {
    const itms = new Set<string>();
    const brs = new Set<string>();

    orders.forEach((o: any) => {
        brs.add(o.branches?.name || 'غير محدد');
        (o.order_details || []).forEach((d: any) => {
            const ag = agenciesMap[d.items?.agency_id] || 'غير محدد';
            const cat = d.items?.categories?.name || 'غير محدد';
            const itm = d.items?.name || 'غير محدد';
            
            if (selectedAgency === 'الكل' || ag === selectedAgency) {
                if (selectedCategory === 'الكل' || cat === selectedCategory) {
                    itms.add(itm);
                }
            }
        });
    });

    return {
        items: Array.from(itms).sort(),
        branches: Array.from(brs).sort()
    };
  }, [orders, agenciesMap, selectedAgency, selectedCategory]);

  const analyticsData = useMemo(() => {
    const targetDate = dayjs(selectedDate);
    
    const filteredOrders = orders.map((o: any) => {
      if (selectedBranch !== 'الكل' && o.branches?.name !== selectedBranch) return null;
      
      const filteredDetails = (o.order_details || []).filter((d: any) => {
          const agName = agenciesMap[d.items?.agency_id] || 'غير محدد';
          const catName = d.items?.categories?.name || 'غير محدد';
          const itmName = d.items?.name || 'غير محدد';

          if (selectedAgency !== 'الكل' && agName !== selectedAgency) return false;
          if (selectedCategory !== 'الكل' && catName !== selectedCategory) return false;
          if (selectedItem !== 'الكل' && itmName !== selectedItem) return false;
          return true;
      });

      if (!filteredDetails || filteredDetails.length === 0) return null;
      return { ...o, order_details: filteredDetails };
    }).filter(Boolean);

    const processOrdersForPeriod = (periodOrders: any[], periodName: string, subLabel: string) => {
      let total = 0;
      const branchMap = new Map<string, number>();
      const categoryMap = new Map<string, number>();
      const itemMap = new Map<string, number>();
      const hourMap = new Map<number, number>();
      
      const orderSizes = periodOrders.map((o: any) => 
         (o.order_details || []).reduce((s: number, d: any) => roundNum(s + (Number(d.quantity) || 0)), 0) || 0
      );
      const averageOrderSize = orderSizes.length > 0 ? orderSizes.reduce((a, b) => a + b, 0) / orderSizes.length : 0;

      periodOrders.forEach((o: any) => {
        const bName = o.branches?.name || 'غير محدد';
        const hour = dayjs(o.created_at).hour();
        
        let orderTotal = 0;
        (o.order_details || []).forEach((d: any) => {
           const qty = Number(d.quantity) || 0;
           const iName = d.items?.name || 'صنف غير محدد';
           const cName = d.items?.categories?.name || 'قسم غير محدد';
           
           orderTotal = roundNum(orderTotal + qty);
           itemMap.set(iName, roundNum((itemMap.get(iName) || 0) + qty)); 
           categoryMap.set(cName, roundNum((categoryMap.get(cName) || 0) + qty)); 
           hourMap.set(hour, roundNum((hourMap.get(hour) || 0) + qty));   
        });
        
        total = roundNum(total + orderTotal);
        branchMap.set(bName, roundNum((branchMap.get(bName) || 0) + orderTotal));
      });

      const topItems = Array.from(itemMap.entries())
         .sort((a: any, b: any) => b[1] - a[1])
         .slice(0, 5)
         .map((e: any) => ({ name: String(e[0]), qty: Number(e[1]) }));

      let peakHourStr = '-';
      if (hourMap.size > 0) {
         const peakHour = Number(Array.from((hourMap as Map<number, number>).entries()).sort((a: any, b: any) => b[1] - a[1])[0][0]);
         const h = peakHour % 12 === 0 ? 12 : peakHour % 12;
         const ampm = peakHour >= 12 ? 'PM' : 'AM';
         peakHourStr = `${h}:00 ${ampm}`;
      }
      
      return { name: periodName, subLabel, total, branchMap, categoryMap, itemMap, topItems, peakHourStr, trend: 0, rawOrders: periodOrders, averageOrderSize };
    };

    let periods: any[] = [];

    if (isTimeTab) {
      if (activeTab === 'daily') {
        const startOfWeek = targetDate.startOf('week');
        periods = ARABIC_DAYS.map((dayName: string, index: number) => {
          const currentDay = startOfWeek.add(index, 'day').format('YYYY-MM-DD');
          const dayOrders = filteredOrders.filter((o: any) => dayjs(o.created_at).format('YYYY-MM-DD') === currentDay);
          return processOrdersForPeriod(dayOrders, dayName, currentDay);
        });
      } else if (activeTab === 'weekly') {
        const monthStr = targetDate.format('YYYY-MM');
        const weeksOrders: any[][] = [[], [], [], []];
        filteredOrders.forEach((o: any) => {
          if (dayjs(o.created_at).format('YYYY-MM') === monthStr) {
            const dayOfMonth = dayjs(o.created_at).date();
            if (dayOfMonth <= 7) weeksOrders[0].push(o);
            else if (dayOfMonth <= 14) weeksOrders[1].push(o);
            else if (dayOfMonth <= 21) weeksOrders[2].push(o);
            else weeksOrders[3].push(o);
          }
        });
        periods = [
          processOrdersForPeriod(weeksOrders[0], 'الأسبوع الأول', monthStr),
          processOrdersForPeriod(weeksOrders[1], 'الأسبوع الثاني', monthStr),
          processOrdersForPeriod(weeksOrders[2], 'الأسبوع الثالث', monthStr),
          processOrdersForPeriod(weeksOrders[3], 'الأسبوع الرابع', monthStr)
        ];
      } else if (activeTab === 'monthly') {
        const yearStr = targetDate.format('YYYY');
        const monthsOrders: any[][] = Array.from({length: 12}, () => []);
        filteredOrders.forEach((o: any) => {
          if (dayjs(o.created_at).format('YYYY') === yearStr) {
            const monthIndex = dayjs(o.created_at).month();
            monthsOrders[monthIndex].push(o);
          }
        });
        periods = ARABIC_MONTHS.map((monthName, i) => processOrdersForPeriod(monthsOrders[i], monthName, yearStr));
      }

      periods.forEach((p: any, i: number) => {
         if (i === 0) p.trend = 0;
         else {
            const prevTotal = periods[i-1].total;
            if (prevTotal === 0) p.trend = p.total > 0 ? 100 : 0;
            else p.trend = ((p.total - prevTotal) / prevTotal) * 100;
         }
      });

    } else {
      const currentMonthStr = targetDate.format('YYYY-MM');
      const prevMonthStr = targetDate.subtract(1, 'month').format('YYYY-MM');
      
      const groupByField = activeTab === 'branches' ? 'branchName' : activeTab === 'agencies' ? 'agencyName' : activeTab === 'categories' ? 'categoryName' : 'itemName';

      const entityMap = new Map();
      const prevEntityMap = new Map();

      filteredOrders.forEach((o: any) => {
         const month = dayjs(o.created_at).format('YYYY-MM');
         const branchName = o.branches?.name || 'غير محدد';
         
         (o.order_details || []).forEach((d: any) => {
             const qty = Number(d.quantity) || 0;
             const itemName = d.items?.name || 'غير محدد';
             const categoryName = d.items?.categories?.name || 'غير محدد';
             const agencyName = agenciesMap[d.items?.agency_id] || 'غير محدد';
             
             const record: any = { branchName, itemName, categoryName, agencyName, qty, orderDate: o.created_at, orderId: o.id, rawOrder: o };
             const entityName = record[groupByField];

             if (month === currentMonthStr) {
                 if (!entityMap.has(entityName)) {
                     entityMap.set(entityName, {
                         name: entityName,
                         subLabel: currentMonthStr,
                         total: 0,
                         branchMap: new Map<string, number>(),
                         categoryMap: new Map<string, number>(),
                         itemMap: new Map<string, number>(),
                         hourMap: new Map<number, number>(),
                         topItemsMap: new Map<string, number>(),
                         uniqueOrdersMap: new Map<string, any>()
                     });
                 }
                 const group = entityMap.get(entityName);
                 group.total = roundNum(group.total + qty);
                 
                 group.branchMap.set(branchName, roundNum((group.branchMap.get(branchName) || 0) + qty));
                 group.categoryMap.set(categoryName, roundNum((group.categoryMap.get(categoryName) || 0) + qty));
                 group.itemMap.set(itemName, roundNum((group.itemMap.get(itemName) || 0) + qty));
                 
                 const hour = dayjs(record.orderDate).hour();
                 group.hourMap.set(hour, roundNum((group.hourMap.get(hour) || 0) + qty));
                 
                 const topField = activeTab === 'items' || activeTab === 'categories' ? record.branchName : record.itemName;
                 group.topItemsMap.set(topField, roundNum((group.topItemsMap.get(topField) || 0) + qty));
                 
                 if (!group.uniqueOrdersMap.has(record.orderId)) {
                     group.uniqueOrdersMap.set(record.orderId, record.rawOrder);
                 }
             } else if (month === prevMonthStr) {
                 prevEntityMap.set(entityName, roundNum((prevEntityMap.get(entityName) || 0) + qty));
             }
         });
      });

      periods = Array.from(entityMap.values()).map((g: any) => {
          const topItems = Array.from((g.topItemsMap as Map<string, number>).entries())
              .sort((a: any, b: any) => b[1] - a[1])
              .slice(0, 5)
              .map((e: any) => ({ name: String(e[0]), qty: Number(e[1]) }));
              
          let peakHourStr = '-';
          if (g.hourMap.size > 0) {
              const peakHour = Number(Array.from((g.hourMap as Map<number, number>).entries()).sort((a: any, b: any) => b[1] - a[1])[0][0]);
              const h = peakHour % 12 === 0 ? 12 : peakHour % 12;
              const ampm = peakHour >= 12 ? 'PM' : 'AM';
              peakHourStr = `${h}:00 ${ampm}`;
          }
          
          const prevTotal = prevEntityMap.get(g.name) || 0;
          let trend = 0;
          if (prevTotal === 0) trend = g.total > 0 ? 100 : 0;
          else trend = ((g.total - prevTotal) / prevTotal) * 100;
          
          const rawOrders = Array.from((g.uniqueOrdersMap as Map<string, any>).values());
          const averageOrderSize = rawOrders.length > 0 ? g.total / rawOrders.length : 0;
          
          return {
              name: g.name, subLabel: g.subLabel, total: g.total,
              branchMap: g.branchMap, categoryMap: g.categoryMap, itemMap: g.itemMap,
              topItems, peakHourStr, trend, rawOrders, averageOrderSize
          };
      });
      
      periods.sort((a, b) => b.total - a.total);
    }

    const maxTotal = Math.max(...periods.map((p: any) => p.total), 1); 
    const totalAll = roundNum(periods.reduce((sum: number, p: any) => sum + p.total, 0));
    const activePeriodsCount = periods.filter((p: any) => p.total > 0).length || 1;
    const average = roundNum(totalAll / activePeriodsCount);

    const finalData = periods.map((p: any, idx: number) => {
      let history: number[] = [];
      if (isTimeTab) { history = periods.slice(Math.max(0, idx - 4), idx + 1).map((x: any) => x.total); } 
      else { history = [p.total]; }

      const branchesArr = Array.from((p.branchMap as Map<string, number>).entries()).map((e: any) => ({ name: String(e[0]), total: Number(e[1]) })).sort((a: any, b: any) => b.total - a.total); 
      const categoriesArr = Array.from((p.categoryMap as Map<string, number>).entries()).map((e: any) => ({ name: String(e[0]), total: Number(e[1]) })).sort((a: any, b: any) => b.total - a.total); 
      const itemsArr = Array.from((p.itemMap as Map<string, number>).entries()).map((e: any) => ({ name: String(e[0]), total: Number(e[1]) })).sort((a: any, b: any) => b.total - a.total); 
        
      return {
        ...p, branchesArr, categoriesArr, itemsArr, history,
        percentageOfMax: (p.total / maxTotal) * 100,
        isHighest: p.total === maxTotal && p.total > 0,
        isAboveAverage: p.total > average && p.total > 0,
        isWeak: p.total < average * 0.5 && p.total > 0
      };
    });

    return { list: finalData, maxTotal, totalAll, average, topPeriod: finalData.find((p: any) => p.isHighest) };
  }, [orders, activeTab, selectedDate, selectedBranch, selectedAgency, selectedCategory, selectedItem, agenciesMap]);

  // 💡 إضافة الدالة الناقصة (monthHeatmap) هنا 💡
  const monthHeatmap = useMemo(() => {
    const target = dayjs(selectedDate);
    const daysInMonth = target.daysInMonth();
    const startOfMonth = target.startOf('month');
    let maxDayTotal = 1;

    const daysData = Array.from({length: daysInMonth}, (_, i) => {
      const d = startOfMonth.add(i, 'day').format('YYYY-MM-DD');
      
      const dOrders = orders.filter((o: any) => {
        if (dayjs(o.created_at).format('YYYY-MM-DD') !== d) return false;
        if (selectedBranch !== 'الكل' && o.branches?.name !== selectedBranch) return false;
        
        const hasMatchingDetails = (o.order_details || []).some((od:any) => {
          const agName = agenciesMap[od.items?.agency_id] || 'غير محدد';
          const catName = od.items?.categories?.name || 'غير محدد';
          const itmName = od.items?.name || 'غير محدد';
          
          if (selectedAgency !== 'الكل' && agName !== selectedAgency) return false;
          if (selectedCategory !== 'الكل' && catName !== selectedCategory) return false;
          if (selectedItem !== 'الكل' && itmName !== selectedItem) return false;
          return true;
        });
        return hasMatchingDetails;
      });

      let dTotal = dOrders.reduce((sum, o) => sum + (o.order_details || []).reduce((s: number, od: any) => {
        const agName = agenciesMap[od.items?.agency_id] || 'غير محدد';
        const catName = od.items?.categories?.name || 'غير محدد';
        const itmName = od.items?.name || 'غير محدد';
        
        if (selectedAgency !== 'الكل' && agName !== selectedAgency) return s;
        if (selectedCategory !== 'الكل' && catName !== selectedCategory) return s;
        if (selectedItem !== 'الكل' && itmName !== selectedItem) return s;
        
        return s + (Number(od.quantity)||0);
      }, 0), 0);
      
      dTotal = roundNum(dTotal);
      if(dTotal > maxDayTotal) maxDayTotal = dTotal;
      return { date: d, total: dTotal };
    });
    return { daysData, maxDayTotal };
  }, [orders, selectedDate, selectedBranch, selectedAgency, selectedCategory, selectedItem, agenciesMap]);

  const toggleExpand = (idx: number) => {
    if (expandedPeriod === idx) setExpandedPeriod(null);
    else setExpandedPeriod(idx);
  };

  const TrendIndicator = ({ trend, history, isRow = false }: { trend: number, history: number[], isRow?: boolean }) => {
    const safeHistory = history && history.length > 0 ? history : [0];
    const max = Math.max(...safeHistory, 1);
    const min = Math.min(...safeHistory, 0);
    const range = max - min || 1;
    const points = safeHistory.length > 1 
      ? safeHistory.map((d, i) => `${(i / (safeHistory.length - 1)) * (isRow ? 50 : 30)},${(isRow ? 24 : 16) - ((d - min) / range) * (isRow ? 24 : 16)}`).join(' ')
      : `0,${isRow ? 24 : 16} ${isRow ? 50 : 30},${isRow ? 24 : 16}`;

    const isUp = trend > 0;
    const isDown = trend < 0;
    
    const color = isUp ? '#10b981' : isDown ? '#f43f5e' : '#94a3b8';
    const bgClass = isUp ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : isDown ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' : 'bg-slate-50 dark:bg-[#121214] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10';
    const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;

    return (
      <div className={`flex items-center gap-2 ${isRow ? 'justify-center' : 'justify-end'} shrink-0`}>
        {safeHistory.length > 1 && (
          <svg width={isRow ? "50" : "30"} height={isRow ? "24" : "16"} className="overflow-visible opacity-70 hidden sm:block drop-shadow-sm dark:drop-shadow-md">
             <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className={`px-2 py-1 rounded-[0.5rem] font-black flex items-center gap-0.5 ${isRow ? 'text-[12px]' : 'text-[11px]'} dir-ltr whitespace-nowrap border shadow-sm ${bgClass}`}>
          <Icon className="w-3.5 h-3.5"/> 
          {isUp ? '+' : ''}{trend.toFixed(1)}%
        </span>
      </div>
    );
  };

  const getTabTitleString = () => {
    if (activeTab === 'daily') return 'المقارنة اليومية لأيام الأسبوع';
    if (activeTab === 'weekly') return 'المقارنة الأسبوعية لأسابيع الشهر';
    if (activeTab === 'monthly') return 'المقارنة الشهرية لأشهر السنة';
    if (activeTab === 'branches') return 'مقارنة الفروع';
    if (activeTab === 'agencies') return 'مقارنة الوكالات';
    if (activeTab === 'categories') return 'مقارنة الأقسام';
    if (activeTab === 'items') return 'مقارنة الأصناف';
    return '';
  };

  const entityColumnName = 
       activeTab === 'branches' ? 'الفرع' : 
       activeTab === 'agencies' ? 'الوكالة' : 
       activeTab === 'categories' ? 'القسم' : 
       activeTab === 'items' ? 'الصنف' : 'الفترة الزمنية';

  const topItemsLabel = activeTab === 'items' || activeTab === 'categories' ? 'الفروع الساحبة' : 'المواد المسحوبة';
  
  const getTopComponentsData = (item: any) => {
      if (['items', 'categories'].includes(activeTab)) return item.branchesArr;
      return item.itemsArr;
  };

  const handleExportPDF = async () => {
    if (!analyticsData || analyticsData.list.length === 0) return alert("لا توجد بيانات للتصدير.");
    setIsExportingPDF(true);
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;
      const titleStr = getTabTitleString();

      let tbody = '';
      analyticsData.list.forEach((item: any, index: number) => {
        const trendLabel = item.trend > 0 ? `+${item.trend.toFixed(1)}%` : item.trend < 0 ? `${item.trend.toFixed(1)}%` : '-';
        const trendColor = item.trend > 0 ? '#059669' : item.trend < 0 ? '#e11d48' : '#94a3b8';
        const bg = index % 2 === 0 ? '#f8fafc' : '#ffffff';

        tbody += `
          <tr style="background-color: ${bg}; page-break-inside: avoid;">
            <td style="padding: 10px; border: 1px solid #cbd5e1; text-align:center; font-weight:bold; font-size: 14px; color: black;">${index + 1}</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight:900; font-size: 15px; color: #0f172a;">${item.name}</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; text-align:center; font-size: 13px; color: #64748b;" dir="ltr">${item.subLabel}</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; text-align:center; font-weight:900; color:#e11d48; font-size: 16px;" dir="ltr">${formatNum(item.total)}</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; text-align:center; font-weight:bold; color:${trendColor}; font-size: 13px;" dir="ltr">${trendLabel}</td>
            <td style="padding: 10px; border: 1px solid #cbd5e1; text-align:center; font-weight:bold; color:#4f46e5; font-size: 13px;" dir="ltr">${item.peakHourStr}</td>
          </tr>
        `;
      });

      const finalHTML = `
        <div id="pdf-wrapper" dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #ffffff; padding: 30px;">
          <h1 style="text-align:center; color:#0f172a;">${titleStr}</h1>
          <p style="text-align:center; color:#64748b; margin-bottom: 20px;">المرجع: ${selectedDate} | تصدير: ${dayjs().format('YYYY-MM-DD hh:mm A')}</p>
          
          <div style="background: #ffffff; padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; display: flex; gap: 30px; border: 1px solid #e2e8f0;">
             <div><strong style="color: #64748b;">الوكالة:</strong> <span style="font-weight: bold; color: #0f172a;">${selectedAgency}</span></div>
             <div><strong style="color: #64748b;">القسم:</strong> <span style="font-weight: bold; color: #0f172a;">${selectedCategory}</span></div>
             <div><strong style="color: #64748b;">الصنف:</strong> <span style="font-weight: bold; color: #0f172a;">${selectedItem}</span></div>
             <div><strong style="color: #64748b;">الفرع:</strong> <span style="font-weight: bold; color: #0f172a;">${selectedBranch}</span></div>
          </div>

          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff;">
                <th style="padding: 10px; border: 1px solid #cbd5e1;">ت</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">${entityColumnName}</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">المرجع</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">إجمالي السحب</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">مؤشر النمو</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">ساعة الذروة</th>
              </tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      `;

      const opt: any = {
        margin:       10, 
        filename:     `تحليلات_${titleStr.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD')}.pdf`,
        image:        { type: 'jpeg', quality: 1 },
        html2canvas:  { scale: 2, useCORS: true, logging: false }, 
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      await html2pdf().set(opt).from(finalHTML).save();

    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("حدث خطأ أثناء إنشاء ملف الـ PDF.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    if (!analyticsData || analyticsData.list.length === 0) return alert("لا توجد بيانات لتصديرها.");
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Enterprise Kitchen System';
    
    const worksheet = workbook.addWorksheet('المقارنات والتحليلات', { 
      views: [{ rightToLeft: true }] 
    });

    const titleStr = getTabTitleString();
    const headers = ['ت', entityColumnName, 'التاريخ / المرجع', 'الإجمالي الكلي', 'مؤشر النمو', 'ساعة الذروة'];
    const totalCols = headers.length;

    worksheet.mergeCells(`A1:${getColLetter(totalCols)}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `تقرير التحليلات والمقارنات (${titleStr})`;
    titleCell.font = { name: 'Cairo', size: 18, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 40;

    worksheet.addRow([]); 

    const filterRow1 = worksheet.addRow([]);
    filterRow1.getCell(1).value = 'الوكالة المحددة:'; filterRow1.getCell(2).value = selectedAgency;
    filterRow1.getCell(3).value = 'القسم المحدد:'; filterRow1.getCell(4).value = selectedCategory;
    filterRow1.getCell(5).value = 'الصنف المحدد:'; filterRow1.getCell(6).value = selectedItem;

    const filterRow2 = worksheet.addRow([]);
    filterRow2.getCell(1).value = 'الفرع المحدد:'; filterRow2.getCell(2).value = selectedBranch;
    filterRow2.getCell(3).value = 'المرجع الزمني:'; filterRow2.getCell(4).value = selectedDate;

    [1, 3, 5].forEach(col => {
      [filterRow1, filterRow2].forEach(row => {
        const cell = row.getCell(col);
        cell.font = { bold: true, color: { argb: 'FF334155' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });
    });
    [2, 4, 6].forEach(col => {
      [filterRow1, filterRow2].forEach(row => {
        const cell = row.getCell(col);
        cell.font = { bold: true, color: { argb: 'FF0F172A' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      });
    });

    worksheet.addRow([]); 

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 35;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; 
      cell.font = { name: 'Arial', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    analyticsData.list.forEach((item: any, index: number) => {
      const rowData: any[] = [
        index + 1, item.name, item.subLabel, item.total, 
        item.trend === 0 ? '-' : item.trend / 100, 
        item.peakHourStr
      ];

      const dataRow = worksheet.addRow(rowData);
      const isEven = index % 2 === 0;
      const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      dataRow.eachCell((cell, colNum) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin', color: {argb: 'FFCBD5E1'} }, left: { style: 'thin', color: {argb: 'FFCBD5E1'} }, bottom: { style: 'thin', color: {argb: 'FFCBD5E1'} }, right: { style: 'thin', color: {argb: 'FFCBD5E1'} } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        
        if (colNum === 2) cell.font = { bold: true };
        if (colNum === 4) {
          cell.font = { bold: true, color: { argb: 'FFE11D48' } }; 
          cell.numFmt = Number.isInteger(item.total) ? '#,##0' : '#,##0.00';
        }
        if (colNum === 5) {
          if (cell.value !== '-') cell.numFmt = '+0.0%;-0.0%';
          cell.font = { bold: true, color: { argb: item.trend > 0 ? 'FF10B981' : item.trend < 0 ? 'FFE11D48' : 'FF94A3B8' } };
        }
      });
    });

    worksheet.columns.forEach((col, i) => {
      if (i === 0) col.width = 6;  
      else if (i === 1) col.width = 30; 
      else if (i === 2) col.width = 15; 
      else if (i === 3) col.width = 15; 
      else if (i === 4) col.width = 15; 
      else if (i === 5) col.width = 15; 
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `تحليلات_${titleStr.replace(/ /g, '_')}_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const handleDateSelection = (dateStr: string) => {
    setSelectedDate(dateStr);
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-all duration-300 ease-in-out ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-800 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-white pb-40'}`} dir="rtl">
        
        {/* 🟢 الإشعاع الخلفي 🟢 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/50 dark:from-blue-900/20 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-opacity duration-300 ${isZenMode ? 'opacity-0' : 'opacity-100'}`}></div>

        <div className={`p-4 md:p-8 max-w-[100rem] mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🟢 الهيدر الثابت 🟢 */}
          <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 bg-white/80 dark:bg-white/5 backdrop-blur-2xl p-6 md:px-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-300 origin-top no-print ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-4 text-right flex-1 w-full md:w-auto">
              <Link href="/hub" className="bg-slate-50 dark:bg-white/5 p-3.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border border-slate-200 dark:border-white/10 group shadow-inner shrink-0 outline-none">
                <LayoutGrid className="w-6 h-6 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
              <div className="w-px h-10 bg-slate-300 dark:bg-white/10 hidden md:block"></div>

              <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-500/20 dark:to-blue-900/40 border border-blue-200 dark:border-blue-500/30 w-14 h-14 rounded-[1.3rem] text-blue-600 dark:text-blue-400 shadow-inner flex items-center justify-center shrink-0">
                 <ArrowRightLeft className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] md:text-[24px] font-black text-slate-900 dark:text-white tracking-tight mb-1 truncate">مقارنة الفروع والأقسام</h2>
                <p className="text-[12px] md:text-[13px] font-bold text-slate-500 dark:text-slate-400 truncate">لوحة تحكم استراتيجية متقدمة لعرض ومقارنة حركة السحوبات.</p>
              </div>
            </div>
          </div>

          {/* 🟢 كروت المؤشرات العلوية (Premium KPIs) 🟢 */}
          {!dbError && !isLoading && (
            <div className={`grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 relative z-10 no-print transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none p-0' : 'scale-y-100 opacity-100'}`}>
              
              <div className="md:col-span-2 bg-white dark:bg-[#121214] p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 cursor-default">
                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-400 to-blue-600 rounded-r-3xl"></div>
                <div className="absolute top-0 left-0 w-48 h-48 bg-blue-100 dark:bg-blue-500/10 rounded-full blur-[50px] -ml-20 -mt-20 group-hover:scale-150 transition-transform duration-1000 pointer-events-none"></div>
                
                <div className="relative z-10 flex justify-between items-start mb-8">
                  <div className="bg-blue-50 dark:bg-blue-500/20 p-4 rounded-2xl text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 shadow-inner">
                    <Hash className="w-7 h-7" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/20 px-4 py-2 rounded-full border border-blue-200 dark:border-blue-500/30 shadow-sm backdrop-blur-md">إجمالي كميات السحب</span>
                </div>
                
                <div className="relative z-10 mt-auto">
                  <p className="text-6xl md:text-7xl font-black text-slate-900 dark:text-white dir-ltr text-left tracking-tighter drop-shadow-sm dark:drop-shadow-md">
                    {formatNum(analyticsData.totalAll)}
                  </p>
                </div>
              </div>

              <div className="md:col-span-1 bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 border border-amber-200 dark:border-amber-500/20 shadow-sm dark:shadow-[0_15px_40px_rgba(245,158,11,0.15)] flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden cursor-default">
                <div className="absolute top-0 left-0 w-32 h-32 bg-amber-100 dark:bg-amber-500/10 rounded-full blur-3xl -ml-10 -mt-10 pointer-events-none"></div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="bg-amber-50 dark:bg-amber-500/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 shadow-inner">
                    <Trophy className="w-7 h-7" />
                  </div>
                </div>
                <div className="relative z-10 mt-auto">
                  <p className="text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">أعلى كيان سحباً 👑</p>
                  <p className="text-3xl md:text-4xl font-black tracking-tight leading-tight truncate drop-shadow-sm dark:drop-shadow-md text-amber-600 dark:text-amber-400">{analyticsData.topPeriod ? analyticsData.topPeriod.name : 'لا توجد بيانات'}</p>
                </div>
              </div>

              <div className="md:col-span-1 bg-white dark:bg-[#121214] rounded-[2.5rem] p-8 border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-[0_15px_40px_rgba(16,185,129,0.15)] flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden cursor-default">
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-100 dark:bg-emerald-500/10 rounded-full blur-3xl -ml-10 -mt-10 pointer-events-none"></div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="bg-emerald-50 dark:bg-emerald-500/20 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-inner">
                    <Target className="w-7 h-7" />
                  </div>
                </div>
                <div className="relative z-10 mt-auto">
                  <p className="text-[12px] font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">متوسط السحب</p>
                  <p className="text-3xl md:text-4xl font-black tracking-tight dir-ltr text-right drop-shadow-sm dark:drop-shadow-md text-emerald-600 dark:text-emerald-400">~ {formatNum(analyticsData.average)}</p>
                </div>
              </div>

            </div>
          )}

          {/* 🟢 شريط التحكم العائم (Glassmorphism Command Bar) 🟢 */}
          <div className={`bg-white dark:bg-[#121214] p-5 md:p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] mb-8 flex flex-col xl:flex-row items-center justify-between gap-5 no-print relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none p-0' : 'scale-y-100 opacity-100'}`}>
            
            {/* التبويبات المدمجة */}
            <div className="flex items-center w-full xl:w-auto overflow-x-auto hide-scrollbar gap-2 bg-slate-50 dark:bg-[#0a0a0c] p-2 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-inner">
              <button onClick={() => setActiveTab('items')} className={`shrink-0 px-5 py-3 text-[12px] font-black rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'items' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-indigo-500 scale-[1.02]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 border border-transparent'}`}><Package className="w-4 h-4" /> الأصناف</button>
              <button onClick={() => setActiveTab('categories')} className={`shrink-0 px-5 py-3 text-[12px] font-black rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-indigo-500 scale-[1.02]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 border border-transparent'}`}><Layers className="w-4 h-4" /> الأقسام</button>
              <button onClick={() => setActiveTab('agencies')} className={`shrink-0 px-5 py-3 text-[12px] font-black rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'agencies' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-indigo-500 scale-[1.02]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 border border-transparent'}`}><Building2 className="w-4 h-4" /> الوكالات</button>
              <button onClick={() => setActiveTab('branches')} className={`shrink-0 px-5 py-3 text-[12px] font-black rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'branches' ? 'bg-indigo-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-indigo-500 scale-[1.02]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 border border-transparent'}`}><Store className="w-4 h-4" /> الفروع</button>
              
              <div className="w-1 h-6 bg-slate-300 dark:bg-white/10 mx-2 shrink-0 rounded-full hidden xl:block"></div>
              
              <button onClick={() => setActiveTab('daily')} className={`shrink-0 px-5 py-3 text-[12px] font-black rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'daily' ? 'bg-cyan-500 text-white dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(8,145,178,0.4)] border border-cyan-400 scale-[1.02]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 border border-transparent'}`}><CalendarDays className="w-4 h-4" /> يومي</button>
              <button onClick={() => setActiveTab('weekly')} className={`shrink-0 px-5 py-3 text-[12px] font-black rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'weekly' ? 'bg-cyan-500 text-white dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(8,145,178,0.4)] border border-cyan-400 scale-[1.02]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 border border-transparent'}`}><LayoutList className="w-4 h-4" /> أسبوعي</button>
              <button onClick={() => setActiveTab('monthly')} className={`shrink-0 px-5 py-3 text-[12px] font-black rounded-[1.5rem] transition-all duration-300 flex items-center gap-2 outline-none cursor-pointer active:scale-95 ${activeTab === 'monthly' ? 'bg-cyan-500 text-white dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(8,145,178,0.4)] border border-cyan-400 scale-[1.02]' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-white hover:bg-white dark:hover:bg-white/5 border border-transparent'}`}><Calendar className="w-4 h-4" /> شهري</button>
            </div>

            {/* التصدير والتركيز */}
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
               <div className="flex items-center gap-2.5 shrink-0 w-full xl:w-auto mt-2 md:mt-0 bg-slate-50 dark:bg-[#0a0a0c] p-2 rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-inner">
                   <button onClick={handleExportPDF} disabled={isExportingPDF} title="تصدير PDF" className={`flex items-center justify-center gap-2 px-5 h-12 rounded-[1.2rem] transition-all border outline-none cursor-pointer active:scale-95 ${isExportingPDF ? 'bg-slate-100 dark:bg-[#121214] border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 shadow-sm dark:shadow-inner hover:shadow-md dark:hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]'}`}>
                     {isExportingPDF ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />} PDF
                   </button>
                   <button onClick={handleExportExcel} title="تصدير إكسل" className="flex items-center justify-center gap-2 px-5 h-12 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-[1.2rem] hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all outline-none shadow-sm dark:shadow-inner cursor-pointer active:scale-95 hover:shadow-md dark:hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"><FileSpreadsheet className="w-5 h-5" /> Excel</button>
                   
                   <div className="w-px h-8 bg-slate-200 dark:bg-white/10 mx-1"></div>

                   <button onClick={() => setIsZenMode(true)} title="وضع التركيز" className="flex items-center justify-center gap-2 w-12 h-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 rounded-[1.2rem] hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-white transition-all outline-none shadow-sm dark:shadow-inner hidden md:flex cursor-pointer active:scale-95"><Eye className="w-5 h-5" /></button>
               </div>
            </div>
          </div>

          {/* 💡 الفلاتر الديناميكية الفخمة (Tabs بدل Dropdowns) 💡 */}
          <div className={`bg-white dark:bg-[#121214] p-6 rounded-[2.5rem] mb-8 border border-slate-200 dark:border-white/10 flex flex-col gap-5 w-full shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 origin-top no-print ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 p-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-white/5 pb-5">
              <div className="flex items-center gap-2 font-black text-slate-500 dark:text-slate-400 text-base">
                <Filter className="w-5 h-5 text-indigo-500 dark:text-cyan-400" /> فلترة وتحديد نطاق العرض:
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto relative">
                <div onClick={() => setDatePickerConfig({ isOpen: true, viewDate: dayjs(selectedDate), mode: isMonthPicker ? 'month' : 'date' })} className="relative h-14 w-full md:w-auto min-w-[200px] bg-slate-50 dark:bg-[#0a0a0c] rounded-[1.5rem] border border-slate-200 dark:border-cyan-500/20 shadow-sm dark:shadow-inner flex items-center px-4 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-indigo-300 dark:hover:border-cyan-500/40 transition-all cursor-pointer group active:scale-[0.98]">
                  <Calendar className="w-5 h-5 text-indigo-500 dark:text-cyan-500 ml-3 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col z-10 pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-cyan-500/70">المرجع الزمني</span>
                    <span className={`font-black text-[15px] dir-ltr text-right tracking-widest text-indigo-700 dark:text-cyan-300 drop-shadow-sm dark:drop-shadow-md`}>
                      {isMonthPicker ? dayjs(selectedDate).format('YYYY - MM') : dayjs(selectedDate).format('DD / MM / YYYY')}
                    </span>
                  </div>
                </div>

                {/* 💡 زر تصفير الفلاتر المصغر 💡 */}
                {(selectedAgency !== 'الكل' || selectedCategory !== 'الكل' || selectedItem !== 'الكل' || selectedBranch !== 'الكل' || selectedDate !== dayjs().startOf('month').format('YYYY-MM-DD')) && (
                  <div className="md:absolute md:left-0 md:-bottom-12 flex justify-end w-full md:w-auto mt-2 md:mt-0">
                    <button 
                      onClick={clearFilters} 
                      title="تصفير الفلاتر وإلغاء التحديد"
                      className="h-10 px-4 flex shrink-0 w-full md:w-auto items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:scale-105 active:scale-95 transition-all outline-none shadow-sm dark:shadow-inner font-black text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> مسح الفلاتر
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 💡 أزرار فلترة الوكالات (ديناميكية) 💡 */}
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => { setSelectedAgency('الكل'); setSelectedCategory('الكل'); setSelectedItem('الكل'); }}
                style={selectedAgency === 'الكل' ? {
                  backgroundColor: isDark ? '#06b6d4' : '#0ea5e9', color: isDark ? '#050505' : '#ffffff', borderColor: isDark ? '#06b6d4' : '#0ea5e9', boxShadow: `0 0 15px ${hexToRgba('#06b6d4', 0.4)}`, transform: 'scale(1.02)'
                } : {
                  backgroundColor: isDark ? '#0a0a0c' : '#f8fafc', color: isDark ? '#06b6d4' : '#0ea5e9', borderColor: isDark ? hexToRgba('#06b6d4', 0.3) : '#bae6fd', boxShadow: `inset 0 0 10px ${hexToRgba('#06b6d4', 0.05)}`
                }}
                className="px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-300 flex items-center gap-2 outline-none border cursor-pointer active:scale-95 hover:brightness-110"
              >
                <Building2 className="w-4 h-4" /> كل الوكالات
              </button>
              
              {uniqueAgenciesList.map(agency => {
                const isActive = selectedAgency === agency.name;
                const color = agency.color || '#06b6d4';
                return (
                  <button 
                    key={agency.name}
                    onClick={() => { setSelectedAgency(agency.name); setSelectedCategory('الكل'); setSelectedItem('الكل'); }}
                    style={isActive ? {
                      backgroundColor: color, color: isDark ? '#050505' : '#ffffff', borderColor: color, boxShadow: `0 0 15px ${hexToRgba(color, 0.4)}`, transform: 'scale(1.02)'
                    } : {
                      backgroundColor: isDark ? '#0a0a0c' : '#f8fafc', color: isDark ? '#e2e8f0' : '#475569', borderColor: isDark ? hexToRgba(color, 0.3) : '#cbd5e1', boxShadow: `inset 0 0 10px ${hexToRgba(color, 0.05)}`
                    }}
                    className="px-5 py-2.5 rounded-xl font-black text-sm transition-all duration-300 outline-none border cursor-pointer active:scale-95 hover:brightness-110"
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = color; e.currentTarget.style.borderColor = color; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = isDark ? '#e2e8f0' : '#475569'; e.currentTarget.style.borderColor = isDark ? hexToRgba(color, 0.3) : '#cbd5e1'; } }}
                  >
                    {agency.name}
                  </button>
                )
              })}
            </div>

            {/* 💡 أزرار فلترة الأقسام (ديناميكية بناءً على الوكالة) 💡 */}
            {quickCategoriesTabs.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => { setSelectedCategory('الكل'); setSelectedItem('الكل'); }}
                  style={selectedCategory === 'الكل' ? {
                    backgroundColor: isDark ? hexToRgba('#10b981', 0.15) : '#d1fae5', color: isDark ? '#10b981' : '#047857', borderColor: isDark ? '#10b981' : '#059669', boxShadow: `0 0 12px ${hexToRgba('#10b981', 0.3)}`, transform: 'scale(1.02)'
                  } : {
                    backgroundColor: isDark ? '#0a0a0c' : '#f8fafc', color: isDark ? '#10b981' : '#059669', borderColor: isDark ? hexToRgba('#10b981', 0.2) : '#a7f3d0'
                  }}
                  className="px-4 py-2.5 rounded-xl font-black text-xs transition-all duration-300 flex items-center gap-2 outline-none border cursor-pointer active:scale-95 hover:brightness-110"
                >
                  <Layers className="w-4 h-4" /> كل الأقسام
                </button>
                
                {quickCategoriesTabs.map(c => {
                  const isActive = selectedCategory === c.name;
                  const color = c.color || '#10b981';
                  return (
                    <button 
                      key={c.name}
                      onClick={() => { setSelectedCategory(c.name); setSelectedItem('الكل'); }}
                      style={isActive ? {
                        backgroundColor: isDark ? hexToRgba(color, 0.15) : hexToRgba(color, 0.1), color: isDark ? color : '#050505', borderColor: color, boxShadow: `0 0 12px ${hexToRgba(color, 0.3)}`, transform: 'scale(1.02)'
                      } : {
                        backgroundColor: isDark ? '#0a0a0c' : '#f8fafc', color: isDark ? '#cbd5e1' : '#475569', borderColor: isDark ? hexToRgba(color, 0.2) : '#cbd5e1'
                      }}
                      className="px-4 py-2.5 rounded-xl font-black text-xs transition-all duration-300 outline-none border flex items-center gap-1.5 group cursor-pointer active:scale-95 hover:brightness-110"
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = color; e.currentTarget.style.backgroundColor = isDark ? hexToRgba(color, 0.05) : hexToRgba(color, 0.1); } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = isDark ? '#cbd5e1' : '#475569'; e.currentTarget.style.backgroundColor = isDark ? '#0a0a0c' : '#f8fafc'; } }}
                    >
                      {c.name}
                      <span style={{ backgroundColor: isActive ? color : isDark ? hexToRgba(color, 0.1) : '#f1f5f9', color: isActive ? '#050505' : color }} className="px-1.5 py-0.5 rounded-md text-[10px] en-num transition-colors font-bold">
                        {c.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
               <FilterSelect icon={<Package/>} value={selectedItem} onChange={setSelectedItem} options={filterOptions.items} label="الصنف" />
               <FilterSelect icon={<Store/>} value={selectedBranch} onChange={setSelectedBranch} options={filterOptions.branches} label="الفرع" />
            </div>

          </div>

          {dbError && (
            <div className="bg-white dark:bg-[#121214] p-6 mb-8 rounded-[2rem] border border-rose-200 dark:border-rose-500/30 text-center text-rose-600 dark:text-rose-400 font-bold shadow-sm dark:shadow-md w-full no-print">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-rose-500" />
              <p className="text-lg">{dbError}</p>
            </div>
          )}

          {!dbError && isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-5 w-full">
              <Loader2 className="w-16 h-16 text-indigo-500 dark:text-cyan-500 animate-spin" />
              <p className="text-slate-500 font-black tracking-widest text-sm uppercase">جاري معالجة وبناء الجداول...</p>
            </div>
          ) : !dbError && (
            <div className={`transition-all duration-300 w-full relative z-10 ${isZenMode ? 'bg-white dark:bg-black border border-slate-200 dark:border-white/5 rounded-[2.5rem] shadow-none p-4' : 'bg-transparent'}`}>
              <div className="flex items-center justify-between mb-6 px-2 no-print">
                 <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 dark:bg-cyan-600/20 border border-indigo-200 dark:border-cyan-500/30 p-2.5 rounded-[1rem] shadow-sm dark:shadow-lg dark:shadow-cyan-500/10"><AlignLeft className="w-5 h-5 text-indigo-600 dark:text-cyan-400" /></div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">جدول البيانات المفصل</h3>
                    </div>
                 </div>
                 
                 <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 p-1.5 rounded-[1.2rem] shadow-sm dark:shadow-inner flex gap-1">
                   <button onClick={() => setLayoutView('grid')} className={`p-2 rounded-xl transition-all outline-none cursor-pointer active:scale-95 ${layoutView === 'grid' ? 'bg-indigo-100 dark:bg-cyan-500/20 text-indigo-700 dark:text-cyan-400 shadow-sm border border-indigo-200 dark:border-cyan-500/30' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}><LayoutGrid className="w-5 h-5" /></button>
                   <button onClick={() => setLayoutView('table')} className={`p-2 rounded-xl transition-all outline-none cursor-pointer active:scale-95 ${layoutView === 'table' ? 'bg-indigo-100 dark:bg-cyan-500/20 text-indigo-700 dark:text-cyan-400 shadow-sm border border-indigo-200 dark:border-cyan-500/30' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}><LayoutList className="w-5 h-5" /></button>
                 </div>
              </div>

              {analyticsData.list.length === 0 ? (
                 <div className="py-32 text-center text-slate-500 bg-white dark:bg-[#0a0a0c] rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/10 shadow-sm dark:shadow-inner">
                   <Archive className="w-20 h-20 mx-auto mb-5 opacity-30 text-indigo-500 dark:text-cyan-500" />
                   <p className="text-2xl font-black text-slate-800 dark:text-white">لا توجد بيانات مطابقة للفلاتر المحددة.</p>
                 </div>
              ) : layoutView === 'table' ? (
                 
                 /* 🟢 عرض الجدول الفخم (Floating Rows Table) 🟢 */
                 <div className={`overflow-x-auto w-full custom-scrollbar pb-10 ${isZenMode ? 'min-h-[85vh]' : ''}`}>
                   <table className="w-full text-right border-separate" style={{ borderSpacing: '0 12px' }}>
                     <thead className="sticky top-0 z-20">
                       <tr className="text-slate-500 dark:text-slate-400 text-[12px] font-black uppercase tracking-widest">
                         <th className="px-6 w-20 text-center pb-2">المركز</th>
                         <th className="px-6 w-[25%] pb-2">{entityColumnName}</th>
                         <th className="px-6 w-[20%] text-center pb-2">إجمالي السحب</th>
                         <th className="px-6 w-[15%] text-center pb-2">مؤشر النمو</th>
                         <th className="px-6 w-[25%] text-right pb-2">{topItemsLabel}</th>
                         <th className="px-6 w-24 text-center pb-2">تفاصيل</th>
                       </tr>
                     </thead>
                     <tbody className="text-[14px]">
                       {analyticsData.list.map((item: any, idx: number) => {
                         const isZero = item.total === 0;
                         const topComponents = getTopComponentsData(item);
                         const isExpanded = expandedPeriod === idx;
                         
                         return (
                           <React.Fragment key={idx}>
                             <tr 
                               onClick={() => !isZero && toggleExpand(idx)}
                               className={`group transition-all duration-300 ${isExpanded ? 'bg-indigo-50 dark:bg-cyan-500/10 shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-indigo-200 dark:ring-cyan-500/30' : 'bg-white dark:bg-[#121214] shadow-sm dark:shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)] hover:bg-slate-50 dark:hover:bg-[#1e1e2d] hover:shadow-md dark:hover:shadow-[0_8px_30px_-5px_rgba(0,0,0,0.5)] cursor-pointer hover:-translate-y-0.5'} ${isZero ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                             >
                               <td className="py-5 px-6 text-center rounded-r-[2rem] border-y border-r border-slate-200 dark:border-white/5">
                                 {idx === 0 ? <div className="w-10 h-10 mx-auto bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded-full flex items-center justify-center font-black shadow-inner"><Award className="w-5 h-5" /></div> :
                                  idx === 1 ? <div className="w-10 h-10 mx-auto bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-500/30 rounded-full flex items-center justify-center font-black shadow-inner text-base">2</div> :
                                  idx === 2 ? <div className="w-10 h-10 mx-auto bg-orange-50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 rounded-full flex items-center justify-center font-black shadow-inner text-base">3</div> :
                                  <div className="text-slate-500 font-bold en-num text-base">{idx + 1}</div>}
                               </td>

                               <td className="py-5 px-6 border-y border-slate-200 dark:border-white/5">
                                 <div className="flex items-center gap-4">
                                   <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center text-xl shadow-inner border ${item.isHighest ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10'}`}>
                                     {activeTab === 'branches' ? '🏪' : activeTab === 'agencies' ? '🏢' : activeTab === 'categories' ? '📂' : isTimeTab ? '📅' : getSmartIcon(item.name)}
                                   </div>
                                   <div>
                                     <h4 className={`font-black text-[15px] md:text-[16px] tracking-tight ${item.isHighest ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{item.name}</h4>
                                     <span className="text-[11px] font-bold text-slate-500 block mt-1">{item.subLabel}</span>
                                   </div>
                                 </div>
                               </td>

                               <td className="py-5 px-6 border-y border-slate-200 dark:border-white/5">
                                 <div className="flex flex-col items-center gap-2">
                                   <span className="font-black text-xl text-slate-900 dark:text-white en-num dir-ltr drop-shadow-sm">{formatNum(item.total)}</span>
                                   <div className="w-32 h-1.5 bg-slate-100 dark:bg-[#0a0a0c] rounded-full overflow-hidden shadow-inner border border-slate-200 dark:border-white/5">
                                     <div className={`h-full rounded-full transition-all duration-1000 shadow-sm dark:shadow-[0_0_10px_rgba(255,255,255,0.5)] ${item.isHighest ? 'bg-amber-400' : item.isAboveAverage ? 'bg-indigo-500 dark:bg-cyan-500' : 'bg-slate-400 dark:bg-slate-500'}`} style={{ width: `${item.percentageOfMax}%` }}></div>
                                   </div>
                                 </div>
                               </td>

                               <td className="py-5 px-6 text-center border-y border-slate-200 dark:border-white/5">
                                 {!isZero && <TrendIndicator trend={item.trend} history={item.history} isRow={true} />}
                               </td>

                               <td className="py-5 px-6 border-y border-slate-200 dark:border-white/5">
                                 <div className="flex flex-wrap gap-2 justify-start">
                                   {topComponents.length > 0 ? topComponents.slice(0, 3).map((comp: any, cIdx: number) => (
                                      <div key={cIdx} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 px-2.5 py-1.5 rounded-xl flex items-center gap-2 group-hover:border-indigo-300 dark:group-hover:border-cyan-500/30 transition-colors shadow-sm dark:shadow-inner">
                                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 truncate max-w-[100px]" title={comp.name}>{comp.name}</span>
                                        <span className="bg-indigo-50 dark:bg-cyan-500/20 border border-indigo-100 dark:border-cyan-500/30 shadow-sm dark:shadow-inner text-[10px] font-black text-indigo-600 dark:text-cyan-300 px-2 py-0.5 rounded-lg en-num">{formatNum(comp.total || comp.qty)}</span>
                                      </div>
                                   )) : <span className="text-[12px] text-slate-500 font-bold">لا توجد تفاصيل</span>}
                                   {topComponents.length > 3 && <div className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 px-2 py-1 rounded-xl text-[11px] font-black text-slate-500 flex items-center shadow-sm dark:shadow-inner">+{topComponents.length - 3}</div>}
                                 </div>
                               </td>

                               <td className="py-5 px-6 text-center rounded-l-[2rem] border-y border-l border-slate-200 dark:border-white/5">
                                 {!isZero && (
                                   <button className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto transition-all outline-none cursor-pointer active:scale-95 ${isExpanded ? 'bg-indigo-600 text-white dark:bg-cyan-600 dark:text-white shadow-md dark:shadow-[0_0_15px_rgba(8,145,178,0.5)] border border-indigo-500 dark:border-cyan-400' : 'bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/10 text-slate-500 group-hover:bg-indigo-50 dark:group-hover:bg-cyan-500/20 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 group-hover:border-indigo-200 dark:group-hover:border-cyan-500/30'}`}>
                                     <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                   </button>
                                 )}
                               </td>
                             </tr>

                             {/* 🟢 الدرج التفصيلي المنسدل 🟢 */}
                             {isExpanded && !isZero && (
                               <tr>
                                 <td colSpan={6} className="p-0">
                                   <div className="px-4 pb-4 animate-in slide-in-from-top-4 duration-300 -mt-2">
                                      <div className="bg-white dark:bg-[#0a0a0c] rounded-[2rem] border border-indigo-100 dark:border-cyan-500/20 shadow-sm dark:shadow-[inset_0_0_20px_rgba(8,145,178,0.05)] overflow-hidden flex flex-col xl:flex-row relative z-0">
                                        
                                        <div className="flex-1 p-6 md:p-8 border-b xl:border-b-0 xl:border-l border-slate-100 dark:border-white/5 relative">
                                           <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
                                           <div className="flex items-center justify-between mb-6">
                                              <h5 className="font-black text-[16px] text-slate-900 dark:text-white flex items-center gap-2">
                                                <ReceiptText className="w-5 h-5 text-indigo-500 dark:text-cyan-500" /> أحدث الطلبيات المسجلة
                                              </h5>
                                              <span className="text-[12px] font-bold bg-indigo-50 dark:bg-cyan-500/10 text-indigo-600 dark:text-cyan-400 px-4 py-1.5 rounded-full border border-indigo-100 dark:border-cyan-500/20 shadow-sm dark:shadow-inner flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" /> ساعة الذروة: <span className="dir-ltr inline-block font-black">{item.peakHourStr}</span>
                                              </span>
                                           </div>
                                           
                                           <div className="overflow-x-auto custom-scrollbar rounded-[1.5rem] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner bg-slate-50 dark:bg-[#121214]">
                                             <table className="w-full text-right border-collapse">
                                               <thead className="bg-slate-100 dark:bg-[#050505] text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">
                                                 <tr>
                                                   <th className="py-4 px-5">ت</th>
                                                   <th className="py-4 px-5">الفرع</th>
                                                   <th className="py-4 px-5">التاريخ والوقت</th>
                                                   <th className="py-4 px-5 text-center">إجمالي السلة</th>
                                                 </tr>
                                               </thead>
                                               <tbody className="text-[13px] font-bold text-slate-700 dark:text-slate-300 divide-y divide-slate-200 dark:divide-white/5">
                                                  {item.rawOrders.length === 0 ? (
                                                    <tr><td colSpan={4} className="py-10 text-center text-slate-500">لا توجد طلبيات مفصلة.</td></tr>
                                                  ) : (
                                                    item.rawOrders.slice(0, 5).map((ro: any, roIdx: number) => {
                                                      const orderTotal = (ro.order_details || []).reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0) || 0;
                                                      if(orderTotal === 0) return null;
                                                      const isBigOrder = orderTotal > (item.averageOrderSize * 1.5) && orderTotal > 10;
                                                      
                                                      return (
                                                        <tr key={roIdx} className="hover:bg-white dark:hover:bg-white/5 transition-colors">
                                                          <td className="py-3.5 px-5 en-num text-slate-500">{roIdx + 1}</td>
                                                          <td className="py-3.5 px-5 font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                            {ro.branches?.name || '-'}
                                                            {isBigOrder && <span title="طلبية ضخمة"><Flame className="w-4 h-4 text-orange-500 drop-shadow-sm" /></span>}
                                                          </td>
                                                          <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400 dir-ltr text-right"><span className="bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/5 px-2 py-1 rounded-md shadow-sm dark:shadow-inner">{dayjs(ro.created_at).format('YYYY-MM-DD | hh:mm A')}</span></td>
                                                          <td className="py-3.5 px-5 text-center">
                                                            <span className="bg-indigo-50 dark:bg-cyan-500/10 text-indigo-600 dark:text-cyan-400 font-black px-3 py-1.5 rounded-xl en-num border border-indigo-100 dark:border-cyan-500/20 shadow-sm dark:shadow-inner">{formatNum(orderTotal)}</span>
                                                          </td>
                                                        </tr>
                                                      )
                                                    })
                                                  )}
                                               </tbody>
                                             </table>
                                           </div>
                                           {item.rawOrders.length > 5 && (
                                              <div className="mt-4 text-center">
                                                <button onClick={handleExportExcel} className="text-[12px] font-black text-indigo-600 dark:text-cyan-500 hover:text-indigo-500 dark:hover:text-cyan-400 bg-indigo-50 dark:bg-cyan-500/10 px-4 py-2 rounded-full transition-colors border border-indigo-100 dark:border-cyan-500/20 hover:shadow-sm dark:hover:shadow-[0_0_10px_rgba(6,182,212,0.2)] outline-none cursor-pointer active:scale-95">تم إخفاء +{item.rawOrders.length - 5} طلبية (حمل ملف الإكسل للتفاصيل)</button>
                                              </div>
                                           )}
                                        </div>

                                        <div className="w-full xl:w-[400px] p-6 md:p-8 bg-slate-50 dark:bg-[#121214]/50">
                                           <h5 className="font-black text-[14px] text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                              <PieChart className="w-5 h-5 text-indigo-500 dark:text-cyan-500" /> التحليل الهيكلي التفصيلي
                                           </h5>
                                           <div className="flex flex-col gap-5">
                                              {topComponents.slice(0, 5).map((comp: any, cIdx: number) => {
                                                const compQty = comp.total || comp.qty || 0;
                                                const compPct = (compQty / item.total) * 100;
                                                const colorClass = COLORS_1[cIdx % COLORS_1.length];
                                                const pureColor = colorClass.split(' ')[1].replace('text-', ''); 
                                                
                                                return (
                                                  <div key={cIdx} className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-center text-[13px] font-black text-slate-700 dark:text-slate-300">
                                                      <span className="truncate max-w-[200px] flex items-center gap-1.5">
                                                        <span className={`w-2 h-2 rounded-full bg-${pureColor}`}></span>
                                                        {comp.name}
                                                      </span>
                                                      <div className="flex items-center gap-2.5">
                                                        <span className="text-slate-500 en-num text-[11px]">{Math.round(compPct)}%</span>
                                                        <span className="bg-white dark:bg-[#050505] border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner px-2.5 py-1 rounded-lg en-num text-indigo-600 dark:text-cyan-400">{formatNum(compQty)}</span>
                                                      </div>
                                                    </div>
                                                    <div className="w-full h-2 bg-slate-200 dark:bg-[#050505] rounded-full overflow-hidden shadow-inner border border-slate-300 dark:border-white/5">
                                                      <div className={`h-full rounded-full bg-${pureColor} shadow-sm dark:shadow-[0_0_5px_currentColor]`} style={{ width: `${compPct}%` }}></div>
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                           </div>
                                        </div>

                                      </div>
                                   </div>
                                 </td>
                               </tr>
                             )}

                           </React.Fragment>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
              ) : (
                 /* 🟢 عرض الكروت الشبكية (Grid View) 🟢 */
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-2">
                   {analyticsData.list.map((item: any, idx: number) => {
                      const isZero = item.total === 0;
                      if(isZero) return null;
                      const topComponents = getTopComponentsData(item);

                      return (
                        <div key={idx} className={`bg-white dark:bg-[#121214] p-6 rounded-[2rem] border transition-all duration-300 flex flex-col justify-between ${item.isHighest ? 'border-amber-400 dark:border-amber-500/40 shadow-md dark:shadow-[0_0_20px_rgba(245,158,11,0.2)] bg-gradient-to-b from-amber-50 to-white dark:from-[#121214] dark:to-amber-900/10' : 'border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_5px_15px_-5px_rgba(0,0,0,0.3)] hover:shadow-md dark:hover:shadow-[0_8px_30px_-5px_rgba(0,0,0,0.5)] hover:-translate-y-1 hover:border-indigo-200 dark:hover:border-white/20'}`}>
                           
                           <div className="flex justify-between items-start mb-5">
                              <div className="flex items-center gap-3">
                                 <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center text-xl shadow-inner border ${item.isHighest ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400' : 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/10 text-slate-800 dark:text-white'}`}>
                                    {activeTab === 'branches' ? '🏪' : activeTab === 'agencies' ? '🏢' : activeTab === 'categories' ? '📂' : isTimeTab ? '📅' : getSmartIcon(item.name)}
                                 </div>
                                 <div>
                                   <h4 className={`font-black text-[16px] tracking-tight ${item.isHighest ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{item.name} {item.isHighest && '👑'}</h4>
                                   <span className="text-[11px] font-bold text-slate-500 block mt-0.5">{item.subLabel}</span>
                                 </div>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-2xl text-slate-900 dark:text-white en-num dir-ltr block drop-shadow-sm">{formatNum(item.total)}</span>
                                <TrendIndicator trend={item.trend} history={item.history} isRow={false} />
                              </div>
                           </div>

                           <div className="mb-5">
                             <div className="flex justify-between text-[11px] font-black text-slate-500 mb-2">
                               <span>مؤشر الحجم</span>
                               <span className="dir-ltr text-indigo-600 dark:text-cyan-400">{Math.round(item.percentageOfMax)}%</span>
                             </div>
                             <div className="w-full bg-slate-100 dark:bg-[#0a0a0c] h-2 rounded-full overflow-hidden shadow-inner border border-slate-200 dark:border-white/5">
                               <div className={`h-full rounded-full transition-all duration-1000 shadow-sm dark:shadow-[0_0_8px_rgba(255,255,255,0.4)] ${item.isHighest ? 'bg-amber-400' : item.isAboveAverage ? 'bg-indigo-500 dark:bg-cyan-500' : 'bg-slate-400 dark:bg-slate-500'}`} style={{ width: `${item.percentageOfMax}%` }}></div>
                             </div>
                           </div>

                           <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5">
                             <span className="text-[11px] font-black text-slate-500 mb-2.5 block uppercase tracking-wider">{topItemsLabel}:</span>
                             <div className="flex flex-col gap-2">
                               {topComponents.length > 0 ? topComponents.slice(0, 3).map((comp: any, cIdx: number) => (
                                  <div key={cIdx} className="bg-slate-50 dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 px-3 py-2 rounded-xl flex items-center justify-between group-hover:border-indigo-200 dark:group-hover:border-cyan-500/20 transition-colors shadow-sm dark:shadow-inner">
                                    <span className="text-[12px] font-black text-slate-800 dark:text-slate-300 truncate max-w-[150px]" title={comp.name}>{comp.name}</span>
                                    <span className="bg-indigo-50 dark:bg-cyan-500/10 border border-indigo-100 dark:border-cyan-500/20 shadow-sm dark:shadow-inner text-[11px] font-black text-indigo-600 dark:text-cyan-400 px-2.5 py-1 rounded-lg en-num">{formatNum(comp.total || comp.qty)}</span>
                                  </div>
                               )) : <span className="text-[12px] text-slate-500 font-bold text-center block w-full py-2">لا توجد تفاصيل</span>}
                             </div>
                           </div>

                        </div>
                      )
                   })}
                 </div>
              )}
              
            </div>
          )}

          {/* 🟢 خريطة الكثافة (Heatmap) 🟢 */}
          {!dbError && !isLoading && (
            <div className={`bg-white dark:bg-[#121214] p-6 md:p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] mt-8 mb-10 no-print relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 m-0 overflow-hidden border-none p-0' : 'scale-y-100 opacity-100'}`}>
              <div>
                <h4 className="text-[16px] font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 dark:bg-cyan-500/20 rounded-xl border border-indigo-100 dark:border-cyan-500/30 shadow-inner"><Grid className="w-5 h-5 text-indigo-600 dark:text-cyan-400" /></div>
                  خريطة كثافة السحوبات (Heatmap)
                </h4>
                <p className="text-[12px] font-bold text-slate-500">تحليل التوزيع اليومي للسحوبات خلال {dayjs(selectedDate).format('MMMM YYYY')}</p>
              </div>
              
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {monthHeatmap.daysData.map((d: any, i: number) => {
                   const intensity = (d.total / monthHeatmap.maxDayTotal) * 100;
                   let bgClass = 'bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-600'; 
                   if (intensity > 80) bgClass = 'bg-indigo-600 dark:bg-cyan-500 border-indigo-500 dark:border-cyan-400 shadow-md dark:shadow-[0_0_15px_rgba(6,182,212,0.6)] text-white dark:text-[#050505]';
                   else if (intensity > 50) bgClass = 'bg-indigo-400 dark:bg-cyan-500/80 border-indigo-400 dark:border-cyan-500 text-white dark:text-[#050505]';
                   else if (intensity > 25) bgClass = 'bg-indigo-200 dark:bg-cyan-500/40 border-indigo-300 dark:border-cyan-500/50 text-indigo-800 dark:text-cyan-100';
                   else if (intensity > 0) bgClass = 'bg-indigo-100 dark:bg-cyan-500/20 border-indigo-200 dark:border-cyan-500/30 text-indigo-600 dark:text-cyan-400';

                   return (
                     <div 
                       key={i} 
                       title={`${d.date} | السحب: ${d.total}`} 
                       className={`w-8 h-8 md:w-10 md:h-10 rounded-xl border flex items-center justify-center text-[10px] md:text-[11px] font-black en-num cursor-pointer active:scale-95 hover:ring-4 hover:ring-indigo-200 dark:hover:ring-cyan-400/30 hover:scale-110 transition-all duration-300 shadow-sm dark:shadow-inner ${bgClass}`} 
                     >
                       {i + 1}
                     </div>
                   );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 💡 زر الخروج من وضع التركيز 💡 */}
        {isZenMode && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999999] animate-in slide-in-from-bottom-10 fade-in duration-300 no-print">
            <button 
              onClick={() => setIsZenMode(false)}
              className="flex items-center gap-2 bg-slate-900 text-white dark:bg-white dark:text-black px-6 py-3.5 rounded-full font-black text-sm shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer"
            >
              <EyeOff className="w-5 h-5" /> إنهاء وضع التركيز
            </button>
          </div>
        )}

        {/* 🟢 التقويم المؤسساتي الشامل المبرمج (معدل للتمركز بالمنتصف) 🟢 */}
        {datePickerConfig.isOpen && !isZenMode && (
          <div className="fixed top-0 left-0 w-full h-[100dvh] z-[999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden no-print">
            <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl dark:shadow-[0_0_50px_rgba(34,211,238,0.1)] animate-in zoom-in-95 duration-300">
              
              <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/5 pb-5 shrink-0">
                <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-cyan-500/10 hover:bg-slate-100 dark:hover:bg-cyan-500/20 rounded-xl text-indigo-600 dark:text-cyan-400 transition-colors border border-transparent outline-none cursor-pointer active:scale-95">
                  <ChevronRight className="w-5 h-5"/>
                </button>
                
                <div className="flex gap-2 items-center">
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                     className={`text-[16px] font-black transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'month' ? 'text-indigo-600 dark:text-cyan-400 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-cyan-300'}`}
                   >
                     {datePickerConfig.viewDate.format('MMMM')}
                   </button>
                   <span className="text-slate-400 dark:text-slate-600">-</span>
                   <button 
                     onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                     className={`text-[18px] font-black en-num transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'year' ? 'text-indigo-600 dark:text-cyan-400 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : 'text-slate-600 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-cyan-300'}`}
                   >
                     {datePickerConfig.viewDate.format('YYYY')}
                   </button>
                </div>

                <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-cyan-500/10 hover:bg-slate-100 dark:hover:bg-cyan-500/20 rounded-xl text-indigo-600 dark:text-cyan-400 transition-colors border border-transparent outline-none cursor-pointer active:scale-95">
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
                        onClick={() => setDatePickerConfig(p => ({...p, viewDate: p.viewDate.year(year), mode: 'month'}))}
                        className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none cursor-pointer ${isSelected ? 'bg-indigo-600 text-white dark:bg-cyan-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-50 dark:bg-cyan-500/5 text-slate-600 dark:text-cyan-400/70 hover:bg-slate-100 dark:hover:bg-cyan-500/15 hover:text-indigo-600 dark:hover:text-cyan-300 border border-slate-200 dark:border-cyan-500/10'}`}
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
                        className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 outline-none cursor-pointer flex flex-col items-center gap-1.5 ${isSelected ? 'bg-indigo-600 text-white dark:bg-cyan-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'bg-slate-50 dark:bg-cyan-500/5 text-slate-600 dark:text-cyan-400/70 hover:bg-slate-100 dark:hover:bg-cyan-500/15 hover:text-indigo-600 dark:hover:text-cyan-300 border border-slate-200 dark:border-cyan-500/10'}`}
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
                      <div key={d} className="text-center text-[10px] font-black text-slate-400 dark:text-cyan-500/50 uppercase tracking-widest">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: datePickerConfig.viewDate.startOf('month').day() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {Array.from({ length: datePickerConfig.viewDate.daysInMonth() }).map((_, i) => {
                      const dayNum = i + 1;
                      const dateStr = datePickerConfig.viewDate.date(dayNum).format('YYYY-MM-DD');
                      const isSelected = dateStr === selectedDate;
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dayNum}
                          onClick={() => handleDateSelection(dateStr)}
                          className={`
                            aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num transition-all active:scale-95 outline-none cursor-pointer
                            ${isSelected ? 'bg-indigo-600 text-white dark:bg-cyan-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(34,211,238,0.4)]' :
                              isToday ? 'text-indigo-600 border border-indigo-300 bg-indigo-50 dark:text-cyan-300 dark:border-cyan-500/30 dark:bg-cyan-500/20' :
                              'text-slate-700 hover:bg-slate-100 hover:text-indigo-600 dark:text-cyan-400/80 dark:hover:bg-cyan-500/15 dark:hover:text-cyan-300 border border-transparent'}
                          `}
                        >
                          {dayNum}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <button onClick={() => setDatePickerConfig(p => ({...p, isOpen: false}))} className="w-full mt-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400/80 dark:hover:text-rose-400 rounded-2xl font-black text-[15px] transition-colors border border-transparent dark:border-rose-500/20 outline-none cursor-pointer active:scale-95 shadow-sm dark:shadow-inner shrink-0">
                إلغاء النافذة
              </button>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;700;900&display=swap');
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        html.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        .en-num { font-family: system-ui, -apple-system, sans-serif; direction: ltr; display: inline-block; }
      `}} />
    </div>
  );
}