"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // هنا تقدر لاحقاً ترسل الخطأ لنظام تتبع مثل Sentry
    console.error("حدث خطأ في النظام:", error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-rose-100 dark:bg-rose-500/10 p-6 rounded-full mb-6">
        <AlertTriangle className="w-16 h-16 text-rose-600 dark:text-rose-500" strokeWidth={1.5} />
      </div>
      
      <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">
        عذراً، حدث خطأ غير متوقع!
      </h2>
      
      <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8 leading-relaxed">
        يبدو أن هناك خلل في جلب البيانات أو انقطاع في الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.
      </p>
      
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
      >
        <RotateCcw className="w-5 h-5" />
        <span>إعادة تحميل الصفحة</span>
      </button>
    </div>
  );
}