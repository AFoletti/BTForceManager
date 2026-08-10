import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { ShieldAlert } from 'lucide-react';
import AdminForcesPanel from './admin/AdminForcesPanel';
import AdminMechCatalogPanel from './admin/AdminMechCatalogPanel';
import AdminSpChoicesPanel from './admin/AdminSpChoicesPanel';
import AdminDowntimeActionsPanel from './admin/AdminDowntimeActionsPanel';
import AdminAchievementsPanel from './admin/AdminAchievementsPanel';

// Admin: global/operational configuration, kept visually and
// navigationally distinct from play flows (Mission Manager, Downtime tab,
// Kill logging, ...). No accounts/roles - reachability is purely via this
// entry point.
export default function AdminView({ open, onOpenChange, forces, onRefreshForces }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="admin-view-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="w-5 h-5" />
            Admin
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="forces">
          <TabsList data-testid="admin-tabs-list">
            <TabsTrigger value="forces" data-testid="admin-tab-forces">Forces</TabsTrigger>
            <TabsTrigger value="mech-catalog" data-testid="admin-tab-mech-catalog">Mech Catalog</TabsTrigger>
            <TabsTrigger value="sp-choices" data-testid="admin-tab-sp-choices">SP Purchases</TabsTrigger>
            <TabsTrigger value="downtime-actions" data-testid="admin-tab-downtime-actions">Downtime</TabsTrigger>
            <TabsTrigger value="achievements" data-testid="admin-tab-achievements">Achievements</TabsTrigger>
          </TabsList>

          <TabsContent value="forces">
            <AdminForcesPanel forces={forces} onRefresh={onRefreshForces} />
          </TabsContent>
          <TabsContent value="mech-catalog">
            <AdminMechCatalogPanel />
          </TabsContent>
          <TabsContent value="sp-choices">
            <AdminSpChoicesPanel />
          </TabsContent>
          <TabsContent value="downtime-actions">
            <AdminDowntimeActionsPanel />
          </TabsContent>
          <TabsContent value="achievements">
            <AdminAchievementsPanel />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
