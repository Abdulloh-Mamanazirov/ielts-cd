/** One icon set, one weight, shared by the marketing site, sidebar and dashboard. */
const PATHS: Record<string, React.ReactNode> = {
  listening: (
    <>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 14v3a3 3 0 0 1-3 3h-1v-6h1a3 3 0 0 1 3 3Z" />
      <path d="M3 14v3a3 3 0 0 0 3 3h1v-6H6a3 3 0 0 0-3 3Z" />
    </>
  ),
  reading: (
    <>
      <path d="M12 6.5S9.5 4 3 4v14c6.5 0 9 2.5 9 2.5s2.5-2.5 9-2.5V4c-6.5 0-9 2.5-9 2.5Z" />
      <path d="M12 6.5v14" />
    </>
  ),
  writing: (
    <>
      <path d="M15 4.5 19.5 9 8 20.5l-5 1 1-5L15 4.5Z" />
      <path d="m13 6.5 4.5 4.5" />
    </>
  ),
  speaking: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5v4" />
    </>
  ),
  full: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M3 9h18M8.5 4v5M8.5 14h7" />
    </>
  ),
};

export function SkillIcon({
  skill,
  size = 22,
  className,
}: {
  skill: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[skill] ?? PATHS.reading}
    </svg>
  );
}
