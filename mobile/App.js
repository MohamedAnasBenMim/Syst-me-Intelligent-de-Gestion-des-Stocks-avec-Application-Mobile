import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { COLORS } from './src/constants/theme';

// Auth
import LoginScreen              from './src/screens/auth/LoginScreen';

// Tabs visibles
import HomeScreen               from './src/screens/HomeScreen';
import InventoryScreen          from './src/screens/InventoryScreen';
import ScannerScreen            from './src/screens/ScannerScreen';
import AlertsScreen             from './src/screens/AlertsScreen';
import ProfileScreen            from './src/screens/ProfileScreen';

// Tabs cachés (navigables via navigation.navigate)
import WarehousesScreen         from './src/screens/WarehousesScreen';
import MovementsScreen          from './src/screens/MovementsScreen';
import NotificationsScreen      from './src/screens/NotificationsScreen';
import ReportingScreen          from './src/screens/ReportingScreen';
import IAChatScreen             from './src/screens/IAChatScreen';
import PromotionsScreen         from './src/screens/PromotionsScreen';
import UsersScreen              from './src/screens/UsersScreen';
import FournisseursScreen       from './src/screens/FournisseursScreen';
import TransfertsScreen         from './src/screens/TransfertsScreen';
import ReapprovisionnementScreen from './src/screens/ReapprovisionnementScreen';

enableScreens();

const Tab = createBottomTabNavigator();

const HiddenTab = () => null;

function ScannerTabIcon({ focused }) {
  return (
    <View style={[styles.scannerIcon, focused && styles.scannerIconActive]}>
      <Ionicons
        name={focused ? 'scan' : 'scan-outline'}
        size={24}
        color={focused ? COLORS.card : COLORS.textSecondary}
      />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {/* ── Tabs visibles ── */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          tabBarLabel: 'Stocks',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{
          tabBarLabel: 'Scanner',
          tabBarIcon: ({ focused }) => <ScannerTabIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarLabel: 'Alertes',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* ── Tabs cachés ── */}
      <Tab.Screen name="Warehouses"         component={WarehousesScreen}          options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="Movements"          component={MovementsScreen}           options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="Notifications"      component={NotificationsScreen}       options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="Reporting"          component={ReportingScreen}           options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="IAChat"             component={IAChatScreen}              options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="Promotions"         component={PromotionsScreen}          options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="Users"              component={UsersScreen}               options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="Fournisseurs"       component={FournisseursScreen}        options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="Transferts"         component={TransfertsScreen}          options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
      <Tab.Screen name="Reapprovisionnement" component={ReapprovisionnementScreen} options={{ tabBarButton: HiddenTab, tabBarStyle: { display: 'none' } }} />
    </Tab.Navigator>
  );
}

function AuthScreen() {
  return <LoginScreen />;
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tab.Screen name="Login" component={AuthScreen} options={{ tabBarButton: HiddenTab }} />
      </Tab.Navigator>
    );
  }

  return <MainTabs />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 68,
    paddingBottom: 12,
    paddingTop: 8,
    shadowColor: '#004678',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  scannerIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  scannerIconActive: {
    backgroundColor: COLORS.primary,
  },
});
