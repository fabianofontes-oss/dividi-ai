import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../components/ui/Icons';
import { useStore } from '../store/StoreContext';
import { CurrencyCode } from '../types';
import { PAYMENT_RAILS } from '../core/paymentRails';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, updateUser, showToast, importLocalData, localImportAvailable, clearLocalAfterDecision } = useStore();

  // Basic Info
  const [name, setName] = useState(currentUser?.name || '');

  // Region Settings
  const [activeCurrencies, setActiveCurrencies] = useState<CurrencyCode[]>(currentUser?.activeCurrencies || ['BRL']);
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(currentUser?.defaultCurrency || 'BRL');

  // Payment Handles State (Local editing)
  const [handles, setHandles] = useState(currentUser?.paymentHandles || []);

  // UI State
  const [isSaved, setIsSaved] = useState(false);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  // Update local state when currentUser changes (e.g. after login)
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setHandles(currentUser.paymentHandles || []);
      if (currentUser.activeCurrencies) setActiveCurrencies(currentUser.activeCurrencies);
      if (currentUser.defaultCurrency) setDefaultCurrency(currentUser.defaultCurrency);
    }
  }, [currentUser]);

  // Ensure activeCurrencies has at least default currency or BRL
  useEffect(() => {
    if (activeCurrencies.length === 0) {
      setActiveCurrencies(['BRL']);
    }
  }, [activeCurrencies]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDark(true);
    }
  };

  const handleSave = () => {
    if (!currentUser) return;
    updateUser({
      ...currentUser,
      name,
      defaultCurrency,
      activeCurrencies,
      paymentHandles: handles
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const toggleCurrency = (code: CurrencyCode) => {
    if (activeCurrencies.includes(code)) {
      if (activeCurrencies.length > 1) {
        const newActive = activeCurrencies.filter(c => c !== code);
        setActiveCurrencies(newActive);
        if (defaultCurrency === code) {
          setDefaultCurrency(newActive[0]);
        }
      }
    } else {
      setActiveCurrencies([...activeCurrencies, code]);
    }
  };

  const updateHandle = (railId: string, value: string) => {
    setHandles(prev => {
      const existing = prev.find(h => h.railId === railId);
      if (existing) {
        if (!value.trim()) return prev.filter(h => h.railId !== railId); // Remove if empty
        return prev.map(h => h.railId === railId ? { ...h, value } : h);
      } else {
        if (!value.trim()) return prev;
        return [...prev, { railId, value }];
      }
    });
  };

  // Group Rails by Country for display based on active currencies
  const visibleRails = useMemo(() => {
    const rails = Object.values(PAYMENT_RAILS);
    const filtered = rails.filter(r => r.currencies.some(c => activeCurrencies.includes(c)));
    const grouped: Record<string, typeof rails> = {};
    filtered.forEach(r => {
      if (!grouped[r.countryCode]) grouped[r.countryCode] = [];
      grouped[r.countryCode].push(r);
    });
    Object.keys(grouped).forEach(k => {
      grouped[k].sort((a, b) => a.priority - b.priority);
    });
    return grouped;
  }, [activeCurrencies]);

  const allCurrencies: { code: CurrencyCode, label: string, iso: string, color: string }[] = [
    { code: 'BRL', label: 'Brasil', iso: 'br', color: 'text-emerald-600' },
    { code: 'USD', label: 'EUA', iso: 'us', color: 'text-purple-600' },
    { code: 'EUR', label: 'Europa', iso: 'eu', color: 'text-blue-600' },
    { code: 'GBP', label: 'R. Unido', iso: 'gb', color: 'text-indigo-600' },
    { code: 'CAD', label: 'Canadá', iso: 'ca', color: 'text-amber-600' },
    { code: 'CLP', label: 'Chile', iso: 'cl', color: 'text-rose-600' },
    { code: 'AUD', label: 'Austrália', iso: 'au', color: 'text-yellow-600' },
    { code: 'INR', label: 'Índia', iso: 'in', color: 'text-orange-600' },
    { code: 'SGD', label: 'Singapura', iso: 'sg', color: 'text-red-500' },
  ];

  if (!currentUser) return null; // Should be protected by AuthGuard

  return (
    <div className="p-6 pt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-32">

      <div className="flex items-center space-x-4 mb-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 p-[2px]">
          <div className="w-full h-full rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
            <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              {currentUser.name.substring(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meu Perfil</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Gerencie seus dados e preferências</p>
        </div>
      </div>

      <div className="space-y-8">

        {/* CLOUD SYNC SECTION */}
        {!session ? (
          <div className="bg-gradient-to-r from-purple-900 to-slate-900 rounded-xl p-4 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h3 className="font-bold flex items-center"><Icons.Zap className="w-4 h-4 mr-1 text-yellow-400" /> Backup na Nuvem</h3>
                <p className="text-xs text-slate-300 mt-1">Seus dados estão apenas neste celular.<br />Faça login para não perder nada.</p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-white text-purple-900 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors"
              >
                Conectar
              </button>
            </div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600 rounded-full blur-2xl opacity-50 -translate-y-10 translate-x-10"></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800/30 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-full text-emerald-600 dark:text-emerald-400">
                  <Icons.Check className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Conta Conectada</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">{session.user.email}</p>
                </div>
              </div>
            </div>

            {/* Import/Discard Banner */}
            {localImportAvailable && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border-2 border-amber-200 dark:border-amber-800/30 space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-full text-amber-600 dark:text-amber-400">
                    <Icons.AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Dados locais encontrados!</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                      {localImportAvailable.groups} grupo(s) e {localImportAvailable.expenses} gasto(s) salvos neste dispositivo.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={importLocalData}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition-all"
                  >
                    <Icons.Download className="w-4 h-4" />
                    <span>Importar Agora</span>
                  </button>
                  <button
                    onClick={clearLocalAfterDecision}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome de exibição</label>
          <div className="relative">
            <Icons.User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-12 pr-4 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Theme Toggle */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-purple-600 dark:text-purple-400">
              {isDark ? <Icons.Moon className="w-5 h-5" /> : <Icons.Sun className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Aparência</p>
              <p className="text-xs text-slate-500">Alternar modo claro/escuro</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isDark ? 'bg-purple-600' : 'bg-slate-300'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isDark ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Countries & Rails (Omitted details for brevity, assumes keep existing implementation below) */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Meus Países</label>
            <div className="grid grid-cols-4 gap-3 mt-2">
              {allCurrencies.map(c => {
                const isActive = activeCurrencies.includes(c.code);
                return (
                  <button
                    key={c.code}
                    onClick={() => toggleCurrency(c.code)}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative ${isActive
                      ? 'bg-white dark:bg-slate-800 shadow-md scale-105 border-2 border-purple-500 z-10'
                      : 'bg-slate-100 dark:bg-slate-900 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:scale-105 border border-transparent'
                      }`}
                  >
                    <img
                      src={`https://flagcdn.com/w80/${c.iso}.png`}
                      alt={c.label}
                      className="w-10 h-auto object-cover mb-1 rounded shadow-sm"
                      loading="lazy"
                    />
                    <span className={`text-[9px] font-bold tracking-wider ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                      {c.code}
                    </span>
                    {isActive && <div className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full shadow-sm"></div>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Payment Rails Section from previous code... */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center"><Icons.CreditCard className="w-5 h-5 mr-2" /> Métodos de Pagamento</h3>

            <div className="space-y-6">
              {Object.keys(visibleRails).map(countryCode => {
                const currency = allCurrencies.find(c => c.iso.toUpperCase() === countryCode || (countryCode === 'EU' && c.iso === 'eu'));
                const flagUrl = currency ? `https://flagcdn.com/w40/${currency.iso}.png` : null;

                return (
                  <div key={countryCode} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-2 mb-3">
                      {flagUrl && <img src={flagUrl} alt={countryCode} className="w-6 h-auto rounded shadow-sm" />}
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{countryCode}</span>
                    </div>
                    <div className="space-y-4">
                      {visibleRails[countryCode].map(rail => {
                        const handle = handles.find(h => h.railId === rail.id);
                        return (
                          <div key={rail.id} className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase flex items-center justify-between">
                              <span>{rail.name}</span>
                              {rail.supportsQr && <Icons.QrCode className="w-3 h-3 text-slate-400" />}
                            </label>
                            <input
                              value={handle?.value || ''}
                              onChange={e => updateHandle(rail.id, e.target.value)}
                              placeholder={rail.placeholder}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-white focus:border-purple-500 outline-none"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        <button
          onClick={handleSave}
          className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center space-x-2 shadow-lg ${isSaved ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/30'}`}
        >
          {isSaved ? <><Icons.Check className="w-5 h-5" /><span>Salvo com sucesso!</span></> : <><Icons.Save className="w-5 h-5" /><span>Salvar Alterações</span></>}
        </button>
      </div>

      {session && (
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
          <button onClick={handleLogout} className="flex items-center space-x-2 text-rose-500 text-sm font-medium">
            <Icons.LogOut className="w-4 h-4" /><span>Sair da conta</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;