import { useState } from 'react';
import { DeskSetupScene } from '../components/DeskSetupScene';

const DEFAULT_LIGHT: [number, number, number] = [-4.0, 6.0, 5.5];

// Throwaway tool: lets you preview the desk scene at different brightness/color/shadow/camera
// settings and pick numbers to report back. Not linked from anywhere in the real app -- open
// #/lab directly, delete this file (and its App.tsx hookup) once you've settled on values.
export function DeskBrightnessLab() {
  const [brightness, setBrightness] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [hue, setHue] = useState(0);
  const [shadowsOn, setShadowsOn] = useState(false);
  const [shadowFloorOn, setShadowFloorOn] = useState(false);
  const [hideBakedAO, setHideBakedAO] = useState(false);
  const [lightX, setLightX] = useState(DEFAULT_LIGHT[0]);
  const [lightY, setLightY] = useState(DEFAULT_LIGHT[1]);
  const [lightZ, setLightZ] = useState(DEFAULT_LIGHT[2]);
  const [orbitOn, setOrbitOn] = useState(false);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [deskColor, setDeskColor] = useState('#ffffff');

  const resetAll = () => {
    setBrightness(100);
    setSaturate(100);
    setHue(0);
    setShadowsOn(false);
    setShadowFloorOn(false);
    setHideBakedAO(false);
    setLightX(DEFAULT_LIGHT[0]);
    setLightY(DEFAULT_LIGHT[1]);
    setLightZ(DEFAULT_LIGHT[2]);
    setOrbitOn(false);
    setShadowColor('#000000');
    setDeskColor('#ffffff');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(180deg, #ffffff 0.25%, #fbeee6 52.9%, #ede4e7 103.5%)',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: 'sans-serif',
      }}
    >
      <style>{'.lab-desk-stage { width: 100%; height: 100%; }'}</style>

      <div
        style={{
          flex: '0 0 240px',
          height: '100%',
          overflowY: 'auto',
          background: 'rgba(255,255,255,.92)',
          padding: '16px 18px',
          boxSizing: 'border-box',
          boxShadow: '2px 0 12px rgba(0,0,0,.1)',
        }}
      >
        <div style={{ marginBottom: 6, fontSize: 15, fontWeight: 600 }}>책상 명도: {brightness}%</div>
        <input
          type="range"
          min={40}
          max={160}
          value={brightness}
          onChange={(event) => setBrightness(Number(event.target.value))}
          style={{ width: '100%' }}
        />

        <div style={{ marginTop: 16, marginBottom: 6, fontSize: 15, fontWeight: 600 }}>책상 채도: {saturate}%</div>
        <input
          type="range"
          min={0}
          max={200}
          value={saturate}
          onChange={(event) => setSaturate(Number(event.target.value))}
          style={{ width: '100%' }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          책상 컬러 (색조+명도, 팔레트)
          <input
            type="color"
            value={deskColor}
            onChange={(event) => setDeskColor(event.target.value)}
            style={{ width: 36, height: 24, padding: 0, border: 'none', cursor: 'pointer' }}
          />
        </label>

        <div style={{ marginTop: 16, marginBottom: 6, fontSize: 15, fontWeight: 600 }}>책상 색조 회전: {hue}deg</div>
        <input
          type="range"
          min={-180}
          max={180}
          value={hue}
          onChange={(event) => setHue(Number(event.target.value))}
          style={{ width: '100%' }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={shadowsOn}
            onChange={(event) => setShadowsOn(event.target.checked)}
          />
          실시간 그림자 (모니터/키보드/태블릿/서랍이 움직일 때 그림자도 같이 움직임)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={shadowFloorOn}
            onChange={(event) => setShadowFloorOn(event.target.checked)}
          />
          책상 자체 그림자 (바닥에 책상 다리/서랍 그림자 생성)
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          그림자 색상
          <input
            type="color"
            value={shadowColor}
            onChange={(event) => setShadowColor(event.target.value)}
            style={{ width: 36, height: 24, padding: 0, border: 'none', cursor: 'pointer' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hideBakedAO}
            onChange={(event) => setHideBakedAO(event.target.checked)}
          />
          책상에 미리 칠해진 그림자 끄기 (실시간 그림자만 비교)
        </label>

        <div style={{ marginTop: 18, marginBottom: 6, fontSize: 15, fontWeight: 600 }}>
          그림자 위치 (빛 X): {lightX.toFixed(1)}
        </div>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.1}
          value={lightX}
          onChange={(event) => setLightX(Number(event.target.value))}
          style={{ width: '100%' }}
        />

        <div style={{ marginTop: 12, marginBottom: 6, fontSize: 15, fontWeight: 600 }}>
          그림자 위치 (빛 Y, 높이): {lightY.toFixed(1)}
        </div>
        <input
          type="range"
          min={0.5}
          max={12}
          step={0.1}
          value={lightY}
          onChange={(event) => setLightY(Number(event.target.value))}
          style={{ width: '100%' }}
        />

        <div style={{ marginTop: 12, marginBottom: 6, fontSize: 15, fontWeight: 600 }}>
          그림자 위치 (빛 Z): {lightZ.toFixed(1)}
        </div>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.1}
          value={lightZ}
          onChange={(event) => setLightZ(Number(event.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
          light position: [{lightX.toFixed(1)}, {lightY.toFixed(1)}, {lightZ.toFixed(1)}]
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={orbitOn}
            onChange={(event) => setOrbitOn(event.target.checked)}
          />
          자유 회전 (드래그 또는 스크롤로 빙글빙글 회전, 위아래 기울기·확대축소 없음)
        </label>

        <button
          type="button"
          onClick={resetAll}
          style={{ marginTop: 10, fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline', padding: 0 }}
        >
          전부 초기화
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
        <div style={{ width: 'min(900px, 90%)', aspectRatio: '4 / 3' }}>
          <DeskSetupScene
            key={`${shadowFloorOn}-${hideBakedAO}-${orbitOn}`}
            className="lab-desk-stage"
            introActive={false}
            introComplete
            enableShadows={shadowsOn}
            showShadowFloor={shadowFloorOn}
            hideBakedAO={hideBakedAO}
            keyLightPosition={[lightX, lightY, lightZ]}
            enableOrbitControls={orbitOn}
            shadowColor={shadowColor}
            deskTintColor={deskColor}
            deskBrightness={brightness}
            deskSaturate={saturate}
            deskHue={hue}
          />
        </div>
      </div>
    </div>
  );
}
