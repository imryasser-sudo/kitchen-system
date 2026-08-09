"use client";

import './globals.css';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation'; 

// 💡 استخدام المسار المباشر '../components' بدلاً من الاختصار '@' لضمان قراءة الملفات 💡
import BottomDock from '../components/BottomDock';
import { ThemeProvider } from '../components/ThemeProvider'; 
import PullToRefresh from '../components/PullToRefresh';
import AudioAlert from '../components/AudioAlert';
import AuthGuard from '../components/AuthGuard'; 
import { Toaster, toast } from 'sonner';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOffline, setIsOffline] = useState(false);
  const pathname = usePathname(); 

  // التحقق هل المستخدم في صفحة تسجيل الدخول؟ 
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('تم استعادة الاتصال بالإنترنت', { duration: 2000 });
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('انقطع الاتصال بالإنترنت! يرجى التحقق من الشبكة.', { duration: Infinity });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <title>المطبخ المركزي</title>
        <meta name="description" content="نظام إدارة المطبخ المركزي" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="theme-color" content="#e0e5ec" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#050505" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="bg-[#e0e5ec] text-[#2d3748] dark:bg-[#050505] dark:text-white transition-colors duration-0 overscroll-y-none">
        <ThemeProvider>
          
          {isOffline && (
            <div className="fixed top-0 left-0 right-0 w-full bg-red-600 text-white text-center py-2 text-sm font-bold z-[999999]">
              ⚠️ لا يوجد اتصال بالإنترنت!
            </div>
          )}

          {/* إخفاء تنبيهات الصوت في صفحة تسجيل الدخول */}
          {!isLoginPage && <AudioAlert />}

          {/* تغليف محتوى النظام بالحارس الأمني */}
          <AuthGuard>
            <PullToRefresh>
              <div className="flex min-h-screen w-full overflow-x-hidden">
                <main className="flex-1 w-full relative pb-24">
                  {children}
                </main>
              </div>
            </PullToRefresh>
            
            {/* إخفاء القائمة السفلية إذا كنا في صفحة الدخول */}
            {!isLoginPage && <BottomDock />}
          </AuthGuard>
          
          <Toaster 
            position="top-center" 
            richColors 
            dir="rtl"
            closeButton={true}
            duration={2000} 
            visibleToasts={2}
            toastOptions={{ className: 'font-sans' }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}