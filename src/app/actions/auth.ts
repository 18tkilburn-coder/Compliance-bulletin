"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, deleteSession } from "@/lib/session";
import { SUBSCRIPTION_TIERS, type UserRole } from "@/lib/types";

export interface AuthFormState {
  errors?: Record<string, string[]>;
  message?: string;
}

const SignupSchema = z.object({
  name: z.string().min(2, "Enter your full name."),
  careHomeName: z.string().min(2, "Enter your care home or organisation name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  tier: z.enum(SUBSCRIPTION_TIERS),
});

export async function signup(
  _state: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const validated = SignupSchema.safeParse({
    name: formData.get("name"),
    careHomeName: formData.get("careHomeName"),
    email: formData.get("email"),
    password: formData.get("password"),
    tier: formData.get("tier"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, careHomeName, email, password, tier } = validated.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["An account with this email address already exists."] } };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: "CUSTOMER",
      subscription: {
        create: {
          careHomeName,
          tier,
          billingStatus: "TRIALING",
        },
      },
    },
  });

  await createSession(user.id, user.role as UserRole);
  redirect("/dashboard");
}

const LoginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function login(
  _state: AuthFormState | undefined,
  formData: FormData
): Promise<AuthFormState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { message: "Invalid email or password." };
  }

  await createSession(user.id, user.role as UserRole);
  redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
