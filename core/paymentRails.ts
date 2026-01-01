import { PaymentRail, User, CurrencyCode } from '../types';

// Catálogo Global de Trilhos de Pagamento (Tier 1 & 2)
export const PAYMENT_RAILS: Record<string, PaymentRail> = {
  // --- TIER 1: CORE MARKETS ---
  'br_pix': {
    id: 'br_pix',
    name: 'Pix',
    countryCode: 'BR',
    flag: '🇧🇷',
    currencies: ['BRL'],
    inputType: 'alphanumeric',
    placeholder: 'Chave CPF, Email, Telefone ou Aleatória',
    priority: 1,
    supportsQr: true
  },
  'us_zelle': {
    id: 'us_zelle',
    name: 'Zelle',
    countryCode: 'US',
    flag: '🇺🇸',
    currencies: ['USD'],
    inputType: 'email', // ou phone
    placeholder: 'Email ou Mobile Number',
    priority: 1,
    supportsQr: false
  },
  'us_venmo': {
    id: 'us_venmo',
    name: 'Venmo',
    countryCode: 'US',
    flag: '🇺🇸',
    currencies: ['USD'],
    inputType: 'alphanumeric',
    placeholder: 'Username (@user)',
    priority: 2,
    supportsQr: true
  },
  'eu_sepa': {
    id: 'eu_sepa',
    name: 'IBAN (SEPA)',
    countryCode: 'EU',
    flag: '🇪🇺',
    currencies: ['EUR'],
    inputType: 'iban',
    placeholder: 'IBAN (Ex: IE12 BOFI...)',
    priority: 10, // Fallback genérico para Euro
    supportsQr: false
  },
  'es_bizum': {
    id: 'es_bizum',
    name: 'Bizum',
    countryCode: 'ES',
    flag: '🇪🇸',
    currencies: ['EUR'],
    inputType: 'phone',
    placeholder: 'Número de Móvil',
    priority: 1,
    supportsQr: false
  },
  'pt_mbway': {
    id: 'pt_mbway',
    name: 'MB WAY',
    countryCode: 'PT',
    flag: '🇵🇹',
    currencies: ['EUR'],
    inputType: 'phone',
    placeholder: 'Número de Telemóvel',
    priority: 1,
    supportsQr: false
  },
  'gb_faster': {
    id: 'gb_faster',
    name: 'Faster Payments',
    countryCode: 'GB',
    flag: '🇬🇧',
    currencies: ['GBP'],
    inputType: 'bank_details',
    placeholder: 'Sort Code + Account Number',
    priority: 1,
    supportsQr: false
  },
  'ca_interac': {
    id: 'ca_interac',
    name: 'Interac e-Transfer',
    countryCode: 'CA',
    flag: '🇨🇦',
    currencies: ['CAD'],
    inputType: 'email',
    placeholder: 'Email address',
    priority: 1,
    supportsQr: false
  },
  
  // --- TIER 2: GLOBAL EXPANSION ---
  'cl_rut': {
    id: 'cl_rut',
    name: 'Transferencia (RUT)',
    countryCode: 'CL',
    flag: '🇨🇱',
    currencies: ['CLP'],
    inputType: 'bank_details',
    placeholder: 'Banco, Tipo, Conta, RUT, Email',
    priority: 1,
    supportsQr: false
  },
  'au_payid': {
    id: 'au_payid',
    name: 'PayID',
    countryCode: 'AU',
    flag: '🇦🇺',
    currencies: ['AUD'],
    inputType: 'alphanumeric',
    placeholder: 'Phone, Email or ABN',
    priority: 1,
    supportsQr: false
  },
  'in_upi': {
    id: 'in_upi',
    name: 'UPI',
    countryCode: 'IN',
    flag: '🇮🇳',
    currencies: ['INR'],
    inputType: 'alphanumeric',
    placeholder: 'VPA (ex: name@bank)',
    priority: 1,
    supportsQr: true
  },
  'sg_paynow': {
    id: 'sg_paynow',
    name: 'PayNow',
    countryCode: 'SG',
    flag: '🇸🇬',
    currencies: ['SGD'],
    inputType: 'alphanumeric',
    placeholder: 'Mobile or UEN/NRIC',
    priority: 1,
    supportsQr: true
  },
  'th_promptpay': {
    id: 'th_promptpay',
    name: 'PromptPay',
    countryCode: 'TH',
    flag: '🇹🇭',
    currencies: ['THB'],
    inputType: 'phone', // or Citizen ID
    placeholder: 'Mobile Number or ID',
    priority: 1,
    supportsQr: true
  },
  'se_swish': {
    id: 'se_swish',
    name: 'Swish',
    countryCode: 'SE',
    flag: '🇸🇪',
    currencies: ['SEK'],
    inputType: 'phone',
    placeholder: 'Mobile Number',
    priority: 1,
    supportsQr: true
  },
  'pl_blik': {
    id: 'pl_blik',
    name: 'BLIK',
    countryCode: 'PL',
    flag: '🇵🇱',
    currencies: ['PLN'],
    inputType: 'phone',
    placeholder: 'Phone Number',
    priority: 1,
    supportsQr: false
  },
  'mx_spei': { // CoDi é sobreposto por SPEI muitas vezes
    id: 'mx_spei',
    name: 'SPEI (CLABE)',
    countryCode: 'MX',
    flag: '🇲🇽',
    currencies: ['MXN'],
    inputType: 'bank_details',
    placeholder: 'CLABE (18 dígitos)',
    priority: 1,
    supportsQr: false
  },
  'pe_yape': {
    id: 'pe_yape',
    name: 'Yape / Plin',
    countryCode: 'PE',
    flag: '🇵🇪',
    currencies: ['PEN'],
    inputType: 'phone',
    placeholder: 'Número de Celular',
    priority: 1,
    supportsQr: true
  },
  'co_transfiya': {
    id: 'co_transfiya',
    name: 'Transfiya',
    countryCode: 'CO',
    flag: '🇨🇴',
    currencies: ['COP'],
    inputType: 'phone',
    placeholder: 'Número de Celular',
    priority: 1,
    supportsQr: false
  }
};

/**
 * Encontra o melhor método de pagamento para um usuário numa moeda específica.
 * Prioriza métodos locais rápidos (ex: Bizum) sobre genéricos (IBAN).
 */
export const resolvePaymentHandle = (user: User, currency: CurrencyCode): { rail: PaymentRail, value: string } | null => {
  if (!user.paymentHandles || user.paymentHandles.length === 0) return null;

  // 1. Filtrar rails que suportam a moeda
  const supportedRails = Object.values(PAYMENT_RAILS).filter(r => r.currencies.includes(currency));
  
  // 2. Cruzar com o que o usuário tem cadastrado
  const userSupportedHandles = user.paymentHandles.filter(h => 
    supportedRails.some(r => r.id === h.railId)
  );

  if (userSupportedHandles.length === 0) return null;

  // 3. Ordenar por prioridade do Rail
  // (Menor número = maior prioridade)
  userSupportedHandles.sort((a, b) => {
    const railA = PAYMENT_RAILS[a.railId];
    const railB = PAYMENT_RAILS[b.railId];
    return (railA?.priority || 99) - (railB?.priority || 99);
  });

  const bestHandle = userSupportedHandles[0];
  const rail = PAYMENT_RAILS[bestHandle.railId];

  return { rail, value: bestHandle.value };
};

export const getRail = (id: string) => PAYMENT_RAILS[id];
