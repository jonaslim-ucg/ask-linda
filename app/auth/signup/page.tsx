"use client";

import { Eye, EyeOff, Loader2, Lock, Mail, User, ShieldX } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import useSWR from "swr";
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
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").trim(),
    email: z.string().email("Please enter a valid email address"),
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

type SignupFormData = z.infer<typeof signupSchema>;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const router = useRouter();

  const { data: settings, error: settingsError, isLoading: checkingSettings } = useSWR("/api/auth-settings", fetcher);
  const registrationEnabled = settingsError ? true : settings?.registrationEnabled;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const { error } = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
        callbackURL: "/",
      });

      if (error) {
        setServerError(error.message || "Failed to create account");
        return;
      }

      toast.success("Account created successfully! Please check your email to verify your account.");
      router.push("/");
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking settings
  if (checkingSettings) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  // Show registration disabled message
  if (registrationEnabled === false) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className={cn("w-full max-w-md text-center")}>
          <div className="flex items-center justify-center mb-4">
            <Image src="/stethoscope.svg" alt="Stethoscope" width={32} height={32} className="size-8 mr-2" />
            <span className="text-xl font-bold">Ask Linda</span>
          </div>
          <div className="p-6">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-4">
                <ShieldX className="size-12 text-destructive" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold mb-2">Registration Disabled</h2>
            <p className="text-muted-foreground mb-6">
              New account registration is currently disabled by the administrator. 
              Please contact your administrator for access.
            </p>
            <Link href="/auth/login">
              <Button className="w-full">
                Go to Sign In
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
          <h2 className="text-2xl font-semibold">Create an account</h2>
          <p className="text-sm text-muted-foreground">
            Enter your information to get started
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
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="signup-name">
                  Full name
                  <span aria-label="required" className="text-destructive">
                    *
                  </span>
                </FieldLabel>
                <FieldContent>
                  <InputGroup aria-invalid={!!errors.name} className="h-12">
                    <InputGroupAddon>
                      <User aria-hidden="true" className="size-4" />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-describedby={
                        errors.name ? "signup-name-error" : undefined
                      }
                      aria-invalid={!!errors.name}
                      autoComplete="name"
                      id="signup-name"
                      placeholder="John Doe…"
                      type="text"
                      {...register("name")}
                    />
                  </InputGroup>
                  {errors.name && (
                    <FieldError id="signup-name-error">
                      {errors.name.message}
                    </FieldError>
                  )}
                </FieldContent>
              </Field>

              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="signup-email">
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
                        errors.email ? "signup-email-error" : undefined
                      }
                      aria-invalid={!!errors.email}
                      autoComplete="email"
                      id="signup-email"
                      inputMode="email"
                      placeholder="name@example.com…"
                      type="email"
                      {...register("email")}
                    />
                  </InputGroup>
                  {errors.email && (
                    <FieldError id="signup-email-error">
                      {errors.email.message}
                    </FieldError>
                  )}
                </FieldContent>
              </Field>

              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="signup-password">
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
                        errors.password ? "signup-password-error" : undefined
                      }
                      aria-invalid={!!errors.password}
                      autoComplete="new-password"
                      id="signup-password"
                      placeholder="Create a password…"
                      type={showPassword ? "text" : "password"}
                      {...register("password")}
                    />
                    <InputGroupButton
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
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
                    <FieldError id="signup-password-error">
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
                <FieldLabel htmlFor="signup-confirm-password">
                  Confirm password
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
                          ? "signup-confirm-password-error"
                          : undefined
                      }
                      aria-invalid={!!errors.confirmPassword}
                      autoComplete="new-password"
                      id="signup-confirm-password"
                      placeholder="Confirm your password…"
                      type={showConfirmPassword ? "text" : "password"}
                      {...register("confirmPassword")}
                    />
                    <InputGroupButton
                      aria-label={
                        showConfirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
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
                    <FieldError id="signup-confirm-password-error">
                      {errors.confirmPassword.message}
                    </FieldError>
                  )}
                </FieldContent>
              </Field>

              <p className="text-sm text-muted-foreground">
                By clicking continue, you agree to our{" "}
                <a
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                  href="#"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  className="text-primary underline underline-offset-4 hover:text-primary/80"
                  href="#"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>

            <Button
              aria-busy={isLoading}
              className="min-h-[44px] w-full touch-manipulation"
              data-loading={isLoading}
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
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
