import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../theme/theme';
import { InventoryItem } from './inventario/index'; // Re-using type from inventario/index.tsx
import { CustomAlert } from '../../utils/CustomAlert';

interface CalculationItem {
  id: string; // generate local id
  inventoryItemId: string;
  name: string;
  quantityUsed: number;
  unit: string;
  cost: number;
}

export default function Calculadora() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Calculadora state
  const [items, setItems] = useState<CalculationItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Add item form state
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [quantityInput, setQuantityInput] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'inventory'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem));
      docs.sort((a, b) => a.name.localeCompare(b.name));
      setInventory(docs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const handleAddItem = () => {
    if (!selectedInventoryItem || !quantityInput) {
      CustomAlert.alert('Erro', 'Selecione um produto e introduza a quantidade.');
      return;
    }

    const qty = parseFloat(quantityInput.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      CustomAlert.alert('Erro', 'Quantidade inválida.');
      return;
    }

    // Calcula o custo proporcional
    const cost = (selectedInventoryItem.price / selectedInventoryItem.quantity) * qty;

    const newItem: CalculationItem = {
      id: Math.random().toString(36).substr(2, 9),
      inventoryItemId: selectedInventoryItem.id,
      name: selectedInventoryItem.name,
      quantityUsed: qty,
      unit: selectedInventoryItem.unit,
      cost,
    };

    setItems([...items, newItem]);
    
    // Reset e fechar modal
    setSelectedInventoryItem(null);
    setQuantityInput('');
    setModalVisible(false);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const totalCost = items.reduce((acc, item) => acc + item.cost, 0);
  const suggestedPrice = totalCost * 3;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Resumo de Custos</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Custo Total dos Ingredientes:</Text>
          <Text style={styles.summaryValue}>{totalCost.toFixed(2)}€</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Preço de Venda Sugerido (x3):</Text>
          <Text style={[styles.summaryValue, styles.highlightValue]}>{suggestedPrice.toFixed(2)}€</Text>
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Ingredientes Utilizados</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={20} color={colors.surface} />
          <Text style={styles.addButtonText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calculator-outline" size={48} color={colors.border} />
          <Text style={styles.emptyText}>Adicione ingredientes para calcular o custo da sua receita.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemContent}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemDetails}>
                  {item.quantityUsed}{item.unit} • Custo: {item.cost.toFixed(2)}€
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar Ingrediente</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>1. Selecione um Produto do Inventário</Text>
            {inventory.length === 0 ? (
              <Text style={styles.emptyText}>Não tem produtos no inventário.</Text>
            ) : (
              <View style={styles.inventoryList}>
                {inventory.map(invItem => (
                  <TouchableOpacity 
                    key={invItem.id} 
                    style={[
                      styles.inventoryOption,
                      selectedInventoryItem?.id === invItem.id && styles.inventoryOptionSelected
                    ]}
                    onPress={() => setSelectedInventoryItem(invItem)}
                  >
                    <Text style={[
                      styles.inventoryOptionText,
                      selectedInventoryItem?.id === invItem.id && styles.inventoryOptionTextSelected
                    ]}>
                      {invItem.name} ({invItem.price.toFixed(2)}€ / {invItem.quantity}{invItem.unit})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedInventoryItem && (
              <>
                <Text style={styles.label}>
                  2. Quantidade que vai usar ({selectedInventoryItem.unit})
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Ex: 500`}
                  value={quantityInput}
                  onChangeText={setQuantityInput}
                  keyboardType="numeric"
                />
              </>
            )}

            <TouchableOpacity 
              style={[
                styles.saveButton, 
                (!selectedInventoryItem || !quantityInput) && styles.saveButtonDisabled
              ]} 
              onPress={handleAddItem}
              disabled={!selectedInventoryItem || !quantityInput}
            >
              <Text style={styles.saveButtonText}>Adicionar à Receita</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.m,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: colors.primary,
    padding: spacing.m,
    borderRadius: radius.m,
    marginBottom: spacing.l,
    ...shadows.medium,
  },
  summaryTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.surface,
    marginBottom: spacing.m,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  summaryValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.surface,
  },
  highlightValue: {
    fontSize: 20,
    color: '#FFE082', // Accent color for the suggested price
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  listTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    borderRadius: radius.s,
    gap: 4,
  },
  addButtonText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.surface,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.m,
    borderRadius: radius.m,
    marginBottom: spacing.s,
    ...shadows.small,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 16,
    color: colors.text,
  },
  itemDetails: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.m,
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    padding: spacing.m,
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  modalTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.text,
  },
  label: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.s,
    marginTop: spacing.m,
  },
  inventoryList: {
    maxHeight: 200,
    marginBottom: spacing.m,
  },
  inventoryOption: {
    backgroundColor: colors.surface,
    padding: spacing.m,
    borderRadius: radius.s,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inventoryOptionSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  inventoryOptionText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.text,
  },
  inventoryOptionTextSelected: {
    fontFamily: typography.fontFamilyMedium,
    color: colors.primary,
  },
  input: {
    backgroundColor: colors.surface,
    padding: spacing.m,
    borderRadius: radius.m,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: spacing.m,
    borderRadius: radius.m,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.surface,
  },
});
