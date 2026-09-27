import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Edit2, Trash2, Search, Tag } from 'lucide-react';

export default function Cupons() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'coupons'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      setCoupons(docs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const openModal = (coupon?: any) => {
    if (coupon) {
      setEditingId(coupon.id);
      setCode(coupon.code || '');
      setDiscountType(coupon.discountType || 'percent');
      setDiscountValue(String(coupon.discountValue || '0').replace('.', ','));
      setIsActive(coupon.isActive ?? true);
    } else {
      setEditingId(null);
      setCode('');
      setDiscountType('percent');
      setDiscountValue('');
      setIsActive(true);
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !code.trim()) return;

    setIsSubmitting(true);
    const parsedValue = parseFloat(discountValue.replace(',', '.')) || 0;
    const formattedCode = code.trim().toUpperCase();

    try {
      if (editingId) {
        await updateDoc(doc(db, 'coupons', editingId), {
          code: formattedCode,
          discountType,
          discountValue: parsedValue,
          isActive,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'coupons'), {
          userId: user.uid,
          code: formattedCode,
          discountType,
          discountValue: parsedValue,
          isActive,
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      showAlert('Erro ao salvar cupom.', 'Erro', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    showConfirm('Tem certeza que deseja excluir este cupom?', async () => {
      try {
        await deleteDoc(doc(db, 'coupons', id));
      } catch (err) {
        console.error(err);
        showAlert('Erro ao excluir cupom.', 'Erro', 'error');
      }
    }, 'Excluir Cupom');
  };

  const filteredCoupons = coupons.filter(c => 
    (c.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Cupons de Desconto</h2>
          <p className="page-subtitle">Gerencie os cupons promocionais para os clientes.</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          + Novo Cupom
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Buscar cupom pelo código..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Carregando cupons...</p>
        ) : filteredCoupons.length > 0 ? (
          <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }} className="transfers-list-scrollable">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Código</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Desconto</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, width: '100px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 12px', fontWeight: 600, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tag size={16} /> {c.code}
                    </td>
                    <td style={{ padding: '16px 12px', fontWeight: 500 }}>
                      {c.discountType === 'percent' ? `${c.discountValue}%` : `€ ${(Number(c.discountValue) || 0).toFixed(2).replace('.', ',')}`}
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '12px', 
                        fontWeight: 600,
                        backgroundColor: c.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: c.isActive ? '#10b981' : '#ef4444'
                      }}>
                        {c.isActive ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '6px' }}
                          onClick={() => openModal(c)}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '6px', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                          onClick={() => handleDelete(c.id)}
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum cupom encontrado.</p>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>
              {editingId ? 'Editar Cupom' : 'Novo Cupom'}
            </h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label className="form-label">Código do Cupom</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="Ex: PROMO10"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Tipo</label>
                  <select 
                    className="form-input" 
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value)}
                  >
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Fixo (€)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Valor</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'percent' ? "Ex: 10" : "Ex: 5,00"}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input 
                    type="checkbox" 
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  Cupom Ativo
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
