import Link from "next/link";
export default function NotFound() {
  return (
    <main className="wrap stack-lg" style={{ paddingTop: "4rem" }}>
      <h1>Off <em>target.</em></h1>
      <p className="lede">That page went over the bar.</p>
      <Link className="btn btn-primary" href="/">Back to the clubhouse</Link>
    </main>
  );
}
