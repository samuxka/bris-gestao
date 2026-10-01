import { useEffect, useState } from 'react';

import { ArrowUpRight, ArrowDownRight, Gift, AlertCircle, Calendar as CalendarIcon, Clock } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { collection, query, where, onSnapshot, doc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { uploadToCloudinary } from '../services/cloudinary';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { format, subDays, subMonths, subYears, isSameMonth, startOfDay, isSameDay, isSameYear, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const StatCard = ({ title, value, trendColor, trendDirection, trendValue }: { title: string, value: string, trendColor?: 'success' | 'danger' | 'neutral', trendDirection?: 'up' | 'down' | 'neutral', trendValue?: string }) => (
  <div className="card stat-card">
    <h3 className="card-title">{title}</h3>
    <div className="stat-value">{value}</div>
    {trendValue && (
      <div className="stat-trend">
        {trendColor !== 'neutral' && trendDirection && trendDirection !== 'neutral' ? (
          <span className={trendColor === 'success' ? 'trend-up' : 'trend-down'}>
            {trendDirection === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />} {trendValue}
          </span>
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>{trendValue}</span>
        )}
      </div>
    )}
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { showAlert, showPrompt, showConfirm } = useAlert();
  const [loading, setLoading] = useState(true);

  // Filter
  const [period, setPeriod] = useState<'day' | 'month' | 'year' | 'all'>('month');

  // Stats Data
  const [receita, setReceita] = useState(0);
  const [despesas, setDespesas] = useState(0);
  const [lucro, setLucro] = useState(0);
  const [receitaPerc, setReceitaPerc] = useState(0);
  const [despesasPerc, setDespesasPerc] = useState(0);
  const [lucroPerc, setLucroPerc] = useState(0);
  const [aReceber, setAReceber] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  // Outros dados
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [crmData, setCrmData] = useState<{name: string, reason: string, type: 'unpaid' | 'gift' | 'away'}[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  
  // Metas de Vendas
  const [products, setProducts] = useState<any[]>([]);
  const [monthlySales, setMonthlySales] = useState<Record<string, Record<string, number>>>({});
  const [goalMonthOffset, setGoalMonthOffset] = useState(0);
  
  const formatCurrency = (val: number) => `€ ${val.toFixed(2).replace('.', ',')}`;

  const formatPerc = (perc: number) => {
    if (perc === 0) return 'Igual ao anterior';
    const sign = perc > 0 ? '+' : '';
    return `${sign}${perc.toFixed(1)}% vs anterior`;
  };

  useEffect(() => {
    if (!user) return;
    
    // 1. Fetch Orders para CRM e "A Receber"
    const qOrders = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      
      let totalUnpaid = 0;
      const clientStats: Record<string, { done: number, unpaid: number, lastDate: Date, total: number, id: string }> = {};
      const salesGoalMap: Record<string, Record<string, number>> = {};

      docs.forEach(doc => {
        const status = doc.status;
        const total = Number(doc.total) || 0;
        const dateObj = doc.createdAt?.toDate?.() || new Date();
        const cName = doc.clientName?.trim() || 'Desconhecido';
        const isMesa = cName.toLowerCase().startsWith('mesa') || cName.toLowerCase() === 'cliente';

        if (status === 'unpaid') {
          totalUnpaid += total;
        }

        if (!isMesa) {
          if (!clientStats[cName]) clientStats[cName] = { done: 0, unpaid: 0, lastDate: dateObj, total: 0, id: '' };
          if (status === 'unpaid') clientStats[cName].unpaid += 1;
          if (status === 'done') {
            clientStats[cName].done += 1;
            clientStats[cName].total += total;
          }
          if (dateObj > clientStats[cName].lastDate) {
            clientStats[cName].lastDate = dateObj;
          }
        }
        
        // Sales tracking for goals
        if (status === 'done') {
          const m = dateObj.getMonth();
          const y = dateObj.getFullYear();
          const ym = `${y}-${m}`;
          if (!salesGoalMap[ym]) salesGoalMap[ym] = {};
          
          const items = doc.items || [];
          items.forEach((item: any) => {
            const itemName = item.name;
            const qty = Number(item.quantity) || 1;
            if (itemName) {
              salesGoalMap[ym][itemName] = (salesGoalMap[ym][itemName] || 0) + qty;
            }
          });
        }
      });

      setAReceber(totalUnpaid);
      setMonthlySales(salesGoalMap);

      // Top Customers
      const customersList = Object.keys(clientStats).map(k => ({ name: k, ...clientStats[k] }));
      customersList.sort((a, b) => b.total - a.total);
      setTopCustomers(customersList.slice(0, 5));

      // CRM Insights
      const insights: {name: string, reason: string, type: 'unpaid' | 'gift' | 'away'}[] = [];
      const now = new Date();
      Object.keys(clientStats).forEach(name => {
        const st = clientStats[name];
        if (st.unpaid > 0) {
          insights.push({ name, reason: `Tem ${st.unpaid} pedido(s) não pago(s)`, type: 'unpaid' });
        }
        if (st.done > 0 && st.done % 10 === 9) {
          insights.push({ name, reason: `Falta 1 pedido para ganhar o brinde`, type: 'gift' });
        }
        if (differenceInDays(now, st.lastDate) > 30) {
          insights.push({ name, reason: `Não compra há ${differenceInDays(now, st.lastDate)} dias`, type: 'away' });
        }
      });
      setCrmData(insights);
    });

    // 2. Fetch Cashflow para Receitas, Despesas, Lucro e Gráfico
    const qCashflow = query(collection(db, 'cashflow'), where('userId', '==', user.uid));
    const unsubCashflow = onSnapshot(qCashflow, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const now = new Date();
      const prevDay = subDays(now, 1);
      const prevMonth = subMonths(now, 1);
      const prevYear = subYears(now, 1);
      
      let calcReceita = 0;
      let calcDespesa = 0;
      let calcReceitaPrev = 0;
      let calcDespesaPrev = 0;
      const dailyMap: Record<string, { dateObj: Date, entradas: number, saidas: number }> = {};

      docs.forEach(t => {
        const val = Number(t.value) || 0;
        const isIncome = t.type === 'in';
        const dateObj = t.createdAt?.toDate?.() || new Date();
        
        let include = false;
        let includePrev = false;

        if (period === 'day') {
          include = isSameDay(dateObj, now);
          includePrev = isSameDay(dateObj, prevDay);
        } else if (period === 'month') {
          include = isSameMonth(dateObj, now);
          includePrev = isSameMonth(dateObj, prevMonth);
        } else if (period === 'year') {
          include = isSameYear(dateObj, now);
          includePrev = isSameYear(dateObj, prevYear);
        } else {
          include = true;
          includePrev = false;
        }

        if (include) {
          if (isIncome) calcReceita += val;
          else calcDespesa += val;
        }
        if (includePrev) {
          if (isIncome) calcReceitaPrev += val;
          else calcDespesaPrev += val;
        }

        // Gráfico sempre por dia (dentro do período selecionado)
        if (include || period === 'all') {
           const dayKey = format(dateObj, 'yyyy-MM-dd');
           if (!dailyMap[dayKey]) dailyMap[dayKey] = { dateObj: startOfDay(dateObj), entradas: 0, saidas: 0 };
           if (isIncome) dailyMap[dayKey].entradas += val;
           else dailyMap[dayKey].saidas += val;
        }
      });

      const calcLucro = calcReceita - calcDespesa;
      const calcLucroPrev = calcReceitaPrev - calcDespesaPrev;

      const getPerc = (cur: number, prev: number) => {
         if (prev === 0) return cur > 0 ? 100 : 0;
         return ((cur - prev) / Math.abs(prev)) * 100;
      };

      setReceita(calcReceita);
      setDespesas(calcDespesa);
      setLucro(calcLucro);
      setReceitaPerc(getPerc(calcReceita, calcReceitaPrev));
      setDespesasPerc(getPerc(calcDespesa, calcDespesaPrev));
      setLucroPerc(getPerc(calcLucro, calcLucroPrev));

      let chartArr = Object.values(dailyMap).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
      
      // Filtrar array do grafico se o periodo for muito longo, ou apenas renderizar
      if (period === 'all' && chartArr.length > 30) {
        chartArr = chartArr.slice(-30); // ultimos 30 dias ativos
      }

      const formattedChart = chartArr.map(c => ({
        name: format(c.dateObj, 'dd MMM', { locale: ptBR }),
        entradas: c.entradas,
        saidas: c.saidas
      }));

      // Placeholder point if only 1 day
      if (formattedChart.length === 1) {
        const prev = subDays(chartArr[0].dateObj, 1);
        formattedChart.unshift({
          name: format(prev, 'dd MMM', { locale: ptBR }),
          entradas: 0,
          saidas: 0
        });
      }

      setChartData(formattedChart);
      setLoading(false);
    });

    // 3. Fetch Contas a Pagar
    const qBills = query(collection(db, 'billsToPay'), where('userId', '==', user.uid));
    const unsubBills = onSnapshot(qBills, (snap) => {
      const b = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      b.sort((x: any, y: any) => (x.dueDate?.toDate?.()?.getTime() || 0) - (y.dueDate?.toDate?.()?.getTime() || 0));
      setBills(b);
    });

    // 4. Fetch Products for goals
    const qProducts = query(collection(db, 'products'), where('userId', '==', user.uid));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });

    return () => {
      unsubOrders();
      unsubCashflow();
      unsubBills();
      unsubProducts();
    };
  }, [user, period]);

  // @ts-ignore
  const handleAddBill = () => {
    showPrompt('Qual o nome da conta a pagar?', '', (name) => {
      if (!name) return;
      showPrompt('Qual o valor da conta? (ex: 50.00)', '', async (amount) => {
        const val = parseFloat(amount.replace(',', '.'));
        if (isNaN(val) || val <= 0) return showAlert('Valor inválido', 'Erro', 'error');
        try {
          await addDoc(collection(db, 'billsToPay'), {
            userId: user?.uid,
            title: name,
            amount: val,
            dueDate: serverTimestamp(), // Padrão agora
            isPaid: false
          });
          showAlert('Conta adicionada com sucesso!', 'Sucesso', 'success');
        } catch (e) {
          showAlert('Erro ao adicionar', 'Erro', 'error');
        }
      }, 'Valor da Conta');
    }, 'Nova Conta');
  };

  const handlePayBill = (id: string, title: string, amount: number) => {
    // Create an invisible file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      showConfirm(`Confirmar pagamento de "${title}" no valor de ${formatCurrency(amount)}?`, async () => {
        try {
          const url = await uploadToCloudinary(file);
          if (!url) throw new Error("Falha no upload para o Cloudinary");

          await updateDoc(doc(db, 'billsToPay', id), { paid: true });
          
          await addDoc(collection(db, 'cashflow'), {
            userId: user?.uid,
            type: 'out',
            value: amount,
            description: `Pagamento de Conta: ${title}`,
            account: 'banco',
            category: 'Despesas Fixas',
            receiptUrls: [url],
            createdAt: serverTimestamp()
          });
          showAlert('Conta paga com sucesso!', 'Sucesso', 'success');
        } catch(err) {
          showAlert('Erro ao pagar conta e enviar comprovante', 'Erro', 'error');
        }
      }, 'Confirmar Pagamento');
    };
    
    // Trigger file picker
    input.click();
  };

  const targetGoalDate = new Date();
  targetGoalDate.setMonth(targetGoalDate.getMonth() + goalMonthOffset);
  const targetGoalYM = `${targetGoalDate.getFullYear()}-${targetGoalDate.getMonth()}`;
  const currentMonthSales = monthlySales[targetGoalYM] || {};

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="page-title">Visão Geral</h2>
          <p className="page-subtitle">Acompanhe os principais indicadores da pastelaria.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <CalendarIcon size={18} color="var(--text-secondary)" />
          <select 
            className="filter-select"
            value={period} 
            onChange={(e) => setPeriod(e.target.value as any)}
          >
            <option value="day">Hoje</option>
            <option value="month">Este Mês</option>
            <option value="year">Este Ano</option>
            <option value="all">Todo Período</option>
          </select>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Top Cards */}
        <StatCard
          title="Receita"
          value={formatCurrency(receita)}
          trendColor={period === 'all' ? 'neutral' : receitaPerc > 0 ? 'success' : receitaPerc < 0 ? 'danger' : 'neutral'}
          trendDirection={receitaPerc > 0 ? 'up' : receitaPerc < 0 ? 'down' : 'neutral'}
          trendValue={period === 'all' ? 'Total histórico' : formatPerc(receitaPerc)}
        />
        <StatCard
          title="Despesas"
          value={formatCurrency(despesas)}
          trendColor={period === 'all' ? 'neutral' : despesasPerc > 0 ? 'danger' : despesasPerc < 0 ? 'success' : 'neutral'}
          trendDirection={despesasPerc > 0 ? 'up' : despesasPerc < 0 ? 'down' : 'neutral'}
          trendValue={period === 'all' ? 'Total histórico' : formatPerc(despesasPerc)}
        />
        <StatCard
          title="Lucro"
          value={formatCurrency(lucro)}
          trendColor={period === 'all' ? (lucro > 0 ? 'success' : lucro < 0 ? 'danger' : 'neutral') : lucroPerc > 0 ? 'success' : lucroPerc < 0 ? 'danger' : 'neutral'}
          trendDirection={period === 'all' ? 'neutral' : lucroPerc > 0 ? 'up' : lucroPerc < 0 ? 'down' : 'neutral'}
          trendValue={period === 'all' ? (lucro >= 0 ? 'Positivo' : 'Negativo') : formatPerc(lucroPerc)}
        />
        <StatCard
          title="A Receber"
          value={formatCurrency(aReceber)}
          trendColor="neutral"
          trendDirection="neutral"
          trendValue="Pedidos não pagos"
        />

        {/* Gráfico */}
        <div className="card chart-card">
          <h3 className="card-title">Fluxo de Caixa (Entradas vs Saídas)</h3>
          <div className="chart-container">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="entradas" stroke="#10b981" fillOpacity={0.15} fill="#10b981" name="Receita" />
                  <Area type="monotone" dataKey="saidas" stroke="#ef4444" fillOpacity={0.15} fill="#ef4444" name="Despesas" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                {loading ? 'Carregando gráfico...' : 'Sem dados suficientes para o gráfico no período.'}
              </div>
            )}
          </div>
        </div>

        {/* Contas a Pagar */}
        <div className="card" style={{ gridColumn: 'span 4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Contas a Pagar</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
            {bills.filter(b => !b.paid).length > 0 ? bills.filter(b => !b.paid).map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-primary)' }}>{b.name || b.title}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--danger-color)', fontWeight: 'bold' }}>{formatCurrency(Number(b.amount))}</p>
                </div>
                <button 
                  className="btn-primary" 
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => handlePayBill(b.id, b.name || b.title, Number(b.amount))}
                >
                  Pagar (Anexar)
                </button>
              </div>
            )) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>Nenhuma conta pendente.</p>
            )}
          </div>
        </div>

        {/* CRM e Alertas */}
        <div className="card" style={{ gridColumn: 'span 4' }}>
          <h3 className="card-title">CRM & Alertas de Clientes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
            {crmData.length > 0 ? crmData.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div style={{ 
                  color: item.type === 'unpaid' ? 'var(--danger-color)' : item.type === 'gift' ? 'var(--primary-color)' : 'orange'
                }}>
                  {item.type === 'unpaid' ? <AlertCircle size={20} /> : item.type === 'gift' ? <Gift size={20} /> : <Clock size={20} />}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-primary)' }}>{item.name}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>{item.reason}</p>
                </div>
              </div>
            )) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>Nenhum alerta de CRM no momento.</p>
            )}
          </div>
        </div>

        {/* Split container for Top Clientes and Metas */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ flex: 1 }}>
            <h3 className="card-title">Top Clientes</h3>
            <div className="customers-list">
              {topCustomers.length > 0 ? topCustomers.map((c, idx) => (
                <div key={idx} className="customer-item" style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span className="customer-name" style={{ color: idx < 3 ? 'var(--primary-color)' : 'var(--text-primary)', fontWeight: idx < 3 ? 'bold' : 'normal' }}>
                    {idx + 1}. {c.name}
                  </span>
                  <span className="customer-total">{formatCurrency(c.total)}</span>
                </div>
              )) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center' }}>Nenhum cliente com pedidos finalizados.</p>
              )}
            </div>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px', margin: 0 }}>
                Meta de Vendas — {format(targetGoalDate, 'MMMM', { locale: ptBR })}
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setGoalMonthOffset(prev => prev - 1)}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-primary)' }}
                >
                  &lt;
                </button>
                <button 
                  onClick={() => setGoalMonthOffset(prev => prev + 1)}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: 'var(--text-primary)' }}
                >
                  &gt;
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }} className="transfers-list-scrollable">
              {products.filter(p => Number(p.monthlyGoal) > 0).length > 0 ? (
                products.filter(p => Number(p.monthlyGoal) > 0).map(p => {
                  const sold = currentMonthSales[p.name] || 0;
                  const goal = Number(p.monthlyGoal);
                  const remaining = Math.max(0, goal - sold);
                  const perc = Math.round((sold / goal) * 100);
                  
                  return (
                    <div key={p.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{p.name}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {sold} / {goal} {perc > 100 ? `— ${perc}%` : ''}
                        </span>
                      </div>
                      
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${Math.min(perc, 100)}%`, 
                          backgroundColor: perc >= 100 ? 'var(--success-color)' : 'var(--primary-color)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      
                      <div style={{ fontSize: '12px', color: perc >= 100 ? 'var(--success-color)' : 'var(--text-secondary)', fontWeight: perc >= 100 ? 600 : 500 }}>
                        {perc >= 100 ? 'Meta atingida ✓' : `Restam ${remaining}`}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', margin: '20px 0' }}>Nenhuma meta definida nos produtos.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
