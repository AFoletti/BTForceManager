import * as React from 'react';
import { cn } from '../../lib/utils';

const TabsContext = React.createContext({});

export function Tabs({ defaultValue, value, onValueChange, children, className }) {
  const [activeTab, setActiveTab] = React.useState(value || defaultValue);
  
  const handleValueChange = (newValue) => {
    setActiveTab(newValue);
    onValueChange?.(newValue);
  };
  
  return (
    <TabsContext.Provider value={{ activeTab: value || activeTab, setActiveTab: handleValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }) {
  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded bg-muted p-1 text-muted-foreground gap-1',
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className, children }) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext);
  const isActive = activeTab === value;
  
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        isActive ? 'bg-background text-foreground shadow-sm' : 'hover:bg-background/50',
        className
      )}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children }) {
  const { activeTab } = React.useContext(TabsContext);
  
  if (activeTab !== value) return null;
  
  return <div className={cn('mt-2', className)}>{children}</div>;
}
