import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';
import { CustomAlert } from '../../../utils/CustomAlert';

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

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'transferencia' | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'orders', id as string)).then((snap) => {
      if (snap.exists()) {
        setOrder({ id: snap.id, ...snap.data() } as Order);
      }
      setLoading(false);
    });
  }, [id]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) {
      setReceiptUri(result.assets[0].uri);
    }
  };

  const confirmPayment = async () => {
    if (!order || !user || !paymentMethod) return;
    if (paymentMethod === 'transferencia' && !receiptUri) {
      CustomAlert.alert('Atenção', 'Anexe o comprovante de transferência.');
      return;
    }

    setUpdating(true);
    try {
      let url = null;
      if (receiptUri) {
        const response = await fetch(receiptUri);
        const blob = await response.blob();
        const filename = receiptUri.substring(receiptUri.lastIndexOf('/') + 1);
        const storageRef = ref(storage, `receipts/${user.uid}/${Date.now()}_${filename}`);
        await uploadBytes(storageRef, blob);
        url = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, 'orders', order.id), { status: 'done' });
      
      await addDoc(collection(db, 'cashflow'), {
        userId: user.uid,
        description: `Pagamento - ${order.clientName || 'Cliente'}`,
        type: 'in',
        value: order.total,
        account: paymentMethod === 'dinheiro' ? 'cofre' : 'banco',
        receiptUrls: url ? [url] : [],
        createdAt: serverTimestamp(),
        orderId: order.id,
      });

      setOrder({ ...order, status: 'done' });
      setShowPaymentModal(false);
      CustomAlert.alert('Sucesso', 'Pedido finalizado com sucesso!');
    } catch (err) {
      console.error(err);
      CustomAlert.alert('Erro', 'Não foi possível finalizar o pedido.');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!order) return;
    
    if (newStatus === 'done') {
      setPaymentMethod(null);
      setReceiptUri(null);
      setShowPaymentModal(true);
      return;
    }

    CustomAlert.alert(
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
              setOrder({ ...order, status: newStatus });
            } catch (err) {
              console.error(err);
              CustomAlert.alert('Erro', 'Não foi possível atualizar o status.');
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
      {/* Modal de Pagamento Personalizado */}
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Finalizar Pedido</Text>
            <Text style={styles.modalSubtitle}>Como o cliente pagou?</Text>
            
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <TouchableOpacity 
                style={[styles.paymentMethodBtn, paymentMethod === 'dinheiro' && styles.paymentMethodActive]} 
                onPress={() => setPaymentMethod('dinheiro')}
              >
                <Ionicons name="cash-outline" size={24} color={paymentMethod === 'dinheiro' ? colors.surface : colors.text} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'dinheiro' && { color: colors.surface }]}>Dinheiro</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.paymentMethodBtn, paymentMethod === 'transferencia' && styles.paymentMethodActive]} 
                onPress={() => setPaymentMethod('transferencia')}
              >
                <Ionicons name="card-outline" size={24} color={paymentMethod === 'transferencia' ? colors.surface : colors.text} />
                <Text style={[styles.paymentMethodText, paymentMethod === 'transferencia' && { color: colors.surface }]}>Transferência</Text>
              </TouchableOpacity>
            </View>

            {paymentMethod === 'transferencia' && (
              <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                <Text style={styles.uploadBtnText}>{receiptUri ? 'Comprovante Anexado' : 'Anexar Comprovante'}</Text>
              </TouchableOpacity>
            )}
            
            {receiptUri && (
              <Image source={{ uri: receiptUri }} style={{ width: 100, height: 100, borderRadius: 8, marginBottom: 16, alignSelf: 'center' }} />
            )}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: colors.background }]} onPress={() => setShowPaymentModal(false)}>
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { flex: 1, backgroundColor: colors.primary, opacity: !paymentMethod || (paymentMethod === 'transferencia' && !receiptUri) ? 0.5 : 1 }]} onPress={confirmPayment} disabled={updating}>
                <Text style={styles.actionBtnText}>{updating ? 'Salvando...' : 'Confirmar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.l,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    padding: spacing.l,
    ...shadows.medium,
  },
  modalTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.l,
    textAlign: 'center',
  },
  paymentMethodBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    padding: spacing.m,
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentMethodActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  paymentMethodText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.text,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.m,
    padding: spacing.m,
    marginBottom: spacing.l,
  },
  uploadBtnText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.primary,
  },
});
