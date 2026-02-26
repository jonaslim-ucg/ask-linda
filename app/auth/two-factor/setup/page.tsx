"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  ShieldCheck,
  Copy,
  Check,
  AlertTriangle,
  Download,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

type SetupStep = "password" | "qr" | "verify" | "backup" | "done";

function parseTotpSetupInfo(totpUri: string): {
  secret: string;
  issuer: string;
  account: string;
} {
  if (!totpUri) {
    return {
      secret: "",
      issuer: "",
      account: "",
    };
  }

  try {
    const normalizedUrl = totpUri.replace("otpauth://", "https://");
    const parsedUrl = new URL(normalizedUrl);
    const secret = parsedUrl.searchParams.get("secret") ?? "";
    const issuer = parsedUrl.searchParams.get("issuer") ?? "";
    const decodedPath = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
    const account = decodedPath.includes(":")
      ? decodedPath.split(":").slice(1).join(":")
      : decodedPath;

    return {
      secret,
      issuer,
      account,
    };
  } catch {
    const secretMatch = totpUri.match(/[?&]secret=([^&]+)/i);
    return {
      secret: secretMatch?.[1] ?? "",
      issuer: "",
      account: "",
    };
  }
}

export default function TwoFactorSetupPage() {
  const [step, setStep] = useState<SetupStep>("password");
  const [password, setPassword] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [copiedSetupKey, setCopiedSetupKey] = useState(false);
  const router = useRouter();
  const totpSetupInfo = parseTotpSetupInfo(totpURI);

  const handleEnable2FA = async () => {
    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await authClient.twoFactor.enable({
        password,
      });

      if (error) {
        toast.error(error.message || "Failed to enable 2FA");
        return;
      }

      if (data) {
        setTotpURI(data.totpURI);
        setBackupCodes(data.backupCodes);
        setStep("qr");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (code.length !== 6) return;

    setIsLoading(true);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({
        code,
      });

      if (error) {
        toast.error(error.message || "Invalid code. Please try again.");
        setCode("");
        return;
      }

      setStep("backup");
    } catch {
      toast.error("Verification failed. Please try again.");
      setCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopiedBackup(true);
      toast.success("Backup codes copied to clipboard");
      setTimeout(() => setCopiedBackup(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownloadBackupCodes = () => {
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
  };

  const handleComplete = () => {
    toast.success("Two-factor authentication is now enabled!");
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className={cn("w-full max-w-lg")}>
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
          <h2 className="text-2xl font-semibold">Set Up Two-Factor Authentication</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Two-factor authentication is required for all accounts. Set up your authenticator app to continue.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6 px-6">
          {["password", "qr", "verify", "backup"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "size-8 rounded-full flex items-center justify-center text-xs font-medium",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : ["password", "qr", "verify", "backup"].indexOf(step) > i
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </div>
              {i < 3 && (
                <div
                  className={cn(
                    "w-8 h-0.5",
                    ["password", "qr", "verify", "backup"].indexOf(step) > i
                      ? "bg-primary/40"
                      : "bg-muted",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <div className="p-6 pt-0">
          {step === "password" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Required for all accounts</p>
                    <p className="mt-1">
                      To keep your account secure, you must set up two-factor authentication using an authenticator app (e.g., Google&nbsp;Authenticator, Authy, 1Password).
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="setup-password" className="text-sm font-medium">
                  Confirm your password to continue
                </label>
                <input
                  id="setup-password"
                  type="password"
                  autoComplete="current-password"
                  className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleEnable2FA();
                  }}
                />
              </div>

              <Button
                className="w-full min-h-11"
                disabled={isLoading || !password}
                onClick={handleEnable2FA}
              >
                {isLoading ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          )}

          {step === "qr" && (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Scan this QR code with your authenticator app, or manually enter the setup key.
              </p>

              <div className="flex justify-center p-4 bg-white rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="Scan this QR code with your authenticator app"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpURI)}`}
                  width={200}
                  height={200}
                  className="rounded"
                />
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Can&apos;t scan? Enter setup key manually
                </summary>
                <div className="mt-2 space-y-3 rounded-md bg-muted p-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Setup key</p>
                    <div className="mt-1 rounded bg-background p-2 font-mono text-xs break-all">
                      {totpSetupInfo.secret || "Unable to read setup key. Please rescan the QR code."}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!totpSetupInfo.secret}
                    onClick={async () => {
                      if (!totpSetupInfo.secret) return;

                      try {
                        await navigator.clipboard.writeText(totpSetupInfo.secret);
                        setCopiedSetupKey(true);
                        toast.success("Setup key copied");
                        setTimeout(() => setCopiedSetupKey(false), 2000);
                      } catch {
                        toast.error("Failed to copy setup key");
                      }
                    }}
                  >
                    {copiedSetupKey ? (
                      <>
                        <Check className="size-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" />
                        Copy setup key
                      </>
                    )}
                  </Button>
                </div>
              </details>

              <Button
                className="w-full min-h-11"
                onClick={() => setStep("verify")}
              >
                I&apos;ve scanned the QR code
              </Button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Enter the 6-digit code shown in your authenticator app to verify the setup.
              </p>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  onComplete={handleVerifySetup}
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
              </div>

              <Button
                className="w-full min-h-11"
                disabled={isLoading || code.length !== 6}
                onClick={handleVerifySetup}
              >
                {isLoading ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Enable"
                )}
              </Button>

              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground text-center"
                onClick={() => setStep("qr")}
              >
                Back to QR code
              </button>
            </div>
          )}

          {step === "backup" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Save your backup codes</p>
                    <p className="mt-1">
                      Store these codes in a safe place. You can use them to access your account if you lose your authenticator device. Each code can only be used once.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                {backupCodes.map((bc) => (
                  <div key={bc} className="p-2 bg-background rounded text-center">
                    {bc}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCopyBackupCodes}
                >
                  {copiedBackup ? (
                    <>
                      <Check className="size-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDownloadBackupCodes}
                >
                  <Download className="size-4" />
                  Download
                </Button>
              </div>

              <Separator />

              <Button
                className="w-full min-h-11"
                onClick={handleComplete}
              >
                I&apos;ve saved my backup codes — Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
