import { PromotionsPickerShell } from "@/components/dashboard/PromotionsPickerShell";
import { PromotionsSectionFrame } from "@/components/dashboard/PromotionsSectionFrame";

export default function DashboardPromotionsLoading() {
  return (
    <PromotionsSectionFrame>
      <PromotionsPickerShell />
    </PromotionsSectionFrame>
  );
}
