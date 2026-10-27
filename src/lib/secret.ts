import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Comparaison à temps constant de deux secrets partagés.
 *
 * Les deux valeurs sont hachées avant comparaison pour que `timingSafeEqual`
 * reçoive toujours deux buffers de même longueur (il lève une exception sinon,
 * ce qui divulguerait la longueur du secret attendu).
 */
export function secretsMatch(provided: string, expected: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(provided).digest(),
    createHash("sha256").update(expected).digest()
  );
}
