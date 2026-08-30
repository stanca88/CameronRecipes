import { useState } from "react";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useFamilyAuth } from "../lib/useFamilyAuth";

export function JoinFamilyScreen({ auth }: { auth: ReturnType<typeof useFamilyAuth> }) {
  const [name, setName] = useState((auth.user?.user_metadata?.display_name as string) || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      await auth.joinFamily(code.trim(), name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That invite code does not match.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#faf9f5] px-4 text-[#1f3529]">
      <div className="w-full max-w-sm rounded-[1.75rem] border border-[#ddd4c3] bg-[#fffdf8] p-8">
        <div className="mb-6 flex items-center gap-2 text-[#45644e]">
          <ChefHat size={22} />
          <span className="font-serif text-lg font-bold">Cameron Family Table</span>
        </div>
        <h1 className="font-serif text-2xl font-bold">Join your family</h1>
        <p className="mt-1 text-sm text-[#6d786f]">
          Your account is signed in. Enter the Cameron family invite code once to unlock the shared recipes.
        </p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="jname">Your name</Label>
            <Input id="jname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jcode">Family invite code</Label>
            <Input id="jcode" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAMERON-…" />
          </div>
          {error && <p className="rounded-xl bg-[#fbe9e2] p-3 text-sm text-[#9a402d]">{error}</p>}
          <Button className="w-full bg-[#45644e] text-white hover:bg-[#37503f]" disabled={busy || !name.trim() || !code.trim()} onClick={submit}>
            {busy ? "Joining…" : "Join Family Table"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => auth.signOut()}>
            Use another account
          </Button>
        </div>
      </div>
    </main>
  );
}
