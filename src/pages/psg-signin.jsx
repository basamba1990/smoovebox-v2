import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Label } from "../components/ui/label.jsx";

// PSG colors: Navy #0A122A, Red #DA291C

export const PsgSignin = () => {
  const navigate = useNavigate();
  const { signIn, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    try {
      setSubmitting(true);
      await signIn(email.trim(), password);
      toast.success("Connexion réussie");
      navigate("/");
    } catch (err) {
      toast.error(err.message || "Email ou mot de passe incorrect");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0A122A] via-[#0A122A] to-[#151B34] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="p-[2px] rounded-3xl border-[#C9A227] border shadow-2xl">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0A122A]/70">
          <div className="h-1 w-full bg-gradient-to-r from-[#DA291C] via-white to-[#0A122A]" />

          <div className="px-8 pt-8 pb-4 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#DA291C] shadow-md" />
              <img
                src="/logo.png"
                alt="SpotBulle"
                className="h-10 w-auto opacity-90"
              />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Connexion Supporters PSG
            </h1>
            <p className="mt-2 text-sm text-gray-300">
              Accédez aux expériences dédiées à la communauté.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-8 pt-2 space-y-5">
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="email" className="col-span-4 text-gray-200">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="col-span-4 bg-white/90 focus:bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="password" className="col-span-4 text-gray-200">
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="col-span-4 bg-white/90 focus:bg-white"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              disabled={loading || submitting}
              className="w-full h-11 bg-[#DA291C] hover:bg-[#c32518] text-white border-0 shadow-lg"
            >
              {loading || submitting ? "Connexion…" : "Se connecter"}
            </Button>

            <div className="text-center text-sm text-gray-300">
              <span>Nouveau ? </span>
              <button
                type="button"
                onClick={() => navigate("/psg-signup")}
                className="text-white underline decoration-[#DA291C]/60 underline-offset-4 hover:decoration-[#DA291C]"
              >
                Créer un compte
              </button>
            </div>
          </form>
          </div>
        </div>

        <div className="text-center mt-6 text-gray-300 text-xs">
          <p>SpotBulle x PSG — Passion, Communauté, Performance</p>
        </div>
      </div>
    </div>
  );
};
