const appName = process.env.NEXT_PUBLIC_APP_NAME || "App Big";
const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || "#";
const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || "#";

export default function Home() {
  return (
    <main className="min-h-dvh bg-[#f6f7fb] text-slate-950">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6 pt-5">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-slate-950 text-lg font-bold text-white shadow-lg shadow-slate-900/20">
              B
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">PWA oficial</p>
              <h1 className="text-xl font-bold tracking-normal">{appName}</h1>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="mb-7 overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-2xl shadow-slate-900/20">
            <div className="mb-12 flex items-center justify-between">
              <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">
                Mobile-first
              </span>
              <span className="text-xs text-white/65">Instalavel</span>
            </div>
            <p className="max-w-64 text-3xl font-black leading-tight tracking-normal">
              Acesse sua plataforma com uma experiencia rapida e direta.
            </p>
            <div className="mt-8 rounded-2xl bg-white/10 p-4">
              <p className="text-sm leading-6 text-white/75">
                Area reservada para banners, avisos e campanhas futuras.
              </p>
            </div>
          </div>

          <p className="mb-6 text-base leading-7 text-slate-600">
            Um app leve, instalavel no Android e preparado para evoluir com
            notificacoes e painel administrativo nas proximas etapas.
          </p>

          <div className="grid gap-3">
            <a
              className="flex min-h-14 items-center justify-center rounded-2xl bg-[#16a34a] px-5 text-base font-bold text-white shadow-lg shadow-green-700/20 transition hover:bg-[#15803d] focus:outline-none focus:ring-4 focus:ring-green-200"
              href={platformUrl}
            >
              Acessar
            </a>
            <a
              className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-base font-bold text-slate-800 shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-200"
              href={supportUrl}
            >
              Suporte
            </a>
          </div>
        </div>

        <a
          aria-label="Abrir suporte"
          className="fixed bottom-5 right-5 grid size-14 place-items-center rounded-full bg-slate-950 text-xl font-black text-white shadow-xl shadow-slate-900/25 transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-slate-300"
          href={supportUrl}
        >
          ?
        </a>
      </section>
    </main>
  );
}
