import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
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

interface Expense {
  id: string;
  description: string;
  type: 'in' | 'out';
  value: number;
  createdAt: any;
}

const STATUS_BADGE = {
  done: { backgroundColor: colors.success, label: 'Feito' },
  pending: { backgroundColor: colors.warning, label: 'Pendente' },
  unpaid: { backgroundColor: '#3B82F6', label: 'Falta Pagar' },
  canceled: { backgroundColor: colors.danger, label: 'Cancelado' },
};

export default function Home() {
  const router = useRouter();
  const { user, userName } = useAuth();
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [salesThisMonth, setSalesThisMonth] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    // Pending orders (we fetch all pending to ensure we don't miss local optimistic updates)
    const qPending = query(
      collection(db, 'orders'),
      where('userId', '==', uid),
      where('status', '==', 'pending')
    );
    const unsubPending = onSnapshot(qPending, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      // Sort client-side to avoid index requirements and handle null createdAt
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });
      setPendingOrders(docs.slice(0, 5));
      setTotalPending(docs.length);
      setLoading(false);
    }, (err) => {
      console.error("Home pending orders error:", err);
      setLoading(false);
    });

    // Recent done/canceled/unpaid orders
    const qRecent = query(
      collection(db, 'orders'),
      where('userId', '==', uid),
      where('status', 'in', ['done', 'canceled', 'unpaid'])
    );
    const unsubRecent = onSnapshot(qRecent, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      
      const now = new Date();
      let monthSales = 0;
      docs.forEach(o => {
        if (o.status === 'done' || o.status === 'unpaid') {
          const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
          if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            monthSales++;
          }
        }
      });
      setSalesThisMonth(monthSales);

      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });
      setRecentOrders(docs.slice(0, 5));
    }, (err) => console.error("Home recent orders error:", err));

    // Recent expenses / cash flow
    const qExpenses = query(
      collection(db, 'cashflow'),
      where('userId', '==', uid)
    );
    const unsubExpenses = onSnapshot(qExpenses, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
      items.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });
      setRecentExpenses(items.slice(0, 5));
    }, (err) => console.error("Home expenses error:", err));

    return () => {
      unsubPending();
      unsubRecent();
      unsubExpenses();
    };
  }, [user]);

  const displayName = userName || user?.displayName || user?.email?.split('@')[0] || 'Usuário';

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={{
              uri:
                user?.photoURL ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=E53935&color=fff`,
            }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{displayName}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/(app)/settings')}>
          <Ionicons name="menu" size={32} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cardsContainer}
        contentContainerStyle={styles.cardsContent}
      >
        <View style={[styles.card, styles.balanceCard]}>
          <Text style={styles.balanceLabel}>Vendas (Mês)</Text>
          <Text style={styles.balanceValue}>
            {salesThisMonth}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Pedidos Pendentes</Text>
          <Text style={[styles.cardValue, { color: colors.warning }]}>{totalPending}</Text>
        </View>
      </ScrollView>

      {/* Pending Orders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pedidos Pendentes</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : pendingOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={40} color={colors.border} />
            <Text style={styles.emptyText}>Nenhum pedido pendente</Text>
          </View>
        ) : (
          pendingOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.listItem}
              onPress={() => router.push(`/(app)/order/${order.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>
                  {order.clientName || `Pedido #${order.id.slice(-4).toUpperCase()}`}
                </Text>
                <Text style={styles.itemSubtitle}>{order.items}</Text>
              </View>
              <View style={[styles.badge, STATUS_BADGE['pending']]}>
                <Text style={styles.badgeText}>Pendente</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Histórico de Pedidos</Text>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={colors.border} />
            <Text style={styles.emptyText}>Nenhum pedido no histórico</Text>
          </View>
        ) : (
          recentOrders.map((order) => {
            const badge = STATUS_BADGE[order.status] || STATUS_BADGE['done'];
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.listItem}
                onPress={() => router.push(`/(app)/order/${order.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>
                    {order.clientName || `Pedido #${order.id.slice(-4).toUpperCase()}`}
                  </Text>
                  <Text style={styles.itemSubtitle}>{order.items}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
                  <Text style={styles.badgeText}>{badge.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Recent Expenses */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Histórico de Gastos</Text>
        {recentExpenses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={40} color={colors.border} />
            <Text style={styles.emptyText}>Nenhum lançamento encontrado</Text>
          </View>
        ) : (
          recentExpenses.map((exp) => (
            <View key={exp.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{exp.description}</Text>
              </View>
              <Text
                style={[
                  styles.expenseValue,
                  { color: exp.type === 'out' ? colors.danger : colors.success },
                ]}
              >
                {exp.type === 'out' ? '- ' : '+ '}€ {exp.value.toFixed(2)}
              </Text>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.m,
    paddingTop: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  greeting: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
  },
  name: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.text,
  },
  cardsContainer: {
    paddingVertical: spacing.m,
  },
  cardsContent: {
    paddingHorizontal: spacing.m,
    gap: spacing.m,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.l,
    borderRadius: radius.l,
    width: 170,
    ...shadows.small,
  },
  balanceCard: {
    backgroundColor: '#1E293B', // Neutral dark, not red
  },
  balanceLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: spacing.xs,
  },
  balanceValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    color: '#F8FAFC',
  },
  cardLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  cardValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 28,
    color: colors.text,
  },
  section: {
    padding: spacing.m,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.m,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.m,
    borderRadius: radius.m,
    marginBottom: spacing.s,
    ...shadows.small,
  },
  itemTitle: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 16,
    color: colors.text,
  },
  itemSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
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
  expenseValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.s,
  },
  emptyText: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
