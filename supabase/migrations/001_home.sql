-- Run only in a dedicated, new Supabase project. Application data are never public.
begin;
create schema if not exists home_private;
revoke all on schema home_private from public, anon, authenticated;
create table if not exists home_private.house (
 id integer primary key check(id=1), start_date text not null default '',
 name_a text not null default '我', name_b text not null default '你', pet_name text not null default '糯米'
);
insert into home_private.house(id) values(1) on conflict do nothing;
create table if not exists home_private.members (
 slot integer primary key check(slot in (1,2)), user_id text not null unique,
 auth_user_id uuid not null unique references auth.users(id) on delete cascade,
 nickname text not null check(length(nickname) between 1 and 20)
);
create table if not exists home_private.invitations (
 slot integer primary key check(slot in (1,2)), token_hash bytea not null unique,
 expires_at timestamptz not null, used_at timestamptz
);
create table if not exists home_private.records (
 id uuid primary key, kind text not null check(kind in ('memory','wish','letter')),
 title text not null check(length(title) between 1 and 80), body text not null default '' check(length(body)<=5000),
 day text not null, image text not null default '', completed integer not null default 0 check(completed in(0,1)),
 unlock_at bigint not null default 0 check(unlock_at>=0), author text not null,
 created_at bigint not null, check(kind='letter' or unlock_at=0), check(kind<>'letter' or image='')
);
create table if not exists home_private.replies (
 id uuid primary key, record_id uuid not null references home_private.records(id) on delete cascade,
 body text not null check(length(body) between 1 and 1500), author text not null, created_at bigint not null
);
create table if not exists home_private.pet_events (
 id uuid primary key, action text not null check(action in('feed','play','pat')),
 author text not null, created_at bigint not null
);
create index if not exists home_pet_action_time on home_private.pet_events(action,created_at desc);
alter table home_private.house enable row level security;
alter table home_private.members enable row level security;
alter table home_private.invitations enable row level security;
alter table home_private.records enable row level security;
alter table home_private.replies enable row level security;
alter table home_private.pet_events enable row level security;
revoke all on all tables in schema home_private from public,anon,authenticated;

create or replace function public.home_is_member() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from home_private.members m join auth.sessions s on s.user_id=m.auth_user_id
 where m.auth_user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id');
$$;
create or replace function home_private.require_member() returns home_private.members
language plpgsql stable security definer set search_path='' as $$
declare m home_private.members;
begin
 if not public.home_is_member() then raise exception '登录已过期或账号无权进入小家。' using errcode='42501'; end if;
 select * into strict m from home_private.members where auth_user_id=auth.uid(); return m;
end $$;
create or replace function home_private.new_invitation(target integer) returns text
language plpgsql security definer set search_path='' as $$
declare token text;
begin
 perform 1 from home_private.house where id=1 for update;
 if exists(select 1 from home_private.members where slot=target) then raise exception '这个账号已经开通。'; end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into home_private.invitations(slot,token_hash,expires_at)
 values(target,sha256(convert_to(token,'UTF8')),now()+interval '7 days')
 on conflict(slot) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,used_at=null;
 return token;
end $$;
create or replace function public.home_invite() returns text
language plpgsql security definer set search_path='' as $$
declare m home_private.members;
begin
 m:=home_private.require_member();
 if m.slot<>1 then raise exception '只有小家的创建者能发出邀请。' using errcode='42501'; end if;
 return home_private.new_invitation(2);
end $$;
-- The auth insert and invitation consumption are a single transaction. Public signup
-- without a valid invitation fails even if someone bypasses the website's UI.
create or replace function home_private.accept_signup() returns trigger
language plpgsql security definer set search_path='' as $$
declare token text; invite home_private.invitations; nickname text;
begin
 token:=new.raw_user_meta_data->>'invitation';
 nickname:=btrim(coalesce(new.raw_user_meta_data->>'name',''));
 if token is null or token !~ '^[a-f0-9]{64}$' or length(nickname) not between 1 and 20 then
   raise exception '需要有效的专属邀请和昵称。';
 end if;
 perform 1 from home_private.house where id=1 for update;
 select * into invite from home_private.invitations
 where token_hash=sha256(convert_to(token,'UTF8')) and used_at is null and expires_at>now() for update;
 if not found then raise exception '邀请已过期或已被使用。'; end if;
 if exists(select 1 from home_private.members where slot=invite.slot) then raise exception '小家已经住满了。'; end if;
 insert into home_private.members(slot,user_id,auth_user_id,nickname)
 values(invite.slot,'member-'||invite.slot,new.id,nickname);
 update home_private.invitations set used_at=now() where slot=invite.slot;
 update auth.users set raw_user_meta_data=raw_user_meta_data-'invitation' where id=new.id;
 return new;
end $$;
drop trigger if exists home_accept_signup on auth.users;
create trigger home_accept_signup after insert on auth.users for each row execute function home_private.accept_signup();

create or replace function public.home_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare m home_private.members; moment bigint; result jsonb;
begin
 m:=home_private.require_member();moment:=floor(extract(epoch from statement_timestamp())*1000)::bigint;
 select jsonb_build_object(
 'settings',(select to_jsonb(h) from home_private.house h where id=1),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('slot',slot,'user_id',user_id,'nickname',nickname) order by slot),'[]'::jsonb) from home_private.members),
 'records',(select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object(
 'body',case when kind='letter' and unlock_at>moment then '' else body end,
 'sealed',case when kind='letter' and unlock_at>moment then 1 else 0 end) order by day desc,created_at desc),'[]'::jsonb) from home_private.records r),
 'replies',(select coalesce(jsonb_agg(to_jsonb(r) order by created_at),'[]'::jsonb) from home_private.replies r),
 'pet',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from (select action,max(created_at) last_at,count(*) total from home_private.pet_events group by action)p),
 'me',m.user_id,'serverTime',moment,'hasPartner',exists(select 1 from home_private.members where slot=2)
 ) into result;return result;
end $$;
create or replace function home_private.valid_text(value text,max_length integer,required boolean default false) returns text
language plpgsql immutable set search_path='' as $$
begin
 value:=btrim(coalesce(value,''));
 if length(value)>max_length or (required and value='') then raise exception '请检查内容是否完整、长度是否合适。'; end if;
 return value;
end $$;
create or replace function home_private.valid_day(value text) returns text
language plpgsql immutable set search_path='' as $$
begin
 if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' or to_char(value::date,'YYYY-MM-DD')<>value then raise exception '日期格式不正确。'; end if;
 return value;
end $$;
create or replace function public.home_mutate(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
<<mutation>>
declare
 m home_private.members; moment bigint; act text; rid uuid; old home_private.records;
 kind text; title text; body text; day text; image text; unlock bigint; done integer; start_day text;
begin
 m:=home_private.require_member();
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>40000 then raise exception '提交内容格式不正确或过长。'; end if;
 -- Two-person writes serialize; pet cooldown and simultaneous updates are atomic.
 perform 1 from home_private.house where id=1 for update;
 moment:=floor(extract(epoch from clock_timestamp())*1000)::bigint;act:=p->>'action';
 if act='settings' then
  start_day:=coalesce(p->>'start_date','');
  if start_day<>'' then start_day:=home_private.valid_day(start_day);if start_day>(now() at time zone 'Asia/Shanghai')::date::text then raise exception '恋爱开始日期不能晚于今天。';end if;end if;
  update home_private.house set start_date=start_day,
    name_a=home_private.valid_text(p->>'name_a',20,true),name_b=home_private.valid_text(p->>'name_b',20,true),
    pet_name=home_private.valid_text(p->>'pet_name',20,true) where id=1;
  update home_private.members set nickname=home_private.valid_text(p->>'nickname',20,true) where auth_user_id=auth.uid();
 elsif act='save' then
  kind:=p->>'kind';if kind is null or kind not in('memory','wish','letter') then raise exception '类型不正确。';end if;
  title:=home_private.valid_text(p->>'title',80,true);body:=home_private.valid_text(p->>'body',5000,kind='letter');
  day:=home_private.valid_day(p->>'day');image:=case when kind='letter' then '' else home_private.valid_text(p->>'image',120) end;
  unlock:=case when kind='letter' then coalesce((p->>'unlock_at')::bigint,0) else 0 end;
  if unlock<0 or unlock>moment+3153600000000 then raise exception '开信日期不正确。';end if;
  if image<>'' and not exists(select 1 from storage.objects o where o.bucket_id='home-photos' and o.name=image) then raise exception '照片尚未上传成功。';end if;
  done:=case when kind='wish' and coalesce((p->>'completed')::boolean,false) then 1 else 0 end;
  if coalesce(p->>'id','')<>'' then
   rid:=(p->>'id')::uuid;select * into old from home_private.records where id=rid;
   if not found or old.kind<>kind then raise exception '记录不存在。';end if;
   if kind='letter' and (old.author<>m.user_id or old.unlock_at>moment) then raise exception '封存的信件不能修改，已开启的信件仅作者可以修改。' using errcode='42501';end if;
   update home_private.records r set title=mutation.title,body=mutation.body,day=mutation.day,image=mutation.image,completed=done,unlock_at=unlock where r.id=rid;
  else
   rid:=gen_random_uuid();insert into home_private.records(id,kind,title,body,day,image,completed,unlock_at,author,created_at)
   values(rid,kind,title,body,day,image,done,unlock,m.user_id,moment);
  end if;
 elsif act='complete' then
  update home_private.records set completed=case when (p->>'completed')::boolean then 1 else 0 end where id=(p->>'id')::uuid and home_private.records.kind='wish';
  if not found then raise exception '心愿不存在。';end if;
 elsif act='delete' then
  rid:=(p->>'id')::uuid;select * into old from home_private.records where id=rid;
  if not found then raise exception '记录不存在。';end if;
  if old.kind='letter' and old.author<>m.user_id then raise exception '只有写信的人可以删除这封信。' using errcode='42501';end if;
  delete from home_private.records where id=rid;
 elsif act='reply' then
  rid:=(p->>'id')::uuid;
  if not exists(select 1 from home_private.records r where r.id=rid and r.kind='memory') then raise exception '这条回忆不存在。';end if;
  insert into home_private.replies values(gen_random_uuid(),rid,home_private.valid_text(p->>'body',1500,true),m.user_id,moment);
 elsif act='pet' then
  kind:=p->>'kind';if kind is null or kind not in('feed','play','pat') then raise exception '互动不存在。';end if;
  if exists(select 1 from home_private.pet_events where action=kind and created_at>moment-60000) then raise exception '糯米还在回味刚才的互动，过一分钟再来吧。';end if;
  insert into home_private.pet_events values(gen_random_uuid(),kind,m.user_id,moment);
 else raise exception '无法识别这次操作。';
 end if;
 return public.home_snapshot();
end $$;
-- Function execution is opt-in; no anonymous read or write API exists.
revoke all on all functions in schema home_private from public,anon,authenticated;
revoke all on function public.home_is_member(),public.home_snapshot(),public.home_mutate(jsonb),public.home_invite() from public,anon,authenticated;
grant execute on function public.home_is_member(),public.home_snapshot(),public.home_mutate(jsonb),public.home_invite() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('home-photos','home-photos',false,2097152,array['image/webp','image/png','image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists home_photos_read on storage.objects;
create policy home_photos_read on storage.objects for select to authenticated
 using(bucket_id='home-photos' and public.home_is_member());
drop policy if exists home_photos_insert on storage.objects;
create policy home_photos_insert on storage.objects for insert to authenticated
 with check(bucket_id='home-photos' and public.home_is_member() and (storage.foldername(name))[1]=auth.uid()::text);
-- No UPDATE/DELETE storage policy: clients cannot overwrite or remove another record's photo.
commit;
