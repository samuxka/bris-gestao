import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { colors, typography, spacing, radius } from '../../theme/theme';
import * as LocalAuthentication from 'expo-local-authentication';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setBiometricsEnabled, biometricsEnabled } = useAuth();
  const { showConfirm } = useAlert();
  const [hasBiometrics, setHasBiometrics] = useState(false);

  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometrics(hasHardware && isEnrolled);
    })();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Preencha email e senha.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Ask to enable biometrics if supported and not already enabled
      if (hasBiometrics && !biometricsEnabled) {
        showConfirm(
          'Ativar Biometria',
          'Deseja usar a biometria para entrar mais rapidamente nas próximas vezes?',
          async () => {
            await setBiometricsEnabled(true);
          },
          'Sim',
          'Não'
        );
      }
    } catch (err: any) {
      console.error(err);
      setError('Credenciais inválidas.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Pastelaria</Text>
          <Text style={styles.subtitle}>Faça login para continuar</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.l,
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 32,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.m,
  },
  input: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  primaryButtonText: {
    fontFamily: typography.fontFamilyMedium,
    color: colors.surface,
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.m,
    borderRadius: radius.m,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    fontFamily: typography.fontFamilyMedium,
    color: colors.primary,
    fontSize: 16,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    textAlign: 'center',
  },
});
