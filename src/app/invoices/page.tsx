"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider'; // 💡 استيراد الثيم 💡
import { 
  ClipboardList, Loader2, Store, Calendar, Printer, Download, 
  Building2, PackageOpen, CheckCircle2, ChevronDown, Flame, Info, 
  Sparkles, Settings, MoveHorizontal, RefreshCw, AlertCircle, 
  CalendarDays, History, ChevronRight, ChevronLeft, DollarSign,
  FileSpreadsheet, Eye, EyeOff // 💡 تم إضافة أيقونات وضع التركيز
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

// 💡 استدعاء مكتبة الطباعة الذكية 💡
import { useReactToPrint } from 'react-to-print';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

dayjs.locale('ar');

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// 💡 دوال تنسيق الأرقام والأسعار لتكون واضحة وصحيحة 💡
const roundNumber = (num: number) => Math.round(num * 1000) / 1000;
const formatQty = (num: number) => Number(num).toLocaleString('en-US', { maximumFractionDigits: 3 });
const formatMoney = (num: number) => Number(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const getColLetter = (colIndex: number) => {
  let temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor((colIndex - temp - 1) / 26);
  }
  return letter;
};

const defaultPdfSettings = {
  paperSize: 'A4',
  margin: '5mm',
  zoom: 85,
  shiftX: 0,
  autoFit: false, 
  masonryCols: 2, 
  seqWidth: 6,
  itemWidth: 38,
  unitWidth: 14,
  qtyWidth: 14,
  priceWidth: 14, 
  totalWidth: 14  
};

export default function BranchDeliveryNotePage() {
  const { isDark } = useTheme(); // 💡 تفعيل الثيم
  const [isZenMode, setIsZenMode] = useState(false); // 💡 وضع التركيز

  const [agenciesList, setAgenciesList] = useState<any[]>([]);
  const [agenciesMap, setAgenciesMap] = useState<Record<string, string>>({});
  const [allBranches, setAllBranches] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [selectedAgency, setSelectedAgency] = useState<string>('الكل');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [activeDateRange, setActiveDateRange] = useState<string>('1');

  const [datePickerConfig, setDatePickerConfig] = useState<{
    isOpen: boolean, 
    viewDate: dayjs.Dayjs, 
    mode: 'date' | 'month' | 'year',
    target: 'start' | 'end' | 'monthOnly' | null
  }>({ isOpen: false, viewDate: dayjs(), mode: 'date', target: null });

  const [invoiceData, setInvoiceData] = useState<any[]>([]);
  const [fetchedOrderIds, setFetchedOrderIds] = useState<string>('');
  const [totalOrdersCount, setTotalOrdersCount] = useState<number>(0);
  
  const [showPrices, setShowPrices] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  
  const [showPdfHint, setShowPdfHint] = useState(false);
  const [showPdfSettings, setShowPdfSettings] = useState<boolean>(false);
  const [pdfSettings, setPdfSettings] = useState(defaultPdfSettings);
  const [isMounted, setIsMounted] = useState(false);

  const exportPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const savedSettings = localStorage.getItem('branchDeliveryPdfSettings_v1');
    if (savedSettings) {
      try { 
        const parsed = JSON.parse(savedSettings);
        setPdfSettings({ ...defaultPdfSettings, ...parsed }); 
      } catch (e) { console.error(e); }
    }
    applyDateRange('1', dayjs());
  }, []);

  useEffect(() => {
    if (isMounted) localStorage.setItem('branchDeliveryPdfSettings_v1', JSON.stringify(pdfSettings));
  }, [pdfSettings, isMounted]);

  const updatePdfSetting = (key: keyof typeof defaultPdfSettings, value: any) => {
    setPdfSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetPdfSettings = () => setPdfSettings(defaultPdfSettings);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: agenciesData } = await supabase.from('agencies').select('id, name');
      setAgenciesList(agenciesData || []);
      
      const agMap: Record<string, string> = {};
      agenciesData?.forEach(ag => { agMap[ag.id] = ag.name; });
      setAgenciesMap(agMap);

      const { data: branchesData } = await supabase.from('branches').select('id, name, agency_id').order('name');
      setAllBranches(branchesData || []);
      
    } catch (err: any) {
      setDbError(err?.message || "حدث خطأ أثناء تحميل الفروع.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredBranches = useMemo(() => {
    if (selectedAgency === 'الكل') return allBranches;
    return allBranches.filter(b => b.agency_id === selectedAgency);
  }, [allBranches, selectedAgency]);

  useEffect(() => {
    if (filteredBranches.length > 0) setSelectedBranch(filteredBranches[0].id);
    else setSelectedBranch('');
  }, [filteredBranches]);

  const applyDateRange = (type: '1' | '7' | '14' | '21' | 'month' | 'all' | 'custom', refMonth: dayjs.Dayjs = selectedMonth) => {
    setActiveDateRange(type);
    setSelectedMonth(refMonth);
    
    if (type === '1') { 
      setStartDate(dayjs().format('YYYY-MM-DD')); 
      setEndDate(dayjs().format('YYYY-MM-DD')); 
    }
    else if (type === '7') { 
      setStartDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
      let end = refMonth.startOf('month').add(6, 'day');
      if (end.month() !== refMonth.month()) end = refMonth.endOf('month'); 
      setEndDate(end.format('YYYY-MM-DD')); 
    }
    else if (type === '14') { 
      setStartDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
      let end = refMonth.startOf('month').add(13, 'day');
      if (end.month() !== refMonth.month()) end = refMonth.endOf('month');
      setEndDate(end.format('YYYY-MM-DD')); 
    }
    else if (type === '21') { 
      setStartDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
      let end = refMonth.startOf('month').add(20, 'day');
      if (end.month() !== refMonth.month()) end = refMonth.endOf('month');
      setEndDate(end.format('YYYY-MM-DD')); 
    }
    else if (type === 'month') { 
      setStartDate(refMonth.startOf('month').format('YYYY-MM-DD')); 
      setEndDate(refMonth.endOf('month').format('YYYY-MM-DD')); 
    }
    else if (type === 'all') { 
      setStartDate(''); setEndDate(''); 
    }
  };

  const shiftMonth = (direction: number) => {
    const newMonth = selectedMonth.add(direction, 'month');
    const rangeToApply = ['1', '7', '14', '21', 'month'].includes(activeDateRange) ? activeDateRange : 'month';
    applyDateRange(rangeToApply as any, newMonth);
  };

  const openDatePicker = (target: 'start' | 'end' | 'monthOnly') => {
    const initialDate = target === 'monthOnly' ? selectedMonth.format('YYYY-MM-DD') : (target === 'start' ? (startDate || dayjs().format('YYYY-MM-DD')) : (endDate || dayjs().format('YYYY-MM-DD')));
    setDatePickerConfig({ isOpen: true, viewDate: dayjs(initialDate), mode: target === 'monthOnly' ? 'month' : 'date', target });
  };

  const handleDateSelection = (dateStr: string) => {
    if (datePickerConfig.target === 'start') {
      setStartDate(dateStr);
      if (endDate && dateStr > endDate) setEndDate(dateStr);
      setActiveDateRange('custom');
      setSelectedMonth(dayjs(dateStr));
    } else if (datePickerConfig.target === 'end') {
      setEndDate(dateStr);
      if (startDate && dateStr < startDate) setStartDate(dateStr);
      setActiveDateRange('custom');
    }
    setDatePickerConfig(p => ({ ...p, isOpen: false }));
  };

  const handleMonthSelection = (newDate: dayjs.Dayjs) => {
    if (datePickerConfig.target === 'monthOnly') {
       const rangeToApply = ['1', '7', '14', '21', 'month'].includes(activeDateRange) ? activeDateRange : 'month';
       applyDateRange(rangeToApply as any, newDate);
       setDatePickerConfig(p => ({ ...p, isOpen: false }));
    } else {
       setDatePickerConfig(p => ({...p, viewDate: newDate, mode: 'date'}));
    }
  };

  const handlePrevCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.subtract(16, 'year') : p.mode === 'month' ? p.viewDate.subtract(1, 'year') : p.viewDate.subtract(1, 'month')}));
  const handleNextCalendar = () => setDatePickerConfig(p => ({...p, viewDate: p.mode === 'year' ? p.viewDate.add(16, 'year') : p.mode === 'month' ? p.viewDate.add(1, 'year') : p.viewDate.add(1, 'month')}));

  const generateInvoice = async () => {
    if (!selectedBranch || !startDate || !endDate) return alert("يرجى تحديد الفرع ونطاق التاريخ!");
    
    setIsGenerating(true);
    setInvoiceData([]);
    setFetchedOrderIds('');
    setTotalOrdersCount(0);
    
    try {
      const startOfDay = dayjs(startDate).startOf('day').toISOString();
      const endOfDay = dayjs(endDate).endOf('day').toISOString();

      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id, status, created_at,
          order_details (quantity, items (id, name, main_unit, categories(name, sequence), sequence))
        `)
        .eq('branch_id', selectedBranch)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .neq('status', 'rejected');

      if (error) throw error;

      const itemsMap = new Map();
      
      ordersData?.forEach(order => {
        order.order_details?.forEach((detail: any) => {
          const itemId = detail.items?.id;
          const qty = parseFloat(detail.quantity) || 0;
          const initialPrice = 0; 
          
          if (!itemsMap.has(itemId)) {
            itemsMap.set(itemId, {
              id: itemId,
              name: detail.items?.name,
              unit: detail.items?.main_unit || '-',
              price: initialPrice,
              priceInput: '', 
              totalPrice: 0,
              catName: detail.items?.categories?.name || 'أخرى',
              catSeq: detail.items?.categories?.sequence || 999,
              itemSeq: detail.items?.sequence || 999,
              totalQty: 0
            });
          }
          const itemRecord = itemsMap.get(itemId);
          itemRecord.totalQty = roundNumber(itemRecord.totalQty + qty);
          itemRecord.totalPrice = roundNumber(itemRecord.totalQty * itemRecord.price);
        });
      });

      const finalItems = Array.from(itemsMap.values()).sort((a, b) => {
        if (a.itemSeq !== b.itemSeq) return a.itemSeq - b.itemSeq;
        return a.name.localeCompare(b.name);
      });

      setInvoiceData(finalItems);
      
      const allIds = ordersData?.map(o => {
        const idStr = String(o.id);
        return idStr.includes('-') ? idStr.split('-')[0].toUpperCase() : idStr.substring(0, 8).toUpperCase();
      }) || [];
      
      setTotalOrdersCount(allIds.length);

      let displayIds = '';
      if (allIds.length === 0) displayIds = '-';
      else if (allIds.length <= 3) displayIds = allIds.join(' , ');
      else displayIds = `مجموعة طلبات مدمجة (${allIds.length} طلب)`;
      
      setFetchedOrderIds(displayIds);
      
    } catch (err: any) {
      alert("حدث خطأ أثناء سحب تفاصيل المذكرة.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePriceChange = (itemId: string, newPriceStr: string) => {
    const valNum = parseFloat(newPriceStr) || 0;
    setInvoiceData(prev => prev.map(item => {
      if (item.id === itemId) {
        return { 
          ...item, 
          priceInput: newPriceStr, 
          price: valNum, 
          totalPrice: roundNumber(item.totalQty * valNum) 
        };
      }
      return item;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.getElementById(`price-input-${currentIndex + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
        (nextInput as HTMLInputElement).select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.getElementById(`price-input-${currentIndex - 1}`);
      if (prevInput) {
        (prevInput as HTMLInputElement).focus();
        (prevInput as HTMLInputElement).select();
      }
    }
  };

  const groupedData = useMemo(() => {
    if (invoiceData.length === 0) return [];

    const map = new Map();
    invoiceData.forEach(item => {
      if (!map.has(item.catName)) map.set(item.catName, { category: item.catName, items: [], catSeq: item.catSeq });
      map.get(item.catName).items.push(item);
    });

    const sortedGroups = Array.from(map.values()).sort((a, b) => {
      if (a.catSeq !== b.catSeq) return a.catSeq - b.catSeq;
      return a.category.localeCompare(b.category);
    });

    let gIndex = 1;
    sortedGroups.forEach(group => {
      group.items.forEach((item: any) => {
        item.globalIndex = gIndex++;
      });
    });

    return sortedGroups;
  }, [invoiceData]);

  const { totalItemsSum, grandTotalPrice } = useMemo(() => {
    let qtySum = 0;
    let moneySum = 0;
    invoiceData.forEach(item => {
      qtySum += item.totalQty;
      moneySum += item.totalPrice;
    });
    return { totalItemsSum: roundNumber(qtySum), grandTotalPrice: roundNumber(moneySum) };
  }, [invoiceData]);

  const getSelectedBranchDetails = () => {
    const branch = allBranches.find(b => b.id === selectedBranch);
    if (!branch) return { name: '', agency: '' };
    return { name: branch.name, agency: agenciesMap[branch.agency_id] || 'وكالة غير محددة' };
  };

  const handleReactPrint = useReactToPrint({
    contentRef: exportPreviewRef,
    documentTitle: `مذكرة_تجهيز_${dayjs().format('YYYYMMDD')}`,
    onAfterPrint: () => {
      setIsDownloadingPDF(false);
      setIsPrinting(false);
      setShowPdfHint(false);
    },
    pageStyle: `
      @page { size: ${pdfSettings.paperSize} portrait; margin: ${pdfSettings.margin}; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
        .no-print { display: none !important; }
        .hide-on-print { display: none !important; }
        .show-on-print { display: table-cell !important; }
        
        .invoice-container { 
           zoom: ${pdfSettings.zoom / 100} !important; 
           margin-right: ${pdfSettings.shiftX}mm !important;
           overflow: hidden !important; 
        }
        .print-footer { 
           display: flex !important; position: fixed !important; bottom: 0; left: 0; right: 0; 
           background: white; padding-top: 4px; border-top: 2px solid #e2e8f0; z-index: 1000;
           justify-content: space-between; font-size: 10px; font-weight: 900; color: #64748b;
           font-family: 'Cairo', sans-serif;
        }
        tr, td, th { page-break-inside: avoid !important; }
        thead { display: table-header-group !important; }
        .print-container { 
           width: 100% !important; height: 100% !important; padding: 0 !important; margin: 0 !important; 
           border: none !important; box-shadow: none !important; background: white !important; overflow: hidden !important; 
        }
      }
      @media screen {
        .show-on-print { display: none !important; }
      }
    `
  });

  const handleExport = (mode: 'download' | 'print') => {
    if (invoiceData.length === 0) return alert("الرجاء توليد المذكرة أولاً!");
    if (mode === 'download') {
      setShowPdfHint(true);
      setIsDownloadingPDF(true);
    } else {
      setIsPrinting(true);
    }
    setTimeout(() => handleReactPrint(), 300);
  };

  const handleExportExcel = async () => {
    if (invoiceData.length === 0) return alert("لا توجد بيانات لتصديرها.");
    setIsExportingExcel(true);
    
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'نظام المطبخ المركزي';
      const worksheet = workbook.addWorksheet('مذكرة التجهيز', { views: [{ rightToLeft: true }] });
      
      const branchDetails = getSelectedBranchDetails();
      const dateDisplay = startDate === endDate ? startDate : `من ${startDate} إلى ${endDate}`;
      const titleStr = showPrices ? 'فاتورة مالية مجمعة' : 'مذكرة تجهيز لوجستية';
      
      const headerColsCount = showPrices ? 7 : 5;
      const lastColLetter = getColLetter(headerColsCount);

      worksheet.mergeCells(`A1:${lastColLetter}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = `${titleStr} - الفرع: ${branchDetails.name}`;
      titleCell.font = { name: 'Cairo', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: showPrices ? 'FF059669' : 'FFEA580C' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;

      worksheet.mergeCells(`A2:${lastColLetter}2`);
      const dateCell = worksheet.getCell('A2');
      dateCell.value = `تاريخ التصدير: ${dayjs().format('YYYY-MM-DD | hh:mm A')} | النطاق: ${dateDisplay} | الوكالة: ${branchDetails.agency}`;
      dateCell.font = { name: 'Cairo', size: 11, color: { argb: 'FF64748B' } };
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(2).height = 25;
      
      worksheet.addRow([]); 

      const excelHeaders = ['ت', 'القسم', 'المادة المطلوبة', 'الوحدة', 'الكمية'];
      if (showPrices) excelHeaders.push('السعر المفرد', 'الإجمالي');

      const headerRow = worksheet.addRow(excelHeaders);
      headerRow.height = 30;
      headerRow.eachCell((cell, colNum) => {
        const bg = (showPrices && (colNum === 6 || colNum === 7)) ? 'FF059669' : 'FF1E293B';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; 
        cell.font = { name: 'Cairo', color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      const colsObj = [
        { key: 'index', width: 6 }, { key: 'category', width: 18 }, { key: 'item', width: 40 },
        { key: 'unit', width: 15 }, { key: 'qty', width: 15 }
      ];
      if (showPrices) colsObj.push({ key: 'price', width: 18 }, { key: 'total', width: 20 });
      worksheet.columns = colsObj;

      groupedData.forEach(group => {
        const groupHeaderRow = worksheet.addRow([`📦 ${group.category}`]);
        worksheet.mergeCells(`A${groupHeaderRow.number}:${lastColLetter}${groupHeaderRow.number}`);
        const groupHeaderCell = worksheet.getCell(`A${groupHeaderRow.number}`);
        groupHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        groupHeaderCell.font = { name: 'Cairo', color: { argb: 'FF0F172A' }, bold: true, size: 12 };
        groupHeaderCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
        groupHeaderRow.height = 30;

        group.items.forEach((item: any) => {
          const rowData = [item.globalIndex, item.catName, item.name, item.unit, Number(item.totalQty)];
          if (showPrices) rowData.push(Number(item.price), Number(item.totalPrice));

          const dataRow = worksheet.addRow(rowData);
          dataRow.eachCell((cell, colNum) => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin', color: {argb: 'FFCBD5E1'} }, left: { style: 'thin', color: {argb: 'FFCBD5E1'} }, bottom: { style: 'thin', color: {argb: 'FFCBD5E1'} }, right: { style: 'thin', color: {argb: 'FFCBD5E1'} } };
            cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
            if (colNum === 3) cell.alignment.horizontal = 'right';
            if (colNum === 5) { cell.font = { color: { argb: 'FFE11D48' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } }; }
            if (showPrices && colNum === 6) cell.font = { color: { argb: 'FF64748B' } }; 
            if (showPrices && colNum === 7) { cell.font = { color: { argb: 'FF059669' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; }
          });
        });
      });

      worksheet.addRow([]);
      
      const totalQtyRow = worksheet.addRow(['إجمالي الكميات المجهزة:', '', '', '', Number(totalItemsSum)]);
      worksheet.mergeCells(`A${totalQtyRow.number}:D${totalQtyRow.number}`);
      totalQtyRow.getCell(1).font = { name: 'Cairo', bold: true, size: 13 };
      totalQtyRow.getCell(5).font = { bold: true, size: 14, color: { argb: 'FFE11D48' } };
      totalQtyRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };

      if (showPrices) {
        const totalMoneyRow = worksheet.addRow(['المبلغ الإجمالي الكلي (د.ع):', '', '', '', '', '', Number(grandTotalPrice)]);
        worksheet.mergeCells(`A${totalMoneyRow.number}:F${totalMoneyRow.number}`);
        totalMoneyRow.getCell(1).font = { name: 'Cairo', bold: true, size: 13, color: { argb: 'FF059669' } };
        totalMoneyRow.getCell(7).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
        totalMoneyRow.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const safeTitle = branchDetails.name.replace(/\s+/g, '_').replace(/[/\\?%*:|"<>]/g, '-');
      saveAs(blob, `مذكرة_تجهيز_${safeTitle}_${dayjs().format('YYYYMMDD')}.xlsx`);

    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء تصدير ملف Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const totalCalculatedWidth = pdfSettings.seqWidth + pdfSettings.itemWidth + pdfSettings.unitWidth + pdfSettings.qtyWidth + (showPrices ? (pdfSettings.priceWidth + pdfSettings.totalWidth) : 0);
  
  const getPaperWidth = () => {
    if (pdfSettings.paperSize === 'A3') return '297mm';
    if (pdfSettings.paperSize === 'A5') return '148mm';
    return '210mm';
  };

  const branchDetails = getSelectedBranchDetails();
  const dateDisplay = startDate === endDate ? startDate : `من ${startDate} إلى ${endDate}`;
  const docTitle = showPrices ? 'فاتورة مالية مجمعة' : 'مذكرة تجهيز لوجستية';
  const docSubTitle = showPrices ? 'OFFICIAL FINANCIAL INVOICE' : 'OFFICIAL DELIVERY NOTE';
  const docColor = showPrices ? '#059669' : '#ea580c';

  if (!isMounted) return null;

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen gap-4 transition-colors duration-300 ${isDark ? 'bg-[#050505]' : 'bg-slate-50'}`}>
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin"/>
        <p className="font-black uppercase tracking-widest text-slate-500 animate-pulse text-sm">جاري تهيئة النظام اللوجستي...</p>
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen font-sans relative transition-colors duration-300 ease-in-out ${isZenMode ? 'bg-slate-100 dark:bg-black text-slate-900 dark:text-slate-300 pb-10' : 'bg-slate-50 dark:bg-[#050505] text-slate-800 dark:text-white pb-40'}`} dir="rtl">
        
        {/* 🟢 الإشعاع الخلفي 🟢 */}
        <div className={`fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100/50 dark:from-orange-900/20 via-slate-50 dark:via-[#050505] to-slate-50 dark:to-[#050505] -z-10 pointer-events-none transition-colors duration-300`}></div>

        <div className={`mx-auto w-full relative z-10 transition-all duration-300 ${isZenMode ? 'p-2 max-w-[120rem]' : 'p-4 md:p-8 max-w-[100rem]'}`}>
          
          {/* 🌟 الهيدر 🌟 */}
          <div className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 w-full max-w-5xl mx-auto no-print relative z-10 transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden' : 'scale-y-100 opacity-100'}`}>
            <div className="flex items-center gap-5 text-right w-full xl:w-auto">
              <div className="bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-500 dark:to-amber-600 p-4 rounded-[1.5rem] text-orange-600 dark:text-white shadow-sm dark:shadow-[0_0_30px_rgba(249,115,22,0.3)] shrink-0 border border-orange-200 dark:border-orange-500/20">
                <Flame className="w-8 h-8" strokeWidth={2.5}/>
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">مذكرات التجهيز اللوجستية</h2>
                <p className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">منظومة التصدير وإدارة سلاسل الإمداد للفروع.</p>
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto flex flex-col gap-6 relative z-10">

            <div className={`bg-white dark:bg-[#121214] p-6 md:p-8 rounded-[2.5rem] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10 flex flex-col gap-6 w-full relative overflow-hidden no-print transition-all duration-300 origin-top ${isZenMode ? 'scale-y-0 opacity-0 h-0 p-0 mb-0 overflow-hidden border-none' : 'scale-y-100 opacity-100'}`}>
              <div className="absolute top-0 right-0 w-full h-1.5 bg-orange-500 opacity-90"></div>

              <div className="flex items-center gap-3 font-black text-slate-900 dark:text-white text-xl border-b border-slate-100 dark:border-white/5 pb-5">
                <div className="bg-slate-50 dark:bg-[#0a0a0c] p-2.5 rounded-xl text-orange-600 dark:text-orange-400 border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                  <PackageOpen className="w-6 h-6"/>
                </div>
                إعداد خط سير التجهيز المجمع
              </div>

              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] w-full md:w-auto shrink-0">
                  <button onClick={() => shiftMonth(-1)} className="p-2.5 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400 transition-colors border border-transparent outline-none cursor-pointer active:scale-95">
                    <ChevronRight className="w-4 h-4"/>
                  </button>
                  <div className="flex flex-col items-center justify-center min-w-[120px] px-2 cursor-pointer group/month" onClick={() => openDatePicker('monthOnly')}>
                    <span className="text-[9px] font-black text-orange-600/70 dark:text-orange-500/60 uppercase tracking-widest mb-0.5 transition-colors group-hover/month:text-orange-700 dark:group-hover/month:text-orange-500/80">الشهر المرجعي</span>
                    <span className="font-black text-[13px] text-orange-700 dark:text-orange-300 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(249,115,22,0.4)] transition-colors group-hover/month:text-orange-800 dark:group-hover/month:text-orange-200">
                      {selectedMonth.format('MMMM YYYY')}
                    </span>
                  </div>
                  <button onClick={() => shiftMonth(1)} className="p-2.5 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400 transition-colors border border-transparent outline-none cursor-pointer active:scale-95">
                    <ChevronLeft className="w-4 h-4"/>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#0a0a0c] p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-x-auto hide-scrollbar max-w-full w-full shrink-0">
                  <div className="px-2 text-[11px] font-black text-slate-500 flex items-center gap-1 shrink-0">
                    <History className="w-4 h-4" /> الفلترة الزمنية:
                  </div>
                  {['1', '7', '14', '21', 'month'].map((rangeType) => {
                    const isActive = activeDateRange === rangeType;
                    const label = rangeType === '1' ? 'صرف يوم' : rangeType === '7' ? 'صرف 7 أيام' : rangeType === '14' ? 'صرف 14 يوم' : rangeType === '21' ? 'صرف 21 يوم' : 'الشهر المحدد';
                    
                    let colorClasses = '';
                    if (isActive) {
                      if (rangeType === '1') colorClasses = 'bg-rose-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(225,29,72,0.5)] border-rose-500 dark:border-rose-400 scale-[1.02] ring-1 ring-rose-200 dark:ring-rose-500/50';
                      else if (rangeType === '7') colorClasses = 'bg-emerald-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.5)] border-emerald-500 dark:border-emerald-400 scale-[1.02] ring-1 ring-emerald-200 dark:ring-emerald-500/50';
                      else if (rangeType === '14') colorClasses = 'bg-blue-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(37,99,235,0.5)] border-blue-500 dark:border-blue-400 scale-[1.02] ring-1 ring-blue-200 dark:ring-blue-500/50';
                      else if (rangeType === '21') colorClasses = 'bg-purple-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(147,51,234,0.5)] border-purple-500 dark:border-purple-400 scale-[1.02] ring-1 ring-purple-200 dark:ring-purple-500/50';
                      else if (rangeType === 'month') colorClasses = 'bg-orange-600 text-white shadow-md dark:shadow-[0_0_15px_rgba(234,88,12,0.5)] border-orange-500 dark:border-orange-400 scale-[1.02] ring-1 ring-orange-200 dark:ring-orange-500/50';
                    } else {
                      if (rangeType === '1') colorClasses = 'bg-rose-50 dark:bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/15 border-rose-200 dark:border-rose-500/10 shadow-sm dark:shadow-inner hover:text-rose-700 dark:hover:text-rose-300';
                      else if (rangeType === '7') colorClasses = 'bg-emerald-50 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/10 shadow-sm dark:shadow-inner hover:text-emerald-700 dark:hover:text-emerald-300';
                      else if (rangeType === '14') colorClasses = 'bg-blue-50 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/15 border-blue-200 dark:border-blue-500/10 shadow-sm dark:shadow-inner hover:text-blue-700 dark:hover:text-blue-300';
                      else if (rangeType === '21') colorClasses = 'bg-purple-50 dark:bg-purple-500/5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/15 border-purple-200 dark:border-purple-500/10 shadow-sm dark:shadow-inner hover:text-purple-700 dark:hover:text-purple-300';
                      else if (rangeType === 'month') colorClasses = 'bg-orange-50 dark:bg-orange-500/5 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/15 border-orange-200 dark:border-orange-500/10 shadow-sm dark:shadow-inner hover:text-orange-700 dark:hover:text-orange-300';
                    }

                    return (
                      <button 
                        key={rangeType}
                        onClick={() => applyDateRange(rangeType as any, selectedMonth)} 
                        className={`px-4 py-2.5 rounded-xl text-[12px] font-black transition-all duration-300 shrink-0 outline-none border cursor-pointer active:scale-95 ${colorClasses}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                
                <div className="space-y-2.5">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-1 uppercase tracking-wider text-center block">الوكالة (Agency)</label>
                  <div className="relative group">
                    <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0c] border-l border-slate-200 dark:border-white/5 rounded-r-2xl pointer-events-none group-focus-within:bg-orange-50 dark:group-focus-within:bg-orange-500/10 group-focus-within:border-orange-200 dark:group-focus-within:border-orange-500/30 transition-colors shadow-sm dark:shadow-inner">
                      <Building2 className="w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-orange-500 dark:group-focus-within:text-orange-400 transition-colors"/>
                    </div>
                    <select 
                      value={selectedAgency} 
                      onChange={(e) => setSelectedAgency(e.target.value)} 
                      style={{ textAlignLast: 'center' }}
                      className="w-full h-14 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 px-14 pb-1 outline-none font-bold text-slate-900 dark:text-white text-[13px] rounded-2xl appearance-none cursor-pointer focus:border-orange-400 dark:focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:border-orange-300 dark:hover:border-white/20 text-center"
                    >
                      <option value="الكل" className="bg-white dark:bg-[#121214]">كل الوكالات</option>
                      {agenciesList.map(ag => (
                        <option key={ag.id} value={ag.id} className="bg-white dark:bg-[#121214]">{ag.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none"/>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-1 uppercase tracking-wider text-center block">الفرع المستفيد (Branch)</label>
                  <div className="relative group">
                    <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0c] border-l border-slate-200 dark:border-white/5 rounded-r-2xl pointer-events-none group-focus-within:bg-orange-50 dark:group-focus-within:bg-orange-500/10 group-focus-within:border-orange-200 dark:group-focus-within:border-orange-500/30 transition-colors shadow-sm dark:shadow-inner">
                      <Store className="w-5 h-5 text-slate-400 dark:text-slate-500 group-focus-within:text-orange-500 dark:group-focus-within:text-orange-400 transition-colors"/>
                    </div>
                    <select 
                      value={selectedBranch} 
                      onChange={(e) => setSelectedBranch(e.target.value)} 
                      style={{ textAlignLast: 'center' }}
                      className="w-full h-14 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 px-14 pb-1 outline-none font-bold text-slate-900 dark:text-white text-[13px] rounded-2xl appearance-none cursor-pointer focus:border-orange-400 dark:focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:border-orange-300 dark:hover:border-white/20 disabled:bg-slate-100 dark:disabled:bg-[#0a0a0c] disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-center"
                      disabled={filteredBranches.length === 0}
                    >
                      {filteredBranches.length === 0 ? (
                        <option value="" className="bg-white dark:bg-[#121214]">لا توجد فروع</option>
                      ) : (
                        filteredBranches.map(b => (
                          <option key={b.id} value={b.id} className="bg-white dark:bg-[#121214]">{b.name}</option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none"/>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-1 uppercase tracking-wider text-center block">من تاريخ (Start)</label>
                  <div 
                    onClick={() => openDatePicker('start')} 
                    className="relative group cursor-pointer"
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0c] border-l border-slate-200 dark:border-white/5 rounded-r-2xl pointer-events-none group-hover:bg-orange-50 dark:group-hover:bg-orange-500/10 group-hover:border-orange-200 dark:group-hover:border-orange-500/30 transition-colors shadow-sm dark:shadow-inner">
                      <Calendar className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors"/>
                    </div>
                    <div className="w-full h-14 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 px-12 pb-1 flex items-center justify-center font-bold text-slate-900 dark:text-white text-[14px] rounded-2xl outline-none group-hover:border-orange-400 dark:group-hover:border-orange-500/50 transition-all shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                      <span className={`dir-ltr text-center w-full block tracking-widest ${startDate ? 'text-orange-600 dark:text-orange-300' : 'text-slate-400 dark:text-slate-500'}`}>
                        {startDate ? dayjs(startDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-1 uppercase tracking-wider text-center block">إلى تاريخ (End)</label>
                  <div 
                    onClick={() => openDatePicker('end')} 
                    className="relative group cursor-pointer"
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0c] border-l border-slate-200 dark:border-white/5 rounded-r-2xl pointer-events-none group-hover:bg-orange-50 dark:group-hover:bg-orange-500/10 group-hover:border-orange-200 dark:group-hover:border-orange-500/30 transition-colors shadow-sm dark:shadow-inner">
                      <Calendar className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors"/>
                    </div>
                    <div className="w-full h-14 bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 px-12 pb-1 flex items-center justify-center font-bold text-slate-900 dark:text-white text-[14px] rounded-2xl outline-none group-hover:border-orange-400 dark:group-hover:border-orange-500/50 transition-all shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                      <span className={`dir-ltr text-center w-full block tracking-widest ${endDate ? 'text-orange-600 dark:text-orange-300' : 'text-slate-400 dark:text-slate-500'}`}>
                        {endDate ? dayjs(endDate).format('YYYY-MM-DD') : 'اختر التاريخ'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="pt-5 flex justify-end mt-2 border-t border-slate-100 dark:border-white/5">
                <button 
                  onClick={generateInvoice}
                  disabled={isGenerating || !selectedBranch || !startDate || !endDate}
                  className="flex items-center justify-center gap-3 bg-orange-600 hover:bg-orange-500 text-white px-10 py-4 rounded-2xl font-black text-[15px] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md dark:shadow-[0_0_20px_rgba(234,88,12,0.4)] w-full md:w-auto mt-4 outline-none cursor-pointer"
                >
                  {isGenerating ? <Loader2 className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5"/>}
                  {isGenerating ? 'جاري السحب والتجميع...' : 'تجميع المذكرة اللوجستية'}
                </button>
              </div>
            </div>

            {invoiceData.length > 0 && (
              <div className="bg-white dark:bg-[#121214] p-6 md:p-8 rounded-[2.5rem] shadow-sm dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-white/10 flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10 transition-all">
                
                {showPdfHint && (
                  <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-orange-800 dark:text-orange-300 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 no-print shadow-sm dark:shadow-inner">
                    <Info className="w-5 h-5 text-orange-600 dark:text-orange-500 mt-0.5 shrink-0"/>
                    <div>
                      <h4 className="font-black text-sm mb-1 text-orange-700 dark:text-orange-400">تنزيل الـ PDF بجودة أصلية (Vector):</h4>
                      <p className="text-xs font-bold opacity-90 text-orange-600 dark:text-orange-200/80">لتجنب تكسر الحروف العربية، استخدمنا المحرك الأصلي للطباعة. <strong>فقط اختر (حفظ بتنسيق PDF / Save as PDF)</strong> من النافذة التي ستظهر الآن. (تمت التسمية التلقائية للملف).</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-100 dark:border-white/5 pb-6 gap-4 no-print">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 font-black text-slate-900 dark:text-white text-xl">
                      <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">
                        <CheckCircle2 className="w-6 h-6"/>
                      </div>
                      المذكرة المجمعة جاهزة للتصدير
                    </div>
                    <button
                      onClick={() => setShowPrices(!showPrices)}
                      className={`mt-2 w-fit px-4 py-2 rounded-xl text-[13px] font-black transition-all outline-none flex items-center gap-2 border cursor-pointer active:scale-95 ${showPrices ? 'bg-emerald-600 text-white border-emerald-500 shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-50 dark:bg-[#0a0a0c] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white shadow-sm dark:shadow-inner'}`}
                    >
                      <DollarSign className="w-4 h-4" /> {showPrices ? 'إخفاء التسعير المالي' : 'تفعيل إدخال الأسعار يدوياً'}
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-slate-50 dark:bg-[#0a0a0c] p-2 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-inner">
                      
                      <button 
                        onClick={() => setShowPdfSettings(!showPdfSettings)} 
                        title="إعدادات القياس للـ PDF"
                        className={`p-3.5 rounded-xl flex items-center justify-center transition-all shadow-sm border outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-slate-500/50 ${showPdfSettings ? 'bg-slate-700 text-white border-slate-600' : 'bg-white dark:bg-[#121214] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
                      >
                        <Settings className={`w-5 h-5 transition-transform duration-500 ${showPdfSettings ? 'rotate-90' : ''}`} />
                      </button>

                      <button 
                        onClick={() => handleExport('download')}
                        disabled={isDownloadingPDF}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2.5 bg-emerald-600 text-white hover:bg-emerald-500 px-6 py-3.5 rounded-xl font-black text-[14px] transition-all shadow-md dark:shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer active:scale-95 border border-emerald-500 disabled:opacity-60 outline-none"
                      >
                        {isDownloadingPDF ? <Loader2 className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5"/>}
                        {isDownloadingPDF ? 'جاري التحميل...' : 'تحميل PDF'}
                      </button>
                      <button 
                        onClick={() => handleExport('print')}
                        disabled={isPrinting}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2.5 bg-rose-600 text-white hover:bg-rose-500 px-8 py-3.5 rounded-xl font-black text-[14px] transition-all shadow-md dark:shadow-[0_0_15px_rgba(225,29,72,0.4)] cursor-pointer active:scale-95 disabled:opacity-60 border border-rose-500 outline-none"
                      >
                        {isPrinting ? <Loader2 className="w-5 h-5 animate-spin text-white"/> : <Printer className="w-5 h-5"/>}
                        {isPrinting ? 'جاري التجهيز...' : 'طباعة مباشرة'}
                      </button>
                      <button 
                        onClick={handleExportExcel}
                        disabled={isExportingExcel}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2.5 bg-blue-600 text-white hover:bg-blue-500 px-6 py-3.5 rounded-xl font-black text-[14px] transition-all shadow-md dark:shadow-[0_0_15px_rgba(37,99,235,0.4)] cursor-pointer active:scale-95 border border-blue-500 disabled:opacity-60 outline-none"
                      >
                        {isExportingExcel ? <Loader2 className="w-5 h-5 animate-spin text-white"/> : <FileSpreadsheet className="w-5 h-5"/>}
                        {isExportingExcel ? 'تصدير...' : 'إكسل (Excel)'}
                      </button>
                    </div>
                  </div>
                </div>

                {showPdfSettings && (
                  <div className="bg-white dark:bg-[#0a0a0c] p-5 rounded-[2rem] border border-orange-200 dark:border-orange-500/20 shadow-lg dark:shadow-[0_10px_40px_-10px_rgba(234,88,12,0.15)] flex flex-col gap-6 animate-in slide-in-from-top-4 origin-top z-10 relative mb-4 no-print transition-colors">
                    
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                      <span className="text-sm font-black text-orange-600 dark:text-orange-400 flex items-center gap-2"><Settings className="w-4 h-4"/> إعدادات المذكرة المتقدمة (تُحفظ تلقائياً)</span>
                      <button onClick={resetPdfSettings} className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-colors bg-slate-50 dark:bg-[#121214] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 outline-none cursor-pointer active:scale-95 focus:ring-2 focus:ring-slate-500/50">
                        <RefreshCw className="w-3 h-3" /> استعادة الافتراضيات
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">حجم الورق</label>
                        <div className="relative">
                          <select value={pdfSettings.paperSize} onChange={e => updatePdfSetting('paperSize', e.target.value)} className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-orange-400 dark:focus:border-orange-500/50 appearance-none cursor-pointer">
                            <option value="A4" className="bg-white dark:bg-[#121214]">A4 (ورق قياسي)</option>
                            <option value="A3" className="bg-white dark:bg-[#121214]">A3 (أفضل للطلبيات الضخمة)</option>
                            <option value="A5" className="bg-white dark:bg-[#121214]">A5 (ورق صغير)</option>
                          </select>
                          <ChevronDown className="absolute left-4 top-[14px] w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none"/>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">هوامش الورقة</label>
                        <div className="relative">
                          <select value={pdfSettings.margin} onChange={e => updatePdfSetting('margin', e.target.value)} className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-black text-sm px-4 py-2.5 rounded-xl outline-none focus:border-orange-400 dark:focus:border-orange-500/50 appearance-none cursor-pointer">
                            <option value="0mm" className="bg-white dark:bg-[#121214]">بدون هوامش (0mm)</option>
                            <option value="2mm" className="bg-white dark:bg-[#121214]">ضيقة جداً (2mm)</option>
                            <option value="5mm" className="bg-white dark:bg-[#121214]">ضيقة (5mm)</option>
                            <option value="10mm" className="bg-white dark:bg-[#121214]">عادية (10mm)</option>
                          </select>
                          <ChevronDown className="absolute left-4 top-[14px] w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none"/>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">تقسيم الورقة (أعمدة)</label>
                          <span className="bg-orange-50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-300 text-[11px] font-black px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-500/30">{pdfSettings.masonryCols} أعمدة</span>
                        </div>
                        <input type="range" min="1" max="4" value={pdfSettings.masonryCols} onChange={e => updatePdfSetting('masonryCols', Number(e.target.value))} className="w-full accent-orange-500 h-2 bg-slate-100 dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                      </div>

                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1"><MoveHorizontal className="w-3 h-3"/> إزاحة (يمين/يسار)</label>
                          <span className="bg-orange-50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-300 text-[11px] font-black px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-500/30" dir="ltr">{pdfSettings.shiftX} mm</span>
                        </div>
                        <input type="range" min="-50" max="50" value={pdfSettings.shiftX} onChange={e => updatePdfSetting('shiftX', Number(e.target.value))} className="w-full accent-orange-500 h-2 bg-slate-100 dark:bg-[#121214] rounded-lg appearance-none cursor-pointer mt-1 border border-slate-200 dark:border-white/5" />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <hr className="flex-1 border-slate-100 dark:border-white/5" />
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-[#121214] px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">إعدادات مقاسات الجدول الداخلي</span>
                      <hr className="flex-1 border-slate-100 dark:border-white/5" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">مقياس الخط (Zoom)</label>
                          <span className="bg-orange-50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-300 text-[11px] font-black px-2 py-0.5 rounded-md border border-orange-200 dark:border-orange-500/30">{pdfSettings.zoom}%</span>
                        </div>
                        <input type="range" min="30" max="150" value={pdfSettings.zoom} onChange={e => updatePdfSetting('zoom', Number(e.target.value))} className="w-full accent-orange-500 h-2 bg-slate-100 dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                      </div>

                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض التسلسل (ت)</label>
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.seqWidth}%</span>
                        </div>
                        <input type="range" min="5" max="25" value={pdfSettings.seqWidth} onChange={e => updatePdfSetting('seqWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-100 dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                      </div>

                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض اسم المادة</label>
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.itemWidth}%</span>
                        </div>
                        <input type="range" min="20" max="80" value={pdfSettings.itemWidth} onChange={e => updatePdfSetting('itemWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-100 dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                      </div>

                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الوحدة</label>
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.unitWidth}%</span>
                        </div>
                        <input type="range" min="10" max="40" value={pdfSettings.unitWidth} onChange={e => updatePdfSetting('unitWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-100 dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                      </div>

                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض الكمية</label>
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.qtyWidth}%</span>
                        </div>
                        <input type="range" min="10" max="40" value={pdfSettings.qtyWidth} onChange={e => updatePdfSetting('qtyWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-100 dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                      </div>

                      {showPrices && (
                        <>
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض السعر</label>
                              <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.priceWidth}%</span>
                            </div>
                            <input type="range" min="5" max="30" value={pdfSettings.priceWidth} onChange={e => updatePdfSetting('priceWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-100 dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                          </div>

                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">عرض المبلغ</label>
                              <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 shadow-sm dark:shadow-inner">{pdfSettings.totalWidth}%</span>
                            </div>
                            <input type="range" min="5" max="30" value={pdfSettings.totalWidth} onChange={e => updatePdfSetting('totalWidth', Number(e.target.value))} className="w-full accent-emerald-500 h-1.5 bg-slate-100 dark:bg-[#121214] rounded-lg appearance-none cursor-pointer border border-slate-200 dark:border-white/5" />
                          </div>
                        </>
                      )}
                    </div>

                    {!pdfSettings.autoFit && (
                      <div className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] font-black mt-2 transition-colors ${totalCalculatedWidth > 100 ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                        <span>مجموع النسب المئوية للأعمدة: <span className={`text-sm px-1 ${totalCalculatedWidth > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{totalCalculatedWidth}%</span></span>
                        {totalCalculatedWidth > 100 ? (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> تجاوزت 100% (المتصفح سيقوم بضغط الجدول إجبارياً)</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> ممتاز (الجدول منسق 100%)</span>
                        )}
                      </div>
                    )}
                    {pdfSettings.autoFit && (
                      <div className="p-3 rounded-xl border bg-slate-50 dark:bg-[#0a0a0c] border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 text-[11px] font-black text-center">
                        الاحتواء التلقائي مفعل (المتصفح سيوزع الأعمدة بحسب طول الكلمات ويتجاهل النسب اليدوية).
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-[#0a0a0c] p-4 md:p-8 rounded-[2rem] overflow-x-auto flex justify-center shadow-sm dark:shadow-inner border border-slate-200 dark:border-white/5 transition-colors">
                  
                  <div 
                    ref={exportPreviewRef}
                    className="print-container bg-white shadow-[0_10px_40px_rgb(0,0,0,0.5)] print:shadow-none transition-all relative"
                    style={{ 
                      width: getPaperWidth(),
                      minHeight: pdfSettings.paperSize === 'A3' ? '420mm' : pdfSettings.paperSize === 'A5' ? '210mm' : '297mm', 
                      padding: '8mm', 
                      margin: '0 auto', 
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                  >
                    
                    <div className="invoice-container" dir="rtl">
                      <style dangerouslySetInnerHTML={{__html: `
                        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                        
                        .invoice-container {
                          font-family: 'Cairo', system-ui, sans-serif;
                          color: #0f172a;
                          background: #ffffff;
                          width: 100%;
                          display: flex;
                          flex-direction: column;
                          direction: rtl;
                          zoom: ${pdfSettings.zoom / 100};
                          margin-right: ${pdfSettings.shiftX}mm;
                        }
                        * { box-sizing: border-box; }
                        
                        .inv-header {
                          display: flex;
                          justify-content: space-between;
                          align-items: flex-end;
                          border-bottom: 2px solid #0f172a;
                          padding-bottom: 6px;
                          margin-bottom: 10px;
                        }
                        
                        .inv-brand h1 { margin: 0; font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1; letter-spacing: -0.5px; }
                        .inv-brand p { margin: 2px 0 0 0; font-size: 8px; font-weight: 800; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }
                        
                        .inv-type { text-align: left; }
                        .inv-type h2 { margin: 0; font-size: 16px; font-weight: 900; color: ${docColor}; line-height: 1; }
                        .inv-type p { margin: 2px 0 0 0; font-size: 8px; font-weight: 800; color: #94a3b8; }
                        
                        .inv-meta { display: flex; gap: 10px; margin-bottom: 10px; }
                        
                        .meta-box {
                          flex: 1;
                          background: #f8fafc;
                          border: 1px solid #e2e8f0;
                          border-right: 3px solid #0f172a;
                          border-radius: 6px;
                          padding: 6px 10px;
                          display: flex;
                          flex-direction: column;
                          justify-content: center;
                        }
                        
                        .meta-box.highlight {
                          background: ${showPrices ? '#ecfdf5' : '#fff7ed'};
                          border-color: ${showPrices ? '#d1fae5' : '#ffedd5'};
                          border-right: 3px solid ${docColor};
                        }
                        
                        .meta-label { font-size: 8px; font-weight: 900; color: #64748b; margin-bottom: 2px; text-transform: uppercase; }
                        .meta-value { font-size: 12px; font-weight: 900; color: #0f172a; line-height: 1.2; }
                        .meta-sub { font-size: 8px; font-weight: 700; color: #475569; margin-top: 1px; }
                        
                        .sections-masonry {
                          column-count: ${pdfSettings.masonryCols}; 
                          column-gap: 10px;
                          width: 100%;
                          margin-bottom: 5px;
                        }
                        
                        .cat-block {
                          break-inside: avoid;
                          page-break-inside: avoid;
                          margin-bottom: 8px;
                          border: 1px solid #cbd5e1;
                          border-radius: 4px;
                          overflow: hidden;
                          background: #ffffff;
                        }
                        
                        .cat-header {
                          background: #0f172a;
                          color: #ffffff;
                          font-size: 10px;
                          font-weight: 900;
                          text-align: right;
                          padding: 4px 8px;
                          border-bottom: 2px solid ${docColor};
                        }
                        
                        .cat-table { width: 100%; border-collapse: collapse; table-layout: ${pdfSettings.autoFit ? 'auto' : 'fixed'}; }
                        .cat-table th { background: #f1f5f9; color: #475569; font-size: 8px; font-weight: 900; padding: 4px 2px; text-align: center; border-bottom: 1px solid #cbd5e1; }
                        .cat-table td { font-size: 10px; font-weight: 700; color: #1e293b; padding: 3px 2px; border-bottom: 1px solid #e2e8f0; text-align: center; overflow: hidden; }
                        .cat-table tr:last-child td { border-bottom: none; }
                        .cat-table tr:nth-child(even) td { background: #f8fafc; }
                        
                        .td-idx { font-size: 8px !important; font-weight: 800 !important; color: #94a3b8 !important; border-left: 1px solid #e2e8f0; }
                        .td-name { text-align: right !important; font-weight: 900 !important; font-size: 10px !important; color: #0f172a !important; border-left: 1px solid #e2e8f0; padding-right: 6px !important; }
                        .td-unit { font-size: 9px !important; font-weight: 800 !important; color: #64748b !important; border-left: 1px solid #e2e8f0; }
                        .td-qty { font-size: 11px !important; letter-spacing: -0.5px; font-weight: 900 !important; color: ${docColor} !important; background: ${showPrices ? '#ecfdf5' : '#fff7ed'} !important; }
                        
                        .totals-block {
                          background: #0f172a; color: white; padding: 8px 15px; border-radius: 6px;
                          display: flex; justify-content: space-between; align-items: center;
                          margin-bottom: 10px; page-break-inside: avoid;
                        }
                        .totals-text { font-size: 12px; font-weight: 900; }
                        .totals-val { font-size: 16px; font-weight: 900; color: #ea580c; background: #ffffff; padding: 2px 12px; border-radius: 4px; }

                        .inv-signatures { display: flex; gap: 30px; margin-top: 10px; padding-top: 5px; page-break-inside: avoid; }
                        .sig-block { flex: 1; text-align: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 10px; }
                        .sig-line { border-bottom: 1px dashed #94a3b8; margin-top: 25px; margin-bottom: 5px; }
                        .sig-title { font-size: 9px; font-weight: 900; color: #0f172a; }
                        .sig-sub { font-size: 7px; font-weight: 700; color: #64748b; display: flex; justify-content: space-between; }
                        
                        .inv-footer { text-align: center; font-size: 8px; font-weight: 700; color: #94a3b8; margin-top: 15px; padding-top: 5px; border-top: 1px solid #e2e8f0; page-break-inside: avoid; }

                        /* 💡 ستايلات خاصة بوضع الأسعار 💡 */
                        .td-input-wrapper {
                          padding: 0 !important;
                          vertical-align: middle !important;
                          background-color: #ecfdf5 !important;
                          border-left: 1px solid #e2e8f0 !important;
                        }
                        .price-input::-webkit-outer-spin-button,
                        .price-input::-webkit-inner-spin-button {
                          -webkit-appearance: none;
                          margin: 0;
                        }
                        .price-input[type=number] {
                          -moz-appearance: textfield;
                        }
                        .price-input {
                          width: 100%; 
                          height: 24px;
                          box-sizing: border-box; 
                          background: transparent; 
                          border: 1px solid transparent; 
                          border-radius: 2px;
                          text-align: center; 
                          font-size: 11px; 
                          font-weight: 900; 
                          color: #059669; 
                          outline: none; 
                          transition: all 0.3s;
                          min-width: 0; 
                          padding: 0 2px;
                        }
                        .price-input:hover {
                          border-color: #a7f3d0;
                          background: #f8fafc;
                        }
                        .price-input:focus { 
                          border-color: #059669; 
                          background: #ffffff; 
                          box-shadow: 0 0 0 2px rgba(5,150,105,0.2); 
                        }
                        @media print {
                          .hide-on-print { display: none !important; }
                          .show-on-print { display: table-cell !important; }
                        }
                        @media screen {
                          .show-on-print { display: none !important; }
                        }
                      `}} />

                      <div className="inv-header">
                        <div className="inv-brand">
                          <h1>المطبخ المركزي</h1>
                          <p>Premium Supply Logistics</p>
                        </div>
                        <div className="inv-type">
                          <h2>{docTitle}</h2>
                          <p>{docSubTitle}</p>
                        </div>
                      </div>

                      <div className="inv-meta">
                        <div className="meta-box">
                          <div className="meta-label">وجهة التسليم (الفرع المستفيد)</div>
                          <div className="meta-value">{branchDetails.name}</div>
                          <div className="meta-sub">الوكالة: {branchDetails.agency}</div>
                        </div>
                        
                        <div className="meta-box">
                          <div className="meta-label">بيانات المذكرة والفواتير المجمعة</div>
                          <div className="meta-value" dir="ltr" style={{ textAlign: 'right' }}>{dateDisplay}</div>
                          <div className="meta-sub" style={{ color: docColor }}>المرجع: <span dir="ltr">{fetchedOrderIds}</span></div>
                        </div>
                        
                        <div className="meta-box highlight">
                          <div className="meta-label" style={{ color: docColor }}>إجمالي الأصناف المجهزة</div>
                          <div className="meta-value" style={{ color: docColor, fontSize: '16px' }}>{invoiceData.length} <span style={{ fontSize: '9px', color: docColor }}>صنف</span></div>
                        </div>
                      </div>

                      <div className="sections-masonry">
                        {groupedData.map((group, gIdx) => (
                          <div className="cat-block" key={gIdx}>
                            <div className="cat-header" style={{ borderBottomColor: docColor }}>📦 {group.category}</div>
                            <table className="cat-table">
                              <thead>
                                <tr>
                                  <th style={{ width: `${pdfSettings.seqWidth}%` }}>ت</th>
                                  <th style={{ width: `${pdfSettings.itemWidth}%`, textAlign: 'right', paddingRight: '4px' }}>المادة المطلوبة</th>
                                  <th style={{ width: `${pdfSettings.unitWidth}%` }}>الوحدة</th>
                                  <th style={{ width: `${pdfSettings.qtyWidth}%` }}>الكمية</th>
                                  {showPrices && (
                                    <>
                                      <th style={{ width: `${pdfSettings.priceWidth}%` }}>السعر المفرد</th>
                                      <th style={{ width: `${pdfSettings.totalWidth}%` }}>المبلغ</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map((item: any) => (
                                  <tr key={item.id}>
                                    <td className="td-idx">{item.globalIndex}</td>
                                    <td className="td-name">{item.name}</td>
                                    <td className="td-unit">{item.unit}</td>
                                    <td className="td-qty" dir="ltr">{formatQty(item.totalQty)}</td>
                                    
                                    {showPrices && (
                                      <>
                                        <td className="hide-on-print td-input-wrapper">
                                          <input 
                                            id={`price-input-${item.globalIndex}`}
                                            type="number"
                                            step="any"
                                            min="0"
                                            className="price-input"
                                            value={item.priceInput}
                                            onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, item.globalIndex)}
                                            dir="ltr"
                                            title="اضغط هنا لتعديل السعر"
                                            placeholder="0"
                                          />
                                        </td>
                                        <td className="td-qty show-on-print" style={{ color: '#64748b', fontSize: '10px', borderLeft: '1px solid #e2e8f0' }} dir="ltr">
                                          {formatMoney(item.price)}
                                        </td>
                                        
                                        <td className="td-qty" style={{ color: '#059669', borderLeft: '1px solid #e2e8f0' }} dir="ltr">
                                          {formatMoney(item.totalPrice)}
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>

                      <div className="totals-block">
                        <div className="totals-text">إجمالي مجموع الكميات الكلية المجهزة:</div>
                        <div className="totals-val" dir="ltr">{formatQty(totalItemsSum)}</div>
                      </div>

                      {showPrices && (
                        <div className="totals-block" style={{ background: '#059669' }}>
                          <div className="totals-text">المبلغ الإجمالي الكلي:</div>
                          <div className="totals-val" dir="ltr" style={{ color: '#059669' }}>{formatMoney(grandTotalPrice)} د.ع</div>
                        </div>
                      )}

                      <div className="inv-signatures">
                        <div className="sig-block">
                          <div className="sig-title">مسؤول التسليم (المطبخ المركزي)</div>
                          <div className="sig-line"></div>
                          <div className="sig-sub"><span>الاسم والتوقيع</span><span>التاريخ</span></div>
                        </div>
                        <div className="sig-block">
                          <div className="sig-title">مسؤول الاستلام (الفرع المستفيد)</div>
                          <div className="sig-line"></div>
                          <div className="sig-sub"><span>الاسم والتوقيع</span><span>التاريخ</span></div>
                        </div>
                      </div>
                      
                      <div className="inv-footer">
                        تم توليد هذه المذكرة آلياً عبر نظام الإدارة المركزي. 
                        {showPrices ? 'تحتوي على بيانات مالية سرية للمطابقة والمحاسبة.' : 'تعتبر وثيقة تسليم لوجستية فقط ولا تحتوي على بيانات تسعير مالية.'}
                      </div>
                    </div>

                    <div className="hidden print-footer">
                      <div>طُبع بواسطة: <span style={{ color: '#0f172a', marginRight: '4px' }}>نظام المطبخ المركزي</span></div>
                      <div dir="ltr">تاريخ الطباعة: {dayjs().format('YYYY-MM-DD | hh:mm A')}</div>
                    </div>

                  </div>
                </div>

              </div>
            )}

          </div>

          {datePickerConfig.isOpen && !isZenMode && (
            <div className="fixed top-0 left-0 w-full h-[100dvh] z-[999999] flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300 overflow-hidden no-print">
              <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-[360px] max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl dark:shadow-[0_0_50px_rgba(249,115,22,0.1)] animate-in zoom-in-95 duration-300">
                
                <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-white/5 pb-5 shrink-0">
                  <button onClick={handlePrevCalendar} className="p-2.5 bg-slate-50 dark:bg-orange-500/10 hover:bg-slate-100 dark:hover:bg-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400 transition-colors border border-transparent outline-none cursor-pointer active:scale-95">
                    <ChevronRight className="w-5 h-5"/>
                  </button>
                  
                  <div className="flex gap-2 items-center">
                     <button 
                       onClick={() => setDatePickerConfig(p => ({...p, mode: 'month'}))}
                       className={`text-[16px] font-black transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'month' ? 'text-orange-600 dark:text-orange-400 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'text-slate-600 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-300'}`}
                     >
                       {datePickerConfig.viewDate.format('MMMM')}
                     </button>
                     <span className="text-slate-400 dark:text-slate-600">-</span>
                     <button 
                       onClick={() => setDatePickerConfig(p => ({...p, mode: 'year'}))}
                       className={`text-[18px] font-black en-num transition-colors outline-none cursor-pointer active:scale-95 ${datePickerConfig.mode === 'year' ? 'text-orange-600 dark:text-orange-400 drop-shadow-sm dark:drop-shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'text-slate-600 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-300'}`}
                     >
                       {datePickerConfig.viewDate.format('YYYY')}
                     </button>
                  </div>

                  <button onClick={handleNextCalendar} className="p-2.5 bg-slate-50 dark:bg-orange-500/10 hover:bg-slate-100 dark:hover:bg-orange-500/20 rounded-xl text-orange-600 dark:text-orange-400 transition-colors border border-transparent outline-none cursor-pointer active:scale-95">
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
                          className={`py-3 rounded-[1rem] font-black text-[15px] en-num transition-all active:scale-95 outline-none cursor-pointer ${isSelected ? 'bg-orange-600 text-white dark:bg-orange-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-slate-50 dark:bg-orange-500/5 text-slate-600 dark:text-orange-400/70 hover:bg-slate-100 dark:hover:bg-orange-500/15 hover:text-orange-600 dark:hover:text-orange-300 border border-slate-200 dark:border-orange-500/10'}`}
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
                          onClick={() => handleMonthSelection(datePickerConfig.viewDate.month(i))}
                          className={`py-4 rounded-[1.2rem] font-black text-[14px] transition-all active:scale-95 outline-none cursor-pointer flex flex-col items-center gap-1.5 ${isSelected ? 'bg-orange-600 text-white dark:bg-orange-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(249,115,22,0.4)]' : 'bg-slate-50 dark:bg-orange-500/5 text-slate-600 dark:text-orange-400/70 hover:bg-slate-100 dark:hover:bg-orange-500/15 hover:text-orange-600 dark:hover:text-orange-300 border border-slate-200 dark:border-orange-500/10'}`}
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
                        <div key={d} className="text-center text-[10px] font-black text-slate-400 dark:text-orange-500/50 uppercase tracking-widest">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: datePickerConfig.viewDate.startOf('month').day() }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {Array.from({ length: datePickerConfig.viewDate.daysInMonth() }).map((_, i) => {
                        const dayNum = i + 1;
                        const dateStr = datePickerConfig.viewDate.date(dayNum).format('YYYY-MM-DD');
                        
                        const isSelected = dateStr === (datePickerConfig.target === 'start' ? startDate : endDate);
                        const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                        return (
                          <button
                            key={dayNum}
                            onClick={() => handleDateSelection(dateStr)}
                            className={`
                              aspect-square flex items-center justify-center rounded-[1rem] font-black text-[14px] en-num transition-all active:scale-95 outline-none cursor-pointer
                              ${isSelected ? 'bg-orange-600 text-white dark:bg-orange-500 dark:text-[#050505] shadow-md dark:shadow-[0_0_15px_rgba(249,115,22,0.4)]' :
                                isToday ? 'text-orange-600 border border-orange-300 bg-orange-50 dark:text-orange-300 dark:border-orange-500/30 dark:bg-orange-500/20' :
                                'text-slate-700 hover:bg-slate-100 hover:text-orange-600 dark:bg-orange-500/5 dark:text-orange-400/80 dark:hover:bg-orange-500/15 dark:hover:text-orange-300 border border-transparent'}
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
          .dir-ltr { direction: ltr; }
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}} />
      </div>
    </div>
  );
}