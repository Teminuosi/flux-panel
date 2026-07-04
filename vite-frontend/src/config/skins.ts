// P2 多主题(皮肤):6 套渐变皮肤,复用 s-ui 已拍板的那套。默认第一套 aurora。
// 每套 = 一个 HeroUI 主题(在 tailwind.config.js 里定义)+ 一层固定渐变背景(themes.css)。
export interface Skin {
  id: string;
  name: string;
  base: "light" | "dark";
  swatch: string; // 选择器里的小色块 = 该皮肤渐变的缩影
}

export const SKINS: Skin[] = [
  { id: "aurora", name: "极光", base: "dark", swatch: "linear-gradient(135deg,#302b63,#a855f7)" },
  { id: "mesh", name: "流光", base: "light", swatch: "linear-gradient(135deg,#c2e9fb,#fbc2eb)" },
  { id: "deepsea", name: "深海", base: "dark", swatch: "linear-gradient(135deg,#0e3a5f,#38bdf8)" },
  { id: "sunrise", name: "晨曦", base: "light", swatch: "linear-gradient(135deg,#ffaa96,#b4a0ff)" },
  { id: "cyber", name: "赛博", base: "dark", swatch: "linear-gradient(135deg,#ec4899,#22d3ee)" },
  { id: "mint", name: "薄荷", base: "light", swatch: "linear-gradient(135deg,#a7f3d0,#bae6fd)" },
];

export const DEFAULT_SKIN = "aurora";

export function savedSkin(): Skin {
  const id = typeof localStorage !== "undefined" ? localStorage.getItem("skin") : null;
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

// 把皮肤落到 <html>:主题类(驱动 HeroUI 主题)+ dark 类(驱动 tailwind 的 dark: 工具类)。
export function applySkin(id: string): void {
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0];
  const html = document.documentElement;
  SKINS.forEach((s) => html.classList.remove(s.id));
  html.classList.add(skin.id);
  if (skin.base === "dark") html.classList.add("dark");
  else html.classList.remove("dark");
  html.style.colorScheme = skin.base;
  localStorage.setItem("skin", skin.id);
}
