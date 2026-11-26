export default function SectionHeading({ id, children, aside }) {
  const className =
    'text-[11px] font-bold uppercase tracking-wider text-slate-500' +
    (aside ? '' : ' mb-2.5');

  const heading = (
    <h2 id={id} className={className}>
      {children}
    </h2>
  );

  return aside ? (
    <div className="flex items-center justify-between mb-2.5">
      {heading}
      {aside}
    </div>
  ) : (
    heading
  );
}
