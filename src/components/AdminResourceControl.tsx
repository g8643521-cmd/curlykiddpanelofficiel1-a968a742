import { useState } from 'react';
import { Power, PowerOff, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AdminResourceControlProps {
  resources: string[];
  serverName: string;
}

const AdminResourceControl = ({ resources, serverName }: AdminResourceControlProps) => {
  const [stoppedResources, setStoppedResources] = useState<Set<string>>(new Set());
  const [isStoppingAll, setIsStoppingAll] = useState(false);

  const toggleResource = (resource: string) => {
    setStoppedResources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resource)) {
        newSet.delete(resource);
        toast.success(`Resource "${resource}" started`, {
          icon: <Power className="w-4 h-4 text-green" />,
        });
      } else {
        newSet.add(resource);
        toast.success(`Resource "${resource}" stopped`, {
          icon: <PowerOff className="w-4 h-4 text-destructive" />,
        });
      }
      return newSet;
    });
  };

  const handleStopAll = () => {
    setIsStoppingAll(true);
    const allResources = new Set(resources);
    setStoppedResources(allResources);
    toast.success(`All ${resources.length} resources stopped`, {
      icon: <PowerOff className="w-4 h-4 text-destructive" />,
    });
    setTimeout(() => setIsStoppingAll(false), 500);
  };

  const handleStartAll = () => {
    setStoppedResources(new Set());
    toast.success(`All resources started`, {
      icon: <Power className="w-4 h-4 text-green" />,
    });
  };

  return (
    <div className="glass-card p-6 border-[hsl(var(--magenta))]/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[hsl(var(--magenta))]" />
          <h4 className="font-display font-semibold text-foreground">Admin Resource Control</h4>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartAll}
            className="text-[hsl(var(--green))] border-[hsl(var(--green))]/50 hover:bg-[hsl(var(--green))]/10"
            disabled={stoppedResources.size === 0}
          >
            <Power className="w-4 h-4 mr-1" />
            Start All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleStopAll}
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            disabled={isStoppingAll || stoppedResources.size === resources.length}
          >
            <PowerOff className="w-4 h-4 mr-1" />
            Stop All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
        {resources.map((resource) => {
          const isStopped = stoppedResources.has(resource);
          return (
            <button
              key={resource}
              onClick={() => toggleResource(resource)}
              className={`p-3 rounded-lg text-sm text-left truncate ${
                isStopped
                  ? 'bg-destructive/20 text-destructive border border-destructive/30 line-through opacity-60'
                  : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                {isStopped ? (
                  <PowerOff className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <Power className="w-3 h-3 flex-shrink-0 text-[hsl(var(--green))]" />
                )}
                <span className="truncate">{resource}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {stoppedResources.size} of {resources.length} resources stopped
        </span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[hsl(var(--green))]" />
          <span className="text-muted-foreground">{resources.length - stoppedResources.size} running</span>
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-muted-foreground">{stoppedResources.size} stopped</span>
        </div>
      </div>
    </div>
  );
};

export default AdminResourceControl;