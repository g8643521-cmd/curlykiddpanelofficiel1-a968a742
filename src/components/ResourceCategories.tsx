import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Car, 
  Map, 
  Users, 
  Shield, 
  Gamepad2,
  Code,
  MessageCircle,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ResourceCategoriesProps {
  resources: string[];
}

interface Category {
  name: string;
  icon: React.ElementType;
  keywords: string[];
  color: string;
  resources: string[];
}

const ResourceCategories = ({ resources }: ResourceCategoriesProps) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const categoryDefs: Omit<Category, 'resources'>[] = [
      { 
        name: 'Vehicles', 
        icon: Car, 
        keywords: ['car', 'vehicle', 'veh', 'garage', 'customs', 'tuning', 'mech'],
        color: 'text-[hsl(var(--cyan))]'
      },
      { 
        name: 'Maps & MLOs', 
        icon: Map, 
        keywords: ['map', 'mlo', 'interior', 'ymap', 'building', 'house'],
        color: 'text-[hsl(var(--green))]'
      },
      { 
        name: 'Jobs & Economy', 
        icon: Users, 
        keywords: ['job', 'work', 'economy', 'bank', 'atm', 'shop', 'store', 'business', 'paycheck'],
        color: 'text-[hsl(var(--yellow))]'
      },
      { 
        name: 'Admin & Security', 
        icon: Shield, 
        keywords: ['admin', 'anticheat', 'ban', 'kick', 'txadmin', 'permission', 'ace'],
        color: 'text-[hsl(var(--magenta))]'
      },
      { 
        name: 'Gameplay', 
        icon: Gamepad2, 
        keywords: ['inventory', 'hud', 'ui', 'menu', 'notify', 'target', 'progress', 'skill'],
        color: 'text-primary'
      },
      { 
        name: 'Framework', 
        icon: Code, 
        keywords: ['es_extended', 'esx', 'qb', 'qbcore', 'vrp', 'framework', 'core', 'base'],
        color: 'text-orange-400'
      },
      { 
        name: 'Communication', 
        icon: MessageCircle, 
        keywords: ['voice', 'radio', 'chat', 'mumble', 'pma', 'tokovoip', 'discord'],
        color: 'text-indigo-400'
      },
      { 
        name: 'Utilities', 
        icon: Settings, 
        keywords: ['util', 'lib', 'ox_lib', 'mysql', 'async', 'wrapper'],
        color: 'text-muted-foreground'
      },
    ];

    const categorized: Category[] = categoryDefs.map(def => ({
      ...def,
      resources: [],
    }));

    const otherResources: string[] = [];

    resources.forEach(resource => {
      const lowerResource = resource.toLowerCase();
      let matched = false;

      for (const category of categorized) {
        if (category.keywords.some(kw => lowerResource.includes(kw))) {
          category.resources.push(resource);
          matched = true;
          break;
        }
      }

      if (!matched) {
        otherResources.push(resource);
      }
    });

    // Add "Other" category
    if (otherResources.length > 0) {
      categorized.push({
        name: 'Other',
        icon: Package,
        keywords: [],
        color: 'text-muted-foreground',
        resources: otherResources,
      });
    }

    // Filter out empty categories
    return categorized.filter(c => c.resources.length > 0);
  }, [resources]);

  if (resources.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <Package className="w-5 h-5 text-primary" />
        <h3 className="font-display text-lg font-semibold text-foreground">
          Resource Categories
        </h3>
        <Badge variant="secondary" className="text-xs">
          {resources.length} total
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categories.map((category) => {
          const Icon = category.icon as any;
          const isExpanded = expandedCategory === category.name;

          return (
            <motion.div
              key={category.name}
              layout
              className={cn(
                'p-3 rounded-lg bg-secondary/30 border border-border/50 cursor-pointer transition-all hover:border-primary/30',
                isExpanded && 'col-span-2 md:col-span-4 bg-secondary/50'
              )}
              onClick={() => setExpandedCategory(isExpanded ? null : category.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', category.color)} />
                  <span className="font-medium text-sm text-foreground">{category.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {category.resources.length}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t border-border/50"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {category.resources.slice(0, 20).map((resource) => (
                      <Badge 
                        key={resource} 
                        variant="secondary" 
                        className="text-xs font-mono bg-background/50"
                      >
                        {resource}
                      </Badge>
                    ))}
                    {category.resources.length > 20 && (
                      <Badge variant="outline" className="text-xs">
                        +{category.resources.length - 20} more
                      </Badge>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ResourceCategories;
