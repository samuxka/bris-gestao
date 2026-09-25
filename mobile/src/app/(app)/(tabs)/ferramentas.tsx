import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';

export default function Ferramentas() {
  const router = useRouter();

  const tools = [
    {
      id: 'receitas',
      title: 'Receitas',
      icon: 'book',
      route: '/(app)/receitas',
      description: 'Gira as suas receitas',
    },
    {
      id: 'calculadora',
      title: 'Calculadora de Custos',
      icon: 'calculator',
      route: '/(app)/calculadora',
      description: 'Calcule o custo de uma receita',
    },
    {
      id: 'inventario',
      title: 'Inventário',
      icon: 'cube',
      route: '/(app)/inventario',
      description: 'Gira o seu stock de produtos',
    },
    {
      id: 'lista-compras',
      title: 'Lista de Compras',
      icon: 'cart',
      route: '/(app)/lista-compras',
      description: 'Gira as suas listas de compras',
    },
  ];

  return (
    <View style={styles.container}>
      {tools.map((tool) => (
        <TouchableOpacity
          key={tool.id}
          style={styles.card}
          onPress={() => router.push(tool.route as any)}
        >
          <View style={styles.iconContainer}>
            <Ionicons name={tool.icon as any} size={28} color={colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{tool.title}</Text>
            <Text style={styles.cardDescription}>{tool.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.m,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.m,
    borderRadius: radius.m,
    marginBottom: spacing.m,
    ...shadows.medium,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.m,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.text,
  },
  cardDescription: {
    fontFamily: typography.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
