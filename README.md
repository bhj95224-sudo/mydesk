# 개인 웹 포트폴리오

1920 × 1080 데스크톱 화면을 기준으로 만든 개인 포트폴리오의 React 초기 버전입니다. 메인 화면은 **책상**이고, 책상 위 **모니터**를 누르면 프로젝트 브라우저로 이동합니다.

## 시작하기

VS Code에서 이 폴더를 연 다음 터미널에서 실행합니다.

```bash
npm ci
npm run dev
```

터미널에 표시된 로컬 주소를 브라우저에서 열고, 개발자 도구의 화면 크기를 **1920 × 1080**으로 맞춰 확인합니다.

## 현재 구현

- `#/` — 책상 메인 화면. 모니터와 텍스트 링크로 프로젝트 브라우저에 진입합니다.
- `#/projects` — 네 프로젝트를 겹친 창으로 탐색합니다.
- 프로젝트 자동 전환 6.5초, 선택 버튼과 창 제목으로 직접 이동, 전환 진행 표시 및 일시정지 버튼.
- 프로젝트 창에 마우스를 올리거나 키보드 포커스가 들어오면 자동 전환이 멈춥니다.
- 작은 화면에서도 구조가 무너지지 않도록 기본 반응형 레이아웃을 넣었습니다.

현재 대표 화면은 **CSS로 만든 임시 시안**입니다. 비플레인·설화수·hourtention·자두야의 최종 이미지와 상세 문구를 받으면 교체할 수 있도록 `src/components/ProjectArtwork.tsx`와 `src/data/projects.ts`로 분리했습니다. 자두야의 개인 기여 범위는 확인 전까지 단정하지 않았습니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [PRD.md](PRD.md) | 목적, 사용자 흐름, 화면 요구사항, 완료 기준 |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | 1920 × 1080 웹 기준, 여백, 격자, 색상, 컴포넌트 |
| [docs/OPEN_DECISIONS.md](docs/OPEN_DECISIONS.md) | 최종 구현 전 결정할 콘텐츠와 인터랙션 |

문서 구성은 기존 ‘안녕 자두야’ 저장소의 `README.md`, `PRD.md`, `DESIGN_SYSTEM.md`를 참고했습니다. 자두야의 **402 × 874 모바일 프레임과 342px 콘텐츠 폭은 가져오지 않았고**, 이 프로젝트에 필요한 데스크톱 기준으로 다시 정의했습니다. 팀원용 브랜치·승인 규칙 역시 개인 작업에 맞게 단순화했습니다.

## 구조

```text
src/
  components/ProjectArtwork.tsx  프로젝트별 임시 대표 화면
  data/projects.ts            프로젝트 이름·설명·색상
  pages/DeskPage.tsx          메인 책상 화면
  pages/ProjectBrowserPage.tsx 모니터 클릭 후 화면
  styles/global.css          레이아웃과 시각 스타일
  App.tsx                    화면 전환
public/assets/              확정된 이미지·폰트 배치 위치
docs/OPEN_DECISIONS.md       남은 결정사항
```

## 확인 명령

```bash
npm run typecheck
npm run build
npm run preview
```

## GitHub 연결

이 폴더는 기존 `jaduya` 저장소와 분리된 **개인 포트폴리오 프로젝트**입니다. 원격 저장소는 `https://github.com/bhj95224-sudo/mydesk.git`입니다.

```bash
git clone https://github.com/bhj95224-sudo/mydesk.git
cd mydesk
npm ci
npm run dev
```

다른 컴퓨터에서는 위 명령으로 이어서 작업하면 됩니다. `node_modules`와 `dist`는 Git에 올리지 않습니다. 작업한 뒤에는 `npm run build`로 확인하고 변경 사항을 커밋·푸시합니다.
