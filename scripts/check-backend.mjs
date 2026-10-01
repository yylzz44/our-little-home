// Read-only connectivity check; run from the user's mainland network, without a proxy.
import './check-public-config.mjs';
const base=process.env.VITE_SUPABASE_URL;
const headers={apikey:process.env.VITE_SUPABASE_PUBLISHABLE_KEY};
const start=Date.now();
const response=await fetch(`${base}/auth/v1/settings`,{headers,signal:AbortSignal.timeout(15000)});
if(!response.ok)throw new Error(`Auth connection failed: HTTP ${response.status}`);
const settings=await response.json();
console.log(`Auth API reachable in ${Date.now()-start} ms.`);
if(settings.disable_signup)throw new Error('Enable signup: the database trigger limits it to valid, single-use invitations.');
if(!settings.mailer_autoconfirm)throw new Error('Turn off Confirm email for invitation-only, email-as-identifier login.');
const api=await fetch(`${base}/rest/v1/rpc/home_snapshot`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
const body=await api.json();
if(api.ok)throw new Error('SECURITY FAILURE: anonymous snapshot unexpectedly allowed.');
if(body.code!=='42501')throw new Error(`Database setup not verified (${body.code||api.status}); run 001_home.sql and inspect policies.`);
console.log('Database endpoint exists and denies anonymous access as expected.');
console.log('Still required: two real accounts, photo roundtrip, and a second mainland network.');
