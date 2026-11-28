-- Polar billing. One row per signed-in user who has started a checkout.
-- The Polar customer is linked by `external_customer_id = user_id`, so the
-- row never needs to exist before Polar does. The older Stripe sandbox table
-- (billing_sandbox_customers) is no longer read and can be dropped by hand.
begin;

create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Polar's own customer ID, recorded from webhooks for support lookups.
  customer_id uuid unique,
  -- A short lease so two requests can't create two checkouts at once.
  checkout_plan text check (checkout_plan in ('pro', 'advanced')),
  checkout_started_at timestamptz,
  checkout_id uuid,
  plan text not null default 'free' check (plan in ('free', 'pro', 'advanced')),
  status text,
  subscription_id uuid,
  projection_revision bigint not null default 0 check (projection_revision >= 0),
  projected_at timestamptz,
  check ((checkout_plan is null) = (checkout_started_at is null)),
  check ((subscription_id is null) = (status is null)),
  check (plan = 'free' or (subscription_id is not null and status in ('active', 'trialing')))
);

alter table public.billing_customers enable row level security;
revoke all on table public.billing_customers from public, anon, authenticated, service_role;
grant select, insert, update on table public.billing_customers to service_role;

commit;
