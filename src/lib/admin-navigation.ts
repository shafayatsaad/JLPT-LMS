export type AdminNavigationItem = {
  href: string;
  title: string;
  roles: readonly string[];
};

export type AdminNavigationGroup = {
  id: string;
  title: string;
  items: readonly AdminNavigationItem[];
};

const allStaff = ["content_editor", "reviewer", "payment_reviewer", "support_agent", "admin"] as const;
const contentStaff = ["content_editor", "reviewer", "admin"] as const;
const editors = ["content_editor", "admin"] as const;
const editorsAndReviewers = ["content_editor", "reviewer", "admin"] as const;
const reviewers = ["reviewer", "admin"] as const;
const paymentStaff = ["payment_reviewer", "admin"] as const;
const supportStaff = ["support_agent", "admin"] as const;
const admins = ["admin"] as const;

export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  {
    id: "overview",
    title: "Overview",
    items: [
      { href: "/admin", title: "Operational overview", roles: allStaff },
    ],
  },
  {
    id: "content",
    title: "Content",
    items: [
      { href: "/admin/content", title: "Content overview", roles: contentStaff },
      { href: "/admin/questions", title: "Question Bank", roles: contentStaff },
      { href: "/admin/questions/new", title: "Import and author", roles: editors },
      { href: "/admin/sources", title: "Source Library", roles: contentStaff },
      { href: "/admin/assets", title: "Media Library", roles: contentStaff },
      { href: "/admin/reviews", title: "Review Queue", roles: reviewers },
    ],
  },
  {
    id: "exams",
    title: "Exams",
    items: [
      { href: "/admin/exam-forms", title: "Exam Builder", roles: editorsAndReviewers },
      { href: "/admin/blueprints", title: "Exam Blueprints", roles: editorsAndReviewers },
      { href: "/admin/exam-preview", title: "Exam Preview", roles: editorsAndReviewers },
    ],
  },
  {
    id: "students",
    title: "Students",
    items: [
      { href: "/admin/users", title: "Students and Staff", roles: admins },
      { href: "/admin/support", title: "Support Requests", roles: supportStaff },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    items: [
      { href: "/admin/payments", title: "Pending Verification", roles: paymentStaff },
      { href: "/admin/plans", title: "Plans & Pricing", roles: admins },
      { href: "/admin/entitlements", title: "Plans and Access", roles: admins },
      { href: "/admin/settings/payments", title: "Payment Settings", roles: admins },
    ],
  },
  {
    id: "reports-settings",
    title: "Reports & Settings",
    items: [
      { href: "/admin/reports", title: "Reports & Exports", roles: paymentStaff },
      { href: "/admin/attempts", title: "Exam Attempts", roles: reviewers },
      { href: "/admin/audit", title: "Audit Log", roles: admins },
      { href: "/admin/settings", title: "Platform Settings", roles: admins },
      { href: "/admin/staff", title: "Staff and Roles", roles: admins },
      { href: "/admin/announcements", title: "Announcements", roles: admins },
      { href: "/admin/privacy", title: "Privacy Requests", roles: admins },
      { href: "/admin/settings/integrations", title: "Integrations", roles: admins },
      { href: "/admin/settings/security", title: "Security", roles: admins },
      { href: "/admin/settings/notifications", title: "Notifications", roles: admins },
    ],
  },
];

export const ADMIN_NAVIGATION_ITEMS = ADMIN_NAVIGATION_GROUPS.flatMap((group) => group.items);

export function getVisibleAdminNavigationGroups(roles: readonly string[]) {
  const isAdmin = roles.includes("admin");
  return ADMIN_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isAdmin || item.roles.some((role) => roles.includes(role))),
  })).filter((group) => group.items.length > 0);
}
