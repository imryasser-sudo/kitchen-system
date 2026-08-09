"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('erp_session');
    const isLoginPage = pathname === '/login';

    // 1. طرد أي شخص غير مسجل دخول
    if (!session && !isLoginPage) {
      router.replace('/login');
      return;
    }

    if (session) {
      const user = JSON.parse(session);
      const role = user.role || 'Employee';
      
      // ⚠️ منو المسموح له يدخل الداشبورد الرئيسي؟ (مدير النظام والمالية فقط)
      const isSystemAdmin = role === 'Admin' || role === 'AsstManager' || role === 'Accountant';

      // 2. إذا مسجل دخول وحاول يفتح صفحة الدخول، رجعه لمكانه المخصص
      if (isLoginPage) {
        if (isSystemAdmin) router.replace('/');
        else if (role === 'BranchManager') router.replace('/branch-portal');
        else router.replace('/my-profile');
        return;
      }

      // 🛑 3. المنع البات والصارم: طرد الموظفين من الداشبورد الرئيسي 🛑
      if (pathname === '/' && !isSystemAdmin) {
        if (role === 'BranchManager') router.replace('/branch-portal');
        else router.replace('/my-profile'); // الموظف والشيف ينطردون لبوابتهم
        return;
      }
    }

    setIsAuthorized(true);
  }, [pathname, router]);

  if (!isAuthorized && pathname !== '/login') {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-[#050505] flex items-center justify-center z-[999999]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-sm font-bold text-slate-500 animate-pulse">جاري التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}