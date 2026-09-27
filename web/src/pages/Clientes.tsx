import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Edit2, Trash2, Search, Phone, MapPin } from 'lucide-react';

export default function Clientes() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const [clients, setClients] = useState<any[]>([]);
  const [ordersMap, setOrdersMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (val: number) => `€ ${val.toFixed(2).replace('.', ',')}`;

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportFromOrders = () => {
    if (!user) return;
    
    showConfirm('Deseja buscar todos os pedidos passados e importar os clientes que ainda não estão salvos?', async () => {
      setIsImporting(true);
      try {
        const qOrders = query(collection(db, 'orders'), where('userId', '==', user.uid));
        const snap = await getDocs(qOrders);
        
        const uniqueNames = new Set<string>();
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.status === 'canceled' || data.status === 'unpaid') return;
          const cName = data.clientName?.trim();
          if (cName && cName.toLowerCase() !== 'cliente' && !cName.toLowerCase().startsWith('mesa')) {
            uniqueNames.add(cName);
          }
        });

        // Filter out existing clients
        const existingNames = new Set(clients.map(c => (c.name || '').toLowerCase()));
        
        let importedCount = 0;
        for (const name of Array.from(uniqueNames)) {
          if (!existingNames.has(name.toLowerCase())) {
            await addDoc(collection(db, 'clients'), {
              userId: user.uid,
              name: name,
              phone: '',
              address: '',
              notes: 'Importado automaticamente do histórico de pedidos',
              createdAt: serverTimestamp()
            });
            importedCount++;
          }
        }
        
        showAlert(`Importação concluída! ${importedCount} novos clientes foram adicionados.`, 'Sucesso', 'success');
      } catch (err) {
        console.error(err);
        showAlert('Erro ao importar clientes.', 'Erro', 'error');
      } finally {
        setIsImporting(false);
      }
    }, 'Importar Clientes');
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'clients'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // Sort alphabetically by name
      docs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setClients(docs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const qOrders = query(collection(db, 'orders'), where('userId', '==', user.uid));
    const unsub = onSnapshot(qOrders, (snap) => {
      const map: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'canceled' || data.status === 'unpaid') return;
        const cName = (data.clientName || '').trim().toLowerCase();
        if (cName && cName !== 'cliente' && !cName.startsWith('mesa')) {
          map[cName] = (map[cName] || 0) + (Number(data.total) || 0);
        }
      });
      setOrdersMap(map);
    });
    return unsub;
  }, [user]);

  const openModal = (client?: any) => {
    if (client) {
      setEditingId(client.id);
      setName(client.name || '');
      setPhone(client.phone || '');
      setAddress(client.address || '');
      setNotes(client.notes || '');
    } else {
      setEditingId(null);
      setName('');
      setPhone('');
      setAddress('');
      setNotes('');
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingId) {
        const oldClient = clients.find(c => c.id === editingId);
        const oldName = oldClient?.name || '';
        const newName = name.trim();

        const docRef = doc(db, 'clients', editingId);
        await updateDoc(docRef, {
          name: newName,
          phone: phone.trim(),
          address: address.trim(),
          notes: notes.trim(),
          updatedAt: serverTimestamp()
        });

        // If the name changed, update all orders that had the old name
        if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) {
          const qOrders = query(collection(db, 'orders'), where('userId', '==', user.uid));
          const snap = await getDocs(qOrders);
          const updates: Promise<void>[] = [];
          snap.docs.forEach(d => {
            const data = d.data();
            if ((data.clientName || '').trim().toLowerCase() === oldName.toLowerCase()) {
              updates.push(updateDoc(doc(db, 'orders', d.id), { clientName: newName }));
            }
          });
          if (updates.length > 0) {
            await Promise.all(updates);
          }
        }
      } else {
        await addDoc(collection(db, 'clients'), {
          userId: user.uid,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          notes: notes.trim(),
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      showAlert('Erro ao salvar cliente.', 'Erro', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    showConfirm('Tem certeza que deseja excluir este cliente?', async () => {
      try {
        await deleteDoc(doc(db, 'clients', id));
      } catch (err) {
        console.error(err);
        showAlert('Erro ao excluir cliente.', 'Erro', 'error');
      }
    }, 'Excluir Cliente');
  };

  const filteredClients = clients.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm)
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="page-title">Clientes</h2>
          <p className="page-subtitle">Gestão de clientes, contatos e endereços.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={handleImportFromOrders} disabled={isImporting}>
            {isImporting ? 'Importando...' : 'Importar Pedidos'}
          </button>
          <button className="btn-primary" onClick={() => openModal()}>
            + Novo Cliente
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: '20px', position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Buscar cliente por nome ou telefone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Carregando clientes...</p>
        ) : filteredClients.length > 0 ? (
          <div style={{ overflowX: 'auto', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }} className="transfers-list-scrollable">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--card-bg)', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Nome</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Contato</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Endereço</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Gasto</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, width: '100px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map(client => {
                  const totalGasto = ordersMap[(client.name || '').toLowerCase()] || 0;
                  return (
                    <tr key={client.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 12px', fontWeight: 500 }}>{client.name}</td>
                    <td style={{ padding: '16px 12px' }}>
                      {client.phone ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Phone size={16} /> {client.phone}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      {client.address ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <MapPin size={16} /> {client.address}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '16px 12px', fontWeight: 600, color: 'var(--accent-color)' }}>
                      {formatCurrency(totalGasto)}
                    </td>
                    <td style={{ padding: '16px 12px', display: 'flex', gap: '8px' }}>
                      <button onClick={() => openModal(client)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent-color)' }} title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(client.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger-color)' }} title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
            Nenhum cliente encontrado.
          </p>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">{editingId ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Nome *</label>
                <input 
                  type="text"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Telefone</label>
                <input 
                  type="text"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (11) 99999-9999"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Endereço</label>
                <input 
                  type="text"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro"
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Observações</label>
                <textarea 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', minHeight: '80px' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferências, etc."
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
