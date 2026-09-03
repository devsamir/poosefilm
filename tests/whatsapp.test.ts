import { describe, expect, it } from "vitest";

import { validateWhatsappTemplate } from "~/services/settings.server";
import { buildWhatsAppUrl } from "~/utils/whatsapp";

describe("WhatsApp message templates", () => {
  it("builds a prefilled wa.me URL with the order link", () => {
    const url = new URL(buildWhatsAppUrl({
      template: "Halo {customerName}, order {orderCode}: {link}",
      customerName: "Husein",
      orderCode: "PB260903-01020304",
      whatsapp: "08123456789",
      publicBaseUrl: "https://pos.poosebox.id",
    }));

    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/628123456789");
    expect(url.searchParams.get("text")).toBe("Halo Husein, order PB260903-01020304: https://pos.poosebox.id/order/PB260903-01020304");
  });

  it("requires the link placeholder and rejects unknown placeholders", () => {
    expect(() => validateWhatsappTemplate("Halo {customerName}")).toThrow();
    expect(() => validateWhatsappTemplate("Halo {customerName}, {unknown}, {link}")).toThrow();
    expect(validateWhatsappTemplate("Halo {customerName}, buka {link}")).toBe("Halo {customerName}, buka {link}");
  });
});
