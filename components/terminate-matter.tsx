import { TerminateMatterButton } from "@/components/terminate-matter-button";
import {
  canTerminate,
  TERMINATED_NOTE,
  type MatterStatus,
} from "@/lib/constants";

export function TerminateMatter({
  matterId,
  status,
}: {
  matterId: string;
  status: MatterStatus;
}) {
  if (status === "已终止") {
    return (
      <p className="text-sm leading-6 text-foreground">{TERMINATED_NOTE}</p>
    );
  }
  if (!canTerminate(status)) return null;
  return <TerminateMatterButton matterId={matterId} />;
}
