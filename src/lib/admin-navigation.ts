export type AdminNavigationItem = {
  href: string;
  title: string;
  roles: readonly string[];
};

export type AdminNavigationTab = {
  href: string;
  title: string;
};

export type AdminNavigationGroup = {
  id: string;
  title: string;
  landingHref: string;
  items: readonly AdminNavigationItem[];
  tabs: readonly AdminNavigationTab[];
};

const allStaff = ["content_editor", "reviewer", "payment_reviewer", "support_agent", "admin"] as const;
const contentStaff = ["content_editor", "reviewer", "admin"] as const;
const editors = ["content_editor", "admin"] as const;
const editorsAndReviewers = ["content_editor", "reviewer", "admin"] as const;
const reviewers = ["reviewer", "admin"] as const;
const paymentStaff = ["payment_reviewer", "admin"] as const;
const supportStaff = ["support_agent", "admin"] as const;
const admins = ["admin"] as const;

/**
 * Items define route authorization and metadata. Tabs are a smaller contextual
 * subset, so simplifying navigation never removes a route-level permission.
 */
export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    landingHref: "/admin",
    items: [{ href: "/admin", title: "Dashboard", roles: allStaff }],
    tabs: [],
  },
  {
    id: "question-bank",
    title: "Question Bank",
    landingHref: "/admin/questions",
    items: [
      { href: "/admin/questions", title: "All questions", roles: contentStaff },
      { href: "/admin/questions/new", title: "Upload content", roles: editors },
      { href: "/admin/assets", title: "Files & media", roles: contentStaff },
      { href: "/admin/reviews", title: "Review", roles: reviewers },
      { href: "/admin/sources", title: "Source files", roles: contentStaff },
      // Kept as a compatibility route until old bookmarks have been migrated.
      { href: "/admin/content", title: "Question Bank", roles: contentStaff },
    ],
    tabs: [
      { href: "/admin/questions", title: "All questions" },
      { href: "/admin/questions/new", title: "Upload content" },
      { href: "/admin/assets", title: "Files & media" },
      { href: "/admin/reviews", title: "Review" },
    ],
  },
  {
    id: "exam-manager",
    title: "Exam Manager",
    landingHref: "/admin/exam-forms",
    items: [
      { href: "/admin/exam-forms", title: "Exam Manager", roles: editorsAndReviewers },
      { href: "/admin/blueprints", title: "Blueprints", roles: editorsAndReviewers },
      { href: "/admin/exam-preview", title: "Selected exam preview", roles: editorsAndReviewers },
      { href: "/admin/attempts", title: "Exam attempts", roles: reviewers },
    ],
    tabs: [
      { href: "/admin/exam-forms", title: "Exams" },
      { href: "/admin/exam-preview", title: "Preview" },
      { href: "/admin/blueprints", title: "Blueprints" },
      { href: "/admin/attempts", title: "Attempts" },
    ],
  },
  {
    id: "students",
    title: "Students",
    landingHref: "/admin/users",
    items: [
      { href: "/admin/users", title: "Students and staff", roles: admins },
      { href: "/admin/support", title: "Support requests", roles: supportStaff },
      { href: "/admin/privacy", title: "Privacy requests", roles: admins },
    ],
    tabs: [
      { href: "/admin/users", title: "Students" },
      { href: "/admin/support", title: "Support" },
      { href: "/admin/privacy", title: "Privacy" },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    landingHref: "/admin/payments",
    items: [
      { href: "/admin/payments", title: "Pending verification", roles: paymentStaff },
      { href: "/admin/plans", title: "Plans and pricing", roles: admins },
      { href: "/admin/entitlements", title: "Plans and access", roles: admins },
      { href: "/admin/settings/payments", title: "Payment settings", roles: admins },
    ],
    tabs: [
      { href: "/admin/payments", title: "Reviews" },
      { href: "/admin/plans", title: "Plans" },
      { href: "/admin/entitlements", title: "Access" },
      { href: "/admin/settings/payments", title: "Payment setup" },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    landingHref: "/admin/settings",
    items: [
      { href: "/admin/settings", title: "Platform settings", roles: admins },
      { href: "/admin/reports", title: "Reports and exports", roles: paymentStaff },
      { href: "/admin/audit", title: "Audit log", roles: admins },
      { href: "/admin/staff", title: "Staff and roles", roles: admins },
      { href: "/admin/announcements", title: "Announcements", roles: admins },
      { href: "/admin/settings/integrations", title: "Integrations", roles: admins },
      { href: "/admin/settings/security", title: "Security", roles: admins },
      { href: "/admin/settings/notifications", title: "Notifications", roles: admins },
      { href: "/admin/settings/general", title: "General settings", roles: admins },
      { href: "/admin/settings/maintenance", title: "Maintenance", roles: admins },
      { href: "/admin/settings/email", title: "Email settings", roles: admins },
    ],
    tabs: [
      { href: "/admin/settings", title: "Configuration" },
      { href: "/admin/staff", title: "Staff" },
      { href: "/admin/reports", title: "Reports" },
      { href: "/admin/audit", title: "Activity" },
      { href: "/admin/settings/integrations", title: "Integrations" },
    ],
  },
];

export const ADMIN_NAVIGATION_ITEMS = ADMIN_NAVIGATION_GROUPS.flatMap((group) => group.items);

export function getVisibleAdminNavigationGroups(roles: readonly string[]) {
  return ADMIN_NAVIGATION_GROUPS.map((group) => {
    const items = group.items.filter((item) => item.roles.some((role) => roles.includes(role)));
    const availableHrefs = new Set(items.map((item) => item.href));
    return {
      ...group,
      items,
      landingHref: availableHrefs.has(group.landingHref) ? group.landingHref : items[0]?.href ?? group.landingHref,
      tabs: group.tabs.filter((tab) => availableHrefs.has(tab.href)),
    };
  }).filter((group) => group.items.length > 0);
}
