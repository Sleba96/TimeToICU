import Link from "next/link";

export default function Footer() {
  return (
    <footer className="foot">
      <div className="call">
        <span className="num">995</span>
        <span>Emergency? Call 995</span>
      </div>
      <nav aria-label="More">
        <Link href="/about">About</Link>
        <Link href="/about#sources">Sources</Link>
      </nav>
    </footer>
  );
}
