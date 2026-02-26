"use client";

import { Construction, Mail, Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

export default function MaintenancePage() {
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { data: session } = authClient.useSession();

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await authClient.signOut();
            toast.success("Signed out successfully");
            router.refresh();
        } catch (error) {
            console.error("Logout error:", error);
            toast.error("Failed to sign out");
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md text-center space-y-6">
                <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-6">
                        <Construction className="size-16 text-primary" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">
                        Under Maintenance
                    </h1>
                    <p className="text-muted-foreground">
                        We&apos;re currently performing scheduled maintenance to improve
                        your experience. We&apos;ll be back shortly.
                    </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Clock className="size-4" />
                        <span>Expected downtime: A few minutes</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Mail className="size-4" />
                        <span>Questions? Contact support</span>
                    </div>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                    {session?.user ? (
                        <>
                            <p className="text-sm text-muted-foreground mb-2">
                                Signed in as {session.user.email}
                            </p>
                            <Button
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                                variant="outline"
                            >
                                {isLoggingOut ? (
                                    <>Signing out...</>
                                ) : (
                                    <>
                                        <LogOut className="size-4 mr-2" />
                                        Sign out
                                    </>
                                )}
                            </Button>
                        </>
                    ) : (
                        // <Button asChild variant="outline">
                        //     <Link href="/auth/admin-login">Admin Login</Link>
                        // </Button>
                        <></>
                    )}
                </div>
            </div>
        </div>
    );
}
