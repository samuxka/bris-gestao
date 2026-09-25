import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';
import { Ionicons } from '@expo/vector-icons';

interface ItemForm {
  qty: string;
  name: string;
}

export default function AddShoppingList() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [listName, setListName] = useState('');
  const [items, setItems] = useState<ItemForm[]>([{ qty: '1', name: '' }]);
  const [loading, setLoading] = useState(false);

  const addItemRow = () => {
    setItems([...items, { qty: '1', name: '' }]);
  };

  const updateItem = (index: number, field: keyof ItemForm, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!listName.trim()) {
      Alert.alert('Erro', 'Por favor, introduza um título para a lista.');
      return;
    }

    const validItems = items.filter(i => i.name.trim());

    if (!user) return;

    setLoading(true);
    try {
      // 1. Criar a lista
      const listRef = await addDoc(collection(db, 'shoppingLists'), {
        userId: user.uid,
        name: listName.trim(),
        createdAt: serverTimestamp(),
      });

      // 2. Criar os itens associados
      for (const item of validItems) {
        await addDoc(collection(db, 'shoppingListItems'), {
          listId: listRef.id,
          name: item.name.trim(),
          qty: item.qty.trim() || '1',
          checked: false,
          createdAt: serverTimestamp(),
        });
      }

      // 3. Redirecionar para a página da lista que acabou de ser criada
      router.replace({ pathname: '/(app)/lista-compras/[id]', params: { id: listRef.id } });
    } catch (err) {
      console.error("Error creating shopping list", err);
      Alert.alert('Erro', 'Ocorreu um erro ao criar a lista.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
        <View style={styles.formGroup}>
          <Text style={styles.label}>Título da Lista *</Text>
          <TextInput
            style={styles.inputTitle}
            value={listName}
            onChangeText={setListName}
            placeholder="Ex: Compras da semana"
            autoFocus
          />
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.label, { width: 60 }]}>QTD</Text>
          <Text style={[styles.label, { flex: 1, paddingLeft: spacing.s }]}>ITEM</Text>
        </View>

        {items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <TextInput
              style={styles.inputQty}
              value={item.qty}
              onChangeText={(val) => updateItem(index, 'qty', val)}
              placeholder="1"
              keyboardType="numeric"
            />
            <TextInput
              style={styles.inputItemName}
              value={item.name}
              onChangeText={(val) => updateItem(index, 'name', val)}
              placeholder="Ex: Leite"
            />
            {items.length > 1 && (
              <TouchableOpacity onPress={() => removeItemRow(index)} style={styles.removeBtn}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addItemRow}>
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addBtnText}>ADD ITEM</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.saveButtonText}>SALVAR</Text>
          )}
        </TouchableOpacity>
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
  formGroup: {
    marginBottom: spacing.l,
  },
  label: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputTitle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    padding: spacing.m,
    fontFamily: typography.fontFamilyMedium,
    fontSize: 18,
    color: colors.text,
  },
  tableHeader: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.s,
    gap: spacing.s,
  },
  inputQty: {
    width: 60,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.s,
    padding: spacing.s,
    textAlign: 'center',
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.text,
  },
  inputItemName: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.s,
    padding: spacing.s,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.text,
  },
  removeBtn: {
    padding: spacing.xs,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.m,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.m,
    marginTop: spacing.s,
    marginBottom: spacing.xl,
    gap: spacing.s,
  },
  addBtnText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: spacing.m,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.surface,
    letterSpacing: 1,
  },
});
