-- ═══════════════════════════════════════════════════════════════
-- HD SAISON Dashboard – Supabase Tables Setup
-- Chạy toàn bộ file này trong Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

-- TikTok Daily (dùng cho cả HD và AT, phân biệt bằng cột platform)
create table if not exists tiktok_daily (
  id          bigserial primary key,
  platform    text      not null check (platform in ('hd','at')),
  ngay        date      not null,
  xem         int       default 0,
  reach       int       default 0,
  xemhd       int       default 0,
  thich       int       default 0,
  chiase      int       default 0,
  bl          int       default 0,
  web         int       default 0,
  leads       int       default 0,
  app         int       default 0,
  fnew        int       default 0,
  flost       int       default 0,
  rong        int       default 0,
  created_at  timestamptz default now(),
  unique(platform, ngay)
);

-- TikTok Videos (dùng cho cả HD và AT)
create table if not exists tiktok_videos (
  id          bigserial primary key,
  platform    text      not null check (platform in ('hd','at')),
  ngay        date      not null,
  gio         int       default 0,
  tieude      text,
  chude       text,
  xem         int       default 0,
  thich       int       default 0,
  bl          int       default 0,
  chiase      int       default 0,
  yeuthich    int       default 0,
  url         text,
  binhluan    int       default 0,
  created_at  timestamptz default now(),
  unique(platform, url)
);

-- Facebook Posts
create table if not exists facebook_posts (
  id          bigserial primary key,
  ngay        date      not null,
  gio         int       default 0,
  tieude      text,
  loai        text,
  xem         int       default 0,
  tiepcan     int       default 0,
  camxuc      int       default 0,
  binhluan    int       default 0,
  chiase      int       default 0,
  click       int       default 0,
  linkclick   int       default 0,
  chude       text,
  post_id     text      unique,
  created_at  timestamptz default now()
);

-- YouTube Daily
create table if not exists youtube_daily (
  id          bigserial primary key,
  ngay        date      not null unique,
  xem         int       default 0,
  sosanh      int       default 0,
  danhgia     text      default '',
  created_at  timestamptz default now()
);

-- YouTube Videos
create table if not exists youtube_videos (
  id          bigserial primary key,
  ngay        date      not null,
  tieude      text,
  chude       text,
  xem         int       default 0,
  sub         int       default 0,
  thich       int       default 0,
  retention   float     default 0,
  url         text      unique,
  gioxem      float     default 0,
  ctr         float     default 0,
  created_at  timestamptz default now()
);

-- Zalo Daily
create table if not exists zalo_daily (
  id          bigserial primary key,
  ngay        date      not null unique,
  xem         int       default 0,
  thich       int       default 0,
  chiase      int       default 0,
  binhluan    int       default 0,
  follow      int       default 0,
  created_at  timestamptz default now()
);

-- Zalo Videos
create table if not exists zalo_videos (
  id          bigserial primary key,
  ngay        date      not null,
  tieude      text,
  xem         int       default 0,
  thich       int       default 0,
  chiase      int       default 0,
  binhluan    int       default 0,
  tongtgxem   float     default 0,
  tbtgxem     float     default 0,
  tile        int       default 0,
  created_at  timestamptz default now()
);

-- Zalo Posts
create table if not exists zalo_posts (
  id          bigserial primary key,
  ngay        date      not null,
  tieude      text,
  xem         int       default 0,
  share       int       default 0,
  trangthai   text      default 'Hiện',
  created_at  timestamptz default now()
);

-- ───────────────────────────────────────────────────────────────
-- Row Level Security: dashboard (anon key) chỉ được ĐỌC
-- n8n dùng service_role key → bypass RLS → được GHI
-- ───────────────────────────────────────────────────────────────
do $$ declare t text; begin
  foreach t in array array['tiktok_daily','tiktok_videos','facebook_posts',
    'youtube_daily','youtube_videos','zalo_daily','zalo_videos','zalo_posts']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "anon_read" on %I', t);
    execute format('create policy "anon_read" on %I for select using (true)', t);
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────
-- Indexes để query nhanh theo ngày
-- ───────────────────────────────────────────────────────────────
create index if not exists idx_ttdaily_ngay  on tiktok_daily(ngay);
create index if not exists idx_ttvideo_ngay  on tiktok_videos(ngay);
create index if not exists idx_fbpost_ngay   on facebook_posts(ngay);
create index if not exists idx_ytdaily_ngay  on youtube_daily(ngay);
create index if not exists idx_ytvideo_ngay  on youtube_videos(ngay);
create index if not exists idx_zadaily_ngay  on zalo_daily(ngay);
create index if not exists idx_zavideo_ngay  on zalo_videos(ngay);
create index if not exists idx_zapost_ngay   on zalo_posts(ngay);
