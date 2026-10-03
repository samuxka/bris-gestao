import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { Calculator, Plus, Trash2, Edit2, Info } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

interface RecipeIngredient {
  inventoryId: string;
  quantityUsed: number;
}

interface Recipe {
  id: string;
  name: string;
  sellPrice: number;
  ingredients: RecipeIngredient[];
}

export default function Calculadora() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();

  const [fixedCosts, setFixedCosts] = useState<number>(0);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [recipePrice, setRecipePrice] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);

  // Fixed Costs edit
  const [isEditingFixedCosts, setIsEditingFixedCosts] = useState(false);
  const [fixedCostsInput, setFixedCostsInput] = useState('');

  useEffect(() => {
    if (!user) return;

    // Load Fixed Costs
    const loadSettings = async () => {
      try {
        const q = query(collection(db, 'settings'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setFixedCosts(data.fixedCosts || 0);
          setFixedCostsInput(String(data.fixedCosts || 0));
        } else {
          await addDoc(collection(db, 'settings'), { userId: user.uid, fixedCosts: 0 });
        }
      } catch (err) {
        console.warn('Fallback para localStorage (settings bloqueado)', err);
        const local = localStorage.getItem(`fixedCosts_${user.uid}`);
        if (local) {
          setFixedCosts(Number(local));
          setFixedCostsInput(local);
        }
      }
    };
    loadSettings();

    // Load Inventory
    const qInv = query(collection(db, 'inventory'), where('userId', '==', user.uid));
    const unsubInv = onSnapshot(qInv, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
      setInventory(docs);
    });

    // Load Recipes
    const qRec = query(collection(db, 'cost_recipes'), where('userId', '==', user.uid));
    const unsubRec = onSnapshot(qRec, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
      setRecipes(docs);
      setLoading(false);
    }, (err) => {
      console.warn('Fallback para localStorage (cost_recipes bloqueado)', err);
      const local = localStorage.getItem(`cost_recipes_${user.uid}`);
      if (local) {
        setRecipes(JSON.parse(local));
      }
      setLoading(false);
    });

    return () => {
      unsubInv();
      unsubRec();
    };
  }, [user]);

  const handleSaveFixedCosts = async () => {
    if (!user) return;
    const value = parseFloat(fixedCostsInput.replace(',', '.')) || 0;
    try {
      const q = query(collection(db, 'settings'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await setDoc(doc(db, 'settings', snap.docs[0].id), { fixedCosts: value }, { merge: true });
      } else {
        await addDoc(collection(db, 'settings'), { userId: user.uid, fixedCosts: value });
      }
    } catch (err) {
      console.warn('Salvando settings no localStorage.', err);
      localStorage.setItem(`fixedCosts_${user.uid}`, String(value));
    }
    setFixedCosts(value);
    setIsEditingFixedCosts(false);
    showAlert('Custos fixos atualizados.', 'Sucesso', 'success');
  };

  const openRecipeModal = (recipe?: Recipe) => {
    if (recipe) {
      setEditingId(recipe.id);
      setRecipeName(recipe.name);
      setRecipePrice(String(recipe.sellPrice || 0));
      setRecipeIngredients(recipe.ingredients || []);
    } else {
      setEditingId(null);
      setRecipeName('');
      setRecipePrice('');
      setRecipeIngredients([]);
    }
    setShowModal(true);
  };

  const addIngredient = () => {
    if (inventory.length === 0) {
      showAlert('Adicione itens ao inventário primeiro.', 'Atenção', 'warning');
      return;
    }
    setRecipeIngredients([...recipeIngredients, { inventoryId: inventory[0].id, quantityUsed: 0 }]);
  };

  const updateIngredient = (index: number, field: 'inventoryId' | 'quantityUsed', value: string) => {
    const newIngs = [...recipeIngredients];
    if (field === 'inventoryId') {
      newIngs[index].inventoryId = value;
    } else {
      newIngs[index].quantityUsed = parseFloat(value.replace(',', '.')) || 0;
    }
    setRecipeIngredients(newIngs);
  };

  const removeIngredient = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const saveLocalRecipes = (newRecipes: Recipe[]) => {
    localStorage.setItem(`cost_recipes_${user?.uid}`, JSON.stringify(newRecipes));
    setRecipes(newRecipes);
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !recipeName.trim()) return;

    const price = parseFloat(recipePrice.replace(',', '.')) || 0;

    const payload = {
      id: editingId || Math.random().toString(36).substr(2, 9),
      name: recipeName.trim(),
      sellPrice: price,
      ingredients: recipeIngredients
    };

    try {
      if (editingId) {
        await setDoc(doc(db, 'cost_recipes', editingId), { ...payload, userId: user.uid }, { merge: true });
      } else {
        await addDoc(collection(db, 'cost_recipes'), { ...payload, userId: user.uid });
      }
    } catch (err) {
      console.warn('Salvando recipe no localStorage.', err);
      let newRecipes = [...recipes];
      if (editingId) {
        newRecipes = newRecipes.map(r => r.id === editingId ? payload : r);
      } else {
        newRecipes.push(payload);
      }
      saveLocalRecipes(newRecipes);
    }
    setShowModal(false);
    showAlert('Receita salva com sucesso!', 'Sucesso', 'success');
  };

  const handleDeleteRecipe = (id: string) => {
    showConfirm('Tem certeza que deseja excluir esta receita?', async () => {
      try {
        await deleteDoc(doc(db, 'cost_recipes', id));
      } catch (err) {
        console.warn('Excluindo recipe do localStorage.', err);
        const newRecipes = recipes.filter(r => r.id !== id);
        saveLocalRecipes(newRecipes);
      }
    }, 'Excluir Receita');
  };

  const calculateCMV = (ingredients: RecipeIngredient[]) => {
    return ingredients.reduce((acc, ing) => {
      const invItem = inventory.find(i => i.id === ing.inventoryId);
      if (!invItem || invItem.quantity <= 0) return acc;
      // cost = (price / quantity) * quantityUsed
      const unitCost = invItem.price / invItem.quantity;
      return acc + (unitCost * ing.quantityUsed);
    }, 0);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Calculator size={28} color="var(--accent-color)" />
            Calculadora de Custos
          </h2>
          <p className="page-subtitle">Calcule o CMV e descubra o ponto de equilíbrio.</p>
        </div>
        <button className="btn-primary" onClick={() => openRecipeModal()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Novo Produto / Receita
        </button>
      </div>

      <div className="dashboard-grid">
        {/* Fixed Costs Card */}
        <div className="card" style={{ gridColumn: 'span 12', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>DESPESAS FIXAS (MENSAL)</h3>
            {isEditingFixedCosts ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input 
                  type="number" 
                  className="filter-select"
                  value={fixedCostsInput}
                  onChange={e => setFixedCostsInput(e.target.value)}
                  placeholder="Ex: 1500"
                />
                <button className="btn-primary" onClick={handleSaveFixedCosts}>Salvar</button>
                <button className="btn-secondary" onClick={() => setIsEditingFixedCosts(false)}>Cancelar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-color)' }}>
                  € {fixedCosts.toFixed(2).replace('.', ',')}
                </span>
                <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => setIsEditingFixedCosts(true)} title="Editar Despesas Fixas">
                  <Edit2 size={16} />
                </button>
              </div>
            )}
          </div>
          <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '8px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', gap: '8px', color: '#1e3a8a', fontWeight: 600, marginBottom: '4px' }}>
              <Info size={18} /> Como funciona?
            </div>
            <p style={{ fontSize: '13px', color: '#1e3a8a', margin: 0 }}>
              Adicione suas despesas fixas (aluguel, água, luz). O sistema calculará quantas unidades de cada produto você precisa vender para cobrir esses custos.
            </p>
          </div>
        </div>

        {/* Results Table */}
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <h3 className="card-title">Análise de Produtos e Ponto de Equilíbrio</h3>
          
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
          ) : recipes.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '40px 0' }}>Nenhum produto cadastrado na calculadora.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--bg-color)' }}>
                  <tr>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '2px solid var(--border-color)' }}>Nome do Produto</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '2px solid var(--border-color)' }}>Preço (Venda)</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '2px solid var(--border-color)' }}>CMV (Custo Ingred.)</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '2px solid var(--border-color)' }}>Margem Contribuição</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '2px solid var(--border-color)' }}>Necessários/mês para cobrir despesas fixas</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '2px solid var(--border-color)' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {recipes.map(recipe => {
                    const cmv = calculateCMV(recipe.ingredients);
                    const margem = recipe.sellPrice - cmv;
                    const necessarios = margem > 0 ? Math.ceil(fixedCosts / margem) : 'Prejuízo';

                    return (
                      <tr key={recipe.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '16px 12px', fontWeight: 600 }}>{recipe.name}</td>
                        <td style={{ padding: '16px 12px', fontWeight: 600, color: 'var(--success-color)' }}>€ {recipe.sellPrice.toFixed(2)}</td>
                        <td style={{ padding: '16px 12px', fontWeight: 600, color: 'var(--danger-color)' }}>€ {cmv.toFixed(2)}</td>
                        <td style={{ padding: '16px 12px', fontWeight: 600, color: margem > 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                          € {margem.toFixed(2)}
                        </td>
                        <td style={{ padding: '16px 12px', fontWeight: 700, color: 'var(--accent-color)' }}>
                          {margem > 0 ? `${necessarios} unidades` : <span style={{ color: 'var(--danger-color)' }}>Rever preço!</span>}
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => openRecipeModal(recipe)} title="Editar">
                              <Edit2 size={16} />
                            </button>
                            <button className="btn-secondary" style={{ padding: '6px', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }} onClick={() => handleDeleteRecipe(recipe.id)} title="Excluir">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content card" style={{ maxWidth: '600px', margin: '20px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title" style={{ marginTop: 0, marginBottom: '20px' }}>
              {editingId ? 'Editar Produto / Receita' : 'Novo Produto / Receita'}
            </h3>
            <form onSubmit={handleSaveRecipe} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Nome do Produto</label>
                  <input 
                    type="text" className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                    value={recipeName} onChange={e => setRecipeName(e.target.value)}
                    placeholder="Ex: Bolo de Cenoura" required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem' }}>Preço de Venda (€)</label>
                  <input 
                    type="number" step="0.01" className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                    value={recipePrice} onChange={e => setRecipePrice(e.target.value)}
                    placeholder="Ex: 5.00" required
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '1rem', fontWeight: 600 }}>Ingredientes / Insumos do Inventário</label>
                  <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={addIngredient}>
                    <Plus size={14} /> Adicionar
                  </button>
                </div>

                {recipeIngredients.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-color)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                    Nenhum ingrediente adicionado.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {recipeIngredients.map((ing, index) => {
                      const selectedInv = inventory.find(i => i.id === ing.inventoryId);
                      return (
                        <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'var(--bg-color)', padding: '12px', borderRadius: '8px' }}>
                          <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Item do Inventário</label>
                            <select 
                              className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                              value={ing.inventoryId}
                              onChange={e => updateIngredient(index, 'inventoryId', e.target.value)}
                            >
                              {inventory.map(inv => (
                                <option key={inv.id} value={inv.id}>{inv.name} (Estoque: {inv.quantity}{inv.unit})</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Qtd Utilizada ({selectedInv?.unit || ''})</label>
                            <input 
                              type="number" step="0.001" className="filter-select" style={{ width: '100%', boxSizing: 'border-box' }}
                              value={ing.quantityUsed || ''}
                              onChange={e => updateIngredient(index, 'quantityUsed', e.target.value)}
                              placeholder="Ex: 0.1" required
                            />
                          </div>
                          <button type="button" onClick={() => removeIngredient(index)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', marginTop: '20px' }}>
                            <Trash2 size={20} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Salvar Produto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
