import { PageSkeleton } from "@/components/skeleton";
export default function Loading() {
  return <PageSkeleton cards={3} columns="lg:grid-cols-[1fr_380px]" />;
}
