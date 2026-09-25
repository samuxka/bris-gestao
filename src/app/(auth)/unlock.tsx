import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, radius } from '../../theme/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function UnlockScreen() {
  const { unlockApp, isUnlocked, signOut, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isUnlocked) {
      router.replace('/(app)/(tabs)');
    } else {
      handleUnlock();
    }
  }, [isUnlocked]);

  const handleUnlock = async () => {
    setLoading(true);
    await unlockApp();
    setLoading(false);
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="lock-closed-outline" size={64} color={colors.primary} style={styles.icon} />
        <Text style={styles.title}>App Bloqueada</Text>
        <Text style={styles.subtitle}>Use a biometria para aceder à sua conta</Text>

        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={handleUnlock}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>Desbloquear</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={signOut}
        >
          <Text style={styles.secondaryButtonText}>Terminar Sessão</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    alignItems: 'center',
    padding: spacing.xl,
  },
  icon: {
    marginBottom: spacing.l,
  },
  title: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 24,
    color: colors.text,
    marginBottom: spacing.s,
  },
  subtitle: {
    fontFamily: typography.fontFamily,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.m,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.m,
  },
  primaryButtonText: {
    fontFamily: typography.fontFamilyMedium,
    color: colors.surface,
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: spacing.m,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontFamily: typography.fontFamilyMedium,
    color: colors.danger,
    fontSize: 16,
  },
});
