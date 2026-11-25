import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVisibleAdminNavigationGroups, type AdminNavigationItem } from "@/lib/admin-navigation";

function normalizePath(path: string) {
  return path.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
}

function isItemCurrent(path: string, item: AdminNavigationItem) {
  return path === item.href || (item.href !== "/admin" && path.startsWith(`${item.href}/`));
}

async function readStaffRoles() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return error ? [] : data?.map((row) => row.role as string) ?? [];
}

export async function AdminNavigation({
  activePath,
  roles,
  currentTitle,
}: {
  activePath: string;
  roles?: readonly string[];
  currentTitle?: string;
}) {
  const staffRoles = roles ?? await readStaffRoles();
  if (!staffRoles.length) return null;

  const path = normalizePath(activePath);
  const groups = getVisibleAdminNavigationGroups(staffRoles);
  if (!groups.length) return null;

  const matches = groups.flatMap((group) => group.items.map((item) => ({ group, item })))
    .filter(({ item }) => isItemCurrent(path, item))
    .sort((a, b) => b.item.href.length - a.item.href.length);
  const active = matches[0];
  const breadcrumbTitle = currentTitle ?? (active && path !== active.item.href ? "Details" : active?.item.title ?? "Administration");

  return (
    <div className="admin-workspace-navigation" role="region" aria-label="Administration navigation">
      <div className="wrap admin-workspace-navigation__inner">
        <nav className="admin-workspace-navigation__breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><Link href="/admin">Administration</Link></li>
            {active ? <>
              <li aria-hidden="true">/</li>
              <li>{active.group.title}</li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">{breadcrumbTitle}</li>
            </> : null}
          </ol>
        </nav>
        <nav className="admin-workspace-navigation__areas" aria-label="Staff areas">
          {groups.map((group) => {
            const landing = group.items[0];
            const areaIsActive = group.id === active?.group.id;
            return (
              <Link
                className={areaIsActive ? "is-current" : ""}
                href={landing.href}
                key={group.id}
                aria-current={areaIsActive ? path === landing.href ? "page" : "location" : undefined}
              >
                {group.title}
              </Link>
            );
          })}
        </nav>
        {active && active.group.items.length > 1 ? (
          <nav className="admin-workspace-navigation__subnav" aria-label={`${active.group.title} tools`}>
            {active.group.items.slice(1).map((item) => {
              const itemIsCurrent = item.href === active.item.href;
              const exactCurrent = path === item.href;
              return (
                <Link className={itemIsCurrent ? "is-current" : ""} href={item.href} key={item.href} aria-current={exactCurrent ? "page" : itemIsCurrent ? "location" : undefined}>
                  {item.title}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
