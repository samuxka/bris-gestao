import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../../../theme/theme';
import FAB from '../../../components/FAB';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTitleStyle: {
            fontFamily: typography.fontFamilyBold,
            color: colors.primary,
          },
          tabBarLabelStyle: {
            fontFamily: typography.fontFamilyMedium,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="pedidos"
          options={{
            title: 'Pedidos',
            tabBarIcon: ({ color }) => <Ionicons name="receipt" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="caixa"
          options={{
            title: 'Caixa',
            tabBarIcon: ({ color }) => <Ionicons name="cash" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="receitas"
          options={{
            title: 'Receitas',
            tabBarIcon: ({ color }) => <Ionicons name="book" size={24} color={color} />,
          }}
        />
      </Tabs>

      {/* Global FAB rendered above all tabs */}
      <FAB />
    </View>
  );
}
