import { z } from "zod";

import { MIN_PASSWORD_LENGTH } from "./password";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254)
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: emailSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    // bcrypt-style truncation is not a concern with scrypt, but an unbounded
    // password is a cheap way to make hashing expensive.
    .max(200, "Password must be under 200 characters"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Flattens a Zod error into `{ field: message }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
