/** Mensagens humanas para falhas de GPS (códigos da Geolocation API). */
export function geolocationErrorMessage(code: number | "unsupported"): string {
  switch (code) {
    case 1:
      return "Não temos permissão para usar sua localização. Você pode liberar nas configurações do navegador ou marcar o local no mapa.";
    case 2:
      return "Não conseguimos descobrir sua localização agora. Tente de novo ao ar livre ou marque o local no mapa.";
    case 3:
      return "A localização demorou demais para responder. Tente de novo ou marque o local no mapa.";
    case "unsupported":
      return "Este navegador não oferece localização. Marque o local no mapa ou busque o endereço.";
    default:
      return "Não conseguimos usar sua localização. Marque o local no mapa ou busque o endereço.";
  }
}

/** Precisão em texto ("precisão de ~30 m"), ou aviso quando é muito imprecisa. */
export function describeAccuracy(meters: number): string {
  if (meters <= 50) return `precisão de ~${Math.max(5, Math.round(meters / 5) * 5)} m`;
  if (meters <= 500) return `precisão de ~${Math.round(meters / 10) * 10} m — confira no mapa`;
  return "localização aproximada — ajuste o pino no mapa";
}
