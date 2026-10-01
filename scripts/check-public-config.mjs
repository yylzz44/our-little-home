const url=process.env.VITE_SUPABASE_URL||'',key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw new Error('Set VITE_SUPABASE_URL to the project HTTPS URL (no trailing slash).');
let valid=key.startsWith('sb_publishable_');
if(!valid)try{valid=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon'}catch{}
if(!valid)throw new Error('Use a publishable key or legacy anon key. NEVER use a secret/service_role key in the website.');
console.log('Public configuration validated. No private credentials are required by this build.');
