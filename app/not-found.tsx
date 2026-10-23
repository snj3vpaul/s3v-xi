import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0C1925", color: "#F4F1E9", padding: 24 }}>
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <p style={{ color: "#C7F36A", letterSpacing: ".18em", fontSize: 12, fontWeight: 700 }}>S3V XI / PAGE NOT FOUND</p>
        <h1 style={{ fontSize: "clamp(78px, 17vw, 170px)", margin: "12px 0", lineHeight: .9 }}>404.</h1>
        <p style={{ lineHeight: 1.8, color: "#AEBBC4", marginBottom: 30 }}>This one sailed over the boundary. Head back to the pavilion.</p>
        <Link href="/" style={{ color: "#0C1925", background: "#C7F36A", display: "inline-block", padding: "14px 22px", fontSize: 13, fontWeight: 700 }}>BACK TO S3V XI ↗</Link>
      </div>
    </main>
  );
}
