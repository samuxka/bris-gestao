import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';
import { CustomAlert } from '../../../utils/CustomAlert';

interface Recipe {
  id: string;
  name: string;
  category: string;
  prepTime: string;
  ingredients: string;
  instructions: string;
  createdAt: any;
}

export default function RecipeDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'recipes', id as string)).then((snap) => {
      if (snap.exists()) {
        setRecipe({ id: snap.id, ...snap.data() } as Recipe);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Receita não encontrada.</Text>
      </View>
    );
  }

  const handleDelete = () => {
    CustomAlert.alert('Excluir Receita', 'Tem certeza que deseja excluir esta receita?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'recipes', recipe.id));
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{recipe.name}</Text>
        <View style={styles.meta}>
          <View style={styles.metaChip}>
            <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
            <Text style={styles.metaText}>{recipe.category}</Text>
          </View>
          {!!recipe.prepTime && (
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={styles.metaText}>{recipe.prepTime}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Ingredients */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Ionicons name="list-outline" size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Ingredientes</Text>
        </View>
        {recipe.ingredients.split('\n').filter(Boolean).map((line, i) => (
          <View key={i} style={styles.ingredientRow}>
            <View style={styles.bullet} />
            <Text style={styles.ingredientText}>{line.trim()}</Text>
          </View>
        ))}
      </View>

      {/* Instructions */}
      {!!recipe.instructions && (
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Modo de preparo</Text>
          </View>
          <Text style={styles.instructionsText}>{recipe.instructions}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsCard}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: '/(app)/recipe/add', params: { editId: recipe.id } })}
          >
            <Ionicons name="pencil" size={18} color={colors.surface} />
            <Text style={styles.actionBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.danger }]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={18} color={colors.surface} />
            <Text style={styles.actionBtnText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontFamily: typography.fontFamily, color: colors.textSecondary, fontSize: 16 },
  header: {
    backgroundColor: colors.surface,
    padding: spacing.l,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 26,
    color: colors.text,
    marginBottom: spacing.m,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.s,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
  },
  metaText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 13,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    margin: spacing.m,
    marginBottom: 0,
    borderRadius: radius.m,
    padding: spacing.l,
    ...shadows.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    marginBottom: spacing.m,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.text,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s,
    paddingVertical: spacing.xs,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  ingredientText: {
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  instructionsText: {
    fontFamily: typography.fontFamily,
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  actionsCard: {
    marginHorizontal: spacing.m,
    marginTop: spacing.m,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  actionBtn: {
    flex: 1,
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
    fontSize: 15,
  },
});
