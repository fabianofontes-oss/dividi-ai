import { createClient } from '@supabase/supabase-js';

// Chaves do plano GRATUITO do Supabase (fornecidas)
// Isso permite que o app funcione imediatamente sem configuração de .env
const LIVE_URL = 'https://dihjgcgkbfhonxzxootw.supabase.co';
const LIVE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpaGpnY2drYmZob254enhvb3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTA0NzEsImV4cCI6MjA4Mjc4NjQ3MX0.ooCJZukbmDXAQfobEmuvbhj8s2GQexGNo3X2QTQVq54';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || LIVE_URL;
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || LIVE_KEY;

export const supabase = createClient(
  SUPABASE_URL, 
  SUPABASE_KEY
);

export const getErrorMessage = (error: any) => {
  if (!error) return null;
  return error.message || 'Ocorreu um erro desconhecido.';
};