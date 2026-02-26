"use client";

import { Eye, EyeOff, Loader2, Lock, Mail, Shield } from "lucide-react";
import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
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
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const signinSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type SigninFormData = z.infer<typeof signinSchema>;

function AdminLoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SigninFormData>({
    resolver: zodResolver(signinSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: SigninFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const { error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (error) {
        setServerError(error.message || "Invalid email or password");
        return;
      }

      // Check if user is admin before allowing access
      const sessionResponse = await fetch("/api/auth/get-session");
      if (sessionResponse.ok) {
        const session = await sessionResponse.json();
        if (session?.user?.role !== "admin") {
          await authClient.signOut();
          setServerError("Access denied. Admin privileges required.");
          return;
        }
      } else {
        await authClient.signOut();
        setServerError("Failed to verify session. Please try again.");
        return;
      }

      toast.success("Signed in successfully!");
      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message?: string }).message === "string"
      ) {
        setServerError(
          (err as { message?: string }).message ??
            "Something went wrong. Please try again."
        );
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className={cn("w-full max-w-md")}>
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Shield className="size-8 text-primary" />
          </div>
        </div>
        <div className="p-6 text-center">
          <h2 className="text-2xl font-semibold">Admin Access</h2>
          <p className="text-sm text-muted-foreground">
            Sign in with your administrator credentials
          </p>
        </div>
        <div className="p-6 pt-0">
          <form
            className="flex flex-col gap-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            {serverError && (
              <div
                aria-live="polite"
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm"
                role="alert"
              >
                {serverError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <Field data-invalid={!!errors.email}>
                <FieldLabel
                  htmlFor="admin-signin-email"
                >
                  Email
                  <span aria-label="required" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <FieldContent>
                  <InputGroup aria-invalid={!!errors.email} className="h-12">
                    <InputGroupAddon>
                      <Mail aria-hidden="true" className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-describedby={
                        errors.email ? "admin-signin-email-error" : undefined
                      }
                      aria-invalid={!!errors.email}
                      autoComplete="email"
                      id="admin-signin-email"
                      inputMode="email"
                      placeholder="admin@example.com…"
                      type="email"
                      {...register("email")}
                    />
                  </InputGroup>
                  {errors.email && (
                    <FieldError id="admin-signin-email-error">
                      {errors.email.message}
                    </FieldError>
                  )}
                </FieldContent>
              </Field>

              <Field data-invalid={!!errors.password}>
                <FieldLabel
                  htmlFor="admin-signin-password"
                >
                  Password
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
                        errors.password
                          ? "admin-signin-password-error"
                          : undefined
                      }
                      aria-invalid={!!errors.password}
                      autoComplete="current-password"
                      id="admin-signin-password"
                      placeholder="Enter your password…"
                      type={showPassword ? "text" : "password"}
                      {...register("password")}
                    />
                    <InputGroupButton
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="min-h-8 min-w-8 touch-manipulation"
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
                    <FieldError id="admin-signin-password-error">
                      {errors.password.message}
                    </FieldError>
                  )}
                </FieldContent>
              </Field>
            </div>

            <Button
              aria-busy={isLoading}
              className="min-h-11 w-full touch-manipulation"
              data-loading={isLoading}
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? (
                <>
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in as Admin"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
