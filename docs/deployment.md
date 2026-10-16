# 환경 설정·Vercel·Turso 운영

코드 근거: [db.ts](../lib/db.ts), [route.ts](../app/api/erp/route.ts), [package.json](../package.json), [.env.example](../.env.example). 외부 플랫폼 안내 확인일: 2026-10-16.

## 로컬 실행과 포트

```powershell
pnpm install
pnpm dev
```

현재 개발 스크립트는 `next dev --port 3014`다. 접속 주소는 http://localhost:3014 이다. 프로덕션 로컬 실행은 `pnpm build` 후 `pnpm start`이며 start 스크립트에는 3014를 지정하지 않는다. 실제 시작 로그의 포트를 확인한다.

## 환경 변수

원격 기기 활동 감지에는 Idle Detection 지원 브라우저와 사용자 권한, 보안 컨텍스트가 필요하다. 배포 사이트는 HTTPS로 접속하고 로컬 개발은 localhost를 사용한다. 미지원·거절 상태에서도 업무 공유는 계속되지만 자동 판정 불가로 표시한다. 최소화·절전·탭 중단 시 지속 실행은 보장하지 않는다. [Chrome 공식 Idle Detection 문서](https://developer.chrome.com/docs/capabilities/web-apis/idle-detection)

| 키 | 사용처 | 기본 / 주의 |
| --- | --- | --- |
| ERP_DATABASE_URL | DB 연결 URL | 빈 값이면 `file:data/erp.db`. Vercel에서는 원격 URL 필요 |
| ERP_DATABASE_AUTH_TOKEN | libSQL client 인증 | DB용 비밀 값. 로그인 화면에 입력하지 않음 |

비밀번호는 DB의 계정별 scrypt 해시로 관리한다. 이전 ERP_DEMO_PASSWORD·ERP_ENABLE_DEMO_LOGIN은 더 이상 사용하지 않으므로 Vercel이나 로컬에서 값을 바꿔도 비밀번호에 영향을 주지 않는다. 기존 설정 파일은 자동 수정하지 않는다. 초기 비밀번호 hams1234!로 로그인한 뒤 필수 변경 모달에서 변경한다.

Next.js가 값을 찾는 우선순위는 다음과 같다. 같은 키는 먼저 찾은 값이 적용되며 빈 값도 이미 정의된 값일 수 있다.

1. 프로세스 환경 변수
2. `.env.<NODE_ENV>.local`
3. `.env.local` (`NODE_ENV=test` 제외)
4. `.env.<NODE_ENV>`
5. `.env`

따라서 `.env`만 수정했는데 `.env.local`에 같은 키가 있으면 예상과 다를 수 있다. 오타인 `..env`는 표준 환경 파일명이 아니다. 실제 비밀 값을 출력하지 말고 어떤 파일·배포 환경이 값을 제공하는지 확인한다. 로컬 설정 변경 후 개발 서버를 재시작한다. 근거는 설치된 `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`의 Load Order 절이다.

## Vercel 배포 준비

1. 모노레포에서 Vercel 프로젝트 Root Directory가 `hams-erp`를 가리키는지 확인한다.
2. 원격 libSQL DB와 연결 URL·읽기/쓰기 가능한 인증 토큰을 준비한다.
3. Vercel Project Settings → Environment Variables에서 아래 값을 등록한다. 실제 방문하는 배포가 Production인지 Preview인지에 맞춰 환경 범위를 선택한다.
4. 환경 변수 변경을 반영할 새 배포를 실행한다. 기존 배포는 자동으로 바뀌지 않는다. [Vercel 환경 변수 문서](https://vercel.com/docs/environment-variables)
5. 해당 새 배포 URL에서 `/api/erp` 응답과 로그인·기록 저장을 확인한다.

```dotenv
# 아래 주소·토큰을 실제 DB 값으로 교체합니다.
ERP_DATABASE_URL=libsql://your-database.turso.io
ERP_DATABASE_AUTH_TOKEN=your-database-token
```

여기에는 변수를 추가·수정하는 실제 배포 작업을 수행하는 스크립트가 없다. Vercel이 `.env.local`의 로컬 값을 자동으로 동기화한다고 가정하지 않는다. 비밀 값에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.

Vercel Functions의 파일시스템은 읽기 전용이며 `/tmp`는 임시 공간이다. 로컬 SQLite 파일을 영속 업무 DB로 쓰는 배포는 이 구조와 맞지 않는다. `/tmp`로 경로만 바꾸면 인스턴스 간 공유·지속성이 해결되지 않는다. [Vercel 런타임 문서](https://vercel.com/docs/functions/runtimes)

## Turso 연결과 초기화

Turso 연결 URL과 인증 토큰을 각각 ERP_DATABASE_URL·ERP_DATABASE_AUTH_TOKEN에 넣는다. Marketplace 연결이 제공하는 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`은 현재 코드에서 직접 읽지 않는다. 기존 변수를 ERP 변수명에 대응시켜 등록하거나 별도 코드 변경이 필요하다. [Turso Vercel 통합 문서](https://vercel.com/marketplace/tursocloud/database)

처음 실제 API를 호출하면 스키마와 샘플 구성원 및 초기 비밀번호 해시를 자동 생성하므로 비어 있는 새 DB에 로컬 erp.db를 가져올 필요는 없다. 기본 로그인 전 GET 401이어도 초기화는 앞에서 실행되었을 수 있다. 계정 비밀번호는 Turso employees.password_hash를 사용해 검증한다.

서버리스 새 인스턴스에서도 초기화를 시도한다. `IF NOT EXISTS`와 `INSERT OR IGNORE`로 기존 행을 유지하고 부족한 인증 컬럼만 추가한다. 해시가 없는 기존 계정은 초기 비밀번호를 부여하고 기존 세션을 삭제한다. 변경된 해시는 다시 덮어쓰지 않는다. **기존 DB는 새 버전 배포 전 백업한다.** 일반 마이그레이션 프레임워크·운영 시드 분리 체계는 별도 없다. 로컬·배포가 같은 URL을 사용하면 같은 DB를 공유하므로 테스트 격리를 확인한다.

## 오류별 확인 순서

브라우저 Network에서 **로그인 POST와 후속 GET을 구분**한다. 응답이 HTML이면 JSON 파싱 오류가 앞에 표시될 수 있으므로 Vercel Functions 로그도 함께 확인한다. 비밀번호·쿠키·DB 토큰은 공유하지 않는다.

| 증상 / 응답 | 코드상 의미 | 확인할 항목 |
| --- | --- | --- |
| 첫 GET 401 / 로그인이 필요합니다 | 비로그인 판별 | 로그인 전이면 정상 |
| POST 401 / 이메일 또는 비밀번호를 확인해 주세요 | DB 계정 또는 해시 검증 실패 | 등록 이메일, 변경 후 비밀번호, 전환 계정이면 초기값 hams1234! |
| POST 403 / 먼저 초기 비밀번호를 변경해 주세요 | 최초 변경 미완료 | 메인 화면의 변경 모달 완료 |
| 변경 POST 401 / 현재 비밀번호를 확인해 주세요 | 현재 비밀번호 불일치 | 초기값 또는 현재 변경값, 불필요한 앞뒤 공백 확인 |
| register POST 409 / 이미 등록된 이메일입니다 | 기존 인사 계정 존재 | 기존 계정으로 로그인, 중복 가입은 비밀번호 초기화가 아님 |
| POST 429 / 15분 후 다시 로그인 | 실패 횟수 제한 | 같은 이메일 제한 기간 종료 후 시도 |
| POST 403 / 허용되지 않은 요청 | Origin·Host 검증 실패 | 커스텀 도메인·프록시 전달 헤더 |
| GET/POST 500 일반 오류 | DB·SQL 등 처리 실패 | 연결 URL·토큰 권한·기존 스키마·서버 로그 |
| 플랫폼 오류 / 읽기 전용 파일 오류 | 로컬 경로 사용 또는 모듈 초기화 실패 가능 | DB URL 누락·빈 값·`file:` 지정, 실제 새 배포의 변수 |
| 로그인 POST 200 뒤 다시 로그인 화면 | 후속 세션 조회 실패 가능 | Set-Cookie·요청 Cookie·도메인·HTTPS·DB 세션·후속 GET |
| 원격 출근 후 상태 공유를 시작해 주세요 | 원격 시작 조건 불충족 | 같은 계정·오늘·원격 출근·미퇴근 여부 |

로그인 안내의 초기값과 첫 변경 후 실제 비밀번호를 구분한다. 예전 프로덕션 로그인 차단 메시지가 보이면 오래된 버전이 서비스되는지 확인한다. 오류 메시지 없이 원인을 단정하지 않는다.

## 데이터 보관과 운영 범위

원격 DB 백업·보관 기간·접근 통제는 별도 운영 정책이 필요하다. 세션·로그인 실패 행·근태 자동 정리와 감사 로그는 구현되지 않았다. 현재 추적 중인 `data/erp.db`를 저장소에서 관리할지는 별도 결정 사항이며, 이 문서화는 파일 삭제·Git 추적 해제·데이터 이관을 수행하지 않는다.
