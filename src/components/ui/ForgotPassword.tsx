import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useToast, ToastContainer } from "@/components/ui/Toast";

export function ForgotPassword() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentResetLink, setSentResetLink] = useState(false);
  const { toasts, addToast, dismiss } = useToast();

  // Already logged in → redirect
  if (session) return <Navigate to={from} replace />;

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );

    setLoading(false);
    setSentResetLink(true);

    if (authError) {
      setError(friendlyError(authError.message));
    } else {
      addToast("Please check your email for the reset link.", "success");
    }
  }

  return (
    <form noValidate className="space-y-4" onSubmit={handleResetSubmit}>
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-[hsl(var(--foreground))]"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={cn(
            "w-full rounded-xl border bg-[hsl(var(--background))] px-3.5 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] outline-none transition-colors",
            "focus:border-amul-red focus:ring-2 focus:ring-amul-red/20",
            error ? "border-red-400" : "border-[hsl(var(--border))]",
          )}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || sentResetLink}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amul-red px-4 py-2.5 text-sm font-semibold text-white shadow-amul transition-all hover:bg-amul-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <LogIn size={16} />
        )}
        {loading ? "Sending reset link..." : "Send reset link"}
      </button>
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </form>
  );
}
