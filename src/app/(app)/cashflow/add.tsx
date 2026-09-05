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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { uploadToCloudinary } from '../../../services/cloudinary';
import { colors, typography, spacing, radius, shadows } from '../../../theme/theme';

type TransferType = 'in' | 'out';

export default function AddCashflow() {
  const router = useRouter();
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [type, setType] = useState<TransferType>('in');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const pickImage = () => {
    Alert.alert('Anexar Comprovativo', 'Escolha a origem da imagem', [
      {
        text: 'Tirar Foto',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Atenção', 'Precisamos de permissão para aceder à câmara.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
          });
          if (!result.canceled) {
            setImageUris((prev) => [...prev, result.assets[0].uri]);
          }
        },
      },
      {
        text: 'Escolher da Galeria',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
            allowsMultipleSelection: true,
          });
          if (!result.canceled) {
            const newUris = result.assets.map((a) => a.uri);
            setImageUris((prev) => [...prev, ...newUris]);
          }
        },
      },
      {
        text: 'Cancelar',
        style: 'cancel',
      },
    ]);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Atenção', 'Insira uma descrição.');
      return;
    }
    const numValue = parseFloat(value.replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) {
      Alert.alert('Atenção', 'Insira um valor válido.');
      return;
    }

    setSaving(true);
    try {
      const receiptUrls: string[] = [];
      if (imageUris.length > 0) {
        for (const uri of imageUris) {
          const url = await uploadToCloudinary(uri);
          if (url) {
            receiptUrls.push(url);
          } else {
            Alert.alert('Erro', 'Não foi possível enviar um ou mais comprovantes.');
            setSaving(false);
            return;
          }
        }
      }

      await addDoc(collection(db, 'cashflow'), {
        userId: user!.uid,
        description: description.trim(),
        type,
        value: numValue,
        receiptUrls,
        createdAt: serverTimestamp(),
      });
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Type Toggle */}
        <Text style={styles.label}>Tipo de lançamento</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, type === 'in' && styles.toggleActive('in')]}
            onPress={() => setType('in')}
          >
            <Ionicons
              name="arrow-up-circle"
              size={18}
              color={type === 'in' ? colors.surface : colors.success}
            />
            <Text style={[styles.toggleText, type === 'in' && { color: colors.surface }]}>
              Entrada
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, type === 'out' && styles.toggleActive('out')]}
            onPress={() => setType('out')}
          >
            <Ionicons
              name="arrow-down-circle"
              size={18}
              color={type === 'out' ? colors.surface : colors.danger}
            />
            <Text style={[styles.toggleText, type === 'out' && { color: colors.surface }]}>
              Saída
            </Text>
          </TouchableOpacity>
        </View>

        {/* Value */}
        <Text style={styles.label}>Valor (€)</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputPrefix}>€</Text>
          <TextInput
            style={styles.inputInner}
            placeholder="0,00"
            placeholderTextColor={colors.textSecondary}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Description */}
        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: Venda do dia, Compra de farinha..."
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          autoCapitalize="sentences"
          multiline
        />

        {/* Receipts / Comprovantes */}
        <Text style={styles.label}>Comprovantes (opcional)</Text>
        <View style={styles.imagesWrapper}>
          {imageUris.map((uri, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri }} style={styles.receiptPreview} />
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setImageUris((prev) => prev.filter((_, i) => i !== index))}
              >
                <Ionicons name="close" size={16} color={colors.surface} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.pickImageSmallBtn} onPress={pickImage}>
            <Ionicons name="add" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: type === 'out' ? colors.danger : colors.success },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.saveBtnText}>
              Registar {type === 'in' ? 'Entrada' : 'Saída'}
            </Text>
          )}
        </TouchableOpacity>
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
    gap: spacing.s,
  },
  label: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.m,
    marginBottom: spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toggleActive: (t: TransferType) => ({
    backgroundColor: t === 'in' ? colors.success : colors.danger,
    borderColor: t === 'in' ? colors.success : colors.danger,
  }),
  toggleText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 15,
    color: colors.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.m,
    ...shadows.small,
  },
  inputPrefix: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  inputInner: {
    flex: 1,
    fontFamily: typography.fontFamilyMedium,
    fontSize: 18,
    color: colors.text,
    paddingVertical: spacing.m,
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
    minHeight: 80,
    textAlignVertical: 'top',
    ...shadows.small,
  },
  imagesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
  },
  pickImageSmallBtn: {
    width: 80,
    height: 100,
    borderRadius: radius.m,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  imageContainer: {
    position: 'relative',
  },
  receiptPreview: {
    width: 80,
    height: 100,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.danger,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  saveBtn: {
    marginTop: spacing.xl,
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
