import { useUserStore } from "../stores/userStore";

export function useAuth() {
  const { user, isLoading } = useUserStore();
  return {
    user,
    emailVerified: user?.emailVerified ?? false,
    loading: isLoading,
  };
}
