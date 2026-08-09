"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  userRole: string;
  setUserRole: (role: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: true, 
  toggleTheme: () => {},
  userRole: 'admin',
  setUserRole: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState('admin');

  useEffect(() => {
    setMounted(true);
    
    // قراءة الصلاحية (لتلوين النظام بناءً عليها لاحقاً)
    const savedRole = localStorage.getItem('user_role') || 'admin';
    setUserRole(savedRole);
    document.documentElement.setAttribute('data-role', savedRole);

    // قراءة الثيم أو المزامنة التلقائية مع النظام
    const savedTheme = localStorage.getItem('global_theme_v1');
    if (savedTheme) {
      const isDarkMode = savedTheme === 'dark';
      setIsDark(isDarkMode);
      isDarkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
    } else {
      // المزامنة مع تفضيلات جهاز المستخدم (نهاري/ليلي)
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
      prefersDark ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('global_theme_v1', newTheme ? 'dark' : 'light');
    
    if (newTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleSetRole = (role: string) => {
    setUserRole(role);
    localStorage.setItem('user_role', role);
    document.documentElement.setAttribute('data-role', role);
  };

  if (!mounted) {
    return <div className="invisible">{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, userRole, setUserRole: handleSetRole }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);