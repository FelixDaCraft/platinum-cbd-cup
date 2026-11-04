import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import {
  parcelCancellableWhere,
  parcelReceivableWhere,
  productStatusChange,
} from "./parcel-receipt";

const dialect = new PgDialect();
const toSql = (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(condition);

describe("productStatusChange", () => {
  it("« reçu » pose received_at, comme product.updateStatus", () => {
    const now = new Date("2026-11-04T10:00:00Z");
    expect(productStatusChange("received", now)).toEqual({
      status: "received",
      updatedAt: now,
      receivedAt: now,
    });
  });

  it("les autres statuts ne touchent pas received_at", () => {
    const now = new Date("2026-11-04T10:00:00Z");
    expect(productStatusChange("rating", now)).toEqual({ status: "rating", updatedAt: now });
  });
});

describe("conditions des mises à jour groupées", () => {
  it("réception : uniquement les produits encore « à envoyer » de l'inscription", () => {
    const { sql, params } = toSql(parcelReceivableWhere("reg-1")!);
    expect(sql).toContain('"products"."registration_id" = $1');
    expect(sql).toContain('"products"."status" = $2');
    expect(params).toEqual(["reg-1", "pending"]);
  });

  it("annulation : uniquement les produits « reçus », sans aucune note commencée", () => {
    const { sql, params } = toSql(parcelCancellableWhere("reg-1")!);
    expect(sql).toContain('"products"."registration_id" = $1');
    expect(sql).toContain('"products"."status" = $2');
    expect(params).toEqual(["reg-1", "received"]);
    expect(sql).toMatch(/not exists \(select 1 from "product_ratings" where "product_ratings"\."product_id" = "products"\."id"\)/);
  });
});
