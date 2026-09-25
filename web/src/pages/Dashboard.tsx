import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { format, subMonths, isSameMonth, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const StatCard = ({ title, value, trend, trendValue }: { title: string, value: string, trend: 'up' | 'down', trendValue: string }) => (
  <div className="card stat-card">
    <h3 className="card-title">{title}</h3>
    <div className="stat-value">{value}</div>
    <div className="stat-trend">
      {trend === 'up' ? (
        <span className="trend-up"><ArrowUpRight size={16} /> {trendValue}</span>
      ) : (
        <span className="trend-down"><ArrowDownRight size={16} /> {trendValue}</span>
      )}
      <span className="trend-label">em relação ao mês passado</span>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [dinheiroCaixa, setDinheiroCaixa] = useState(0);
  const [entradasMes, setEntradasMes] = useState(0);
  const [despesasMes, setDespesasMes] = useState(0);
  
  const [entradasMesAnterior, setEntradasMesAnterior] = useState(0);
  const [despesasMesAnterior, setDespesasMesAnterior] = useState(0);
  const [caixaMesAnterior, setCaixaMesAnterior] = useState(0);

  const [chartData, setChartData] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<{name: string, total: number}[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [caixinhas, setCaixinhas] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'events'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(docs);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'caixinhas'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || 0;
        return tA - tB;
      });
      setCaixinhas(docs);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const qOrders = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const customersMap: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'canceled' || data.status === 'unpaid') return;
        const cName = data.clientName?.trim();
        if (cName && cName.toLowerCase() !== 'cliente' && !cName.toLowerCase().startsWith('mesa')) {
          customersMap[cName] = (customersMap[cName] || 0) + (data.total || 0);
        }
      });
      const customersList = Object.keys(customersMap).map(k => ({ name: k, total: customersMap[k] }));
      customersList.sort((a, b) => b.total - a.total);
      setTopCustomers(customersList.slice(0, 5));
    });
    return unsubOrders;
  }, [user]);

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
      const lastMonth = subMonths(now, 1);

      let caixaAtual = 0;
      let entradasAtual = 0;
      let despesasAtual = 0;

      let entradasPassadas = 0;
      let despesasPassadas = 0;

      const monthlyData: Record<string, { name: string, dateObj: Date, entradas: number, saidas: number }> = {};

      docs.forEach((t: any) => {
        const val = Number(t.value) || 0;
        const isIncome = t.type === 'in';
        
        const date = t.createdAt?.toDate?.() || new Date();
        const monthKey = format(date, 'MMM yy', { locale: ptBR });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { name: monthKey, dateObj: date, entradas: 0, saidas: 0 };
        }
        
        if (isIncome) {
          caixaAtual += val;
          monthlyData[monthKey].entradas += val;
          if (isSameMonth(date, now)) entradasAtual += val;
          else if (isSameMonth(date, lastMonth)) entradasPassadas += val;
        } else {
          caixaAtual -= val;
          monthlyData[monthKey].saidas += val;
          if (isSameMonth(date, now)) despesasAtual += val;
          else if (isSameMonth(date, lastMonth)) despesasPassadas += val;
        }
      });

      const caixaPassado = caixaAtual - entradasAtual + despesasAtual;

      setDinheiroCaixa(caixaAtual);
      setEntradasMes(entradasAtual);
      setDespesasMes(despesasAtual);
      
      setEntradasMesAnterior(entradasPassadas);
      setDespesasMesAnterior(despesasPassadas);
      setCaixaMesAnterior(caixaPassado);

      const chartArr = Object.values(monthlyData).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
      
      // If we only have one point, make it look a bit better or just keep it
      setChartData(chartArr);

      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    
    return unsub;
  }, [user]);

  const calcTrend = (current: number, past: number) => {
    if (Math.abs(past) < 0.01) {
      if (current > 0.01) return { trend: 'up' as const, value: '+100,00%' };
      if (current < -0.01) return { trend: 'down' as const, value: '-100,00%' };
      return { trend: 'up' as const, value: '0,00%' };
    }
    const percent = ((current - past) / Math.abs(past)) * 100;
    const formattedPercent = Math.abs(percent).toLocaleString('pt-PT', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2 
    }) + '%';
    return {
      trend: percent >= 0 ? 'up' as const : 'down' as const,
      value: `${percent >= 0 ? '+' : '-'}${formattedPercent}`
    };
  };

  const trendCaixa = calcTrend(dinheiroCaixa, caixaMesAnterior);
  const trendEntradas = calcTrend(entradasMes, entradasMesAnterior);
  const trendDespesas = calcTrend(despesasMes, despesasMesAnterior);

  const formatCurrency = (val: number) => `€ ${val.toFixed(2).replace('.', ',')}`;

  const handleAddMoneyToCaixinha = async (caixinha: any) => {
    const amountStr = window.prompt(`Quanto deseja depositar na caixinha "${caixinha.name}"?`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return alert('Valor inválido');

    try {
      const caixinhaRef = doc(db, 'caixinhas', caixinha.id);
      await updateDoc(caixinhaRef, {
        current: (Number(caixinha.current) || 0) + amount
      });
    } catch(e) {
      console.error(e);
      alert('Erro ao depositar valor.');
    }
  };

  const now = startOfDay(new Date());
  const upcomingEvents = events
    .filter(ev => ev.date && ev.date.toDate() >= now)
    .sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime())
    .slice(0, 3);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Visão Geral</h2>
        <p className="page-subtitle">Acompanhe os principais indicadores da pastelaria.</p>
      </div>

      <div className="dashboard-grid">
        <StatCard
          title="Dinheiro no Caixa (Geral)"
          value={formatCurrency(dinheiroCaixa)}
          trend={trendCaixa.trend}
          trendValue={trendCaixa.value}
        />
        <StatCard
          title="Despesas (Este Mês)"
          value={formatCurrency(despesasMes)}
          trend={trendDespesas.trend === 'up' ? 'down' : 'up'}
          trendValue={trendDespesas.value}
        />
        <StatCard
          title="Dinheiro que Entrou (Este Mês)"
          value={formatCurrency(entradasMes)}
          trend={trendEntradas.trend}
          trendValue={trendEntradas.value}
        />

        <div className="card chart-card">
          <h3 className="card-title">Fluxo de Caixa Mensal (Entradas vs Saídas)</h3>
          <div className="chart-container">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a' }}
                    itemStyle={{ color: '#0f172a' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="entradas" stroke="#10b981" fillOpacity={0.15} fill="#10b981" name="Entradas" />
                  <Area type="monotone" dataKey="saidas" stroke="#ef4444" fillOpacity={0.15} fill="#ef4444" name="Saídas" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                {loading ? 'Carregando gráfico...' : 'Sem dados suficientes para o gráfico.'}
              </div>
            )}
          </div>
        </div>

        <div className="card caixinhas-card">
          <h3 className="card-title">Objetivos (Caixinhas)</h3>
          <div className="caixinhas-list">
            {caixinhas.length > 0 ? caixinhas.map((caixinha, idx) => {
              const target = Number(caixinha.target) || 0;
              const current = Number(caixinha.current) || 0;
              const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
              return (
                <div key={caixinha.id || idx} className="caixinha-item">
                  <div className="caixinha-header">
                    <span className="caixinha-name">{caixinha.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="caixinha-value">€ {current.toFixed(2).replace('.', ',')} / € {target.toFixed(2).replace('.', ',')}</span>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '2px 6px', fontSize: '12px', minWidth: 'auto', border: '1px solid var(--accent-color)', color: 'var(--accent-color)' }} 
                        onClick={() => handleAddMoneyToCaixinha(caixinha)}
                        title="Depositar"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            }) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Nenhuma caixinha criada ainda.</p>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="card customers-card">
          <h3 className="card-title">Top Clientes</h3>
          <div className="customers-list">
            {topCustomers.length > 0 ? (
              <>
                <div className="podium-container">
                  {topCustomers[1] && (
                    <div className="podium-step podium-rank-2">
                      <div className="podium-info">
                        <div className="podium-name">{topCustomers[1].name}</div>
                        <div className="podium-value">{formatCurrency(topCustomers[1].total)}</div>
                      </div>
                      <div className="podium-bar">2</div>
                    </div>
                  )}
                  {topCustomers[0] && (
                    <div className="podium-step podium-rank-1">
                      <div className="podium-info">
                        <div className="podium-name" style={{ color: '#d97706' }}>{topCustomers[0].name}</div>
                        <div className="podium-value">{formatCurrency(topCustomers[0].total)}</div>
                      </div>
                      <div className="podium-bar">1</div>
                    </div>
                  )}
                  {topCustomers[2] && (
                    <div className="podium-step podium-rank-3">
                      <div className="podium-info">
                        <div className="podium-name">{topCustomers[2].name}</div>
                        <div className="podium-value">{formatCurrency(topCustomers[2].total)}</div>
                      </div>
                      <div className="podium-bar">3</div>
                    </div>
                  )}
                </div>
                {topCustomers.slice(3, 5).map((c, idx) => (
                  <div key={idx} className="customer-item">
                    <span className="customer-name">{idx + 4}. {c.name}</span>
                    <span className="customer-total">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhum cliente registrado nos pedidos.</p>
            )}
          </div>
        </div>

        <div className="card events-card">
          <h3 className="card-title">Próximos Eventos</h3>
          <div className="events-list">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((ev) => {
                const dateObj = ev.date.toDate();
                return (
                  <div key={ev.id} className="event-item">
                    <div className="event-date">
                      <span className="event-day">{format(dateObj, 'd')}</span>
                      <span className="event-month" style={{ textTransform: 'capitalize' }}>
                        {format(dateObj, 'MMM', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="event-info">
                      <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{ev.title}</h4>
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Nenhum evento futuro agendado.</p>
            )}
          </div>
        </div>

        <div className="card transfers-card" style={{ gridColumn: 'span 12' }}>
          <h3 className="card-title">Histórico de Transferências Recentes</h3>
          <div className="transfers-list">
            {loading ? <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p> : transfers.slice(0, 10).map((t) => {
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
                      <p>{dateStr}</p>
                    </div>
                  </div>
                  <div className={`transfer-amount ${isIncome ? 'income' : 'expense'}`}>
                    {isIncome ? '+' : '-'} {formatCurrency(Number(t.value))}
                  </div>
                </div>
              );
            })}
            {!loading && transfers.length === 0 && (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma transferência encontrada.</p>
            )}
            {!loading && transfers.length > 0 && (
              <Link to="/caixa" className="btn-more">Ver mais</Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
