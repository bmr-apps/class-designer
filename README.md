# 별무리 수업 디자이너 · 개발 안내

BMR APPS 에서 준비해 드린 **빈 개발 환경**입니다. 화면, 데이터 구조, 로그인 규칙은 모두 선생님이 직접 정해서 만드시면 됩니다.
지금 앱 주소에는 **'준비 중인 페이지입니다'** 라는 간단한 안내만 보입니다. `index.html` 을 내 앱 화면으로 바꿔 올리면 바로 바뀝니다.

> 개발 정보(접속 정보·이름·예제 코드)는 이 README 와 **BMR APPS 허브 → 대시보드 → 내 서비스 → 개발 정보**(담당자·관리자만 보임)에서 볼 수 있습니다.
> 처음이라면 [시작 가이드](https://apps.bmrschool.net/guide)부터 읽어 보세요.

## 한눈에 보기

| 항목 | 값 |
|---|---|
| 앱 주소 | https://apps.bmrschool.net/class-designer/ |
| 저장소 | https://github.com/bmr-apps/class-designer |
| Supabase 주소 | `https://psupfmarnyxontorftio.supabase.co` |
| 공개(publishable) 키 | `.env.example` 에 들어 있음 (브라우저에 넣어도 되는 공개 값) |
| 내 데이터베이스 스키마 | `class_designer` (이 안에서는 표·뷰·함수·정책을 마음대로) |
| 내 DB 계정 | `class_designer_dev` (비밀번호는 허브 [대시보드](https://apps.bmrschool.net/hub/apps) → 내 서비스 → 이 앱 → **앱 정보 → DB 접속 정보**에서 한 번 받기) |
| 파일 버킷 | `class-designer` (비공개) |
| 서버 함수 | `class-designer-fn` → `https://psupfmarnyxontorftio.supabase.co/functions/v1/class-designer-fn/hello` |
| 함수 비밀값 이름 | `CLASS_DESIGNER_` 로 시작 (예: `CLASS_DESIGNER_EXAMPLE_KEY`) |
| 앱 이름·설명 | 허브에서 관리자가 고치면 새로고침만으로 반영 (`src/app-info.js` 의 `loadAppInfo()`) |

## 1. 시작하기

```bash
git clone https://github.com/bmr-apps/class-designer.git
cd class-designer
npm install
cp .env.example .env.local     # 그리고 DATABASE_URL 의 비밀번호 칸을 채우기
npm run dev                    # http://localhost:5173/class-designer/
```

- `main` 브랜치에 올리면(push) GitHub Actions 가 빌드해서 **https://apps.bmrschool.net/class-designer/** 에 자동으로 배포합니다 (1~2분).
- Vite 프로젝트라 React, Vue, Svelte 등 원하는 도구를 더해도 됩니다. `vite.config.js` 의 `base: '/class-designer/'` 는 그대로 두세요.
- 지금 들어 있는 것은 준비 중 안내 페이지(`index.html`, `src/main.js`, `src/style.css`)와 연결 도우미 `src/supabase.js`, `src/app-info.js` 뿐입니다. 마음대로 지우고 바꾸셔도 됩니다.

## 2. 데이터베이스 접속

### 비밀번호 받기 (허브에서, 한 번만)

1. **https://apps.bmrschool.net/hub/apps** 에 담당자 메일로 로그인한 뒤 **내 서비스** → **별무리 수업 디자이너** 을 눌러 **앱 정보 → DB 접속 정보**를 엽니다. 허브 계정이 없으면 같은 메일로 가입하고 메일 확인을 마치세요(관리자가 초대 메일을 보내 줄 수도 있습니다).
   담당자 메일과 허브 계정 메일이 같으면 자동으로 연결됩니다.
2. **'처음 비밀번호 받기'** 를 누르면 접속 정보와 비밀번호가 **딱 한 번** 보입니다. 서버 사본은 그 순간 지워집니다.
3. **복사**해서 바로 `.env.local` 의 `DATABASE_URL` 이나 비밀번호 관리 프로그램에 저장하세요. 창을 닫으면 다시 볼 수 없습니다.
4. 잊어버렸거나 남에게 보였다면 같은 화면의 **'새 비밀번호 발급'** 을 누르세요. 새 비밀번호가 한 번 보이고, **이전 비밀번호는 바로 못 쓰게 됩니다.**

> 비밀번호는 **저장소·채팅·메일·화면 캡처에 올리지 마세요.** `.env.local` 은 저장소에 올라가지 않게 되어 있습니다.
> 받기·새로 발급은 모두 허브에 기록됩니다(비밀번호 값은 기록하지 않음).

### 비밀번호 직접 바꾸기

내 계정으로 접속한 상태에서 바꿀 수 있습니다. **psql 의 `\password`** 를 쓰면 새 비밀번호가 암호화된 형태로만 서버에 갑니다.

```bash
psql "$DATABASE_URL"
=> \password class_designer_dev
Enter new password: ********
```

또는 SQL 로: `alter role current_user password '새-비밀번호';` (이 방법은 평문이 서버로 가니 `\password` 를 권합니다.)

- 바꾸면 **예전 비밀번호를 쓰던 곳(`.env.local`, AI 도구 설정 등)이 모두 끊깁니다.** 새 비밀번호로 고쳐 주세요.
- 서버 함수 `class-designer-fn` 는 따로 있는 함수 전용 계정을 써서 **영향을 받지 않습니다.**
- 길고 무작위인 비밀번호(20자 이상)를 쓰세요.

### 접속 정보

```bash
# .env.local
DATABASE_URL=postgresql://class_designer_dev.psupfmarnyxontorftio:<비밀번호>@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
```

- 사용자 이름은 `class_designer_dev.psupfmarnyxontorftio` 처럼 **뒤에 프로젝트 이름이 붙은 형태**입니다 (공용 접속기 Supavisor 규칙).
- `5432` 는 일반(세션) 접속, `6543` 은 짧은 요청용(트랜잭션) 접속입니다. 개발할 때는 5432 를 쓰세요.
- 직접 주소 `db.psupfmarnyxontorftio.supabase.co:5432` (사용자 이름 `class_designer_dev`)는 IPv6 전용이라 학교망에서는 안 될 수 있습니다.
- 동시에 접속할 수 있는 연결은 **5개**까지, 한 문장은 기본 **15초**까지 돕니다.

**접속 방법은 편한 것으로:**

```bash
# psql
psql "$DATABASE_URL"

# 마이그레이션: supabase/migrations/ 에 SQL 파일을 만들고 (예: 20261112093000_create_events.sql)
npm run db:migrate      # 아직 안 한 파일만 이름 순서대로 실행, 기록은 class_designer._migrations 표에
```

- **AI 코딩 도구**(Cursor, Claude Code, Codex 등)에 "`.env.local` 의 DATABASE_URL 로 `class_designer` 스키마에 표를 만들어 줘"라고 맡겨도 됩니다. 연결 문자열은 도구 설정에만 넣고 코드에 적지 않게 해 주세요.
- `supabase db push` 는 프로젝트 공용 기록표(`supabase_migrations`)를 써서 이 계정으로는 쓸 수 없습니다. 위의 `npm run db:migrate` 를 쓰세요.
- 내 계정은 **`class_designer` 스키마 안에서만** 만들고 고칠 수 있습니다. 다른 앱 스키마, 허브 표, 로그인 사용자 표(`auth.users`)는 읽을 수도 없습니다.
- Supabase 대시보드 화면은 쓸 수 없습니다 (대시보드 권한은 프로젝트 전체에 걸려서).

## 3. 브라우저에서 데이터 쓰기 (supabase-js)

`src/supabase.js` 에 연결이 준비되어 있습니다. `db: { schema: 'class_designer' }` 덕분에 `from('documents')` 는 `class_designer.documents` 를 뜻합니다.

```js
import { supabase } from './supabase.js';

// 읽기
const { data, error } = await supabase.from('documents')
  .select('id, data, created_at')
  .eq('collection', 'notice')
  .order('created_at', { ascending: false });

// 쓰기 (로그인한 사람만, owner 는 자동으로 내 아이디)
await supabase.from('documents').insert({ collection: 'notice', data: { title: '연구소 소식', body: '…' } });

// 고치기·지우기 (내 문서만)
await supabase.from('documents').update({ data: { title: '고친 제목' } }).eq('id', id);
await supabase.from('documents').delete().eq('id', id);
```

## 4. JSON 문서 방식으로 시작하기

처음부터 표를 설계하지 않아도 되도록 **`class_designer.documents`** 표를 하나 만들어 두었습니다.
`collection`(종류) + `data`(JSON) 구조라, 새 칸이 필요하면 JSON 에 그냥 넣으면 됩니다.

| 칸 | 뜻 |
|---|---|
| `id` | 문서 번호 (자동) |
| `collection` | 종류. 예: `notice`, `activity`, `member` |
| `data` | 내용 JSON. 예: `{ "title": "…", "date": "2026-11-12", "tags": ["연수"] }` |
| `owner` | 쓴 사람(로그인 아이디, 자동) |
| `created_at`, `updated_at` | 만든·고친 시각 (자동) |

```js
// JSON 안의 값으로 찾기
await supabase.from('documents').select('*').eq('collection', 'activity').eq('data->>status', 'open');
// 배열·객체 포함 여부
await supabase.from('documents').select('*').contains('data', { tags: ['연수'] });
// JSON 안의 값만 골라 받기
await supabase.from('documents').select('id, title:data->>title, date:data->>date');
```

```sql
-- SQL 로 볼 때
select data->>'title' as title, data->'tags' as tags from class_designer.documents where collection = 'activity';
-- 자주 찾는 JSON 값이 있으면 색인을 더하세요
create index on class_designer.documents ((data->>'status')) where collection = 'activity';
```

기본 규칙(정책): **누구나 읽기 · 로그인하면 내 문서 쓰기 · 내 문서만 고치기·지우기.**
앱에 맞게 바꾸거나, 정식 표를 만든 뒤 `documents` 를 지워도 됩니다.

## 5. 표를 직접 만들고 RLS 로 지키기

브라우저에서 보이는 데이터는 **표 권한 + RLS(행 보안 정책)** 로만 지켜집니다. 새 표를 만들면 이렇게 하세요.

> **`auth.uid()` 대신 `bmr.uid()` 를 쓰세요.** Supabase 문서·AI 도구는 `auth.uid()` 를 쓰지만, 선생님 DB 계정은 `auth` 스키마 권한이 없어서 `permission denied for schema auth` 오류가 납니다.
> `bmr.uid()`(로그인한 사람 아이디), `bmr.jwt()`(로그인 토큰 내용), `bmr.role()`(`anon`/`authenticated`), `bmr.email()` 은 `auth.*` 와 똑같이 동작합니다.
> AI 도구에 맡길 때도 "auth.uid() 대신 bmr.uid() 를 써 줘"라고 알려 주세요.

```sql
create table class_designer.events (
  id bigint generated always as identity primary key,
  title text not null,
  starts_at timestamptz,
  owner uuid not null default bmr.uid(),
  created_at timestamptz not null default now()
);
-- (BMR APPS 가 새 표의 RLS 를 자동으로 켜 둡니다. 그래도 직접 적어 두면 확실합니다)
alter table class_designer.events enable row level security;

-- ① 누구나 읽기
create policy "누구나 읽기" on class_designer.events for select to anon, authenticated using (true);
-- ② 내 것만 쓰기·고치기·지우기
create policy "내 것 쓰기"   on class_designer.events for insert to authenticated with check (owner = (select bmr.uid()));
create policy "내 것 고치기" on class_designer.events for update to authenticated using (owner = (select bmr.uid())) with check (owner = (select bmr.uid()));
create policy "내 것 지우기" on class_designer.events for delete to authenticated using (owner = (select bmr.uid()));
-- 쓰기 권한은 직접 줘야 합니다 (기본은 읽기만)
grant insert, update, delete on class_designer.events to authenticated;
```

**③ 멤버 표로 '우리 앱 사람만'**

```sql
create table class_designer.members (
  user_id uuid primary key,
  role text not null default 'member' check (role in ('member', 'admin'))
);
-- 정책 안에서 쓸 도우미 (security definer 라 members 표 RLS 와 무관하게 확인)
create function class_designer.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from class_designer.members where user_id = (select bmr.uid()))
$$;
create policy "멤버만 읽기" on class_designer.events for select to authenticated using ((select class_designer.is_member()));
create policy "본인 멤버 정보 보기" on class_designer.members for select to authenticated using (user_id = (select bmr.uid()));
-- 첫 멤버는 SQL 로 넣기: 사용자 아이디는 앱에서 (await supabase.auth.getUser()).data.user.id 로 확인
insert into class_designer.members (user_id, role) values ('<사용자 uuid>', 'admin');
```

**④ BMR APPS 에서 승인된 개발자만:** `bmr.is_staff()` (BMR APPS 관리자는 `bmr.is_admin()`)

```sql
create policy "개발자만 읽기" on class_designer.events for select to authenticated using ((select bmr.is_staff()));
```

### 꼭 알아 둘 안전장치

- **RLS 자동 켜기:** 이 스키마에 새 표를 만들면 BMR APPS 가 RLS 를 자동으로 켭니다. 정책이 없으면 브라우저에서는 **아무것도 안 보이고 아무것도 못 씁니다**(안전한 쪽으로 막힘). 화면에 데이터가 안 나오면 정책부터 확인하세요.
- **기본 권한은 '읽기'만:** 새 표는 브라우저 역할(anon, authenticated)에 읽기(select)만 주어집니다. 쓰기는 위처럼 `grant insert, update, delete …` 를 직접 하세요. RLS 를 깜빡해도 '누구나 쓰기'가 되지 않게 하려는 장치입니다.
- **RLS 를 끄면(`disable row level security`) 그 표는 누구나 읽을 수 있게 됩니다.** 끄지 마세요.
- **뷰(view)** 는 자동으로 `security_invoker = true`(보는 사람 권한으로 RLS 적용)가 됩니다. 구체화 뷰는 브라우저 권한이 빠집니다.
- **`security definer` 함수**는 표 주인 권한으로 RLS 를 건너뜁니다. 위 `is_member()` 처럼 참/거짓만 돌려주는 도우미로만 쓰고, 데이터를 돌려주는 함수는 `security invoker`(기본값)로 만드세요. 함수에는 `set search_path = ''` 를 붙이세요.
- 학생 개인정보를 다룬다면 시작 전에 관리자와 꼭 상의해 주세요.

## 6. 로그인 (BMR APPS 공용 계정)

로그인은 프로젝트 전체가 함께 쓰는 Supabase Auth 입니다. 허브(https://apps.bmrschool.net)에서 가입한 계정으로 이 앱에도 로그인할 수 있고,
**누가 무엇을 볼지는 선생님이 RLS 로 정합니다** (`bmr.uid()`, `bmr.jwt()` — 아래 5장 참고).

### 구글 로그인 (켜져 있음)

관리자가 프로젝트 전체에 **구글 로그인을 켜 두었습니다.** 따로 설정할 것 없이 아래처럼 부르면 됩니다. 시작 코드의 **`src/auth.js`** 에 같은 도우미가 들어 있어요.

```html
<button id="login">구글로 로그인</button> <button id="logout" hidden>로그아웃</button> <span id="who"></span>
```

```js
import { loginWithGoogle, logout, onUserChange } from './auth.js';

document.querySelector('#login').onclick = loginWithGoogle;   // 구글 화면 → 이 앱 주소로 돌아옴
document.querySelector('#logout').onclick = logout;
onUserChange((user) => {
  document.querySelector('#who').textContent = user ? user.email : '';
  document.querySelector('#login').hidden = !!user;
  document.querySelector('#logout').hidden = !user;
});
```

- 돌아올 주소(`redirectTo`)는 **이 앱 자기 주소**입니다: 배포 `https://apps.bmrschool.net/class-designer/`, 로컬 `http://localhost:5173/class-designer/` (`src/auth.js` 가 알아서 고름).
- 허용된 돌아올 주소는 `https://apps.bmrschool.net/**`, `http://localhost:5173/**`, `http://localhost:3000/**` 뿐입니다. 다른 주소(다른 포트·도메인)가 필요하면 관리자에게 요청하세요. 허용 안 된 주소면 사이트 첫 화면으로 돌아갑니다.
- 카카오 등 다른 소셜 로그인은 아직 꺼져 있습니다.

### 그 밖의 로그인 코드

```js
import { supabase } from './supabase.js';

// 이메일·비밀번호 로그인 (허브와 같은 계정)
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// 지금 로그인한 사람 (서버에 확인)
const { data: { user } } = await supabase.auth.getUser();   // user?.id, user?.email

// 로그인 상태가 바뀔 때
supabase.auth.onAuthStateChange((event, session) => { /* 화면 다시 그리기 */ });

// 로그아웃
await supabase.auth.signOut({ scope: 'local' });   // 이 앱에서만. 그냥 signOut() 은 허브·다른 앱 로그인까지 모두 끊음
```

> **계정은 모든 앱이 함께 씁니다.** `auth.users` 는 BMR APPS 전체에 하나라서, 다른 앱에 가입한 사람이나 구글 계정이 있는 **누구나** 내 앱에도 로그인할 수 있습니다. 그래서 '로그인했다'만으로 권한을 주지 말고, **내 앱 멤버 표**(5-③ `class_designer.members` + `is_member()`)로 이 앱 사람을 따로 관리하세요. 멤버 표는 앱마다 내 스키마에 있으므로 다른 앱과 섞이지 않습니다.
> 정책에서 로그인한 사람 아이디는 `auth.uid()` 와 같은 값인 **`bmr.uid()`** 로 씁니다 (선생님 DB 계정은 `auth` 스키마 권한이 없음).
>
> **'로그인했다' ≠ '승인된 개발자다'.** 공용 계정은 누구나 가입할 수 있습니다. 학교 사람만 쓰게 하려면 `bmr.is_staff()` 나 멤버 표(5-③④)로 막으세요.
> 권한 판단에 `user_metadata`(사용자가 직접 바꿀 수 있는 값)는 쓰지 마세요.

- 로그인 저장 칸은 앱마다 따로 둡니다(`storageKey: 'bmr-app-class-designer-auth'`). 그래서 허브와 이 앱은 각각 로그인합니다.
- 비밀번호 재설정·가입 메일 같은 설정은 프로젝트 전체 설정이라 관리자에게 요청하세요.

## 7. 파일 저장 (Storage)

버킷 `class-designer` 는 **비공개**이고, 기본 규칙은 **로그인한 사람은 이 버킷 파일 읽기 · 자기 폴더(`<내 아이디>/…`)에만 올리기 · 자기가 올린 파일만 바꾸기·지우기** 입니다.

```js
const { data: { user } } = await supabase.auth.getUser();
const path = `${user.id}/${Date.now()}-${file.name}`;
await supabase.storage.from('class-designer').upload(path, file);                  // 올리기 (최대 10MB)
const { data } = await supabase.storage.from('class-designer').createSignedUrl(path, 60 * 60); // 1시간짜리 보기 주소
await supabase.storage.from('class-designer').remove([path]);                       // 지우기
```

파일 정책(공개로 열기, 다른 폴더 규칙 등)은 선생님 DB 계정으로 바꿀 수 없어서 **관리자에게 요청**하세요.

## 8. 서버 함수 (Edge Function)

외부 API 호출, 비밀 키 사용, 메일 발송처럼 브라우저에서 하면 안 되는 일은 서버 함수로 합니다.
시작 함수 **`class-designer-fn`** 가 이미 배포되어 있고, 코드는 `supabase/functions/class-designer-fn/index.ts` 에 있습니다.

```js
import { supabase, FN_URL } from './supabase.js';
// supabase-js 로 부르기 (로그인했으면 내 토큰이 함께 갑니다)
const { data } = await supabase.functions.invoke('class-designer-fn/hello', { method: 'GET' });
// 직접 부르기
const { data: { session } } = await supabase.auth.getSession();
const r = await fetch(`${FN_URL}/documents?collection=notice`, { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
```

시작 함수가 보여 주는 것: 부른 사람 확인(`/hello`), 앱 전용 비밀값 읽기(`CLASS_DESIGNER_*`), 내 스키마 조회·저장(`/documents`, 내 DB 계정으로 접속).

**바꾸는 순서**

1. `supabase/functions/class-designer-fn/index.ts` 를 고치거나, `supabase/functions/class-designer-<이름>/index.ts` 로 새 함수를 만듭니다 (이름은 꼭 `class-designer-` 로 시작).
2. 저장소에 올리면 GitHub Actions 의 **서버 함수 검사**가 형식만 확인합니다 (배포는 하지 않음).
3. 관리자에게 "class-designer 함수 배포해 주세요"라고 요청하면, 코드를 검토한 뒤 배포합니다.
   배포에는 프로젝트 전체 관리 토큰이 필요해서 선생님이 직접 배포할 수는 없습니다.
4. 비밀값(API 키 등)이 필요하면 이름(`CLASS_DESIGNER_…`)만 알려 주시고 값은 관리자에게 안전하게 전달하세요. 코드에서는 `Deno.env.get('CLASS_DESIGNER_…')` 로 읽습니다.

> 함수는 표 주인 권한으로 접속해서 RLS 를 거치지 않습니다. 누가 무엇을 볼 수 있는지는 함수 코드에서 직접 확인하세요.
> 함수는 함수 전용 DB 계정(`class_designer_fn`, 내 계정 권한을 그대로 물려받음)으로 접속해서, 내 비밀번호를 바꿔도 함수는 계속 동작합니다.

## 9. 관리자에게 요청할 것

선생님 계정으로는 못 하고 관리자(dev@bmrschool.org)가 해야 하는 일입니다. 허브의 앱 신청 화면이나 메일로 요청하세요. (요청할 때 비밀번호·키 값은 적지 마세요)

| 할 일 | 이유 |
|---|---|
| 서버 함수 배포, 함수 비밀값 넣기 | 프로젝트 전체 관리 토큰이 필요 |
| 다른 소셜 로그인(카카오 등) 켜기, 허용된 돌아올 주소 추가, 로그인 메일 설정 (구글 로그인은 이미 켜져 있음) | 프로젝트 전체 설정 |
| 파일 버킷 정책 바꾸기, 버킷 공개로 열기 | `storage` 스키마 권한 필요 |
| 확장 기능(extension) 추가 | 프로젝트 전체에 영향 |
| 접속 수·시간 한도 조정 (비밀번호는 허브에서 직접) | 관리자 권한 |
| 실시간(Realtime) 구독 켜기 | 프로젝트 전체 설정 |

## 10. 지켜 주세요

- **비밀 키는 브라우저 코드에 넣지 않기.** `VITE_` 로 시작하는 값은 모두 공개됩니다. 공개(publishable) 키만 넣고, DB 비밀번호·service_role·secret 키·외부 API 키는 절대 넣지 마세요.
- **같은 주소를 쓰는 앱들:** 아래 '공용 주소에서 지킬 규칙'을 지켜 주세요.
- **무료 한도를 모든 앱이 나눠 씀:** DB 500MB, 파일 1GB, 서버 함수 호출 월 50만 번. 큰 파일·대량 데이터는 미리 상의해 주세요. 일주일 동안 아무도 쓰지 않으면 프로젝트가 잠시 멈출 수 있습니다.
- **학생 개인정보**는 관리자와 상의한 뒤에만 다룹니다.

## 11. 공용 주소에서 지킬 규칙

모든 앱이 `https://apps.bmrschool.net/<앱 주소>/` 처럼 **한 주소(같은 출처)** 를 함께 씁니다. 브라우저 입장에서는 한 사이트라서, 조심하지 않으면 서로의 저장값·로그인·화면을 망가뜨릴 수 있어요.

1. **브라우저 저장소는 같은 서랍입니다.** localStorage·sessionStorage·IndexedDB·쿠키를 모든 앱이 같이 씁니다. 이름 앞에 꼭 **`class-designer:`** 를 붙이세요. `src/store.js` 를 쓰면 자동으로 붙습니다.
   ```js
   import { local, session } from './store.js';
   local.set('theme', 'dark');   // 실제 이름 'class-designer:theme'
   local.get('theme', 'light');
   ```
2. **`localStorage.clear()` · `sessionStorage.clear()` 쓰지 않기.** 다른 앱의 저장값과 로그인까지 다 지워집니다. `local.clear()`(내 앱 것만) 를 쓰세요.
3. **경로는 상대 경로나 `/class-designer/` 로.** `'/data.json'` 처럼 `/` 로 시작하면 사이트 맨 앞(`apps.bmrschool.net/data.json`)을 가리켜 다른 앱이나 허브로 갑니다. `'./data.json'` 이나 `import.meta.env.BASE_URL + 'data.json'` 을 쓰세요. (`index.html` 의 `/src/…` 는 Vite 가 알아서 고쳐 줍니다)
4. **서비스 워커(PWA)는 범위를 `/class-designer/` 로.** `navigator.serviceWorker.register('/class-designer/sw.js', { scope: '/class-designer/' })`. 범위가 넓으면 다른 앱의 요청까지 가로챕니다.
5. **외부 스크립트 조심.** 외부 주소에서 불러온 스크립트는 같은 주소의 **모든 앱** 저장값·로그인 정보를 읽을 수 있습니다. 가능하면 npm 으로 설치해 함께 빌드하세요. 꼭 필요하면 관리자와 상의한 뒤 `.bmr-check.json` 의 `allowScripts` 와 `vite.config.js` 의 CSP 에 함께 추가합니다.
6. **로그인·로그아웃은 앱마다.** 로그인 저장 칸은 `bmr-app-class-designer-auth` 로 앱마다 따로라서 허브와 이 앱은 각각 로그인합니다. 로그아웃은 `signOut({ scope: 'local' })` (`src/auth.js` 의 `logout()`) 로 하세요. 그냥 `signOut()` 은 모든 앱·기기의 로그인을 끊습니다.
7. **무료 한도는 모두가 나눠 씁니다.** DB 500MB · 파일 1GB · 서버 함수 월 50만 번 · 데이터 전송량. 큰 파일·대량 데이터·잦은 자동 호출은 미리 상의해 주세요.

### 자동 점검 (경고만)

push 할 때마다 GitHub Actions 의 **'공용 주소 점검'** (`.github/workflows/bmr-check.yml` → `scripts/bmr-check.mjs`) 이 위 규칙을 살펴봅니다.

- **배포를 막지 않습니다.** 경고는 실행 화면의 Summary 와 **허브 → 내 서비스 → 앱 정보 → 공용 주소 점검** 에 고치는 법과 함께 보입니다.
- 로컬에서도: `node scripts/bmr-check.mjs`
- 일부러 그렇게 쓴 줄은 그 줄 끝이나 바로 윗줄에 **`// bmr-allow: 이유`** 를 달면 건너뜁니다.
- 결과는 GitHub 가 서명한 1회용 토큰(OIDC)으로만 허브에 보내므로 저장소에 비밀값이 없습니다.
- `.bmr-check.json` 의 `"block_dangerous": true` 로 바꾸면 `clear()`·범위 없는 서비스 워커 두 규칙은 실패로 막습니다(지금은 꺼 둠).

## 폴더

```
index.html                  ← 지금은 '준비 중' 안내 페이지. 내 앱 화면으로 바꾸세요
src/supabase.js             ← Supabase 연결 (스키마 class_designer)
src/main.js, src/style.css  ← 준비 중 페이지용 (지워도 됨)
src/app-info.js             ← 허브에 적힌 앱 이름·설명 읽기
src/auth.js                 ← 로그인 도우미 (구글 로그인·로그아웃·지금 사용자)
src/store.js                ← 브라우저 저장소 도우미 (이름 앞에 'class-designer:' 자동)
scripts/bmr-check.mjs       ← 공용 주소 점검 (경고만)
.bmr-check.json             ← 점검 설정 (허용 외부 스크립트, 막는 규칙 켜기)
supabase/migrations/        ← 내 SQL 파일 → npm run db:migrate
supabase/functions/class-designer-fn/  ← 서버 함수 (배포는 관리자)
scripts/db-migrate.mjs      ← 마이그레이션 실행 도구
.github/workflows/          ← 자동 배포(deploy.yml), 함수 검사(functions-check.yml), 공용 주소 점검(bmr-check.yml)
.env.example                ← .env.local 로 복사해서 쓰기
```
