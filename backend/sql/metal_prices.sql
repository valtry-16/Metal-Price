create extension if not exists "uuid-ossp";

create table if not exists metal_prices (
  id uuid primary key default uuid_generate_v4(),
  metal_name text not null,
  price_per_gram numeric not null,
  price_per_kg numeric,
  price_1g numeric not null,
  price_8g numeric,
  carat text,
  currency text default 'INR',
  date date not null,
  created_at timestamp with time zone default now()
);

create unique index if not exists metal_prices_unique on metal_prices (metal_name, carat, date);
