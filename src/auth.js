// 로그인 도우미 (BMR APPS 공용 계정). 필요할 때 import 해서 쓰세요. 예:
//   import { loginWithGoogle, logout, currentUser, onUserChange } from './auth.js';
//   document.querySelector('#login').onclick = loginWithGoogle;
// 구글 로그인은 관리자가 프로젝트 전체에 켜 두었습니다. 로그인 뒤에는 이 앱 주소로 돌아옵니다.
import { supabase } from './supabase.js';

// 이 앱 주소: 배포 https://apps.bmrschool.net/class-designer/ , 로컬 http://localhost:5173/class-designer/
const APP_URL = new URL(import.meta.env.BASE_URL, location.origin).href;

export function loginWithGoogle() {
  return supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: APP_URL } });
}

export function loginWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

// 이 앱에서만 로그아웃 (scope: 'local'). 그냥 signOut() 은 허브·다른 앱·다른 기기의 로그인까지 모두 끊습니다.
export function logout() {
  return supabase.auth.signOut({ scope: 'local' });
}

// 지금 로그인한 사람 (서버에 확인). 없으면 null
export async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// 로그인·로그아웃할 때마다 fn(user 또는 null) 호출. 처음 한 번도 바로 불림
export function onUserChange(fn) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => fn(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}
