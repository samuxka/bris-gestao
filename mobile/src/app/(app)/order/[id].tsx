import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';

type OrderStatus = 'pending' | 'done' | 'canceled' | 'unpaid';

interface ItemDetail {
  name: string;
  qty: string;
  price: string;
}

interface Order {
  id: string;
  clientName: string;
  items: string;
  itemsDetail?: ItemDetail[];
  notes: string;
  total: number;
  status: OrderStatus;
  createdAt: any;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pendente', color: colors.warning, icon: 'time-outline' },
  unpaid: { label: 'Falta Pagar', color: '#3B82F6', icon: 'wallet-outline' },
  done: { label: 'Feito', color: colors.success, icon: 'checkmark-circle-outline' },
  canceled: { label: 'Cancelado', color: colors.danger, icon: 'close-circle-outline' },
};

export default function OrderDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'orders', id as string)).then((snap) => {
      if (snap.exists()) {
        setOrder({ id: snap.id, ...snap.data() } as Order);
      }
      setLoading(false);
    });
  }, [id]);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;
    Alert.alert(
      'Alterar status',
      `Mudar para "${STATUS_CONFIG[newStatus].label}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setUpdating(true);
            try {
              await updateDoc(doc(db, 'orders', order.id), { status: newStatus });
              
              if (newStatus === 'done' && user) {
                // Add the value to the balance (cashflow) automatically
                await addDoc(collection(db, 'cashflow'), {
                  userId: user.uid,
                  description: `Pagamento - ${order.clientName || 'Cliente'}`,
                  type: 'in',
                  value: order.total,
                  createdAt: serverTimestamp(),
                  orderId: order.id,
                });
              }

              setOrder({ ...order, status: newStatus });
            } catch (err) {
              console.error(err);
              Alert.alert('Erro', 'Não foi possível atualizar o status.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Pedido não encontrado.</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status];

  return (
    <ScrollView style={styles.container}>
      {/* Status badge */}
      <View style={[styles.statusBanner, { backgroundColor: statusCfg.color }]}>
        <Ionicons name={statusCfg.icon as any} size={22} color={colors.surface} />
        <Text style={styles.statusText}>{statusCfg.label}</Text>
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Informações</Text>
        <Row label="Pedido" value={`#${order.id.slice(-6).toUpperCase()}`} />
        <Row label="Cliente" value={order.clientName || 'Cliente'} />
        <Row
          label="Data"
          value={
            order.createdAt?.toDate
              ? order.createdAt.toDate().toLocaleString('pt-PT')
              : '---'
          }
        />
        <Row label="Total" value={`€ ${order.total?.toFixed(2) ?? '0.00'}`} highlight />
      </View>

      {/* Items */}
      {order.itemsDetail && order.itemsDetail.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Itens do pedido</Text>
          {order.itemsDetail.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.qty}×</Text>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>€ {(parseFloat(item.price.replace(',', '.')) || 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Notes */}
      {!!order.notes && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Observações</Text>
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      )}

      {/* Actions */}
      {(order.status === 'pending' || order.status === 'unpaid') && (
        <View style={styles.actionsCard}>
          <Text style={styles.sectionLabel}>Alterar status</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.success }]}
              onPress={() => handleStatusChange('done')}
              disabled={updating}
            >
              <Ionicons name="checkmark" size={16} color={colors.surface} />
              <Text style={styles.actionBtnText}>Feito</Text>
            </TouchableOpacity>

            {order.status === 'pending' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
                onPress={() => handleStatusChange('unpaid')}
                disabled={updating}
              >
                <Ionicons name="wallet-outline" size={16} color={colors.surface} />
                <Text style={styles.actionBtnText}>Falta Pagar</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.danger }]}
              onPress={() => handleStatusChange('canceled')}
              disabled={updating}
            >
              <Ionicons name="close" size={16} color={colors.surface} />
              <Text style={styles.actionBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, highlight && rowStyles.highlight]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { fontFamily: typography.fontFamily, fontSize: 14, color: colors.textSecondary },
  value: { fontFamily: typography.fontFamilyMedium, fontSize: 14, color: colors.text },
  highlight: { fontFamily: typography.fontFamilyBold, fontSize: 16, color: colors.text },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontFamily: typography.fontFamily, color: colors.textSecondary, fontSize: 16 },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    padding: spacing.m,
    margin: spacing.m,
    borderRadius: radius.m,
  },
  statusText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.surface,
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.m,
    marginBottom: spacing.m,
    borderRadius: radius.m,
    padding: spacing.m,
    ...shadows.small,
  },
  actionsCard: {
    marginHorizontal: spacing.m,
    marginBottom: spacing.m,
  },
  sectionLabel: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.m,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemQty: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: colors.textSecondary,
    width: 30,
  },
  itemName: {
    flex: 1,
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.text,
  },
  itemPrice: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: colors.text,
  },
  notesText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.s,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    ...shadows.small,
  },
  actionBtnText: {
    fontFamily: typography.fontFamilyBold,
    color: colors.surface,
    fontSize: 13,
  },
});
