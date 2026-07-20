import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getAdminCredential,
  hashPassword,
  updateAdminCredential,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { currentPassword, newUsername, newPassword } = body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }

    const hasNewUsername = newUsername && typeof newUsername === "string" && newUsername.trim().length > 0;
    const hasNewPassword = newPassword && typeof newPassword === "string" && newPassword.length > 0;

    if (!hasNewUsername && !hasNewPassword) {
      return NextResponse.json({ error: "Provide a new username or password." }, { status: 400 });
    }

    if (hasNewUsername) {
      const trimmed = newUsername.trim();
      if (trimmed.length < 3 || trimmed.length > 50) {
        return NextResponse.json({ error: "Username must be 3-50 characters." }, { status: 400 });
      }
    }

    if (hasNewPassword && newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const cred = await getAdminCredential();
    if (!cred) {
      return NextResponse.json({ error: "No admin credential found." }, { status: 500 });
    }

    // Verify current password against stored hash
    const { scryptSync, timingSafeEqual } = await import("node:crypto");
    const computed = scryptSync(currentPassword, cred.passwordSalt, 64).toString("hex");
    const bufA = Buffer.from(computed, "hex");
    const bufB = Buffer.from(cred.passwordHash, "hex");
    if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const updateData: { username?: string; passwordHash?: string; passwordSalt?: string } = {};

    if (hasNewUsername) {
      updateData.username = newUsername.trim();
    }

    if (hasNewPassword) {
      const { hash, salt } = hashPassword(newPassword);
      updateData.passwordHash = hash;
      updateData.passwordSalt = salt;
    }

    await updateAdminCredential(updateData);

    return NextResponse.json({
      success: true,
      usernameChanged: hasNewUsername,
      passwordChanged: hasNewPassword,
    });
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
