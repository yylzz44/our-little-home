import {useEffect,useState} from 'react';
import {loadPhoto} from './api';
export default function Photo({path,...props}:{path:string}&Omit<React.ImgHTMLAttributes<HTMLImageElement>,'src'>){
 const [url,setURL]=useState(''),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setError(false);setURL('');loadPhoto(path).then(u=>{if(active)setURL(u)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[path,attempt]);
 if(error)return <span role="status">照片暂未加载。<span role="button" tabIndex={0} onClick={e=>{e.stopPropagation();setAttempt(a=>a+1)}} onKeyDown={e=>{if(e.key==='Enter'){e.stopPropagation();setAttempt(a=>a+1)}}}>重试</span></span>;
 if(!url)return <span role="status" className="photo-loading">正在取出照片…</span>;
 return <img {...props} src={url}/>;
}
