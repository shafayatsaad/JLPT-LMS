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
      { href: "/admin", title: "Dashboard", roles: allStaff },
      { href: "/admin/content", title: "Content overview", roles: contentStaff },
    ],
  },
  {
    id: "content",
    title: "Content",
    items: [
      { href: "/admin/questions", title: "Question Bank", roles: contentStaff },
      { href: "/admin/questions/new", title: "Import Questions", roles: editors },
      { href: "/admin/sources", title: "Source Library", roles: contentStaff },
      { href: "/admin/assets", title: "Media Library", roles: contentStaff },
    ],
  },
  {
    id: "exams",
    title: "Exams",
    items: [
      { href: "/admin/blueprints", title: "Exam Blueprints", roles: editorsAndReviewers },
      { href: "/admin/exam-forms", title: "Exam Builder", roles: editorsAndReviewers },
      { href: "/admin/exam-preview", title: "Exam Preview", roles: editorsAndReviewers },
    ],
  },
  {
    id: "review",
    title: "Review",
    items: [
      { href: "/admin/reviews", title: "Pending Reviews", roles: reviewers },
    ],
  },
  {
    id: "users-payments",
    title: "Users & Payments",
    items: [
      { href: "/admin/users", title: "Students & Staff", roles: admins },
      { href: "/admin/payments", title: "Payment Review", roles: paymentStaff },
      { href: "/admin/plans", title: "Plans & Pricing", roles: admins },
      { href: "/admin/entitlements", title: "Student Access", roles: admins },
    ],
  },
  {
    id: "reports-settings",
    title: "Reports & Settings",
    items: [
      { href: "/admin/reports", title: "Reports & Exports", roles: paymentStaff },
      { href: "/admin/attempts", title: "Exam Attempts", roles: reviewers },
      { href: "/admin/support", title: "Support", roles: supportStaff },
      { href: "/admin/announcements", title: "Announcements", roles: admins },
      { href: "/admin/privacy", title: "Privacy Requests", roles: admins },
      { href: "/admin/audit", title: "Audit Log", roles: admins },
      { href: "/admin/settings/integrations", title: "Integrations", roles: admins },
      { href: "/admin/settings", title: "Settings Overview", roles: admins },
      { href: "/admin/settings/general", title: "General Settings", roles: admins },
      { href: "/admin/settings/security", title: "Security Settings", roles: admins },
      { href: "/admin/settings/email", title: "Email Settings", roles: admins },
      { href: "/admin/settings/notifications", title: "Notification Settings", roles: admins },
      { href: "/admin/settings/payments", title: "Payment Settings", roles: admins },
      { href: "/admin/settings/maintenance", title: "Maintenance Settings", roles: admins },
    ],
  },
];

export const ADMIN_NAVIGATION_ITEMS = ADMIN_NAVIGATION_GROUPS.flatMap((group) => group.items);
