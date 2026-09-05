import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';

interface OrderItem {
  name: string;
  qty: string;
  price: string;
}

export default function AddOrder() {
  const router = useRouter();
  const { user } = useAuth();
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ name: '', qty: '1', price: '' }]);
  const [saving, setSaving] = useState(false);

  const addItem = () => {
    setItems([...items, { name: '', qty: '1', price: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItem, val: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const getTotal = () => {
    return items.reduce((sum, item) => {
      const qty = parseInt(item.qty) || 0;
      const price = parseFloat(item.price.replace(',', '.')) || 0;
      return sum + qty * price;
    }, 0);
  };

  const getItemsString = () =>
    items
      .filter((i) => i.name.trim())
      .map((i) => `${i.qty}x ${i.name}`)
      .join(', ');

  const handleSave = async () => {
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um item ao pedido.');
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
        total: getTotal(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const total = getTotal();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Client */}
        <Text style={styles.label}>Nome do cliente (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Mesa 3, João Silva..."
          placeholderTextColor={colors.textSecondary}
          value={clientName}
          onChangeText={setClientName}
          autoCapitalize="words"
        />

        {/* Items */}
        <Text style={styles.label}>Itens do pedido</Text>
        {items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
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
              onChangeText={(v) => updateItem(index, 'name', v)}
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

        {/* Total */}
        <View style={styles.totalCard}>
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
      </ScrollView>
    </KeyboardAvoidingView>
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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    marginBottom: spacing.s,
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
