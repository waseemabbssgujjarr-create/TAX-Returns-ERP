import { Link } from '@/i18n/navigation'

type LegalSection = {
  title: string
  paragraphs: string[]
  bullets?: string[]
}

type LegalDocumentProps = {
  title: string
  lastUpdated: string
  reviewBanner: string
  intro: string[]
  sections: LegalSection[]
  backLabel: string
}

export function LegalDocument({
  title,
  lastUpdated,
  reviewBanner,
  intro,
  sections,
  backLabel,
}: LegalDocumentProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="mb-6">
        <Link
          href="/"
          className="text-primary focus-visible:ring-primary text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {backLabel}
        </Link>
      </p>

      <header className="border-border mb-8 space-y-3 border-b pb-8">
        <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{lastUpdated}</p>
        <aside
          className="border-warning/40 bg-warning/10 text-foreground rounded-md border px-4 py-3 text-sm"
          role="status"
        >
          {reviewBanner}
        </aside>
      </header>

      <div className="text-muted-foreground space-y-4 text-base leading-relaxed">
        {intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section
            key={section.title}
            className="space-y-3"
            aria-labelledby={slugId(section.title)}
          >
            <h2 id={slugId(section.title)} className="text-foreground text-xl font-semibold">
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-muted-foreground text-base leading-relaxed">
                {paragraph}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <ul className="text-muted-foreground list-disc space-y-2 ps-5 text-base leading-relaxed">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  )
}

function slugId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, '-')
    .replace(/^-|-$/g, '')
}

export type { LegalSection, LegalDocumentProps }
