import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppWalletProvider } from "../lib/wallet-provider";
import { VolatilityProvider } from "../lib/volatility-context";
import { queryClient } from "../lib/queryClient";
import {
  Activity,
  BarChart3,
  Settings,
  TrendingUp,
  Menu,
  X,
  LineChart,
} from "lucide-react";
import { WalletButton } from "../components/wallet-button";
import { ThemeToggle } from "../components/theme-toggle";
import Dashboard from "../pages/dashboard";
import Positions from "../pages/positions";
import Analytics from "../pages/analytics";
import Simulator from "../pages/simulator";
import SettingsPage from "../pages/settings";
import Volatility from "../pages/volatility";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

function Navigation() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/", icon: BarChart3 },
    { name: "Positions", href: "/positions", icon: Activity },
    { name: "Analytics", href: "/analytics", icon: TrendingUp },
    { name: "Volatility", href: "/volatility", icon: LineChart },
    { name: "Simulator", href: "/simulator", icon: TrendingUp },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav className="glass-nav relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex justify-between items-center h-16 lg:h-20">
            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-2.5 lg:gap-3 lg:mr-12"
            >
              <div className="w-9 h-9 lg:w-12 lg:h-12 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="w-5 h-5 lg:w-6 lg:h-6 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg lg:text-xl font-bold">LiquiFlow</h1>
                <p className="text-xs lg:text-sm text-muted-foreground -mt-0.5">
                  DLMM Manager
                </p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="hidden lg:flex items-center gap-2 lg:gap-3">
                <ThemeToggle />
                <WalletButton />
              </div>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-background z-50 lg:hidden transform transition-transform duration-300 ease-in-out shadow-2xl ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-base font-bold">LiquidFlow</h2>
                <p className="text-xs text-muted-foreground">DLMM Manager</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Navigation Links */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Mobile Menu Footer */}
          <div className="p-4 border-t space-y-3">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent">
              <span className="text-sm font-medium">Theme</span>
              <ThemeToggle />
            </div>
            <WalletButton />
          </div>
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppWalletProvider>
        <BrowserRouter>
          <VolatilityProvider>
            <div className="min-h-screen bg-background relative">
              <Navigation />
              <main className="relative z-0">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/positions" element={<Positions />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/volatility" element={<Volatility />} />
                  <Route path="/simulator" element={<Simulator />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </main>
            </div>
          </VolatilityProvider>
        </BrowserRouter>
      </AppWalletProvider>
    </QueryClientProvider>
  );
}

export default App;
