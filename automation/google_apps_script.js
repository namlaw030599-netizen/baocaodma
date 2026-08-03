/**
 * HD SAISON – Social Media Daily Sync
 * Google Apps Script chạy mỗi ngày lúc 7:00 sáng
 * Kéo data từ TikTok / Facebook / YouTube / Zalo → đẩy vào Supabase
 *
 * SETUP (làm 1 lần):
 * 1. Mở script.google.com → New project → dán toàn bộ file này vào
 * 2. Vào Edit → Project settings → Script Properties → thêm các key bên dưới
 * 3. Chạy hàm setupTrigger() 1 lần để tạo lịch tự động
 * 4. Lần đầu chạy sẽ hỏi cấp quyền → bấm Allow
 */

// ══════════════════════════════════════════════════════════════════
// CÁC KEY CẦN ĐIỀN VÀO Script Properties
// (Edit → Project settings → Script Properties → Add property)
// ══════════════════════════════════════════════════════════════════
//
//  SUPABASE_URL          = https://hiaehhrlidjrezrlbyux.supabase.co
//  SUPABASE_SERVICE_KEY  = <service_role key từ Supabase → Settings → API>
//
//  TIKTOK_ACCESS_TOKEN   = <TikTok Business API access token>
//  TIKTOK_ADVERTISER_ID  = <TikTok Advertiser ID>
//  TIKTOK_AT_ACCESS_TOKEN  = <TikTok AT account access token> (nếu có)
//  TIKTOK_AT_ADVERTISER_ID = <TikTok AT Advertiser ID>       (nếu có)
//
//  FB_PAGE_ID            = <Facebook Page ID của HD SAISON>
//  FB_ACCESS_TOKEN       = <Facebook Page Access Token>
//
//  YT_CHANNEL_ID         = <YouTube Channel ID, bắt đầu bằng UC...>
//
//  ZALO_ACCESS_TOKEN     = <Zalo OA Access Token>
//  ZALO_OA_ID            = <Zalo OA ID>
//
// ══════════════════════════════════════════════════════════════════

// ── Hàm chính: chạy mỗi ngày ─────────────────────────────────────
function syncAll() {
  const results = [];
  try { syncTikTok('hd');   results.push('TikTok HD ✓'); } catch(e) { results.push('TikTok HD ✗: ' + e.message); }
  try { syncTikTok('at');   results.push('TikTok AT ✓'); } catch(e) { results.push('TikTok AT ✗: ' + e.message); }
  try { syncFacebook();     results.push('Facebook ✓');  } catch(e) { results.push('Facebook ✗: '  + e.message); }
  try { syncYouTube();      results.push('YouTube ✓');   } catch(e) { results.push('YouTube ✗: '   + e.message); }
  try { syncZalo();         results.push('Zalo ✓');      } catch(e) { results.push('Zalo ✗: '      + e.message); }
  Logger.log('=== Sync Results ===\n' + results.join('\n'));
}

// ── Tạo trigger tự động chạy lúc 7am mỗi ngày ────────────────────
function setupTrigger() {
  // Xóa trigger cũ nếu có
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncAll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncAll')
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();
  Logger.log('✅ Trigger đã tạo: syncAll chạy lúc 7:00 sáng mỗi ngày');
}

// ══════════════════════════════════════════════════════════════════
// TIKTOK
// ══════════════════════════════════════════════════════════════════
function syncTikTok(account) {
  const prop = PropertiesService.getScriptProperties();
  const isAt  = account === 'at';
  const token = prop.getProperty(isAt ? 'TIKTOK_AT_ACCESS_TOKEN'  : 'TIKTOK_ACCESS_TOKEN');
  const advId = prop.getProperty(isAt ? 'TIKTOK_AT_ADVERTISER_ID' : 'TIKTOK_ADVERTISER_ID');
  if (!token || !advId) { Logger.log('TikTok ' + account + ': Bỏ qua (chưa có credentials)'); return; }

  const yesterday = getYesterday();

  // Organic channel insight (TikTok Business API v1.3)
  const url = 'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/';
  const payload = {
    advertiser_id: advId,
    report_type:   'AUDIENCE',
    dimensions:    ['stat_time_day'],
    metrics: [
      'impressions',        // lượt xem
      'reach',              // tiếp cận
      'video_play_actions', // xem video
      'follows',            // follow mới
      'profile_visits',     // web click proxy
      'likes',              // thích
      'shares',             // chia sẻ
      'comments',           // bình luận
    ],
    data_level: 'AUCTION_ADVERTISER',
    start_date: yesterday,
    end_date:   yesterday,
    page: 1, page_size: 20,
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(resp.getContentText());
  if (json.code !== 0) throw new Error('TikTok API: ' + (json.message || JSON.stringify(json)));

  const rows = (json.data && json.data.list) ? json.data.list : [];
  if (!rows.length) { Logger.log('TikTok ' + account + ': Không có data ngày ' + yesterday); return; }

  const records = rows.map(r => ({
    platform: account,
    ngay:     r.dimensions.stat_time_day || yesterday,
    xem:      parseInt(r.metrics.impressions         || 0),
    reach:    parseInt(r.metrics.reach               || 0),
    xemhd:    parseInt(r.metrics.video_play_actions  || 0),
    thich:    parseInt(r.metrics.likes               || 0),
    chiase:   parseInt(r.metrics.shares              || 0),
    bl:       parseInt(r.metrics.comments            || 0),
    web:      parseInt(r.metrics.profile_visits      || 0),
    leads:    0,
    app:      0,
    fnew:     parseInt(r.metrics.follows             || 0),
    flost:    0,
    rong:     parseInt(r.metrics.follows             || 0),
  }));

  upsertSupabase('tiktok_daily', records, 'platform,ngay');
  Logger.log('TikTok ' + account + ': đã sync ' + records.length + ' hàng');
}

// ══════════════════════════════════════════════════════════════════
// FACEBOOK
// ══════════════════════════════════════════════════════════════════
function syncFacebook() {
  const prop      = PropertiesService.getScriptProperties();
  const pageId    = prop.getProperty('FB_PAGE_ID');
  const token     = prop.getProperty('FB_ACCESS_TOKEN');
  if (!pageId || !token) { Logger.log('Facebook: Bỏ qua (chưa có credentials)'); return; }

  const yesterday = getYesterday();
  const sinceTs   = Math.floor(new Date(yesterday).getTime() / 1000);
  const untilTs   = sinceTs + 86399;

  // Lấy danh sách bài đăng hôm qua
  const postsUrl = `https://graph.facebook.com/v21.0/${pageId}/posts`
    + `?fields=id,message,created_time,attachments{media_type}`
    + `&since=${sinceTs}&until=${untilTs}`
    + `&limit=50&access_token=${token}`;
  const postsResp = JSON.parse(UrlFetchApp.fetch(postsUrl, { muteHttpExceptions: true }).getContentText());
  const posts = (postsResp.data || []);

  if (!posts.length) { Logger.log('Facebook: Không có bài đăng ngày ' + yesterday); return; }

  const records = [];
  posts.forEach(post => {
    // Lấy insight từng bài
    const insightUrl = `https://graph.facebook.com/v21.0/${post.id}/insights`
      + `?metric=post_impressions,post_reach,post_reactions_by_type_total,post_clicks,post_activity_by_action_type`
      + `&access_token=${token}`;
    const insightResp = JSON.parse(UrlFetchApp.fetch(insightUrl, { muteHttpExceptions: true }).getContentText());
    const insights    = (insightResp.data || []);
    const get = (name) => {
      const m = insights.find(i => i.name === name);
      return m ? (m.values[0] ? m.values[0].value : 0) : 0;
    };

    const reactions    = get('post_reactions_by_type_total');
    const totalReact   = typeof reactions === 'object' ? Object.values(reactions).reduce((a,b)=>a+b,0) : 0;
    const activity     = get('post_activity_by_action_type') || {};
    const created      = new Date(post.created_time);
    const ngayISO      = created.toISOString().split('T')[0];
    const loai         = post.attachments && post.attachments.data && post.attachments.data[0]
                         ? capitalizeFirst(post.attachments.data[0].media_type || 'text')
                         : 'Text';
    records.push({
      ngay:      ngayISO,
      gio:       created.getHours(),
      tieude:    (post.message || '').substring(0, 500),
      loai:      loai,
      xem:       parseInt(get('post_impressions') || 0),
      tiepcan:   parseInt(get('post_reach')       || 0),
      camxuc:    totalReact,
      binhluan:  parseInt(activity.comment        || 0),
      chiase:    parseInt(activity.share          || 0),
      click:     parseInt(get('post_clicks')      || 0),
      linkclick: 0,
      chude:     null,
      post_id:   post.id,
    });
  });

  upsertSupabase('facebook_posts', records, 'post_id');
  Logger.log('Facebook: đã sync ' + records.length + ' bài');
}

// ══════════════════════════════════════════════════════════════════
// YOUTUBE
// ══════════════════════════════════════════════════════════════════
function syncYouTube() {
  const prop      = PropertiesService.getScriptProperties();
  const channelId = prop.getProperty('YT_CHANNEL_ID');
  if (!channelId) { Logger.log('YouTube: Bỏ qua (chưa có credentials)'); return; }

  const yesterday = getYesterday();

  // YouTube Analytics API — dùng OAuth tự động của Google Apps Script
  const ytUrl = `https://youtubeanalytics.googleapis.com/v2/reports`
    + `?ids=channel==${channelId}`
    + `&startDate=${yesterday}&endDate=${yesterday}`
    + `&metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost`
    + `&dimensions=day`;

  const resp = UrlFetchApp.fetch(ytUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  const json = JSON.parse(resp.getContentText());
  // columnHeaders: day, views, estimatedMinutesWatched, ...
  const rows  = json.rows || [];
  if (!rows.length) { Logger.log('YouTube: Không có data ngày ' + yesterday); return; }

  const records = rows.map(r => ({
    ngay:    r[0],           // YYYY-MM-DD
    xem:     parseInt(r[1] || 0),
    sosanh:  0,
    danhgia: '',
  }));

  upsertSupabase('youtube_daily', records, 'ngay');
  Logger.log('YouTube: đã sync ' + records.length + ' hàng');
}

// ══════════════════════════════════════════════════════════════════
// ZALO
// ══════════════════════════════════════════════════════════════════
function syncZalo() {
  const prop  = PropertiesService.getScriptProperties();
  const token = prop.getProperty('ZALO_ACCESS_TOKEN');
  const oaId  = prop.getProperty('ZALO_OA_ID');
  if (!token) { Logger.log('Zalo: Bỏ qua (chưa có credentials)'); return; }

  const yesterday = getYesterday();
  const fromTs    = Math.floor(new Date(yesterday).getTime());
  const toTs      = fromTs + 86399000;

  const url = 'https://openapi.zalo.me/v2.0/oa/getgraphinsight'
    + `?params=${encodeURIComponent(JSON.stringify([
        { alias: 'follower_stat', from: Math.floor(fromTs/1000), to: Math.floor(toTs/1000) }
      ]))}`;

  const resp = UrlFetchApp.fetch(url, {
    headers: { access_token: token },
    muteHttpExceptions: true,
  });
  const json = JSON.parse(resp.getContentText());
  if (json.error) throw new Error('Zalo API: ' + json.message);

  const d    = json.data && json.data[0] && json.data[0].data ? json.data[0].data : {};
  const records = [{
    ngay:     yesterday,
    xem:      parseInt(d.view_count       || 0),
    thich:    parseInt(d.react_count      || 0),
    chiase:   parseInt(d.share_count      || 0),
    binhluan: parseInt(d.comment_count    || 0),
    follow:   parseInt(d.follow_count     || 0),
  }];

  upsertSupabase('zalo_daily', records, 'ngay');
  Logger.log('Zalo: đã sync ngày ' + yesterday);
}

// ══════════════════════════════════════════════════════════════════
// HELPER: Upsert vào Supabase
// ══════════════════════════════════════════════════════════════════
function upsertSupabase(table, records, onConflict) {
  if (!records || !records.length) return;
  const prop    = PropertiesService.getScriptProperties();
  const baseUrl = prop.getProperty('SUPABASE_URL');
  const key     = prop.getProperty('SUPABASE_SERVICE_KEY');
  if (!baseUrl || !key) throw new Error('Chưa có Supabase credentials trong Script Properties');

  const url = `${baseUrl}/rest/v1/${table}`;
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'apikey':        key,
      'Authorization': 'Bearer ' + key,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    payload: JSON.stringify(records),
    muteHttpExceptions: true,
  });
  const code = resp.getResponseCode();
  if (code >= 300) throw new Error(`Supabase ${table}: HTTP ${code} – ${resp.getContentText().substring(0,200)}`);
}

// ══════════════════════════════════════════════════════════════════
// HELPER: Ngày hôm qua (YYYY-MM-DD)
// ══════════════════════════════════════════════════════════════════
function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
}

function capitalizeFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ══════════════════════════════════════════════════════════════════
// YOUTUBE: cần khai báo scope cho OAuth
// Thêm dòng này vào appsscript.json (File → Project settings → Show manifest)
// "oauthScopes": [
//   "https://www.googleapis.com/auth/youtube.readonly",
//   "https://www.googleapis.com/auth/yt-analytics.readonly",
//   "https://www.googleapis.com/auth/script.external_request"
// ]
// ══════════════════════════════════════════════════════════════════
