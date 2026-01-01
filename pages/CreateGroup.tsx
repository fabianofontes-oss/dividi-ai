import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Group, CurrencyCode } from '../types';
import { Icons } from '../components/ui/Icons';
import { useStore } from '../store/StoreContext';

type GroupMode = 'event' | 'recurring';

const CreateGroup: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, addGroup, showToast, groups } = useStore();

  // State
  const [mode, setMode] = useState<GroupMode>('event');
  const [name, setName] = useState('');
  const [dates, setDates] = useState('');
  const [type, setType] = useState<Group['type']>('trip');

  // Default to user preference, or BRL if not set
  const [currency, setCurrency] = useState<CurrencyCode>(currentUser.defaultCurrency || 'BRL');

  const [members, setMembers] = useState<User[]>([currentUser]);
  const [newMemberName, setNewMemberName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Lista de moedas
  const allCurrencies: { code: CurrencyCode, label: string, iso: string }[] = [
    { code: 'BRL', label: 'Real', iso: 'br' },
    { code: 'USD', label: 'Dólar', iso: 'us' },
    { code: 'EUR', label: 'Euro', iso: 'eu' },
    { code: 'GBP', label: 'Libra', iso: 'gb' },
  ];

  const userActiveCurrencies = (currentUser.activeCurrencies || ['BRL']);
  const availableCurrencies = allCurrencies.filter(c => userActiveCurrencies.includes(c.code));

  // Reset type when mode changes
  useEffect(() => {
    if (mode === 'event') setType('trip');
    else setType('home');
  }, [mode]);

  useEffect(() => {
    if (!userActiveCurrencies.includes(currency)) {
      setCurrency(userActiveCurrencies[0] as CurrencyCode);
    }
  }, [userActiveCurrencies]);

  const handleAddMember = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMemberName.trim()) return;

    const newMember: User = {
      id: `temp_${Math.random().toString(36).substr(2, 9)}`,
      name: newMemberName.trim(),
      paymentHandles: []
    };

    setMembers([...members, newMember]);
    setNewMemberName('');
  };

  const handleImportContacts = async () => {
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      showToast('Seu navegador não suporta acesso à agenda.', 'info');
      return;
    }

    try {
      const props = ['name'];
      const opts = { multiple: false };
      // @ts-ignore - A API ContactsManager ainda é experimental em alguns TS
      const contacts = await navigator.contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        if (contact.name && contact.name.length > 0) {
          setNewMemberName(contact.name[0]);
        }
      }
    } catch (ex) {
      // Usuário cancelou ou erro
      console.debug('Seleção de contato cancelada', ex);
    }
  };

  const removeMember = (id: string) => {
    if (id === currentUser.id) return;
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) return alert("Digite um nome para o grupo");

    setIsSaving(true);

    // Gera ID único ANTES de salvar
    const newGroupId = crypto?.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`;

    const newGroup: Group = {
      id: newGroupId,
      name,
      type,
      members: members,
      currency: currency,
      dates: mode === 'event' ? dates.trim() || undefined : undefined
    };

    try {
      await addGroup(newGroup);
      // Navega diretamente para o grupo criado
      navigate(`/group/${newGroupId}`);
    } catch (e) {
      console.error('Erro ao criar grupo:', e);
      setIsSaving(false);
    }
  };


  // Ícones baseados no modo
  const eventTypes = [
    { id: 'trip', label: 'Viagem', icon: Icons.Car },
    { id: 'event', label: 'Rolê / Festa', icon: Icons.Music },
    { id: 'other', label: 'Outro', icon: Icons.Zap },
  ];

  const recurringTypes = [
    { id: 'home', label: 'Casa / Rep', icon: Icons.Home },
    { id: 'couple', label: 'Casal', icon: Icons.Heart },
    { id: 'other', label: 'Outro', icon: Icons.Zap },
  ];

  const currentTypes = mode === 'event' ? eventTypes : recurringTypes;

  const supportsContacts = 'contacts' in navigator;

  return (
    <div className="p-6 pt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-32">
      <div className="flex items-center space-x-4 mb-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
          <Icons.ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Criar Novo Grupo</h1>
      </div>

      <div className="space-y-6">

        {/* Step 1: Mode Selection */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">Qual o objetivo?</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode('event')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-3 transition-all ${mode === 'event' ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:border-purple-200'}`}
            >
              <div className={`p-3 rounded-full ${mode === 'event' ? 'bg-purple-200 dark:bg-purple-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Icons.Calendar className="w-6 h-6" />
              </div>
              <div className="text-center">
                <span className="block font-bold text-sm">Evento / Viagem</span>
                <span className="block text-[10px] opacity-70 mt-1">Tem data para acabar</span>
              </div>
            </button>

            <button
              onClick={() => setMode('recurring')}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center space-y-3 transition-all ${mode === 'recurring' ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:border-purple-200'}`}
            >
              <div className={`p-3 rounded-full ${mode === 'recurring' ? 'bg-purple-200 dark:bg-purple-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <Icons.Repeat className="w-6 h-6" />
              </div>
              <div className="text-center">
                <span className="block font-bold text-sm">Dia a dia</span>
                <span className="block text-[10px] opacity-70 mt-1">Contínuo (Casa, Casal)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Name & Specific Type */}
        <div className="animate-in fade-in slide-in-from-right duration-500">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Nome do Grupo</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === 'event' ? "Ex: Carnaval 2024" : "Ex: Contas da Casa"}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none shadow-sm placeholder:text-slate-400 transition-colors"
          />

          <div className="flex space-x-2 mt-3">
            {currentTypes.map(t => (
              <button
                key={t.id}
                onClick={() => setType(t.id as any)}
                className={`flex-1 py-2 rounded-lg border flex items-center justify-center space-x-2 transition-all ${type === t.id ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
              >
                <t.icon className="w-4 h-4" />
                <span className="text-xs font-bold">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date (Only for Events) */}
        {mode === 'event' && (
          <div className="animate-in fade-in slide-in-from-top duration-300">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Quando?</label>
            <div className="relative">
              <Icons.Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                value={dates}
                onChange={(e) => setDates(e.target.value)}
                placeholder="Ex: 12 a 16 de Fev"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-12 pr-4 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Currency Selector */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Moeda</label>
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
            {availableCurrencies.map(c => (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code)}
                className={`flex-shrink-0 p-2 pr-4 rounded-xl border flex items-center space-x-2 transition-all ${currency === c.code ? 'bg-white dark:bg-slate-800 border-purple-500 shadow-sm ring-1 ring-purple-500/50' : 'bg-slate-50 dark:bg-slate-900 border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={`https://flagcdn.com/w40/${c.iso}.png`} className="w-6 h-auto rounded shadow-sm" alt={c.label} />
                <div className="text-left">
                  <span className={`text-sm font-bold ${currency === c.code ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{c.code}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Members */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Quem vai participar?</label>
          <form onSubmit={handleAddMember} className="flex space-x-2 mb-4">
            <div className="flex-1 relative">
              <input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Nome do amigo"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 text-slate-900 dark:text-white focus:border-purple-500 outline-none transition-colors"
              />
              {supportsContacts && (
                <button
                  type="button"
                  onClick={handleImportContacts}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  title="Importar da Agenda"
                >
                  <Icons.BookUser className="w-5 h-5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={!newMemberName.trim()}
              className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 rounded-xl font-bold disabled:opacity-50 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              <Icons.Plus className="w-6 h-6" />
            </button>
          </form>

          <div className="space-y-2">
            {members.map(user => {
              const isMe = user.id === currentUser.id;
              return (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                      {user.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-slate-900 dark:text-white font-medium">{user.name} {isMe && <span className="text-slate-400 font-normal">(Você)</span>}</span>
                  </div>
                  {!isMe && (
                    <button onClick={() => removeMember(user.id)} className="p-2 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300">
                      <Icons.Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-bold text-white shadow-lg shadow-purple-500/30 dark:shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center space-x-2 disabled:opacity-50 disabled:scale-100"
        >
          {isSaving ? <Icons.Repeat className="w-5 h-5 animate-spin" /> : <Icons.Check className="w-5 h-5" />}
          <span>{isSaving ? 'Criando...' : 'Criar Grupo'}</span>
        </button>

      </div>
    </div>
  );
};

export default CreateGroup;