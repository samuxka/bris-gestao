import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius, shadows } from '../theme/theme';

const ACTIONS = [
  { label: 'Nova transferência', icon: 'swap-horizontal', route: '/cashflow/add' },
  { label: 'Novo produto', icon: 'cube', route: '/inventario/add' },
  { label: 'Novo pedido', icon: 'receipt', route: '/order/add' },
  { label: 'Nova receita', icon: 'book', route: '/recipe/add' },
  { label: 'Nova lista', icon: 'cart', route: '/lista-compras/add' },
];

export default function FAB() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toValue = open ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      friction: 7,
    }).start();
    setOpen(!open);
  };

  const handleAction = (route: string) => {
    setOpen(false);
    animation.setValue(0);
    router.push(route as any);
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      {/* Backdrop */}
      {open && (
        <Pressable style={styles.backdrop} onPress={toggle} />
      )}

      <View style={styles.container} pointerEvents="box-none">
        {/* Dropdown items — rendered from bottom to top */}
        {ACTIONS.map((action, index) => {
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(index + 1) * 64],
          });
          const opacity = animation.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, 0, 1],
          });

          return (
            <Animated.View
              key={action.label}
              style={[styles.actionItem, { opacity, transform: [{ translateY }] }]}
              pointerEvents={open ? 'auto' : 'none'}
            >
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => handleAction(action.route)}
              >
                <View style={styles.actionLabel}>
                  <Text style={styles.actionText}>{action.label}</Text>
                </View>
                <View style={styles.actionIcon}>
                  <Ionicons name={action.icon as any} size={20} color={colors.surface} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Main FAB */}
        <TouchableOpacity style={styles.fab} onPress={toggle} activeOpacity={0.85}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="add" size={28} color={colors.surface} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.2)',
    zIndex: 98,
  },
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 99,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: spacing.m,
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  actionItem: {
    position: 'absolute',
    right: spacing.m + 6, // centers icon over the FAB
    bottom: 90 + 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionLabel: {
    backgroundColor: colors.text,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radius.m,
    marginRight: spacing.s,
    ...shadows.small,
  },
  actionText: {
    fontFamily: typography.fontFamilyMedium,
    fontSize: 14,
    color: colors.surface,
  },
  actionIcon: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
});
