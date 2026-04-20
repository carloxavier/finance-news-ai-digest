import { Settings } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
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
        <button
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Settings"
        >
          <Settings className="w-[18px] h-[18px] text-white/50" />
        </button>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
