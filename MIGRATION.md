# 별무리 수업 디자이너 — 처음 켜는 순서 (수동 작업)

이 저장소의 코드는 **DB 마이그레이션을 실행하지 않았고, 서버 함수도 배포하지 않은 상태**입니다.
아래를 순서대로 하면 실제 서버로 동작합니다. 그 전까지 화면은 **미리보기 모드**(브라우저에만 저장, Alter 예시 답)로 둘러볼 수 있습니다.

> 비밀번호·API 키 값은 이 파일, 저장소, 메일 본문, 채팅에 적지 마세요.

## 1. DB 표 만들기 — 선생님 (앱 주인)

1. 허브 https://apps.bmrschool.net/hub/apps → 내 서비스 → class-designer → 앱 정보 → **DB 접속 정보**에서 비밀번호를 받습니다.
2. `.env.local` 에 `DATABASE_URL=...` 한 줄을 넣습니다. (`.env.local` 은 git 에 올라가지 않습니다)
3. 실행:
   ```bash
   npm install
   npm run db:migrate
   ```
   `supabase/migrations/` 의 세 파일이 차례로 적용됩니다.
   - `20261115090000_class_designer_tables.sql` 표 (members, settings, designs, chat_messages, draft_chat_messages, ai_logs, tag_codes, plan_targets, target_tags, assessment_results, std_cache, kb_overrides, kb_versions)
   - `20261115090100_class_designer_security.sql` RLS·권한 (로그인 사용자는 **읽기만**, 쓰기는 모두 서버 함수가 권한을 확인한 뒤)
   - `20261115090200_class_designer_seed.sql` 기본 설정·핵심 가치/역량 코드
4. 첫 관리자 지정 (둘 중 하나, 같은 접속으로 psql 이나 SQL 편집기에서):
   ```sql
   -- 가) 이 메일로 처음 로그인하면 관리자가 됨
   update class_designer.settings set v = '본인@bmrschool.org' where k = 'first_admin_email';
   -- 나) 바로 관리자 멤버로 등록
   insert into class_designer.members (email, role) values ('본인@bmrschool.org', 'admin')
     on conflict (email) do update set role = 'admin';
   ```
   - @bmrschool.org 구글 계정(메일 확인됨)은 처음 로그인할 때 **교사**로 자동 등록됩니다.
   - 그 밖의 계정은 관리자가 **관리 → 멤버·권한**에서 등록해야 쓸 수 있습니다.
5. (선택) 확인: `node scripts/check-migrations.mjs` 는 실제 DB 가 아니라 내 컴퓨터 안의 임시 DB(PGlite)로 권한 규칙을 시험합니다.
6. (선택) 시작 템플릿의 예시 표 `class_designer.documents` 는 이 앱에서 쓰지 않습니다. 필요 없으면 지워도 됩니다.

## 2. 서버 함수 배포 — 관리자(dev@bmrschool.org)에게 요청

요청 예시 (값은 적지 않음):

> class-designer 앱의 서버 함수 `class-designer-fn` 배포를 부탁드립니다 (브랜치 port-bmr-apps 를 main 에 합친 뒤).
> 함수 비밀값 `CLASS_DESIGNER_GEMINI_API_KEY` 가 필요합니다. 값은 따로 안전하게 전달드리겠습니다.
> `CLASS_DESIGNER_DB_URL`(함수 전용 DB 계정)이 들어 있는지도 확인 부탁드립니다.

- 함수는 `Deno.env.get('CLASS_DESIGNER_GEMINI_API_KEY')` 로만 키를 읽습니다. 브라우저 코드에는 키가 없습니다.
- 함수는 요청마다 로그인 토큰을 확인하고, `class_designer.members` 멤버만 통과시킵니다.
- Alter 에 보내는 글은 학생 개인정보(이름+번호, 전화, 주민번호, 메일 등) 검사를 거치고, 걸리면 보내지 않습니다.

## 3. 확인

1. `https://psupfmarnyxontorftio.supabase.co/functions/v1/class-designer-fn/health` → `{"ok":true,"db":true}`
2. https://apps.bmrschool.net/class-designer/ 에서 구글 로그인 → 내 설계안 화면이 보이면 끝.
3. 관리 → 설정(AI)에서 공급자 `gemini`, 모델 이름을 확인합니다. 키가 아직 없으면 `mock`(예시 답)으로 둘 수 있습니다.

## 4. 화면 배포

- `port-bmr-apps` 브랜치를 검토한 뒤 **main 에 합치면** GitHub Pages 로 자동 배포됩니다.
- 1·2단계 전에 합쳐도 화면은 '서버 준비 중 · 미리보기' 상태로 안전하게 보입니다.

## 주의

- 이 앱은 기존 PHP 앱(bmrschool.net/design)과 DB 를 공유하지 않습니다. 기존 설계안을 옮기려면 별도 작업이 필요합니다.
- 오래된 AI 기록 정리(`purge_old`)는 pg_cron 대신 함수가 가끔(요청의 약 2%) 실행합니다.
