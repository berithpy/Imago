import { createDefaultPageMetadata } from "@/client/lib/pageMetadata";
import { usePageMetadata } from "@/client/lib/usePageMetadata";

export function About() {
  const defaults = createDefaultPageMetadata();
  const pageMetadata = usePageMetadata({
    ...defaults,
    title: "About Imago",
    description: "Learn what Imago is and how to contact support.",
    ogTitle: "About Imago",
    ogDescription: "Learn what Imago is and how to contact support.",
    twitterTitle: "About Imago",
    twitterDescription: "Learn what Imago is and how to contact support.",
    canonicalUrl: `${window.location.origin}/about`,
    ogUrl: `${window.location.origin}/about`,
  });

  return (
    <>
      {pageMetadata}
      <div className="min-h-screen bg-neutral-950 px-6 py-12 text-neutral-100 sm:px-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-10">
          <header className="flex flex-col gap-3">
            <a
              href="/"
              className="w-fit text-sm text-neutral-400 transition-colors hover:text-amber-300"
            >
              Back to home
            </a>
            <h1 className="text-3xl font-semibold tracking-tight text-amber-300 sm:text-4xl">
              About Imago
            </h1>
            <p className="text-base text-neutral-300 sm:text-lg">
              Imago is a straightforward photo gallery service for photographers who want to
              deliver client work quickly, keep access private when needed, and let clients
              download without extra friction.
            </p>
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-neutral-100 sm:text-xl">Support</h2>
            <p className="text-neutral-300">
              Need help with a gallery, account access, or an unexpected issue? Reach us at:
            </p>
            <a
              href="mailto:imago-support@imago.berith.moe"
              className="w-fit rounded-lg border border-amber-400/60 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:border-amber-300 hover:text-amber-200"
            >
              imago-support@imago.berith.moe
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
