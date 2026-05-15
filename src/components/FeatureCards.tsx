import { memo, useState } from "react";
import { Search, Users, Globe, Zap, Sparkles, ArrowRight, Shield, Database, Map, Activity } from "lucide-react";


const categories = [
  { id: "all", label: "All" },
  { id: "intelligence", label: "Intelligence" },
  { id: "players", label: "Players" },
  { id: "geo", label: "Geo" },
  { id: "monitoring", label: "Monitoring" },
];

const features = [
  {
    id: "server-intelligence",
    category: "intelligence",
    icon: Search,
    title: "Server Intelligence",
    description: "Retrieve direct IP addresses and connection data from any CFX join code instantly",
    colorClass: "icon-badge-cyan",
    gradient: "from-[hsl(var(--cyan))]/30 to-[hsl(var(--cyan))]/5",
    borderColor: "border-[hsl(var(--cyan))]/50",
    badge: { text: "CORE", color: "bg-[hsl(var(--cyan))]" },
  },
  {
    id: "player-analytics",
    category: "players",
    icon: Users,
    title: "Live Player Analytics",
    description: "Monitor active players with real-time ping metrics, identifiers, and session data",
    colorClass: "icon-badge-magenta",
    gradient: "from-[hsl(var(--magenta))]/30 to-[hsl(var(--magenta))]/5",
    borderColor: "border-[hsl(var(--magenta))]/50",
    badge: { text: "LIVE", color: "bg-[hsl(var(--magenta))]" },
  },
  {
    id: "geolocation",
    category: "geo",
    icon: Globe,
    title: "Geolocation Data",
    description: "Access precise hosting infrastructure details including region, ISP, and latency zones",
    colorClass: "icon-badge-purple",
    gradient: "from-[hsl(var(--purple))]/30 to-[hsl(var(--purple))]/5",
    borderColor: "border-[hsl(var(--purple))]/50",
  },
  {
    id: "performance",
    category: "monitoring",
    icon: Zap,
    title: "Performance Monitoring",
    description: "Track uptime history, resource usage, anti-cheat systems, and server build information",
    colorClass: "icon-badge-yellow",
    gradient: "from-[hsl(var(--yellow))]/30 to-[hsl(var(--yellow))]/5",
    borderColor: "border-[hsl(var(--yellow))]/50",
  },
  {
    id: "player-locator",
    category: "players",
    icon: Map,
    title: "Player Locator",
    description: "Search for players across multiple servers simultaneously with advanced filtering",
    colorClass: "icon-badge-cyan",
    gradient: "from-transparent to-transparent",
    borderColor: "border-border/50",
  },
  {
    id: "cheater-db",
    category: "intelligence",
    icon: Shield,
    title: "Cheater Database",
    description: "Community-driven database to identify and track known cheaters across servers",
    colorClass: "icon-badge-magenta",
    gradient: "from-transparent to-transparent",
    borderColor: "border-border/50",
  },
  {
    id: "favorites",
    category: "monitoring",
    icon: Database,
    title: "Server Favorites",
    description: "Save and organize your favorite servers with custom notifications and alerts",
    colorClass: "icon-badge-purple",
    gradient: "from-transparent to-transparent",
    borderColor: "border-border/50",
  },
  {
    id: "uptime",
    category: "monitoring",
    icon: Activity,
    title: "Uptime Tracking",
    description: "Historical uptime data with player count trends and server availability metrics",
    colorClass: "icon-badge-yellow",
    gradient: "from-transparent to-transparent",
    borderColor: "border-border/50",
  },
];

const FeatureCard = memo(({ feature }: { feature: typeof features[0] }) => (
  <div className={`glass-card-hover p-6 text-left group cursor-pointer relative overflow-hidden transition-all duration-300 hover:-translate-y-1 border ${feature.borderColor}`}>
    {/* Gradient background */}
    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} transition-opacity duration-500`} />
    
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-4">
        <div className={`${feature.colorClass}`}>
          <feature.icon className="w-6 h-6" />
        </div>
        {feature.badge && (
          <span className={`${feature.badge.color} text-[10px] font-bold px-2 py-0.5 rounded-full text-black`}>
            {feature.badge.text}
          </span>
        )}
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
        {feature.title}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {feature.description}
      </p>
    </div>
  </div>
));

FeatureCard.displayName = "FeatureCard";

const FeatureCards = memo(() => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  
  const handleExploreAll = () => {
    setIsExpanded(true);
    // Scroll to the feature grid after a brief delay
    setTimeout(() => {
      const gridElement = document.getElementById("feature-grid");
      if (gridElement) {
        gridElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  const filteredFeatures = activeCategory === "all" 
    ? features 
    : features.filter(f => f.category === activeCategory);

  return (
    <div className="w-full max-w-6xl mx-auto mt-12 space-y-8">
      {/* Explore All Features Button - Always visible */}
      <div className="flex justify-center">
        <button 
          onClick={handleExploreAll}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-muted/50 border border-border hover:border-primary/50 hover:bg-muted transition-all duration-200 group"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Explore All Features</span>
          <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Feature content - only visible when expanded */}
      {isExpanded && (
        <>
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Features
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              Everything You <span className="text-primary">Need</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete toolkit designed for FiveM server intelligence
            </p>
          </div>

          {/* Category Navigation */}
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Feature Grid */}
          <div id="feature-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 scroll-mt-8">
            {filteredFeatures.map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>
        </>
      )}
    </div>
  );
});

FeatureCards.displayName = "FeatureCards";

export default FeatureCards;
