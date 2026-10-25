// Browser returns use the buyer's read-only confirmation link.
// Payment notifications remain separate and must be verified with ECPay.
export { POST, GET } from '../ecpg-return/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
