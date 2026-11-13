-- 권한 도우미, RLS 정책, 통계 뷰, 서버 함수 전용 함수
-- auth.uid() 대신 bmr.uid() 를 씁니다 (README 5장).

-- ---------- 권한 도우미 (참/거짓·역할만 돌려줌) ----------
create or replace function class_designer.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from class_designer.members m where m.user_id = (select bmr.uid()) and m.active
$$;
create or replace function class_designer.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from class_designer.members m where m.user_id = (select bmr.uid()) and m.active)
$$;
create or replace function class_designer.is_staff_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select class_designer.my_role()) in ('admin', 'researcher'), false)
$$;
create or replace function class_designer.is_admin_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select class_designer.my_role()) = 'admin', false)
$$;
revoke all on function class_designer.my_role(), class_designer.is_member(), class_designer.is_staff_member(), class_designer.is_admin_member() from public, anon;
grant execute on function class_designer.my_role(), class_designer.is_member(), class_designer.is_staff_member(), class_designer.is_admin_member() to authenticated;

-- ---------- 기본 권한: 손님(anon)은 아무것도, 로그인한 사람은 읽기만 (쓰기는 서버 함수) ----------
do $$ declare t text; begin
  foreach t in array array['members','settings','designs','chat_messages','draft_chat_messages','ai_logs','tag_codes','plan_targets','target_tags',
                           'assessment_results','std_cache','kb_overrides','kb_versions'] loop
    execute format('alter table class_designer.%I enable row level security', t);
    execute format('revoke all on class_designer.%I from anon', t);
    execute format('revoke insert, update, delete, truncate, references, trigger on class_designer.%I from authenticated', t);
    execute format('grant select on class_designer.%I to authenticated', t);
  end loop;
end $$;

-- members: 내 줄만, 관리자는 전체
create policy "멤버: 나 또는 관리자" on class_designer.members for select to authenticated
  using (user_id = (select bmr.uid()) or (select class_designer.is_admin_member()));
-- designs: 내 것 + 공유된 것 + 연구소·관리자(전체). 지운 설계는 관리자만
create policy "설계: 작성자·공유·연구소" on class_designer.designs for select to authenticated using (
  (deleted_at is null and (select class_designer.is_member()) and (owner_id = (select bmr.uid()) or shared or (select class_designer.is_staff_member())))
  or (select class_designer.is_admin_member())
);
create policy "대화: 볼 수 있는 설계" on class_designer.chat_messages for select to authenticated using (
  exists (select 1 from class_designer.designs d where d.id = chat_messages.design_id and d.deleted_at is null)
);
create policy "초안 대화: 내 것" on class_designer.draft_chat_messages for select to authenticated using (user_id = (select bmr.uid()));
create policy "AI 기록: 내 것·관리자" on class_designer.ai_logs for select to authenticated using (user_id = (select bmr.uid()) or (select class_designer.is_admin_member()));
create policy "설정: 멤버" on class_designer.settings for select to authenticated using ((select class_designer.is_member()));
create policy "태그: 멤버" on class_designer.tag_codes for select to authenticated using ((select class_designer.is_member()));
create policy "연결 대상: 작성자·연구소" on class_designer.plan_targets for select to authenticated using (
  (select class_designer.is_staff_member()) or exists (select 1 from class_designer.designs d where d.id = plan_targets.design_id and d.owner_id = (select bmr.uid()) and d.deleted_at is null)
);
create policy "연결 태그: 볼 수 있는 대상" on class_designer.target_tags for select to authenticated using (
  exists (select 1 from class_designer.plan_targets p where p.id = target_tags.target_id)
);
create policy "평가 집계: 작성자·연구소" on class_designer.assessment_results for select to authenticated using (
  (select class_designer.is_staff_member()) or exists (select 1 from class_designer.designs d where d.id = assessment_results.design_id and d.owner_id = (select bmr.uid()))
);
create policy "지식 수정분: 관리자" on class_designer.kb_overrides for select to authenticated using ((select class_designer.is_admin_member()));
create policy "지식 이력: 관리자" on class_designer.kb_versions for select to authenticated using ((select class_designer.is_admin_member()));
-- std_cache: 정책 없음 = 브라우저에서 못 봄 (서버 함수만)
revoke select on class_designer.std_cache from authenticated;

-- ---------- 통계 뷰 (보는 사람 권한 → RLS 적용) ----------
create view class_designer.link_stats with (security_invoker = true) as
select c.code as tag_code, c.kind, c.name, c.sort,
  count(distinct p.design_id) as designs,
  count(distinct case when p.is_assessed then p.design_id end) as assessed_designs,
  count(distinct case when tt.id is not null then p.design_id end) as taught_designs,
  (select count(*) from class_designer.designs d where d.format = 'core' and d.deleted_at is null) as total_designs
from class_designer.tag_codes c
left join class_designer.target_tags t on t.tag_code = c.code
left join class_designer.plan_targets p on p.id = t.target_id
left join class_designer.target_tags tt on tt.target_id = p.id and tt.tag_code = 'TAUGHT:1'
group by c.code, c.kind, c.name, c.sort;
revoke all on class_designer.link_stats from anon;
grant select on class_designer.link_stats to authenticated;

-- ---------- 서버 함수 전용 (브라우저 역할은 실행 못 함) ----------
-- 저장할 때 설계 내용을 plan_targets / target_tags 로 펼침 (한 트랜잭션)
create or replace function class_designer.sync_targets(p_design bigint, p_targets jsonb) returns void
language plpgsql set search_path = '' as $$
declare t jsonb; v_id bigint; tag text;
begin
  delete from class_designer.plan_targets where design_id = p_design;
  for t in select * from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb)) loop
    insert into class_designer.plan_targets (design_id, target_type, target_key, text, is_assessed)
    values (p_design, t->>'type', coalesce(t->>'key', ''), left(coalesce(t->>'text', ''), 500), coalesce((t->>'assessed')::int, 0) = 1)
    returning id into v_id;
    for tag in select distinct left(x, 80) from jsonb_array_elements_text(coalesce(t->'tags', '[]'::jsonb)) x loop
      insert into class_designer.target_tags (target_id, tag_code) values (v_id, tag);
    end loop;
  end loop;
end $$;

-- AI 사용량 (한도 판정용). 월·일 경계는 한국 시간
create or replace function class_designer.ai_usage(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
  with b as (
    select (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as m,
           (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as d
  )
  select jsonb_build_object(
    'user_day_calls', (select count(*) from class_designer.ai_logs l, b where l.user_id = p_user and l.created_at >= b.d),
    'user_month_calls', (select count(*) from class_designer.ai_logs l, b where l.user_id = p_user and l.created_at >= b.m),
    'user_month_cost', (select coalesce(sum(cost_krw), 0) from class_designer.ai_logs l, b where l.user_id = p_user and l.created_at >= b.m),
    'school_month_calls', (select count(*) from class_designer.ai_logs l, b where l.created_at >= b.m),
    'school_month_cost', (select coalesce(sum(cost_krw), 0) from class_designer.ai_logs l, b where l.created_at >= b.m)
  )
$$;

-- 보존 기간 지난 기록 정리 (원본 Limits: 0 이하 → 30일, 90일 초과 → 90일). 서버 함수가 가끔 부른다 (pg_cron 은 관리자 권한이라 안 씀)
create or replace function class_designer.purge_old() returns void
language plpgsql set search_path = '' as $$
declare
  v_raw numeric := coalesce((select nullif(trim(s.v), '')::numeric from class_designer.settings s where s.k = 'ai_log_retention_days'), 0);
  v_days int := case when v_raw <= 0 then 30 when v_raw > 90 then 90 else greatest(1, floor(v_raw))::int end;
begin
  delete from class_designer.ai_logs where created_at < now() - make_interval(days => v_days);
  delete from class_designer.std_cache where created_at < now() - interval '30 days';
  delete from class_designer.draft_chat_messages where created_at < now() - interval '7 days';
end $$;

revoke execute on function class_designer.sync_targets(bigint, jsonb), class_designer.ai_usage(uuid), class_designer.purge_old() from public, anon, authenticated;
