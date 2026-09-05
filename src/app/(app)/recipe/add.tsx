import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';

type Category = 'Doce' | 'Salgado' | 'Bebida' | 'Outro';

const CATEGORIES: Category[] = ['Doce', 'Salgado', 'Bebida', 'Outro'];

export default function AddRecipe() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('Doce');
  const [prepTime, setPrepTime] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);

  React.useEffect(() => {
    if (editId) {
      getDoc(doc(db, 'recipes', editId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || '');
          setCategory(data.category || 'Doce');
          setPrepTime(data.prepTime || '');
          setIngredients(data.ingredients || '');
          setInstructions(data.instructions || '');
        }
        setLoading(false);
      });
    }
  }, [editId]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Insira o nome da receita.');
      return;
    }
    if (!ingredients.trim()) {
      Alert.alert('Atenção', 'Insira os ingredientes.');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, 'recipes', editId), {
          name: name.trim(),
          category,
          prepTime: prepTime.trim(),
          ingredients: ingredients.trim(),
          instructions: instructions.trim(),
        });
      } else {
        await addDoc(collection(db, 'recipes'), {
          userId: user!.uid,
          name: name.trim(),
          category,
          prepTime: prepTime.trim(),
          ingredients: ingredients.trim(),
          instructions: instructions.trim(),
          createdAt: serverTimestamp(),
        });
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Name */}
        <Text style={styles.label}>Nome da receita *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Pastel de Nata, Rissol de Camarão..."
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        {/* Category */}
        <Text style={styles.label}>Categoria</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryBtn, category === cat && styles.categoryBtnActive]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[styles.categoryText, category === cat && styles.categoryTextActive]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Prep time */}
        <Text style={styles.label}>Tempo de preparo</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 30 min, 1h 20min..."
          placeholderTextColor={colors.textSecondary}
          value={prepTime}
          onChangeText={setPrepTime}
        />

        {/* Ingredients */}
        <Text style={styles.label}>Ingredientes *</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder={
            '500g farinha\n3 ovos\n200ml leite\n...'
          }
          placeholderTextColor={colors.textSecondary}
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          textAlignVertical="top"
        />

        {/* Instructions */}
        <Text style={styles.label}>Modo de preparo</Text>
        <TextInput
          style={[styles.input, styles.multilineLarge]}
          placeholder="Descreva o passo a passo da receita..."
          placeholderTextColor={colors.textSecondary}
          value={instructions}
          onChangeText={setInstructions}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.saveBtnText}>{editId ? 'Atualizar Receita' : 'Salvar Receita'}</Text>
          )}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.m,
  },
  label: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.m,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.text,
    ...shadows.small,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  multilineLarge: {
    minHeight: 160,
    textAlignVertical: 'top',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
  },
  categoryBtn: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: colors.surface,
  },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    alignItems: 'center',
    ...shadows.medium,
  },
  saveBtnText: {
    fontFamily: typography.fontFamilyBold,
    color: colors.surface,
    fontSize: 16,
  },
});
