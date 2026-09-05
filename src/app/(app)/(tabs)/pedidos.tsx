import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';

interface Order {
  id: string;
  items: string;
  status: 'pending' | 'done' | 'canceled' | 'unpaid';
  total: number;
  clientName?: string;
  createdAt: any;
}

const STATUS_MAP = {
  done: { backgroundColor: colors.success, label: 'Feito' },
  pending: { backgroundColor: colors.warning, label: 'Pendente' },
  unpaid: { backgroundColor: '#3B82F6', label: 'Falta Pagar' },
  canceled: { backgroundColor: colors.danger, label: 'Cancelado' },
};

export default function Pedidos() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      // Client-side sort ensures optimistic writes without timestamp appear instantly
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });
      setOrders(docs);
      setLoading(false);
    }, (err) => {
      console.error("Pedidos error:", err);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const renderItem = ({ item }: { item: Order }) => {
    const badge = STATUS_MAP[item.status] || STATUS_MAP['done'];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(app)/order/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>
            {item.clientName || `Pedido #${item.id.slice(-4).toUpperCase()}`}
          </Text>
          <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
        </View>
        <Text style={styles.items}>{item.items}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.time}>
            {item.createdAt?.toDate
              ? item.createdAt.toDate().toLocaleString('pt-PT')
              : '---'}
          </Text>
          <Text style={styles.total}>€ {item.total?.toFixed(2) ?? '0.00'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
          <Text style={styles.emptyText}>Use o botão + para criar um novo pedido</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
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
    backgroundColor: colors.surface,
    padding: spacing.m,
    borderRadius: radius.m,
    marginBottom: spacing.m,
    ...shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderId: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.text,
  },
  items: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.m,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.s,
  },
  time: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },
  total: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: spacing.s,
    paddingVertical: 4,
    borderRadius: radius.s,
  },
  badgeText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 12,
    color: colors.surface,
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
});
