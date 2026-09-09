import { useState, useEffect } from "react";
import { 
  Outlet, 
  useLoaderData, 
  useLocation, 
  useNavigate, 
  useSubmit, 
  Link,
  redirect
} from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  Users, 
  Columns3, 
  CheckSquare, 
  ShoppingCart, 
  CreditCard as Payment, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  LogOut, 
  User, 
  FileText, 
  Ticket, 
  History, 
  Moon, 
  Sun 
} from "lucide-react";
import { getAdminSession, ADMIN_COOKIE_NAME } from "@ekalliptus/core";

// Define navigation links
const primaryLinks = [
  { key: "dashboard", href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { key: "orders", href: "/admin/orders", icon: ShoppingCart, label: "Orders" },
  { key: "pipeline", href: "/admin/pipeline", icon: Columns3, label: "Pipeline" },
  { key: "consultations", href: "/admin/consultations", icon: MessageSquare, label: "Live Chat" },
  { key: "blog", href: "/admin/blog", icon: FileText, label: "Blog" }
];

const businessLinks = [
  { key: "customers", href: "/admin/customers", icon: Users, label: "Customers", disabled: false },
  { key: "payments", href: "/admin/payments", icon: Payment, label: "Payments", disabled: true, disabledReason: "Order tanpa pembayaran online" },
  { key: "vouchers", href: "/admin/vouchers", icon: Ticket, label: "Vouchers", disabled: true, disabledReason: "Order tanpa harga" },
  { key: "activities", href: "/admin/activities", icon: CheckSquare, label: "Activities", disabled: true, disabledReason: "Tidak ada input dari public" },
  { key: "reports", href: "/admin/reports", icon: BarChart3, label: "Reports", disabled: true, disabledReason: "Metric dari payment yang nonaktif" },
  { key: "audit", href: "/admin/audit-logs", icon: History, label: "Audit Logs", disabled: false },
  { key: "settings", href: "/admin/settings", icon: Settings, label: "Settings", disabled: false }
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await getAdminSession(request.headers.get("Cookie"));
  if (!session) {
    const url = new URL(request.url);
    const next = encodeURIComponent(url.pathname + url.search);
    return redirect(`/admin/login?next=${next}`);
  }
  return { session };
};

export default function AdminLayout() {
  const { session } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const submit = useSubmit();
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const role = session?.role ?? "admin";

  function canSee(key: string): boolean {
    if (role === "owner" || role === "admin") return true;
    if (key === "blog") return role === "editor";
    if (key === "vouchers" || key === "payments" || key === "reports") return role === "finance";
    if (key === "consultations") return role === "cs";
    if (key === "orders" || key === "customers" || key === "pipeline" || key === "activities" || key === "dashboard") return true;
    return false;
  }

  const visiblePrimary = primaryLinks.filter((l) => canSee(l.key));
  const visibleBusiness = businessLinks.filter((l) => canSee(l.key));

  function isActivePath(href: string): boolean {
    return href === "/admin" 
      ? location.pathname === href 
      : location.pathname.startsWith(href);
  }

  // Handle Logout
  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      submit(null, { method: "post", action: "/admin/logout" });
    }
  };

  // Sync and toggle theme
  useEffect(() => {
    const initialTheme = localStorage.getItem("ekal-theme") || "dark";
    setIsDark(initialTheme === "dark");
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    root.classList.toggle("dark", nextDark);
    localStorage.setItem("ekal-theme", nextDark ? "dark" : "light");
    setTimeout(() => root.classList.remove("theme-transitioning"), 320);
  };

  return (
    <div className="bg-background text-foreground min-h-screen font-sans" data-admin="true">
      {/* Mobile backdrop */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto glass-panel border-r border-border p-4 md:hidden custom-scrollbar transition-transform duration-300 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-4 px-1">
          <Link to="/admin" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <img src="/logo_mobile.webp" alt="Ekalliptus Digital" width="32" height="21" className="h-8 w-auto invert dark:invert-0" />
            <span className="font-semibold text-sm">Admin</span>
          </Link>
          <button 
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-accent transition cursor-pointer" 
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex flex-col gap-0.5">
          {visiblePrimary.map((link) => (
            <Link
              key={link.key}
              to={link.href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition hover:bg-accent/40 cursor-interactive sidebar-link ${
                isActivePath(link.href) ? "active" : ""
              }`}
            >
              <link.icon className="h-4 w-4 flex-shrink-0" />
              {link.label}
            </Link>
          ))}
          {visibleBusiness.length > 0 && (
            <>
              <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Bisnis</div>
              {visibleBusiness.map((link) => (
                link.disabled ? (
                  <span
                    key={link.key}
                    title={`Nonaktif: ${link.disabledReason}`}
                    className="sidebar-link-disabled flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium cursor-not-allowed opacity-40"
                  >
                    <link.icon className="h-4 w-4 flex-shrink-0" />
                    {link.label}
                    <span className="ml-auto text-[9px] uppercase tracking-wide opacity-60">off</span>
                  </span>
                ) : (
                  <Link
                    key={link.key}
                    to={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition hover:bg-accent/40 cursor-interactive sidebar-link ${
                      isActivePath(link.href) ? "active" : ""
                    }`}
                  >
                    <link.icon className="h-4 w-4 flex-shrink-0" />
                    {link.label}
                  </Link>
                )
              ))}
            </>
          )}
        </nav>
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{session?.displayName ?? "Admin"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-destructive transition hover:bg-destructive/10 cursor-interactive"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-60 flex-col fixed h-full glass-panel border-r border-border overflow-hidden">
          {/* Logo */}
          <div className="px-5 py-4 border-b border-border">
            <Link to="/admin" className="flex items-center gap-2.5">
              <img
                src="/logo_mobile.webp"
                alt="Ekalliptus Digital"
                width="32"
                height="21"
                className="h-8 w-auto invert dark:invert-0"
              />
              <div className="leading-tight">
                <h1 className="font-semibold text-sm">Admin</h1>
                <p className="text-[10px] text-muted-foreground">Ekalliptus Digital</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
            {visiblePrimary.map((link) => (
              <Link
                key={link.key}
                to={link.href}
                className={`sidebar-link flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition cursor-interactive ${
                  isActivePath(link.href) ? "active" : ""
                }`}
              >
                <link.icon className="h-4 w-4 flex-shrink-0" />
                {link.label}
              </Link>
            ))}
            {visibleBusiness.length > 0 && (
              <div className="px-3 pt-5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Bisnis</div>
            )}
            {visibleBusiness.map((link) => (
              link.disabled ? (
                <span
                  key={link.key}
                  title={`Nonaktif: ${link.disabledReason}`}
                  className="sidebar-link-disabled flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium cursor-not-allowed opacity-40"
                >
                  <link.icon className="h-4 w-4 flex-shrink-0" />
                  {link.label}
                  <span className="ml-auto text-[9px] uppercase tracking-wide opacity-60">off</span>
                </span>
              ) : (
                <Link
                  key={link.key}
                  to={link.href}
                  className={`sidebar-link flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition cursor-interactive ${
                    isActivePath(link.href) ? "active" : ""
                  }`}
                >
                  <link.icon className="h-4 w-4 flex-shrink-0" />
                  {link.label}
                </Link>
              )
            ))}
          </nav>

          {/* User footer */}
          <div className="px-3 py-3 border-t border-border">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{session?.displayName ?? "Admin User"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{session?.user.email ?? ""}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-destructive transition hover:bg-destructive/10 cursor-interactive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 md:ml-60">
          {/* Top bar */}
          <header className="sticky top-0 z-30 glass-panel border-b border-border">
            <div className="flex items-center justify-between px-4 sm:px-6 h-14">
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden h-9 w-9 rounded-full glass-panel flex items-center justify-center cursor-pointer hover:bg-accent transition"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Toggle menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <h1 className="text-base font-semibold tracking-tight" id="page-title">
                  {primaryLinks.find(l => isActivePath(l.href))?.label || 
                   businessLinks.find(l => isActivePath(l.href))?.label || 
                   "Dashboard"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="h-9 w-9 rounded-full glass-panel flex items-center justify-center hover:bg-accent transition cursor-pointer"
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-pill">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
                  <span className="text-[11px] font-medium">Online</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="p-4 sm:p-6">
            <Outlet context={{ session }} />
          </main>
        </div>
      </div>
    </div>
  );
}
