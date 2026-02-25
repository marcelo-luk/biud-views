/**
 * Converte um objeto em uma string de parâmetros de consulta URL
 * @param params Objeto contendo os parâmetros
 * @returns String formatada de parâmetros de consulta (sem o '?' inicial)
 */
export function objectToQueryParams(params: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }
  
    return Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        // Trata arrays
        if (Array.isArray(value)) {
          return value
            .map(item => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
            .join('&');
        }
        
        // Trata objetos aninhados
        if (typeof value === 'object') {
          return encodeURIComponent(key) + '=' + encodeURIComponent(JSON.stringify(value));
        }
        
        // Trata valores simples
        return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
      })
      .join('&');
  }