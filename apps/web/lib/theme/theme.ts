// Tema da MEL: preferência (o que a pessoa escolheu) × tema resolvido (o que
// está na tela). "system" segue prefers-color-scheme do aparelho.

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

/** Chave no localStorage (antes do login). Sincronizar com o perfil: ver ThemeProvider. */
export const THEME_STORAGE_KEY = "mel-theme";

/**
 * Roda no <head>, ANTES da primeira pintura: aplica data-theme no <html> para
 * não piscar branco antes do escuro. Mantido mínimo e sem dependências.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themePref=p;}catch(e){}})();`;
