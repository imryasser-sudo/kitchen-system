"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutGrid, CalendarDays, ChevronRight, ChevronLeft, 
  MapPin, Flame, Truck, ChefHat, Package, CheckCircle2, 
  History, ShoppingCart, BarChart3, Clock
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

// 💡 بيانات وهمية تحاكي مطبخك المركزي وتجهيز المطاعم 💡
const KITCHEN_EVENTS = [
  { date: dayjs().format('YYYY-MM-DD'), title: 'تجهيز طلبية السيدية', type: 'dispatch', desc: 'تجهيز 250 كغم دجاج و 50 كغم صوص ثومية.', branch: 'فرع السيدية', status: 'مكتمل' },
  { date: dayjs().format('YYYY-MM-DD'), title: 'جرد أسبوعي للمخزن', type: 'inventory', desc: 'جرد قسم التغليف واللحوم.', branch: 'المطبخ المركزي (العامرية)', status: 'قيد التنفيذ' },
  { date: dayjs().add(1, 'day').format('YYYY-MM-DD'), title: 'طلبية زيونة والأعظمية', type: 'dispatch', desc: 'إرسال وجبة البركر (السماش) والصمون.', branch: 'زيونة + الأعظمية', status: 'مجدول' },
  { date: dayjs().add(2, 'day').format('YYYY-MM-DD'), title: 'تجهيز مواد خام', type: 'prep', desc: 'استلام دجاج فريش وتقطيعه.', branch: 'المطبخ المركزي (العامرية)', status: 'مجدول' },
  { date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'), title: 'تجهيز فرع الفلوجة', type: 'dispatch', desc: 'طلبية ضخمة: دجاج ومقبلات.', branch: 'فرع الفلوجة', status: 'مكتمل' },
  { date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), title: 'توريد لحوم طازجة', type: 'prep', desc: 'استلام 1 طن من الدجاج من المورد.', branch: 'المطبخ المركزي (العامرية)', status: 'مكتمل' },
];

const WEEK_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function MobileCalendarPage() {
  const pathname = usePathname();
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [calendarGrid, setCalendarGrid] = useState<any[]>([]);

  useEffect(() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startDate = startOfMonth.day(); // 0 = Sunday
    const daysInMonth = currentMonth.daysInMonth();

    const grid = [];
    
    // الأيام من الشهر السابق
    for (let i = 0; i < startDate; i++) {
      grid.push({ date: startOfMonth.subtract(startDate - i, 'day'), isCurrentMonth: false });
    }
    
    // أيام الشهر الحالي
    for (let i = 1; i <= daysInMonth; i++) {
      grid.push({ date: startOfMonth.date(i), isCurrentMonth: true });
    }
    
    // الأيام من الشهر القادم لإكمال الشبكة
    const remainingCells = 42 - grid.length;
    for (let i = 1; i <= remainingCells; i++) {
      grid.push({ date: endOfMonth.add(i, 'day'), isCurrentMonth: false });
    }

    setCalendarGrid(grid);
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(currentMonth.subtract(1, 'month'));
  const handleNextMonth = () => setCurrentMonth(currentMonth.add(1, 'month'));

  const selectedEvents = useMemo(() => {
    return KITCHEN_EVENTS.filter(e => e.date === selectedDate.format('YYYY-MM-DD'));
  }, [selectedDate]);

  const getEventStyle = (type: string) => {
    switch(type) {
      case 'dispatch': return { dot: 'bg-emerald-400', bg: 'bg-emerald-500/20 text-emerald-400', icon: <Truck className="w-5 h-5" /> };
      case 'prep': return { dot: 'bg-orange-400', bg: 'bg-orange-500/20 text-orange-400', icon: <ChefHat className="w-5 h-5" /> };
      case 'inventory': return { dot: 'bg-indigo-400', bg: 'bg-indigo-500/20 text-indigo-400', icon: <Package className="w-5 h-5" /> };
      default: return { dot: 'bg-slate-400', bg: 'bg-slate-500/20 text-slate-400', icon: <Clock className="w-5 h-5" /> };
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-[120px]" dir="rtl">
      
      {/* 🟢 الإشعاع الخلفي 🟢 */}
      <div className="fixed top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-fuchsia-900/10 via-[#050505] to-[#050505] -z-10 pointer-events-none"></div>

      {/* 🟢 حاوية مقفلة على حجم الموبايل (Mobile Viewport) 🟢 */}
      <div className="max-w-md mx-auto w-full relative z-10 pt-8 px-5">
        
        {/* هيدر الشاشة */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/hub" className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-colors border border-white/5">
            <LayoutGrid className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-fuchsia-400" />
            التقويم الشامل
          </h2>
          <div className="w-11"></div> {/* لموازنة المساحة */}
        </div>

        {/* 🟢 التقويم (App Style) 🟢 */}
        <div className="bg-[#121214] border border-white/10 rounded-[2rem] p-5 shadow-2xl mb-8">
          
          {/* التحكم بالأشهر */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={handlePrevMonth} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <span className="font-black text-[18px] tracking-widest text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
                {currentMonth.format('MMMM')} <span className="text-fuchsia-400 mx-0.5">-</span> {currentMonth.year()}
              </span>
            </div>

            <button onClick={handleNextMonth} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* أيام الأسبوع */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEK_DAYS.map((day, idx) => (
              <div key={idx} className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          {/* شبكة الأيام (Grid) */}
          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.map((cell, idx) => {
              const dateStr = cell.date.format('YYYY-MM-DD');
              const isSelected = selectedDate.format('YYYY-MM-DD') === dateStr;
              const isToday = dayjs().format('YYYY-MM-DD') === dateStr;
              const dayEvents = KITCHEN_EVENTS.filter(e => e.date === dateStr);

              return (
                <div 
                  key={idx} 
                  onClick={() => setSelectedDate(cell.date)}
                  className={`
                    aspect-square flex flex-col items-center justify-center cursor-pointer rounded-[1.2rem] transition-all relative
                    ${!cell.isCurrentMonth ? 'opacity-30' : 'opacity-100'}
                  `}
                >
                  {/* الدائرة اللي تحيط بالرقم عند التحديد */}
                  <div className={`
                    w-9 h-9 flex items-center justify-center rounded-full font-black text-[15px] en-num transition-all
                    ${isSelected ? 'bg-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.4)]' : 
                      isToday ? 'text-fuchsia-400 border border-fuchsia-500/30' : 
                      'text-slate-300 hover:bg-white/5'}
                  `}>
                    {cell.date.date()}
                  </div>

                  {/* نقاط المهام (Dots) تحت الرقم */}
                  <div className="absolute bottom-1 flex gap-0.5 justify-center w-full">
                    {dayEvents.slice(0, 3).map((ev, i) => (
                      <span key={i} className={`w-1 h-1 rounded-full ${getEventStyle(ev.type).dot}`}></span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 🟢 تفاصيل اليوم المحدد 🟢 */}
        <div className="animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 mb-5 px-1">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              مهام يوم <span className="text-fuchsia-400 en-num dir-ltr" style={{ fontFamily: 'Arial, sans-serif' }}>{selectedDate.date()}</span>
            </h3>
            {selectedDate.isSame(dayjs(), 'day') && <span className="bg-white/10 text-slate-300 px-2 py-0.5 rounded-md text-[9px] font-black">اليوم الحالي</span>}
          </div>

          <div className="space-y-3">
            {selectedEvents.length === 0 ? (
              <div className="text-center py-8 bg-[#121214] rounded-[1.5rem] border border-white/5 border-dashed">
                <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 font-bold text-sm">لا توجد مهام مجدولة.</p>
              </div>
            ) : (
              selectedEvents.map((event, idx) => {
                const style = getEventStyle(event.type);
                return (
                  <div key={idx} className="bg-[#121214] border border-white/5 rounded-[1.5rem] p-4 flex gap-4 items-start group">
                    <div className={`p-3 rounded-[1rem] shrink-0 shadow-inner ${style.bg}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-[14px] font-black text-white leading-tight">{event.title}</h4>
                        <span className="bg-white/5 text-slate-400 px-2 py-0.5 rounded-md text-[9px] font-black shrink-0">
                          {event.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 mb-2 leading-relaxed">{event.desc}</p>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {event.branch}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 🟢 شريط التنقل السفلي (Dock) مقفل على حجم الموبايل 🟢 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 w-full bg-[#050505]/90 backdrop-blur-2xl border-t border-white/5">
        <div className="flex items-center justify-around h-[85px] pb-6 pt-3 max-w-md mx-auto px-4">
          <Link href="/hub" className="flex flex-col items-center justify-center w-full h-full gap-1.5 active:scale-95 transition-transform group">
            <div className={`p-1.5 rounded-xl transition-colors ${pathname === '/hub' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
              <LayoutGrid className="w-6 h-6" />
            </div>
            <span className={`text-[10px] font-black ${pathname === '/hub' ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>المكتبة</span>
          </Link>
          
          <Link href="/records" className="flex flex-col items-center justify-center w-full h-full gap-1.5 active:scale-95 transition-transform group">
            <div className={`p-1.5 rounded-xl transition-colors ${pathname === '/records' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
              <History className="w-6 h-6" />
            </div>
            <span className={`text-[10px] font-black ${pathname === '/records' ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>السجل</span>
          </Link>

          <Link href="/requests" className="flex flex-col items-center justify-center w-full h-full -mt-6 active:scale-95 transition-transform group relative">
            <div className="bg-gradient-to-b from-emerald-400 to-teal-600 p-4 rounded-full shadow-[0_10px_20px_rgba(16,185,129,0.3)] border-4 border-[#050505] group-hover:shadow-[0_10px_30px_rgba(16,185,129,0.5)] transition-shadow">
               <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <span className={`text-[10px] font-black mt-2 ${pathname === '/requests' ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'}`}>الطلبيات</span>
          </Link>

          {/* التقويم فعال هنا بدل التحليل */}
          <Link href="/calendar" className="flex flex-col items-center justify-center w-full h-full gap-1.5 active:scale-95 transition-transform group">
            <div className={`p-1.5 rounded-xl transition-colors ${pathname === '/calendar' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
              <CalendarDays className="w-6 h-6" />
            </div>
            <span className={`text-[10px] font-black ${pathname === '/calendar' ? 'text-fuchsia-400' : 'text-slate-500 group-hover:text-slate-300'}`}>التقويم</span>
          </Link>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        /* إجبار الأرقام الإنجليزية بشكل صارم */
        .en-num { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; direction: ltr; display: inline-block; }
      `}} />
    </div>
  );
}