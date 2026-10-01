import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BackToProjectLink } from '../components/BackToProjectLink';
import { projects } from '../data/projects';
import '../styles/proposal.css';

// Sulwhasoo proposal ("기획서") page -- Figma frame 257:589. Every slide is authored on its
// original 1920px-wide canvas and scaled to the viewport width (see `--ps` below), so the
// Figma coordinates are used as they are.

const A = '/assets/sulwhasoo-proposal/';
const SLIDE_WIDTH = 1920;
const CREAM = '#fcf7e9';
const CREAM_LIGHT = '#fffdf2';

type Place = { l?: number; t?: number; w?: number; h?: number };
const place = ({ l, t, w, h }: Place): CSSProperties => ({ left: l, top: t, width: w, height: h });

function Lines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {line}
          {index < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

function Slide({ children, height = 1080, background = CREAM, label }: { children: ReactNode; height?: number; background?: string; label?: string }) {
  return (
    <section className="pslide" style={{ aspectRatio: `${SLIDE_WIDTH} / ${height}`, background }} aria-label={label}>
      <div className="pslide__canvas" style={{ height }}>{children}</div>
    </section>
  );
}

/** Blurred flower photo laid on its side with a fade at the bottom edge of the unrotated image. */
function FlowerBackdrop({ l, t, w, h, opacity, fade }: Place & { opacity: number; fade: string }) {
  return (
    <div className="pabs pcenter" style={place({ l, t, w, h })} aria-hidden="true">
      <div className="pbackdrop" style={{ width: h, height: w }}>
        <img className="pfill" src={`${A}bg-flower.png`} alt="" style={{ opacity }} />
        <div className="pfill" style={{ background: `linear-gradient(to top, rgb(${fade}) 0%, rgba(${fade}, 0) 32.212%)` }} />
      </div>
    </div>
  );
}

/** Orange marker stroke behind a highlighted word of a title. */
function Marker({ l, t, w, from = '#ff8f40', stop = 57.212, to = '#fcf8e9', end = 88.942 }: Place & { from?: string; stop?: number; to?: string; end?: number }) {
  return <div className="pabs pmarker" style={{ ...place({ l, t, w, h: 24 }), background: `linear-gradient(to right, ${from} ${stop}%, ${to} ${end}%)` }} aria-hidden="true" />;
}

function SlideHeading({ l, t, w, marker, title, children, titleSize = 40, titleLine = 1.1, gap = 30 }: {
  l: number; t: number; w: number; marker: Place; title: ReactNode; children: ReactNode; titleSize?: number; titleLine?: number; gap?: number;
}) {
  return (
    <>
      <Marker {...marker} />
      <div className="pabs pheading" style={{ left: l, top: t, width: w, gap }}>
        <h2 className="ptitle" style={{ fontSize: titleSize, lineHeight: titleLine, whiteSpace: 'nowrap' }}>{title}</h2>
        <p className="pbody">{children}</p>
      </div>
    </>
  );
}

function RuleList({ l, t, items }: { l: number; t: number; items: string[] }) {
  return (
    <ul className="prules" style={{ left: l, top: t }}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function Persona({ l, name, age, job, trait, photo, photoCrop, painPoints, needs }: {
  l: number; name: string; age: string; job: string; trait: string; photo: string; photoCrop?: CSSProperties; painPoints: string[]; needs: string[];
}) {
  return (
    <div className="pabs ppersona" style={{ left: l, top: 349 }}>
      <div className="ppersona__head">
        <div className="ppersona__fade" />
        <div className="ppersona__info">
          <div className="ppersona__name"><b>{name}</b><span>{age}</span></div>
          <dl>
            <div><dt>직업</dt><dd>{job}</dd></div>
            <div><dt>특징</dt><dd>{trait}</dd></div>
          </dl>
        </div>
        <div className="ppersona__photo"><img src={`${A}${photo}`} alt="" style={photoCrop} /></div>
      </div>
      <div className="ppersona__list">
        <h3>Pain Points</h3>
        <ul>{painPoints.map((text) => <li key={text}>{text}</li>)}</ul>
      </div>
      <div className="ppersona__list ppersona__list--needs">
        <h3>Needs</h3>
        <ul>{needs.map((text) => <li key={text}>{text}</li>)}</ul>
      </div>
    </div>
  );
}

/** Competitor-analysis cell text; `lines` keep the line breaks of the Figma text. */
function Cell({ l, t, lines, size = 12 }: { l: number; t: number; lines: string[]; size?: number }) {
  return <p className="pcell" style={{ left: l, top: t, fontSize: size }}><Lines lines={lines} /></p>;
}

const LOGO_TINT = 'rgba(247, 141, 48, 0.2)';

function LogoShiseido({ l, t }: { l: number; t: number }) {
  return (
    <div className="pabs plogo" style={{ ...place({ l, t, w: 130, h: 50 }), background: LOGO_TINT, borderRadius: 10 }}>
      <img src={`${A}logo-shiseido.png`} alt="시세이도" style={{ width: 99.373, height: 18.136 }} />
    </div>
  );
}

function LogoPhoto({ l, t, w, h, src, alt, radius }: Place & { src: string; alt: string; radius: number }) {
  return (
    <div className="pabs plogo plogo--photo" style={{ ...place({ l, t, w, h }), borderRadius: radius }}>
      <img className="pfill" src={`${A}${src}`} alt={alt} />
      <div className="pfill" style={{ background: LOGO_TINT }} />
    </div>
  );
}

function Pain({ l, t, w, h, tone, text }: { l: number; t: number; w: number; h: number; tone: [string, string]; text: string }) {
  return (
    <div className="pabs ppain" style={{ ...place({ l, t, w, h }), background: tone[0], color: tone[1] }}>
      <span>{text}</span>
    </div>
  );
}

const PAIN_TONES = {
  peach: ['#ffe4ba', '#e77631'],
  apricot: ['#ffca96', '#d15e34'],
  butter: ['#ffeec1', '#e0954a'],
  honey: ['#ffd797', '#ce8033'],
} as const satisfies Record<string, [string, string]>;

function Swatch({ name, rgba, hsla, hex, color }: { name: string; rgba: string; hsla: string; hex: string; color: string }) {
  return (
    <div className="pswatch">
      <i style={{ background: color }} />
      <b>{name}</b>
      <span>{rgba}</span>
      <span>{hsla}</span>
      <span>{hex}</span>
    </div>
  );
}

/** One screenshot of the earlier designs, optionally cropped by an overflow-hidden frame. */
function Shot({ l, t, w, h, src, style, background, crop }: Place & { src: string; style?: CSSProperties; background?: string; crop?: CSSProperties }) {
  return (
    <div className="pabs pshot" style={{ ...place({ l, t, w, h }), background, ...style }}>
      <img className={crop ? undefined : 'pfill'} src={`${A}${src}`} alt="" style={crop} />
    </div>
  );
}

/** Rotated page screenshot of the brand-story slide: an outer box that holds the rotated image. */
function Tilted({ l, t, w, h, innerW, innerH, src, imgStyle }: Place & { innerW: number; innerH: number; src: string; imgStyle?: CSSProperties }) {
  return (
    <div className="pabs pcenter" style={place({ l, t, w, h })}>
      <div className="ptilt" style={{ width: innerW, height: innerH }}>
        <img className={imgStyle ? undefined : 'pfill'} src={`${A}${src}`} alt="" style={imgStyle} />
      </div>
    </div>
  );
}

const STORY_SHOTS: { src: string; w: number; h: number; innerH: number }[] = [
  { src: 'story-1.png', w: 494.63, h: 369.817, innerH: 222.045 },
  { src: 'story-2.png', w: 494.373, h: 369.167, innerH: 221.346 },
  { src: 'story-3.png', w: 494.287, h: 368.95, innerH: 221.112 },
  { src: 'story-4.png', w: 504.753, h: 395.412, innerH: 249.57 },
  { src: 'story-5.png', w: 717.942, h: 934.414, innerH: 829.2 },
  { src: 'story-6.png', w: 759.031, h: 1038.299, innerH: 940.916 },
];

// [story shot index, left, top] of the shots that reach into the slide, in Figma stacking order.
const STORY_PLACEMENT: [number, number, number][] = [
  [0, 525.84, 349.07],
  [1, 607.51, 143.24],
  [2, 688.92, -62.38],
  [3, 434.05, 555.55],
  [4, 129.07, 787.62],
  [4, 1013.07, -213],
  [5, 667, 558.08],
  [4, 1698.07, -720],
  [5, 1352, 51.08],
];

const sulwhasooProject = projects.find((project) => project.id === 'sulwhasoo');

export function SulwhasooProposalPage() {
  const pageRef = useRef<HTMLElement>(null);
  const [atBottom, setAtBottom] = useState(false);

  // Scale the 1920px slide canvas to the page width (the scrollbar is excluded).
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const update = () => page.style.setProperty('--ps', String(page.clientWidth / SLIDE_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);

  // Slides after the cover fade up the first time they scroll into view.
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const slides = page.querySelectorAll<HTMLElement>('.pslide');
    const reveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-seen');
        reveal.unobserve(entry.target);
      });
    }, { root: page, threshold: 0.12 });
    slides.forEach((slide) => reveal.observe(slide));
    page.classList.add('is-ready');
    return () => reveal.disconnect();
  }, []);

  // The "back to top" button shows once the page is scrolled to its end.
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const update = () => setAtBottom(page.scrollTop + page.clientHeight >= page.scrollHeight - 120);
    update();
    page.addEventListener('scroll', update, { passive: true });
    return () => page.removeEventListener('scroll', update);
  }, []);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pageRef.current?.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    // The fixed back-to-top button is a sibling of the animated scroller, not a child: an
    // animated transform/filter on an ancestor would make that ancestor its containing block.
    <>
    <button className={`proposal-top${atBottom ? ' is-visible' : ''}`} type="button" onClick={scrollToTop} aria-label="맨 위로 올라가기" tabIndex={atBottom ? 0 : -1}>
      <img src="/assets/arrow-back.svg" alt="" aria-hidden="true" />
    </button>
    <main ref={pageRef} className="proposal-page">
      <div className="proposal-back"><BackToProjectLink /></div>

      {/* 1 -- cover */}
      <Slide label="표지">
        <FlowerBackdrop l={485} t={0} w={1965} h={1105} opacity={0.67} fade="252, 247, 233" />
        <div className="pabs ptags">
          <span>2026 PORTFOLIO</span>
          <span>WEB DESIGN</span>
        </div>
        <h1 className="pabs pcover-title">SULWHASOO</h1>
        <p className="pabs pcover-sub">Brand Redesign Proposal</p>
        <p className="pabs pcover-desc">
          사용자가 설화수만의 이야기와 가치를 자연스럽게 경험하도록<br />
          브랜드 스토리 중심의 웹 경험으로 재구성했습니다.
        </p>
        <dl className="pabs pinfo">
          <div style={{ paddingRight: 33 }}><dt>제작기간</dt><dd>2026.05.21 - 2026.08.12</dd></div>
          <div style={{ paddingRight: 8 }}><dt>사용 툴</dt><dd>Figma / Photoshop / Claude</dd></div>
        </dl>
      </Slide>

      {/* 2 -- strengths and weaknesses */}
      <Slide label="설화수의 장단점">
        <div className="pabs" style={place({ l: 1230, t: 0, w: 690, h: 1080 })} aria-hidden="true">
          <img className="pfill" src={`${A}flower-photo.png`} alt="" style={{ opacity: 0.1 }} />
          <div className="pfill" style={{ background: 'linear-gradient(90deg, #fcf7e9 0%, rgba(252, 247, 233, 0) 27.014%, rgba(252, 247, 233, 0) 70.673%, #fcf7e9 100%)' }} />
        </div>
        <RuleList l={1105} t={570} items={['체험 홍보 미흡', '제품 라인의 정체성 모호', '브랜드 문화 콘텐츠 전달력 부족', '브랜드 스토리텔링 연결성 부족']} />
        <div className="pabs pmarker" style={{ ...place({ l: 370, t: 537, w: 521, h: 26 }), background: 'linear-gradient(to right, #ff8f40 52.885%, rgba(255, 143, 64, 0) 89.423%)' }} aria-hidden="true" />
        <div className="pabs pmarker" style={{ ...place({ l: 1105, t: 540, w: 521, h: 26 }), background: 'linear-gradient(to right, #c5ac95 53%, rgba(197, 172, 149, 0) 89%)' }} aria-hidden="true" />
        <RuleList l={370} t={570} items={['한국 대표 럭셔리 뷰티 브랜드', '한국 전통 한방 원료 기반 제품', '아티스트 협업을 통한 전통문화 표현', '동양적 미학과 독자적 브랜드 정체성']} />
        <Marker l={1053} t={173} w={133} />
        <h3 className="pabs ptitle pcolumn-title" style={{ left: 396, top: 518 }}>장점</h3>
        <h3 className="pabs ptitle pcolumn-title" style={{ left: 1131, top: 521 }}>단점</h3>
        <div className="pabs pheading" style={{ left: 605, top: 144, width: 711, gap: 30 }}>
          <h2 className="ptitle" style={{ fontSize: 40, lineHeight: 1.5 }}>설화수에서 찾아낸 장단점.</h2>
          <p className="pbody">
            <Lines lines={[
              '오랜 시간 브랜드 고유의 색을 지켜온 설화수에서,',
              '저희는 다양한 예술 활동을 통해 만들어 온 전통문화라는 설화수만의 강점을 발견했습니다.',
              '긴 역사만큼 쌓인 풍부한 콘텐츠들이 사용자에게',
              '충분히 전달되지 못하고 있다는 점도 함께 확인할 수 있었습니다.',
            ]} />
          </p>
        </div>
      </Slide>

      {/* 3 -- competitor analysis */}
      <Slide label="경쟁사 분석">
        <div className="pabs" style={{ ...place({ l: 1230, t: 0, w: 690, h: 1080 }), transform: 'scaleY(-1)' }} aria-hidden="true">
          <img className="pfill" src={`${A}flower-photo.png`} alt="" style={{ opacity: 0.1 }} />
          <div className="pfill" style={{ background: 'linear-gradient(0deg, rgba(252, 247, 233, 0) 46.351%, #fcf7e9 100%), linear-gradient(90deg, #fcf7e9 0%, rgba(252, 247, 233, 0) 27.014%, rgba(252, 247, 233, 0) 70.673%, #fcf7e9 100%)' }} />
        </div>
        <SlideHeading l={572} t={109} w={775.5} marker={{ l: 1241, t: 126, w: 133 }} title="설화수만의 브랜드 스토리와 사용자 경험의 차별화">
          <Lines lines={[
            '설화수 웹사이트 리디자인은 풍부한 브랜드 콘텐츠가 사용자에게 충분히 전달되지 못하는 문제를 해결하기 위해 스토리 중심의 구조와 직관적인 제품 탐색 경험을 제안합니다.',
            '이를 통해 사용자가 설화수만의 가치를 자연스럽게 이해하고 경험할 수 있도록 돕습니다.',
          ]} />
        </SlideHeading>

        <div className="pabs pcard" style={place({ l: 180, t: 411, w: 668, h: 560 })}>
          <LogoPhoto l={506} t={42} w={91} h={50} src="logo-tamburins.png" alt="탬버린즈" radius={12} />
          <LogoPhoto l={341} t={42} w={50} h={50} src="logo-sulwhasoo.png" alt="설화수" radius={9} />
          {[122, 224, 319, 427].map((top) => <i key={top} className="pline" style={{ left: 27, top, width: 604, height: 1 }} />)}
          <i className="pline" style={{ left: 113, top: 19, width: 1, height: 510 }} />
          <i className="pline" style={{ left: 273, top: 19, width: 1, height: 520 }} />
          <i className="pline" style={{ left: 459, top: 32, width: 1, height: 507 }} />
          <Cell l={48} t={165} lines={['타겟']} size={12.174} />
          <Cell l={146} t={149} lines={['30~50대의 여성.', '해외 매출의 비중이', '70%이상을 차지.']} />
          <Cell l={494} t={157} lines={['20~30대의', '감성을 중시하는 사람들']} />
          <Cell l={325} t={165} lines={['40대~50대 여성']} />
          <Cell l={35} t={262} lines={['제품 탐색']} size={12.174} />
          <Cell l={138} t={246} lines={['스킨케어가 주력', '피부고민별 카테고리가', '눈에 띔']} />
          <Cell l={481} t={254} lines={['상품 자체의 라인업을', '미리 사진으로 보여주는 구성']} />
          <Cell l={291} t={254} lines={['유형별, 라인별, 럭셔리, 고민별', '필터 영역을 잘 나눠있음']} />
          <Cell l={31} t={367} lines={['상세페이지']} size={12.174} />
          <Cell l={126} t={343} lines={['노화,주름,건조 등 화장품의', '기능에 대해 설명 제품 사용', '방법 영상, 텍스트를 통해 설', '명하고 있음']} />
          <Cell l={505} t={359} lines={['화이트톤의 깔끔함', '보여줄 것만 보여줌']} />
          <Cell l={303} t={359} lines={['비포 & 애프터와 독보적', '효능 각인']} />
          <Cell l={39} t={476} lines={['차별점']} size={12.174} />
          <Cell l={130} t={460} lines={['전통보다는 현대적 해석을', '강조한 미를 추구함으로서', '타겟층을 넓히고 있다.']} />
          <Cell l={481} t={460} lines={['제품 본연의 기능보다는', '매장이나 홈페이지의 감각적인', '분위기로 제품을 설명함']} />
          <Cell l={310} t={468} lines={['주황색 vs 스킨톤 골드', '예술 작품 vs 궁중 문양']} />
          <LogoShiseido l={128} t={42} />
        </div>

        <div className="pabs pcard" style={place({ l: 1006, t: 415, w: 720, h: 547 })}>
          <p className="paxis" style={{ left: 71.5, top: 264 }}>만족도가 낮음</p>
          <p className="paxis" style={{ left: 363.5, top: 25 }}>브랜드 인지도가 높음</p>
          <p className="paxis" style={{ left: 648.5, top: 264 }}>만족도가 높음</p>
          <p className="paxis" style={{ left: 363.5, top: 498 }}>브랜드 인지도가 낮음</p>
          <i className="pline" style={{ left: 148, top: 275, width: 424, height: 1.82 }} />
          <i className="pline" style={{ left: 362, top: 79, width: 1.63, height: 394 }} />
          <LogoShiseido l={434} t={112} />
          <LogoPhoto l={318} t={180} w={91} h={50} src="logo-tamburins.png" alt="탬버린즈" radius={12} />
          <LogoPhoto l={381} t={328} w={50} h={50} src="logo-sulwhasoo.png" alt="설화수" radius={9} />
        </div>
      </Slide>

      {/* 4 -- problem statement */}
      <Slide label="문제 정의">
        <Pain l={91} t={68} w={336} h={78} tone={PAIN_TONES.peach} text="제품 간 비교 정보 부족" />
        <Pain l={334} t={254} w={375} h={78} tone={PAIN_TONES.peach} text="원료 및 효능 정보 전달 부족" />
        <Pain l={820} t={51} w={348} h={78} tone={PAIN_TONES.peach} text="고객 리뷰 확인의 어려움" />
        <Pain l={55} t={402} w={313} h={78} tone={PAIN_TONES.apricot} text="제품 체험 기회 부족" />
        <Pain l={119} t={657} w={387} h={78} tone={PAIN_TONES.apricot} text="설화수 문화 콘텐츠 전달 부족" />
        <Pain l={535} t={886} w={348} h={78} tone={PAIN_TONES.apricot} text="브랜드 스토리 전달 부족" />
        <Pain l={994} t={215} w={348} h={85} tone={PAIN_TONES.butter} text="브랜드 사이트 흥미 저하" />
        <Pain l={1435} t={114} w={365} h={85} tone={PAIN_TONES.butter} text="제품별 특징 구분의 어려움" />
        <Pain l={1435} t={334} w={422} h={85} tone={PAIN_TONES.butter} text="베스트셀러 중심의 낮은 제품 노출" />
        <Pain l={1407} t={886} w={336} h={85} tone={PAIN_TONES.honey} text="젊은 층 공감 요소 부족" />
        <Pain l={1130} t={753} w={365} h={85} tone={PAIN_TONES.honey} text="사이트 분위기의 중심 부재" />
        <Pain l={1575} t={560} w={269} h={85} tone={PAIN_TONES.honey} text="어수선한 구성" />
        <div className="pabs" style={{ ...place({ l: 0, t: 0, w: 1920, h: 1080 }), background: CREAM, opacity: 0.58 }} aria-hidden="true" />
        <Marker l={935} t={487} w={401} from="#ff8f40" stop={75.481} to="#fcf8e9" end={100} />
        <div className="pabs pheading" style={{ left: 600, top: 397.5, width: 721, gap: 30 }}>
          <h2 className="ptitle" style={{ fontSize: 40, lineHeight: 1.5 }}>
            좋은 제품을 넘어,<br />
            <span className="paccent">설화수</span>만의 이야기를 전달하는 방법은 없을까?
          </h2>
          <p className="pbody">
            <Lines lines={[
              '설화수는 한국적 미학과 한방 원료를 기반으로 독자적인 브랜드 가치를 가지고 있지만,',
              '사용자들은 웹사이트에서 제품의 특징과 효능, 리뷰 등의 정보를 충분히 확인하기 어렵다고 느끼고 있었습니다.',
              '설화수만의 브랜드 스토리와 다양한 문화·체험 활동 또한 충분히 드러나지 않는다는 의견이 있었습니다.',
              '이에 제품 정보와 실제 사용자 경험을 보다 명확하게 전달하고,',
              '설화수의 전통성과 브랜드 이야기를 함께 경험할 수 있는 웹사이트를 제안합니다.',
            ]} />
          </p>
        </div>
      </Slide>

      {/* 5 -- target personas */}
      <Slide label="목표 타겟">
        <Marker l={365} t={117} w={124} from="#ff8f40" stop={75.481} to="#fcf8e9" end={100} />
        <div className="pabs pheading pheading--left" style={{ left: 141, top: 99, width: 721, gap: 30 }}>
          <h2 className="ptitle" style={{ fontSize: 40, lineHeight: 1.1 }}>설화수의 목표 타겟은 무엇일까요?</h2>
          <p className="pbody">설문조사를 바탕으로 타겟층이 기존 사이트를 탐방하며 그 과정에서 겪는 불편함과 사용자가 바라는 필요성을 구체적으로 파악하고 문제 해결을 위한 핵심을 도출할 수 있도록 하였습니다.</p>
        </div>
        <p className="pabs psurvey-note">7월 18일부터 7월 24일까지 17명을 대상으로 설문을 진행했습니다.</p>
        <Persona
          l={148}
          name="클로이 베넷"
          age="30대중반"
          job="파트타임 직원"
          trait="고객 리뷰를 중점으로 생각하는 페르소나."
          photo="persona-chloe.png"
          photoCrop={{ position: 'absolute', height: '95.4%', left: '-2.3%', top: '4.6%', width: '102.3%', maxWidth: 'none' }}
          painPoints={['제품 설명이 어렵거나 추상적이면 자신에게 필요한 제품인지 판단하기 어렵다.', '브랜드가 제공하는 정보만으로는 실제 사용 효과를 신뢰하기 어렵다.', '광고성 후기와 실제 사용자 리뷰를 구분하기 어렵다.']}
          needs={['제품의 주요 효능과 사용 후 기대할 수 있는 변화를 쉽게 이해하고 싶다.', '피부 타입과 고민이 비슷한 사용자의 신뢰도 높은 리뷰를 확인하고 싶다.', '여러 제품의 특징과 평가를 한눈에 비교해 자신에게 적합한 제품을 선택하고 싶다.']}
        />
        <Persona
          l={1127}
          name="에밀리 카터"
          age="20대중반"
          job="프리랜서"
          trait="한방 화장품에 대해 평소에 관심이 많은 페르소나."
          photo="persona-emily.png"
          painPoints={['브랜드 철학과 스토리가 어렵거나 여러 페이지에 흩어져 있어 이해하기 어렵다.', '제품 정보에 비해 전시나 팝업스토어 같은 체험 콘텐츠를 발견하기 어렵다.', '관심 있는 행사 정보를 찾더라도 일정, 장소, 예약 방법을 한눈에 확인하기 어렵다.']}
          needs={['설화수의 철학과 한국적인 아름다움을 감각적인 콘텐츠로 쉽게 이해하고 싶다.', '전시, 팝업스토어, 체험 프로그램 정보를 한곳에서 확인하고 간편하게 참여하고 싶다.', '브랜드의 문화·사회공헌 활동을 깊이 있게 경험하고 공유할 수 있는 콘텐츠가 필요하다.']}
        />
      </Slide>

      {/* 6 -- color, icon and typography */}
      <Slide label="컬러·아이콘·타이포">
        <Marker l={1007} t={90} w={259} from="#ff8f40" stop={75.481} to="#fcf8e9" end={100} />
        <div className="pabs pheading" style={{ left: 584, top: 70, width: 752, gap: 30 }}>
          <h2 className="ptitle" style={{ fontSize: 40, lineHeight: 1.1, width: 678 }}>인삼 한방과 고급스러운 설화수만의 컬러를 뽑아 사용했어요</h2>
          <p className="pbody" style={{ width: 726 }}>설문조사를 바탕으로 타겟층이 기존 사이트를 탐방하며 그 과정에서 겪는 불편함과 사용자가 바라는 필요성을 구체적으로 파악하고 문제 해결을 위한 핵심을 도출할 수 있도록 하였습니다.</p>
        </div>
        <div className="pabs pguide">
          <div className="pguide__row">
            <h3>COLOR</h3>
            <div className="pguide__swatches">
              <Swatch name="orange_normal" rgba="rgba(244,115,33,1)" hsla="hsla(23,91,54,1)" hex="#F47321" color="#f47321" />
              <Swatch name="orange_gray" rgba="rgba(151,143,128,1)" hsla="hsla(39,10,55,1)" hex="#978F80" color="#978f80" />
              <Swatch name="yellow_light" rgba="rgba(251,239,210,1)" hsla="hsla(42,84,90,1)" hex="#FBEFD2" color="#fbefd2" />
              <Swatch name="brown_gray" rgba="rgba(209,192,181,1)" hsla="hsla(24,23,76,1)" hex="#D1C0B5" color="#d1c0b5" />
              <Swatch name="brown_light" rgba="rgba(222,171,117,1)" hsla="hsla(31,61,66,1)" hex="#DEAB75" color="#deab75" />
            </div>
          </div>
          <div className="pguide__row pguide__row--icon">
            <h3>ICON</h3>
            <div className="pguide__icons">
              <span className="pguide__fb"><img src={`${A}icon-facebook.svg`} alt="Facebook" /></span>
              <img src={`${A}icon-instagram.svg`} alt="Instagram" style={{ width: 65, height: 64 }} />
              <img src={`${A}icon-youtube.svg`} alt="YouTube" style={{ width: 64, height: 63 }} />
            </div>
          </div>
          <div className="pguide__row pguide__row--typo">
            <h3>TYPO</h3>
            <div className="pguide__type">
              <div className="pguide__font pguide__font--sans">
                <b>Open Sans</b>
                <div><span style={{ fontSize: 80 }}>80pt</span><span style={{ fontSize: 42 }}>42pt</span><span style={{ fontSize: 30 }}>30pt</span><span style={{ fontSize: 16 }}>16pt</span></div>
              </div>
              <div className="pguide__font pguide__font--serif">
                <b>Cormorant Garamond</b>
                <div><span className="pguide__big">250px</span><span className="pguide__small">40px</span></div>
              </div>
            </div>
          </div>
        </div>
      </Slide>

      {/* 7 -- previous designs */}
      <Slide label="이전 디자인">
        <div className="pabs pheading" style={{ left: 584, top: 70, width: 752, gap: 30 }}>
          <h2 className="ptitle" style={{ fontSize: 40, lineHeight: 1.1, width: 678 }}>이전 디자인은 이런식으로 작업 되었어요</h2>
          <p className="pbody" style={{ width: 648 }}>브랜드 스토리라는 주제에 제대로 잡히지 않았고 피드백을 통하여 기존 디자인에서 2차 디자인까지 발전할 수 있었어요</p>
        </div>
        <p className="pabs pversion" style={{ left: 112, top: 346 }}>1차</p>
        <p className="pabs pversion" style={{ left: 1058, top: 346 }}>2차</p>
        <div className="pabs" style={{ ...place({ l: 112, t: 407, w: 635, h: 921 }), opacity: 0.7 }}>
          <Shot l={312} t={0} w={207} h={921} src="v1-flagship.png" background="#ede5d5" crop={{ position: 'absolute', height: '100%', left: '-6.28%', top: 0, width: '106.28%', maxWidth: 'none' }} />
          <Shot l={197} t={2} w={115} h={919} src="v1-about.png" />
          <Shot l={0} t={0} w={197} h={449} src="v1-main.png" background="#fff" />
          <Shot l={520} t={1} w={115} h={722} src="v1-detail.png" />
        </div>
        <div className="pabs" style={{ ...place({ l: 1058, t: 407, w: 736, h: 655 }), opacity: 0.7 }}>
          <Shot l={0} t={0} w={145} h={655} src="v2-flagship.png" />
          <Shot l={145} t={0} w={307} h={455} src="v2-about.png" />
          <Shot l={561} t={0} w={114} h={655} src="v2-product.png" />
          <Shot l={674} t={2} w={62} h={653} src="v2-main.png" crop={{ position: 'absolute', height: '100%', left: 0, top: 0, width: '254.15%', maxWidth: 'none' }} />
          <Shot l={452} t={0} w={109} h={655} src="v2-detail.png" />
        </div>
      </Slide>

      {/* 8 -- main page */}
      <Slide label="메인페이지">
        <FlowerBackdrop l={-1} t={0} w={1922} h={1081} opacity={0.34} fade="247, 241, 231" />
        <h2 className="pabs ppage-title" style={{ left: 70, top: 125 }}>메인페이지</h2>
        <Shot l={620} t={261} w={1139} h={641} src="main-page.png" />
        <div className="pabs pcaption" style={{ left: 70, top: 881, width: 873 }}>
          <b>Ingredient Storytelling</b>
          <p>대표 제품 주변에 설화수의 주요 원료를 배치하여 제품과 성분의 관계를 자연스럽게 연결하고, 사용자가 브랜드의 핵심 가치를 직관적으로 이해할 수 있도록 구성하였습니다.</p>
        </div>
      </Slide>

      {/* 9 -- brand story / culture */}
      <Slide label="브랜드 스토리" background={CREAM_LIGHT}>
        <FlowerBackdrop l={-1} t={0} w={1922} h={1081} opacity={0.34} fade="247, 241, 231" />
        <div className="pabs pcaption" style={{ left: 178, top: 702, width: 650 }}>
          <b>Immersive Brand Storytelling</b>
          <p><Lines lines={['설화수의 브랜드 철학과 스토리를 몰입감 있는 콘텐츠로 전달하여', '브랜드만의 차별화된 가치를 경험할 수 있도록 하였습니다.']} /></p>
        </div>
        <div className="pabs pcaption" style={{ left: 477, top: 939, width: 702 }}>
          <b>Where Art Meets Heritage</b>
          <p>전통 공예부터 현대 예술까지 다양한 아티스트와의 협업을 통해 설화수만의 문화적 정체성을 경험할 수 있도록 구성하였습니다.</p>
        </div>
        <Shot l={178} t={125} w={954} h={536} src="shot-1.png" />
        <Shot l={1196} t={125} w={608} h={341} src="shot-2.png" />
        <Shot l={1196} t={327} w={608} h={341} src="shot-3.png" />
        <Shot l={1196} t={568} w={608} h={342} src="shot-4.png" />
        <Shot l={1196} t={768} w={608} h={342} src="shot-5.png" />
        <Shot l={1196} t={964} w={608} h={342} src="shot-6.png" />
      </Slide>

      {/* 10 -- flagship */}
      <Slide label="플래그십 경험" background={CREAM_LIGHT}>
        <FlowerBackdrop l={-3} t={-2} w={1926} h={1083} opacity={0.34} fade="247, 241, 231" />
        <Shot l={1196} t={-108} w={608} h={342} src="shot-6.png" />
        <Shot l={1196} t={128} w={608} h={341} src="shot-7.png" />
        <Shot l={1196} t={469} w={608} h={341} src="shot-8.png" />
        <Shot l={167} t={128} w={954} h={475} src="flagship-main.png" />
        <div className="pabs pcaption" style={{ left: 167, top: 658, width: 914 }}>
          <b>Flagship Experience</b>
          <p style={{ width: 921 }}>설화수의 브랜드 철학을 오프라인 공간에서도 경험할 수 있도록 플래그십 스토어를 소개하고, 방문으로 이어질 수 있는 콘텐츠를 구성하였습니다.</p>
        </div>
      </Slide>

      {/* 11 -- product page */}
      <Slide label="제품페이지" background={CREAM_LIGHT}>
        <FlowerBackdrop l={-3} t={-2} w={1926} h={1083} opacity={0.34} fade="247, 241, 231" />
        <h2 className="pabs ppage-title" style={{ left: 70, top: 125 }}>제품페이지</h2>
        <Shot l={892} t={200} w={804} h={764} src="product-page.png" />
        <div className="pabs pcaption" style={{ left: 132, top: 305 }}>
          <b>Curated Product Collection</b>
          <p style={{ whiteSpace: 'nowrap' }}>베스트 셀러와 라인별 제품들을 한 눈에 볼 수 있도록 디자인 하였습니다.</p>
        </div>
      </Slide>

      {/* 12 -- flagship store page */}
      <Slide label="플래그쉽 스토어" background={CREAM_LIGHT}>
        <FlowerBackdrop l={-3} t={-2} w={1926} h={1083} opacity={0.34} fade="247, 241, 231" />
        <Tilted l={-442} t={-55} w={1782.62} h={3339.294} innerW={589} innerH={3358} src="store-pages.png" />
        <div className="pabs pcenter" style={place({ l: 903, t: -152, w: 1136.207, h: 1704.702 })}>
          <div className="ptilt" style={{ width: 589, height: 1600.234, overflow: 'hidden' }}>
            <img src={`${A}store-pages.png`} alt="" style={{ position: 'absolute', height: '209.97%', left: 0, top: '-109.91%', width: '100%', maxWidth: 'none' }} />
          </div>
        </div>
        <h2 className="pabs ppage-title" style={{ left: 70, top: 125 }}>플래그쉽 스토어</h2>
        <div className="pabs pcaption" style={{ left: 70, top: 303 }}>
          <b>Flagship Experience</b>
          <p style={{ width: 524 }}>설화수의 브랜드 철학과 전통미를 공간에서 경험할 수 있도록 북촌 플래그십 스토어의 이야기와 공간 정보를 담았습니다.</p>
        </div>
      </Slide>

      {/* 13 -- brand story page */}
      <Slide label="브랜드스토리페이지" background={CREAM_LIGHT}>
        <FlowerBackdrop l={-3} t={-2} w={1926} h={1083} opacity={0.34} fade="247, 241, 231" />
        {STORY_PLACEMENT.map(([shot, left, top], index) => {
          const { src, w, h, innerH } = STORY_SHOTS[shot];
          return <Tilted key={index} l={left} t={top} w={w} h={h} innerW={444.09} innerH={innerH} src={src} />;
        })}
        <h2 className="pabs ppage-title" style={{ left: 70, top: 125 }}>브랜드스토리페이지</h2>
        <div className="pabs pcaption" style={{ left: 70, top: 303 }}>
          <b>Heritage Storytelling</b>
          <p style={{ width: 524 }}>설화수가 가진 브랜드의 가치와 이야기를 사용자에게 정리하여 풀어내는 디자인을 작업했습니다.</p>
        </div>
      </Slide>

      {/* closing -- back to the live project */}
      <Slide label="프로젝트 보러가기" height={440} background={CREAM_LIGHT}>
        <div className="pabs pcta">
          <p className="pcta__eyebrow">SULWHASOO</p>
          <h2 className="ptitle">설화수 리디자인 보러가기</h2>
          {sulwhasooProject?.externalUrl && (
            <a className="pcta__button" href={sulwhasooProject.externalUrl} target="_blank" rel="noopener noreferrer">
              CLICK!
            </a>
          )}
        </div>
      </Slide>
    </main>
    </>
  );
}
