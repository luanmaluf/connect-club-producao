// CONNECT CLUB — workspace compartilhado automático
window.CONNECT_CLUB_REMOTE_URL="https://mantledb.sh/v2/connect-club-0b2e2cd1eb364ad49fab8f8e7a8e8d97/state";

(function(){
  const sharedUrl = window.CONNECT_CLUB_REMOTE_URL;
  const originalFetch = window.fetch.bind(window);

  function bytesToBase64(bytes) {
    let out = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + step, bytes.length)));
    }
    return btoa(out);
  }

  function base64ToBytes(text) {
    const bin = atob(text);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function gzipText(text) {
    const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return bytesToBase64(new Uint8Array(buf));
  }

  async function gunzipText(b64) {
    const bytes = base64ToBytes(b64);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    if (url !== sharedUrl) return originalFetch(input, init);

    const method = String((init && init.method) || 'GET').toUpperCase();

    if (method === 'GET') {
      const r = await originalFetch(sharedUrl + '?t=' + Date.now(), {cache:'no-store'});
      if (!r.ok) return r;
      const packed = await r.json();
      if (!packed || packed.encoding !== 'gzip-base64' || !packed.data) {
        return new Response(JSON.stringify(packed), {status:200,headers:{'Content-Type':'application/json'}});
      }
      const jsonText = await gunzipText(packed.data);
      return new Response(jsonText, {status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    }

    if (method === 'PUT') {
      const body = typeof init.body === 'string' ? init.body : await new Response(init.body).text();
      const data = await gzipText(body);
      const packed = JSON.stringify({encoding:'gzip-base64',data,format:'connect-club-state-v1',updatedAt:new Date().toISOString()});
      return originalFetch(sharedUrl, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:packed
      });
    }

    return originalFetch(input, init);
  };

  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.get('db')) {
      u.searchParams.set('db', sharedUrl);
      history.replaceState(null, '', u.toString());
    }
  } catch (e) { console.error(e); }
})();
