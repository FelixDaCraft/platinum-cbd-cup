import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  PASSWORD_CRITERIA,
} from "./auth";

describe("passwordSchema", () => {
  it("rejects passwords shorter than 12 characters", () => {
    const result = passwordSchema.safeParse("Short1!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("12 caractères");
    }
  });

  it("rejects passwords without uppercase", () => {
    const result = passwordSchema.safeParse("lowercase1234!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("majuscule");
    }
  });

  it("rejects passwords without digits", () => {
    const result = passwordSchema.safeParse("NoDigitsHere!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("chiffre");
    }
  });

  it("rejects passwords without special characters", () => {
    const result = passwordSchema.safeParse("NoSpecial1234");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("caractère spécial");
    }
  });

  it("accepts valid passwords", () => {
    const result = passwordSchema.safeParse("ValidPass123!");
    expect(result.success).toBe(true);
  });

  it("accepts passwords with various special characters", () => {
    const validPasswords = [
      "Password123!",
      "Password123@",
      "Password123#",
      "Password123$",
      "Password123%",
      "Password123&",
      "Password123*",
      "Password123-",
      "Password123_",
    ];

    validPasswords.forEach((password) => {
      const result = passwordSchema.safeParse(password);
      expect(result.success).toBe(true);
    });
  });
});

describe("registerSchema", () => {
  const validData = {
    email: "test@example.com",
    password: "ValidPass123!",
    confirmPassword: "ValidPass123!",
  };

  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = registerSchema.safeParse({
      ...validData,
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("email invalide");
    }
  });

  it("rejects empty email", () => {
    const result = registerSchema.safeParse({
      ...validData,
      email: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("requis");
    }
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: "DifferentPass123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("ne correspondent pas");
    }
  });

  it("rejects empty confirmPassword", () => {
    const result = registerSchema.safeParse({
      ...validData,
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
  });

  it("validates password rules through registerSchema", () => {
    const result = registerSchema.safeParse({
      ...validData,
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  const validData = {
    email: "test@example.com",
    password: "anypassword",
  };

  it("accepts valid login data", () => {
    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("accepts any non-empty password (no strict validation)", () => {
    // Login doesn't enforce password rules - server handles that
    const result = loginSchema.safeParse({
      ...validData,
      password: "weak",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({
      ...validData,
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("email invalide");
    }
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({
      ...validData,
      email: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("requis");
    }
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      ...validData,
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("requis");
    }
  });

  it("accepts passwords of any complexity", () => {
    // Unlike registration, login accepts any password format
    const passwords = ["1", "abc", "!@#", "simple"];
    passwords.forEach((password) => {
      const result = loginSchema.safeParse({ ...validData, password });
      expect(result.success).toBe(true);
    });
  });

  it("rejects whitespace-only email", () => {
    // Whitespace-only email fails the email format validation
    const result = loginSchema.safeParse({
      ...validData,
      email: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("email invalide");
    }
  });

  it("accepts whitespace-only password (server validates)", () => {
    // Client-side login doesn't enforce password rules - server handles it
    // Whitespace-only password passes min(1) check, server will reject if invalid
    const result = loginSchema.safeParse({
      ...validData,
      password: "   ",
    });
    expect(result.success).toBe(true);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("email invalide");
    }
  });

  it("rejects empty email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("requis");
    }
  });

  it("rejects whitespace-only email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("email invalide");
    }
  });
});

describe("resetPasswordSchema", () => {
  const validData = {
    password: "ValidPass123!",
    confirmPassword: "ValidPass123!",
  };

  it("accepts valid reset password data", () => {
    const result = resetPasswordSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      ...validData,
      confirmPassword: "DifferentPass123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("ne correspondent pas");
    }
  });

  it("rejects weak passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
  });

  it("validates password rules (requires 12+ chars)", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Short1!",
      confirmPassword: "Short1!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("12 caractères");
    }
  });

  it("validates password rules (requires uppercase)", () => {
    const result = resetPasswordSchema.safeParse({
      password: "lowercase1234!",
      confirmPassword: "lowercase1234!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("majuscule");
    }
  });

  it("validates password rules (requires digit)", () => {
    const result = resetPasswordSchema.safeParse({
      password: "NoDigitsHere!!",
      confirmPassword: "NoDigitsHere!!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("chiffre");
    }
  });

  it("validates password rules (requires special char)", () => {
    const result = resetPasswordSchema.safeParse({
      password: "NoSpecial12345",
      confirmPassword: "NoSpecial12345",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("caractère spécial");
    }
  });

  it("rejects empty confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({
      password: "ValidPass123!",
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("PASSWORD_CRITERIA", () => {
  it("has 4 criteria defined", () => {
    expect(PASSWORD_CRITERIA).toHaveLength(4);
  });

  it("each criterion has label and regex", () => {
    PASSWORD_CRITERIA.forEach((criterion) => {
      expect(criterion).toHaveProperty("label");
      expect(criterion).toHaveProperty("regex");
      expect(criterion.regex).toBeInstanceOf(RegExp);
    });
  });

  it("criteria match expected password requirements", () => {
    const validPassword = "ValidPass123!";

    PASSWORD_CRITERIA.forEach((criterion) => {
      expect(criterion.regex.test(validPassword)).toBe(true);
    });
  });

  it("criteria detect missing requirements", () => {
    // Missing length
    expect(PASSWORD_CRITERIA[0]?.regex.test("Short1!")).toBe(false);
    // Missing uppercase
    expect(PASSWORD_CRITERIA[1]?.regex.test("lowercase123!")).toBe(false);
    // Missing digit
    expect(PASSWORD_CRITERIA[2]?.regex.test("NoDigitsHere!")).toBe(false);
    // Missing special char
    expect(PASSWORD_CRITERIA[3]?.regex.test("NoSpecial1234")).toBe(false);
  });
});
