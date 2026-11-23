// Estilo da barra de abas do celular: preferência por aparelho, como o tema.
// "expand" = "Aba que se abre" (padrão); "orb" = "Círculo dourado".

export const DEFAULT_TABBAR = "expand" as const;

export const TABBAR_STYLES = ["expand", "orb"] as const;
export type TabBarStyle = (typeof TABBAR_STYLES)[number];

/** Chave no localStorage. */
export const TABBAR_STORAGE_KEY = "mel-tabbar";

/**
 * Roda no <head>, ANTES da primeira pintura (junto do script do tema): aplica data-tabbar no <html>.
 * A barra é a mesma marcação nos dois estilos e o CSS escolhe por esse atributo, então ela já nasce
 * no estilo escolhido, sem piscar o outro. Mantido mínimo e sem dependências.
 */
export const TABBAR_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("${TABBAR_STORAGE_KEY}");document.documentElement.dataset.tabbar=s==="orb"?"orb":"${DEFAULT_TABBAR}";}catch(e){}})();`;
