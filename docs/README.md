# HAMS ERP 상세 문서

분석 기준: 2026-10-16, `package.json` 0.1.0과 현재 체크아웃의 소스 코드. 코드에 구현된 동작과 미구현·개선 항목을 구분한다. 운영 DB·Vercel 계정·실제 비밀 값은 이 분석에서 조회하지 않는다.

| 문서 | 내용 |
| --- | --- |
| [architecture.md](architecture.md) | 구성도, 파일 책임, 화면 상태, 폴링, 데이터 집계, 기술 구성 |
| [database.md](database.md) | 연결 선택, 초기화, 7개 테이블, 제약, 저장 범위와 이관 |
| [authentication.md](authentication.md) | 로그인·세션·권한·실패 제한·로그아웃 |
| [api.md](api.md) | GET 응답과 14개 POST action, 필드, 상태 코드 |
| [workflows.md](workflows.md) | 인사·출퇴근·원격근무·급여 상태 전이와 판정 기준 |
| [deployment.md](deployment.md) | 로컬 환경 변수, Vercel·Turso 설정, 오류별 점검 |
| [testing.md](testing.md) | 자동 테스트 구조, 수동 원격 테스트, 검증 범위 |
| [limitations.md](limitations.md) | 현재 제약, 정확성·보안·확장 관점의 개선 항목 |

## 읽는 순서

처음 실행할 때는 [프로젝트 README](../README.md), 운영 문제는 [배포·문제 해결](deployment.md), 기능을 수정할 때는 [구조](architecture.md) → [API](api.md) → [업무 처리](workflows.md) 순서로 읽는다.

## 분석 근거

| 소스 | 분석 대상 |
| --- | --- |
| [workspace.tsx](../app/workspace.tsx) | 화면과 상태 계산·요청 주기·CSV·폼 |
| [route.ts](../app/api/erp/route.ts) | 인증·접근 제어·입력 검증·SQL 분기 |
| [db.ts](../lib/db.ts) | 연결·DDL·시드·날짜 처리 |
| [types.ts](../lib/types.ts) | 클라이언트 데이터 형태 |
| [erp.test.mjs](../tests/erp.test.mjs) | 실제 서버 통합 시나리오 |
| [package.json](../package.json) / [next.config.ts](../next.config.ts) | 명령·기술 버전·Next.js 설정 |

문서의 예시는 기본 샘플 계정과 가상 입력값이다. DB 토큰·개인 비밀번호·실제 급여 기록은 포함하지 않는다.
