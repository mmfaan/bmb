import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Home,
  Search,
  PlusSquare,
  MessageCircle,
  Bell,
  User,
  LogOut,
  Zap,
  Compass,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface AuthLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: PlusSquare, label: "Create", path: "/create", special: true },
  { icon: MessageCircle, label: "Messages", path: "/messages" },
];

export default function AuthLayout({ children }: AuthLayoutProps) {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: searchResults } = trpc.user.search.useQuery(
    { query: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 0 }
  );

  const { data: unreadCount } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: unreadMessages } = trpc.message.unreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <Zap className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Bomb</h1>
            <p className="text-sm text-muted-foreground text-center">
              Welcome to Bomb - Share your world with everyone
            </p>
          </div>
          <Button onClick={() => navigate("/login")} size="lg" className="w-full shadow-lg">
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const activePath = location.pathname;

  // Mobile bottom nav
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">Bomb</span>
          </Link>
          <div className="flex items-center gap-2">
            <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Search className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="h-auto max-h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Search</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-4"
                    autoFocus
                  />
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {searchResults?.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          navigate(`/profile/${u.id}`);
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={u.avatar || undefined} />
                          <AvatarFallback>{u.name?.charAt(0) || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{u.name || "User"}</p>
                          {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                        </div>
                      </button>
                    ))}
                    {searchQuery && searchResults?.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <button onClick={() => navigate("/notifications")} className="relative p-2">
              <Bell className="w-5 h-5" />
              {unreadCount && unreadCount.count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadCount.count}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="sticky bottom-0 z-50 bg-background/95 backdrop-blur border-t h-14 flex items-center justify-around px-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                activePath === item.path
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.special ? (
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <PlusSquare className="w-4 h-4 text-primary-foreground" />
                </div>
              ) : (
                <>
                  <item.icon className="w-5 h-5" />
                  {item.path === "/messages" && unreadMessages && unreadMessages.count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                      {unreadMessages.count}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
          <button
            onClick={() => navigate(`/profile/${user.id}`)}
            className={`p-2 rounded-lg transition-colors ${
              activePath.startsWith("/profile")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-5 h-5" />
          </button>
        </nav>
      </div>
    );
  }

  // Desktop sidebar layout
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 border-r bg-background flex flex-col z-50">
        {/* Logo */}
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Bomb</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                activePath === item.path
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className="w-6 h-6" />
                {item.path === "/messages" && unreadMessages && unreadMessages.count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unreadMessages.count}
                  </span>
                )}
              </div>
              <span className="text-[15px]">{item.label}</span>
            </button>
          ))}

          {/* Search button */}
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogTrigger asChild>
              <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-muted-foreground hover:bg-accent hover:text-foreground">
                <Search className="w-6 h-6" />
                <span className="text-[15px]">Search</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Search Users</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-4"
              />
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {searchResults?.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      navigate(`/profile/${u.id}`);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={u.avatar || undefined} />
                      <AvatarFallback>{u.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{u.name || "User"}</p>
                      {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                    </div>
                  </button>
                ))}
                {searchQuery && searchResults?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Notifications */}
          <button
            onClick={() => navigate("/notifications")}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
              activePath === "/notifications"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <div className="relative">
              <Bell className="w-6 h-6" />
              {unreadCount && unreadCount.count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadCount.count}
                </span>
              )}
            </div>
            <span className="text-[15px]">Notifications</span>
          </button>

          {/* Profile */}
          <button
            onClick={() => navigate(`/profile/${user.id}`)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
              activePath.startsWith("/profile")
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <User className="w-6 h-6" />
            <span className="text-[15px]">Profile</span>
          </button>
        </nav>

        {/* User info & Logout */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-accent transition-colors">
            <Avatar className="w-9 h-9">
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 shrink-0">
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64">
        <div className="max-w-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
