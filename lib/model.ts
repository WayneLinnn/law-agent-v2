import "server-only";

const ENDPOINT = "https://api.deepseek.com/chat/completions";
const DRAFT_MODEL = "deepseek-v4-pro";
const SMALL_MODEL = "deepseek-flash";
const CALL_TIMEOUT_MS = 240_000;
const SMALL_TIMEOUT_MS = 90_000;
const MAX_TOKENS = 16_000;
const SMALL_TOKENS = 4_000;

export const MODEL_DOWN = "起草模型暂不可用。";

export class ModelError extends Error {}

async function complete(
  system: string,
  user: string,
  options: { model: string; maxTokens: number; timeoutMs: number; reasoning?: "low" },
) {
  const key = process.env.DEEPSEEK_API_KEY?.trim().replace(/^Bearer\s+/i, "");
  if (!key) throw new ModelError("没有设置起草模型的密钥。");

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: options.maxTokens,
        ...(options.reasoning ? { reasoning_effort: options.reasoning } : {}),
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    console.error("model request failed:", error instanceof Error ? error.name : error);
    throw new ModelError(MODEL_DOWN);
  }
  if (response.status === 401) throw new ModelError("起草模型不认这个密钥。");
  if (response.status === 402) throw new ModelError("起草模型余额不足。");
  if (!response.ok) {
    console.error("model responded", response.status);
    throw new ModelError(MODEL_DOWN);
  }

  const data = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  } | null;
  const choice = data?.choices?.[0];
  const text = choice?.message?.content?.trim() ?? "";
  if (!text) {
    console.error("model returned no text:", choice?.finish_reason ?? "unreadable body");
    throw new ModelError(MODEL_DOWN);
  }
  return { text, cut: choice?.finish_reason === "length" };
}

export function write(system: string, user: string) {
  return complete(system, user, {
    model: DRAFT_MODEL,
    maxTokens: MAX_TOKENS,
    timeoutMs: CALL_TIMEOUT_MS,
  });
}

function writeSmall(system: string, user: string) {
  return complete(system, user, {
    model: SMALL_MODEL,
    maxTokens: SMALL_TOKENS,
    timeoutMs: SMALL_TIMEOUT_MS,
    reasoning: "low",
  });
}

const INTAKE_SYSTEM = `你从法律材料里抽出建档信息。只根据原文，没有的留空字符串。
只输出一个 JSON 对象，不要 Markdown：
{"client":"","opposing":"","court":"","cause":"","facts":"","mandate":""}
客户是委托人。对方是相对方。法院只写人民法院或仲裁委员会的名称，不要放进客户或对方。`;

export async function structureIntake(text: string) {
  try {
    const written = await write(INTAKE_SYSTEM, text.slice(0, 12000));
    const raw = written.text;
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const field = (key: string) =>
      typeof parsed[key] === "string" ? parsed[key].trim() : "";
    return {
      client: field("client"),
      opposing: field("opposing"),
      court: field("court"),
      cause: field("cause"),
      facts: field("facts"),
      mandate: field("mandate"),
    };
  } catch {
    return null;
  }
}

const ELEMENT_SYSTEM = `你从案件材料里抽出要素。只根据原文，不要编造。
只输出 JSON 数组，不要 Markdown。每项：
{"kind":"请求","body":"一句话","sourceLabel":"文件名或本案"}
kind 只能是请求、事实、金额、日期。最多 20 条。金额和日期写原句。`;

export async function structureElements(text: string) {
  try {
    const written = await writeSmall(ELEMENT_SYSTEM, text.slice(0, 12000));
    const raw = written.text;
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items = parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as { kind?: unknown; body?: unknown; sourceLabel?: unknown };
      if (typeof record.kind !== "string" || typeof record.body !== "string") return [];
      return [
        {
          kind: record.kind.trim(),
          body: record.body.trim(),
          sourceLabel:
            typeof record.sourceLabel === "string" ? record.sourceLabel.trim() : "本案",
        },
      ];
    });
    return items.filter((item) => item.body).slice(0, 20);
  } catch {
    return null;
  }
}

const RULING_SYSTEM = `你从一份裁判文书里抽出字段。只根据原文，没有的留空字符串。
只输出一个 JSON 对象，不要 Markdown：
{"kind":"判决","caseNumber":"","court":"","decidedOn":"","servedOn":"","effectiveOn":"","result":""}
kind 只能是判决、裁定、调解书。日期写成 YYYY-MM-DD，没有就留空。结果用原文里的裁判主文，不要发挥。`;

export async function structureRuling(text: string) {
  try {
    const written = await writeSmall(RULING_SYSTEM, text.slice(0, 12000));
    const raw = written.text;
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const field = (key: string) =>
      typeof parsed[key] === "string" ? parsed[key].trim() : "";
    return {
      kind: field("kind"),
      caseNumber: field("caseNumber"),
      court: field("court"),
      decidedOn: field("decidedOn"),
      servedOn: field("servedOn"),
      effectiveOn: field("effectiveOn"),
      result: field("result"),
    };
  } catch {
    return null;
  }
}

const FOCUS_SYSTEM = `你从已经读出的案件材料里归纳法院会列明的争议焦点。只根据原文，不要编造。
只输出 JSON 数组，不要 Markdown。最多 3 条，宁少勿多。看不出争议就输出 []。每项：
{"body":"本案要争的一点","lawQuery":"用来检索法条的法律问题"}
body 写成「是否」问句，只保留决定诉讼请求成立与否的事实，可以保留金额和日期。
lawQuery 写成检索法条用的法律问题：法律关系加上构成要件或抗辩，不写姓名、公司、案号、法院、金额和日期。
按对诉讼请求的影响从大到小排列。同一请求里的相近争点合并。独立的请求可以各占一条，总数不超过 3 条。
不要写诉讼费、受理费、律师费、鉴定费、保全费、执行费由谁承担，不要写管辖、送达、举证期限等程序事项，不要把没有争议的背景写成焦点。
例如 body 是「买受人是否应支付尚未结清的货款 186000 元」，lawQuery 是「买卖合同买受人未按约定支付到期价款时，出卖人请求支付价款的依据」。`;

export async function structureFocuses(text: string) {
  try {
    const written = await writeSmall(FOCUS_SYSTEM, text.slice(0, 12000));
    const raw = written.text;
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return null;
    const items = parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as { body?: unknown; lawQuery?: unknown };
      if (typeof record.body !== "string" || typeof record.lawQuery !== "string") return [];
      const body = record.body.trim();
      const lawQuery = record.lawQuery.trim();
      if (!body || !lawQuery) return [];
      if (/诉讼费|受理费|律师费|鉴定费|保全费|执行费/.test(`${body}${lawQuery}`)) return [];
      return [{ body, lawQuery }];
    });
    return items.slice(0, 3);
  } catch {
    return null;
  }
}
