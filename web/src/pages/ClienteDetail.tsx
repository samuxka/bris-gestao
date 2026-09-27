import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { ArrowLeft, Phone, MapPin, Star, Gift, ShoppingBag, DollarSign, Mail, Clock } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { format } from 'date-fns';

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [client, setClient] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;

    const fetchClient = async () => {
      try {
        const clientRef = doc(db, 'clients', id);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists() && clientSnap.data().userId === user.uid) {
          setClient({ id: clientSnap.id, ...clientSnap.data() });
        } else {
          showAlert('Cliente não encontrado.', 'Erro', 'error');
          navigate('/clientes');
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchClient();
  }, [id, user]);

  useEffect(() => {
    if (!user || !client?.name) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      where('clientName', '==', client.name)
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || 0;
        return tB - tA; // Decrescente
      });
      setOrders(docs);
      setLoading(false);
    });

    return unsub;
  }, [user, client?.name]);

  if (loading || !client) {
    return <div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Carregando dados do cliente...</div>;
  }

  // Apenas pedidos concluídos/pagos (done) contam para o fidelidade e total gasto
  const doneOrders = orders.filter(o => o.status === 'done');
  const totalGasto = doneOrders.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  
  const loyaltyTarget = 10;
  const currentFidelityPoints = doneOrders.length % loyaltyTarget;
  const faltamParaBrinde = loyaltyTarget - currentFidelityPoints;
  const totalBrindesGanhos = Math.floor(doneOrders.length / loyaltyTarget);

  const formatCurrency = (val: number) => `€ ${val.toFixed(2).replace('.', ',')}`;

  const sendAlertEmail = async () => {
    // Configurações do EmailJS (Esses valores precisam ser preenchidos pelo dono no site do emailjs.com)
    const serviceId = import.meta.env.VITE_SERVICE_ID;
    const templateId = import.meta.env.VITE_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_PUBLIC_KEY;
    
    if (!serviceId || !templateId || !publicKey) {
      showAlert('Você precisa configurar as credenciais do EmailJS no arquivo .env (VITE_SERVICE_ID, etc) para enviar emails.', 'Configuração Necessária', 'warning');
      return;
    }

    try {
      await emailjs.send(serviceId, templateId, {
        client_name: client.name,
        client_phone: client.phone || 'Não informado',
        message: `O cliente ${client.name} atingiu ${doneOrders.length} pedidos e falta 1 para ganhar o brinde!`
      }, publicKey);
      showAlert('Email de alerta enviado com sucesso!', 'Enviado', 'success');
    } catch (error) {
      console.error(error);
      showAlert('Falha ao enviar email.', 'Erro', 'error');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
        <button className="btn-secondary" onClick={() => navigate('/clientes')} style={{ padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="page-title" style={{ marginBottom: '4px' }}>{client.name}</h2>
          <p className="page-subtitle">Perfil e Cartão Fidelidade</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Client Info */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Informações</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Phone size={18} />
              <span>{client.phone || 'Sem telefone'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <MapPin size={18} />
              <span>{client.address || 'Sem endereço'}</span>
            </div>
            {client.notes && (
              <div style={{ marginTop: '8px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                <strong>Observações:</strong><br />
                {client.notes}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Estatísticas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
              <ShoppingBag size={24} style={{ color: 'var(--primary-color)', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{doneOrders.length}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Pedidos Feitos</div>
            </div>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
              <DollarSign size={24} style={{ color: 'var(--success-color)', margin: '0 auto 8px' }} />
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{formatCurrency(totalGasto)}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total Gasto</div>
            </div>
          </div>
        </div>

        {/* Cartão Fidelidade */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Star size={20} color="var(--primary-color)" fill="var(--primary-color)" />
              Cartão Fidelidade
            </h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Brindes resgatados: <strong style={{ color: 'var(--primary-color)' }}>{totalBrindesGanhos}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '32px' }}>
            {Array.from({ length: loyaltyTarget }).map((_, i) => {
              // se faltamParaBrinde === 0 significa que atingiu o decimo pedido e o circulo vai ficar verde para mostrar. Mas a matemática (N % 10) daria 0, resetando.
              // Então precisamos tratar visualmente: se faltamParaBrinde === 10 (ou seja currentFidelityPoints === 0), mas o total > 0, significa que acabou de bater o 10º (ou 20º, etc), e o cartão estaria "zerado".
              // Para ficar melhor visualmente, se faltamParaBrinde === 10, e a pessoa ainda n resgatou, pode ser q o currentFidelityPoints fique 0. Mas ok, isFilled handle isso:
              let filled = false;
              if (currentFidelityPoints === 0 && doneOrders.length > 0) {
                 filled = true; // Mostra tudo cheio até resgatar (mas na real a gente n tem state de "resgatado" além dos multiplos de 10)
              } else {
                 filled = i < currentFidelityPoints;
              }

              const isGiftBox = i === loyaltyTarget - 1;
              
              return (
                <div key={i} style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: filled ? 'var(--primary-color)' : 'var(--bg-secondary)',
                  border: filled ? 'none' : '2px dashed var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s'
                }}>
                  {filled ? (
                    <Star size={28} color="#fff" fill="#fff" />
                  ) : isGiftBox ? (
                    <Gift size={28} color="var(--text-secondary)" />
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '18px' }}>{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', padding: '16px', backgroundColor: faltamParaBrinde === 1 ? 'rgba(255, 165, 0, 0.1)' : 'var(--bg-secondary)', borderRadius: '12px', border: faltamParaBrinde === 1 ? '1px solid orange' : 'none' }}>
            {faltamParaBrinde === 1 ? (
              <>
                <p style={{ color: 'orange', fontWeight: 'bold', fontSize: '18px', marginBottom: '12px' }}>
                  Atenção: Falta apenas 1 pedido para o brinde!
                </p>
                <button className="btn-primary" onClick={sendAlertEmail} style={{ backgroundColor: 'orange', borderColor: 'orange', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={18} />
                  Enviar Alerta por Email
                </button>
              </>
            ) : currentFidelityPoints === 0 && doneOrders.length > 0 ? (
              <p style={{ color: 'var(--success-color)', fontWeight: 'bold', fontSize: '18px' }}>
                🎉 O cliente completou o cartão e tem direito a um brinde!
              </p>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                Faltam <strong>{faltamParaBrinde}</strong> pedidos para o próximo brinde.
              </p>
            )}
          </div>
        </div>

        {/* Histórico de Pedidos */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Clock size={20} color="var(--text-secondary)" />
            <h3 style={{ fontSize: '18px', margin: 0 }}>Histórico de Pedidos</h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            {orders.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Data e Hora</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Itens</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => {
                    const dateObj = order.createdAt?.toDate?.();
                    const isDone = order.status === 'done';
                    const isCanceled = order.status === 'canceled';
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px 12px' }}>
                          {dateObj ? format(dateObj, 'dd/MM/yyyy HH:mm') : '-'}
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{
                            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                            backgroundColor: isDone ? 'rgba(16, 185, 129, 0.1)' : isCanceled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: isDone ? '#10b981' : isCanceled ? '#ef4444' : '#f59e0b'
                          }}>
                            {isDone ? 'Concluído/Pago' : isCanceled ? 'Cancelado' : 'Pendente'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>
                          {(order.items || []).map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
                        </td>
                        <td style={{ padding: '16px 12px', fontWeight: 'bold' }}>
                          {formatCurrency(Number(order.total))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>Nenhum pedido encontrado.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
