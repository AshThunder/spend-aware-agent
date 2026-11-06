export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-6 text-[13px] leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Spend-Aware Agent. Built for Total Recall, Tatum × Walrus Memory.</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a className="hover:text-ink" href="https://github.com/AshThunder/spend-aware-agent">
            GitHub
          </a>
          <a className="hover:text-ink" href="https://spend-aware-agent.vercel.app/console">
            Console
          </a>
          <a className="hover:text-ink" href="https://tatum.io/hackathon/total-recall">
            Hackathon
          </a>
        </p>
      </div>
    </footer>
  );
}
