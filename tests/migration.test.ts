import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';

void test('ECPay migration preserves populated legacy orders, stock and settings', async () => {
  const client = createClient({ url: ':memory:' });
  try {
    for (const statement of readFileSync('drizzle/0000_awesome_redwing.sql', 'utf8').split('--> statement-breakpoint')) await client.execute(statement);
    await client.execute("INSERT INTO products (id,sku,name,price,currency,stock,reserved,created_at,updated_at) VALUES ('product','SGBC','SGBC',550000,'TWD',200,2,1,1)");
    await client.execute("INSERT INTO settings (id,reservations_open,checkout_open,updated_at) VALUES ('store',0,1,1)");
    await client.execute("INSERT INTO orders (id,request_key,product_id,product_name,sku,name,email,quantity,unit_price,total,currency,status,stripe_session_id,payment_intent_id,refunded_amount,tracking_number,shipping_address,created_at,updated_at) VALUES ('legacy','key','product','SGBC','SGBC','Test','buyer@example.test',2,550000,1100000,'TWD','paid','cs_legacy','pi_legacy',0,'TRACK','{}',1,2)");
    const before = (await client.execute('SELECT * FROM orders')).rows[0];
    for (const statement of readFileSync('drizzle/0001_black_shriek.sql', 'utf8').split('--> statement-breakpoint')) await client.execute(statement);
    const after = (await client.execute('SELECT * FROM orders')).rows[0];
    for (const key of Object.keys(before)) assert.equal(after[key], before[key], `Preserve ${key}`);
    assert.equal(after.payment_provider, 'stripe'); assert.equal(after.payment_environment, 'live'); assert.equal(after.shipping_fee, 0); assert.equal(after.ecpay_trade_no, null);
    assert.equal((await client.execute('SELECT shipping_fee_per_unit FROM settings')).rows[0].shipping_fee_per_unit, null);
    assert.equal((await client.execute('SELECT reserved FROM products')).rows[0].reserved, 2);
    assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length, 0);
    await assert.rejects(client.execute("UPDATE orders SET total=1 WHERE id='legacy'"));
    for (const statement of readFileSync('drizzle/0002_plain_captain_stacy.sql', 'utf8').split('--> statement-breakpoint')) await client.execute(statement);
    const embedded = (await client.execute('SELECT * FROM orders')).rows[0];
    for (const key of Object.keys(after)) assert.equal(embedded[key], after[key], `Embedded migration preserves ${key}`);
    assert.equal(embedded.ecpay_integration, 'aio');
    assert.equal((await client.execute('SELECT * FROM embedded_checkouts')).rows.length, 0);
    for (const statement of readFileSync('drizzle/0003_visitor_analytics.sql', 'utf8').split('--> statement-breakpoint')) await client.execute(statement);
    assert.deepEqual((await client.execute('SELECT * FROM orders')).rows[0], embedded);
    assert.equal((await client.execute('SELECT reserved FROM products')).rows[0].reserved, 2);
    assert.equal((await client.execute('SELECT * FROM visitor_days')).rows.length, 0);
    await client.execute("INSERT INTO visitor_days (day,visitor_hash) VALUES ('2026-10-25','legacy-hash')");
    for (const statement of readFileSync('drizzle/0004_visitor_countries.sql', 'utf8').split('--> statement-breakpoint')) await client.execute(statement);
    assert.deepEqual((await client.execute('SELECT * FROM visitor_days')).rows[0], { day: '2026-10-25', visitor_hash: 'legacy-hash', country: null });
    assert.deepEqual((await client.execute('SELECT * FROM orders')).rows[0], embedded);
    assert.equal((await client.execute('SELECT reserved FROM products')).rows[0].reserved, 2);
  } finally { client.close(); }
});
