import { PARTY_ROLE_LABEL, type PartyRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function PartyColumns({
  parties,
  courtName = "",
}: {
  parties: Record<PartyRole, string[]>;
  courtName?: string;
}) {
  const court = courtName || parties.court.join("、");
  const columns = [
    { label: PARTY_ROLE_LABEL.client, value: parties.client.join("、") },
    ...(parties.ally.length
      ? [{ label: PARTY_ROLE_LABEL.ally, value: parties.ally.join("、") }]
      : []),
    { label: PARTY_ROLE_LABEL.opposing, value: parties.opposing.join("、") },
    { label: "法院", value: court },
  ];
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-3",
        columns.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3",
      )}
    >
      {columns.map((column) => (
        <div
          key={column.label}
          className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow)]"
        >
          <dt className="text-xs font-medium text-muted">{column.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-foreground">
            {column.value || "未填写"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
