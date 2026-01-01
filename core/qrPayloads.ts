/**
 * Gerador de payloads QR para diferentes sistemas de pagamento internacionais
 * Cada função retorna o payload adequado para ser convertido em QR Code
 */

// ============================================
// HELPERS (reutilizados de pix.ts)
// ============================================

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

const normalize = (str: string): string => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

// ============================================
// UPI (India) - Universal Payments Interface
// Format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&cu=INR
// ============================================
export const generateUpiPayload = (
    vpa: string,
    name: string,
    amount?: number,
    description?: string
): string => {
    const cleanVpa = vpa.trim();
    const cleanName = encodeURIComponent(name.substring(0, 50) || 'User');

    let url = `upi://pay?pa=${encodeURIComponent(cleanVpa)}&pn=${cleanName}`;

    if (amount && amount > 0) {
        url += `&am=${amount.toFixed(2)}`;
    }

    url += '&cu=INR';

    if (description) {
        url += `&tn=${encodeURIComponent(description.substring(0, 50))}`;
    }

    return url;
};

// ============================================
// PayNow (Singapore) - EMVCo format
// Similar to PIX but with Singapore-specific identifiers
// ============================================
export const generatePayNowPayload = (
    proxyType: 'MOBILE' | 'UEN' | 'NRIC',
    proxyValue: string,
    name: string,
    amount?: number,
    reference?: string
): string => {
    const cleanValue = proxyValue.replace(/\s/g, '');
    const cleanName = normalize(name).substring(0, 25) || 'USER';
    const txRef = reference ? normalize(reference).replace(/[^A-Z0-9]/g, '').substring(0, 25) : '';

    let payload = '';

    // 00 - Payload Format Indicator
    payload += formatField('00', '01');

    // 01 - Point of Initiation Method
    payload += formatField('01', amount && amount > 0 ? '12' : '11');

    // 26 - Merchant Account Information (PayNow)
    let merchantInfo = '';
    merchantInfo += formatField('00', 'SG.PAYNOW'); // GUI
    merchantInfo += formatField('01', proxyType === 'MOBILE' ? '0' : proxyType === 'UEN' ? '2' : '1'); // Proxy type
    merchantInfo += formatField('02', cleanValue); // Proxy value
    merchantInfo += formatField('03', '1'); // Editable amount (1=yes, 0=no)
    payload += formatField('26', merchantInfo);

    // 52 - Merchant Category Code
    payload += formatField('52', '0000');

    // 53 - Transaction Currency (702 = SGD)
    payload += formatField('53', '702');

    // 54 - Transaction Amount
    if (amount && amount > 0) {
        payload += formatField('54', amount.toFixed(2));
    }

    // 58 - Country Code
    payload += formatField('58', 'SG');

    // 59 - Merchant Name
    payload += formatField('59', cleanName);

    // 60 - Merchant City
    payload += formatField('60', 'SINGAPORE');

    // 62 - Additional Data
    if (txRef) {
        let additionalInfo = '';
        additionalInfo += formatField('01', txRef);
        payload += formatField('62', additionalInfo);
    }

    // 63 - CRC16
    payload += '6304';
    const crc = crc16(payload);

    return payload + crc;
};

// ============================================
// PromptPay (Thailand) - EMVCo format
// Uses Thai mobile number or Citizen ID
// ============================================
export const generatePromptPayPayload = (
    phoneOrId: string,
    name: string,
    amount?: number
): string => {
    // Remove spaces and dashes
    let cleanId = phoneOrId.replace(/[\s\-]/g, '');

    // If starts with 0, add Thailand code
    if (cleanId.startsWith('0')) {
        cleanId = '66' + cleanId.substring(1);
    }

    // Pad to 13 digits for mobile (660XXXXXXXXX) or use as-is for 13-digit citizen ID
    const formattedId = cleanId.length === 10 ? cleanId.padStart(13, '0') : cleanId;

    const cleanName = normalize(name).substring(0, 25) || 'USER';

    let payload = '';

    // 00 - Payload Format Indicator
    payload += formatField('00', '01');

    // 01 - Point of Initiation Method
    payload += formatField('01', amount && amount > 0 ? '12' : '11');

    // 29 - Merchant Account Information (PromptPay - uses tag 29, not 26)
    let merchantInfo = '';
    merchantInfo += formatField('00', 'A000000677010111'); // PromptPay AID
    merchantInfo += formatField('01', formattedId); // Phone or ID
    payload += formatField('29', merchantInfo);

    // 52 - Merchant Category Code
    payload += formatField('52', '0000');

    // 53 - Transaction Currency (764 = THB)
    payload += formatField('53', '764');

    // 54 - Transaction Amount
    if (amount && amount > 0) {
        payload += formatField('54', amount.toFixed(2));
    }

    // 58 - Country Code
    payload += formatField('58', 'TH');

    // 59 - Merchant Name
    payload += formatField('59', cleanName);

    // 60 - Merchant City
    payload += formatField('60', 'BANGKOK');

    // 63 - CRC16
    payload += '6304';
    const crc = crc16(payload);

    return payload + crc;
};

// ============================================
// Swish (Sweden) - Deep Link format
// Format: swish://payment?data={...} or C:SWISH format
// ============================================
export const generateSwishPayload = (
    phoneNumber: string,
    amount?: number,
    message?: string
): string => {
    // Clean phone number (Swedish format: 07XXXXXXXX or +467XXXXXXXX)
    let cleanPhone = phoneNumber.replace(/[\s\-]/g, '');

    // Normalize to 467XXXXXXXX format
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '46' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('+')) {
        cleanPhone = cleanPhone.substring(1);
    }

    // Build Swish URL (prefixed format for QR)
    // The C: prefix indicates it's a Swish payment QR
    let payload = `C:${cleanPhone}`;

    if (amount && amount > 0) {
        payload += `;${amount.toFixed(2)}`;
    } else {
        payload += ';0'; // Editable amount
    }

    if (message) {
        payload += `;${message.substring(0, 50)}`;
    }

    return payload;
};

// ============================================
// Venmo (USA) - Deep Link format
// Format: venmo://paycharge?txn=pay&recipients=USERNAME&amount=X
// ============================================
export const generateVenmoPayload = (
    username: string,
    amount?: number,
    note?: string
): string => {
    // Remove @ if present
    const cleanUsername = username.replace('@', '');

    let url = `venmo://paycharge?txn=pay&recipients=${encodeURIComponent(cleanUsername)}`;

    if (amount && amount > 0) {
        url += `&amount=${amount.toFixed(2)}`;
    }

    if (note) {
        url += `&note=${encodeURIComponent(note.substring(0, 280))}`;
    }

    return url;
};

// ============================================
// Yape (Peru) - Phone-based, usually just displays phone
// For QR scanning, Yape uses their own app QR format
// Fallback to phone number for manual use
// ============================================
export const generateYapePayload = (
    phoneNumber: string,
    name?: string,
    amount?: number
): string => {
    // Yape doesn't have a public QR standard, so we generate a readable format
    // Users scan this and manually input in Yape app
    let cleanPhone = phoneNumber.replace(/[\s\-]/g, '');

    // Add Peru country code if needed
    if (cleanPhone.startsWith('9') && cleanPhone.length === 9) {
        cleanPhone = '51' + cleanPhone;
    } else if (cleanPhone.startsWith('0')) {
        cleanPhone = '51' + cleanPhone.substring(1);
    }

    // Build a simple info string that Yape can potentially recognize
    // or users can read manually
    let payload = `YAPE:${cleanPhone}`;

    if (name) {
        payload += `:${name.substring(0, 30)}`;
    }

    if (amount && amount > 0) {
        payload += `:${amount.toFixed(2)}`;
    }

    return payload;
};

// ============================================
// DISPATCHER - Selects the right generator based on rail ID
// ============================================
export type QrPayloadGenerator = (
    key: string,
    name: string,
    city?: string,
    amount?: number,
    description?: string
) => string;

export const getQrPayload = (
    railId: string,
    key: string,
    name: string,
    city: string = '',
    amount?: number,
    description?: string
): string => {
    switch (railId) {
        case 'br_pix':
            // PIX is handled by core/pix.ts - this is a fallback
            // Import generateBrCode from pix.ts in the component instead
            return ''; // Will be handled separately

        case 'in_upi':
            return generateUpiPayload(key, name, amount, description);

        case 'sg_paynow':
            // Detect proxy type from format
            const isUen = /^[A-Z0-9]{9,10}$/i.test(key);
            const isMobile = /^[89]\d{7}$/.test(key) || /^\+65[89]\d{7}$/.test(key);
            const proxyType = isUen ? 'UEN' : isMobile ? 'MOBILE' : 'NRIC';
            return generatePayNowPayload(proxyType, key, name, amount, description);

        case 'th_promptpay':
            return generatePromptPayPayload(key, name, amount);

        case 'se_swish':
            return generateSwishPayload(key, amount, description);

        case 'us_venmo':
            return generateVenmoPayload(key, amount, description);

        case 'pe_yape':
            return generateYapePayload(key, name, amount);

        default:
            // For rails without specific QR format, just return the key
            return key;
    }
};
