// ─── KPI Cards ────────────────────────────────────────────────────────────────
export const kpiData = [
  {
    id: '1',
    label: 'Total Products',
    value: '12,459',
    change: '+12%',
    icon: 'cube-outline',
    bgColor: '#E6EFF7',
    iconColor: '#004678',
  },
  {
    id: '2',
    label: 'Low Stock Alerts',
    value: '47',
    badge: '23',
    icon: 'warning-outline',
    bgColor: '#FEF5E7',
    iconColor: '#F39C12',
  },
  {
    id: '3',
    label: 'Active Warehouses',
    value: '8',
    badge: 'Live',
    icon: 'pulse-outline',
    bgColor: '#E6FAF6',
    iconColor: '#00B894',
  },
  {
    id: '4',
    label: 'This Month',
    value: '3,482',
    change: '+8%',
    icon: 'trending-up-outline',
    bgColor: '#EBF5FB',
    iconColor: '#2980B9',
  },
];

// ─── Chart ────────────────────────────────────────────────────────────────────
export const chartData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      data: [3800, 4200, 4500, 4100, 4700, 5200, 4800],
      color: (opacity = 1) => `rgba(0, 70, 120, ${opacity})`,
      strokeWidth: 3,
    },
  ],
};

// ─── Recent Activity ──────────────────────────────────────────────────────────
export const activityData = [
  {
    id: '1',
    title: 'Stock Added',
    description: 'Premium Coffee Beans • Warehouse A',
    badge: '+250 units',
    time: '5m ago',
    iconName: 'cube-outline',
    iconBg: '#E6FAF6',
    iconColor: '#00B894',
    badgeColor: '#E6FAF6',
    badgeText: '#00B894',
  },
  {
    id: '2',
    title: 'Low Stock Alert',
    description: 'Organic Tea Leaves • Warehouse B',
    badge: '12 units left',
    time: '12m ago',
    iconName: 'warning-outline',
    iconBg: '#FEF5E7',
    iconColor: '#F39C12',
    badgeColor: '#FEF5E7',
    badgeText: '#F39C12',
  },
  {
    id: '3',
    title: 'Transfer Complete',
    description: 'Ceramic Mugs • Warehouse C',
    badge: '180 units',
    time: '1h ago',
    iconName: 'pulse-outline',
    iconBg: '#EBF5FB',
    iconColor: '#2980B9',
    badgeColor: '#EBF5FB',
    badgeText: '#2980B9',
  },
];

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventoryData = [
  { id: '1', name: 'Premium Coffee Beans', sku: 'PCB-001', warehouse: 'Warehouse A', quantity: 1250, status: 'in_stock', category: 'Beverage',    emoji: '☕' },
  { id: '2', name: 'Organic Tea Leaves',   sku: 'OTL-002', warehouse: 'Warehouse B', quantity: 12,   status: 'low',      category: 'Food',        emoji: '🍵' },
  { id: '3', name: 'Ceramic Mugs',         sku: 'CM-003',  warehouse: 'Warehouse C', quantity: 0,    status: 'out',      category: 'Supplies',    emoji: '🏺' },
  { id: '4', name: 'Wireless Earbuds',     sku: 'WE-004',  warehouse: 'Warehouse A', quantity: 340,  status: 'in_stock', category: 'Electronics', emoji: '🎧' },
  { id: '5', name: 'Steel Water Bottles',  sku: 'SWB-005', warehouse: 'Warehouse B', quantity: 85,   status: 'in_stock', category: 'Supplies',    emoji: '🍶' },
  { id: '6', name: 'Laptop Stand',         sku: 'LS-006',  warehouse: 'Warehouse C', quantity: 8,    status: 'low',      category: 'Electronics', emoji: '💻' },
];

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsData = [
  {
    id: '1', type: 'critical',
    title: 'Critical Stock Level',
    description: 'Ceramic Mugs have reached critically low levels',
    product: 'Ceramic Mugs', location: 'Warehouse C', quantity: '0 units',
    time: '5m ago', action: 'Restock Now',
  },
  {
    id: '2', type: 'low',
    title: 'Low Stock Alert',
    description: 'Organic Tea Leaves running low in inventory',
    product: 'Organic Tea Leaves', location: 'Warehouse B', quantity: '12 units left',
    time: '12m ago', action: 'Order More',
  },
  {
    id: '3', type: 'ai',
    title: 'AI Restock Recommendation',
    description: 'Based on sales trends, consider restocking Premium Coffee Beans',
    product: 'Premium Coffee Beans', location: 'Warehouse A', quantity: '1250 units',
    time: '1h ago', action: 'View Details',
  },
  {
    id: '4', type: 'low',
    title: 'Low Stock Alert',
    description: 'Laptop Stand inventory is below minimum threshold',
    product: 'Laptop Stand', location: 'Warehouse C', quantity: '8 units left',
    time: '2h ago', action: 'Order More',
  },
  {
    id: '5', type: 'ai',
    title: 'AI Restock Recommendation',
    description: 'Demand surge detected for Steel Water Bottles next week',
    product: 'Steel Water Bottles', location: 'Warehouse B', quantity: '85 units',
    time: '3h ago', action: 'View Details',
  },
];

// ─── Recent Scans ─────────────────────────────────────────────────────────────
export const recentScans = [
  { id: '1', name: 'Organic Tea Leaves',  sku: 'OTL-002', time: '2m ago' },
  { id: '2', name: 'Ceramic Mugs',        sku: 'CM-003',  time: '5m ago' },
  { id: '3', name: 'Wireless Earbuds',    sku: 'WE-004',  time: '18m ago' },
];
