import Link from "next/link";

const navigation = [
  { label: "Overview", href: "/", active: true },
  { label: "Campaigns", href: "/campaigns", active: false },
  { label: "Recipients", href: "/recipients", active: false },
  { label: "Avatar profiles", href: "#", active: false },
];

function ArrowUpRightIcon() {
  return <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M7 7h10v10" /></svg>;
}

function PlusIcon() {
  return <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>;
}

function ChevronIcon() {
  return <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white px-5 py-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-3">
            <div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-lg shadow-slate-950/15">A</div>
            <div><p className="text-sm font-semibold tracking-tight">Avataar</p><p className="text-xs text-slate-500">Outreach platform</p></div>
          </div>
          <nav className="mt-12 space-y-1" aria-label="Primary navigation">
            <p className="px-3 pb-3 text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase">Workspace</p>
            {navigation.map((item) => (
              <Link className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-medium transition ${item.active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`} href={item.href} key={item.label}>
                {item.label}{item.active && <span className="size-1.5 rounded-full bg-cyan-300" />}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><span className="size-2 rounded-full bg-emerald-500" />Secure workspace</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">Recipient sessions will remain separated by design.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-5 py-5 sm:px-8 sm:py-8 lg:px-12">
          <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-6">
            <div className="flex items-center gap-3 lg:hidden"><div className="grid size-9 place-items-center rounded-lg bg-slate-950 text-sm font-bold text-white">A</div><span className="text-sm font-semibold">Avataar</span></div>
            <div className="hidden lg:block"><p className="text-sm text-slate-500">Your outreach workspace</p><p className="mt-1 text-sm font-medium text-slate-700">Good afternoon, Admin</p></div>
            <div className="ml-auto flex items-center gap-3"><button className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm sm:block" type="button">Help center</button><div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-cyan-200 to-indigo-300 text-xs font-bold text-slate-800">AD</div></div>
          </header>

          <div className="mx-auto max-w-6xl py-10">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div><p className="text-xs font-semibold tracking-[0.14em] text-indigo-600 uppercase">Command center</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Outreach, with a human presence.</h1><p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Create thoughtful campaigns and give every recipient a private, contextual avatar conversation.</p></div>
              <Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800" href="/campaigns/new"><PlusIcon />New campaign</Link>
            </div>

            <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace summary">
              {[["Campaigns", "0", "Ready for your first message"], ["Recipients", "0", "No contacts added yet"], ["Avatar sessions", "0", "Private sessions will appear here"], ["Avatar profiles", "0", "Configure a persona when ready"]].map(([label, value, detail]) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-5 text-4xl font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-3 text-xs text-slate-500">{detail}</p></article>
              ))}
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Campaign activity</p><p className="mt-1 text-sm text-slate-500">Your outreach timeline will appear here.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">No activity yet</span></div>
                <div className="mt-10 grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center"><div className="grid size-12 place-items-center rounded-2xl bg-indigo-100 text-indigo-700">✦</div><h2 className="mt-5 text-lg font-semibold">Begin with a meaningful campaign</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Draft the message, add recipients, then create secure links when your campaign is ready.</p><Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700" href="/campaigns/new">Explore campaign setup <ArrowUpRightIcon /></Link></div>
              </article>
              <article className="rounded-2xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/15 sm:p-8"><p className="text-xs font-semibold tracking-[0.14em] text-cyan-300 uppercase">Platform principle</p><h2 className="mt-4 text-2xl font-semibold tracking-tight">Every conversation stands on its own.</h2><p className="mt-4 text-sm leading-6 text-slate-300">Campaign content, recipient details, and avatar sessions are intentionally isolated before real-time avatar experiences are introduced.</p><div className="mt-8 space-y-3 border-t border-white/15 pt-5">{["Campaign message", "Recipient context", "Private avatar session"].map((item) => <div className="flex items-center justify-between text-sm" key={item}><span className="text-slate-300">{item}</span><ChevronIcon /></div>)}</div></article>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-3" aria-label="Setup areas">
              {[["Campaigns", "Compose message campaigns with clarity and control."], ["Recipients", "Keep contact and campaign-specific context organized."], ["Avatar profiles", "Prepare the trusted persona behind each conversation."]].map(([title, copy]) => (
                <article className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md" key={title}><div className="flex items-center justify-between"><h2 className="font-semibold">{title}</h2><span className="text-slate-400 transition group-hover:text-indigo-600"><ChevronIcon /></span></div><p className="mt-3 text-sm leading-6 text-slate-500">{copy}</p><p className="mt-5 text-xs font-semibold text-indigo-700">Coming in the next phases</p></article>
              ))}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
