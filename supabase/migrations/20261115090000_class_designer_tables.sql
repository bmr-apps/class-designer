-- 별무리 수업 디자이너 표 (원본 MySQL sd_* 표를 class_designer 스키마로 옮김)
-- 쓰기는 서버 함수(class-designer-fn)만 합니다. 브라우저는 아래 RLS 로 읽기만 (다음 파일).
-- 로그인 계정(auth.users)은 BMR APPS 전체가 함께 쓰므로, 이 앱을 쓸 사람은 members 표로 따로 관리합니다.

-- ---------- 이 앱 멤버 (권한) ----------
create table class_designer.members (
  id bigint generated always as identity primary key,
  user_id uuid unique,                          -- 로그인 아이디 (bmr.uid()). 메일로 먼저 등록하면 처음 로그인할 때 채워짐
  email text not null unique check (email = lower(email)),
  name text not null default '',
  subject text not null default '',
  role text not null default 'teacher' check (role in ('teacher', 'researcher', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
comment on table class_designer.members is '이 앱 멤버와 역할(교사·연구소·관리자). 권한 판단은 user_metadata 가 아니라 이 표로 한다.';

-- ---------- 설정 (비밀 키 없음) ----------
create table class_designer.settings (
  k text primary key,
  v text not null default ''
);

-- ---------- 설계안 ----------
create table class_designer.designs (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  title text not null check (char_length(title) <= 200),
  subject text not null default '',
  grade text not null default '',
  semester text not null default '',
  status text not null default 'draft' check (status in ('draft', 'review', 'done')),
  format text not null default 'core',
  core jsonb not null,
  shared boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid,
  copied_from bigint references class_designer.designs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index designs_owner_idx on class_designer.designs (owner_id, updated_at desc);
create index designs_shared_idx on class_designer.designs (shared, deleted_at);
create index designs_copied_from_idx on class_designer.designs (copied_from);

-- Alter 대화 (설계별)
create table class_designer.chat_messages (
  id bigint generated always as identity primary key,
  design_id bigint not null references class_designer.designs(id) on delete cascade,
  user_id uuid,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  ai_log_id bigint,
  created_at timestamptz not null default now()
);
create index chat_messages_design_idx on class_designer.chat_messages (design_id, id);
create index chat_messages_user_idx on class_designer.chat_messages (user_id, created_at);

-- 저장 전(시작 화면) 아이디어 대화. 원본은 세션에 두었다
create table class_designer.draft_chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index draft_chat_user_idx on class_designer.draft_chat_messages (user_id, id);

-- AI 호출 기록 (한도·비용 계산). 학생 개인정보는 보내기 전에 막으므로 여기에도 없다
create table class_designer.ai_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  design_id bigint references class_designer.designs(id) on delete set null,
  feature text not null,
  provider text not null,
  model text not null default '',
  prompt_version text not null default '',
  input_text text not null default '',
  output_text text not null default '',
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  cost_krw numeric(10, 2) not null default 0,
  status text not null default 'ok',
  applied boolean not null default false,
  created_at timestamptz not null default now()
);
create index ai_logs_user_time_idx on class_designer.ai_logs (user_id, created_at);
create index ai_logs_time_idx on class_designer.ai_logs (created_at);
create index ai_logs_design_idx on class_designer.ai_logs (design_id);

-- ---------- 별무리 연결 통계 ----------
create table class_designer.tag_codes (
  code text primary key,
  kind text not null check (kind in ('value', 'competency', 'goal', 'topic', 'subject')),
  name text not null,
  sort int not null default 0
);
create table class_designer.plan_targets (
  id bigint generated always as identity primary key,
  design_id bigint not null references class_designer.designs(id) on delete cascade,
  target_type text not null check (target_type in ('design', 'goal', 'rubric', 'competency', 'activity')),
  target_key text not null default '',
  text text not null default '',
  is_assessed boolean not null default false,
  created_at timestamptz not null default now()
);
create index plan_targets_design_idx on class_designer.plan_targets (design_id);
create table class_designer.target_tags (
  id bigint generated always as identity primary key,
  target_id bigint not null references class_designer.plan_targets(id) on delete cascade,
  tag_code text not null
);
create index target_tags_target_idx on class_designer.target_tags (target_id);
create index target_tags_tag_idx on class_designer.target_tags (tag_code);
-- 학생 개인정보 없음: 루브릭 행별 A/B/C 인원 집계만
create table class_designer.assessment_results (
  id bigint generated always as identity primary key,
  design_id bigint not null references class_designer.designs(id) on delete cascade,
  rubric_key text not null,
  quarter smallint not null default 1,
  count_a int not null default 0, count_b int not null default 0, count_c int not null default 0,
  updated_at timestamptz not null default now(),
  unique (design_id, rubric_key, quarter)
);

-- 성취기준 인터넷 검색 결과 캐시 (30일). 성취기준 원문 3,124행은 서버 함수에 JSON 으로 들어 있다
create table class_designer.std_cache (
  cache_key text primary key,
  subject text not null,
  grade smallint not null,
  query text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- 별무리 기준 데이터·AI 지식 (관리자 수정분과 이력) ----------
create table class_designer.kb_overrides (
  dataset text not null,
  section text not null,
  data jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (dataset, section)
);
create table class_designer.kb_versions (
  id bigint generated always as identity primary key,
  dataset text not null,
  section text not null,
  data jsonb,
  action text not null default 'save',
  note text,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index kb_versions_idx on class_designer.kb_versions (dataset, section, id);
