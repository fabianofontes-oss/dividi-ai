import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, User, CurrencyCode } from '../types';
import { Icons } from '../components/ui/Icons';
import { useStore } from '../store/StoreContext';

const GroupSettings: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { groups, updateGroup, currentUser, showToast } = useStore();
  
  const [group, setGroup] = useState<Group | undefined>(undefined);
  const [name, setName] = useState('');
  const [type, setType] = useState<Group['type']>('other');
  const [currency, setCurrency] = useState<CurrencyCode>('BRL');
  const [members, setMembers] = useState<User[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  // Load Group Data
  useEffect(() => {
    const found = groups.find(g => g.id === id);
    if (found) {
      setGroup(found);
      setName(found.name);
      setType(found.type);
      setCurrency(found.currency);
      setMembers(found.members);
    }
  }, [id, groups]);

  if (!group) return <div>Carregando...</div>;

  const handleSave = async () => {
    if (!name.trim()) return alert("Nome inválido");
    setIsSaving(true);
    
    const updatedGroup: Group = {
      ...group,
      name,
      type,
      currency,
      members
    };

    await updateGroup(updatedGroup);
    setIsSaving(false);
    navigate(-1);
  };

  const removeMember = (userId: string) => {
    if (members.length <= 1) return alert("O grupo precisa ter pelo menos 1 membro.");
    if (confirm("Remover este membro? O histórico de gastos dele permanecerá, mas ele não aparecerá em novos rateios.")) {
        setMembers(prev => prev.filter(m => m.id !== userId));
    }
  };

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
        // @ts-ignore
        const contacts = await navigator.contacts.select(props, opts);
        if (contacts && contacts.length > 0) {
            setNewMemberName(contacts[0].name[0]);
        }
    } catch (ex) {
        console.debug('Seleção cancelada');
    }
  };

  const handleInviteWhatsApp = () => {
      // Como não temos Deep Linking real ainda, enviamos um texto genérico com o nome do grupo
      // Em um app real, aqui iria o link https://dividi.ai/invite/TOKEN
      const text = `Vem pro meu grupo "${group.name}" no dividi.ai! Vamos dividir as contas sem estresse.`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const allCurrencies: { code: CurrencyCode, label: string, iso: string }[] = [
    { code: 'BRL', label: 'Real', iso: 'br' },
    { code: 'USD', label: 'Dólar', iso: 'us' },
    { code: 'EUR', label: 'Euro', iso: 'eu' },
    { code: 'GBP', label: 'Libra', iso: 'gb' },
    { code: 'CAD', label: 'Canadá', iso: 'ca' },
    { code: 'CLP', label: 'Peso', iso: 'cl' },
    { code: 'AUD', label: 'Austrália', iso: 'au' },
    { code: 'INR', label: 'Índia', iso: 'in' },
    { code: 'SGD', label: 'Singapura', iso: 'sg' },
  ];

  const userActiveCurrencies = (currentUser.activeCurrencies || ['BRL']);
  const availableCurrencies = allCurrencies.filter(c => 
    userActiveCurrencies.includes(c.code) || c.code === currency
  );

  const supportsContacts = 'contacts' in navigator;

  return (
    <div className="p-6 pt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-32">
      <div className="flex items-center space-x-4 mb-2">
         <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
             <Icons.ChevronLeft className="w-6 h-6" />
         </button>
         <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ajustes do Grupo</h1>
      </div>

      <div className="space-y-8">
        
        {/* Basic Info */}
        <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Dados Principais</h2>
            
            <div>
               <label className="text-xs text-slate-400 mb-1 block">Nome</label>
               <input
                 value={name}
                 onChange={(e) => setName(e.target.value)}
                 className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-lg text-slate-900 dark:text-white focus:border-purple-500 outline-none"
               />
            </div>

            <div>
               <label className="text-xs text-slate-400 mb-2 block">País / Moeda</label>
               <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                {availableCurrencies.map(c => (
                    <button 
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    className={`flex-shrink-0 p-3 rounded-xl border flex items-center space-x-3 transition-all ${currency === c.code ? 'bg-white dark:bg-slate-800 border-purple-500 shadow-sm ring-1 ring-purple-500/50' : 'bg-slate-50 dark:bg-slate-900 border-transparent opacity-60'}`}
                    >
                    <img src={`https://flagcdn.com/w40/${c.iso}.png`} className="w-8 h-auto rounded shadow-sm" alt={c.label}/>
                    <div className="text-left">
                        <p className={`text-sm font-bold ${currency === c.code ? '' : 'text-slate-600 dark:text-slate-400'}`}>{c.label}</p>
                        <p className="text-[10px] text-slate-400">{c.code}</p>
                    </div>
                    </button>
                ))}
            </div>
               <p className="text-[10px] text-slate-500 mt-2">Alterar a moeda muda apenas o símbolo e o método de pagamento sugerido. O valor numérico não é convertido.</p>
            </div>
            
             <div>
                <label className="text-xs text-slate-400 mb-2 block">Tipo de Grupo</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                      { id: 'trip', icon: Icons.Car },
                      { id: 'home', icon: Icons.Home },
                      { id: 'event', icon: Icons.Music },
                      { id: 'couple', icon: Icons.Users },
                      { id: 'other', icon: Icons.Zap },
                  ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setType(t.id as any)}
                        className={`p-3 rounded-xl border flex items-center justify-center transition-all ${type === t.id ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-500 text-purple-600 dark:text-purple-400 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'}`}
                      >
                          <t.icon className="w-5 h-5" />
                      </button>
                  ))}
               </div>
            </div>
        </div>

        {/* Members Management */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Membros ({members.length})</h2>
            
            <div className="space-y-2">
                {members.map(user => {
                    const isMe = user.id === currentUser.id;
                    return (
                        <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                             <div className="flex items-center space-x-3">
                                 <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                     {user.name.substring(0,2).toUpperCase()}
                                 </div>
                                 <span className="text-slate-900 dark:text-white font-medium">{user.name}</span>
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

            {/* Add New Member Section */}
            <div className="pt-2">
                <p className="text-xs text-slate-500 mb-2 font-bold">Adicionar Manualmente</p>
                <form onSubmit={handleAddMember} className="flex space-x-2">
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
            </div>

            {/* Invite Link */}
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Chamar a galera</h3>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Envie o link do grupo para entrarem.</p>
                </div>
                <button 
                    onClick={handleInviteWhatsApp}
                    className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
                >
                    <Icons.MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                </button>
            </div>
        </div>

        <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 bg-purple-600 rounded-xl font-bold text-white shadow-lg shadow-purple-500/30 hover:bg-purple-500 transition-all flex items-center justify-center space-x-2"
        >
            {isSaving ? <Icons.Repeat className="w-5 h-5 animate-spin" /> : <Icons.Save className="w-5 h-5" />}
            <span>Salvar Ajustes</span>
        </button>

      </div>
    </div>
  );
};

export default GroupSettings;