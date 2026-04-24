"use client";

import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

import { cn } from "~/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { ScrollArea, ScrollBar } from "~/components/ui/scroll-area";

export interface PreviewRow {
  index: number;
  data: Record<string, string>;
  status: "valid" | "invalid" | "warning";
  error?: string;
}

interface CsvPreviewTableProps {
  rows: PreviewRow[];
  columns: string[];
  maxHeight?: string;
}

export function CsvPreviewTable({ rows, columns, maxHeight = "400px" }: CsvPreviewTableProps) {
  const validCount = rows.filter((r) => r.status === "valid").length;
  const warningCount = rows.filter((r) => r.status === "warning").length;
  const invalidCount = rows.filter((r) => r.status === "invalid").length;

  const getStatusIcon = (status: PreviewRow["status"]) => {
    switch (status) {
      case "valid":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "invalid":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Prévisualisation ({rows.length} lignes)
        </span>
        <div className="flex items-center gap-2">
          {validCount > 0 && (
            <Badge variant="outline">
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
              {validCount} valides
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="outline">
              <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
              {warningCount} existants
            </Badge>
          )}
          {invalidCount > 0 && (
            <Badge variant="outline">
              <XCircle className="h-3 w-3 mr-1 text-destructive" />
              {invalidCount} erreurs
            </Badge>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="n-card overflow-hidden" style={{ padding: 0 }}>
        <ScrollArea className="w-full" style={{ maxHeight }}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent" style={{ borderColor: "var(--n-border)" }}>
                <TableHead className="w-12 text-center">#</TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="min-w-[120px]">
                    {col}
                  </TableHead>
                ))}
                <TableHead className="w-24 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.index}
                  className={cn(
                    row.status === "invalid" && "bg-destructive/5",
                    row.status === "warning" && "bg-yellow-500/5"
                  )}
                  style={{ borderColor: "var(--n-border)" }}
                >
                  <TableCell className="text-center text-muted-foreground text-xs">
                    {row.index + 1}
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col} className="text-sm">
                      {row.data[col] || "-"}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {getStatusIcon(row.status)}
                      {row.error && (
                        <span className="text-xs text-destructive max-w-[100px] truncate" title={row.error}>
                          {row.error}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}
