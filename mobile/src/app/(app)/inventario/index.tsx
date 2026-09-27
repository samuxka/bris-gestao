import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';
import FAB from '../../../components/FAB';
import { CustomAlert } from '../../../utils/CustomAlert';

export interface InventoryItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

export default function InventarioIndex() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'inventory'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem));
      docs.sort((a, b) => a.name.localeCompare(b.name));
      setItems(docs);
      setLoading(false);
    }, (err) => {
      console.error("Inventario error:", err);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const handleDelete = (id: string) => {
    CustomAlert.alert(
      'Remover Produto',
      'Tem a certeza que deseja remover este produto do inventário?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Remover', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'inventory', id));
            } catch (err) {
              CustomAlert.alert('Erro', 'Não foi possível remover o produto.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDetails}>
          {item.quantity}{item.unit} por {item.price.toFixed(2)}€
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push({ pathname: '/(app)/inventario/[id]', params: { id: item.id } })}
        >
          <Ionicons name="pencil-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDelete(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cube-outline" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>Nenhum produto adicionado</Text>
          <Text style={styles.emptyText}>Use o botão + para adicionar produtos ao seu inventário</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
      
      <FAB />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.m,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.m,
    borderRadius: radius.m,
    marginBottom: spacing.s,
    ...shadows.small,
  },
  cardContent: {
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.s,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.text,
    marginTop: spacing.m,
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  actionButton: {
    padding: spacing.s,
    backgroundColor: colors.background,
    borderRadius: radius.s,
  },
});
