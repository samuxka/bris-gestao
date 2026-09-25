import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, radius, shadows } from '../../theme/theme';

export default function Settings() {
  const { signOut, user, userName, updateUserName, biometricsEnabled, setBiometricsEnabled } = useAuth();
  const [name, setName] = useState(userName);
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Por favor, insira um nome.');
      return;
    }
    setSaving(true);
    try {
      await updateUserName(name.trim());
      Alert.alert('Sucesso', 'Nome atualizado com sucesso!');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o nome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Perfil</Text>
      <View style={styles.card}>
        <Text style={styles.inputLabel}>Seu nome</Text>
        <TextInput
          style={styles.input}
          placeholder="Como quer ser chamado?"
          placeholderTextColor={colors.textSecondary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveName}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Salvar nome</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Conta</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <Text style={styles.inputLabel}>Email</Text>
          <Text style={styles.emailText}>{user?.email}</Text>
        </View>
        <View style={styles.divider} />
        <View style={[styles.settingRow, { alignItems: 'center' }]}>
          <View>
            <Text style={styles.settingTitle}>Desbloqueio Biométrico</Text>
            <Text style={styles.settingDesc}>Pedir impressão digital/Face ID ao abrir a app</Text>
          </View>
          <Switch
            value={biometricsEnabled}
            onValueChange={setBiometricsEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.m,
    backgroundColor: colors.background,
  },
  sectionLabel: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.s,
    marginTop: spacing.m,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.m,
    borderRadius: radius.m,
    marginBottom: spacing.s,
    ...shadows.small,
  },
  inputLabel: {
    fontFamily: typography.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    marginBottom: spacing.m,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.s,
    borderRadius: radius.s,
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: typography.fontFamilyMedium,
    color: colors.surface,
    fontSize: 14,
  },
  emailText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 16,
    color: colors.text,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.s,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.s,
  },
  settingTitle: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 15,
    color: colors.text,
  },
  settingDesc: {
    fontFamily: typography.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
    maxWidth: 220,
  },
  logoutButton: {
    marginTop: spacing.l,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.m,
    borderRadius: radius.m,
    alignItems: 'center',
  },
  logoutText: {
    fontFamily: typography.fontFamilyMedium,
    color: colors.danger,
    fontSize: 16,
  },
});
