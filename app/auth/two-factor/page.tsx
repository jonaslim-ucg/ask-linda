"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

type VerifyMode = "totp" | "backup";

export default function TwoFactorPage() {
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<VerifyMode>("totp");
  const [trustDevice, setTrustDevice] = useState(false);
  const router = useRouter();

  const handleVerifyTotp = async () => {
    if (code.length !== 6) return;
    setIsLoading(true);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice,
      });
      if (error) {
        toast.error(error.message || "Invalid code. Please try again.");
        setCode("");
        return;
      }
      toast.success("Verified successfully!");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Verification failed. Please try again.");
      setCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyBackup = async () => {
    if (!backupCode.trim()) return;
    setIsLoading(true);
    try {
      const { error } = await authClient.twoFactor.verifyBackupCode({
        code: backupCode.trim(),
        trustDevice,
      });
      if (error) {
        toast.error(error.message || "Invalid backup code.");
        setBackupCode("");
        return;
      }
      toast.success("Verified successfully!");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Verification failed. Please try again.");
      setBackupCode("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className={cn("w-full max-w-md")}>
        <div className="flex items-center justify-center mb-4">
          <Image
            src="/stethoscope.svg"
            alt="Stethoscope"
            width={32}
            height={32}
            className="size-8 mr-2"
          />
          <span className="text-xl font-bold">Ask Linda</span>
        </div>

        <div className="p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <ShieldCheck className="size-8 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold">Two-Factor Authentication</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "totp"
              ? "Enter the 6-digit code from your authenticator app"
              : "Enter one of your backup codes"}
          </p>
        </div>

        <div className="p-6 pt-0 space-y-6">
          {mode === "totp" ? (
            <div className="flex flex-col items-center gap-4">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => {
                  setCode(value);
                }}
                onComplete={handleVerifyTotp}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="size-12 text-lg md:size-14 md:text-xl" />
                  <InputOTPSlot index={1} className="size-12 text-lg md:size-14 md:text-xl" />
                  <InputOTPSlot index={2} className="size-12 text-lg md:size-14 md:text-xl" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="size-12 text-lg md:size-14 md:text-xl" />
                  <InputOTPSlot index={4} className="size-12 text-lg md:size-14 md:text-xl" />
                  <InputOTPSlot index={5} className="size-12 text-lg md:size-14 md:text-xl" />
                </InputOTPGroup>
              </InputOTP>

              <Button
                aria-busy={isLoading}
                className="w-full min-h-11"
                disabled={isLoading || code.length !== 6}
                onClick={handleVerifyTotp}
              >
                {isLoading ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <label htmlFor="backup-code" className="text-sm font-medium">
                  Backup Code
                </label>
                <input
                  id="backup-code"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Enter backup code"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button
                aria-busy={isLoading}
                className="w-full min-h-11"
                disabled={isLoading || !backupCode.trim()}
                onClick={handleVerifyBackup}
              >
                {isLoading ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Backup Code"
                )}
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="trust-device"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="trust-device" className="text-sm text-muted-foreground">
              Trust this device for 30 days
            </label>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
              onClick={() => {
                setMode(mode === "totp" ? "backup" : "totp");
                setCode("");
                setBackupCode("");
              }}
            >
              {mode === "totp" ? (
                <span className="flex items-center gap-1 justify-center">
                  <KeyRound className="size-3" />
                  Use a backup code instead
                </span>
              ) : (
                <span className="flex items-center gap-1 justify-center">
                  <ShieldCheck className="size-3" />
                  Use authenticator app
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
