import { BLOG_URL, REPO_URL, VIDEO_URL } from "@/lib/links";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-8 text-[13px] leading-5 text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Spend-Aware Agent. Built for Total Recall, Tatum × Walrus Memory. MIT licensed.</p>
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          <a className="hover:text-ink" href={REPO_URL}>GitHub</a>
          <a className="hover:text-ink" href={VIDEO_URL}>Demo video</a>
          {BLOG_URL && (
            <a className="hover:text-ink" href={BLOG_URL}>
              Blog post
            </a>
          )}
          <a className="hover:text-ink" href="https://tatum.io/hackathon/total-recall">Hackathon</a>
        </p>
      </div>
    </footer>
  );
}
