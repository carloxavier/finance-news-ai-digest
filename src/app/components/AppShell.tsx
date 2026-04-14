import { Settings } from "lucide-react";

interface AppShellProps {
  email: string;
  children: React.ReactNode;
}

export function AppShell({ email, children }: AppShellProps) {
  const initial = (email || "?").charAt(0).toUpperCase();
  const hue = email.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div className="min-h-screen" style={{ background: "var(--navy-bg)" }}>
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-5 py-3 backdrop-blur-xl border-b"
        style={{
          background: "rgba(13, 27, 42, 0.92)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <span
          className="text-xl tracking-tight"
          style={{ fontFamily: "var(--font-headline)" }}
        >
          Finno<span style={{ color: "var(--citation-blue)" }}>polis</span>
        </span>
        <div className="flex items-center gap-3">
          <button
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Settings"
          >
            <Settings className="w-[18px] h-[18px] text-white/50" />
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
            style={{ backgroundColor: `hsl(${hue}, 45%, 35%)` }}
          >
            {initial}
          </div>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
