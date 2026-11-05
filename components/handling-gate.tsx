import { StartHandlingButton } from "@/components/start-handling-button";
import type { MatterStatus } from "@/lib/constants";

export function HandlingGate({
  matterId,
  status,
  materialCount,
}: {
  matterId: string;
  status: MatterStatus;
  materialCount: number;
}) {
  if (status !== "待立案") return null;
  if (materialCount === 0) {
    return (
      <p className="text-sm leading-6 text-foreground">
        本案还没有已入库的材料，不能进入办理中。
      </p>
    );
  }
  return <StartHandlingButton matterId={matterId} />;
}
