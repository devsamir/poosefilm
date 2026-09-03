import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "app/tailwind.css"), "utf8");
const receiptComponent = readFileSync(resolve(process.cwd(), "app/components/Receipt.tsx"), "utf8");

describe("receipt print stylesheet", () => {
  it("keeps the receipt and its QR visible while hiding the app chrome", () => {
    expect(stylesheet).toContain("body * { visibility: hidden; }");
    expect(stylesheet).toContain(".receipt-area, .receipt-area * { visibility: visible; }");
    expect(stylesheet).not.toContain("body > *:not(#root)");
  });

  it("renders a larger QR on every receipt surface", () => {
    expect(receiptComponent).toContain('className="h-36 w-36"');
    expect(receiptComponent).not.toContain('className="h-28 w-28"');
  });
});
