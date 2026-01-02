import React, { useState } from 'react';
import { Icons } from '../components/ui/Icons';
import { useAuth } from '../src/modules/auth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

type AuthMode = 'magic' | 'password';

const Login: React.FC = () => {
  const { login, signup, error: authError } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<AuthMode>('magic');
  const [isSignUp, setIsSignUp] = useState(false); // Para alternar entre Login e Cadastro na aba de senha

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);

    try {
      if (mode === 'magic') {
        // --- LOGIN VIA LINK MÁGICO ---
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin, 
          },
        });
        if (error) throw error;
        setSent(true);
      } else {
        // --- LOGIN VIA SENHA ---
        if (isSignUp) {
          // Cadastrar
          const success = await signup(email, password, email.split('@')[0]);
          if (success) {
            alert('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
            setMode('password');
            setIsSignUp(false);
          } else {
            throw new Error(authError || 'Erro ao criar conta');
          }
        } else {
          // Entrar
          const success = await login(email, password);
          if (success) {
            navigate('/');
          } else {
            throw new Error(authError || 'E-mail ou senha incorretos');
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ocorreu um erro ao tentar entrar.';
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    localStorage.setItem('dividi_is_guest', 'true');
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 animate-in fade-in duration-500">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-purple-500/30">
            <Icons.Receipt className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">dividi.ai</h1>
          <p className="text-slate-500 text-sm mt-2">Racha inteligente entre amigos</p>
        </div>

        {sent ? (
          <div className="text-center animate-in fade-in zoom-in">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Check className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-2">Link Enviado!</h3>
            <p className="text-sm text-slate-500">Verifique seu email ({email}) para entrar.</p>
            <p className="text-xs text-slate-400 mt-2">Pode fechar esta aba.</p>
            <button onClick={() => setSent(false)} className="mt-6 text-purple-600 font-bold text-sm hover:underline">Tentar outro email</button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Tabs de Modo */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
               <button 
                 onClick={() => { setMode('magic'); setSent(false); }}
                 className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'magic' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
               >
                 Link Mágico
               </button>
               <button 
                 onClick={() => { setMode('password'); setSent(false); }}
                 className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'password' ? 'bg-white dark:bg-slate-700 shadow text-purple-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
               >
                 Senha
               </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-purple-500 dark:text-white transition-all placeholder:text-slate-400"
                />
              </div>

              {mode === 'password' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Senha</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-purple-500 dark:text-white transition-all placeholder:text-slate-400"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-purple-500/20"
              >
                {loading ? <Icons.Repeat className="w-5 h-5 animate-spin"/> : 
                 mode === 'magic' ? 'Entrar com Link Mágico' : 
                 isSignUp ? 'Criar Conta' : 'Entrar'}
              </button>
            </form>
            
            {mode === 'password' && (
              <div className="text-center">
                 <button 
                   type="button"
                   onClick={() => setIsSignUp(!isSignUp)}
                   className="text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline"
                 >
                   {isSignUp ? 'Já tem uma conta? Entrar' : 'Não tem conta? Cadastre-se'}
                 </button>
              </div>
            )}
            
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-4">
                <button 
                    type="button"
                    onClick={handleGuestAccess}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                >
                    Entrar como Visitante (Sem Login)
                </button>
            </div>
            
            <p className="text-center text-[10px] text-slate-400">
               {mode === 'magic' 
                 ? 'Enviaremos um link de acesso para o seu email. Sem senhas para decorar.' 
                 : 'Seus dados serão sincronizados na nuvem de forma segura.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;