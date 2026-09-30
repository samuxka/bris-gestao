import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { ArrowRight, ArrowLeft, Trash2, CheckCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { format, isSameMonth, addDays, addMonths, addYears, startOfMonth, endOfMonth } from 'date-fns';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { uploadToCloudinary } from '../services/cloudinary';

const formatCurrency = (val: number) => `€ ${val.toFixed(2).replace('.', ',')}`;

const StatCard = ({ title, value, className = '' }: { title: string, value: string, className?: string }) => (
  <div className={`card caixa-stat-card ${className}`}>
    <h3 className="card-title">{title}</h3>
    <div className="stat-value">{value}</div>
  </div>
);

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];

const EXPENSE_CATEGORIES = ['Material', 'Equipamento', 'Salário', 'Impostos', 'Marketing', 'Retirada Pessoal', 'Ajuste de Caixa', 'Outros'];
const INCOME_CATEGORIES = ['Venda', 'Investimento', 'Ajuste de Caixa', 'Outros'];

export default function Caixa() {
  const { user } = useAuth();
  const { showAlert, showPrompt } = useAlert();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [bancoAtual, setBancoAtual] = useState(0);
  const [cofreAtual, setCofreAtual] = useState(0);
  const [entradasMes, setEntradasMes] = useState(0);
  const [despesasMes, setDespesasMes] = useState(0);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  
  const [expenseLimit, setExpenseLimit] = useState(2000);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [bills, setBills] = useState<any[]>([]);
  
  // Bills State
  const [showAddBillModal, setShowAddBillModal] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDate, setBillDueDate] = useState('');
  const [billRecurring, setBillRecurring] = useState(false);
  const [billFrequency, setBillFrequency] = useState('mensal');
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  // Pay Bill State
  const [showPayBillModal, setShowPayBillModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [payMethod, setPayMethod] = useState<'dinheiro' | 'transferencia'>('transferencia');
  const [payReceipt, setPayReceipt] = useState<File | null>(null);
  const [isPayingBill, setIsPayingBill] = useState(false);

  const [addType, setAddType] = useState<'in' | 'out' | 'transfer'>('out');
  const [addAccount, setAddAccount] = useState<'banco' | 'cofre'>('banco');
  const [transferDirection, setTransferDirection] = useState<'banco_to_cofre' | 'cofre_to_banco'>('banco_to_cofre');
  const [addDesc, setAddDesc] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addCategory, setAddCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Caixinha State
  const [showCaixinhaModal, setShowCaixinhaModal] = useState(false);
  const [caixinhaName, setCaixinhaName] = useState('');
  const [caixinhaTarget, setCaixinhaTarget] = useState('');
  const [isSubmittingCaixinha, setIsSubmittingCaixinha] = useState(false);

  // DRE Filter State
  const [dreStartDate, setDreStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dreEndDate, setDreEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dreExpanded, setDreExpanded] = useState<Record<string, boolean>>({});

  const toggleDreRow = (rowKey: string) => {
    setDreExpanded(prev => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  useEffect(() => {
    const savedLimit = localStorage.getItem('expenseLimit');
    if (savedLimit) setExpenseLimit(Number(savedLimit));
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'cashflow'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setTransfers(docs);

      const now = new Date();
      let bAtual = 0;
      let cAtual = 0;
      let entradasAtual = 0;
      let despesasAtual = 0;

      docs.forEach((t: any) => {
        const val = Number(t.value) || 0;
        const acc = t.account || 'banco';
        const isIncome = t.type === 'in';
        const date = t.createdAt?.toDate?.() || new Date();
        
        if (t.type === 'transfer') {
          if (t.transferDirection === 'cofre_to_banco') {
            bAtual += val;
            cAtual -= val;
          } else if (t.transferDirection === 'banco_to_cofre') {
            bAtual -= val;
            cAtual += val;
          }
        } else {
          if (isIncome) {
            if (acc === 'banco') bAtual += val; else cAtual += val;
            if (isSameMonth(date, now)) entradasAtual += val;
          } else {
            if (acc === 'banco') bAtual -= val; else cAtual -= val;
            if (isSameMonth(date, now)) despesasAtual += val;
          }
        }
      });

      setBancoAtual(bAtual);
      setCofreAtual(cAtual);
      setEntradasMes(entradasAtual);
      setDespesasMes(despesasAtual);
      setLoading(false);
    });
    
    const qBills = query(collection(db, 'billsToPay'), where('userId', '==', user.uid));
    const unsubBills = onSnapshot(qBills, (snap) => {
      const b = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      b.sort((x: any, y: any) => (x.dueDate?.toDate?.()?.getTime() || 0) - (y.dueDate?.toDate?.()?.getTime() || 0));
      setBills(b);
    });

    return () => {
      unsub();
      unsubBills();
    };
  }, [user]);

  const handleSetLimit = () => {
    showPrompt('Defina o limite de gastos para o mês (€):', expenseLimit.toString(), (val) => {
      if (val && !isNaN(Number(val)) && Number(val) > 0) {
        setExpenseLimit(Number(val));
        localStorage.setItem('expenseLimit', val);
      }
    }, 'Limite de Gastos');
  };

  const filteredTransfers = transfers.filter(t => {
    const date = t.createdAt?.toDate?.() || new Date();
    const mStr = format(date, 'MM/yyyy');
    
    if (categoryFilter !== 'all' && (t.category || 'Outros') !== categoryFilter) return false;
    if (monthFilter !== 'all' && mStr !== monthFilter) return false;
    return true;
  });

  const months = Array.from(new Set(transfers.map(t => {
    const d = t.createdAt?.toDate?.() || new Date();
    return format(d, 'MM/yyyy');
  })));

  const pieDataMap: Record<string, number> = {};
  filteredTransfers.forEach(t => {
    if (t.type === 'out') {
      const cat = t.category || 'Outros';
      pieDataMap[cat] = (pieDataMap[cat] || 0) + Number(t.value);
    }
  });
  const pieData = Object.keys(pieDataMap).map(k => ({ name: k, value: pieDataMap[k] }));

  const thermoPercent = Math.min(100, (despesasMes / expenseLimit) * 100);

  const handleAddTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !addDesc.trim() || !addValue.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'cashflow'), {
        userId: user.uid,
        description: addDesc.trim(),
        type: addType,
        account: addType === 'transfer' ? null : addAccount,
        transferDirection: addType === 'transfer' ? transferDirection : null,
        category: addType === 'transfer' ? 'Transferência Interna' : addCategory,
        value: parseFloat(addValue.replace(',', '.')),
        receiptUrls: [],
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setAddDesc('');
      setAddValue('');
    } catch (err) {
      console.error(err);
      showAlert('Erro ao adicionar transferência', 'Erro', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCaixinha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !caixinhaName.trim() || !caixinhaTarget.trim()) return;

    setIsSubmittingCaixinha(true);
    try {
      await addDoc(collection(db, 'caixinhas'), {
        userId: user.uid,
        name: caixinhaName.trim(),
        target: parseFloat(caixinhaTarget.replace(',', '.')),
        current: 0,
        createdAt: serverTimestamp()
      });
      setShowCaixinhaModal(false);
      setCaixinhaName('');
      setCaixinhaTarget('');
    } catch (err) {
      console.error(err);
      showAlert('Erro ao criar caixinha', 'Erro', 'error');
    } finally {
      setIsSubmittingCaixinha(false);
    }
  };

  const handleAddBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !billName.trim() || !billAmount.trim() || !billDueDate.trim()) return;

    const val = parseFloat(billAmount.replace(',', '.'));
    if (isNaN(val) || val <= 0) return showAlert('Valor inválido', 'Erro', 'error');

    const [y, m, d] = billDueDate.split('-');
    const dueDate = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);

    setIsSubmittingBill(true);
    try {
      await addDoc(collection(db, 'billsToPay'), {
        userId: user.uid,
        name: billName.trim(),
        amount: val,
        dueDate,
        paid: false,
        recurring: billRecurring,
        frequency: billRecurring ? billFrequency : null,
        createdAt: serverTimestamp()
      });
      showAlert('Conta a pagar adicionada!', 'Sucesso', 'success');
      setShowAddBillModal(false);
      setBillName('');
      setBillAmount('');
      setBillDueDate('');
      setBillRecurring(false);
      setBillFrequency('mensal');
    } catch (e) {
      console.error(e);
      showAlert('Erro ao adicionar conta', 'Erro', 'error');
    } finally {
      setIsSubmittingBill(false);
    }
  };

  const getNextDueDate = (currentDate: Date, frequency: string) => {
    switch (frequency) {
      case 'diaria': return addDays(currentDate, 1);
      case 'semanal': return addDays(currentDate, 7);
      case 'quinzenal': return addDays(currentDate, 15);
      case 'mensal': return addMonths(currentDate, 1);
      case 'bimestral': return addMonths(currentDate, 2);
      case 'trimestral': return addMonths(currentDate, 3);
      case 'semestral': return addMonths(currentDate, 6);
      case 'anual': return addYears(currentDate, 1);
      default: return addMonths(currentDate, 1);
    }
  };

  const handlePayBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBill) return;

    setIsPayingBill(true);
    try {
      let receiptUrl = null;
      if (payReceipt) {
        receiptUrl = await uploadToCloudinary(payReceipt);
        if (!receiptUrl) throw new Error("Erro ao fazer upload do comprovante");
      }

      await addDoc(collection(db, 'cashflow'), {
        userId: user.uid,
        description: `Pagamento: ${selectedBill.name}`,
        type: 'out',
        account: payMethod === 'dinheiro' ? 'cofre' : 'banco',
        category: 'Despesas Fixas',
        value: Number(selectedBill.amount),
        receiptUrls: receiptUrl ? [receiptUrl] : [],
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'billsToPay', selectedBill.id), {
        paid: true,
        payMethod,
        receiptUrl: receiptUrl || null,
        paidAt: serverTimestamp()
      });

      if (selectedBill.recurring && selectedBill.frequency) {
        const nextDueDate = getNextDueDate(selectedBill.dueDate?.toDate() || new Date(), selectedBill.frequency);
        await addDoc(collection(db, 'billsToPay'), {
          userId: user.uid,
          name: selectedBill.name,
          amount: selectedBill.amount,
          dueDate: nextDueDate,
          paid: false,
          recurring: selectedBill.recurring,
          frequency: selectedBill.frequency,
          createdAt: serverTimestamp()
        });
      }

      showAlert('Conta paga com sucesso!', 'Sucesso', 'success');
      setShowPayBillModal(false);
      setSelectedBill(null);
      setPayReceipt(null);
      setPayMethod('transferencia');
    } catch (e: any) {
      console.error(e);
      showAlert(e.message || 'Erro ao pagar conta', 'Erro', 'error');
    } finally {
      setIsPayingBill(false);
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta movimentação?")) return;
    try {
      await deleteDoc(doc(db, 'cashflow', id));
      showAlert('Movimentação excluída com sucesso!', 'Sucesso', 'success');
    } catch (e) {
      showAlert('Erro ao excluir movimentação', 'Erro', 'error');
    }
  };

  const handleDeleteBill = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'billsToPay', id));
      showAlert('Conta excluída com sucesso!', 'Sucesso', 'success');
    } catch (e) {
      showAlert('Erro ao excluir conta', 'Erro', 'error');
    }
  };

  const dreTransfers = transfers.filter(t => {
    if (t.type === 'transfer') return false; 
    const d = t.createdAt?.toDate?.();
    if (!d) return false;
    
    const start = dreStartDate ? new Date(dreStartDate + 'T00:00:00') : null;
    const end = dreEndDate ? new Date(dreEndDate + 'T23:59:59') : null;
    
    if (start && d < start) return false;
    if (end && d > end) return false;
    
    return true;
  });

  let receitaFaturamento = 0;
  let custoVariavel = 0;
  let despesasFixas = 0;
  let investimentos = 0;
  let movNaoOperacionais = 0;

  const dreTransactions = {
    receitaFaturamento: [] as any[],
    custoVariavel: [] as any[],
    despesasFixas: [] as any[],
    investimentos: [] as any[],
    movNaoOperacionais: [] as any[]
  };

  dreTransfers.forEach(t => {
    const val = Number(t.value) || 0;
    const cat = t.category;
    if (t.type === 'in') {
      if (cat === 'Venda' || cat === 'Vendas' || t.orderId || (t.description && t.description.startsWith('Pagamento - '))) { 
        receitaFaturamento += val; 
        dreTransactions.receitaFaturamento.push(t); 
      }
      else { 
        movNaoOperacionais += val; 
        dreTransactions.movNaoOperacionais.push(t); 
      }
    } else if (t.type === 'out') {
      if (cat === 'Material' || cat === 'Impostos') { custoVariavel += val; dreTransactions.custoVariavel.push(t); }
      else if (cat === 'Equipamento') { investimentos += val; dreTransactions.investimentos.push(t); }
      else if (cat === 'Retirada Pessoal' || cat === 'Ajuste de Caixa') { 
        movNaoOperacionais -= val; 
        dreTransactions.movNaoOperacionais.push(t); 
      }
      else { despesasFixas += val; dreTransactions.despesasFixas.push(t); }
    }
  });

  const margemContribuicao = receitaFaturamento - custoVariavel;
  const lucroOpAntesInv = margemContribuicao - despesasFixas;
  const lucroOperacional = lucroOpAntesInv - investimentos;
  const resultadoLiquido = lucroOperacional + movNaoOperacionais;

  const calcDrePct = (val: number) => {
    if (receitaFaturamento === 0) return '0,0%';
    const pct = (Math.abs(val) / receitaFaturamento) * 100;
    return pct.toFixed(1).replace('.', ',') + '%';
  };

  const renderDreRow = (title: string, value: number, rowKey: keyof typeof dreTransactions, isExpense = false) => {
    const isExpanded = dreExpanded[rowKey];
    let valColor = 'inherit';
    if (rowKey === 'receitaFaturamento') valColor = 'var(--success-color)';
    else if (rowKey === 'movNaoOperacionais') valColor = value >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    else if (isExpense) valColor = 'var(--danger-color)';

    const transactions = dreTransactions[rowKey];

    return (
      <React.Fragment key={rowKey}>
        <tr style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => toggleDreRow(rowKey)}>
          <td style={{ padding: '12px', fontWeight: rowKey === 'receitaFaturamento' ? 'bold' : 'normal' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              {title}
            </div>
          </td>
          <td style={{ padding: '12px', textAlign: 'right', color: valColor }}>
            {rowKey === 'movNaoOperacionais' ? (value >= 0 ? '+' : '') : ''}{formatCurrency(value)}
            <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '8px', display: 'inline-block', minWidth: '45px' }}>
              ({calcDrePct(value)})
            </span>
          </td>
        </tr>
        {isExpanded && transactions.length > 0 && (
          <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
            <td colSpan={2} style={{ padding: '0 12px 12px 42px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {transactions.map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)' }}>
                    <span>{t.createdAt?.toDate() ? format(t.createdAt.toDate(), 'dd/MM') : ''} - <strong>{t.description}</strong> ({t.account === 'cofre' ? 'Cofre' : 'Banco'})</span>
                    <span style={{ color: t.type === 'in' ? 'var(--success-color)' : 'var(--danger-color)' }}>{t.type === 'in' ? '+' : '-'} {formatCurrency(Number(t.value))}</span>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
        {isExpanded && transactions.length === 0 && (
           <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
            <td colSpan={2} style={{ padding: '8px 12px 12px 42px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Nenhuma movimentação neste período.
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Caixa</h2>
          <p className="page-subtitle">Gerencie suas transferências e controle os gastos.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => window.location.href = '/anexos'} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Ver Anexos
          </button>
          <button className="btn-secondary" onClick={() => setShowCaixinhaModal(true)}>
            Criar Caixinha
          </button>
          <button className="btn-primary" onClick={() => {
            setAddType('out');
            setAddCategory(EXPENSE_CATEGORIES[0]);
            setShowAddModal(true);
          }}>
            + Nova Movimentação
          </button>
        </div>
      </div>
      
      <div className="caixa-grid">
        <StatCard title="Banco" value={formatCurrency(bancoAtual)} />
        <StatCard title="Físico (Cofre)" value={formatCurrency(cofreAtual)} />
        <StatCard title="Entradas Mês" value={formatCurrency(entradasMes)} />

        <div className="caixa-left-column">
          <StatCard title="Despesas Mês" value={formatCurrency(despesasMes)} className="no-span" />

          <div className="card flex-half" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 className="card-title">Termômetro de Gastos</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Despesas este mês: <strong>{formatCurrency(despesasMes)}</strong>
            </p>
            <p 
              onClick={handleSetLimit}
              style={{ fontSize: '0.875rem', color: 'var(--accent-color)', textAlign: 'center', cursor: 'pointer', marginTop: '8px', fontWeight: 500 }}
              title="Clique para alterar"
            >
              Limite: {formatCurrency(expenseLimit)} ✎
            </p>
            
            <div className="thermometer-container" style={{ flex: 1, marginTop: '16px' }}>
              <div className="thermometer-glass">
                <div className="thermometer-mercury" style={{ height: `${thermoPercent}%`, backgroundColor: thermoPercent >= 100 ? '#b91c1c' : 'var(--danger-color)' }}></div>
              </div>
              <div className="thermometer-bulb" style={{ backgroundColor: thermoPercent >= 100 ? '#b91c1c' : 'var(--danger-color)' }}>
                {Math.round((despesasMes / expenseLimit) * 100)}%
              </div>
            </div>
          </div>

          <div className="card flex-half" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 className="card-title">Gastos por Categoria</h3>
            <div style={{ flex: 1, minHeight: 150 }}>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(Number(value))}
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>Sem despesas no período selecionado.</p>
              )}
            </div>
          </div>
        </div>

        <div className="transfers-full-card-wrapper">
          <div className="card transfers-full-card">
            <h3 className="card-title">Histórico de Transferências</h3>
            
            <div className="filters-row">
              <select className="filter-select" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
                <option value="all">Todos os meses</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">Todas as categorias</option>
                <optgroup label="Saídas">
                  <option value="Material">Material</option>
                  <option value="Equipamento">Equipamento</option>
                  <option value="Salário">Salário</option>
                  <option value="Impostos">Impostos</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Retirada Pessoal">Retirada Pessoal</option>
                  <option value="Ajuste de Caixa">Ajuste de Caixa</option>
                </optgroup>
                <optgroup label="Entradas">
                  <option value="Venda">Venda</option>
                  <option value="Investimento">Investimento</option>
                  <option value="Ajuste de Caixa">Ajuste de Caixa</option>
                </optgroup>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div className="transfers-list-scrollable">
              {loading ? <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p> : filteredTransfers.map((t) => {
                const isIncome = t.type === 'in';
                const dateObj = t.createdAt?.toDate?.();
                const dateStr = dateObj ? format(dateObj, "dd/MM/yyyy 'às' HH:mm") : 'Sem data';
                const isBankMovement = t.account === 'banco' || t.type === 'transfer';
                
                return (
                  <div key={t.id} className="transfer-item">
                    <div className="transfer-left">
                      <div className={`transfer-icon ${isBankMovement ? 'bank' : isIncome ? 'income' : 'expense'}`}>
                        {t.type === 'transfer' ? <ArrowRight size={20} /> : isIncome ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
                      </div>
                      <div className="transfer-details">
                        <h4>{t.description}</h4>
                        <p>
                          {dateStr} • <span style={{ fontWeight: 600 }}>{t.category || 'Outros'}</span>
                          {t.type === 'transfer' ? (
                            <span> • <strong style={{ color: 'var(--accent-color)' }}>{t.transferDirection === 'banco_to_cofre' ? 'Banco ➔ Cofre' : 'Cofre ➔ Banco'}</strong></span>
                          ) : (
                            <span> • <strong>{t.account === 'cofre' ? 'Cofre' : 'Banco'}</strong></span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className={`transfer-amount ${t.type === 'transfer' ? '' : isIncome ? 'income' : 'expense'}`} style={t.type === 'transfer' ? { color: 'var(--text-primary)' } : {}}>
                        {t.type === 'transfer' ? '' : isIncome ? '+' : '-'} {formatCurrency(Number(t.value))}
                      </div>
                      <button onClick={() => handleDeleteTransfer(t.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '4px' }} title="Excluir Movimentação">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!loading && filteredTransfers.length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>Nenhuma transferência encontrada para os filtros selecionados.</p>
              )}
            </div>
          </div>
        </div>

      </div>

      <div style={{ marginTop: '32px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Contas a Pagar</h3>
            <button className="btn-secondary" onClick={() => setShowAddBillModal(true)}>+ Adicionar Conta</button>
          </div>
          {bills.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Nenhuma conta a pagar registrada.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px' }}>Descrição</th>
                    <th style={{ padding: '12px' }}>Vencimento</th>
                    <th style={{ padding: '12px' }}>Valor</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(b => {
                    const dueObj = b.dueDate?.toDate?.();
                    const isOverdue = dueObj && dueObj < new Date() && !b.paid;
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px' }}>{b.name}</td>
                        <td style={{ padding: '12px', color: isOverdue ? 'var(--danger-color)' : 'var(--text-primary)', fontWeight: isOverdue ? 'bold' : 'normal' }}>
                          {dueObj ? format(dueObj, 'dd/MM/yyyy') : 'Sem data'}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{formatCurrency(Number(b.amount))}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                            backgroundColor: b.paid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: b.paid ? '#10b981' : '#f59e0b'
                          }}>
                            {b.paid ? 'Pago' : 'Pendente'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            {!b.paid && (
                              <button onClick={() => { setSelectedBill(b); setShowPayBillModal(true); }} style={{ background: 'none', border: 'none', color: 'var(--success-color)', cursor: 'pointer' }} title="Pagar Conta">
                                <CheckCircle size={18} />
                              </button>
                            )}
                            <button onClick={() => handleDeleteBill(b.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }} title="Excluir Conta">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '32px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Demonstração do Resultado (DRE)</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '0.875rem' }}>De:</label>
              <input 
                type="date" 
                className="filter-select"
                value={dreStartDate}
                onChange={e => setDreStartDate(e.target.value)}
              />
              <label style={{ fontSize: '0.875rem' }}>Até:</label>
              <input 
                type="date" 
                className="filter-select"
                value={dreEndDate}
                onChange={e => setDreEndDate(e.target.value)}
              />
            </div>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <tbody>
                {renderDreRow('Receita / Faturamento', receitaFaturamento, 'receitaFaturamento')}
                {renderDreRow('(-) Custo Variável', custoVariavel, 'custoVariavel', true)}
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', paddingLeft: '36px' }}>(=) Margem de Contribuição</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatCurrency(margemContribuicao)}
                    <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '8px', display: 'inline-block', minWidth: '45px', fontWeight: 'normal' }}>
                      ({calcDrePct(margemContribuicao)})
                    </span>
                  </td>
                </tr>
                {renderDreRow('(-) Despesas Fixas', despesasFixas, 'despesasFixas', true)}
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', paddingLeft: '36px' }}>(=) Lucro Operacional Antes dos Investimentos</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatCurrency(lucroOpAntesInv)}
                    <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '8px', display: 'inline-block', minWidth: '45px', fontWeight: 'normal' }}>
                      ({calcDrePct(lucroOpAntesInv)})
                    </span>
                  </td>
                </tr>
                {renderDreRow('(-) Investimentos', investimentos, 'investimentos', true)}
                <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', paddingLeft: '36px' }}>(=) Lucro Operacional</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatCurrency(lucroOperacional)}
                    <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '8px', display: 'inline-block', minWidth: '45px', fontWeight: 'normal' }}>
                      ({calcDrePct(lucroOperacional)})
                    </span>
                  </td>
                </tr>
                {renderDreRow('(+/-) Movimentações Não Operacionais', movNaoOperacionais, 'movNaoOperacionais')}
                <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--success-color)', paddingLeft: '36px' }}>(=) Resultado Líquido</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: resultadoLiquido >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                    {formatCurrency(resultadoLiquido)}
                    <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '8px', display: 'inline-block', minWidth: '45px', color: 'var(--text-primary)', fontWeight: 'normal' }}>
                      ({calcDrePct(resultadoLiquido)})
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">Nova Transferência</h3>
            <form onSubmit={handleAddTransfer}>
              <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => { setAddType('in'); setAddCategory(INCOME_CATEGORIES[0]); }}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: addType === 'in' ? 'var(--success-color)' : 'var(--bg-color)', color: addType === 'in' ? '#fff' : 'var(--text-primary)', cursor: 'pointer' }}
                >
                  Entrada
                </button>
                <button 
                  type="button" 
                  onClick={() => { setAddType('out'); setAddCategory(EXPENSE_CATEGORIES[0]); }}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: addType === 'out' ? 'var(--danger-color)' : 'var(--bg-color)', color: addType === 'out' ? '#fff' : 'var(--text-primary)', cursor: 'pointer' }}
                >
                  Saída
                </button>
                <button 
                  type="button" 
                  onClick={() => { setAddType('transfer'); setAddCategory('Transferência Interna'); }}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: addType === 'transfer' ? 'var(--accent-color)' : 'var(--bg-color)', color: addType === 'transfer' ? '#fff' : 'var(--text-primary)', cursor: 'pointer' }}
                >
                  Transf. Interna
                </button>
              </div>

              {addType !== 'transfer' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Conta / Origem</label>
                  <select 
                    className="filter-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={addAccount}
                    onChange={(e) => setAddAccount(e.target.value as any)}
                  >
                    <option value="banco">Banco</option>
                    <option value="cofre">Físico (Cofre)</option>
                  </select>
                </div>
              )}

              {addType === 'transfer' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Direção</label>
                  <select 
                    className="filter-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={transferDirection}
                    onChange={(e) => setTransferDirection(e.target.value as any)}
                  >
                    <option value="banco_to_cofre">Sacar (Banco ➔ Cofre)</option>
                    <option value="cofre_to_banco">Depositar (Cofre ➔ Banco)</option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Descrição</label>
                <input 
                  type="text"
                  required
                  className="filter-select" 
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  placeholder="Ex: Compra de embalagens"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Valor (€)</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  className="filter-select" 
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  placeholder="Ex: 50.00"
                />
              </div>

              {addType !== 'transfer' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Categoria</label>
                  <select 
                    className="filter-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value)}
                  >
                    {(addType === 'in' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddBillModal && (
        <div className="modal-overlay" onClick={() => setShowAddBillModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">Nova Conta a Pagar</h3>
            <form onSubmit={handleAddBillSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Nome da Conta</label>
                <input 
                  type="text" required
                  className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                  value={billName} onChange={(e) => setBillName(e.target.value)}
                  placeholder="Ex: Aluguel"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Valor (€)</label>
                <input 
                  type="number" step="0.01" required
                  className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                  value={billAmount} onChange={(e) => setBillAmount(e.target.value)}
                  placeholder="Ex: 500.00"
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Data de Vencimento</label>
                <input 
                  type="date" required
                  className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                  value={billDueDate} onChange={(e) => setBillDueDate(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" id="billRecurring"
                  checked={billRecurring} onChange={(e) => setBillRecurring(e.target.checked)}
                />
                <label htmlFor="billRecurring" style={{ fontSize: '0.875rem' }}>Pagamento recorrente</label>
              </div>
              {billRecurring && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Frequência</label>
                  <select 
                    className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                    value={billFrequency} onChange={(e) => setBillFrequency(e.target.value)}
                  >
                    <option value="diaria">Diária</option>
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                    <option value="mensal">Mensal</option>
                    <option value="bimestral">Bimestral</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddBillModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Cancelar</button>
                <button type="submit" disabled={isSubmittingBill} className="btn-primary">
                  {isSubmittingBill ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayBillModal && selectedBill && (
        <div className="modal-overlay" onClick={() => setShowPayBillModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">Pagar Conta: {selectedBill.name}</h3>
            <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>Valor: <strong>{formatCurrency(Number(selectedBill.amount))}</strong></p>
            <form onSubmit={handlePayBillSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Forma de Pagamento</label>
                <select 
                  className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                  value={payMethod} onChange={(e) => setPayMethod(e.target.value as 'dinheiro' | 'transferencia')}
                >
                  <option value="transferencia">Transferência (Banco)</option>
                  <option value="dinheiro">Dinheiro (Cofre)</option>
                </select>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Comprovante (Obrigatório)</label>
                <input 
                  type="file" accept="image/*,.pdf" required
                  className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                  onChange={(e) => setPayReceipt(e.target.files ? e.target.files[0] : null)}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowPayBillModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Cancelar</button>
                <button type="submit" disabled={isPayingBill} className="btn-primary">
                  {isPayingBill ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCaixinhaModal && (
        <div className="modal-overlay" onClick={() => setShowCaixinhaModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">Nova Caixinha (Objetivo)</h3>
            <form onSubmit={handleAddCaixinha}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Nome do Objetivo</label>
                <input 
                  type="text"
                  required
                  className="filter-select" 
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={caixinhaName}
                  onChange={(e) => setCaixinhaName(e.target.value)}
                  placeholder="Ex: Reforma da Cozinha"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Meta de Valor (€)</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  className="filter-select" 
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={caixinhaTarget}
                  onChange={(e) => setCaixinhaTarget(e.target.value)}
                  placeholder="Ex: 5000.00"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCaixinhaModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmittingCaixinha} className="btn-primary">
                  {isSubmittingCaixinha ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
