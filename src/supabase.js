// 이 앱에서 쓸 Supabase 연결. 화면 코드에서 import { supabase } from './supabase.js' 로 가져다 쓰세요.
// 공개(publishable) 키만 씁니다. service_role·secret 키는 절대 브라우저 코드에 넣지 마세요.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    db: { schema: 'class_designer' }, // 이 앱 스키마
    // 같은 주소(apps.bmrschool.net)를 쓰는 다른 앱과 로그인 저장 칸이 겹치지 않게 이름을 따로 둡니다
    auth: { storageKey: 'bmr-app-class-designer-auth' },
  },
);
// 서버 함수 주소: https://psupfmarnyxontorftio.supabase.co/functions/v1/class-designer-fn/hello
export const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/class-designer-fn`;
