# 서버 함수

- 관리자가 허브에서 이 앱의 '서버 함수 자동 배포'를 켜 두었으면, `class-designer-fn/` 의 코드를 고쳐 `main` 에 올릴 때(push) GitHub Actions **서버 함수 검사·배포**(`.github/workflows/functions-check.yml`)가
  형식 검사(`deno check`) 뒤 BMR APPS 허브를 통해 `class-designer-fn` 를 자동으로 배포합니다. 저장소에 비밀값은 필요 없습니다.
- 결과(버전, `/health` 응답)는 Actions 실행 화면의 Summary 에 나옵니다. 다시 배포하려면 Actions 탭에서 **Run workflow** 를 누르세요.
- 자동 배포가 꺼져 있으면 배포되지 않고 Summary 에 안내가 나옵니다. 그때는 관리자에게 배포를 요청하세요.
- 진입점은 `class-designer-fn/index.ts` 이고, 이 폴더 안의 파일만 함께 올라갑니다.
- `class-designer-fn` 가 아닌 새 함수와 함수 비밀값은 관리자에게 요청하세요.
