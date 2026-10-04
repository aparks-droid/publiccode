import { ImageResponse } from "next/og";
export const alt = "ParksPacific Financial — Company Brain";
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
        background: "#F5F2FB",
        padding: "70px",
        color: "#1A2456",
        borderLeft: "12px solid #C8A84B",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 22,
          letterSpacing: 5,
          color: "#9A7E2E",
          textTransform: "uppercase",
        }}
      >
        Company brain
      </div>
      <div style={{ fontSize: 84, lineHeight: 1.1, marginTop: 110 }}>
        ParksPacific Financial
      </div>
      <div
        style={{
          marginTop: 36,
          fontSize: 32,
          fontStyle: "italic",
          color: "#4A4570",
        }}
      >
        You may have to live with risk, but you never have to let it win.
      </div>
    </div>,
    size,
  );
}
