"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

export interface ValidCodeData {
  code: string;
  cup: {
    id: string;
    name: string;
  };
  categories: { id: string; name: string }[];
  expiresAt: Date | null;
}

interface InvitationCodeInputProps {
  /** Callback when code is validated successfully */
  onValidCode: (data: ValidCodeData) => void;
  /** Optional: auto-focus the input */
  autoFocus?: boolean;
  /** Optional: show a compact version */
  compact?: boolean;
  /** Optional: placeholder text */
  placeholder?: string;
  /** Optional: button text */
  buttonText?: string;
  /** Optional: disabled state */
  disabled?: boolean;
}

/**
 * Reusable component for entering and validating jury invitation codes
 * Used in: public portal modal, jury dashboard
 */
export function InvitationCodeInput({
  onValidCode,
  autoFocus = false,
  compact = false,
  placeholder = "ABC-123-XYZ",
  buttonText = "Valider",
  disabled = false,
}: InvitationCodeInputProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidCodeData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount if autoFocus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Use refetch pattern for manual validation
  const { refetch, isFetching } = api.juryCodes.getByCode.useQuery(
    { code: code.toUpperCase().trim() },
    {
      enabled: false, // Never auto-fetch
      retry: false,
    }
  );

  // Format code as user types (add dashes)
  const handleCodeChange = (value: string) => {
    // Remove all non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // Add dashes after every 3 characters
    let formatted = "";
    for (let i = 0; i < cleaned.length && i < 9; i++) {
      if (i > 0 && i % 3 === 0) {
        formatted += "-";
      }
      formatted += cleaned[i];
    }

    setCode(formatted);
    setError(null);
    setValidationResult(null);
  };

  // Handle validation
  const handleValidate = useCallback(async () => {
    if (code.length < 11) {
      setError("Code incomplet (format: ABC-123-XYZ)");
      return;
    }

    setError(null);
    setValidationResult(null);

    try {
      const result = await refetch();

      if (result.error) {
        setError(result.error.message ?? "Code invalide");
        return;
      }

      const data = result.data;
      if (!data) {
        setError("Erreur de validation");
        return;
      }

      if (!data.valid) {
        setError(data.message ?? "Code invalide");
        return;
      }

      // Valid code!
      const validData: ValidCodeData = {
        code: data.code!,
        cup: data.cup!,
        categories: data.categories!,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      };

      setValidationResult(validData);
      onValidCode(validData);
    } catch (err) {
      setError("Erreur lors de la validation");
    }
  }, [code, refetch, onValidCode]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length >= 11 && !isFetching) {
      handleValidate();
    }
  };

  const isValid = !!validationResult;
  const isInvalid = !!error;

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className={cn("flex gap-2", compact ? "flex-row" : "flex-col sm:flex-row")}>
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "font-mono text-center text-lg tracking-widest uppercase",
              compact && "text-base",
              isValid && "border-green-500 focus-visible:ring-green-500",
              isInvalid && "border-destructive focus-visible:ring-destructive"
            )}
            maxLength={11}
            disabled={disabled || isFetching}
          />
          {/* Status indicator */}
          {(isFetching || isValid || isInvalid) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {isValid && !isFetching && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {isInvalid && !isFetching && <XCircle className="h-4 w-4 text-destructive" />}
            </div>
          )}
        </div>

        <Button
          onClick={handleValidate}
          disabled={disabled || code.length < 11 || isFetching}
          className={cn("shrink-0", compact && "px-3")}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {!compact && buttonText}
              <ArrowRight className={cn("h-4 w-4", !compact && "ml-2")} />
            </>
          )}
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-destructive text-center"
        >
          {error}
        </motion.p>
      )}

      {/* Success preview */}
      {isValid && validationResult && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-green-500/10 border border-green-500/20"
        >
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            Code valide !
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Cup: <span className="font-medium text-foreground">{validationResult.cup.name}</span>
          </p>
          {validationResult.categories.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Catégories: {validationResult.categories.map(c => c.name).join(", ")}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
