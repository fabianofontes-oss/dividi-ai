-- ============================================
-- POLÍTICAS DE STORAGE - BUCKET RECEIPTS
-- ============================================
-- Execute este SQL no painel do Supabase:
-- Dashboard → SQL Editor → New Query → Cole e Execute
-- ============================================

-- 1. Permitir Listagem Pública de Buckets
CREATE POLICY IF NOT EXISTS "Allow public to list buckets"
ON storage.buckets FOR SELECT
TO public
USING (true);

-- 2. Permitir Visualizar Arquivos do Bucket Receipts
CREATE POLICY IF NOT EXISTS "Anyone can view receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- 3. Permitir Upload para Usuários Autenticados
CREATE POLICY IF NOT EXISTS "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- 4. Permitir Exclusão (Opcional - Apenas Donos)
CREATE POLICY IF NOT EXISTS "Users can delete their own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts' AND owner = auth.uid());

-- ============================================
-- VERIFICAÇÃO (Execute para testar)
-- ============================================
-- SELECT * FROM storage.buckets WHERE name = 'receipts';
-- SELECT * FROM pg_policies WHERE tablename = 'objects';
