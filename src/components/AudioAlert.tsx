"use client";

import { useEffect } from 'react';

// دالة جاهزة يمكن استدعاؤها من أي مكان لتشغيل الصوت
export const playNotificationSound = () => {
  if (typeof window !== 'undefined') {
    const audio = new Audio('/notification.mp3');
    audio.play().catch((err) => console.log('التشغيل التلقائي مقفل مؤقتاً:', err));
  }
};

export default function AudioAlert() {
  useEffect(() => {
    // هذا المكان محجوز لربط قراءة الطلبيات الحية (Real-time) من Supabase
    // سنقوم بتفعيله مع كود الداشبورد القادم
  }, []);

  return null; 
}