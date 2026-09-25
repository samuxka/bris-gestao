import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { colors, typography, spacing, radius } from '../../../theme/theme';

export default function InventarioEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('g');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'inventory', id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name);
          setPrice(data.price.toString());
          setQuantity(data.quantity.toString());
          setUnit(data.unit || 'g');
        } else {
          Alert.alert('Erro', 'Produto não encontrado.');
          router.back();
        }
      } catch (error) {
        console.error("Erro ao buscar produto:", error);
        Alert.alert('Erro', 'Não foi possível carregar os dados.');
      } finally {
        setFetching(false);
      }
    };
    fetchItem();
  }, [id]);

  const handleSave = async () => {
    if (!name || !price || !quantity) {
      Alert.alert('Erro', 'Por favor preencha todos os campos.');
      return;
    }

    if (!user || !id) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'inventory', id as string), {
        name,
        price: parseFloat(price.replace(',', '.')),
        quantity: parseFloat(quantity.replace(',', '.')),
        unit,
        updatedAt: new Date().toISOString(),
      });
      router.back();
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      Alert.alert('Erro', 'Não foi possível salvar as alterações.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView 
      style={styles.container}
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      <Text style={styles.label}>Nome do Produto</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Farinha de Trigo"
        value={name}
        onChangeText={setName}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Quantidade Total</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 1000"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.unitContainer}>
          <Text style={styles.label}>Unidade</Text>
          <View style={styles.unitSelector}>
            {['g', 'kg', 'ml', 'l', 'un'].map((u) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.unitOption,
                  unit === u && styles.unitOptionSelected
                ]}
                onPress={() => setUnit(u)}
              >
                <Text style={[
                  styles.unitText,
                  unit === u && styles.unitTextSelected
                ]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.label}>Preço da Quantidade (em €)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 1.20"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.buttonText}>Salvar Alterações</Text>
        )}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.m,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    padding: spacing.m,
    borderRadius: radius.m,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.m,
    marginBottom: spacing.m,
  },
  flex1: {
    flex: 1,
  },
  unitContainer: {
    flex: 1,
  },
  unitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  unitOption: {
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    borderRadius: radius.s,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.text,
  },
  unitTextSelected: {
    color: colors.surface,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.m,
    borderRadius: radius.m,
    alignItems: 'center',
    marginTop: spacing.l,
    marginBottom: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    color: colors.surface,
  },
});
