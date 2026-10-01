import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {Session} from '@supabase/supabase-js';
import {backend,configurationError} from './config';
import {clearPhotos} from './api';
import Home from './Home';
import Access from './access-form';
import '../app/globals.css';
function App(){
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false);
 const [activate]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).has('activate'));
 const missing=configurationError();
 useEffect(()=>{if(missing)return;let mounted=true;const s=backend();s.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setReady(true)}}).catch(()=>{if(mounted)setReady(true)});const {data:{subscription}}=s.auth.onAuthStateChange((_event,next)=>{if(mounted){setSession(next);setReady(true);if(!next)clearPhotos()}});return()=>{mounted=false;subscription.unsubscribe();clearPhotos()}},[missing]);
 if(missing)return <main className="access-screen"><section className="access-card"><h1>小家正在准备中</h1><p>{missing}</p><p>完成准备后，就能在这里收藏你们的日常。</p></section></main>;
 if(!ready)return <main className="access-screen"><p>正在打开我们的小家…</p></main>;
 if(activate)return <Access activate/>;
 return session?<Home/>:<Access/>;
}
createRoot(document.getElementById('root')!).render(<App/>);
