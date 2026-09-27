import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function Anexos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'cashflow'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filtrar apenas as que tem comprovante
      const withReceipts = docs.filter((d: any) => d.receiptUrls && d.receiptUrls.length > 0);
      withReceipts.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis?.() || 0;
        const tB = b.createdAt?.toMillis?.() || 0;
        return tB - tA;
      });
      setTransfers(withReceipts);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="btn-secondary" onClick={() => navigate('/caixa')} style={{ padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="page-title">Anexos e Comprovantes</h2>
          <p className="page-subtitle">Todos os comprovantes de transferências e pagamentos.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Carregando comprovantes...</p>
          ) : transfers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <ImageIcon size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>Nenhum comprovante anexado até o momento.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
              {transfers.map(t => {
                const dateObj = t.createdAt?.toDate?.();
                const dateStr = dateObj ? format(dateObj, "dd/MM/yyyy HH:mm") : 'Sem data';
                return (
                  <div key={t.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-secondary)' }}>
                    <div style={{ height: '150px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={t.receiptUrls[0]} alt="Comprovante" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '16px' }}>
                      <p style={{ fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>{dateStr}</p>
                      <a href={t.receiptUrls[0]} target="_blank" rel="noreferrer" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                        Ver Original <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
