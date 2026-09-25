import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Edit2, Trash2, Search, AlertTriangle, Plus, Minus } from 'lucide-react';

const CATEGORIES = ['Ingredientes', 'Bebidas', 'Embalagens', 'Outros'];
const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'caixa', 'pacote'];

export default function Estoque() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [quantity, setQuantity] = useState('0');
  const [unit, setUnit] = useState(UNITS[0]);
  const [minQuantity, setMinQuantity] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'inventory'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setItems(docs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const openModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setName(item.name || '');
      setCategory(item.category || CATEGORIES[0]);
      setQuantity(String(item.quantity || 0));
      setUnit(item.unit || UNITS[0]);
      setMinQuantity(String(item.minQuantity || 0));
    } else {
      setEditingId(null);
      setName('');
      setCategory(CATEGORIES[0]);
      setQuantity('');
      setUnit(UNITS[0]);
      setMinQuantity('');
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setIsSubmitting(true);
    const parsedQty = parseFloat(quantity.replace(',', '.')) || 0;
    const parsedMin = parseFloat(minQuantity.replace(',', '.')) || 0;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'inventory', editingId), {
          name: name.trim(),
          category,
          quantity: parsedQty,
          unit,
          minQuantity: parsedMin,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'inventory'), {
          userId: user.uid,
          name: name.trim(),
          category,
          quantity: parsedQty,
          unit,
          minQuantity: parsedMin,
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este item do estoque?')) {
      try {
        await deleteDoc(doc(db, 'inventory', id));
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir item.');
      }
    }
  };

  const handleAdjustQuantity = async (id: string, currentQty: number, change: number) => {
    const newQty = Math.max(0, currentQty + change);
    try {
      await updateDoc(doc(db, 'inventory', id), {
        quantity: newQty,
        updatedAt: serverTimestamp()
      });
    } catch(err) {
      console.error(err);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory ? item.category === filterCategory : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="page-title">Estoque</h2>
          <p className="page-subtitle">Controle de ingredientes e produtos.</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          + Novo Item
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar item..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', minWidth: '150px' }}
          >
            <option value="">Todas Categorias</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Carregando estoque...</p>
        ) : filteredItems.length > 0 ? (
          <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }} className="transfers-list-scrollable">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Nome</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Categoria</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Quantidade</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, width: '120px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const qty = Number(item.quantity) || 0;
                  const minQty = Number(item.minQuantity) || 0;
                  const isLowStock = qty <= minQty;
                  
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isLowStock ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                      <td style={{ padding: '16px 12px', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.name}
                          {isLowStock && <span title="Estoque Baixo"><AlertTriangle size={16} color="var(--danger-color)" /></span>}
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {item.category}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button onClick={() => handleAdjustQuantity(item.id, qty, -1)} style={{ width: '28px', height: '28px', borderRadius: '14px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
                            <Minus size={14} />
                          </button>
                          <span style={{ fontWeight: 600, minWidth: '40px', textAlign: 'center', color: isLowStock ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                            {qty} {item.unit}
                          </span>
                          <button onClick={() => handleAdjustQuantity(item.id, qty, 1)} style={{ width: '28px', height: '28px', borderRadius: '14px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}>
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', display: 'flex', gap: '8px' }}>
                        <button onClick={() => openModal(item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-color)', padding: '6px' }} title="Editar">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger-color)', padding: '6px' }} title="Excluir">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
            Nenhum item encontrado no estoque.
          </p>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">{editingId ? 'Editar Item' : 'Novo Item'}</h3>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Nome do Produto/Ingrediente *</label>
                <input 
                  type="text"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Queijo Muçarela"
                />
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Categoria</label>
                  <select 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Unidade</label>
                  <select 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Qtd Atual</label>
                  <input 
                    type="text"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Alerta de Estoque Mínimo</label>
                  <input 
                    type="text"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
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
