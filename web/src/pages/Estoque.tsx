import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Edit2, Trash2, Search, AlertTriangle, Plus, Minus, History, ArrowRight } from 'lucide-react';

const CATEGORIES = ['Ingredientes', 'Embalagens', 'Outros'];
const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'caixa', 'pacote'];

export default function Estoque() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();
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
  const [weightPerUnit, setWeightPerUnit] = useState('');
  const [minQuantity, setMinQuantity] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Edit State
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineQuantity, setInlineQuantity] = useState('');

  // Movement Modal State
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'IN'|'OUT'>('IN');
  const [movementItem, setMovementItem] = useState<any>(null);
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementObservation, setMovementObservation] = useState('');
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyItem, setHistoryItem] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
      setWeightPerUnit(item.weightPerUnit ? String(item.weightPerUnit).replace('.', ',') : '');
      setMinQuantity(String(item.minQuantity || 0));
    } else {
      setEditingId(null);
      setName('');
      setCategory(CATEGORIES[0]);
      setQuantity('');
      setUnit(UNITS[0]);
      setWeightPerUnit('');
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
    const parsedWeightPerUnit = parseFloat(weightPerUnit.replace(',', '.')) || 0;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'inventory', editingId), {
          name: name.trim(),
          category,
          quantity: parsedQty,
          unit,
          weightPerUnit: parsedWeightPerUnit,
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
          weightPerUnit: parsedWeightPerUnit,
          minQuantity: parsedMin,
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      showAlert('Erro ao salvar item.', 'Erro', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    showConfirm('Tem certeza que deseja excluir este item do estoque?', async () => {
      try {
        await deleteDoc(doc(db, 'inventory', id));
      } catch (err) {
        console.error(err);
        showAlert('Erro ao excluir item.', 'Erro', 'error');
      }
    }, 'Excluir Item');
  };

  const handleAdjustQuantity = async (id: string, currentQty: number, change: number, itemName: string) => {
    const newQty = Math.max(0, currentQty + change);
    if (newQty === currentQty) return;

    const type = change > 0 ? 'IN' : 'OUT';
    const absChange = Math.abs(currentQty - newQty);

    try {
      if (user?.uid) {
        await addDoc(collection(db, 'inventory_movements'), {
          userId: user.uid,
          itemId: id,
          itemName,
          type,
          quantityChange: absChange,
          previousQuantity: currentQty,
          newQuantity: newQty,
          observation: 'Ajuste rápido',
          createdAt: serverTimestamp()
        });
      }
      await updateDoc(doc(db, 'inventory', id), {
        quantity: newQty,
        updatedAt: serverTimestamp()
      });
    } catch(err) {
      console.error(err);
    }
  };

  const startInlineEdit = (id: string, qty: number) => {
    setInlineEditingId(id);
    setInlineQuantity(String(qty));
  };

  const handleInlineSave = async (id: string, currentQty: number, itemName: string) => {
    const parsedQty = parseFloat(inlineQuantity.replace(',', '.')) || 0;
    const newQty = Math.max(0, parsedQty);
    
    if (newQty !== currentQty) {
      try {
        if (user?.uid) {
          try {
            await addDoc(collection(db, 'inventory_movements'), {
              userId: user.uid,
              itemId: id,
              itemName,
              type: 'CORRECTION',
              quantityChange: Math.abs(newQty - currentQty),
              previousQuantity: currentQty,
              newQuantity: newQty,
              observation: 'Correção manual do estoque',
              createdAt: serverTimestamp()
            });
          } catch (movementErr) {
            console.warn('Falha no log.', movementErr);
          }
        }
        await updateDoc(doc(db, 'inventory', id), {
          quantity: newQty,
          updatedAt: serverTimestamp()
        });
      } catch(err) {
        console.error(err);
      }
    }
    setInlineEditingId(null);
  };

  const openMovementModal = (item: any, type: 'IN' | 'OUT') => {
    setMovementItem(item);
    setMovementType(type);
    setMovementQuantity('');
    setMovementObservation('');
    setShowMovementModal(true);
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !movementItem) return;
    
    const parsedQty = parseFloat(movementQuantity.replace(',', '.')) || 0;
    if (parsedQty <= 0) return;

    setIsSubmittingMovement(true);
    
    const currentQty = Number(movementItem.quantity) || 0;
    const newQty = movementType === 'IN' ? currentQty + parsedQty : currentQty - parsedQty;

    if (newQty < 0) {
      showAlert('A quantidade em estoque não pode ficar negativa.', 'Atenção', 'warning');
      setIsSubmittingMovement(false);
      return;
    }

    try {
      try {
        await addDoc(collection(db, 'inventory_movements'), {
          userId: user.uid,
          itemId: movementItem.id,
          itemName: movementItem.name,
          type: movementType,
          quantityChange: parsedQty,
          previousQuantity: currentQty,
          newQuantity: newQty,
          observation: movementObservation.trim(),
          createdAt: serverTimestamp()
        });
      } catch (movementErr) {
        console.warn('Não foi possível salvar o histórico de movimentação. Verifique as regras do Firestore para inventory_movements.', movementErr);
      }

      await updateDoc(doc(db, 'inventory', movementItem.id), {
        quantity: newQty,
        updatedAt: serverTimestamp()
      });

      setShowMovementModal(false);
    } catch (err) {
      console.error(err);
      showAlert('Erro ao registrar movimentação.', 'Erro', 'error');
    } finally {
      setIsSubmittingMovement(false);
    }
  };

  const openHistoryModal = async (item: any) => {
    setHistoryItem(item);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    setHistory([]);
    
    try {
      const q = query(
        collection(db, 'inventory_movements'), 
        where('itemId', '==', item.id)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setHistory(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
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
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Movimentação</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, width: '100px' }}>Ações</th>
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
                          <button onClick={() => handleAdjustQuantity(item.id, qty, -1, item.name)} style={{ width: '28px', height: '28px', borderRadius: '14px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0 }}>
                            <Minus size={14} />
                          </button>
                          
                          {inlineEditingId === item.id ? (
                            <input
                              type="number"
                              value={inlineQuantity}
                              onChange={(e) => setInlineQuantity(e.target.value)}
                              onBlur={() => handleInlineSave(item.id, qty, item.name)}
                              onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(item.id, qty, item.name)}
                              autoFocus
                              style={{ width: '60px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid var(--accent-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
                            />
                          ) : (
                            <span onClick={() => startInlineEdit(item.id, qty)} style={{ fontWeight: 600, minWidth: '40px', textAlign: 'center', cursor: 'pointer', color: isLowStock ? 'var(--danger-color)' : 'var(--text-primary)', padding: '4px' }} title="Clique para corrigir manualmente">
                              {qty} {item.weightPerUnit > 0 ? 'un' : item.unit}
                            </span>
                          )}

                          <button onClick={() => handleAdjustQuantity(item.id, qty, 1, item.name)} style={{ width: '28px', height: '28px', borderRadius: '14px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0 }}>
                            <Plus size={14} />
                          </button>
                        </div>
                        {item.weightPerUnit > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
                            Total: {(qty * item.weightPerUnit).toLocaleString('pt-BR')} {item.unit}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => openMovementModal(item, 'IN')} style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--success-color)', color: 'var(--success-color)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}>
                            + Entrada
                          </button>
                          <button onClick={() => openMovementModal(item, 'OUT')} style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold' }}>
                            − Saída
                          </button>
                          <button onClick={() => openHistoryModal(item)} style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <History size={14} /> Histórico
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

      {/* Modal de Movimentação */}
      {showMovementModal && movementItem && (
        <div className="modal-overlay" onClick={() => setShowMovementModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 className="card-title">
              {movementType === 'IN' ? 'Registrar Entrada' : 'Registrar Saída'}
            </h3>
            <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
              Produto: <strong>{movementItem.name}</strong><br/>
              Estoque Atual: {movementItem.quantity} {movementItem.weightPerUnit > 0 ? 'un' : movementItem.unit}
            </p>
            <form onSubmit={handleSaveMovement}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Quantidade ({movementItem.weightPerUnit > 0 ? 'Unidades' : movementItem.unit}) *</label>
                <input 
                  type="text"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={movementQuantity}
                  onChange={(e) => setMovementQuantity(e.target.value)}
                  placeholder="Ex: 5"
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Observação (Opcional)</label>
                <input 
                  type="text"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={movementObservation}
                  onChange={(e) => setMovementObservation(e.target.value)}
                  placeholder="Ex: Lote recebido hoje / Uso na produção"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowMovementModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmittingMovement} className="btn-primary" style={{ backgroundColor: movementType === 'IN' ? 'var(--success-color)' : 'var(--danger-color)' }}>
                  {isSubmittingMovement ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Histórico */}
      {showHistoryModal && historyItem && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 className="card-title">Histórico de Movimentações</h3>
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
              Produto: <strong>{historyItem.name}</strong>
            </p>
            
            {loadingHistory ? (
              <p style={{ color: 'var(--text-secondary)' }}>Carregando histórico...</p>
            ) : history.length > 0 ? (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)' }}>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Data/Hora</th>
                      <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Tipo</th>
                      <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Qtd</th>
                      <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Estoque</th>
                      <th style={{ padding: '8px', color: 'var(--text-secondary)' }}>Obs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px' }}>
                          {h.createdAt ? new Date(h.createdAt.toMillis()).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '...'}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            fontSize: '0.75rem',
                            backgroundColor: h.type === 'IN' ? 'rgba(16, 185, 129, 0.1)' : h.type === 'OUT' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: h.type === 'IN' ? 'var(--success-color)' : h.type === 'OUT' ? 'var(--danger-color)' : '#f59e0b'
                          }}>
                            {h.type === 'IN' ? 'Entrada' : h.type === 'OUT' ? 'Saída' : 'Correção'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', fontWeight: 'bold', color: h.type === 'IN' ? 'var(--success-color)' : h.type === 'OUT' ? 'var(--danger-color)' : '#f59e0b' }}>
                          {h.type === 'IN' ? '+' : h.type === 'OUT' ? '-' : ''}{h.quantityChange}
                        </td>
                        <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                          {h.previousQuantity} <ArrowRight size={12} style={{ verticalAlign: 'middle', margin: '0 4px' }}/> {h.newQuantity}
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                          {h.observation || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>Nenhuma movimentação registrada.</p>
            )}
            
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button onClick={() => setShowHistoryModal(false)} className="btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Unidade (Medida)</label>
                  <select 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Peso/Volume por Unidade (Opcional)</label>
                <input 
                  type="text"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={weightPerUnit}
                  onChange={(e) => setWeightPerUnit(e.target.value)}
                  placeholder="Ex: 700 (Se deixar vazio, a quantidade será a própria unidade)"
                />
              </div>

              <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Qtd Atual (Unidades)</label>
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
