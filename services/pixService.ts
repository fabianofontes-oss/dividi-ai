export const formatPixCopy = (key: string, amount?: number, description?: string): string => {
  // Nota: Isso não gera um payload BRCode EMV completo (que requer CRC16), 
  // mas cria uma string amigável ou o payload simples se a chave for aleatória/email/cpf.
  // Para MVP, retornamos a chave limpa para copiar, pois gerar EMV completo requer lib pesada.
  return key;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy', err);
    return false;
  }
};
