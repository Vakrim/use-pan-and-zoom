import { useState } from "react";

const clamp = (min, max) => value => Math.max(min, Math.min(value, max));
const noop = () => {};
const compose = (...fns) => fns.reduce((f, g) => (...args) => f(g(...args)));
const maybe = (f, g) => v => (v === null || v === undefined ? f : g(v));
const snd = g => ([x, y]) => [x, g(y)];
const toPair = v => [v, v];

const getOffset = maybe(
  { left: 0, top: 0 },
  compose(
    ([el, { left, top }]) => ({
      left: left + el.offsetLeft,
      top: top + el.offsetTop
    }),
    snd(el => getOffset(el.offsetParent)),
    toPair
  )
);

const getPositionOnElement = compose(
  ({ left, top }) => (x, y) => ({
    x: x - left,
    y: y - top
  }),
  getOffset
);

const isChildOf = (child, parent) =>
  !!(child && parent) &&
  (child === parent || isChildOf(child.parentElement, parent));

const usePanZoom = ({
  container,
  enablePan = true,
  enableZoom = true,
  requirePinch = false,
  minZoom = 0,
  maxZoom = Infinity,
  minX = -Infinity,
  maxX = Infinity,
  minY = -Infinity,
  maxY = Infinity,
  initialZoom = 1,
  initialPan = { x: 0, y: 0 },
  onPanStart = noop,
  onPan = noop,
  onPanEnd = noop,
  onZoom = noop
}) => {
  if (container === undefined) {
    throw Error("Container cannot be empty and should be a ref");
  }

  const [isPanning, setPanning] = useState(false);
  const [transform, setTransform] = useState({
    ...initialPan,
    zoom: initialZoom
  });
  const [prev, setPrev] = useState({ x: 0, y: 0 });

  function onMouseDown(event) {
    if (enablePan) {
      setPanning(true);
      setPrev({ x: event.pageX, y: event.pageY });

      onPanStart(event);

      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      event.preventDefault();
    }
  }

  function onMouseMove(event) {
    const { pageX, pageY } = event;
    if (isPanning) {
      setTransform(({ x, y, zoom }) => ({
        x: clamp(minX, maxX)(x + pageX - prev.x),
        y: clamp(minY, maxY)(y + pageY - prev.y),
        zoom
      }));

      onPan(event);
    }
    setPrev({ x: pageX, y: pageY });
  }

  function onMouseUp(event) {
    if (isPanning) {
      onPanEnd(event);
      setPanning(false);
    }
  }

  function onMouseOut(event) {
    if (isPanning && !isChildOf(event.relatedTarget, container.current)) {
      onPanEnd(event);
      setPanning(false);
    }
  }

  function onWheel(event) {
    event.preventDefault();
    if (enableZoom && container.current && (!requirePinch || event.ctrlKey)) {
      const { pageX, pageY, deltaY } = event;
      setTransform(({ x, y, zoom }) => {
        const pointerPosition = getPositionOnElement(container.current)(
          pageX,
          pageY
        );
        const newZoom = clamp(minZoom, maxZoom)(zoom * Math.pow(0.99, deltaY));

        return {
          x: clamp(minX, maxX)(
            x + ((pointerPosition.x - x) * (zoom - newZoom)) / zoom
          ),
          y: clamp(minY, maxY)(
            y + ((pointerPosition.y - y) * (zoom - newZoom)) / zoom
          ),
          zoom: newZoom
        };
      });
      onZoom(event);
    }
  }

  return {
    transform: `translate3D(${transform.x}px, ${transform.y}px, 0) scale(${
      transform.zoom
    })`,
    pan: { x: transform.x, y: transform.y },
    zoom: transform.zoom,
    panZoomHandlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseOut,
      onWheel
    }
  };
};

export default usePanZoom;
