"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthFormState } from "@/app/actions/auth";
import { SUBSCRIPTION_TIERS, TIER_DETAILS, type SubscriptionTier } from "@/lib/types";

const initialState: AuthFormState = {};

export function SignupForm({ defaultTier }: { defaultTier: SubscriptionTier }) {
  const [state, action, pending] = useActionState(signup, initialState);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Your name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        {state?.errors?.name && (
          <p className="mt-1 text-xs text-red-700">{state.errors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="careHomeName" className="block text-sm font-medium text-foreground">
          Care home / organisation name
        </label>
        <input
          id="careHomeName"
          name="careHomeName"
          type="text"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        {state?.errors?.careHomeName && (
          <p className="mt-1 text-xs text-red-700">{state.errors.careHomeName[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        {state?.errors?.email && (
          <p className="mt-1 text-xs text-red-700">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        {state?.errors?.password && (
          <p className="mt-1 text-xs text-red-700">{state.errors.password[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="tier" className="block text-sm font-medium text-foreground">
          Plan
        </label>
        <select
          id="tier"
          name="tier"
          defaultValue={defaultTier}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        >
          {SUBSCRIPTION_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {TIER_DETAILS[tier].label} — {TIER_DETAILS[tier].price}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">You can change this later from your account page.</p>
      </div>

      {state?.message && <p className="text-sm text-red-700">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "Creating your account..." : "Start free trial"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
