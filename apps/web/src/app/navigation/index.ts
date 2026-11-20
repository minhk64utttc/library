import type { Permission } from '@thu-vien/shared';

export interface NavItem {
  label: string;
  to: string;
  permission?: Permission;
  alternatePermission?: Permission;
}

const policies: NavItem = { label: 'Ch\u00ednh s\u00e1ch th\u01b0 vi\u1ec7n', to: '/management/policies', permission: 'policies:manage' };
const reports: NavItem = { label: 'B\u00e1o c\u00e1o', to: '/management/reports', permission: 'reports:read' };
const audit: NavItem = { label: 'Nh\u1eadt k\u00fd thao t\u00e1c', to: '/management/audit', permission: 'audit:read' };
const digital: NavItem = { label: 'H\u1ecdc li\u1ec7u s\u1ed1', to: '/digital/submissions', permission: 'digital:manage', alternatePermission: 'digital:publish' };

export interface NavGroup {
  label: string;
  icon: 'catalog' | 'holdings' | 'circulation' | 'admin';
  items: NavItem[];
}

const home: NavItem = { label: 'Trang chủ', to: '/' };
const records: NavItem = { label: 'Sách & tài liệu', to: '/catalog/records', permission: 'catalog:read' };
const publishers: NavItem = { label: 'Nhà xuất bản', to: '/catalog/publishers', permission: 'catalog:read' };
const holdings: NavItem = { label: 'Bản sao & vị trí kệ', to: '/holdings', permission: 'catalog:read' };
const incidents: NavItem = { label: 'Hồ sơ sự cố', to: '/incidents', permission: 'incidents:read' };
const inventory: NavItem = { label: 'Kiểm kê kho', to: '/inventory', permission: 'inventory:read' };
const loans: NavItem = { label: 'Cho mượn / Nhận trả', to: '/circulation/loans', permission: 'circulation:manage' };
const cards: NavItem = { label: 'Thẻ bạn đọc', to: '/circulation/cards', permission: 'cards:manage' };
const reservations: NavItem = { label: 'Đặt trước', to: '/circulation/reservations', permission: 'reservations:read' };
const fines: NavItem = { label: 'Khoản phạt', to: '/circulation/fines', permission: 'fines:read' };
const accounts: NavItem = { label: 'Tài khoản', to: '/accounts', permission: 'accounts:manage' };

export const NAV_ITEMS: NavItem[] = [home, records, publishers, holdings, incidents, inventory, loans, cards, reservations, fines, digital, reports, audit, accounts, policies];

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Tài liệu', icon: 'catalog', items: [records, publishers, holdings, incidents, inventory, digital] },
  { label: 'Bạn đọc & mượn trả', icon: 'circulation', items: [cards, loans, reservations, fines] },
  { label: 'Báo cáo', icon: 'holdings', items: [reports] },
  { label: 'Quản trị', icon: 'admin', items: [accounts, policies, audit] },
];
