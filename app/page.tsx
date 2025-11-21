"use client"; 

import Navbar from "../components/ui/navigation-menu";
import { useSession } from "next-auth/react";
import Dashboard from "@/components/ui/dashboard";
import Link from "next/link";

function LandingHero() {
  return (
    <section
      data-aos="fade-up"
      className="mx-auto flex max-w-5xl flex-col items-center gap-10 rounded-[32px] border border-white/10 bg-white/10 px-8 py-16 text-center shadow-[0_40px_120px_rgba(15,23,42,0.6)] backdrop-blur-xl"
    >
      <p className="text-sm uppercase tracking-[0.6em] text-blue-200/80">
        Eventful
      </p>
      <h1 className="text-4xl font-semibold text-white md:text-5xl">
        Curate unforgettable gatherings with a few clicks.
      </h1>
      <p className="max-w-3xl text-base text-slate-200/90 md:text-lg">
        Discover experiences near you, manage RSVPs, and share memories with a vibrant community.
        Sign in to unlock your personalized dashboard and start creating.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-white px-10 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-blue-500/40 transition hover:-translate-y-0.5 hover:bg-blue-50"
      >
        Sign in to continue
      </Link>
    </section>
  );
}

export default function Home() {
  const { data: session } = useSession();

  return (
    <>
      <Navbar />
      <main
        data-aos="fade-up"
        className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 px-4 py-12"
      >
        {session ? <Dashboard /> : <LandingHero />}
      </main>
    </>
  );
}
