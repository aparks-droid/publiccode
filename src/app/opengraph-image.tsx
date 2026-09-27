import { ImageResponse } from "next/og";
export const alt = "Company Brain — your business, connected";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#faf9fc",
        padding: "70px",
        color: "#171717",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28 }}
      >
        <div
          style={{
            height: 40,
            width: 40,
            borderRadius: 40,
            background: "linear-gradient(135deg,#dfcaff,#7c3aed,#41217d)",
          }}
        />
        company brain
      </div>
      <div
        style={{
          fontSize: 76,
          lineHeight: 1.15,
          letterSpacing: -3,
          marginTop: 90,
        }}
      >
        Your business,
      </div>
      <div style={{ fontSize: 76, color: "#877297", letterSpacing: -3 }}>
        connected.
      </div>
      <div style={{ marginTop: 48, fontSize: 22, color: "#888" }}>
        Shared knowledge. Your models. Built with Cortex.
      </div>
    </div>,
    size,
  );
}
