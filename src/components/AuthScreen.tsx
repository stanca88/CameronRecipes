import { useState } from "react";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useFamilyAuth } from "../lib/useFamilyAuth";

export function AuthScreen({ auth }: { auth: ReturnType<typeof useFamilyAuth> }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") {
        await auth.signInWithPassword(email.trim(), password);
      } else {
        if (!name.trim() || !code.trim()) throw new Error("Name and family invite code are required.");
        const session = await auth.signUp(email.trim(), password, name.trim());
        if (session) {
          const ok = await auth.joinFamily(code.trim(), name.trim());
          if (!ok) throw new Error("That family invite code does not match.");
        } else {
          setCheckEmail(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (checkEmail) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#faf9f5] px-4 text-[#1f3529]">
        <div className="w-full max-w-sm rounded-[1.75rem] border border-[#ddd4c3] bg-[#fffdf8] p-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-[#e8f0e8] text-2xl">✉️</div>
          <h1 className="font-serif text-2xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm text-[#6d786f]">
            Open the confirmation link sent to <strong>{email}</strong>. After you confirm, come back and sign in to
            finish joining the family.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#faf9f5] px-4 text-[#1f3529]">
      <div className="w-full max-w-sm rounded-[1.75rem] border border-[#ddd4c3] bg-[#fffdf8] p-8">
        <div className="mb-6 flex items-center gap-2 text-[#45644e]">
          <ChefHat size={22} />
          <span className="font-serif text-lg font-bold">Cameron Family Table</span>
        </div>
        <h1 className="font-serif text-2xl font-bold">{mode === "signup" ? "Join the family" : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-[#6d786f]">
          {mode === "signup"
            ? "Create your account and enter the family invite code."
            : "Sign in to your shared family recipe box."}
        </p>
        <div className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="code">Family invite code</Label>
              <Input id="code" autoComplete="off" placeholder="CAMERON-…" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          )}
          {error && <p className="rounded-xl bg-[#fbe9e2] p-3 text-sm text-[#9a402d]">{error}</p>}
          <Button
            className="w-full bg-[#45644e] text-white hover:bg-[#37503f]"
            disabled={busy || !email.trim() || !password.trim()}
            onClick={submit}
          >
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}>
            {mode === "signup" ? "I already have an account" : "New here? Create an account"}
          </Button>
        </div>
      </div>
    </main>
  );
}
