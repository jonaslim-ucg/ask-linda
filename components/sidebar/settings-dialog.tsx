"use client";

import * as React from "react";
import {
  BadgeCheck,
  Bell,
  ChevronLeft,
  Globe,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sun,
  Trash2,
  User,
  Download,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import { Separator } from "@/components/ui/separator";

type SettingsSection =
  | "profile"
  | "security"
  | "notifications"
  | "appearance"
  | "language"
  | "privacy"
  | "account";

const settingsNav = [
  { name: "Profile", icon: User, value: "profile" as const },
  { name: "Security", icon: KeyRound, value: "security" as const },
  // { name: "Notifications", icon: Bell, value: "notifications" as const },
  { name: "Appearance", icon: Palette, value: "appearance" as const },
  // { name: "Language & Region", icon: Globe, value: "language" as const },
  { name: "Privacy", icon: Shield, value: "privacy" as const },
  { name: "Account", icon: BadgeCheck, value: "account" as const },
];

interface SettingsDialogProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  children: React.ReactNode;
}

export function SettingsDialog({ user, children }: SettingsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [activeSection, setActiveSection] =
    React.useState<SettingsSection | null>(null);

  // Reset to menu view when dialog opens on mobile
  React.useEffect(() => {
    if (!open) {
      setActiveSection(null);
    }
  }, [open]);

  const handleSectionSelect = (section: SettingsSection) => {
    setActiveSection(section);
  };

  const handleBackToMenu = () => {
    setActiveSection(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex h-[85vh] max-h-[600px] flex-col overflow-hidden p-0 sm:max-h-[700px] md:h-auto md:max-h-[600px] md:max-w-[700px] lg:max-w-[900px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your account settings and preferences.
        </DialogDescription>
        
        {/* Mobile View */}
        <div className="flex h-full flex-col md:hidden">
          {activeSection === null ? (
            // Mobile Menu
            <div className="flex h-full flex-col">
              <div className="border-b px-4 py-4">
                <h2 className="text-lg font-semibold">Settings</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-1 p-2">
                  {settingsNav.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleSectionSelect(item.value)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent"
                    >
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Mobile Content
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b px-2 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToMenu}
                  className="h-9 w-9"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h2 className="font-semibold">
                  {settingsNav.find((item) => item.value === activeSection)?.name}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activeSection === "profile" && <ProfileSettings user={user} />}
                {activeSection === "security" && <SecuritySettings />}
                {activeSection === "notifications" && <NotificationsSettings />}
                {activeSection === "appearance" && <AppearanceSettings />}
                {activeSection === "language" && <LanguageSettings />}
                {activeSection === "privacy" && <PrivacySettings />}
                {activeSection === "account" && (
                  <AccountSettings onClose={() => setOpen(false)} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop View */}
        <SidebarProvider className="hidden items-start md:flex">
          <Sidebar collapsible="none" className="flex">
            <SidebarContent className="mt-2">
              <div className="px-4 py-2">
                <h2 className="text-lg font-semibold">Settings</h2>
              </div>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {settingsNav.map((item) => (
                      <SidebarMenuItem key={item.value}>
                        <SidebarMenuButton
                          onClick={() => setActiveSection(item.value)}
                          isActive={item.value === activeSection}
                        >
                          <item.icon />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-[600px] flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      href="#"
                      onClick={() => setActiveSection("profile")}
                    >
                      Settings
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {
                        settingsNav.find((item) => item.value === activeSection)
                          ?.name || "Profile"
                      }
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              {(activeSection === "profile" || activeSection === null) && <ProfileSettings user={user} />}
              {activeSection === "security" && <SecuritySettings />}
              {activeSection === "notifications" && <NotificationsSettings />}
              {activeSection === "appearance" && <AppearanceSettings />}
              {activeSection === "language" && <LanguageSettings />}
              {activeSection === "privacy" && <PrivacySettings />}
              {activeSection === "account" && (
                <AccountSettings onClose={() => setOpen(false)} />
              )}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}

function ProfileSettings({
  user,
}: {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}) {
  const [name, setName] = React.useState(user?.name || "");
  const email = user?.email || "";
  const [image, setImage] = React.useState(user?.image || "");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
      await authClient.updateUser({
        name,
        image: image || undefined,
      });
      toast.success("Profile updated successfully!");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile Settings</h3>
        <p className="text-sm text-muted-foreground">
          Update your personal information and profile picture.
        </p>
      </div>
      <Separator />

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={image} alt={name} />
          <AvatarFallback>{getInitials(name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Label htmlFor="image">Profile Picture URL</Label>
          <Input
            id="image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
            className="mt-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed directly. Contact support if you need to
          update your email.
        </p>
      </div>

      <Button onClick={handleUpdateProfile} disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}

function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [is2FALoading, setIs2FALoading] = React.useState(false);
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);
  const [backupPassword, setBackupPassword] = React.useState("");
  const { data: session } = authClient.useSession();

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: true,
      });
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error(
        "Failed to change password. Please check your current password.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Security Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your password and security preferences.
        </p>
      </div>
      <Separator />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm New Password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
        </div>

        <Button onClick={handleChangePassword} disabled={isLoading}>
          {isLoading ? "Changing..." : "Change Password"}
        </Button>
      </div>

      <Separator />

      {/* Two-Factor Authentication Section */}
      <div className="space-y-4">
        <div>
          <h4 className="text-base font-medium flex items-center gap-2">
            <Shield className="size-4" />
            Two-Factor Authentication
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            {session?.user?.twoFactorEnabled
              ? "Two-factor authentication is enabled on your account."
              : "Two-factor authentication is not yet enabled."}
          </p>
        </div>

        {session?.user?.twoFactorEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <div className="size-2 rounded-full bg-green-500" />
              Enabled — using authenticator app
            </div>

            {/* Regenerate backup codes */}
            <div className="space-y-2">
              <Label htmlFor="backup-password">
                Regenerate Backup Codes
              </Label>
              <p className="text-xs text-muted-foreground">
                Enter your password to generate new backup codes. This will invalidate all previous codes.
              </p>
              <Input
                id="backup-password"
                type="password"
                autoComplete="current-password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Enter your password"
              />
              <Button
                variant="outline"
                disabled={is2FALoading || !backupPassword}
                onClick={async () => {
                  setIs2FALoading(true);
                  try {
                    const { data, error } = await authClient.twoFactor.generateBackupCodes({
                      password: backupPassword,
                    });
                    if (error) {
                      toast.error(error.message || "Failed to generate backup codes");
                      return;
                    }
                    if (data?.backupCodes) {
                      setBackupCodes(data.backupCodes);
                      toast.success("New backup codes generated");
                    }
                    setBackupPassword("");
                  } catch {
                    toast.error("Something went wrong");
                  } finally {
                    setIs2FALoading(false);
                  }
                }}
              >
                {is2FALoading ? "Generating..." : "Generate New Backup Codes"}
              </Button>
            </div>

            {/* Display backup codes if just generated */}
            {backupCodes && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Your new backup codes:</p>
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-lg font-mono text-xs">
                  {backupCodes.map((bc) => (
                    <div key={bc} className="p-1.5 bg-background rounded text-center">
                      {bc}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={async () => {
                      await navigator.clipboard.writeText(backupCodes.join("\n"));
                      toast.success("Backup codes copied");
                    }}
                  >
                    <Copy className="size-4" />
                    Copy All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      try {
                        const content = `Ask Linda - Two-Factor Authentication Backup Codes\n\nGenerated: ${new Date().toLocaleString()}\n\nIMPORTANT: Store these codes in a safe place. Each code can only be used once.\n\n${backupCodes.join("\n")}\n\nIf you lose access to your authenticator device, you can use these codes to sign in.\n`;
                        const blob = new Blob([content], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `ask-linda-2fa-backup-codes-${Date.now()}.txt`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        toast.success("Backup codes downloaded");
                      } catch {
                        toast.error("Failed to download");
                      }
                    }}
                  >
                    <Download className="size-4" />
                    Download
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={() => {
              window.location.href = "/auth/two-factor/setup";
            }}
          >
            Set Up 2FA
          </Button>
        )}
      </div>
    </div>
  );
}

function NotificationsSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notification Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure how you receive notifications.
        </p>
      </div>
      <Separator />
      <div className="text-sm text-muted-foreground">
        Notification settings are coming soon.
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const themes = [
    {
      value: "light",
      label: "Light",
      icon: Sun,
      description: "Light mode for daytime use",
    },
    {
      value: "dark",
      label: "Dark",
      icon: Moon,
      description: "Dark mode for nighttime use",
    },
    {
      value: "system",
      label: "System",
      icon: Monitor,
      description: "Adapts to your system settings",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Appearance Settings</h3>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of the application.
        </p>
      </div>
      <Separator />

      <div className="space-y-4">
        <div>
          <h4 className="mb-3 text-sm font-medium">Theme</h4>
          <div className="grid gap-3">
            {themes.map((themeOption) => (
              <button
                key={themeOption.value}
                type="button"
                onClick={() => {
                  setTheme(themeOption.value);
                  toast.success(`Theme changed to ${themeOption.label}`);
                }}
                className={`flex items-start gap-4 rounded-lg border-2 p-4 text-left transition-colors hover:bg-accent ${
                  theme === themeOption.value
                    ? "border-primary bg-accent"
                    : "border-border"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full ${
                    theme === themeOption.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <themeOption.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{themeOption.label}</span>
                    {theme === themeOption.value && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {themeOption.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LanguageSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Language & Region Settings</h3>
        <p className="text-sm text-muted-foreground">
          Set your preferred language and regional settings.
        </p>
      </div>
      <Separator />
      <div className="text-sm text-muted-foreground">
        Language and region settings are coming soon.
      </div>
    </div>
  );
}

function PrivacySettings() {
  const [sessions, setSessions] = React.useState<Array<{
    id: string;
    token: string;
    userAgent?: string | null;
    ipAddress?: string | null;
    createdAt: Date;
    expiresAt: Date;
    userId: string;
    updatedAt: Date;
  }>>([]);
  const [currentSessionToken, setCurrentSessionToken] = React.useState<string | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = React.useState(true);
  const [isExportingData, setIsExportingData] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      // Get current session to identify which one is active
      const currentSession = await authClient.getSession();
      if (currentSession.data?.session?.token) {
        setCurrentSessionToken(currentSession.data.session.token);
      }
      
      const data = await authClient.listSessions();
      setSessions(data.data || []);
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (token: string) => {
    const isCurrent = isCurrentSession(token);
    
    try {
      if (isCurrent) {
        // For current session, revoke the session in database first
        await authClient.revokeSession({ token });
        // Then sign out to clear cookies
        await authClient.signOut();
        // Show success message before redirect
        toast.success("Signed out successfully");
        // Force a full page reload to clear all cached state
        setTimeout(() => {
          window.location.href = "/auth/login";
        }, 100);
      } else {
        await authClient.revokeSession({ token });
        toast.success("Session revoked successfully");
        loadSessions();
      }
    } catch {
      toast.error("Failed to revoke session");
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await authClient.revokeOtherSessions();
      toast.success("All other sessions revoked successfully");
      loadSessions();
    } catch {
      toast.error("Failed to revoke sessions");
    }
  };

  const handleExportData = async () => {
    setIsExportingData(true);
    try {
      const session = await authClient.getSession();
      const user = session.data?.user;
      
      const userData = {
        user: {
          id: user?.id,
          name: user?.name,
          email: user?.email,
          emailVerified: user?.emailVerified,
          image: user?.image,
          createdAt: user?.createdAt,
          updatedAt: user?.updatedAt,
        },
        sessions,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(userData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-data-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setIsExportingData(false);
    }
  };

  const getDeviceInfo = (userAgent?: string | null) => {
    if (!userAgent) return "Unknown Device";
    
    if (userAgent.includes("Mobile")) return "📱 Mobile Device";
    if (userAgent.includes("Windows")) return "🖥️ Windows PC";
    if (userAgent.includes("Mac")) return "💻 Mac";
    if (userAgent.includes("Linux")) return "🐧 Linux";
    if (userAgent.includes("iPad")) return "📱 iPad";
    return "🌐 Browser";
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const isCurrentSession = (sessionToken: string) => {
    return currentSessionToken === sessionToken;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Privacy Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your privacy and data preferences.
        </p>
      </div>
      <Separator />

      {/* Active Sessions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Active Sessions</h4>
            <p className="text-sm text-muted-foreground">
              Manage devices where you&apos;re currently signed in
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokeAllSessions}
            disabled={sessions.length <= 1}
          >
            Revoke All Others
          </Button>
        </div>

        {isLoadingSessions ? (
          <div className="text-sm text-muted-foreground">
            Loading sessions...
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {getDeviceInfo(session.userAgent)}
                    </span>
                    {isCurrentSession(session.token) && (
                      <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                        Current Session
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {session.ipAddress && `IP: ${session.ipAddress} • `}
                    Last active: {formatDate(session.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires: {formatDate(session.expiresAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevokeSession(session.token)}
                  title={isCurrentSession(session.token) ? "Sign out from current device" : "Revoke this session"}
                >
                  {isCurrentSession(session.token) ? "Sign Out" : "Revoke"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Data Export */}
      <div className="space-y-4">
        <div>
          <h4 className="font-medium">Export Your Data</h4>
          <p className="text-sm text-muted-foreground">
            Download a copy of your account data
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportData}
          disabled={isExportingData}
        >
          {isExportingData ? "Exporting..." : "Export Data"}
        </Button>
      </div>

      <Separator />

      {/* Chat History Privacy */}
      <div className="space-y-4">
        <div>
          <h4 className="font-medium">Chat History</h4>
          <p className="text-sm text-muted-foreground">
            Your chat conversations are private and only visible to you
          </p>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Private Conversations</p>
            <p className="text-xs text-muted-foreground">
              All chats are encrypted and stored securely
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            🔒
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountSettings({ onClose }: { onClose: () => void }) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [password, setPassword] = React.useState("");
  const router = useRouter();

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm');
      return;
    }

    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setIsDeleting(true);
    try {
      const result = await authClient.deleteUser({
        password,
        callbackURL: "/auth/login",
      });

      // Check if deletion was successful
      if (result.error) {
        toast.error(result.error.message || "Failed to delete account. Please check your password.");
        setIsDeleting(false);
        return;
      }

      // Only proceed with logout if deletion was successful
      toast.success("Account deleted successfully");
      onClose();
      // Force a full page reload to clear all state
      setTimeout(() => {
        window.location.href = "/auth/login";
      }, 500);
    } catch (error: unknown) {
      console.error("Delete account error:", error);
      toast.error(
        (error as Error)?.message || "Failed to delete account. Please check your password."
      );
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Account Management</h3>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and data.
        </p>
      </div>
      <Separator />

      <div className="space-y-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h4 className="font-medium text-destructive">Delete Account</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Once you delete your account, there is no going back. Please be
          certain.
        </p>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-password">Enter your password</Label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={isDeleting || confirmText !== "DELETE" || !password}
          >
            {isDeleting ? "Deleting..." : "Delete Account"}
          </Button>
        </div>
      </div>
    </div>
  );
}
