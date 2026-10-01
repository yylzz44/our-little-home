import {createClient,type SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|undefined;
export function configurationError():string {
  const url=import.meta.env.VITE_SUPABASE_URL||'', key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) return '小家的连接尚未配置好，请联系建站的人。';
  if(key.startsWith('sb_publishable_'))return '';
  try { if(JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon') return ''; } catch {}
  return '小家的公开连接密钥尚未配置好。';
}
export function backend(){
  if(configurationError())throw new Error(configurationError());
  return client??=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'our-little-home-session'},
  });
}
export function homeURL(){return new URL('./',window.location.href).href;}
