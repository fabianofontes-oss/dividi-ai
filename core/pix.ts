
// Funções auxiliares para gerar o CRC16 (CCITT-FALSE)
const crc16 = (payload: string): string => {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polynomial;
      } else {
        crc = crc << 1;
      }
    }
  }

  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
};

const formatField = (id: string, value: string): string => {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
};

// Normaliza strings para o padrão (sem acentos, etc)
const normalize = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Gera o payload oficial do Pix (BR Code)
 * Se amount for 0 ou undefined, gera um QR estático sem valor definido.
 */
export const generateBrCode = (key: string, name: string, city: string, amount?: number, description?: string): string => {
  const cleanKey = key.trim();
  const cleanName = normalize(name).substring(0, 25) || 'DIVIDI USER';
  const cleanCity = normalize(city).substring(0, 15) || 'BRASILIA';
  const txId = description ? normalize(description).replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) : '***';

  let payload = '';

  // 00 - Payload Format Indicator
  payload += formatField('00', '01');
  
  // 26 - Merchant Account Information
  let merchantInfo = '';
  merchantInfo += formatField('00', 'BR.GOV.BCB.PIX'); // GUI
  merchantInfo += formatField('01', cleanKey); // Chave
  payload += formatField('26', merchantInfo);

  // 52 - Merchant Category Code
  payload += formatField('52', '0000');

  // 53 - Transaction Currency (986 = BRL)
  payload += formatField('53', '986');

  // 54 - Transaction Amount (Opcional)
  if (amount && amount > 0) {
    payload += formatField('54', amount.toFixed(2));
  }

  // 58 - Country Code
  payload += formatField('58', 'BR');

  // 59 - Merchant Name
  payload += formatField('59', cleanName);

  // 60 - Merchant City
  payload += formatField('60', cleanCity);

  // 62 - Additional Data Field Template
  let additionalInfo = '';
  additionalInfo += formatField('05', txId); // Reference Label (TxID)
  payload += formatField('62', additionalInfo);

  // 63 - CRC16
  payload += '6304'; // ID + Length do CRC
  
  // Calcula CRC
  const crc = crc16(payload);
  
  return payload + crc;
};

export const formatPixCopy = (key: string, name: string = 'Usuario', amount?: number): string => {
  // Retorna o BR Code completo para ser usado em Copia e Cola
  return generateBrCode(key, name, 'Brasilia', amount);
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
