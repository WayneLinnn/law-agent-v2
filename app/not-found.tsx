import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-background px-8 py-16 text-foreground">
      <h1 className="font-serif text-3xl">没有这件案子</h1>
      <Link href="/" className="mt-6 inline-block text-sm text-foreground underline">
        回到工作台
      </Link>
    </main>
  );
}
