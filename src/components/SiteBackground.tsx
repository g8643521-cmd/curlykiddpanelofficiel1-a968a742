/**
 * Global ambient site background — matches the /auth page.
 * Mounted once in App so every route shares the same look.
 */
const SiteBackground = () => {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.12),transparent_54%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.08),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.06)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />
    </div>
  );
};

export default SiteBackground;
