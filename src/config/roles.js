const ROLES = {
  guest:       { level: 0, label: 'Guest' },
  member:      { level: 1, label: 'Member' },
  verified:    { level: 2, label: 'Verified' },
  contributor: { level: 3, label: 'Contributor' },
  author:      { level: 4, label: 'Author' },
  editor:      { level: 5, label: 'Editor' },
  moderator:   { level: 6, label: 'Moderator' },
  support:     { level: 7, label: 'Support' },
  admin:       { level: 8, label: 'Admin' },
  superadmin:  { level: 9, label: 'Super Admin' },
};
function roleLevel(r) { return ROLES[r]?.level ?? 0; }
function canManageUser(actorRole, targetRole) { return roleLevel(actorRole) > roleLevel(targetRole); }
function hasPermission(role, perm) { return roleLevel(role) >= 6; } // simplified
module.exports = { ROLES, roleLevel, canManageUser, hasPermission };
