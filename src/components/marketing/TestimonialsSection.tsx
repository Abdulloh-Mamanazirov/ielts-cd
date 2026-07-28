import { Carousel } from "./Carousel";
import { SectionHeading } from "./SectionHeading";
import { SeeAllLink } from "./SeeAllLink";
import type { VideoTestimonial } from "./VideoCard";
import { VideoGrid } from "./VideoGrid";

export type Testimonial = VideoTestimonial & {
  rating: number;
  quoteEn: string | null;
};

export function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  if (testimonials.length === 0) return null;

  const written = testimonials.filter((item) => item.mediaType === "TEXT");
  const videos = testimonials.filter((item) => item.mediaType !== "TEXT");

  return (
    <section id="testimonials" className="scroll-mt-24 bg-surface-alt py-16 lg:py-24">
      <div className="mx-auto max-w-[1440px] px-8 lg:px-14">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="REVIEWS"
            title={
              <>
                In their words.
                <br />
                And their videos.
              </>
            }
            className="mb-0"
          />
          <SeeAllLink href="/results">All reviews</SeeAllLink>
        </div>

        {videos.length > 0 && (
          <div className="mb-10">
            <VideoGrid videos={videos} />
          </div>
        )}

        {written.length > 0 && (
          <Carousel label="Written reviews">
            {written.map((item) => (
              <li
                key={item.id}
                className="w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-[30%] xl:w-[23%]"
              >
                <blockquote className="group flex h-full flex-col bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_50px_-24px_rgba(11,17,32,.35)]">
                  <p aria-label={`${item.rating} out of 5`} className="text-sm text-brand-red">
                    {"★".repeat(item.rating)}
                    <span className="text-ink-faint">{"★".repeat(5 - item.rating)}</span>
                  </p>
                  <p className="mt-4 flex-1 text-base leading-relaxed text-ink text-pretty">
                    {item.quoteEn}
                  </p>
                  <footer className="mt-6 border-t border-rule pt-4 text-[10px] font-bold tracking-[0.2em] text-ink-subtle">
                    {item.studentName.toUpperCase()}
                  </footer>
                </blockquote>
              </li>
            ))}
          </Carousel>
        )}
      </div>
    </section>
  );
}
