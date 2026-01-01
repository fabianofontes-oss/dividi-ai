import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/ui/Icons';
import { formatCurrency } from '../core/calculations';
import { useStore } from '../store/StoreContext';
import { PAYMENT_RAILS } from '../core/paymentRails';
import { generateBrCode } from '../core/pix';
import { getQrPayload as getInternationalQrPayload } from '../core/qrPayloads';
import { UserPaymentHandle } from '../types';

// Tipos para controle interno
interface QuickPerson {
    id: string;
    name: string;
    isPayer: boolean;
    drank: boolean;
}

type WizardStep = 'amount' | 'people' | 'result';
type SplitType = 'restaurant' | 'generic';

const QuickSplit: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useStore();

    // --- STATE DO WIZARD ---
    const [currentStep, setCurrentStep] = useState<WizardStep>('amount');
    const [splitType, setSplitType] = useState<SplitType>('restaurant');

    // --- DADOS DA CONTA ---
    const [foodAmountStr, setFoodAmountStr] = useState('');
    const [drinkAmountStr, setDrinkAmountStr] = useState('');
    const [hasService, setHasService] = useState(false);

    // --- DADOS DAS PESSOAS ---
    const [totalPeopleCount, setTotalPeopleCount] = useState(2);
    const [drinkersCount, setDrinkersCount] = useState(2);
    const [everyoneDrank, setEveryoneDrank] = useState(true);

    // --- DADOS DETALHADOS ---
    const [peopleList, setPeopleList] = useState<QuickPerson[]>([]);

    // --- PAGAMENTO ---
    const [selectedHandle, setSelectedHandle] = useState<UserPaymentHandle | null>(null);
    const [manualKey, setManualKey] = useState('');

    const supportsContacts = 'contacts' in navigator && 'ContactsManager' in window;

    // Tenta selecionar o melhor método de pagamento inicial
    useEffect(() => {
        if (currentUser.paymentHandles && currentUser.paymentHandles.length > 0) {
            // Prioriza Pix se existir, senão o primeiro
            const pix = currentUser.paymentHandles.find(h => h.railId === 'br_pix');
            setSelectedHandle(pix || currentUser.paymentHandles[0]);
        }
    }, [currentUser]);

    // Se o usuário digitar algo manualmente, limpa o handle selecionado
    const handleManualKeyChange = (val: string) => {
        setManualKey(val);
        if (selectedHandle && selectedHandle.value !== val) {
            setSelectedHandle(null);
        }
    };

    // Cálculos em tempo real
    const isGeneric = splitType === 'generic';
    const rawFood = parseFloat(foodAmountStr) || 0;
    const rawDrink = isGeneric ? 0 : (parseFloat(drinkAmountStr) || 0);
    const hasServiceFinal = isGeneric ? false : hasService;
    const multiplier = hasServiceFinal ? 1.1 : 1.0;

    const finalFoodTotal = rawFood * multiplier;
    const finalDrinkTotal = rawDrink * multiplier;
    const grandTotal = finalFoodTotal + finalDrinkTotal;
    const totalRaw = rawFood + rawDrink;

    // Sync drinkers count
    useEffect(() => {
        if (everyoneDrank || isGeneric) {
            setDrinkersCount(totalPeopleCount);
        } else {
            if (drinkersCount > totalPeopleCount) setDrinkersCount(totalPeopleCount);
        }
    }, [totalPeopleCount, everyoneDrank, isGeneric, drinkersCount]);

    // --- ACTIONS ---

    const generatePeopleList = () => {
        const list: QuickPerson[] = [];
        const effectiveDrinkers = isGeneric ? totalPeopleCount : drinkersCount;

        for (let i = 0; i < effectiveDrinkers; i++) {
            list.push({
                id: Math.random().toString(),
                name: i === 0 ? 'Você' : `Pessoa ${i + 1}`,
                isPayer: i === 0,
                drank: true
            });
        }

        const nonDrinkersCount = totalPeopleCount - effectiveDrinkers;
        for (let i = 0; i < nonDrinkersCount; i++) {
            list.push({
                id: Math.random().toString(),
                name: `Pessoa ${effectiveDrinkers + i + 1}`,
                isPayer: false,
                drank: false
            });
        }
        setPeopleList(list);
    };

    const handleImportContact = async (personId: string) => {
        if (!supportsContacts) return;
        try {
            const props = ['name'];
            const opts = { multiple: false };
            // @ts-ignore
            const contacts = await navigator.contacts.select(props, opts);

            if (contacts && contacts.length > 0) {
                const contact = contacts[0];
                if (contact.name && contact.name.length > 0) {
                    setPeopleList(list => list.map(p => p.id === personId ? { ...p, name: contact.name[0] } : p));
                }
            }
        } catch (ex) {
            console.debug('Contact selection cancelled');
        }
    };

    const goToResult = () => {
        generatePeopleList();
        setCurrentStep('result');
    };

    const finalDrinkersCount = peopleList.filter(p => p.drank).length;
    const costPerPersonFood = peopleList.length > 0 ? finalFoodTotal / peopleList.length : 0;
    const costPerPersonDrink = finalDrinkersCount > 0 ? finalDrinkTotal / finalDrinkersCount : 0;

    const valueForDrinker = costPerPersonFood + costPerPersonDrink;
    const valueForNonDrinker = costPerPersonFood;

    // --- LOGICA DE QR CODE E CLIPBOARD ---

    const currentRailId = selectedHandle ? selectedHandle.railId : 'br_pix';
    const currentRail = PAYMENT_RAILS[currentRailId] || PAYMENT_RAILS['br_pix'];
    const currentKeyValue = selectedHandle ? selectedHandle.value : manualKey;

    const getQrPayload = () => {
        if (!currentKeyValue) return '';

        // PIX (Brazil) - use dedicated generator
        if (currentRail.id === 'br_pix') {
            return generateBrCode(currentKeyValue, currentUser?.name || 'User', 'Brasilia', 0, 'Racha Dividi');
        }

        // Other international rails
        if (currentRail.supportsQr) {
            return getInternationalQrPayload(
                currentRail.id,
                currentKeyValue,
                currentUser?.name || 'User',
                '',
                0,
                'Racha Dividi'
            );
        }

        // Fallback: just the key value
        return currentKeyValue;
    };

    const generateWhatsappText = () => {
        const payer = peopleList.find(p => p.isPayer)?.name || 'Alguém';
        let text = `*Racha da Conta* ${isGeneric ? '⚡' : '🍽️'}\n`;
        text += `Total: ${formatCurrency(grandTotal)}\n`;
        if (hasServiceFinal) text += `(Com 10% serviço)\n`;
        text += `----------------\n`;

        if (!isGeneric && rawDrink > 0 && (peopleList.length - finalDrinkersCount) > 0) {
            text += `🥗 *Quem não bebeu:* ${formatCurrency(valueForNonDrinker)}\n`;
            text += `🍷 *Quem bebeu:* ${formatCurrency(valueForDrinker)}\n\n`;
        } else {
            text += `Valor por pessoa: *${formatCurrency(valueForDrinker)}*\n\n`;
        }

        // Lista nominal
        if (peopleList.length < 15) {
            peopleList.forEach(p => {
                const val = (p.drank || isGeneric) ? valueForDrinker : valueForNonDrinker;
                text += `${p.name}: ${formatCurrency(val)}\n`;
            });
            text += `\n`;
        }

        if (currentKeyValue) {
            const label = currentRail.name || 'Pix';
            const copyPayload = currentRail.id === 'br_pix' ? getQrPayload() : currentKeyValue;

            text += `\n🔑 ${label} do ${payer}: ${currentKeyValue}`;
            if (currentRail.id === 'br_pix') {
                text += `\n\n(Copie o código abaixo para pagar no app do banco)\n${copyPayload}`;
            }
        } else {
            text += `\nChave de pagamento: (Cole aqui)`;
        }
        return text;
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generateWhatsappText());
        alert("Texto copiado!");
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-safe">

            {/* HEADER */}
            <div className="p-4 flex items-center justify-between sticky top-0 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur z-20">
                <button onClick={() => {
                    if (currentStep === 'result') setCurrentStep('people');
                    else if (currentStep === 'people') setCurrentStep('amount');
                    else navigate(-1);
                }} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                    <Icons.ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                </button>

                <div className="flex space-x-2">
                    {['amount', 'people', 'result'].map((s, i) => {
                        const stepIndex = ['amount', 'people', 'result'].indexOf(currentStep);
                        const isActive = stepIndex >= i;
                        return <div key={s} className={`w-2 h-2 rounded-full transition-colors ${isActive ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'}`} />
                    })}
                </div>

                <div className="w-8" />
            </div>

            <div className="flex-1 px-6 py-4 max-w-md mx-auto w-full flex flex-col">

                {/* STEP 1: VALORES */}
                {currentStep === 'amount' && (
                    <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quanto deu a conta?</h1>
                            <p className="text-slate-500 text-sm mt-1">Digite os valores.</p>
                        </div>

                        <div className="bg-slate-200 dark:bg-slate-800 p-1 rounded-xl flex mb-8">
                            <button
                                onClick={() => setSplitType('restaurant')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all ${splitType === 'restaurant' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <Icons.Utensils className="w-4 h-4" />
                                <span>Bar / Restaurante</span>
                            </button>
                            <button
                                onClick={() => { setSplitType('generic'); setDrinkAmountStr(''); setHasService(false); }}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all ${splitType === 'generic' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            >
                                <Icons.Zap className="w-4 h-4" />
                                <span>Simples (Uber)</span>
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {isGeneric ? 'Valor Total' : 'Gasto com Comida / Geral'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-bold">R$</span>
                                    <input
                                        type="number" inputMode="decimal"
                                        autoFocus
                                        value={foodAmountStr}
                                        onChange={e => setFoodAmountStr(e.target.value)}
                                        placeholder="0,00"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-5 pl-12 pr-4 text-3xl font-bold text-slate-900 dark:text-white outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all"
                                    />
                                </div>
                            </div>

                            {!isGeneric && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                            <span>Gasto com Bebida Alcoólica</span>
                                            {rawDrink > 0 && <span className="text-purple-500 flex items-center"><Icons.Wine className="w-3 h-3 mr-1" /> Separado</span>}
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-bold">R$</span>
                                            <input
                                                type="number" inputMode="decimal"
                                                value={drinkAmountStr}
                                                onChange={e => setDrinkAmountStr(e.target.value)}
                                                placeholder="0,00 (Opcional)"
                                                className={`w-full bg-white dark:bg-slate-900 border rounded-2xl py-5 pl-12 pr-4 text-3xl font-bold outline-none transition-all ${rawDrink > 0 ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-slate-200 dark:border-slate-800 text-slate-400'}`}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setHasService(!hasService)}
                                        className={`w-full py-4 rounded-xl flex items-center justify-center space-x-3 transition-all border ${hasService ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-md border flex items-center justify-center ${hasService ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                            {hasService && <Icons.Check className="w-4 h-4 text-white" />}
                                        </div>
                                        <span className="font-bold">Adicionar 10% (Serviço)</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex-1" />

                        <button
                            disabled={totalRaw <= 0}
                            onClick={() => setCurrentStep('people')}
                            className="w-full py-4 bg-purple-600 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:shadow-none mt-6 hover:scale-[1.02] transition-transform flex items-center justify-center"
                        >
                            Próximo <Icons.ChevronRight className="w-5 h-5 ml-1" />
                        </button>
                    </div>
                )}

                {/* STEP 2 */}
                {currentStep === 'people' && (
                    <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="text-center mb-10">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quem vai dividir?</h1>
                            <p className="text-slate-500 text-sm mt-1">Defina a quantidade de pessoas.</p>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Total de Pessoas</p>
                                <div className="flex items-center justify-between max-w-[200px] mx-auto">
                                    <button
                                        onClick={() => setTotalPeopleCount(Math.max(1, totalPeopleCount - 1))}
                                        className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        <Icons.Minus className="w-6 h-6" />
                                    </button>
                                    <span className="text-5xl font-bold text-slate-900 dark:text-white tabular-nums">{totalPeopleCount}</span>
                                    <button
                                        onClick={() => setTotalPeopleCount(totalPeopleCount + 1)}
                                        className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                    >
                                        <Icons.Plus className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {!isGeneric && rawDrink > 0 && (
                                <div className="animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">Todo mundo bebeu álcool?</span>
                                        <button
                                            onClick={() => setEveryoneDrank(!everyoneDrank)}
                                            className={`w-14 h-8 rounded-full p-1 transition-colors ${everyoneDrank ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                        >
                                            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${everyoneDrank ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    {!everyoneDrank && (
                                        <div className="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-3xl border border-purple-100 dark:border-purple-800/30">
                                            <p className="text-center text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-4 flex items-center justify-center">
                                                <Icons.Wine className="w-4 h-4 mr-1" /> Quantos beberam?
                                            </p>
                                            <div className="flex items-center justify-between max-w-[200px] mx-auto">
                                                <button
                                                    onClick={() => setDrinkersCount(Math.max(1, drinkersCount - 1))}
                                                    className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-purple-600 shadow-sm"
                                                >
                                                    <Icons.Minus className="w-6 h-6" />
                                                </button>
                                                <span className="text-4xl font-bold text-purple-700 dark:text-purple-300 tabular-nums">{drinkersCount}</span>
                                                <button
                                                    onClick={() => setDrinkersCount(Math.min(totalPeopleCount, drinkersCount + 1))}
                                                    className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-purple-600 shadow-sm"
                                                >
                                                    <Icons.Plus className="w-6 h-6" />
                                                </button>
                                            </div>
                                            <p className="text-center text-xs text-purple-400 mt-2">
                                                {totalPeopleCount - drinkersCount} pessoas pagam só comida
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex-1" />

                        <button
                            onClick={goToResult}
                            className="w-full py-4 bg-purple-600 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/30 mt-6 hover:scale-[1.02] transition-transform flex items-center justify-center"
                        >
                            Calcular <Icons.Check className="w-5 h-5 ml-2" />
                        </button>
                    </div>
                )}

                {currentStep === 'result' && (
                    <div className="flex-1 flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mb-4 shadow-sm">
                                <Icons.Check className="w-8 h-8" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Resultado do Racha</h1>
                        </div>

                        <div className="space-y-4">
                            {!isGeneric && rawDrink > 0 && (peopleList.length - finalDrinkersCount) > 0 ? (
                                <>
                                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-5 border border-purple-100 dark:border-purple-800/50 relative overflow-hidden">
                                        <div className="absolute -right-4 -top-4 opacity-10"><Icons.Wine className="w-24 h-24" /></div>
                                        <div className="relative z-10">
                                            <p className="text-purple-600 dark:text-purple-300 text-xs font-bold uppercase tracking-wider mb-1">
                                                Quem Bebeu ({finalDrinkersCount})
                                            </p>
                                            <div className="flex items-baseline space-x-1">
                                                <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{formatCurrency(valueForDrinker)}</span>
                                                <span className="text-sm text-slate-500">cada</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
                                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                                            Quem NÃO Bebeu ({peopleList.length - finalDrinkersCount})
                                        </p>
                                        <div className="flex items-baseline space-x-1">
                                            <span className="text-3xl font-bold text-slate-700 dark:text-slate-200 tracking-tighter">{formatCurrency(valueForNonDrinker)}</span>
                                            <span className="text-sm text-slate-400">cada</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Valor por Pessoa</p>
                                    <p className="text-5xl font-bold text-slate-900 dark:text-white tracking-tighter">{formatCurrency(valueForDrinker)}</p>
                                    {hasServiceFinal && <p className="text-xs text-slate-400 mt-2">(Com 10% incluso)</p>}
                                </div>
                            )}

                            {/* Resumo Total */}
                            <div className="flex justify-between px-4 text-sm text-slate-500">
                                <span>Total da Conta: {formatCurrency(grandTotal)}</span>
                                <span>{totalPeopleCount} pessoas</span>
                            </div>

                            {/* PAYMENT SECTION */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 mt-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                                        <Icons.QrCode className="w-4 h-4 mr-1" /> Receber via {currentRail.name}
                                    </label>
                                    {currentUser.paymentHandles && currentUser.paymentHandles.length > 1 && (
                                        <select
                                            className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 outline-none text-purple-600 font-bold"
                                            onChange={(e) => {
                                                const h = currentUser.paymentHandles.find(x => x.railId === e.target.value);
                                                if (h) {
                                                    setSelectedHandle(h);
                                                    setManualKey(h.value);
                                                }
                                            }}
                                            value={currentRailId}
                                        >
                                            {currentUser.paymentHandles.map(h => {
                                                const r = PAYMENT_RAILS[h.railId];
                                                return <option key={h.railId} value={h.railId}>{r.name}</option>
                                            })}
                                        </select>
                                    )}
                                </div>

                                <div className="flex space-x-2">
                                    <input
                                        value={selectedHandle ? selectedHandle.value : manualKey}
                                        onChange={(e) => handleManualKeyChange(e.target.value)}
                                        placeholder={currentRail.placeholder}
                                        className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>

                                {currentKeyValue && currentRail.supportsQr && (
                                    <div className="flex flex-col items-center justify-center pt-4">
                                        <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getQrPayload())}`}
                                                alt="QR Code"
                                                className="w-40 h-40 mix-blend-multiply"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2 text-center">
                                            {currentRail.id === 'br_pix' ?
                                                'QR Code oficial (Pix Copia e Cola).' :
                                                'Peça para escanearem este código.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Lista Editável */}
                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center">
                                <Icons.Users className="w-4 h-4 mr-2" /> Detalhes (Opcional)
                            </h3>
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                                {peopleList.map(person => (
                                    <div key={person.id} className="p-3 flex items-center justify-between">
                                        {supportsContacts && (
                                            <button
                                                onClick={() => handleImportContact(person.id)}
                                                className="mr-3 p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-purple-600 rounded-lg"
                                                title="Preencher da Agenda"
                                            >
                                                <Icons.BookUser className="w-4 h-4" />
                                            </button>
                                        )}
                                        <input
                                            value={person.name}
                                            onChange={(e) => setPeopleList(list => list.map(p => p.id === person.id ? { ...p, name: e.target.value } : p))}
                                            className="bg-transparent outline-none text-sm font-medium text-slate-900 dark:text-white w-full"
                                        />
                                        <div className="flex items-center space-x-2">
                                            {!isGeneric && rawDrink > 0 && (
                                                <button
                                                    onClick={() => setPeopleList(list => list.map(p => p.id === person.id ? { ...p, drank: !p.drank } : p))}
                                                    className={`p-1.5 rounded-lg ${person.drank ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-300'}`}
                                                >
                                                    <Icons.Wine className="w-4 h-4" />
                                                </button>
                                            )}
                                            <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-400 min-w-[60px] text-right">
                                                {formatCurrency(person.drank || isGeneric ? valueForDrinker : valueForNonDrinker)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1" />

                        <div className="flex flex-col space-y-3 mt-6">
                            <button
                                onClick={copyToClipboard}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-transform active:scale-95"
                            >
                                <Icons.Share2 className="w-5 h-5" />
                                <span>Copiar para WhatsApp</span>
                            </button>
                            <button
                                onClick={() => { setCurrentStep('amount'); }}
                                className="w-full py-3 text-slate-500 font-bold hover:text-slate-700"
                            >
                                Novo Cálculo
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default QuickSplit;