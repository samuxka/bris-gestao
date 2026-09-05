import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';

interface CashEntry {
  id: string;
  description: string;
  type: 'in' | 'out';
  value: number;
  receiptUrl?: string;
  receiptUrls?: string[];
  createdAt: any;
}

export default function Caixa() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'cashflow'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CashEntry));
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });
      setEntries(docs);
      setLoading(false);
    }, (err) => {
      console.error("Caixa error:", err);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const totalIn = entries.filter((e) => e.type === 'in').reduce((s, e) => s + e.value, 0);
  const totalOut = entries.filter((e) => e.type === 'out').reduce((s, e) => s + e.value, 0);
  const balance = totalIn - totalOut;

  const renderItem = ({ item }: { item: CashEntry }) => {
    const isOut = item.type === 'out';
    return (
      <View style={styles.listItem}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemDesc}>{item.description}</Text>
            <Text style={styles.itemDate}>
              {item.createdAt?.toDate
                ? item.createdAt.toDate().toLocaleString('pt-PT')
                : '---'}
            </Text>
          </View>
        </View>
        <View style={styles.rightContent}>
          {/* Legacy single receipt */}
          {item.receiptUrl && (
            <TouchableOpacity onPress={() => Linking.openURL(item.receiptUrl!)}>
              <Ionicons name="image-outline" size={20} color={colors.primary} style={styles.receiptIcon} />
            </TouchableOpacity>
          )}
          {/* New multiple receipts */}
          {item.receiptUrls?.map((url, idx) => (
            <TouchableOpacity key={idx} onPress={() => Linking.openURL(url)}>
              <Ionicons name="image-outline" size={20} color={colors.primary} style={styles.receiptIcon} />
            </TouchableOpacity>
          ))}
          <Text style={[styles.itemValue, { color: isOut ? colors.danger : colors.success }]}>
            {isOut ? '- ' : '+ '}€ {item.value.toFixed(2)}
          </Text>
        </View>
      </View>
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
      {/* Balance card — neutral dark, NOT red */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Saldo em Caixa</Text>
        <Text style={styles.summaryValue}>€ {balance.toFixed(2)}</Text>

        <View style={styles.row}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Entradas</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>
              € {totalIn.toFixed(2)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Saídas</Text>
            <Text style={[styles.statValue, { color: colors.danger }]}>
              € {totalOut.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Histórico de Fluxo</Text>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cash-outline" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>Nenhum lançamento</Text>
          <Text style={styles.emptyText}>Use o botão + para registar uma transferência</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
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
  summaryCard: {
    backgroundColor: '#1E293B', // Neutral dark — not red
    margin: spacing.m,
    padding: spacing.l,
    borderRadius: radius.l,
    alignItems: 'center',
    ...shadows.medium,
  },
  summaryLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: '#94A3B8',
  },
  summaryValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 36,
    color: '#F8FAFC',
    marginVertical: spacing.s,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    padding: spacing.m,
    marginTop: spacing.m,
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statBox: {
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
  },
  statValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.text,
    marginHorizontal: spacing.m,
    marginBottom: spacing.m,
  },
  listContent: {
    paddingHorizontal: spacing.m,
    paddingBottom: 100,
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
  itemDesc: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 16,
    color: colors.text,
  },
  itemDate: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemValue: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  receiptIcon: {
    padding: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.s,
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
