const CosmicNebulaBackground = () => {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none bg-background"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--primary)/0.12),transparent_54%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,hsl(var(--cyan-glow)/0.08),transparent_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_35%,hsl(var(--background)/0.78)_100%)]" />
    </div>
  );
};

export default CosmicNebulaBackground;