import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

// The starting page. Replace it with the app's own; it shows the API is reachable.
export default function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  return (
    <Card>
      <CardContent className="space-y-2 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Edit <code>apps/web/src/pages/HomePage.tsx</code> to start building.
        </p>
        <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="api-status">
          API: {health.isLoading ? "checking…" : health.data?.status === "ok" ? "ok" : "unreachable"}
        </p>
      </CardContent>
    </Card>
  );
}
