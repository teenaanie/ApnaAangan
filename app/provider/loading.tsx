import { PageSkeleton } from "@/components/skeleton";
export default function Loading() {
  return <PageSkeleton cards={4} columns="sm:grid-cols-2" />;
}
