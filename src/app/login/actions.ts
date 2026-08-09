'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  console.log("=== عملية فحص تسجيل الدخول ===");
  
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;
  
  const email = username.includes('@') ? username : `${username}@kitchen.com`;
  console.log("1. الإيميل المرسل للسيرفر:", email);
  
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.log("❌ 2. سبب الرفض من Supabase هو:", error.message);
    redirect('/login?error=true');
  }

  console.log("✅ 2. نجح الدخول! جاري التوجيه للوحة التحكم...");
  revalidatePath('/', 'layout');
  redirect('/hub'); 
}