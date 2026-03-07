import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Plus, 
  ArrowRight, 
  Calendar,
  CreditCard,
  ChevronRight,
  Info,
  Mic
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  parseISO, 
  isSameDay, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek,
  isAfter, 
  isBefore,
  addMonths,
  eachDayOfInterval
} from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Transaction, 
  AppSettings, 
  calculateAccumulatedBudget, 
  TOTAL_FIXED_MARCH, 
  TOTAL_FIXED_APRIL,
  getDailyBudget,
  AccountType,
  CATEGORIES,
  getPaymentDates,
  calculateDisponibleHoy,
  FIXED_EXPENSES_MARCH
} from './constants';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMayModal, setShowMayModal] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    account: 'Yape' as AccountType,
    to_account: 'Plin' as AccountType,
    category: CATEGORIES[0],
    type: 'expense' as 'expense' | 'income' | 'transfer'
  });

  const today = new Date();
  // For testing/demo purposes, we can override the date if needed, but we use the provided real time.
  // const today = new Date('2026-03-02T21:12:45'); 

  const salaryAlerts = useMemo(() => {
    const { quincena, finDeMes } = getPaymentDates(today);
    const alerts = [];

    // Difference in days (using start of day for comparison)
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const quincenaStart = new Date(quincena.getFullYear(), quincena.getMonth(), quincena.getDate());
    const finDeMesStart = new Date(finDeMes.getFullYear(), finDeMes.getMonth(), finDeMes.getDate());

    const diffQuincena = Math.ceil((quincenaStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
    const diffFinDeMes = Math.ceil((finDeMesStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffQuincena >= 0 && diffQuincena <= 3) {
      const msg = diffQuincena === 0 
        ? "💰 ¡Hoy es tu quincena! No olvides registrar el ingreso del 45% (S/ 675.00) y pagar el Celular a tu papá."
        : `⏳ ¡Tu quincena se acerca! Prepárate para el 45% (S/ 675.00) y recuerda pagar el Celular a tu papá (en ${diffQuincena} ${diffQuincena === 1 ? 'día' : 'días'}).`;
      alerts.push(msg);
    }

    if (diffFinDeMes >= 0 && diffFinDeMes <= 3) {
      const msg = diffFinDeMes === 0
        ? "💰 ¡Hoy es fin de mes! No olvides registrar el ingreso del 55% (S/ 825.00)."
        : `⏳ ¡Fin de mes se acerca! Prepárate para el 55% (S/ 825.00) (en ${diffFinDeMes} ${diffFinDeMes === 1 ? 'día' : 'días'}).`;
      alerts.push(msg);
    }

    return alerts;
  }, [today]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [transRes, settingsRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/settings')
      ]);
      const transData = await transRes.json();
      const settingsData = await settingsRes.json();
      
      setTransactions(transData);
      setSettings(settingsData);
      
      // Check for May 1st event
      if (today >= new Date('2026-05-01') && settingsData.contract_extended === 'false') {
        setShowMayModal(true);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    
    if (formData.type === 'transfer') {
      // Create two entries for a transfer
      // 1. Outgoing from source
      const outTrans: Transaction = {
        date: format(today, 'yyyy-MM-dd'),
        amount: -Math.abs(amount),
        description: `Transferencia a ${formData.to_account}`,
        account: formData.account,
        to_account: formData.to_account,
        type: 'transfer'
      };

      // 2. Incoming to destination
      const inTrans: Transaction = {
        date: format(today, 'yyyy-MM-dd'),
        amount: Math.abs(amount),
        description: `Transferencia desde ${formData.account}`,
        account: formData.to_account,
        type: 'transfer'
      };

      await Promise.all([
        fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(outTrans)
        }),
        fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inTrans)
        })
      ]);
    } else {
      const finalAmount = formData.type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
      
      const newTrans: Transaction = {
        date: format(today, 'yyyy-MM-dd'),
        amount: finalAmount,
        description: formData.description,
        account: formData.account,
        category: formData.category,
        type: formData.type as any
      };

      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrans)
      });
    }

    setShowAddModal(false);
    setFormData({ 
      amount: '', 
      description: '', 
      account: 'Yape', 
      to_account: 'Plin',
      category: CATEGORIES[0],
      type: 'expense' 
    });
    fetchData();
  };

  const handleAiClassification = async (e?: React.FormEvent, manualInput?: string) => {
    if (e) e.preventDefault();
    const input = manualInput || aiInput;
    if (!input.trim()) return;

    setIsAiProcessing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Extract financial transaction data from the following text: "${input}". 
        Return ONLY a JSON object with exactly these keys: 
        - amount (positive number)
        - description (string)
        - account ("Yape", "Plin", "Ahorro Casa", or "Ahorro Mío")
        - category (${CATEGORIES.join(", ")})
        - type ("expense" or "income")
        
        Current context: Today is ${format(today, 'yyyy-MM-dd')}.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              description: { type: Type.STRING },
              account: { type: Type.STRING, enum: ["Yape", "Plin", "Ahorro Casa", "Ahorro Mío"] },
              category: { type: Type.STRING, enum: CATEGORIES },
              type: { type: Type.STRING, enum: ["expense", "income"] },
            },
            required: ["amount", "description", "account", "category", "type"],
          },
        },
      });

      const result = JSON.parse(response.text || '{}');
      
      if (result.amount && result.description) {
        const finalAmount = result.type === 'expense' ? -Math.abs(result.amount) : Math.abs(result.amount);
        
        const newTrans: Transaction = {
          date: format(today, 'yyyy-MM-dd'),
          amount: finalAmount,
          description: result.description,
          account: result.account as any,
          category: result.category,
          type: result.type as any
        };

        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTrans)
        });

        setAiInput('');
        fetchData();
      }
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta el reconocimiento de voz.");
      return;
    }

    if (isRecording) {
      // Recognition usually stops automatically after result, but we can handle UI state
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiInput(transcript);
      handleAiClassification(undefined, transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleSaveCasa = async () => {
    if (!stats) return;
    const source = stats.yapeBalance >= 200 ? 'Yape' : 'Plin';
    
    const outTrans: Transaction = {
      date: format(today, 'yyyy-MM-dd'),
      amount: -200,
      description: '🏠 Ahorro Casa (Regla Fin de Mes)',
      account: source as AccountType,
      to_account: 'Ahorro Casa',
      type: 'transfer'
    };

    const inTrans: Transaction = {
      date: format(today, 'yyyy-MM-dd'),
      amount: 200,
      description: '🏠 Ahorro Casa (Regla Fin de Mes)',
      account: 'Ahorro Casa',
      type: 'transfer'
    };

    await Promise.all([
      fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(outTrans)
      }),
      fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inTrans)
      })
    ]);
    fetchData();
  };

  const handleMayChoice = async (choice: 'same' | 'adjust') => {
    if (choice === 'same') {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'contract_extended', value: 'true' })
      });
      setShowMayModal(false);
      fetchData();
    } else {
      // In a real app, this would open another form. For now, we just close.
      setShowMayModal(false);
    }
  };

  const stats = useMemo(() => {
    if (!settings) return null;
    
    const acc = calculateAccumulatedBudget(today, transactions, settings);
    const disponibleHoy = calculateDisponibleHoy(today, transactions);
    
    const getBalance = (account: AccountType, initial: string) => {
      return parseFloat(initial) + transactions
        .filter(t => t.account === account)
        .reduce((sum, t) => sum + t.amount, 0);
    };

    const yapeBalance = getBalance('Yape', settings.initial_yape);
    const plinBalance = getBalance('Plin', settings.initial_plin);
    const casaBalance = getBalance('Ahorro Casa', settings.initial_casa);
    const mioBalance = getBalance('Ahorro Mío', settings.initial_mio);

    // Debt logic: Repay 298.56 on March 15th
    const debtAmount = parseFloat(settings.debt);
    const march15Passed = today >= new Date('2026-03-15');
    const currentDebt = march15Passed ? 0 : debtAmount;

    const isAtRisk = disponibleHoy < 0;
    const recoveryDays = isAtRisk ? Math.ceil(Math.abs(disponibleHoy) / getDailyBudget(today)) : 0;

    const { quincena, finDeMes } = getPaymentDates(today);
    const isLastBusinessDay = isSameDay(today, finDeMes);
    const hasPaidCasa = transactions.some(t => t.type === 'transfer' && t.to_account === 'Ahorro Casa' && t.amount === 200 && parseISO(t.date) >= startOfMonth(today));

    // Fixed expenses logic
    const isPastQuincena = today > quincena;
    const pendingFixed = FIXED_EXPENSES_MARCH.filter(item => {
      if (item.name === 'Celular' && isPastQuincena) return false;
      return true;
    });
    const totalPendingFixed = pendingFixed.reduce((sum, item) => sum + item.amount, 0);

    // Weekly and Monthly Expenses
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const monthStart = startOfMonth(today);

    const weeklyExpenses = transactions
      .filter(t => {
        const tDate = parseISO(t.date);
        return tDate >= weekStart && tDate <= today && t.amount < 0 && t.type !== 'transfer';
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const monthlyExpenses = transactions
      .filter(t => {
        const tDate = parseISO(t.date);
        return tDate >= monthStart && tDate <= today && t.amount < 0 && t.type !== 'transfer';
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      ...acc,
      disponibleHoy,
      yapeBalance,
      plinBalance,
      casaBalance,
      mioBalance,
      totalBalance: yapeBalance + plinBalance + casaBalance + mioBalance,
      saldoReal: yapeBalance + plinBalance,
      currentDebt,
      isAtRisk,
      recoveryDays,
      isLastBusinessDay,
      hasPaidCasa,
      pendingFixed,
      totalPendingFixed,
      weeklyExpenses,
      monthlyExpenses
    };
  }, [transactions, settings, today]);

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-40">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Finanzas Nicolás</h1>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mt-1">
            {format(today, 'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-500 hover:bg-emerald-400 text-black p-2 rounded-full transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
        >
          <Plus size={24} />
        </button>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-8 pb-24">
        {/* End of Month Saving Rule */}
        <AnimatePresence>
          {stats?.isLastBusinessDay && !stats?.hasPaidCasa && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-emerald-500 p-6 rounded-[2rem] text-black shadow-xl shadow-emerald-500/20"
            >
              <div className="flex gap-4 items-start">
                <div className="bg-black/10 p-3 rounded-2xl">
                  <TrendingUp size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">🏠 Regla de Fin de Mes</h3>
                  <p className="text-sm font-medium opacity-80 mt-1">Aún no has enviado los S/ 200 a Ahorro Casa.</p>
                  <button 
                    onClick={handleSaveCasa}
                    className="mt-4 w-full bg-black text-white font-bold py-3 rounded-xl active:scale-95 transition-all"
                  >
                    Transferir S/ 200 Ahora
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Smart Alerts */}
        <AnimatePresence>
          {salaryAlerts.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Alertas Inteligentes</p>
              {salaryAlerts.map((alert, idx) => (
                <div key={idx} className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex gap-3 items-center">
                  <div className="bg-emerald-500 p-1.5 rounded-lg shrink-0">
                    <Info size={14} className="text-black" />
                  </div>
                  <p className="text-sm text-emerald-200 font-medium leading-tight">
                    {alert}
                  </p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Quick Add */}
        <section className="bg-zinc-900/50 border border-white/5 p-4 rounded-3xl">
          <form onSubmit={handleAiClassification} className="relative flex gap-2">
            <div className="relative flex-1">
              <input 
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder={isRecording ? "Escuchando..." : "Ej: 'Gasté 15 en almuerzo con Yape'..."}
                className={`w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-4 pr-12 text-sm focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-600 ${isRecording ? 'border-red-500/50 text-red-400' : ''}`}
                disabled={isAiProcessing}
              />
              <button 
                type="submit"
                disabled={isAiProcessing || !aiInput.trim()}
                className="absolute right-2 top-2 bottom-2 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAiProcessing ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full"
                  />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={toggleRecording}
              className={`p-4 rounded-2xl border transition-all ${isRecording ? 'bg-red-500/20 border-red-500/50 text-red-500 animate-pulse' : 'bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700'}`}
            >
              <Mic size={20} />
            </button>
          </form>
          <p className="text-[10px] text-zinc-500 mt-2 ml-1 flex items-center gap-1">
            <TrendingUp size={10} className="text-emerald-500" />
            IA: Clasificación inteligente de gastos e ingresos
          </p>
        </section>

        {/* Risk Alert */}
        <AnimatePresence>
          {stats?.isAtRisk && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex gap-4 items-start"
            >
              <div className="bg-red-500 p-2 rounded-xl">
                <AlertCircle size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-red-500 font-semibold">Alerta de Riesgo</h3>
                <p className="text-sm text-red-400/80 mt-1">
                  Has superado tu presupuesto acumulado por <span className="font-bold">S/ {Math.abs(stats.available).toFixed(2)}</span>.
                </p>
                <div className="mt-3 bg-red-500/20 p-3 rounded-xl border border-red-500/10">
                  <p className="text-xs font-bold uppercase tracking-wider text-red-400">Plan de Recuperación</p>
                  <p className="text-sm text-red-200 mt-1">
                    Debes pasar <span className="text-lg font-bold">{stats.recoveryDays} días</span> sin gastar nada para volver al equilibrio.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-zinc-900/50 border border-white/5 p-5 rounded-3xl col-span-2"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Saldo Real Total</p>
            <h2 className="text-3xl font-bold mt-2 text-blue-400">
              S/ {stats?.saldoReal.toFixed(2)}
            </h2>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-500">
              <div className="w-1 h-1 bg-blue-400 rounded-full" />
              <span>Yape + Plin (Dinero físico)</span>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-zinc-900/50 border border-white/5 p-5 rounded-3xl"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Límite Diario (Seguro gastar)</p>
            <h2 className={`text-3xl font-bold mt-2 ${stats?.disponibleHoy && stats.disponibleHoy < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              S/ {stats?.disponibleHoy.toFixed(2)}
            </h2>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-500">
              {stats?.disponibleHoy && stats.disponibleHoy < 0 ? (
                <span className="text-red-400 font-bold flex items-center gap-1">
                  <AlertCircle size={10} /> 🚩 Exceso de Gasto
                </span>
              ) : (
                <>
                  <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                  <span>Presupuesto hasta hoy</span>
                </>
              )}
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-zinc-900/50 border border-white/5 p-5 rounded-3xl"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Deuda Ahorro</p>
            <h2 className="text-3xl font-bold mt-2 text-orange-400">
              S/ {stats?.currentDebt.toFixed(2)}
            </h2>
            <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
              <CreditCard size={10} />
              {stats?.currentDebt === 0 ? 'Liquidada el 15/03' : 'Pendiente quincena Marzo'}
            </p>
          </motion.div>

          {/* New Expense Metrics */}
          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-zinc-900/50 border border-white/5 p-5 rounded-3xl"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Gasto esta Semana</p>
            <h2 className="text-2xl font-bold mt-2 text-zinc-100">
              S/ {stats?.weeklyExpenses.toFixed(2)}
            </h2>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-500">
              <TrendingDown size={10} className="text-red-400" />
              <span>Desde el lunes</span>
            </div>
          </motion.div>

          <motion.div 
            whileHover={{ y: -2 }}
            className="bg-zinc-900/50 border border-white/5 p-5 rounded-3xl"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Gasto este Mes</p>
            <h2 className="text-2xl font-bold mt-2 text-zinc-100">
              S/ {stats?.monthlyExpenses.toFixed(2)}
            </h2>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-zinc-500">
              <TrendingDown size={10} className="text-red-400" />
              <span>Total acumulado</span>
            </div>
          </motion.div>
        </div>

        {/* Fixed Expenses Panel */}
        <section className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar size={16} className="text-orange-400" />
              Fijos Pendientes (Marzo)
            </h3>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase">Faltan</p>
              <p className="text-sm font-bold text-orange-400">S/ {stats?.totalPendingFixed.toFixed(2)}</p>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {stats?.pendingFixed.map((item) => (
              <div key={item.name} className="bg-black/20 p-3 rounded-2xl flex justify-between items-center border border-white/5">
                <span className="text-[11px] text-zinc-400">{item.name}</span>
                <span className="text-xs font-bold">S/ {item.amount.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Accounts Card */}
        <section className="bg-zinc-900/50 border border-white/5 rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-white/5 flex justify-between items-center">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wallet size={16} className="text-emerald-500" />
              Saldos en Cuentas
            </h3>
            <span className="text-xs font-mono text-zinc-500">Total: S/ {stats?.totalBalance.toFixed(2)}</span>
          </div>
          <div className="divide-y divide-white/5">
            {[
              { name: 'Yape (BCP)', balance: stats?.yapeBalance, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { name: 'Plin (Interbank)', balance: stats?.plinBalance, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              { name: 'Ahorro Casa', balance: stats?.casaBalance, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { name: 'Ahorro Mío', balance: stats?.mioBalance, color: 'text-orange-400', bg: 'bg-orange-500/10' }
            ].map((acc) => (
              <div key={acc.name} className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${acc.bg} rounded-2xl flex items-center justify-center ${acc.color}`}>
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{acc.name}</p>
                  </div>
                </div>
                <p className="text-lg font-bold">S/ {acc.balance?.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Savings Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-500" />
              Mis Ahorros Actuales
            </h3>
            <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Saldos Reales</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900/50 p-3 rounded-2xl border border-white/5">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Ahorro Casa</p>
              <p className="text-sm font-bold text-emerald-400">S/ {stats?.casaBalance.toFixed(2)}</p>
            </div>
            <div className="bg-zinc-900/50 p-3 rounded-2xl border border-white/5">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Ahorro Mío</p>
              <p className="text-sm font-bold text-blue-400">S/ {stats?.mioBalance.toFixed(2)}</p>
            </div>
            <div className="bg-zinc-900/50 p-3 rounded-2xl border border-white/5">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Ahorro Total</p>
              <p className="text-sm font-bold text-zinc-100">S/ {((stats?.casaBalance || 0) + (stats?.mioBalance || 0)).toFixed(2)}</p>
            </div>
          </div>
        </section>

        {/* Recent Transactions */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar size={16} className="text-zinc-500" />
              Historial de Movimientos
            </h3>
            <span className="text-[10px] text-zinc-500 uppercase font-bold">{transactions.length} registros</span>
          </div>
          <div className="bg-zinc-900/30 border border-white/5 rounded-3xl overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-zinc-500 text-sm">No hay movimientos registrados</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {transactions.slice().reverse().map((t, i) => (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={t.id || i} 
                      className="p-4 flex justify-between items-center hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${
                          t.type === 'income' || t.type === 'payroll' ? 'bg-emerald-500/10 text-emerald-400' :
                          t.type === 'transfer' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {t.category ? t.category.split(' ')[0] : (t.type === 'transfer' ? '🔄' : '💰')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{t.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-zinc-500 font-medium uppercase">{format(parseISO(t.date), 'dd MMM')}</span>
                            <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                            <span className="text-[10px] text-zinc-500 font-medium uppercase">{t.account}</span>
                            {t.to_account && (
                              <>
                                <ArrowRight size={8} className="text-zinc-600" />
                                <span className="text-[10px] text-zinc-500 font-medium uppercase">{t.to_account}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${
                          t.type === 'income' || t.type === 'payroll' ? 'text-emerald-400' :
                          t.type === 'transfer' ? 'text-blue-400' : 'text-red-400'
                        }`}>
                          {t.type === 'income' || t.type === 'payroll' ? '+' : (t.type === 'transfer' ? '' : '-') }
                          S/ {Math.abs(t.amount).toFixed(2)}
                        </p>
                        <p className="text-[9px] text-zinc-600 uppercase tracking-tighter mt-0.5">{t.category || t.type}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 border border-white/10"
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8 sm:hidden" />
              <h2 className="text-2xl font-bold mb-6">Nuevo Registro</h2>
              
              <form onSubmit={handleAddTransaction} className="space-y-6">
                <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                  {[
                    { id: 'expense', label: 'Gasto', color: 'text-red-400' },
                    { id: 'income', label: 'Ganancia', color: 'text-blue-400' },
                    { id: 'transfer', label: 'Transferencia', color: 'text-emerald-400' }
                  ].map((t) => (
                    <button 
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({...formData, type: t.id as any})}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${formData.type === t.id ? `bg-zinc-800 ${t.color} shadow-xl` : 'text-zinc-500'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Monto (S/)</label>
                  <input 
                    autoFocus
                    type="number" 
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-2xl font-bold focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                {formData.type !== 'transfer' && (
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Categoría</label>
                    <div className="grid grid-cols-3 gap-2">
                      {CATEGORIES.map((cat) => (
                        <button 
                          key={cat}
                          type="button"
                          onClick={() => setFormData({...formData, category: cat})}
                          className={`p-2 rounded-xl border text-[10px] font-medium transition-all ${formData.category === cat ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-black/40 border-white/5 text-zinc-500'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Descripción</label>
                  <input 
                    type="text" 
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="¿En qué gastaste?"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">
                      {formData.type === 'transfer' ? 'Desde' : 'Cuenta'}
                    </label>
                    <select 
                      value={formData.account}
                      onChange={(e) => setFormData({...formData, account: e.target.value as AccountType})}
                      className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                    >
                      {['Yape', 'Plin', 'Ahorro Casa', 'Ahorro Mío'].map(acc => (
                        <option key={acc} value={acc}>{acc}</option>
                      ))}
                    </select>
                  </div>

                  {formData.type === 'transfer' && (
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Hacia</label>
                      <select 
                        value={formData.to_account}
                        onChange={(e) => setFormData({...formData, to_account: e.target.value as AccountType})}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                      >
                        {['Yape', 'Plin', 'Ahorro Casa', 'Ahorro Mío'].map(acc => (
                          <option key={acc} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                >
                  Guardar Movimiento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* May 1st Modal */}
      <AnimatePresence>
        {showMayModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-sm text-center space-y-6"
            >
              <div className="w-16 h-16 bg-orange-500/20 rounded-3xl flex items-center justify-center text-orange-400 mx-auto">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Hito de Continuidad</h2>
                <p className="text-sm text-zinc-400">
                  ⚠️ Nicolás, tu contrato actual termina este mes. ¿Deseas proyectar Junio con el mismo sueldo de S/ 1,500 o ingresar un nuevo monto?
                </p>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={() => handleMayChoice('same')}
                  className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 transition-colors"
                >
                  Mismo Sueldo (S/ 1,500)
                </button>
                <button 
                  onClick={() => handleMayChoice('adjust')}
                  className="w-full bg-zinc-800 text-white font-bold py-4 rounded-2xl hover:bg-zinc-700 transition-colors"
                >
                  Ajustar Monto
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
