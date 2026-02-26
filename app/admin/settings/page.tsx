"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield, Info, Settings2, Construction } from "lucide-react";

export default function AdminSettingsPage() {
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/auth-settings");
        if (response.ok) {
          const data = await response.json();
          setRegistrationEnabled(data.registrationEnabled);
          setMaintenanceMode(data.maintenanceMode ?? false);
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // Update registration setting
  async function handleRegistrationToggle(enabled: boolean) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/auth-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationEnabled: enabled }),
      });

      if (response.ok) {
        setRegistrationEnabled(enabled);
        toast.success(
          enabled
            ? "Registration enabled successfully"
            : "Registration disabled successfully"
        );
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update setting");
      }
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  }

  // Update maintenance mode setting
  async function handleMaintenanceToggle(enabled: boolean) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/auth-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceMode: enabled }),
      });

      if (response.ok) {
        setMaintenanceMode(enabled);
        toast.success(
          enabled
            ? "Maintenance mode enabled"
            : "Maintenance mode disabled"
        );
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update setting");
      }
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg w-fit">
              <Settings2 className="size-5 sm:size-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Manage your application configuration and preferences
              </p>
            </div>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          {/* Authentication Settings */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-bl-full" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Shield className="size-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Authentication</CardTitle>
                  <CardDescription>Control user access and registration</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border">
                <div className="space-y-1">
                  <Label htmlFor="registration-toggle" className="text-sm font-medium">
                    User Registration
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Allow new users to create accounts
                  </p>
                </div>
                {isLoading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    id="registration-toggle"
                    checked={registrationEnabled}
                    disabled={isSaving}
                    onCheckedChange={handleRegistrationToggle}
                    className="data-[state=checked]:bg-blue-600"
                  />
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${registrationEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-muted-foreground">
                  Registration is {registrationEnabled ? 'enabled' : 'disabled'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Mode Settings */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-bl-full" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Construction className="size-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Maintenance Mode</CardTitle>
                  <CardDescription>Control site availability</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border">
                <div className="space-y-1">
                  <Label htmlFor="maintenance-toggle" className="text-sm font-medium">
                    Enable Maintenance Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Redirect all non-admin users to maintenance page
                  </p>
                </div>
                {isLoading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <Switch
                    id="maintenance-toggle"
                    checked={maintenanceMode}
                    disabled={isSaving}
                    onCheckedChange={handleMaintenanceToggle}
                    className="data-[state=checked]:bg-orange-600"
                  />
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${maintenanceMode ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-muted-foreground">
                  {maintenanceMode ? 'Site is in maintenance mode' : 'Site is live'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Application Info */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/10 to-teal-500/10 rounded-bl-full" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Info className="size-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Application Info</CardTitle>
                  <CardDescription>Current system information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-sm font-medium">Version</span>
                  <Badge variant="outline" className="bg-white dark:bg-slate-700">
                    1.0.0
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-sm font-medium">Environment</span>
                  <Badge
                    variant={process.env.NODE_ENV === 'production' ? 'default' : 'secondary'}
                    className="bg-white dark:bg-slate-700"
                  >
                    {process.env.NODE_ENV || "development"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <span className="text-sm font-medium">Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-muted-foreground">Online</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
