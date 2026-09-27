import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';
import FAB from '../../../components/FAB';
import { CustomAlert } from '../../../utils/CustomAlert';

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: any;
  userId: string;
}

export default function ListaComprasIndex() {
  const router = useRouter();
  const { user } = useAuth();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'shoppingLists'),
      where('userId', '==', user.uid)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShoppingList));
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setLists(docs);
      setLoading(false);
    }, (err) => {
      console.error("Shopping list error:", err);
      setLoading(false);
    });
    
    return unsub;
  }, [user]);

  const handleDelete = (id: string) => {
    CustomAlert.alert(
      'Remover Lista',
      'Tem a certeza que deseja remover esta lista de compras?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Remover', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'shoppingLists', id));
            } catch (err) {
              CustomAlert.alert('Erro', 'Não foi possível remover a lista.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: ShoppingList }) => {
    const date = item.createdAt?.toDate?.() ? item.createdAt.toDate().toLocaleDateString() : '';
    
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => router.push({ pathname: '/(app)/lista-compras/[id]', params: { id: item.id } })}
      >
        <View style={styles.cardContent}>
          <Text style={styles.listName}>{item.name}</Text>
          <Text style={styles.listDetails}>{date}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleDelete(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={() => CustomAlert.alert('Filtro', 'Em breve!')} style={{ marginRight: spacing.m }}>
              <Ionicons name="filter" size={24} color={colors.primary} />
            </TouchableOpacity>
          )
        }} 
      />

      {lists.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>Nenhuma lista criada</Text>
          <Text style={styles.emptyText}>Use o botão + para criar uma nova lista de compras</Text>
        </View>
      ) : (
        <FlatList
          data={lists}
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
  listName: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 16,
    color: colors.text,
  },
  listDetails: {
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
    alignItems: 'center',
  },
  actionButton: {
    padding: spacing.s,
    backgroundColor: colors.background,
    borderRadius: radius.s,
    marginRight: spacing.xs,
  },
});
