import { askLaw, lookupLaw } from "@/lib/ask";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    question?: unknown;
    lookup?: unknown;
  } | null;
  const question = typeof body?.question === "string" ? body.question : "";
  const result = body?.lookup === true ? await lookupLaw(question) : await askLaw(question);
  if (!result.ok) {
    return Response.json(
      { error: result.error, laws: result.laws, cases: result.cases },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    {
      answer: "answer" in result ? result.answer : null,
      laws: result.laws,
      cases: result.cases,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
