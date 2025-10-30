import React from "react";
import { Globe, Lock } from "lucide-react";
import spotLogo from '/sopt-log.png';


export default function SpotBullePremium() {
  return (
    <div
      className="min-h-screen py-10 px-6 text-white"
      style={{ backgroundColor: 'rgb(0, 23, 46)' }}
    >
      {/* Premium Header */}
      <div className=" ">
        <div className="mx-auto max-w-7xl px-4">
          <div className="h-16 flex items-center justify-between border px-14 rounded-md border-white/10/5">
            {/* Left: brand */}
            <div className="flex items-center gap-6">
              <img
                src={spotLogo}
                alt="SpotBulle Premium"
                className="h-10 w-auto "
              />
              <span className="text-lg tracking-wide text-white/80 ">PSG</span>
            </div>

            {/* Right: actions */}
            <nav className="flex items-center gap-6 text-sm">
              <button className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors">
                <Globe className="h-5 w-5" />
                <span className=" text-lg">Langue</span>
              </button>
              <button className="inline-flex items-center gap-2 text-white/90 hover:text-white transition-colors">
                <Lock className="h-5 w-5" />
                <span className=" text-lg">Profil</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main content placeholder */}
      <main className="min-h-[70vh] px-4" />
    </div>
  );
}
