import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainPageTransition } from "@/components/routing/MainPageTransition";

interface ProtectedPageProps {
  children: React.ReactNode;
}

export function ProtectedPage({ children }: ProtectedPageProps) {
  return (
    <ProtectedRoute>
      <MainPageTransition>{children}</MainPageTransition>
    </ProtectedRoute>
  );
}
