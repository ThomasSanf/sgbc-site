import type { InferSelectModel } from 'drizzle-orm';
import type { products, preorders, orders, auditEvents } from './server/schema';
import type { dashboardData } from './server/store';
export type Product = InferSelectModel<typeof products>;
export type Reservation = InferSelectModel<typeof preorders>;
export type Order = InferSelectModel<typeof orders>;
export type Activity = InferSelectModel<typeof auditEvents>;
export type Dashboard = Awaited<ReturnType<typeof dashboardData>> & { integrations: ReturnType<typeof import('./server/config').integrationStatus> };
export type AdminIdentity = { id: string; name: string; email: string };
