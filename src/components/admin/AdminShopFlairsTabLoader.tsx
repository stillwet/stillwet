import { prisma } from "@/lib/prisma";
import { AdminShopFlairsTab } from "@/components/admin/AdminShopFlairsTab";

export async function AdminShopFlairsTabLoader() {
  const types = await prisma.shopFlairType.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return <AdminShopFlairsTab types={types} />;
}
