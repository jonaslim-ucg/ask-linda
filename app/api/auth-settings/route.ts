import { NextResponse } from "next/server";
import { db } from "@/db";
import { authSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

// Get auth settings (public - needed for signup page and maintenance check)
export async function GET() {
  try {
    const settings = await db.query.authSettings.findFirst({
      where: eq(authSettings.id, "default"),
    });

    // If no settings exist, return defaults
    if (!settings) {
      return NextResponse.json({
        registrationEnabled: true,
        maintenanceMode: false,
      });
    }

    return NextResponse.json({
      registrationEnabled: settings.registrationEnabled,
      maintenanceMode: settings.maintenanceMode,
    });
  } catch (error) {
    console.error("Error fetching auth settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch auth settings" },
      { status: 500 }
    );
  }
}

// Update auth settings (admin only)
export async function PUT(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { registrationEnabled, maintenanceMode } = body;

    if (typeof registrationEnabled !== "boolean" && typeof maintenanceMode !== "boolean") {
      return NextResponse.json(
        { error: "Invalid settings value" },
        { status: 400 }
      );
    }

    // Fetch current settings first
    const currentSettings = await db.query.authSettings.findFirst({
      where: eq(authSettings.id, "default"),
    });

    // Upsert the settings
    await db
      .insert(authSettings)
      .values({
        id: "default",
        registrationEnabled: typeof registrationEnabled === "boolean" ? registrationEnabled : currentSettings?.registrationEnabled ?? true,
        maintenanceMode: typeof maintenanceMode === "boolean" ? maintenanceMode : currentSettings?.maintenanceMode ?? false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: authSettings.id,
        set: {
          ...(typeof registrationEnabled === "boolean" && { registrationEnabled }),
          ...(typeof maintenanceMode === "boolean" && { maintenanceMode }),
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({
      registrationEnabled: typeof registrationEnabled === "boolean" ? registrationEnabled : currentSettings?.registrationEnabled ?? true,
      maintenanceMode: typeof maintenanceMode === "boolean" ? maintenanceMode : currentSettings?.maintenanceMode ?? false,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Error updating auth settings:", error);
    return NextResponse.json(
      { error: "Failed to update auth settings" },
      { status: 500 }
    );
  }
}
