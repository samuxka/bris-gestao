import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { Edit2, Trash2, Search } from 'lucide-react';

export default function Produtos() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [flavors, setFlavors] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'products'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setProducts(docs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const openModal = (product?: any) => {
    if (product) {
      setEditingId(product.id);
      setName(product.name || '');
      setPrice(String(product.price || '0').replace('.', ','));
      setFlavors(product.flavors ? product.flavors.join(', ') : '');
      setDescription(product.description || '');
    } else {
      setEditingId(null);
      setName('');
      setPrice('');
      setFlavors('');
      setDescription('');
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setIsSubmitting(true);
    const parsedPrice = parseFloat(price.replace(',', '.')) || 0;
    const parsedFlavors = flavors.split(',').map(f => f.trim()).filter(f => f);

    try {
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), {
          name: name.trim(),
          price: parsedPrice,
          flavors: parsedFlavors,
          description: description.trim(),
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'products'), {
          userId: user.uid,
          name: name.trim(),
          price: parsedPrice,
          flavors: parsedFlavors,
          description: description.trim(),
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar produto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto do cardápio?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir produto.');
      }
    }
  };

  const filteredProducts = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Produtos (Cardápio)</h2>
          <p className="page-subtitle">Gerencie os produtos e preços vendidos na pastelaria.</p>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>
          + Novo Produto
        </button>
      </div>

      <div className="card">
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Buscar produto pelo nome..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Carregando produtos...</p>
        ) : filteredProducts.length > 0 ? (
          <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }} className="transfers-list-scrollable">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Nome</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Preço (€)</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Sabores</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Descrição</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, width: '100px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 12px', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '16px 12px', fontWeight: 600, color: 'var(--accent-color)' }}>
                      € {(Number(p.price) || 0).toFixed(2).replace('.', ',')}
                    </td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>
                      {p.flavors && p.flavors.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {p.flavors.map((f: string, i: number) => (
                            <span key={i} style={{ padding: '2px 8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '0.75rem' }}>{f}</span>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>{p.description || '-'}</td>
                    <td style={{ padding: '16px 12px', display: 'flex', gap: '8px' }}>
                      <button onClick={() => openModal(p)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-color)' }} title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger-color)' }} title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
            Nenhum produto cadastrado.
          </p>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Nome *</label>
                <input 
                  type="text"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Pastel de Carne"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Preço (€) *</label>
                <input 
                  type="text"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ex: 2,50"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Sabores (opcional)</label>
                <input 
                  type="text"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={flavors}
                  onChange={(e) => setFlavors(e.target.value)}
                  placeholder="Ex: Frango, Carne, Queijo (separe por vírgulas)"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Descrição (opcional)</label>
                <textarea 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', minHeight: '60px' }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes ou ingredientes do produto..."
                />
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
