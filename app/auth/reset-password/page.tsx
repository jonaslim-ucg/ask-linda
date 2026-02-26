"use client";

import { Eye, EyeOff, Loader2, Lock, CheckCircle } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /(?=.*[a-z])/,
        "Password must contain at least one lowercase letter"
      )
      .regex(
        /(?=.*[A-Z])/,
        "Password must contain at least one uppercase letter"
      )
      .regex(/(?=.*\d)/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  useEffect(() => {
    if (error === "INVALID_TOKEN") {
      setTokenError("This password reset link is invalid or has expired.");
    } else if (!token && !error) {
      setTokenError("No reset token provided.");
    }
  }, [token, error]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast.error("Invalid reset token");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: data.password,
        token,
      });

      if (error) {
        toast.error(error.message || "Failed to reset password");
        return;
      }

      setIsSuccess(true);
      toast.success("Password reset successfully!");
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center mb-4">
            <Image src="/stethoscope.svg" alt="Stethoscope" width={32} height={32} className="size-8 mr-2" />
            <span className="text-xl font-bold">Ask Linda</span>
          </div>
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-destructive">
              Invalid Link
            </h2>
            <p className="text-sm text-muted-foreground mt-2">{tokenError}</p>
          </div>
          <div className="p-6 pt-0">
            <Link href="/auth/forgot-password">
              <Button className="w-full">Request a new reset link</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center mb-4">
            <Image src="/stethoscope.svg" alt="Stethoscope" width={32} height={32} className="size-8 mr-2" />
            <span className="text-xl font-bold">Ask Linda</span>
          </div>
          <div className="p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold">Password reset!</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Your password has been reset successfully. Redirecting to sign
              in...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className={cn("w-full max-w-md")}>
        <div className="flex items-center justify-center mb-4">
          <Image src="/stethoscope.svg" alt="Stethoscope" width={32} height={32} className="size-8 mr-2" />
          <span className="text-xl font-bold">Ask Linda</span>
        </div>
        <div className="p-6">
          <h2 className="text-2xl font-semibold">Reset your password</h2>
          <p className="text-sm text-muted-foreground">
            Enter your new password below.
          </p>
        </div>
        <div className="p-6 pt-0">
          <form
            className="flex flex-col gap-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="password">
                New Password
                <span aria-label="required" className="text-destructive">
                  *
                </span>
              </FieldLabel>
              <FieldContent>
                <InputGroup aria-invalid={!!errors.password} className="h-12">
                  <InputGroupAddon>
                    <Lock aria-hidden="true" className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                    aria-invalid={!!errors.password}
                    autoComplete="new-password"
                    id="password"
                    placeholder="Enter new password…"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                  />
                  <InputGroupButton
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="min-h-[32px] min-w-[32px] touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPassword(!showPassword);
                    }}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="size-4 mr-2" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4 mr-2" />
                    )}
                  </InputGroupButton>
                </InputGroup>
                {errors.password && (
                  <FieldError id="password-error">
                    {errors.password.message}
                  </FieldError>
                )}
                <FieldDescription>
                  Must be at least 8 characters with uppercase, lowercase, and
                  number
                </FieldDescription>
              </FieldContent>
            </Field>

            <Field data-invalid={!!errors.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">
                Confirm Password
                <span aria-label="required" className="text-destructive">
                  *
                </span>
              </FieldLabel>
              <FieldContent>
                <InputGroup
                  aria-invalid={!!errors.confirmPassword}
                  className="h-12"
                >
                  <InputGroupAddon>
                    <Lock aria-hidden="true" className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-describedby={
                      errors.confirmPassword
                        ? "confirmPassword-error"
                        : undefined
                    }
                    aria-invalid={!!errors.confirmPassword}
                    autoComplete="new-password"
                    id="confirmPassword"
                    placeholder="Confirm new password…"
                    type={showConfirmPassword ? "text" : "password"}
                    {...register("confirmPassword")}
                  />
                  <InputGroupButton
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    className="min-h-[32px] min-w-[32px] touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowConfirmPassword(!showConfirmPassword);
                    }}
                    type="button"
                  >
                    {showConfirmPassword ? (
                      <EyeOff aria-hidden="true" className="size-4 mr-2" />
                    ) : (
                      <Eye aria-hidden="true" className="size-4 mr-2" />
                    )}
                  </InputGroupButton>
                </InputGroup>
                {errors.confirmPassword && (
                  <FieldError id="confirmPassword-error">
                    {errors.confirmPassword.message}
                  </FieldError>
                )}
              </FieldContent>
            </Field>

            <Button
              aria-busy={isLoading}
              className="min-h-[44px] w-full touch-manipulation"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                  Resetting…
                </>
              ) : (
                "Reset password"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
