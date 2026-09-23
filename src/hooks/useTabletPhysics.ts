import { useEffect, type RefObject } from 'react';
import {
  Bodies,
  Body,
  Composite,
  Engine,
  Events,
  Mouse,
  MouseConstraint,
  type IEvent,
} from 'matter-js';
import type { TabletPlaceholderItem } from '../data/tabletPlaceholders';

const WALL_THICKNESS = 100;
const MAX_PLACEHOLDER_WIDTH = 420;
const STAGE_SIDE_GAP = 16;

export function useTabletPhysics(
  stageRef: RefObject<HTMLElement | null>,
  items: readonly TabletPlaceholderItem[],
) {
  useEffect(() => {
    const stage = stageRef.current;

    if (!stage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
    });
    const bodyElements = new Map<number, HTMLElement>();
    const bodyItems = new Map<number, TabletPlaceholderItem>();
    const releaseTimers: number[] = [];
    let boundaryBodies: Body[] = [];
    let animationFrame = 0;
    let previousTime = performance.now();
    let currentScale = Math.min(
      1,
      Math.max(0.58, (stage.clientWidth - STAGE_SIDE_GAP * 2) / MAX_PLACEHOLDER_WIDTH),
    );

    const placeholderBodies = items.flatMap((item, index) => {
      const element = stage.querySelector<HTMLElement>(`[data-physics-id="${item.id}"]`);

      if (!element) return [];

      const bodyWidth = item.width * currentScale;
      const bodyHeight = item.height * currentScale;
      const minX = bodyWidth / 2 + STAGE_SIDE_GAP;
      const maxX = stage.clientWidth - bodyWidth / 2 - STAGE_SIDE_GAP;
      const spawnX = Math.min(maxX, Math.max(minX, stage.clientWidth * item.spawnX));
      const body = Bodies.rectangle(
        spawnX,
        -bodyHeight / 2 - item.spawnOffsetY,
        bodyWidth,
        bodyHeight,
        {
          angle: (item.rotation * Math.PI) / 180,
          friction: 0.72,
          frictionAir: 0.012,
          restitution: 0.22,
          chamfer: { radius: Math.min(18 * currentScale, bodyHeight / 5) },
          label: item.id,
        },
      );

      element.style.width = `${bodyWidth}px`;
      element.style.height = `${bodyHeight}px`;
      bodyElements.set(body.id, element);
      bodyItems.set(body.id, item);

      const timer = window.setTimeout(() => {
        Composite.add(engine.world, body);
        Body.setVelocity(body, { x: (index - 1) * 0.35, y: 0 });
        Body.setAngularVelocity(body, (index - 1) * 0.006);
      }, item.spawnDelay);
      releaseTimers.push(timer);

      return [body];
    });

    const createBoundaries = () => {
      boundaryBodies.forEach((body) => Composite.remove(engine.world, body));

      const width = stage.clientWidth;
      const height = stage.clientHeight;
      boundaryBodies = [
        Bodies.rectangle(width / 2, height + WALL_THICKNESS / 2, width + WALL_THICKNESS * 2, WALL_THICKNESS, {
          isStatic: true,
          label: 'tablet-floor',
        }),
        Bodies.rectangle(-WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height * 2, {
          isStatic: true,
          label: 'tablet-left-wall',
        }),
        Bodies.rectangle(width + WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height * 2, {
          isStatic: true,
          label: 'tablet-right-wall',
        }),
      ];
      Composite.add(engine.world, boundaryBodies);
    };

    createBoundaries();

    const mouse = Mouse.create(stage);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.12,
        damping: 0.16,
        render: { visible: false },
      },
    });
    Composite.add(engine.world, mouseConstraint);

    type MouseDragEvent = IEvent<MouseConstraint> & { body?: Body };
    const handleDragStart = (event: IEvent<MouseConstraint>) => {
      const { body } = event as MouseDragEvent;
      if (body) bodyElements.get(body.id)?.classList.add('is-dragging');
    };
    const handleDragEnd = (event: IEvent<MouseConstraint>) => {
      const { body } = event as MouseDragEvent;
      if (body) bodyElements.get(body.id)?.classList.remove('is-dragging');
    };
    Events.on(mouseConstraint, 'startdrag', handleDragStart);
    Events.on(mouseConstraint, 'enddrag', handleDragEnd);

    const syncElements = () => {
      placeholderBodies.forEach((body) => {
        const element = bodyElements.get(body.id);
        const item = bodyItems.get(body.id);

        if (!element || !item) return;

        const width = item.width * currentScale;
        const height = item.height * currentScale;
        element.style.transform = `translate3d(${body.position.x - width / 2}px, ${body.position.y - height / 2}px, 0) rotate(${body.angle}rad)`;
      });
    };

    const runPhysics = (time: number) => {
      const delta = Math.min(time - previousTime, 1000 / 60);
      previousTime = time;
      Engine.update(engine, delta);
      syncElements();
      animationFrame = requestAnimationFrame(runPhysics);
    };

    stage.classList.add('is-physics-ready');
    syncElements();
    animationFrame = requestAnimationFrame(runPhysics);

    const resizeObserver = new ResizeObserver(() => {
      const nextScale = Math.min(
        1,
        Math.max(0.58, (stage.clientWidth - STAGE_SIDE_GAP * 2) / MAX_PLACEHOLDER_WIDTH),
      );

      if (Math.abs(nextScale - currentScale) > 0.001) {
        const scaleRatio = nextScale / currentScale;
        currentScale = nextScale;

        placeholderBodies.forEach((body) => {
          const item = bodyItems.get(body.id);
          const element = bodyElements.get(body.id);

          if (!item || !element) return;
          Body.scale(body, scaleRatio, scaleRatio);
          element.style.width = `${item.width * currentScale}px`;
          element.style.height = `${item.height * currentScale}px`;
        });
      }

      createBoundaries();
    });
    resizeObserver.observe(stage);

    return () => {
      releaseTimers.forEach(window.clearTimeout);
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      Events.off(mouseConstraint, 'startdrag', handleDragStart);
      Events.off(mouseConstraint, 'enddrag', handleDragEnd);
      Mouse.clearSourceEvents(mouse);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      stage.classList.remove('is-physics-ready');

      bodyElements.forEach((element) => {
        element.classList.remove('is-dragging');
        element.style.removeProperty('width');
        element.style.removeProperty('height');
        element.style.removeProperty('transform');
      });
    };
  }, [items, stageRef]);
}
