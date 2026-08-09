"use client";

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function LogoutPage() {
  useEffect(() => {
    // 1. مسح الكوكي بأكثر من صيغة لضمان الحذف التام من المتصفح
    document.cookie = 'user_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'user_session=; path=/; max-age=0';
    
    // 2. مسح سلة المشتريات (المسودة) حتى يصفر النظام للفرع الجاي
    localStorage.removeItem('pos_draft_cart');

    // 3. توجيه إجباري يكسر كاش الـ Next.js تماماً
    setTimeout(() => {
      window.location.replace('/login');
    }, 300); // تأخير بسيط جداً (أقل من ثانية) لضمان مسح الكوكي
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-4 text-white" dir="rtl">
      <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
      <p className="font-bold text-slate-400 text-sm tracking-widest uppercase">جاري الخروج ومسح الجلسة...</p>
    </div>
  );
}