/**
 * RAF National — إرسال نفس الطلب إلى Supabase (Next.js `/api/leads/submit`)
 * مع الاحتفاظ بـ webhook الـ n8n إن أردت.
 *
 * ⚠️  الأمان: وضع `FUNNEL_SUBMIT_SECRET` في كود الصفحة يعرّضه للعامة ( أي زائر يفتح المصدر ).
 * الطريقة الأفضل: أبقِ الـ webhook كما هو وأضِف في n8n خطوة HTTP Request تشير إلى
 *   POST https://YOUR-APP.vercel.app/api/leads/submit
 *   Header: Authorization: Bearer YOUR_SECRET
 *   Body: نفس JSON القادم من الـ funnel (أو المرّرَ من webhook).
 *
 * إن رابطت من ClickFunnels مباشرة، خفِّف الخطر بـ FUNNEL_ALLOWED_ORIGINS + Rate limit موجودين في الخادم.
 */

// =========== عدِّل هذه القيم بعد النشر ===========
var RAF_CRM_APP_URL = 'https://YOUR-PRODUCTION-DOMAIN.com' // مثلاً النطاق الذي يعمل عليه Next.js

/**
 * يجب أن تطابق قيمة .env المحلية / الإنتاج: FUNNEL_SUBMIT_SECRET=
 * ⚠ لا تستخدمها في المتصفح إلا إذا تقبّلت مخاطرة التسريب.
 */
var RAF_FUNNEL_SUBMIT_SECRET = 'ضع_نفس_سر_FUNNEL_SUBMIT_SECRET_هنا'

/** Post JSON to CRM; resolves on HTTP error body too */
function postLeadToSupabaseCRM(payload) {
  var url = RAF_CRM_APP_URL.replace(/\/$/, '') + '/api/leads/submit'
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + RAF_FUNNEL_SUBMIT_SECRET,
      'X-Funnel-Vendor': 'clickfunnels',
    },
    body: JSON.stringify(payload),
  }).then(function (r) {
    return r.json().then(function (j) {
      return { ok: r.ok, status: r.status, body: j }
    })
  })
}

/**
 * في دالة الإرسال (مثل submitToN8n)، بعد بناء الكائن `data`:
 *
 *   var data = { ...نفس حقولك... };
 *   Object.assign(data, {
 *     page_url: window.location.href,
 *     referrer: document.referrer || '',
 *     funnel_vendor: 'clickfunnels',
 *   });
 *
 * ثم قبل أو بعد webhook:
 *
 *   postLeadToSupabaseCRM(data).then(function (crm) {
 *     // crm.body.status === 'created' → جديد في الجدول
 *     // crm.body.status === 'duplicate' → نفس المنطق الحالي مع n8n
 *   }).catch(console.error)
 *
 * أو بالتوازي مع n8n:
 *
 *   Promise.all([
 *     fetch(WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)})
 *       .then(function(r){ return r.json().catch(function(){ return {}; }); }),
 *     postLeadToSupabaseCRM(data).then(function(c){ return c.body; }).catch(function(){ return {}; }),
 *   ]).then(function ([n8nJson, crmBody]) {
 *     var dup = crmBody && crmBody.status === 'duplicate' || n8nJson && n8nJson.status === 'duplicate';
 *     // ثم اعرض success / duplicate حسب dup
 *   });
 */
