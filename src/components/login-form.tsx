"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email
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
          autoComplete="current-password"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        {state?.errors?.password && (
          <p className="mt-1 text-xs text-red-700">{state.errors.password[0]}</p>
        )}
      </div>

      {state?.message && <p className="text-sm text-red-700">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "Logging in..." : "Log in"}
      </button>

      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Start a free trial
        </Link>
      </p>

      <div className="rounded-md border border-border bg-background p-3 text-xs text-muted">
        <p className="font-medium text-foreground">Demo credentials</p>
        <p className="mt-1">Customer: manager@sunnymeadowscare.co.uk / DemoPass123!</p>
        <p>Admin: admin@cqcbulletin.co.uk / AdminDemo123!</p>
      </div>
    </form>
  );
}
