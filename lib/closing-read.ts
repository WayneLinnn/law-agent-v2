export type ClosingRuling = {
  filename: string;
  kind: string;
  decidedOn: string;
  servedOn: string;
  effectiveOn: string;
  result: string;
  text: string;
};

function clip(text: string) {
  const match = text.match(
    /(?:判决如下|裁定如下|调解协议|协议如下)[：:]?\s*([\s\S]{0,400})/,
  );
  const body = (match?.[1] ?? "").split(/\n\s*\n/)[0].trim();
  return body.length > 300 ? `${body.slice(0, 300)}……` : body;
}

export function statementFromRulings(input: {
  instance: string;
  caseNumber: string;
  courtName: string;
  rulings: ClosingRuling[];
}) {
  if (input.rulings.length === 0) return "";
  const head = [
    `本审${input.instance ? `（${input.instance}）` : ""}裁判要点`,
    input.caseNumber ? `案号：${input.caseNumber}` : "",
    input.courtName ? `法院：${input.courtName}` : "",
  ].filter(Boolean);
  const blocks = input.rulings.map((ruling) => {
    const lines = [
      `${ruling.kind} · ${ruling.filename}`,
      ruling.decidedOn ? `裁判日期：${ruling.decidedOn}` : "",
      ruling.servedOn ? `送达日：${ruling.servedOn}` : "",
      ruling.effectiveOn ? `生效日：${ruling.effectiveOn}` : "",
      ruling.result ? `结果：${ruling.result}` : "",
      clip(ruling.text) && !ruling.result ? `主文：${clip(ruling.text)}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  });
  return [...head, ...blocks].join("\n");
}
