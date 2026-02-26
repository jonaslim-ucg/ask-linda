import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Define public routes that don't require authentication
  const publicRoutes = ["/auth/login", "/auth/signup", "/auth/forgot-password", "/auth/reset-password"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // 2FA-related routes (accessible while authenticated but without 2FA)
  const is2FARoute = pathname.startsWith("/auth/two-factor");

  // Admin login page (accessible during maintenance so unauthenticated admins can log in)
  const isAdminLoginPage = pathname === "/auth/admin-login" || pathname === "/admin/login";

  // Define auth API routes that should be excluded from middleware
  const isAuthApiRoute = pathname.startsWith("/api/auth");

  // Check if it's the maintenance page
  const isMaintenancePage = pathname === "/maintenance";

  // Skip middleware for auth API routes
  if (isAuthApiRoute) {
    return NextResponse.next();
  }

  // Check maintenance mode and protect maintenance-only routes
  if (!pathname.startsWith("/api/auth-settings")) {
    try {
      let baseUrl = request.nextUrl.origin;

      // Fix: Handle local development SSL error where origin might be https but server is http
      if (baseUrl.includes("localhost") && baseUrl.startsWith("https:")) {
        baseUrl = baseUrl.replace("https:", "http:");
      }

      const settingsResponse = await fetch(`${baseUrl}/api/auth-settings`, {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
        cache: "no-store",
      });

      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();

        if (settings.maintenanceMode) {
          // Maintenance page and admin login are accessible during maintenance
          if (isMaintenancePage || isAdminLoginPage) {
            return NextResponse.next();
          }

          // Allow admin users to access the site during maintenance
          if (sessionCookie) {
            const sessionResponse = await fetch(`${baseUrl}/api/auth/get-session`, {
              headers: {
                cookie: request.headers.get("cookie") || "",
              },
              cache: "no-store",
            });

            if (sessionResponse.ok) {
              const session = await sessionResponse.json();
              if (session?.user?.role === "admin") {
                return NextResponse.next();
              }
            }
          }

          return NextResponse.redirect(new URL("/maintenance", request.url));
        }

        // Maintenance mode is NOT active — maintenance page and admin login should not be accessible
        if (isMaintenancePage || isAdminLoginPage) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }
    } catch (error) {
      console.error("Error checking maintenance mode:", error);
    }
  }

  // If user is not logged in and trying to access protected route
  // Allow 2FA routes without session (user is mid-authentication, verifying their TOTP)
  if (!sessionCookie && !isPublicRoute && !is2FARoute && !isMaintenancePage && !isAdminLoginPage) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If user is logged in and trying to access auth pages (but not admin login or 2FA pages)
  if (sessionCookie && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Enforce 2FA setup for authenticated users
  if (sessionCookie && !is2FARoute && !isPublicRoute && !isMaintenancePage && !isAdminLoginPage) {
    try {
      let baseUrl = request.nextUrl.origin;
      if (baseUrl.includes("localhost") && baseUrl.startsWith("https:")) {
        baseUrl = baseUrl.replace("https:", "http:");
      }

      const sessionResponse = await fetch(`${baseUrl}/api/auth/get-session`, {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
        cache: "no-store",
      });

      if (sessionResponse.ok) {
        const session = await sessionResponse.json();
        if (session?.user && !session.user.twoFactorEnabled) {
          return NextResponse.redirect(new URL("/auth/two-factor/setup", request.url));
        }
      }
    } catch (error) {
      console.error("Error checking 2FA status:", error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
