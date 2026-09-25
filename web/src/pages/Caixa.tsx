import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { format, isSameMonth } from 'date-fns';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';

const formatCurrency = (val: number) => `€ ${val.toFixed(2).replace('.', ',')}`;

const StatCard = ({ title, value }: { title: string, value: string }) => (
  <div className="card caixa-stat-card">
    <h3 className="card-title">{title}</h3>
    <div className="stat-value">{value}</div>
  </div>
);

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#64748b'];

const EXPENSE_CATEGORIES = ['Material', 'Equipamento', 'Salário', 'Impostos', 'Marketing', 'Outros'];
const INCOME_CATEGORIES = ['Venda', 'Investimento', 'Outros'];

export default function Caixa() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [dinheiroCaixa, setDinheiroCaixa] = useState(0);
  const [entradasMes, setEntradasMes] = useState(0);
  const [despesasMes, setDespesasMes] = useState(0);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  
  const [expenseLimit, setExpenseLimit] = useState(2000);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'in' | 'out'>('out');
  const [addDesc, setAddDesc] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addCategory, setAddCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Caixinha State
  const [showCaixinhaModal, setShowCaixinhaModal] = useState(false);
  const [caixinhaName, setCaixinhaName] = useState('');
  const [caixinhaTarget, setCaixinhaTarget] = useState('');
  const [isSubmittingCaixinha, setIsSubmittingCaixinha] = useState(false);

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
      let caixaAtual = 0;
      let entradasAtual = 0;
      let despesasAtual = 0;

      docs.forEach((t: any) => {
        const val = Number(t.value) || 0;
        const isIncome = t.type === 'in';
        const date = t.createdAt?.toDate?.() || new Date();
        
        if (isIncome) {
          caixaAtual += val;
          if (isSameMonth(date, now)) entradasAtual += val;
        } else {
          caixaAtual -= val;
          if (isSameMonth(date, now)) despesasAtual += val;
        }
      });

      setDinheiroCaixa(caixaAtual);
      setEntradasMes(entradasAtual);
      setDespesasMes(despesasAtual);
      setLoading(false);
    });
    
    return unsub;
  }, [user]);

  const handleSetLimit = () => {
    const val = window.prompt('Defina o limite de gastos para o mês (€):', expenseLimit.toString());
    if (val && !isNaN(Number(val)) && Number(val) > 0) {
      setExpenseLimit(Number(val));
      localStorage.setItem('expenseLimit', val);
    }
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
        category: addCategory,
        value: parseFloat(addValue.replace(',', '.')),
        receiptUrls: [],
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setAddDesc('');
      setAddValue('');
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar transferência');
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
      alert('Erro ao criar caixinha');
    } finally {
      setIsSubmittingCaixinha(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Caixa</h2>
          <p className="page-subtitle">Gerencie suas transferências e controle os gastos.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => setShowCaixinhaModal(true)}>
            Criar Caixinha
          </button>
          <button className="btn-primary" onClick={() => {
            setAddType('out');
            setAddCategory(EXPENSE_CATEGORIES[0]);
            setShowAddModal(true);
          }}>
            + Nova Transferência
          </button>
        </div>
      </div>
      
      <div className="caixa-grid">
        <StatCard title="Dinheiro no Caixa" value={formatCurrency(dinheiroCaixa)} />
        <StatCard title="Entradas (Este Mês)" value={formatCurrency(entradasMes)} />
        <StatCard title="Despesas (Este Mês)" value={formatCurrency(despesasMes)} />

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
                </optgroup>
                <optgroup label="Entradas">
                  <option value="Venda">Venda</option>
                  <option value="Investimento">Investimento</option>
                </optgroup>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div className="transfers-list-scrollable">
              {loading ? <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p> : filteredTransfers.map((t) => {
                const isIncome = t.type === 'in';
                const dateObj = t.createdAt?.toDate?.();
                const dateStr = dateObj ? format(dateObj, "dd/MM/yyyy 'às' HH:mm") : 'Sem data';
                
                return (
                  <div key={t.id} className="transfer-item">
                    <div className="transfer-left">
                      <div className={`transfer-icon ${isIncome ? 'income' : 'expense'}`}>
                        {isIncome ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
                      </div>
                      <div className="transfer-details">
                        <h4>{t.description}</h4>
                        <p>{dateStr} • <span style={{ fontWeight: 600 }}>{t.category || 'Outros'}</span></p>
                      </div>
                    </div>
                    <div className={`transfer-amount ${isIncome ? 'income' : 'expense'}`}>
                      {isIncome ? '+' : '-'} {formatCurrency(Number(t.value))}
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

        <div className="caixa-right-column">
          <div className="card">
            <h3 className="card-title">Gastos por Categoria</h3>
            <div style={{ height: 250 }}>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
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

          <div className="card">
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
            
            <div className="thermometer-container">
              <div className="thermometer-glass">
                <div className="thermometer-mercury" style={{ height: `${thermoPercent}%`, backgroundColor: thermoPercent >= 100 ? '#b91c1c' : 'var(--danger-color)' }}></div>
              </div>
              <div className="thermometer-bulb" style={{ backgroundColor: thermoPercent >= 100 ? '#b91c1c' : 'var(--danger-color)' }}>
                {Math.round((despesasMes / expenseLimit) * 100)}%
              </div>
            </div>
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
              </div>

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
