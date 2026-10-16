# API 계약

구현: [app/api/erp/route.ts](../app/api/erp/route.ts). 모든 요청 경로는 `/api/erp`다. GET은 조회, POST는 JSON `action`으로 분기한다. 사용자 식별은 쿠키 세션에서 가져온다.

## 공통 응답

성공 POST는 `{ "ok": true }`와 200이다. 예측 가능한 오류는 `{ "error": "메시지" }`와 해당 상태 코드를 반환한다. 예상하지 못한 오류는 서버에 `ERP request failed`로 기록하고 일반 오류 문구와 500을 반환한다. 모듈 로드 중 DB 연결 생성 오류는 이 처리 밖이다.

POST는 Origin 검사 → DB 초기화 → JSON 파싱 → register/login 분기 또는 세션 확인 → 비밀번호 변경 필요 여부 확인 → action 검증·SQL 순서다. register/login 이외 요청은 유효한 세션이 필요하다. Content-Type은 JSON으로 보낸다.

## GET /api/erp

별도 쿼리 파라미터 없이 Snapshot을 반환한다. `Cache-Control: no-store`를 설정한다.

| 필드 | 값 |
| --- | --- |
| user | 로그인한 Employee |
| employees | 관리자 전체·개인 본인, `joined` 오름차순 |
| attendance | 권한 범위의 근태, `check_in` 내림차순, 최대 500건 |
| remote | 권한 범위의 최신 원격 상태. 종료 행도 포함 |
| payroll | 권한 범위의 정산, `month` 내림차순 |
| serverTime | 응답 시 서버 ISO 시각 |
| remoteSettings | 공통 원격 감지 설정 `{ idleMinutes: number }`, 모든 로그인 사용자에게 제공 |

최초 변경이 필요한 user.must_change_password=1이면 user만 반환하고 4개 업무 배열은 비운다. user·employees에는 password_hash를 포함하지 않는다. 변경 완료 계정의 4개 조회는 `Promise.all`로 수행하며 전체를 단일 읽기 트랜잭션으로 묶지 않는다. 월 필터·이름 검색·원격 상태 분류는 클라이언트에서 한다.

## POST action 목록

| action | 필드 | 권한 | 동작 |
| --- | --- | --- | --- |
| register | name, email, department, position, kind | 비로그인 가능 | member 계정과 초기 비밀번호 해시 생성 |
| login | email, password | 비로그인 가능 | DB 해시 검증·세션·쿠키 발급 |
| password-change | currentPassword, newPassword, confirmPassword | 로그인, 본인 | 비밀번호 변경·필수 변경 해제·기존 세션 전부 무효화·새 세션 |
| profile-save | name, department, position | 로그인, 본인, 최초 변경 완료 | 이름·소속·직무 변경 |
| remote-settings-save | idleMinutes | admin, 최초 변경 완료 | 전 구성원 공통 자리비움 시간 저장 |
| logout | 없음 | 로그인 | 현재 세션 삭제, 계정 원격 공유 종료 |
| checkin | mode | 로그인, 본인 | 오늘 출근 생성 |
| checkout | 없음 | 로그인, 본인 | 모든 미퇴근 기록에 퇴근 시각, 원격 공유 종료 |
| remote-start | task, consent | 로그인, 본인 | 오늘 미퇴근 원격 출근 확인 후 공유 UPSERT |
| heartbeat | visible, userState, screenState | 로그인, 본인 | 미종료 공유 행의 연결·기기 활동·화면 잠금 상태 갱신 |
| remote-stop | 없음 | 로그인, 본인 | 미종료 공유 행 종료 |
| employee-save | 아래 인사 필드 | admin | 구성원 등록 또는 수정 |
| payroll-generate | month | admin | 대상 월의 미생성 정산만 추가 |
| payroll-save | id, adjustment, deduction, status | admin | 수당·공제·검토 상태 변경 |

POST action은 총 14개다. 최초 변경 필요 시 logout/password-change 외 인증 후 업무 요청은 403이다. 그 외 일치하지 않는 action은 로그인 검증 후 400이다.

### remote-settings-save

idleMinutes는 숫자형 1~120의 정수이며 기본값은 5분이다. 관리자만 저장하며 비로그인은 401, 일반 구성원·최초 비밀번호 변경 전은 403, 범위·타입 오류는 400이다. remote_settings의 공통 한 행에 저장하고 모든 로그인 사용자의 GET에 remoteSettings로 제공한다. 공유 중인 감지기는 다음 GET(기본 15초)에서 값이 바뀌면 중단 후 새 threshold로 재시작한다. 화면 잠금은 설정 시간과 관계없이 자리비움이다.

### login

email은 trim·소문자 변환한 1~100자의 유효 이메일이다. password는 최대 128자 문자열이다. DB 구성원과 scrypt 해시를 검증한다. 환경 공통 비밀번호나 이메일 허용 목록은 사용하지 않는다. 자세한 처리 순서는 [인증 문서](authentication.md)를 따른다.

### register / password-change

register의 이름은 1~50자, 소속·직무는 각각 1~50자, 이메일은 1~100자이며 trim한다. 계약 유형은 직원·프리랜서다. 이메일은 소문자로 저장하고 대소문자 무시 중복 검사한다. 초기 비밀번호는 서버가 hams1234!로 정한다. 요청 role·salary·password는 반영하지 않는다.

password-change는 현재 비밀번호, 초기·현재 값과 다른 10~128자 새 비밀번호, 같은 확인값을 요구한다. 현재 값 불일치는 401, 새 값·확인 오류는 400, 동시 변경 충돌은 409다. 완료 후 Set-Cookie의 새 세션을 사용해야 한다. 새 값은 trim하지 않는다.

### profile-save

name, department, position은 각각 trim 후 1~50자 문자열이다. 세션의 사용자 ID로 본인 행만 수정하며 요청의 id·employee_id·role·salary·email 등 다른 필드는 반영하지 않는다. 관리자와 일반 구성원 모두 사용할 수 있고, 최초 비밀번호 변경 전에는 403이다.

### checkin / checkout

```json
{ "action": "checkin", "mode": "원격" }
```

mode는 `사무실` 또는 `원격`이다. 미퇴근 존재 또는 오늘 중복이면 409다. 출근 요청의 employee_id·day·시각을 받지 않으며 서버가 정한다. checkout은 갱신한 출근 행이 없으면 409다.

### remote-start / heartbeat / remote-stop

```json
{ "action": "remote-start", "task": "주문 화면 개발", "consent": true }
```

task는 trim한 1~200자다. consent는 boolean `true`여야 한다. 오늘·본인·미퇴근·원격 조건이 맞지 않으면 400이다.

```json
{ "action": "heartbeat", "visible": false, "userState": "active", "screenState": "unlocked" }
```

userState는 active/idle/unknown, screenState는 locked/unlocked/unknown이며 잘못된 값은 400이다. 누락·null은 unknown이다. visible은 정확히 true인 경우만 1로 저장하며 판정에는 사용하지 않는다. 기존 active 필드는 무시한다. last_active는 active+unlocked 보고 시 서버 시각으로 갱신한다. 현재 미종료 본인 원격 행만 갱신하며, 없더라도 성공을 반환한다. remote-stop도 대상 행이 없어도 성공이다. 두 요청은 공유를 새로 만들지 않는다. remote-start는 기기 상태를 unknown으로 초기화하며 이후 heartbeat로 실제 상태를 보고한다.

### employee-save

| 필드 | 규칙 |
| --- | --- |
| id | 생략하면 신규 UUID, 있으면 해당 ID 수정 |
| name | trim 후 1~50자 |
| email | trim 후 1~100자, 간단한 이메일 패턴, 중복이면 409 |
| department, position | 각각 trim 후 1~50자 |
| kind | 직원·프리랜서 |
| project | trim 후 1~100자 |
| joined | 실제 존재하는 `YYYY-MM-DD` 날짜 |
| salary | 숫자형 안전 정수, 0~1,000,000,000 |

신규 role은 member이며 초기 비밀번호 해시와 필수 변경 표시도 생성한다. 시드 ID admin·member·freelancer의 이메일 변경은 400이다. 다른 구성원의 role 변경·삭제·관리자 비밀번호 초기화는 지원하지 않는다. 존재하지 않는 일반 id에 대한 UPDATE는 영향 행 수를 검사하지 않아 성공 응답이 될 수 있다.

### payroll-generate

month는 `YYYY-MM`이며 월은 01~12여야 한다. `joined`의 연월이 대상 월 이하인 구성원이 대상이다. 현재 salary를 base로, 수당·공제를 0으로, 검토 상태를 검토 대기로 생성한다. 재요청은 기존 `(employee_id, month)`를 유지한다. 새로 추가된 대상 구성원만 추가될 수 있다.

### payroll-save

id는 trim한 1~100자다. adjustment·deduction은 각각 숫자형 안전 정수 0~10억 원이다. status는 `검토 대기` 또는 `검토 완료`다. 대상이 없거나 공제가 기본급+수당보다 크면 400이다. base를 변경하는 필드는 없다.

## 주요 상태 코드

| 코드 | 대표 조건 |
| --- | --- |
| 200 | 정상 조회·변경 |
| 400 | 필드 검증, 잘못된 JSON, 원격 출근 선행 조건 미충족, 정산 조건 오류 |
| 401 | 세션 없음·만료, 이메일·비밀번호 불일치, 변경 시 현재 비밀번호 불일치 |
| 403 | Origin 불일치, 최초 비밀번호 변경 필요, 관리자 권한 없음 |
| 409 | 미퇴근·중복 출근, 중복 이메일 |
| 429 | 로그인 실패 제한 기간 내 누적 10회 이상 |
| 500 | DB 등 예상하지 못한 요청 처리 오류 |

로그인 전 GET 401은 정상적인 비로그인 판별일 수 있다. 로그인 POST의 401과 구분해서 조사한다. 표준 오류는 SQL·토큰을 클라이언트에 반환하지 않는다.
