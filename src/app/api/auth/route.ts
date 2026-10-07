import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { checkPassword, clearSession, hashPassword, isAdminEmail, setSession } from "@/lib/auth";
import { calculateAge, isValidEmail, isValidUsername, MIN_SIGNUP_AGE, normalizeSecurityAnswer } from "@/lib/profile";
import { ALLOWED_AVATAR_MIME_TYPES, MAX_AVATAR_BYTES } from "@/lib/profile";
import { parseDataUrl } from "@/lib/deposits";
import { currencyForCountry, countryByCode } from "@/lib/countries";
import { notifyUser } from "@/lib/notify";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

// Looks up a user by email OR username (both unique, case-insensitive),
// so the login form can accept either as the "identifier".
async function findByIdentifier(identifier: string) {
  const value = identifier.trim().toLowerCase();
  const [user] = await db.select().from(users).where(or(eq(users.email, value), eq(sql`lower(${users.username})`, value))).limit(1);
  return user ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "");

    if (action === "logout") return await clearSession(request, NextResponse.json({ success: true }));

    if (action === "register") {
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const confirmPassword = String(body.confirmPassword ?? "");
      const dateOfBirth = String(body.dateOfBirth ?? "").trim();
      const gender = body.gender ? String(body.gender).trim() : null;
      const country = String(body.country ?? "").trim().toUpperCase();
      const state = body.state ? String(body.state).trim() : null;
      const city = body.city ? String(body.city).trim() : null;
      const address = body.address ? String(body.address).trim() : null;
      const phone = String(body.phone ?? "").trim();
      const profilePhoto = body.profilePhoto ? String(body.profilePhoto) : null;
      const referralCode = body.referralCode ? String(body.referralCode).trim() : null;
      const securityQuestion = body.securityQuestion ? String(body.securityQuestion).trim() : null;
      const securityAnswer = body.securityAnswer ? String(body.securityAnswer).trim() : null;
      const termsAccepted = body.termsAccepted === true;
      const privacyAccepted = body.privacyAccepted === true;

      // --- Required-field validation -----------------------------------
      if (name.length < 2 || name.length > 80) return bad("Full name must be between 2 and 80 characters.");
      if (!isValidEmail(email)) return bad("Enter a valid email address.");
      if (!isValidUsername(username)) return bad("Username must be 3-24 characters and contain only letters, numbers, underscores, or periods.");
      if (password.length < 8) return bad("Password must be at least 8 characters.");
      if (password !== confirmPassword) return bad("Password and confirm password do not match.");
      if (!dateOfBirth || Number.isNaN(Date.parse(dateOfBirth))) return bad("Enter a valid date of birth.");
      const age = calculateAge(dateOfBirth);
      if (age === null || age < MIN_SIGNUP_AGE) return bad(`You must be at least ${MIN_SIGNUP_AGE} years old to create an account.`);
      if (!countryByCode(country)) return bad("Select a valid country.");
      if (!phone || phone.length < 5 || phone.length > 25) return bad("Enter a valid phone number.");
      if (!termsAccepted) return bad("You must agree to the Terms & Conditions.");
      if (!privacyAccepted) return bad("You must agree to the Privacy Policy.");
      if ((securityQuestion && !securityAnswer) || (!securityQuestion && securityAnswer)) {
        return bad("Enter both a security question and an answer, or leave both blank.");
      }

      let avatarDataUrl: string | null = null;
      if (profilePhoto) {
        const parsed = parseDataUrl(profilePhoto);
        if (!parsed) return bad("Profile photo could not be read. Try a different file.");
        if (!ALLOWED_AVATAR_MIME_TYPES.includes(parsed.mimeType)) return bad("Profile photo must be a JPEG, PNG, WebP, or GIF image.");
        if (parsed.byteLength > MAX_AVATAR_BYTES) return bad(`Profile photo must be under ${Math.round(MAX_AVATAR_BYTES / 1024 / 1024)}MB.`);
        avatarDataUrl = profilePhoto;
      }

      const [existingEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existingEmail) return bad("An account with this email already exists.", 409);
      const [existingUsername] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.username})`, username)).limit(1);
      if (existingUsername) return bad("That username is already taken.", 409);

      const now = new Date();
      const [user] = await db.insert(users).values({
        name,
        email,
        username,
        passwordHash: hashPassword(password),
        cashBalance: "10000.00",
        role: isAdminEmail(email) ? "admin" : "user",
        dateOfBirth,
        gender,
        country,
        state,
        city,
        address,
        phone,
        profilePhoto: avatarDataUrl,
        referralCode,
        securityQuestion,
        securityAnswerHash: securityAnswer ? hashPassword(normalizeSecurityAnswer(securityAnswer)) : null,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        currency: currencyForCountry(country),
      }).returning();
      await notifyUser({
        userId: user.id,
        type: "account_created",
        title: "Welcome to NexaTrade!",
        message: "Your account has been created with $10,000 in paper trading funds. Explore the markets, place your first trade, or check out the trading bots and copy trading catalog whenever you're ready.",
      });
      return await setSession(NextResponse.json({ success: true }), user.id);
    }

    if (action === "login") {
      const identifier = String(body.identifier ?? body.email ?? "").trim();
      const password = String(body.password ?? "");
      if (!identifier || !password) return bad("Enter your email/username and password.");
      const user = await findByIdentifier(identifier);
      if (!user?.passwordHash || !checkPassword(password, user.passwordHash)) return bad("Incorrect email/username or password.", 401);
      if (user.accountStatus === "locked") return bad("This account has been locked. Contact support for help.", 403);
      // Allow promoting an existing account to admin by listing its email in ADMIN_EMAILS.
      if (user.email && isAdminEmail(user.email) && user.role !== "admin") await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
      await notifyUser({
        userId: user.id,
        type: "login",
        title: "New sign-in to your account",
        message: `We noticed a new sign-in to your NexaTrade account on ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}${ip ? ` from ${ip}` : ""}. If this wasn't you, change your password right away from Profile → Security.`,
      });
      return await setSession(NextResponse.json({ success: true }), user.id);
    }

    // --- Forgot password, via the user-authored security question --------
    if (action === "getSecurityQuestion") {
      const identifier = String(body.identifier ?? "").trim();
      if (!identifier) return bad("Enter your email or username.");
      const user = await findByIdentifier(identifier);
      if (!user || !user.securityQuestion || !user.securityAnswerHash) {
        return bad("No security question is set up for this account. Contact support to reset your password.");
      }
      return NextResponse.json({ success: true, question: user.securityQuestion });
    }
    if (action === "resetPasswordWithSecurityAnswer") {
      const identifier = String(body.identifier ?? "").trim();
      const answer = String(body.answer ?? "");
      const newPassword = String(body.newPassword ?? "");
      if (!identifier || !answer || !newPassword) return bad("Fill in every field.");
      if (newPassword.length < 8) return bad("New password must be at least 8 characters.");
      const user = await findByIdentifier(identifier);
      if (!user || !user.securityAnswerHash || !checkPassword(normalizeSecurityAnswer(answer), user.securityAnswerHash)) {
        return bad("That answer doesn't match our records.", 401);
      }
      await db.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, user.id));
      // Reset invalidates any existing sessions (e.g. on a device someone
      // else was using), matching standard password-reset behavior.
      await db.delete(sessions).where(eq(sessions.userId, user.id));
      await notifyUser({
        userId: user.id,
        type: "password_changed",
        title: "Your password was reset",
        message: "Your NexaTrade password was just reset using your security question. If you didn't do this, contact support immediately.",
      });
      return NextResponse.json({ success: true });
    }

    return bad("Invalid action.");
  } catch (error) {
    console.error("Auth:", error);
    return bad("Unable to process your request.", 500);
  }
}
