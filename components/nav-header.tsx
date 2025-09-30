"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SarosLogo } from "@/components/saros-logo";
import { Menu, X, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavHeaderProps {
  isWalletConnected?: boolean;
  onWalletToggle?: () => void;
}

export function NavHeader({
  isWalletConnected = false,
  onWalletToggle,
}: NavHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/pools", label: "Pools" },
    { href: "/analytics", label: "Analytics" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/">
              <SarosLogo />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    pathname === item.href
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {onWalletToggle && (
              <>
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 hidden sm:flex"
                  onClick={onWalletToggle}
                >
                  <Wallet className="h-4 w-4" />
                  <span className="ml-2">
                    {isWalletConnected ? "Connected" : "Connect"}
                  </span>
                </Button>
                <Button
                  size="icon"
                  className="bg-primary hover:bg-primary/90 sm:hidden"
                  onClick={onWalletToggle}
                >
                  <Wallet className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <nav className="md:hidden pt-4 pb-2 space-y-2 border-t mt-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted",
                  pathname === item.href
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
