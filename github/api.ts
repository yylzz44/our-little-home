import {backend,homeURL} from './config';
let photoGeneration=0;
const photos=new Map<string,string>();
const pending=new Map<string,Promise<string>>();
export function photoURL(path:string){return photos.get(path)||'';}
export function clearPhotos(){photoGeneration++;for(const url of photos.values())URL.revokeObjectURL(url);photos.clear();pending.clear();}
export async function loadPhoto(path:string):Promise<string>{
  if(photos.has(path))return photos.get(path)!;
  if(pending.has(path))return pending.get(path)!;
  const generation=photoGeneration;
  const task=(async()=>{const {data,error}=await backend().storage.from('home-photos').download(path);if(error)throw error;if(generation!==photoGeneration)throw new Error('已退出登录。');const url=URL.createObjectURL(data);photos.set(path,url);return url;})();
  pending.set(path,task);try{return await task}finally{pending.delete(path)}
}
async function compress(file:Blob){
  if(file.size>8*1024*1024)throw new Error('照片需小于 8 MB。');
  const bitmap=await createImageBitmap(file);
  try{const scale=Math.min(1,1920/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);const result=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('照片处理失败。')),'image/webp',.82));if(result.size>2*1024*1024)throw new Error('照片处理后仍较大，请选择较小的照片。');return result;}finally{bitmap.close()}
}
export async function homeRequest(path:string,options:RequestInit={}):Promise<Response>{
  const s=backend();
  try {
    let result:unknown;
    if(path==='/api/home'){
      const {data,error}=options.method==='POST'?await s.rpc('home_mutate',{p:JSON.parse(String(options.body))}):await s.rpc('home_snapshot');
      if(error)throw error;result=data;
    }else if(path==='/api/photo'){
      const {data:{user},error:authError}=await s.auth.getUser();if(authError||!user)throw new Error('请重新登录。');
      const image=await compress(options.body as Blob);const id=`${user.id}/${crypto.randomUUID()}.${image.type==='image/webp'?'webp':'png'}`;
      const {error}=await s.storage.from('home-photos').upload(id,image,{contentType:image.type,upsert:false});if(error)throw error;result={id};
    }else if(path==='/api/access/invite'){
      const {data,error}=await s.rpc('home_invite');if(error)throw error;result={url:`${homeURL()}#activate=${data}`};
    }else if(path==='/api/auth/change-password'){
      const p=JSON.parse(String(options.body));const {data:{user}}=await s.auth.getUser();if(!user?.email)throw new Error('请重新登录。');
      const {error:verifyError}=await s.auth.signInWithPassword({email:user.email,password:p.currentPassword});if(verifyError)throw new Error('当前密码不正确。');
      const {error}=await s.auth.updateUser({password:p.newPassword});if(error)throw error;
      const {error:logoutError}=await s.auth.signOut({scope:'others'});if(logoutError)throw new Error('密码已修改，但其他设备会话未能全部退出，请稍后重试。');result={ok:true};
    }else if(path==='/api/auth/sign-out'){
      const {error}=await s.auth.signOut({scope:'local'});if(error)throw error;clearPhotos();result={ok:true};
    }else throw new Error('暂不支持这次操作。');
    return Response.json(result);
  }catch(e){const err=e as {message?:string;code?:string};const message=err.message||'连接暂时中断，请稍后重试。';return Response.json({error:message},{status:err.code==='42501'?403:400});}
}
