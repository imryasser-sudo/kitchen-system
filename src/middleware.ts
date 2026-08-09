import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // تم إيقاف الحارس الأمني مؤقتاً حتى نربط صفحة تسجيل الدخول الجديدة بشكل صحيح
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icon.png).*)',
  ],
};