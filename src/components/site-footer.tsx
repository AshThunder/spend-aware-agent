export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-8 text-[13px] leading-5 text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Spend-Aware Agent. Built for Total Recall, Tatum × Walrus Memory. MIT licensed.</p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <a className="hover:text-ink" href="https://github.com/AshThunder/spend-aware-agent">GitHub</a>
          <a className="hover:text-ink" href="https://dev.to/chrisgold/an-agent-that-stops-paying-for-data-it-already-learned-was-useless-ao5">
            Blog post
          </a>
          <a className="hover:text-ink" href="https://tatum.io/hackathon/total-recall">Hackathon</a>
        </p>
      </div>
    </footer>
  );
}
