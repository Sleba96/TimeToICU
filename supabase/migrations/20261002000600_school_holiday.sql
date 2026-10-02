-- School holidays for MK, primary and secondary schools (MOE academic calendar, https://www.moe.gov.sg/calendar).
-- Entered by hand from the published calendar, not scraped: MOE publishes no open dataset or API and its reuse terms
-- are unverified (decision D-011). 2026 only; add 2027 when MOE publishes it.

create table public.school_holiday (
  start_date   date not null,
  end_date     date not null check (end_date >= start_date),
  name         text not null,
  source_url   text not null default 'https://www.moe.gov.sg/calendar',
  retrieved_on date not null,
  primary key (start_date, name)
);
comment on table public.school_holiday is 'Hand-entered from the MOE academic calendar. Applies to MK, primary and secondary schools.';

alter table public.school_holiday enable row level security;
create policy "public read" on public.school_holiday for select to anon, authenticated using (true);
grant select on public.school_holiday to anon, authenticated;

insert into public.school_holiday (start_date, end_date, name, retrieved_on) values
  ('2026-03-14', '2026-03-22', 'Term 1 school holidays', '2026-10-02'),
  ('2026-03-23', '2026-03-23', 'Day off-in-lieu for Hari Raya Puasa', '2026-10-02'),
  ('2026-05-30', '2026-06-28', 'Term 2 school holidays', '2026-10-02'),
  ('2026-09-05', '2026-09-13', 'Term 3 school holidays', '2026-10-02'),
  ('2026-11-21', '2026-12-31', 'Term 4 school holidays', '2026-10-02');
