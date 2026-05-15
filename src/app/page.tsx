import { AppTabs } from '@/components/layout/app-tabs'

export default function Home() {
  return (
    <main className="relative min-h-screen min-h-[100dvh] md:overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-24 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute right-[-5rem] top-16 h-72 w-72 rounded-full bg-secondary/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-secondary/15 blur-3xl" />
      </div>

      <div className="relative">
        <AppTabs />
      </div>
    </main>
  )
}
