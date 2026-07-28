import { Carousel } from "./Carousel";
import { ResultCard, type ShowcaseResult } from "./ResultCard";
import { SectionHeading } from "./SectionHeading";
import { SeeAllLink } from "./SeeAllLink";

export type { ShowcaseResult };

/** A sample on the home page; the full board lives at /results. */
export function ResultsSection({ results }: { results: ShowcaseResult[] }) {
  if (results.length === 0) return null;

  return (
    <section id="results" className="relative scroll-mt-24 overflow-hidden bg-white py-16 lg:py-24">
      <div aria-hidden className="om-grid-lines absolute inset-0" />

      <div className="relative mx-auto max-w-[1440px] px-8 lg:px-14">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="STUDENT RESULTS"
            title={
              <>
                The board,
                <br />
                not the brochure.
              </>
            }
            subtitle="Real band scores, with the Test Report Form to back them up."
            className="mb-0"
          />
          <SeeAllLink href="/results">All results</SeeAllLink>
        </div>

        <Carousel label="Student results">
          {results.map((result, index) => (
            <li
              key={result.id}
              className="w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-[30%] xl:w-[23%]"
            >
              <ResultCard result={result} index={index} />
            </li>
          ))}
        </Carousel>
      </div>
    </section>
  );
}
