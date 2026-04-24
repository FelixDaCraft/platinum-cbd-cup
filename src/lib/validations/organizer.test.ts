import { describe, it, expect } from "vitest";
import {
  organizerSignupSchema,
  organizerStep1Schema,
  organizerStep2Schema,
  organizerStep3Schema,
} from "./organizer";

describe("organizerSignupSchema", () => {
  const validData = {
    name: "Jean Dupont",
    email: "jean@entreprise.com",
    companyName: "Mon Entreprise",
    password: "Password123!",
    confirmPassword: "Password123!",
    plan: "pro" as const,
    acceptTerms: true,
  };

  it("should validate correct data", () => {
    const result = organizerSignupSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = organizerSignupSchema.safeParse({
      ...validData,
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("email");
    }
  });

  it("should reject short name", () => {
    const result = organizerSignupSchema.safeParse({
      ...validData,
      name: "J",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("name");
    }
  });

  it("should reject weak password", () => {
    const result = organizerSignupSchema.safeParse({
      ...validData,
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("password");
    }
  });

  it("should reject mismatched passwords", () => {
    const result = organizerSignupSchema.safeParse({
      ...validData,
      confirmPassword: "Different123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("confirmPassword");
    }
  });

  it("should reject invalid plan", () => {
    const result = organizerSignupSchema.safeParse({
      ...validData,
      plan: "invalid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("plan");
    }
  });

  it("should reject unaccepted terms", () => {
    const result = organizerSignupSchema.safeParse({
      ...validData,
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("acceptTerms");
    }
  });

  it("should accept all valid plans", () => {
    const plans = ["starter", "pro", "enterprise"] as const;
    plans.forEach((plan) => {
      const result = organizerSignupSchema.safeParse({ ...validData, plan });
      expect(result.success).toBe(true);
    });
  });
});

describe("organizerStep1Schema", () => {
  it("should validate step 1 data", () => {
    const result = organizerStep1Schema.safeParse({
      name: "Jean Dupont",
      email: "jean@entreprise.com",
      companyName: "Mon Entreprise",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing company name", () => {
    const result = organizerStep1Schema.safeParse({
      name: "Jean Dupont",
      email: "jean@entreprise.com",
    });
    expect(result.success).toBe(false);
  });
});

describe("organizerStep2Schema", () => {
  it("should validate step 2 data", () => {
    const result = organizerStep2Schema.safeParse({
      password: "Password123!",
      confirmPassword: "Password123!",
    });
    expect(result.success).toBe(true);
  });

  it("should reject password without uppercase", () => {
    const result = organizerStep2Schema.safeParse({
      password: "password123!",
      confirmPassword: "password123!",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password without special character", () => {
    const result = organizerStep2Schema.safeParse({
      password: "Password1234",
      confirmPassword: "Password1234",
    });
    expect(result.success).toBe(false);
  });
});

describe("organizerStep3Schema", () => {
  it("should validate step 3 data", () => {
    const result = organizerStep3Schema.safeParse({
      plan: "pro",
      acceptTerms: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject without accepting terms", () => {
    const result = organizerStep3Schema.safeParse({
      plan: "pro",
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
  });
});
