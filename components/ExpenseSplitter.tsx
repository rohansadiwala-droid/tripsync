import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Participant, Expense, Balance } from '../types';
import { getConversionRates } from '../services/geminiService';
import { Users, Plus, X, Trash2, ArrowRight, DollarSign, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNotification } from './NotificationProvider';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'CAD', 'INR'];
const CURRENCY_SYMBOLS = {
  'USD': '$',
  'EUR': '€',
  'JPY': '¥',
  'GBP': '£',
  'CAD': '$',
  'INR': '₹',
}

const ExpenseSplitter: React.FC = () => {
  // FIX: Explicitly type the useState hook with Participant[] and cast the parsed JSON from localStorage.
  // This ensures that `participants` is always treated as an array of Participant objects.
  const [participants, setParticipants] = useState<Participant[]>(() => {
    try {
      const saved = localStorage.getItem('tripSyncParticipants');
      return saved ? (JSON.parse(saved) as Participant[]) : [];
    } catch (error) {
      console.error("Failed to parse participants from localStorage", error);
      return [];
    }
  });
  // FIX: Explicitly type the useState hook with Expense[] and cast the parsed JSON from localStorage.
  // This resolves errors where properties on expense objects were inferred as `unknown`.
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem('tripSyncExpenses');
      return saved ? (JSON.parse(saved) as Expense[]) : [];
    } catch (error) {
      console.error("Failed to parse expenses from localStorage", error);
      return [];
    }
  });
  
  const [newParticipantName, setNewParticipantName] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [settlementView, setSettlementView] = useState<'simplified' | 'detailed'>('simplified');
  const [baseCurrency, setBaseCurrency] = useState<string>('USD');

  const [conversionRates, setConversionRates] = useState<Record<string, number> | null>({'USD': 1});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [settledTransactions, setSettledTransactions] = useState<string[]>([]);
  const { showNotification } = useNotification();

  useEffect(() => {
    try {
      localStorage.setItem('tripSyncParticipants', JSON.stringify(participants));
      localStorage.setItem('tripSyncExpenses', JSON.stringify(expenses));
    } catch (error) {
      console.error("Failed to save data to localStorage", error);
    }
  }, [participants, expenses]);
  
  useEffect(() => {
    const fetchRates = async () => {
      const currenciesInUse = [...new Set(expenses.map(ex => ex.currency))];
      const targetCurrencies = (currenciesInUse as string[]).filter(c => c !== baseCurrency && c in CURRENCY_SYMBOLS);

      if (targetCurrencies.length === 0) {
        setConversionRates({ [baseCurrency]: 1 });
        setRatesError(null);
        return;
      }
      
      setRatesLoading(true);
      setRatesError(null);
      try {
        const rates = await getConversionRates(baseCurrency, targetCurrencies);
        setConversionRates({ ...rates, [baseCurrency]: 1 });
      } catch (err) {
        console.error("Error fetching rates, using fallback:", err);
        setRatesError('AI service busy. Using approximate rates.');
        showNotification('AI service busy. Using approximate currency rates.', 'warning');
        
        // Fallback logic
        const fallbacks: Record<string, number> = {
            'EUR': 1.08, 'JPY': 0.0067, 'GBP': 1.27, 'CAD': 0.74, 'INR': 0.012, 'USD': 1.0
        };
        const fallbackRates: Record<string, number> = { [baseCurrency]: 1 };
        targetCurrencies.forEach(curr => {
            fallbackRates[curr] = fallbacks[curr] || 1.0;
        });
        setConversionRates(fallbackRates);
      } finally {
        setRatesLoading(false);
      }
    };
    
    fetchRates();
  }, [expenses, baseCurrency, showNotification]);

  const addParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (newParticipantName.trim()) {
      setParticipants([
        ...participants,
        { id: Date.now(), name: newParticipantName.trim() },
      ]);
      showNotification(`Added ${newParticipantName.trim()} to the trip`, 'success');
      setNewParticipantName('');
    }
  };

  const removeParticipant = (id: number) => {
    const participantToRemove = participants.find(p => p.id === id);
    const updatedExpenses = expenses.map(ex => ({
        ...ex,
        sharedByIds: ex.sharedByIds.filter(pId => pId !== id)
    })).filter(ex => ex.paidById !== id && ex.sharedByIds.length > 0);

    setExpenses(updatedExpenses);
    setParticipants(participants.filter((p) => p.id !== id));
    if (participantToRemove) {
      showNotification(`Removed ${participantToRemove.name}`, 'info');
    }
  };
  
  const addExpense = (expense: Omit<Expense, 'id'>) => {
    setExpenses([...expenses, { ...expense, id: Date.now() }]);
    showNotification(`Added expense: ${expense.description}`, 'success');
  };

  const removeExpense = (id: number) => {
    const expenseToRemove = expenses.find(ex => ex.id === id);
    setExpenses(expenses.filter(ex => ex.id !== id));
    if (expenseToRemove) {
      showNotification(`Removed expense: ${expenseToRemove.description}`, 'info');
    }
  };

  const balances = useMemo<Balance[]>(() => {
    if (participants.length === 0 || !conversionRates || ratesError) return [];

    const convertToBase = (amount: number, fromCurrency: string): number => {
      if (fromCurrency === baseCurrency) return amount;
      const rate = conversionRates[fromCurrency];
      if (typeof rate !== 'number') {
        console.warn(`Missing conversion rate for ${fromCurrency} to ${baseCurrency}`);
        return NaN; // Return NaN to signal an error in conversion
      }
      return amount * rate;
    };

    const balanceMap = new Map<number, number>(
      participants.map(p => [p.id, 0])
    );

    for (const expense of expenses) {
      const convertedAmount = convertToBase(expense.amount, expense.currency);
      if (isNaN(convertedAmount)) continue; // Skip expense if conversion failed

      const payerBalance = balanceMap.get(expense.paidById) ?? 0;
      balanceMap.set(expense.paidById, payerBalance + convertedAmount);

      const share = convertedAmount / expense.sharedByIds.length;
      expense.sharedByIds.forEach(participantId => {
        const participantBalance = balanceMap.get(participantId) ?? 0;
        balanceMap.set(participantId, participantBalance - share);
      });
    }

    return participants.map(p => ({
      participant: p,
      amount: balanceMap.get(p.id) ?? 0,
    })).sort((a, b) => b.amount - a.amount);

  }, [participants, expenses, baseCurrency, conversionRates, ratesError]);

  const simplifiedSettleTransactions = useMemo(() => {
    const creditors = balances
      .filter((b) => b.amount > 0.01)
      .map(b => ({...b})); 
    const debtors = balances
      .filter((b) => b.amount < -0.01)
      .map(b => ({...b, amount: Math.abs(b.amount)})); 

    const transactions: { from: string; to: string; amount: number }[] = [];
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amountToSettle = Math.min(debtor.amount, creditor.amount);

      if (amountToSettle > 0.01) {
          transactions.push({
            from: debtor.participant.name,
            to: creditor.participant.name,
            amount: amountToSettle,
          });
          debtor.amount -= amountToSettle;
          creditor.amount -= amountToSettle;
      }
      
      if (debtor.amount < 0.01) debtorIndex++;
      if (creditor.amount < 0.01) creditorIndex++;
    }
    return transactions;
  }, [balances]);
  
  const detailedSettleTransactions = useMemo(() => {
    const creditors = balances.filter(b => b.amount > 0.01);
    const debtors = balances.filter(b => b.amount < -0.01).map(b => ({ ...b, amount: Math.abs(b.amount) }));

    if (creditors.length === 0 || debtors.length === 0) return [];
    const transactions: { from: string; to: string; amount: number }[] = [];
    const totalCredit = creditors.reduce((sum, c) => sum + c.amount, 0);

    if (totalCredit < 0.01) return [];

    for (const debtor of debtors) {
      for (const creditor of creditors) {
        const proportion = creditor.amount / totalCredit;
        const paymentAmount = debtor.amount * proportion;
        if (paymentAmount > 0.01) {
          transactions.push({
            from: debtor.participant.name,
            to: creditor.participant.name,
            amount: paymentAmount,
          });
        }
      }
    }
    return transactions;
  }, [balances]);

  const transactionsToDisplay = settlementView === 'simplified' ? simplifiedSettleTransactions : detailedSettleTransactions;
  
  const handleSettleToggle = (key: string) => {
    setSettledTransactions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <div className="space-y-8">
      {isModalOpen && <AddExpenseModal participants={participants} onAddExpense={addExpense} onClose={() => setIsModalOpen(false)} />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold text-neutral mb-4 flex items-center gap-2"><Users className="text-primary"/> Participants</h3>
            <form onSubmit={addParticipant} className="flex gap-2 mb-4">
              <input type="text" value={newParticipantName} onChange={(e) => setNewParticipantName(e.target.value)} placeholder="Add new person" className="flex-grow w-full px-3 py-2 border-2 border-base-300 rounded-lg focus:ring-0 focus:border-primary focus:outline-none transition-colors duration-300" />
              <button type="submit" className="bg-primary text-white p-2 rounded-lg hover:bg-primary-focus disabled:opacity-50" disabled={!newParticipantName.trim()}>
                <Plus size={20} />
              </button>
            </form>
            <ul className="space-y-2">
              {participants.length > 0 ? participants.map(p => (
                <li key={p.id} className="flex justify-between items-center bg-base-200 p-2 rounded-md">
                  <span className="font-medium">{p.name}</span>
                  <button onClick={() => removeParticipant(p.id)} className="text-gray-400 hover:text-error">
                    <X size={16} />
                  </button>
                </li>
              )) : (
                <p className="text-sm text-center text-gray-500 py-2">No participants yet. Add someone to get started!</p>
              )}
            </ul>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md">
            <h3 className="text-xl font-bold text-neutral mb-4">Summary</h3>
            
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Summary Currency</label>
                <select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} className="w-full px-3 py-2 border border-base-300 rounded-lg bg-white focus:ring-2 focus:ring-primary">
                    {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            
            {ratesLoading && <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2"><Loader2 className="animate-spin" size={16}/> Fetching conversion rates...</div>}
            {ratesError && <div className="flex items-center gap-2 text-sm text-amber-600 p-2 bg-amber-50 rounded-lg border border-amber-200"><AlertTriangle size={16}/> AI service busy. Using approximate rates.</div>}
            
            <h4 className="font-semibold text-neutral mt-4 mb-2">Total Balances (in {baseCurrency})</h4>
            {participants.length > 0 && !ratesError ? (
              <ul className="space-y-2 mb-4">
                {balances.map(({ participant, amount }) => (
                  <li key={participant.id} className="flex justify-between items-center text-sm p-2 rounded-md even:bg-base-100">
                    <span className="font-medium">{participant.name}</span>
                    {Math.abs(amount) < 0.01 ? (
                      <span className="font-semibold text-gray-500">Is settled</span>
                    ) : (
                      <span className={`font-bold ${amount > 0 ? 'text-success' : 'text-error'}`}>
                        {amount > 0 ? `Gets back ` : `Owes `}
                        {CURRENCY_SYMBOLS[baseCurrency as keyof typeof CURRENCY_SYMBOLS]}{Math.abs(amount).toFixed(2)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              !ratesError && <p className="text-sm text-gray-500 text-center py-2 mb-4">Add participants to see balances.</p>
            )}
            
            <hr className="my-4 border-base-200" />
            
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-neutral">How to Settle Up</h4>
              <div className="flex items-center text-xs border border-base-300 rounded-lg p-0.5 bg-base-100">
                <button 
                  onClick={() => setSettlementView('simplified')} 
                  className={`px-2 py-1 rounded-md transition-colors ${settlementView === 'simplified' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-base-200'}`}
                >
                  Simplified
                </button>
                <button 
                  onClick={() => setSettlementView('detailed')} 
                  className={`px-2 py-1 rounded-md transition-colors ${settlementView === 'detailed' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-base-200'}`}
                >
                  Detailed
                </button>
              </div>
            </div>
            {transactionsToDisplay.length > 0 ? (
              <ul className="space-y-3">
                {transactionsToDisplay.map((t, index) => {
                  const key = `${t.from}-${t.to}-${t.amount.toFixed(2)}-${index}`;
                  const isSettled = settledTransactions.includes(key);
                  return (
                    <li key={key} className={`flex items-center justify-between p-3 rounded-lg transition-all ${isSettled ? 'bg-green-100' : 'bg-base-100'}`}>
                      <div className={`flex items-center gap-2 text-sm md:text-base ${isSettled ? 'text-gray-400 line-through' : ''}`}>
                        <span className="font-bold text-neutral">{t.from}</span>
                        <ArrowRight size={16} className="text-gray-400" />
                        <span className="font-bold text-neutral">{t.to}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-primary ${isSettled ? 'text-gray-400 line-through' : ''}`}>{CURRENCY_SYMBOLS[baseCurrency as keyof typeof CURRENCY_SYMBOLS]}{t.amount.toFixed(2)}</span>
                        <button onClick={() => handleSettleToggle(key)} className={`p-1 rounded-full transition-colors ${isSettled ? 'text-green-600 bg-green-200' : 'text-gray-400 hover:bg-gray-200'}`}>
                          <CheckCircle size={20} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-4 bg-base-100 rounded-lg">
                <p className="text-sm text-gray-500">
                  {participants.length > 1 && expenses.length > 0 && !ratesError
                    ? "✅ Everyone is settled up!" 
                    : "Add some expenses to see who owes whom."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-neutral">Expenses</h3>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-secondary text-white font-bold py-2 px-4 rounded-lg hover:bg-secondary-focus disabled:opacity-50" disabled={participants.length < 1}>
              <Plus size={20} /> Add Expense
            </button>
          </div>
          <div className="space-y-3">
            {expenses.length === 0 && <p className="text-center text-gray-500 py-8">No expenses yet. Add one to get started!</p>}
            {expenses.map(ex => {
              const payer = participants.find(p => p.id === ex.paidById);
              return (
                <div key={ex.id} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                  <div>
                    <p className="font-bold">{ex.description}</p>
                    <p className="text-sm text-gray-500">Paid by {payer ? payer.name : 'Unknown'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-lg text-neutral">{CURRENCY_SYMBOLS[ex.currency as keyof typeof CURRENCY_SYMBOLS]}{ex.amount.toFixed(2)} <span className="text-sm text-gray-500 font-medium">{ex.currency}</span></span>
                    <button onClick={() => removeExpense(ex.id)} className="text-gray-400 hover:text-error"><Trash2 size={18} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const AddExpenseModal: React.FC<{ participants: Participant[], onAddExpense: (expense: Omit<Expense, 'id'>) => void, onClose: () => void }> = ({ participants, onAddExpense, onClose }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [paidById, setPaidById] = useState<number | undefined>(participants[0]?.id);
    const [sharedByIds, setSharedByIds] = useState<number[]>(participants.map(p => p.id));
    
    const handleToggleSharedBy = (id: number) => {
        setSharedByIds(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        if (description && numericAmount > 0 && paidById && sharedByIds.length > 0) {
            onAddExpense({ description, amount: numericAmount, currency, paidById, sharedByIds });
            onClose();
        }
    };
    
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setAmount(value);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Add New Expense</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative">
                      <input 
                        type="text" 
                        id="description_modal"
                        value={description} 
                        onChange={e => setDescription(e.target.value)} 
                        placeholder=" " 
                        className="block w-full px-3 py-3 text-sm text-neutral bg-white rounded-lg border-2 border-base-300 appearance-none focus:outline-none focus:ring-0 focus:border-primary peer transition-colors duration-300" 
                        required 
                      />
                      <label 
                        htmlFor="description_modal" 
                        className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-1 left-3 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-4"
                      >
                        Description
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none z-10"><DollarSign size={16}/></span>
                            <input 
                                type="text" 
                                inputMode="decimal" 
                                id="amount_modal"
                                value={amount} 
                                onChange={handleAmountChange} 
                                placeholder=" " 
                                className="block w-full pl-8 pr-3 py-3 text-sm text-neutral bg-white rounded-lg border-2 border-base-300 appearance-none focus:outline-none focus:ring-0 focus:border-primary peer transition-colors duration-300" 
                                required 
                            />
                            <label 
                                htmlFor="amount_modal" 
                                className="absolute text-sm text-gray-500 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white px-1 left-8 peer-focus:text-primary peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-4"
                            >
                                Amount
                            </label>
                        </div>
                        <div>
                             <label htmlFor="currency_modal" className="sr-only">Currency</label>
                             <select id="currency_modal" value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-3 py-3 text-sm border-2 border-base-300 rounded-lg bg-white focus:border-primary focus:ring-0 focus:outline-none" required>
                                {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="paid_by_modal" className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
                        <select id="paid_by_modal" value={paidById} onChange={e => setPaidById(Number(e.target.value))} className="w-full px-3 py-2 border border-base-300 rounded-lg bg-white" required>
                            {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Shared by</label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {participants.map(p => (
                                <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${sharedByIds.includes(p.id) ? 'bg-sky-100 text-sky-800' : 'bg-gray-100'}`}>
                                    <input type="checkbox" checked={sharedByIds.includes(p.id)} onChange={() => handleToggleSharedBy(p.id)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                    {p.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary-focus">Add Expense</button>
                </form>
            </div>
        </div>
    );
};

export default ExpenseSplitter;
