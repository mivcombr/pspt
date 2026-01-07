import React, { useState, useEffect, useMemo } from 'react';
import {
   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LabelList
} from 'recharts';

import { expenseService, Expense, ExpenseCategory } from '../services/expenseService';
import { withdrawalService, Withdrawal } from '../services/withdrawalService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

const renderCustomLabel = (props: any) => {
   const { x, y, value, stroke } = props;
   return (
      <text x={x} y={y} dy={-10} fill={stroke} fontSize={10} textAnchor="middle" fontWeight="bold">
         {typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : value}
      </text>
   );
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const formatDateForInput = (date: Date | null) => {
   if (!date) return '';
   const year = date.getFullYear();
   const month = String(date.getMonth() + 1).padStart(2, '0');
   const day = String(date.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
};

const Expenses: React.FC = () => {
   const { user } = useAuth();

   // State
   const [expenses, setExpenses] = useState<Expense[]>([]);
   const [categories, setCategories] = useState<ExpenseCategory[]>([]);
   const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
   const [chartYear, setChartYear] = useState(new Date().getFullYear().toString());

   // Date Selector States
   const [activeDateFilter, setActiveDateFilter] = useState('Este Mês');
   const [isCalendarOpen, setIsCalendarOpen] = useState(false);

   // Calendar Modal States
   const [viewDate, setViewDate] = useState(new Date());
   const [tempStartDate, setTempStartDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
   const [tempEndDate, setTempEndDate] = useState<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));

   // Modals
   const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
   const [isConfigOpen, setIsConfigOpen] = useState(false);
   const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
   const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
   const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   const [isSavingWithdrawal, setIsSavingWithdrawal] = useState(false);
   const [isSavingCategory, setIsSavingCategory] = useState(false);

   // Form State
   const [formData, setFormData] = useState({
      description: '',
      category_id: '',
      value: '',
      due_date: formatDateForInput(new Date()),
      paid_date: '',
      recurrence: 'Variável',
      status: 'Pendente' as 'Pago' | 'Pendente'
   });

   const [withdrawalForm, setWithdrawalForm] = useState({
      partner_name: '',
      date: formatDateForInput(new Date()),
      value: '',
      description: ''
   });

   const [categoryForm, setCategoryForm] = useState({
      name: '',
      type: 'Variável' as 'Fixa' | 'Variável'
   });

   const fetchData = async () => {
      setIsLoading(true);
      try {
         const hospitalId = user?.hospitalId || undefined;
         const filters = {
            startDate: formatDateForInput(tempStartDate),
            endDate: formatDateForInput(tempEndDate),
            hospitalId
         };

         const [expData, catData, withData] = await Promise.all([
            expenseService.getAll(filters),
            expenseService.getCategories(),
            withdrawalService.getAll(filters)
         ]);
         setExpenses(expData);
         setCategories(catData);
         setWithdrawals(withData);
      } catch (err) {
         console.error('Error fetching expenses info:', err);
      } finally {
         setIsLoading(false);
      }
   };


   useEffect(() => {
      fetchData();
   }, [tempStartDate, tempEndDate, user?.hospitalId]);

   // Derived Data
   const totalOperatingExpenses = expenses.reduce((acc, curr) => acc + Number(curr.value), 0);
   const totalWithdrawals = withdrawals.reduce((acc, curr) => acc + Number(curr.value), 0);
   const totalOutflow = totalOperatingExpenses + totalWithdrawals;
   const pendingCount = expenses.filter(e => e.status === 'Pendente').length;

   const currentChartData = useMemo(() => {
      return Array.from({ length: 12 }).map((_, i) => {
         const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

         const monthExpenses = expenses.filter(e => {
            const [y, m] = e.due_date.split('-').map(Number);
            return y.toString() === chartYear && (m - 1) === i;
         });

         const monthWithdrawals = withdrawals.filter(r => {
            const [y, m] = r.date.split('-').map(Number);
            return y.toString() === chartYear && (m - 1) === i;
         });

         return {
            name: months[i],
            operational: monthExpenses.reduce((acc, curr) => acc + Number(curr.value), 0),
            withdrawal: monthWithdrawals.reduce((acc, curr) => acc + Number(curr.value), 0)
         };
      });
   }, [expenses, withdrawals, chartYear]);

   // --- Calendar Logic ---
   const handleCalendarNav = (direction: number) => {
      const newDate = new Date(viewDate);
      newDate.setMonth(newDate.getMonth() + direction);
      setViewDate(newDate);
   };

   const handleDayClick = (day: number) => {
      const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

      if (!tempStartDate || (tempStartDate && tempEndDate)) {
         setTempStartDate(clickedDate);
         setTempEndDate(null);
      } else {
         if (clickedDate < tempStartDate) {
            setTempEndDate(tempStartDate);
            setTempStartDate(clickedDate);
         } else {
            setTempEndDate(clickedDate);
         }
      }
   };

   const isSelected = (day: number) => {
      if (!tempStartDate) return false;
      const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      if (current.getTime() === tempStartDate.getTime()) return true;
      if (tempEndDate && current.getTime() === tempEndDate.getTime()) return true;
      if (tempEndDate && current > tempStartDate && current < tempEndDate) return true;
      return false;
   };

   const isRangeStart = (day: number) => {
      if (!tempStartDate) return false;
      const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      return current.getTime() === tempStartDate.getTime();
   };

   const isRangeEnd = (day: number) => {
      if (!tempEndDate) return false;
      const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      return current.getTime() === tempEndDate.getTime();
   };

   const isRangeMiddle = (day: number) => {
      if (!tempStartDate || !tempEndDate) return false;
      const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      return current > tempStartDate && current < tempEndDate;
   };

   const formatRangeLabel = () => {
      if (!tempStartDate) return 'Selecione uma data';
      const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
      const start = tempStartDate.toLocaleDateString('pt-BR', options);
      if (tempEndDate) {
         const end = tempEndDate.toLocaleDateString('pt-BR', options);
         return `${start} - ${end}`;
      }
      return start;
   };

   const applyPreset = (preset: string) => {
      const today = new Date();
      let start = new Date();
      let end = new Date();

      switch (preset) {
         case 'Hoje':
            break;
         case 'Ontem':
            start.setDate(today.getDate() - 1);
            end.setDate(today.getDate() - 1);
            break;
         case 'Últimos 7 dias':
            start.setDate(today.getDate() - 6);
            break;
         case 'Últimos 30 dias':
            start.setDate(today.getDate() - 29);
            break;
         case 'Este mês':
         case 'Este Mês':
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
         case 'Mês passado':
         case 'Mês Passado':
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
         case 'Este ano':
         case 'Este Ano':
            start = new Date(today.getFullYear(), 0, 1);
            end = new Date(today.getFullYear(), 11, 31);
            break;
         case 'Hoje e ontem':
            start.setDate(today.getDate() - 1);
            break;
         case 'Últimos 14 dias':
            start.setDate(today.getDate() - 13);
            break;
         case 'Últimos 28 dias':
            start.setDate(today.getDate() - 27);
            break;
         case 'Esta semana':
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            end.setDate(diff + 6);
            break;
         case 'Semana passada':
            const prevWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
            const pDay = prevWeek.getDay();
            const pDiff = prevWeek.getDate() - pDay + (pDay === 0 ? -6 : 1);
            start = new Date(prevWeek.setDate(pDiff));
            end = new Date(prevWeek);
            end.setDate(start.getDate() + 6);
            break;
      }
      setTempStartDate(start);
      setTempEndDate(end);
      setViewDate(end);
      setActiveDateFilter(preset);
      setIsCalendarOpen(false);
   };

   // Actions
   const handleOpenNew = () => {
      setEditingExpense(null);
      setFormData({
         description: '',
         category_id: '',
         value: '',
         due_date: new Date().toISOString().split('T')[0],
         paid_date: '',
         recurrence: 'Variável',
         status: 'Pendente'
      });
      setIsExpenseModalOpen(true);
   };

   const handleOpenEdit = (expense: Expense) => {
      setEditingExpense(expense);
      setFormData({
         description: expense.description,
         category_id: expense.category_id,
         value: expense.value.toString().replace('.', ','),
         due_date: expense.due_date,
         paid_date: expense.paid_date || '',
         recurrence: expense.recurrence,
         status: expense.status
      });
      setIsExpenseModalOpen(true);
   };

   const handleOpenNewWithdrawal = () => {
      setWithdrawalForm({
         partner_name: '',
         date: formatDateForInput(new Date()),
         value: '',
         description: ''
      });
      setIsWithdrawalModalOpen(true);
   };

   const handleOpenNewCategory = () => {
      setEditingCategory(null);
      setCategoryForm({ name: '', type: 'Variável' });
   };

   const handleEditCategory = (category: ExpenseCategory) => {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, type: category.type });
   };

   const handleSaveExpense = async () => {
      if (!formData.description || !formData.category_id || !formData.value) {
         alert('Preencha os campos obrigatórios.');
         return;
      }

      setIsSaving(true);
      try {
         const hospitalId = user?.hospitalId || undefined;
         const numericValue = parseFloat(formData.value.replace(/\./g, '').replace(',', '.'));
         const payload = {
            description: formData.description,
            category_id: formData.category_id,
            value: numericValue,
            due_date: formData.due_date,
            paid_date: formData.status === 'Pago' ? (formData.paid_date || formatDateForInput(new Date())) : undefined,
            recurrence: formData.recurrence,
            status: formData.status,
            hospital_id: hospitalId
         };

         if (editingExpense) {
            await expenseService.update(editingExpense.id, payload);
         } else {
            await expenseService.create(payload);
         }
         fetchData();
         setIsExpenseModalOpen(false);
      } catch (err) {
         console.error('Error saving expense:', err);
      } finally {
         setIsSaving(false);
      }
   };

   const handleSaveWithdrawal = async () => {
      if (!withdrawalForm.partner_name || !withdrawalForm.value || !withdrawalForm.date) {
         alert('Preencha os campos obrigatórios.');
         return;
      }

      setIsSavingWithdrawal(true);
      try {
         const hospitalId = user?.hospitalId || undefined;
         const numericValue = parseFloat(withdrawalForm.value.replace(/\./g, '').replace(',', '.'));
         await withdrawalService.create({
            partner_name: withdrawalForm.partner_name,
            date: withdrawalForm.date,
            value: numericValue,
            description: withdrawalForm.description,
            hospital_id: hospitalId
         });
         fetchData();
         setIsWithdrawalModalOpen(false);
      } catch (err) {
         console.error('Error saving withdrawal:', err);
      } finally {
         setIsSavingWithdrawal(false);
      }
   };

   const handleSaveCategory = async () => {
      if (!categoryForm.name) {
         alert('Informe o nome da categoria.');
         return;
      }

      setIsSavingCategory(true);
      try {
         if (editingCategory) {
            await expenseService.updateCategory(editingCategory.id, {
               name: categoryForm.name,
               type: categoryForm.type
            });
         } else {
            await expenseService.createCategory({
               name: categoryForm.name,
               type: categoryForm.type
            });
         }
         const updatedCategories = await expenseService.getCategories();
         setCategories(updatedCategories);
         handleOpenNewCategory();
      } catch (err) {
         console.error('Error saving category:', err);
      } finally {
         setIsSavingCategory(false);
      }
   };

   const handleDeleteCategory = async (id: string, name: string) => {
      if (!window.confirm(`Tem certeza que deseja excluir a categoria "${name}"? Esta ação só será permitida se não houver despesas vinculadas a ela.`)) return;

      try {
         await expenseService.deleteCategory(id);
         const updatedCategories = await expenseService.getCategories();
         setCategories(updatedCategories);
         alert('Categoria excluída com sucesso!');
      } catch (err: any) {
         console.error('Error deleting category:', err);
         if (err.message?.includes('violates foreign key constraint')) {
            alert('Não é possível excluir esta categoria pois existem despesas vinculadas a ela. Realoque as despesas antes de excluir.');
         } else {
            alert('Erro ao excluir categoria.');
         }
      }
   };

   const handleDeleteExpense = async (id: string) => {
      if (!window.confirm('Excluir esta despesa?')) return;
      try {
         await expenseService.delete(id);
         fetchData();
      } catch (err) {
         console.error('Error deleting expense:', err);
      }
   };

   const handleDeleteWithdrawal = async (id: string) => {
      if (!window.confirm('Excluir este rateio/retirada?')) return;
      try {
         await withdrawalService.delete(id);
         fetchData();
      } catch (err) {
         console.error('Error deleting withdrawal:', err);
      }
   };

   const handleMarkAsPaid = async (expense: Expense) => {
      try {
         await expenseService.update(expense.id, {
            status: 'Pago',
            paid_date: formatDateForInput(new Date())
         });
         fetchData();
      } catch (err) {
         console.error('Error marking as paid:', err);
      }
   };

   // Input Handlers
   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
   };

   const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value.replace(/\D/g, '');
      value = (Number(value) / 100).toFixed(2) + '';
      value = value.replace('.', ',');
      value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      setFormData(prev => ({ ...prev, value: value }));
   };

   const handleWithdrawalValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value.replace(/\D/g, '');
      value = (Number(value) / 100).toFixed(2) + '';
      value = value.replace('.', ',');
      value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
      setWithdrawalForm(prev => ({ ...prev, value: value }));
   };

   return (
      <div className="max-w-[1600px] mx-auto space-y-6 pb-12 relative font-sans">
         {/* --- HEADER --- */}
         <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-4">
            <div>
               <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Saídas & Rateios</h1>
               <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Gestão de despesas operacionais e distribuição de lucros.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 flex-wrap xl:justify-end">
               <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {['Este Mês', 'Mês Passado', 'Este Ano'].map(preset => (
                     <button
                        key={preset}
                        onClick={() => applyPreset(preset)}
                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeDateFilter === preset
                           ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                           : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                     >
                        {preset}
                     </button>
                  ))}

                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                  <button
                     onClick={() => setIsCalendarOpen(true)}
                     className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${activeDateFilter === 'Personalizado'
                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                  >
                     <span className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                        {activeDateFilter === 'Personalizado' ? formatRangeLabel() : 'Personalizado'}
                     </span>
                  </button>
               </div>

               <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block"></div>

               <div className="flex items-center gap-3">
                  <button
                     onClick={() => { handleOpenNewCategory(); setIsConfigOpen(true); }}
                     className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-primary transition-all shadow-sm hover:shadow-md"
                     title="Configurar Categorias"
                  >
                     <span className="material-symbols-outlined text-[20px]">settings</span>
                  </button>

                  <button
                     onClick={handleOpenNewWithdrawal}
                     className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all active:scale-95 border border-purple-500"
                  >
                     <span className="material-symbols-outlined text-[18px]">add_circle</span>
                     Novo Rateio
                  </button>

                  <button
                     onClick={handleOpenNew}
                     className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-red-600/20 flex items-center gap-2 transition-all active:scale-95 border border-red-500"
                  >
                     <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                     Nova Despesa
                  </button>
               </div>
            </div>
         </div>

         {/* --- KPIs --- */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow flex items-center gap-4 h-28">
               <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-slate-800 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">trending_down</span>
               </div>
               <div className="flex-1">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Saída Total</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(totalOutflow)}</h3>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow flex items-center gap-4 h-28">
               <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-slate-800 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">receipt_long</span>
               </div>
               <div className="flex-1">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Operacionais</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(totalOperatingExpenses)}</h3>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow flex items-center gap-4 h-28">
               <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-slate-800 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">pie_chart</span>
               </div>
               <div className="flex-1">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Rateios</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{formatCurrency(totalWithdrawals)}</h3>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow flex items-center gap-4 h-28">
               <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-slate-800 flex items-center justify-center text-amber-500">
                  <span className="material-symbols-outlined text-[24px]">schedule</span>
               </div>
               <div className="flex-1">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pagamentos Pendentes</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{pendingCount}</h3>
               </div>
            </div>
         </div>

         {/* --- ANNUAL EVOLUTION CHART --- */}
         <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow p-8">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-xl font-bold text-slate-900 dark:text-white">Evolução Anual de Despesas</h3>
               <div className="flex items-center gap-4">
                  <div className="relative">
                     <select
                        value={chartYear}
                        onChange={(e) => setChartYear(e.target.value)}
                        className="appearance-none bg-slate-50 dark:bg-slate-800 border-none text-slate-700 dark:text-white py-2 pl-4 pr-10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary cursor-pointer"
                     >
                        {[...Array(5)].map((_, i) => (
                           <option key={i} value={(new Date().getFullYear() - 2 + i).toString()}>
                              {(new Date().getFullYear() - 2 + i)}
                           </option>
                        ))}
                     </select>
                     <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
                  </div>
               </div>
            </div>

            <div className="h-[350px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={currentChartData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} dy={15} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} tickFormatter={(value) => value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} />
                     <RechartsTooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px 16px' }} />
                     <Line type="monotone" dataKey="operational" stroke="#ef4444" strokeWidth={4} dot={false} activeDot={{ r: 8, fill: '#ef4444' }} name="Despesas">
                        <LabelList content={renderCustomLabel} />
                     </Line>
                     <Line type="monotone" dataKey="withdrawal" stroke="#a855f7" strokeWidth={4} dot={false} activeDot={{ r: 8, fill: '#a855f7' }} name="Rateio">
                        <LabelList content={renderCustomLabel} />
                     </Line>
                  </LineChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* --- TABLE & SIDEBAR --- */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow overflow-hidden">
               <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Despesas Operacionais</h3>
               </div>
               <div className="overflow-x-auto p-2">
                  <table className="w-full text-left text-sm border-collapse">
                     <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                        <tr>
                           <th className="px-6 py-3 rounded-l-xl">Descrição</th>
                           <th className="px-6 py-3">Vencimento</th>
                           <th className="px-6 py-3">Categoria</th>
                           <th className="px-6 py-3 text-right">Valor</th>
                           <th className="px-6 py-3 text-center">Status</th>
                           <th className="px-6 py-3 text-right rounded-r-xl">Ações</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {expenses.length > 0 ? (
                           expenses.map((expense) => (
                              <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                 <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{expense.description}</td>
                                 <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatDate(expense.due_date)}</td>
                                 <td className="px-6 py-4">
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 uppercase">
                                       {expense.category?.name || 'S/ Cat'}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 font-black text-slate-900 dark:text-white text-right">{formatCurrency(expense.value)}</td>
                                 <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${expense.status === 'Pago' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                       {expense.status}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                       {expense.status === 'Pendente' && (
                                          <button onClick={() => handleMarkAsPaid(expense)} className="text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 p-1.5 rounded-lg"><span className="material-symbols-outlined text-[18px]">check_circle</span></button>
                                       )}
                                       <button onClick={() => handleOpenEdit(expense)} className="text-slate-400 hover:text-primary p-1.5 rounded-lg"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                                       <button onClick={() => handleDeleteExpense(expense.id)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                    </div>
                                 </td>
                              </tr>
                           ))
                        ) : (
                           <tr><td colSpan={6} className="py-20 text-center text-slate-400 dark:text-slate-500 font-medium">Nenhuma despesa encontrada.</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm card-shadow overflow-hidden flex flex-col">
               <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rateios & Retiradas</h3>
                  <button
                     onClick={handleOpenNewWithdrawal}
                     className="px-3 py-2 rounded-xl text-xs font-bold bg-white/80 dark:bg-slate-900 text-purple-600 hover:bg-white transition-colors flex items-center gap-1"
                  >
                     <span className="material-symbols-outlined text-[16px]">add</span>
                     Adicionar
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {withdrawals.length > 0 ? (
                     withdrawals.map((item) => (
                        <div key={item.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-all group">
                           <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{item.partner_name}</span>
                              <div className="flex items-center gap-2">
                                 <span className="font-black text-purple-600 dark:text-purple-400 text-sm">{formatCurrency(item.value)}</span>
                                 <button
                                    onClick={() => handleDeleteWithdrawal(item.id)}
                                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Excluir Rateio"
                                 >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                 </button>
                              </div>
                           </div>
                           <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider">{formatDate(item.date)} • {item.description}</p>
                        </div>
                     ))
                  ) : (
                     <div className="py-10 text-center text-slate-400 text-sm">Nenhum rateio encontrado.</div>
                  )}
               </div>
               <div className="p-5 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-center">
                     <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Total Distribuído</span>
                     <span className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(totalWithdrawals)}</span>
                  </div>
               </div>
            </div>
         </div>

         {/* --- CUSTOM CALENDAR MODAL --- */}
         {isCalendarOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
               <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex border border-slate-200 dark:border-slate-700 h-[600px]">

                  {/* Left Sidebar: Presets */}
                  <div className="w-64 bg-slate-50/80 dark:bg-slate-800/30 border-r border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-2 overflow-y-auto">
                     {['Hoje', 'Ontem', 'Últimos 7 dias', 'Últimos 30 dias', 'Este Mês', 'Mês Passado', 'Este Ano'].map(preset => (
                        <button
                           key={preset}
                           onClick={() => applyPreset(preset)}
                           className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeDateFilter === preset ? 'bg-primary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'}`}
                        >
                           {preset}
                        </button>
                     ))}
                  </div>

                  {/* Right Side: Calendar & Actions */}
                  <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
                     <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <button onClick={() => handleCalendarNav(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500"><span className="material-symbols-outlined">chevron_left</span></button>
                           <span className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wide">
                              {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                           </span>
                           <button onClick={() => handleCalendarNav(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500"><span className="material-symbols-outlined">chevron_right</span></button>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Intervalo Selecionado</p>
                           <p className="text-sm font-bold text-primary dark:text-primary-hover">{formatRangeLabel()}</p>
                        </div>
                        <button onClick={() => setIsCalendarOpen(false)} className="text-slate-400 hover:text-slate-600 ml-4"><span className="material-symbols-outlined">close</span></button>
                     </div>

                     <div className="flex-1 p-8 overflow-y-auto">
                        <div className="grid grid-cols-7 mb-4">
                           {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((d, i) => (
                              <div key={i} className={`text-center text-xs font-bold uppercase tracking-widest ${i === 0 || i === 6 ? 'text-primary opacity-60' : 'text-slate-400'}`}>{d}</div>
                           ))}
                        </div>
                        <div className="grid grid-cols-7 gap-y-2">
                           {Array.from({ length: getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                              <div key={`empty-${i}`} />
                           ))}
                           {Array.from({ length: getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                              const day = i + 1;
                              const isStart = isRangeStart(day);
                              const isEnd = isRangeEnd(day);
                              const isMiddle = isRangeMiddle(day);
                              const selected = isSelected(day);

                              return (
                                 <div key={day} className="relative h-10 flex items-center justify-center">
                                    {(isMiddle || (isStart && tempEndDate) || (isEnd && tempStartDate)) && (
                                       <div className={`absolute inset-y-1 bg-red-50 dark:bg-primary/10 ${isStart ? 'left-1/2 right-0 rounded-l-md' : isEnd ? 'left-0 right-1/2 rounded-r-md' : 'inset-x-0'}`}></div>
                                    )}
                                    <button
                                       onClick={() => handleDayClick(day)}
                                       className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${selected && !isMiddle ? 'bg-primary text-white shadow-lg scale-105' : !selected && !isMiddle ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-primary dark:text-primary-hover'}`}
                                    >
                                       {day}
                                    </button>
                                 </div>
                              );
                           })}
                        </div>
                     </div>

                     <div className="px-8 py-5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
                        <button onClick={() => setIsCalendarOpen(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-colors uppercase">Cancelar</button>
                        <button onClick={() => { setActiveDateFilter('Personalizado'); setIsCalendarOpen(false); }} className="px-8 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white shadow-lg shadow-green-600/20 ml-3 uppercase">Aplicar</button>
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* EXPENSE MODAL */}
         {isExpenseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-6 border-b border-red-100 dark:border-red-900/20 bg-red-50 dark:bg-red-900/20 flex justify-between items-center">
                     <div>
                        <h3 className="text-xl font-black text-red-700 dark:text-red-400">{editingExpense ? 'Editar Despesa' : 'Nova Despesa'}</h3>
                        <p className="text-xs text-red-600/70 dark:text-red-400/70 font-bold mt-0.5">Preencha os dados da saída financeira.</p>
                     </div>
                     <button onClick={() => setIsExpenseModalOpen(false)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-100/50 rounded-xl transition-colors"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="p-8 space-y-5 overflow-y-auto max-h-[70vh]">
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Descrição / Fornecedor</label>
                        <input type="text" name="description" value={formData.description} onChange={handleInputChange} className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-red-500 transition-all" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Categoria</label>
                           <select name="category_id" value={formData.category_id} onChange={handleInputChange} className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-red-500 appearance-none">
                              <option value="">Selecione</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Valor (R$)</label>
                           <input type="text" name="value" value={formData.value} onChange={handleValueChange} className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-red-500" placeholder="0,00" />
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Vencimento</label>
                           <input type="date" name="due_date" value={formData.due_date} onChange={handleInputChange} className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-red-500" />
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Data Pagamento (Opç)</label>
                           <input type="date" name="paid_date" value={formData.paid_date} onChange={handleInputChange} className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-red-500" />
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Status</label>
                        <div className="flex gap-2">
                           {['Pendente', 'Pago'].map(status => (
                              <button
                                 key={status}
                                 onClick={() => setFormData(prev => ({ ...prev, status: status as 'Pago' | 'Pendente' }))}
                                 className={`flex-1 h-12 rounded-xl text-xs font-bold transition-all border ${formData.status === status ? (status === 'Pago' ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-500/20' : 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20') : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100'}`}
                              >
                                 {status}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                     <button onClick={() => setIsExpenseModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase text-xs">Cancelar</button>
                     <button onClick={handleSaveExpense} disabled={isSaving} className="px-8 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/30 transition-all flex items-center gap-2 uppercase text-xs active:scale-95 disabled:opacity-50">
                        {isSaving ? 'Salvando...' : (<><span className="material-symbols-outlined text-[18px]">save</span> Salvar Despesa</>)}
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* CONFIG CATEGORIES MODAL (Simplified) */}
         {isConfigOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                     <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-slate-400">tune</span> Categorias</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Crie e edite categorias de despesas.</p>
                     </div>
                     <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-slate-600 p-2"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                           type="text"
                           value={categoryForm.name}
                           onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                           className="sm:col-span-2 h-11 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-primary"
                           placeholder="Nome da categoria"
                        />
                        <select
                           value={categoryForm.type}
                           onChange={(e) => setCategoryForm(prev => ({ ...prev, type: e.target.value as 'Fixa' | 'Variável' }))}
                           className="h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-primary"
                        >
                           <option value="Fixa">Fixa</option>
                           <option value="Variável">Variável</option>
                        </select>
                     </div>
                     <div className="flex items-center justify-between mt-4">
                        <button
                           onClick={handleOpenNewCategory}
                           className="text-xs font-bold text-slate-500 hover:text-slate-700"
                        >
                           {editingCategory ? 'Cancelar edição' : 'Limpar'}
                        </button>
                        <button
                           onClick={handleSaveCategory}
                           disabled={isSavingCategory}
                           className="px-5 py-2.5 rounded-xl text-xs font-bold bg-green-600 text-white shadow-lg shadow-green-600/20 disabled:opacity-50"
                        >
                           {isSavingCategory ? 'Salvando...' : editingCategory ? 'Salvar edição' : 'Adicionar categoria'}
                        </button>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-white dark:bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                           <tr className="px-6 py-4">
                              <th className="px-6 py-4">Nome</th>
                              <th className="px-6 py-4">Tipo</th>
                              <th className="px-6 py-4 text-right">Ação</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                           {categories.map(cat => (
                              <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 px-6 py-3">
                                 <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{cat.name}</td>
                                 <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${cat.type === 'Fixa' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{cat.type}</span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                       <button onClick={() => handleEditCategory(cat)} className="text-slate-400 hover:text-primary p-1.5 rounded-lg transition-colors"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                                       <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            </div>
         )}

         {/* WITHDRAWAL MODAL */}
         {isWithdrawalModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-6 border-b border-purple-100 dark:border-purple-900/20 bg-purple-50 dark:bg-purple-900/20 flex justify-between items-center">
                     <div>
                        <h3 className="text-xl font-black text-purple-700 dark:text-purple-300">Novo Rateio</h3>
                        <p className="text-xs text-purple-600/70 dark:text-purple-300/70 font-bold mt-0.5">Registre a distribuição para parceiros.</p>
                     </div>
                     <button onClick={() => setIsWithdrawalModalOpen(false)} className="text-purple-400 hover:text-purple-600 p-2 hover:bg-purple-100/50 rounded-xl transition-colors"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  <div className="p-8 space-y-5 overflow-y-auto max-h-[70vh]">
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Parceiro</label>
                        <input
                           type="text"
                           value={withdrawalForm.partner_name}
                           onChange={(e) => setWithdrawalForm(prev => ({ ...prev, partner_name: e.target.value }))}
                           className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-purple-500 transition-all"
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Data</label>
                           <input
                              type="date"
                              value={withdrawalForm.date}
                              onChange={(e) => setWithdrawalForm(prev => ({ ...prev, date: e.target.value }))}
                              className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-purple-500"
                           />
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Valor (R$)</label>
                           <input
                              type="text"
                              value={withdrawalForm.value}
                              onChange={handleWithdrawalValueChange}
                              className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-purple-500"
                              placeholder="0,00"
                           />
                        </div>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Descrição (opcional)</label>
                        <input
                           type="text"
                           value={withdrawalForm.description}
                           onChange={(e) => setWithdrawalForm(prev => ({ ...prev, description: e.target.value }))}
                           className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm font-bold focus:ring-2 focus:ring-purple-500"
                        />
                     </div>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                     <button onClick={() => setIsWithdrawalModalOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase text-xs">Cancelar</button>
                     <button onClick={handleSaveWithdrawal} disabled={isSavingWithdrawal} className="px-8 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/30 transition-all flex items-center gap-2 uppercase text-xs active:scale-95 disabled:opacity-50">
                        {isSavingWithdrawal ? 'Salvando...' : (<><span className="material-symbols-outlined text-[18px]">save</span> Salvar Rateio</>)}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default Expenses;
