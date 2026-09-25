import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Platform } from 'react-native';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';

interface ShoppingListItem {
  id: string;
  listId: string;
  name: string;
  qty?: string;
  checked: boolean;
  createdAt: any;
}

export default function ListaComprasDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [listName, setListName] = useState('');
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    
    // Fetch list details
    const fetchList = async () => {
      try {
        const listDoc = await getDoc(doc(db, 'shoppingLists', id as string));
        if (listDoc.exists()) {
          setListName(listDoc.data().name);
        }
      } catch (err) {
        console.error("Error fetching list details", err);
      }
    };
    fetchList();

    // Fetch list items
    const q = query(
      collection(db, 'shoppingListItems'),
      where('listId', '==', id)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShoppingListItem));
      // Sort: unchecked first, then by creation date
      docs.sort((a, b) => {
        if (a.checked === b.checked) {
          return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
        }
        return a.checked ? 1 : -1;
      });
      setItems(docs);
      setLoading(false);
    }, (err) => {
      console.error("Shopping list items error:", err);
      setLoading(false);
    });
    
    return unsub;
  }, [user, id]);

  const toggleCheck = async (item: ShoppingListItem) => {
    try {
      await updateDoc(doc(db, 'shoppingListItems', item.id), {
        checked: !item.checked
      });
    } catch (err) {
      console.error("Error toggling item", err);
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'shoppingListItems', itemId));
    } catch (err) {
      console.error("Error deleting item", err);
    }
  };



  const renderItem = ({ item }: { item: ShoppingListItem }) => (
    <View style={styles.itemCard}>
      <TouchableOpacity 
        style={styles.itemContent}
        onPress={() => toggleCheck(item)}
      >
        <Ionicons 
          name={item.checked ? "checkbox" : "square-outline"} 
          size={24} 
          color={item.checked ? colors.primary : colors.textSecondary} 
        />
        <Text style={[styles.itemName, item.checked && styles.itemChecked]}>
          {item.qty && item.qty !== '1' ? `${item.qty}x ` : ''}{item.name}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => deleteItem(item.id)}
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
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
      <Stack.Screen options={{ title: listName || 'Detalhes da Lista' }} />
      
      <KeyboardAwareFlatList
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        enableOnAndroid={true}
        extraScrollHeight={20}
        keyboardOpeningTime={0}
        data={items}
        keyExtractor={(item: ShoppingListItem) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Sem itens nesta lista ainda.</Text>
          </View>
        )}
      />
      
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  itemName: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 16,
    color: colors.text,
  },
  itemChecked: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
