"use client";

import { ThemeProvider } from "../../components/theme-provider";
import { AuthProvider } from "../../components/auth/auth-context";
import AuthWrapper from "../../components/auth/auth-wrapper";
import { SidebarHoverProvider } from "../../app/context/sidebar-hover-context";

export function ClientShell({ children }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <AuthWrapper>
          <SidebarHoverProvider>{children}</SidebarHoverProvider>
        </AuthWrapper>
      </AuthProvider>
    </ThemeProvider>
  );
}
