import { format, isAfter, isBefore, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

export type AccountType = 'Yape' | 'Plin' | 'Ahorro Casa' | 'Ahorro Mío';

export interface Transaction {
  id?: number;
  date: string;
  amount: number;
  description: string;
  account: AccountType;
  to_account?: AccountType;
  category?: string;
  type: 'expense' | 'income' | 'payroll' | 'transfer';
}

export interface AppSettings {
  salary: string;
  debt: string;
  initial_yape: string;
  initial_plin: string;
  initial_casa: string;
  initial_mio: string;
  contract_extended: string;
}

export const CATEGORIES = [
  '🍔 Comida',
  '🚌 Transporte',
  '🚕 Taxi',
  '💰 Marcianos',
  '🎁 Regalo',
  '🔄 Otros'
];

export const FIXED_EXPENSES_MARCH = [
  { name: 'Regalo Camila', amount: 35.0 },
  { name: 'Regalo Mami', amount: 39.5 },
  { name: 'Amigo Secreto', amount: 50.45 },
  { name: 'Bachiller', amount: 80.0 },
  { name: 'Regalo Ale', amount: 72.0 },
  { name: 'Fiesta Ale', amount: 150.0 },
  { name: 'Casa/Inglés', amount: 200.0 },
  { name: 'Celular', amount: 40.9 },
  { name: 'Otro', amount: 30.0 },
];

export const TOTAL_FIXED_MARCH = 697.85;
export const TOTAL_FIXED_APRIL = 240.90;

export function calculateDisponibleHoy(
  currentDate: Date,
  transactions: Transaction[]
) {
  const monthStart = startOfMonth(currentDate);
  const totalDays = endOfMonth(currentDate).getDate();
  const currentDay = currentDate.getDate();
  
  // Formula: (((1500 - Total de Fijos de Marzo) / Días totales del mes) * día actual) - Gastos totales del mes
  const fixedTotal = currentDate.getMonth() === 2 ? TOTAL_FIXED_MARCH : TOTAL_FIXED_APRIL;
  
  const monthExpenses = transactions
    .filter(t => {
      const tDate = parseISO(t.date);
      return tDate >= monthStart && tDate <= currentDate && t.amount < 0 && t.type !== 'transfer';
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const disponible = (((1500 - fixedTotal) / totalDays) * currentDay) - monthExpenses;
  
  return disponible;
}

export const DAILY_BUDGET_MARCH = 25.87;
export const DAILY_BUDGET_APRIL = 41.97;

export function getDailyBudget(date: Date): number {
  const month = date.getMonth(); // 0-indexed, March is 2, April is 3
  if (month === 2) return DAILY_BUDGET_MARCH;
  if (month >= 3) return DAILY_BUDGET_APRIL;
  return 0;
}

export function calculateAccumulatedBudget(
  currentDate: Date,
  transactions: Transaction[],
  settings: AppSettings
) {
  const monthStart = startOfMonth(currentDate);
  const daysPassed = eachDayOfInterval({ start: monthStart, end: currentDate }).length;
  
  let totalDailyBudget = 0;
  for (let i = 0; i < daysPassed; i++) {
    const d = new Date(monthStart);
    d.setDate(monthStart.getDate() + i);
    totalDailyBudget += getDailyBudget(d);
  }

  const monthTransactions = transactions.filter(t => {
    const tDate = parseISO(t.date);
    return tDate >= monthStart && tDate <= currentDate && t.type !== 'payroll';
  });

  const expenses = monthTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
  const extraIncome = monthTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const available = totalDailyBudget + extraIncome - expenses;
  
  return {
    available,
    expenses,
    extraIncome,
    totalDailyBudget
  };
}

export function getPaymentDates(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  // Quincena (Day 15)
  let quincena = new Date(year, month, 15);
  if (quincena.getDay() === 6) { // Saturday
    quincena.setDate(14);
  } else if (quincena.getDay() === 0) { // Sunday
    quincena.setDate(13);
  }

  // Fin de mes (Last day)
  let finDeMes = endOfMonth(date);
  if (finDeMes.getDay() === 6) { // Saturday
    finDeMes.setDate(finDeMes.getDate() - 1);
  } else if (finDeMes.getDay() === 0) { // Sunday
    finDeMes.setDate(finDeMes.getDate() - 2);
  }

  return { quincena, finDeMes };
}
