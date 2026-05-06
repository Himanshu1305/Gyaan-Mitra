import { supabase } from "./supabase";

export const FREE_LIMIT = 5;

function currentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getUsageThisMonth(userId: string): Promise<number> {
  const { count } = await supabase
    .from("usage_tracking")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("month_year", currentMonthYear());
  return count ?? 0;
}

export async function incrementUsage(userId: string, featureUsed: string): Promise<void> {
  await supabase.from("usage_tracking").insert([{
    user_id: userId,
    feature_used: featureUsed,
    month_year: currentMonthYear(),
  }]);
}

export async function isWithinFreeLimit(userId: string): Promise<boolean> {
  const usage = await getUsageThisMonth(userId);
  return usage < FREE_LIMIT;
}
