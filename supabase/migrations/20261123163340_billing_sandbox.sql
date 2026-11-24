begin;

create table public.billing_sandbox_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text unique check (left(customer_id, 4) = 'cus_'),
  customer_key uuid not null unique default gen_random_uuid(),
  customer_started_at timestamptz not null default now(),
  checkout_id uuid unique,
  checkout_plan text check (checkout_plan in ('pro', 'advanced')),
  checkout_started_at timestamptz,
  checkout_session_id text unique check (left(checkout_session_id, 8) = 'cs_test_'),
  plan text not null default 'free' check (plan in ('free', 'pro', 'advanced')),
  status text,
  subscription_id text,
  projection_revision bigint not null default 0 check (projection_revision >= 0),
  projected_at timestamptz,
  check (
    (checkout_id is null and checkout_plan is null and checkout_started_at is null and checkout_session_id is null)
    or (checkout_id is not null and checkout_plan is not null and checkout_started_at is not null and customer_id is not null)
  ),
  check ((subscription_id is null) = (status is null)),
  check (subscription_id is null or customer_id is not null),
  check (plan = 'free' or (subscription_id is not null and status in ('active', 'trialing')))
);

alter table public.billing_sandbox_customers enable row level security;
revoke all on table public.billing_sandbox_customers from public, anon, authenticated, service_role;
grant select, insert, update on table public.billing_sandbox_customers to service_role;

commit;
