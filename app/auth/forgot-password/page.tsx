"use client";

import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/reset-password`
          : "/auth/reset-password";

      const { error } = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo,
      });

      if (error) {
        toast.error(error.message || "Failed to send reset email");
        return;
      }

      setIsSubmitted(true);
      toast.success("Password reset email sent!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center mb-4">
            <Image src="/stethoscope.svg" alt="Stethoscope" width={32} height={32} className="size-8 mr-2" />
            <span className="text-xl font-bold">Ask Linda</span>
          </div>
          <div className="p-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold">Check your email</h2>
            <p className="text-sm text-muted-foreground mt-2">
              We&apos;ve sent you a password reset link. Please check your email and
              click the link to reset your password.
            </p>
          </div>
          <div className="p-6 pt-0">
            <Link href="/auth/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="size-4 mr-2" />
                Back to sign in
              </Button>
            </Link>
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
          <h2 className="text-2xl font-semibold">Forgot password?</h2>
          <p className="text-sm text-muted-foreground">
            Enter your email address and we&apos;ll send you a link to reset your
            password.
          </p>
        </div>
        <div className="p-6 pt-0">
          <form
            className="flex flex-col gap-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">
                Email
                <span aria-label="required" className="text-destructive">
                  *
                </span>
              </FieldLabel>
              <FieldContent>
                <InputGroup
                  aria-invalid={!!errors.email}
                  className="h-12"
                >
                  <InputGroupAddon>
                    <Mail aria-hidden="true" className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-describedby={
                      errors.email ? "email-error" : undefined
                    }
                    aria-invalid={!!errors.email}
                    autoComplete="email"
                    id="email"
                    inputMode="email"
                    placeholder="name@example.com…"
                    type="email"
                    {...register("email")}
                  />
                </InputGroup>
                {errors.email && (
                  <FieldError id="email-error">
                    {errors.email.message}
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
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link
                href="/auth/login"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
