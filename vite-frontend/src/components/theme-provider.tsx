import React, { useEffect } from 'react';
import { applySkin, savedSkin } from '@/config/skins';

interface ThemeProviderProps {
  children: React.ReactNode;
}

// 应用已保存的皮肤(默认 aurora)。不再强制跟随系统深浅色——皮肤自带 light/dark 基座。
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  useEffect(() => {
    applySkin(savedSkin().id);
  }, []);

  return <>{children}</>;
};
