import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal', title: 'Configurações' }} />
      <Stack.Screen name="recipe/[id]" options={{ title: 'Detalhes da Receita' }} />
      <Stack.Screen name="recipe/add" options={{ presentation: 'modal', title: 'Adicionar Receita' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Detalhes do Pedido' }} />
      <Stack.Screen name="order/add" options={{ presentation: 'modal', title: 'Novo Pedido' }} />
      <Stack.Screen name="cashflow/add" options={{ presentation: 'modal', title: 'Nova Transferência' }} />
      <Stack.Screen name="receitas" options={{ title: 'Receitas' }} />
      <Stack.Screen name="inventario/index" options={{ title: 'Inventário' }} />
      <Stack.Screen name="inventario/add" options={{ presentation: 'modal', title: 'Adicionar Produto' }} />
      <Stack.Screen name="calculadora" options={{ title: 'Calculadora de Custos' }} />
      <Stack.Screen name="lista-compras/index" options={{ title: 'Lista de Compras' }} />
      <Stack.Screen name="lista-compras/[id]" options={{ title: 'Detalhes da Lista' }} />
      <Stack.Screen name="lista-compras/add" options={{ presentation: 'modal', title: 'Nova Lista de Compras' }} />
    </Stack>
  );
}
