export default function Loading() {
  return (
    <div className="w-full h-full min-h-screen p-6 space-y-6 pt-12">
      {/* عنوان الصفحة الوهمي */}
      <div className="w-1/3 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
      
      {/* كروت الإحصائيات الوهمية */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
      </div>

      {/* قائمة العناصر الوهمية */}
      <div className="space-y-3 mt-8">
        <div className="w-full h-16 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
        <div className="w-full h-16 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse delay-75"></div>
        <div className="w-full h-16 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse delay-150"></div>
      </div>
    </div>
  );
}