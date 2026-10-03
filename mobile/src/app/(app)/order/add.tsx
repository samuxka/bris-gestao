import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';
import { useAlert } from '../../../context/AlertContext';

interface OrderItem {
  name: string;
  qty: string;
  price: string;
}

export default function AddOrder() {
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ name: '', qty: '1', price: '' }]);
  const [saving, setSaving] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  const [clients, setClients] = useState<any[]>([]);
  const [showClientList, setShowClientList] = useState(false);
  const [addingClient, setAddingClient] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [selectingFlavorsFor, setSelectingFlavorsFor] = useState<{ index: number, product: any } | null>(null);
  const [selectingComplementsFor, setSelectingComplementsFor] = useState<{ index: number, product: any, baseName: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchClients = async () => {
      const q = query(collection(db, 'clients'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClients(fetched);
    };
    const fetchProducts = async () => {
      const q = query(collection(db, 'products'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProducts(fetched);
    };
    fetchClients();
    fetchProducts();
  }, [user]);

  const filteredClients = clients.filter(c => 
    (c.name || '').toLowerCase().includes(clientName.toLowerCase())
  );
  
  const exactMatch = clients.some(c => (c.name || '').toLowerCase() === clientName.trim().toLowerCase());

  const handleSelectClient = (name: string) => {
    setClientName(name);
    setShowClientList(false);
  };

  const handleAddClient = async () => {
    if (!user || !clientName.trim()) return;
    setAddingClient(true);
    try {
      const newClient = {
        userId: user.uid,
        name: clientName.trim(),
        phone: '',
        address: '',
        notes: '',
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'clients'), newClient);
      setClients([...clients, { id: docRef.id, ...newClient }]);
      setShowClientList(false);
      showAlert('Sucesso', 'Cliente cadastrado com sucesso!', 'success');
    } catch(e) {
      console.error(e);
      showAlert('Erro', 'Não foi possível cadastrar o cliente.', 'error');
    } finally {
      setAddingClient(false);
    }
  };

  const addItem = () => {
    setItems([...items, { name: '', qty: '1', price: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, val: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const getSubtotal = () => {
    return items.reduce((sum, item) => {
      const qty = parseInt(item.qty) || 0;
      const price = parseFloat(item.price.replace(',', '.')) || 0;
      return sum + qty * price;
    }, 0);
  };

  const getDiscountAmount = (subtotal: number) => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.discountType === 'percent') {
      return subtotal * (Number(appliedCoupon.discountValue) / 100);
    } else {
      return Number(appliedCoupon.discountValue);
    }
  };

  const getTotal = () => {
    const sub = getSubtotal();
    const disc = getDiscountAmount(sub);
    return Math.max(0, sub - disc);
  };

  const handleApplyCoupon = async () => {
    if (!user || !couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError('');
    try {
      const q = query(
        collection(db, 'coupons'), 
        where('userId', '==', user.uid), 
        where('code', '==', couponCode.trim().toUpperCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setCouponError('Cupom não encontrado.');
        setAppliedCoupon(null);
      } else {
        const coupon = snap.docs[0].data();
        if (!coupon.isActive) {
          setCouponError('Este cupom está inativo.');
          setAppliedCoupon(null);
        } else {
          setAppliedCoupon({ id: snap.docs[0].id, ...coupon });
        }
      }
    } catch (e) {
      setCouponError('Erro ao validar cupom.');
      setAppliedCoupon(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const getItemsString = () =>
    items
      .filter((i) => i.name.trim())
      .map((i) => `${i.qty}x ${i.name}`)
      .join(', ');

  const handleSave = async () => {
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      showAlert('Atenção', 'Adicione pelo menos um item ao pedido.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'orders'), {
        userId: user!.uid,
        clientName: clientName.trim() || 'Cliente',
        items: getItemsString(),
        itemsDetail: validItems,
        notes: notes.trim(),
        subtotal: getSubtotal(),
        discountAmount: getDiscountAmount(getSubtotal()),
        couponCode: appliedCoupon?.code || null,
        category: 'Venda',
        total: getTotal(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      router.back();
    } catch (e) {
      console.error(e);
      showAlert('Erro', 'Não foi possível salvar. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const total = getTotal();

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
        {/* Client */}
        <Text style={styles.label}>Nome do cliente (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Mesa 3, João Silva..."
          placeholderTextColor={colors.textSecondary}
          value={clientName}
          onChangeText={(v) => {
            setClientName(v);
            setShowClientList(true);
          }}
          onFocus={() => setShowClientList(true)}
          autoCapitalize="words"
        />

        {showClientList && clientName.trim().length > 0 && (
          <View style={styles.autocompleteContainer}>
            {filteredClients.slice(0, 5).map((c) => (
              <TouchableOpacity key={c.id} style={styles.autocompleteItem} onPress={() => handleSelectClient(c.name)}>
                <Text style={styles.autocompleteText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            {!exactMatch && (
              <TouchableOpacity style={styles.addClientBtn} onPress={handleAddClient} disabled={addingClient}>
                {addingClient ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.addClientText}>+ Adicionar "{clientName.trim()}" aos clientes</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Items */}
        <Text style={styles.label}>Itens do pedido</Text>
        {items.map((item, index) => (
          <View key={index} style={{ marginBottom: spacing.s }}>
            <View style={styles.itemRow}>
              <View style={styles.itemQtyWrapper}>
                <TextInput
                  style={styles.itemQty}
                  placeholder="Qtd"
                  placeholderTextColor={colors.textSecondary}
                  value={item.qty}
                  onChangeText={(v) => updateItem(index, 'qty', v)}
                  keyboardType="number-pad"
                />
              </View>
              <TextInput
                style={[styles.input, styles.itemName]}
                placeholder="Nome do item"
                placeholderTextColor={colors.textSecondary}
                value={item.name}
                onChangeText={(v) => {
                  updateItem(index, 'name', v);
                  setActiveItemIndex(index);
                  if (selectingFlavorsFor?.index === index) setSelectingFlavorsFor(null);
                }}
                onFocus={() => {
                  setActiveItemIndex(index);
                  if (selectingFlavorsFor?.index === index) setSelectingFlavorsFor(null);
                }}
                autoCapitalize="words"
              />
              <View style={styles.itemPriceWrapper}>
                <Text style={styles.inputPrefix}>€</Text>
                <TextInput
                  style={styles.itemPrice}
                  placeholder="0,00"
                  placeholderTextColor={colors.textSecondary}
                  value={item.price}
                  onChangeText={(v) => updateItem(index, 'price', v)}
                  keyboardType="decimal-pad"
                />
              </View>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(index)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Products Autocomplete */}
            {activeItemIndex === index && item.name.trim().length > 0 && !selectingFlavorsFor && !selectingComplementsFor && (
              <View style={[styles.autocompleteContainer, { marginTop: 0 }]}>
                {products
                  .filter(p => (p.name || '').toLowerCase().includes(item.name.toLowerCase()))
                  .slice(0, 5)
                  .map((p) => (
                    <TouchableOpacity 
                      key={p.id} 
                      style={styles.autocompleteItem} 
                      onPress={() => {
                        if (p.flavors && p.flavors.length > 0) {
                          setSelectingFlavorsFor({ index, product: p });
                        } else if (p.complements && p.complements.length > 0) {
                          setSelectingComplementsFor({ index, product: p, baseName: p.name });
                        } else {
                          updateItem(index, 'name', p.name);
                          updateItem(index, 'price', String(p.price || '0').replace('.', ','));
                          setActiveItemIndex(null);
                        }
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.autocompleteText}>{p.name}</Text>
                        <Text style={[styles.autocompleteText, { color: colors.primary }]}>
                          € {(Number(p.price) || 0).toFixed(2).replace('.', ',')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            {/* Flavor Selection */}
            {selectingFlavorsFor?.index === index && (
              <View style={[styles.autocompleteContainer, { marginTop: 0, paddingBottom: spacing.xs }]}>
                <Text style={{ padding: spacing.m, fontFamily: typography.fontFamilyBold, color: colors.textSecondary, fontSize: 13, textTransform: 'uppercase' }}>
                  Escolha o Sabor ({selectingFlavorsFor.product.name})
                </Text>
                {selectingFlavorsFor.product.flavors.map((f: string) => (
                  <TouchableOpacity 
                    key={f}
                    style={styles.autocompleteItem}
                    onPress={() => {
                      const newName = `${selectingFlavorsFor.product.name} - ${f}`;
                      if (selectingFlavorsFor.product.complements && selectingFlavorsFor.product.complements.length > 0) {
                        setSelectingComplementsFor({ index, product: selectingFlavorsFor.product, baseName: newName });
                        setSelectingFlavorsFor(null);
                      } else {
                        updateItem(index, 'name', newName);
                        updateItem(index, 'price', String(selectingFlavorsFor.product.price || '0').replace('.', ','));
                        setActiveItemIndex(null);
                        setSelectingFlavorsFor(null);
                      }
                    }}
                  >
                    <Text style={styles.autocompleteText}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Complement Selection */}
            {selectingComplementsFor?.index === index && (
              <View style={[styles.autocompleteContainer, { marginTop: 0, paddingBottom: spacing.xs }]}>
                <Text style={{ padding: spacing.m, fontFamily: typography.fontFamilyBold, color: colors.textSecondary, fontSize: 13, textTransform: 'uppercase' }}>
                  Escolha o Complemento
                </Text>
                {selectingComplementsFor.product.complements.map((c: string) => (
                  <TouchableOpacity 
                    key={c}
                    style={styles.autocompleteItem}
                    onPress={() => {
                      updateItem(index, 'name', `${selectingComplementsFor.baseName} c/ ${c}`);
                      updateItem(index, 'price', String(selectingComplementsFor.product.price || '0').replace('.', ','));
                      setActiveItemIndex(null);
                      setSelectingComplementsFor(null);
                    }}
                  >
                    <Text style={styles.autocompleteText}>{c}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity 
                  style={styles.autocompleteItem}
                  onPress={() => {
                    updateItem(index, 'name', selectingComplementsFor.baseName);
                    updateItem(index, 'price', String(selectingComplementsFor.product.price || '0').replace('.', ','));
                    setActiveItemIndex(null);
                    setSelectingComplementsFor(null);
                  }}
                >
                  <Text style={[styles.autocompleteText, { color: colors.textSecondary }]}>Nenhum / Continuar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
          <Text style={styles.addItemText}>+ Adicionar item</Text>
        </TouchableOpacity>

        {/* Notes */}
        <Text style={styles.label}>Observações (opcional)</Text>
        <TextInput
          style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          placeholder="Ex: Sem cebola, bem passado..."
          placeholderTextColor={colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {/* Cupom */}
        <Text style={styles.label}>Cupom de Desconto</Text>
        <View style={{ flexDirection: 'row', gap: spacing.s, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <TextInput
              style={[styles.input, couponError ? { borderColor: colors.danger } : null]}
              placeholder="Ex: PROMO10"
              placeholderTextColor={colors.textSecondary}
              value={couponCode}
              onChangeText={(v) => {
                setCouponCode(v.toUpperCase());
                setCouponError('');
                if (appliedCoupon) setAppliedCoupon(null);
              }}
              autoCapitalize="characters"
            />
            {couponError ? <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4, paddingLeft: 4 }}>{couponError}</Text> : null}
            {appliedCoupon ? (
              <Text style={{ color: colors.success, fontSize: 12, marginTop: 4, paddingLeft: 4 }}>
                Cupom aplicado: -{appliedCoupon.discountType === 'percent' ? `${appliedCoupon.discountValue}%` : `€ ${Number(appliedCoupon.discountValue).toFixed(2)}`}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity 
            style={[styles.saveBtn, { marginTop: 0, paddingVertical: 14, width: 100 }]} 
            onPress={handleApplyCoupon}
            disabled={validatingCoupon || !couponCode.trim()}
          >
            {validatingCoupon ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Text style={[styles.saveBtnText, { fontSize: 14 }]}>Aplicar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Total */}
        <View style={styles.totalCard}>
          {appliedCoupon && (
            <Text style={[styles.totalLabel, { color: colors.success, fontSize: 14, marginBottom: 4 }]}>
              Subtotal: € {getSubtotal().toFixed(2)}
            </Text>
          )}
          <Text style={styles.totalLabel}>Total do pedido</Text>
          <Text style={styles.totalValue}>€ {total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.saveBtnText}>Criar Pedido</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.m,
  },
  label: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.m,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.text,
    ...shadows.small,
  },
  autocompleteContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
    ...shadows.small,
  },
  autocompleteItem: {
    padding: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  autocompleteText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 15,
    color: colors.text,
  },
  addClientBtn: {
    padding: spacing.m,
    backgroundColor: '#F0F9FF',
    borderBottomLeftRadius: radius.m,
    borderBottomRightRadius: radius.m,
  },
  addClientText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  itemQtyWrapper: {
    width: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    ...shadows.small,
  },
  itemQty: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    width: '100%',
  },
  itemName: {
    flex: 1,
    height: 52,
    paddingVertical: 0,
    paddingHorizontal: spacing.m,
  },
  itemPriceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.s,
    height: 52,
    width: 90,
    ...shadows.small,
  },
  inputPrefix: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    color: colors.textSecondary,
  },
  itemPrice: {
    flex: 1,
    fontFamily: typography.fontFamilyMedium,
    fontSize: 15,
    color: colors.text,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: colors.surface,
    fontSize: 20,
    lineHeight: 22,
    fontFamily: typography.fontFamilyBold,
  },
  addItemBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.m,
    paddingVertical: spacing.m,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  addItemText: {
    fontFamily: typography.fontFamilyMedium,
    color: colors.primary,
    fontSize: 15,
  },
  totalCard: {
    backgroundColor: '#1E293B',
    borderRadius: radius.l,
    padding: spacing.l,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.l,
  },
  totalLabel: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 16,
    color: '#94A3B8',
  },
  totalValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 24,
    color: '#F8FAFC',
  },
  saveBtn: {
    marginTop: spacing.m,
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    alignItems: 'center',
    ...shadows.medium,
  },
  saveBtnText: {
    fontFamily: typography.fontFamilyBold,
    color: colors.surface,
    fontSize: 16,
  },
});
