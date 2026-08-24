const ACTIONS = [
  { key: 'list', label: 'List' },
  { key: 'add', label: 'Add' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' }
];

const PERMISSION_MODULES = [
  { key: 'members', label: 'Members' },
  { key: 'committee', label: 'Committee Members' },
  { key: 'roles', label: 'Roles' },
  { key: 'festivals', label: 'Festivals' },
  { key: 'events', label: 'Events' },
  { key: 'businesses', label: 'Business' },
  { key: 'students', label: 'Students' },
  { key: 'matrimonies', label: 'Matrimonies' },
  { key: 'news', label: 'News' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'donations', label: 'Donations' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'masters', label: 'Masters' },
  { key: 'birthday', label: 'Birthdays' },
  { key: 'job-vacancy', label: 'Job Vacancies' },
  { key: 'posts', label: 'Posts' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'contact-inquiries', label: 'Contact Inquiries' }
];

const PERMISSIONS = [
  { key: 'dashboard.view', label: 'Dashboard' },
  { key: 'settings.edit', label: 'Theme Config Edit', module: 'settings', module_label: 'Theme Config', action: 'edit', action_label: 'Edit' },
  ...PERMISSION_MODULES.flatMap((module) => ACTIONS.map((action) => ({
    key: `${module.key}.${action.key}`,
    label: `${module.label} ${action.label}`,
    module: module.key,
    module_label: module.label,
    action: action.key,
    action_label: action.label,
    master_type: module.masterType || ''
  })))
];

const LEGACY_PERMISSION_KEYS = [
  'committee.manage',
  'users.manage',
  'roles.manage',
  'festivals.manage',
  'events.manage',
  'gallery.manage',
  'banners.manage',
  'businesses.manage',
  'news.manage',
  'posts.manage',
  'contact-inquiries.manage',
  'masters.manage',
  'matrimonies.manage',
  'settings.manage',
  'donations.manage',
  'expenses.manage',
  'expense-category.manage'
];

const ALL_PERMISSION_KEYS = [
  ...PERMISSIONS.map((permission) => permission.key),
  ...LEGACY_PERMISSION_KEYS
];

module.exports = {
  ACTIONS,
  ALL_PERMISSION_KEYS,
  LEGACY_PERMISSION_KEYS,
  PERMISSION_MODULES,
  PERMISSIONS
};
