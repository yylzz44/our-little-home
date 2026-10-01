import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db;
const owner='11111111-1111-4111-8111-111111111111',partner='22222222-2222-4222-8222-222222222222';
const session1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',session2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function login(uid=owner,session=session1,role='authenticated'){
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.session_id',$2,false)",[uid,session]);await db.exec(`set role ${role}`);
}
async function signup(id,token){await db.exec('reset role');await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{name:id===owner?'我':'你',invitation:token}]);}
async function rpc(action){return (await db.query('select public.home_mutate($1) as s',[action])).rows[0].s}
async function snap(){return (await db.query('select public.home_snapshot() as s')).rows[0].s}
before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('session_id',current_setting('request.jwt.claim.session_id',true))$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to anon,authenticated;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;`);
 await db.exec(await readFile(new URL('../migrations/001_home.sql',import.meta.url),'utf8'));
});
after(async()=>{await db.close()});
test('anonymous cannot read, mutate, issue invitations, or access private tables',async()=>{
 await login('','','anon');for(const sql of ['select public.home_snapshot()',"select public.home_mutate('{}')",'select public.home_invite()','select * from home_private.records'])await assert.rejects(db.query(sql),/permission denied/);
 assert.deepEqual((await db.query('select * from storage.objects')).rows,[]);
});
test('invite-only signup consumes token atomically; no third account and no slot escalation',async()=>{
 await db.exec('reset role');await assert.rejects(signup(owner,'0'.repeat(64)),/邀请/);
 const token=(await db.query('select home_private.new_invitation(1) t')).rows[0].t;
 await signup(owner,token);await assert.rejects(signup(partner,token),/邀请/);
 await db.query('insert into auth.sessions values($1,$2)',[session1,owner]);await login();
 const token2=(await db.query('select public.home_invite() t')).rows[0].t;
 const latest=(await db.query('select public.home_invite() t')).rows[0].t;
 await assert.rejects(signup(partner,token2),/邀请/);await signup(partner,latest);
 await db.query('insert into auth.sessions values($1,$2)',[session2,partner]);await login(partner,session2);
 await assert.rejects(db.query('select public.home_invite()'),/创建者/);await login();await assert.rejects(db.query('select public.home_invite()'),/已经开通/);
 assert.equal((await snap()).members.length,2);
});
test('shared memories, wishes, replies, and settings work with server identity',async()=>{
 await login();let s=await rpc({action:'settings',start_date:'2025-01-01',name_a:'甲',name_b:'乙',pet_name:'糯米',nickname:'甲'});assert.equal(s.settings.pet_name,'糯米');
 s=await rpc({action:'save',kind:'memory',title:'一起散步',body:'晚上很好',day:'2026-10-01',author:'forged'});const id=s.records[0].id;assert.equal(s.records[0].author,'member-1');
 await login(partner,session2);s=await rpc({action:'reply',id,body:'明天也去'});assert.equal(s.replies[0].author,'member-2');
 s=await rpc({action:'save',id,kind:'memory',title:'一起散步',body:'两个人的记录',day:'2026-10-01'});assert.equal(s.records[0].body,'两个人的记录');
 s=await rpc({action:'save',kind:'wish',title:'看海',day:'2026-10-02'});const wish=s.records.find(r=>r.kind==='wish');s=await rpc({action:'complete',id:wish.id,completed:true});assert.equal(s.records.find(r=>r.id===wish.id).completed,1);
 await assert.rejects(rpc({action:'save',kind:'memory',title:'坏日期',day:'2026-02-30'}));
});
test('sealed letters cannot be read through snapshot, raw table, altered time or edits',async()=>{
 await login();let s=await rpc({action:'save',kind:'letter',title:'未来的信',body:'保密正文',day:'2026-10-01',unlock_at:Date.now()+86400000});const id=s.records.find(r=>r.kind==='letter').id;
 assert.equal(JSON.stringify(s).includes('保密正文'),false);await assert.rejects(db.query('select * from home_private.records'),/permission denied/);
 await assert.rejects(rpc({action:'save',id,kind:'letter',title:'未来的信',body:'想提前改',day:'2026-10-01',unlock_at:0}),/封存/);
 await login(partner,session2);assert.equal(JSON.stringify(await snap()).includes('保密正文'),false);await assert.rejects(rpc({action:'delete',id}),/写信的人/);
 await db.exec('reset role');await db.query('update home_private.records set unlock_at=0 where id=$1',[id]);await login(partner,session2);s=await snap();assert.equal(s.records.find(r=>r.id===id).body,'保密正文');
});
test('pet cooldown applies across both users and ignores forged counters',async()=>{
 await login();await rpc({action:'pet',kind:'feed',total:9999,created_at:0});await login(partner,session2);await assert.rejects(rpc({action:'pet',kind:'feed'}),/一分钟/);assert.equal((await snap()).pet.find(p=>p.action==='feed').total,1);
});
test('private photos require active member; upload folder cannot impersonate partner',async()=>{
 await login();await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['home-photos',`${owner}/picture.webp`]);
 await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['home-photos',`${partner}/forged.webp`]),/row-level security/);
 await login(partner,session2);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
 await login('','','anon');assert.equal((await db.query('select * from storage.objects')).rows.length,0);
});
test('revoked sessions and unknown users cannot read or write, even with old JWT claims',async()=>{
 await login(owner,'cccccccc-cccc-4ccc-8ccc-cccccccccccc');await assert.rejects(snap(),/登录已过期/);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await login('33333333-3333-4333-8333-333333333333',session1);await assert.rejects(snap(),/登录已过期/);
 await db.exec('reset role');await db.query('delete from auth.sessions where id=$1',[session2]);await login(partner,session2);await assert.rejects(rpc({action:'pet',kind:'pat'}),/登录已过期/);
});
