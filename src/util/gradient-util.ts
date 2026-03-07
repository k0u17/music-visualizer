/** Represents a color stop in a gradient */
export type GradientStop = [color: string, position: number];

/** Represents a gradient */
export type Gradient = [GradientStop, ...GradientStop[]];
/** Represents an un-normalized gradient in which the positions of some color stops are missing and to be interpolated */
export type GradientLike = [string | GradientStop, ...(string | GradientStop)[]] | string; // gradient or single color

/** Interpolate the missing positions of the color stops supposing them to be evenly distributed between the fixed positions */
export function normalizeGradient(color: GradientLike): Gradient {
  if (typeof color === 'string') return [[color, 0] as GradientStop];
  const n = color.length;

  const prevFixedPosIdx = color.reduce((arr, stop, i) => {
    arr.push(typeof stop !== 'string' ? i : arr[i - 1] ?? 0)
    return arr;
  }, [] as number[]);
  const nextFixedPosIdx = new Array<number>(n);
  for (let i = n - 1, prev = n - 1; i >= 0; i--) {
    prev = nextFixedPosIdx[i] = typeof color[i] !== 'string' ? i : prev;
  }

  const getFixedPos = (index: number) => {
    const stop = color[index];
    const pos = typeof stop !== 'string' ? stop?.[1] : undefined;
    if (index <= 0) return pos ?? 0;
    if (index >= n - 1) return pos ?? 1;
    return pos;
  }

  return Array.from({ length: n }, (_, i): GradientStop => {
    const stop = color[i]!;
    const col = typeof stop === 'string' ? stop : stop[0];
    const pos = getFixedPos(i);
    if (pos !== undefined) return [col, pos];
    const prev = prevFixedPosIdx[i]!;
    const next = nextFixedPosIdx[i]!;
    const interval = next - prev;
    const base = getFixedPos(prev)!
    const room = getFixedPos(next)! - base;
    return [col, (i - prev) / interval * room + base];
  }) as Gradient;
}

/** Deep-copy a gradient */
export function cloneGradient(gradient: Gradient) {
  const clone: GradientStop[] = [];
  for (const [color, position] of gradient) {
    clone.push([color, position]);
  }
  return clone as Gradient;
}

/** Scale gradient positions by a factor (scale). Color stops with overflowed positions will be clipped off if scale > 1 */
export function scaleGradient(gradient: Gradient, scale: number) {
  const scaledGradient = scale > 1 ? clipGradient(gradient, 0, 1/scale) : cloneGradient(gradient);
  for (const stop of scaledGradient) {
    stop[1] *= scale;
  }
  return scaledGradient as Gradient;
}


/**
 * Perform binary search on a sorted array of items based on a comparator function,
 * returning whether the item was found and its index
 */
function binarySearchBy<T>(array: T[], comparator: (lhs: T) => number): [found: boolean, insertIdx: number] {
  if (array.length === 0) return [false, 0];
  const orderingFirst = comparator(array[0]!);
  if (orderingFirst >= 0) return [orderingFirst === 0, 0];
  if (comparator(array.at(-1)!) < 0) return [false, array.length];
  let low = 0;
  let high = array.length - 1;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    const ordering = comparator(array[mid]!);
    if (ordering === 0) return [true, mid];
    if (ordering < 0) low = mid;
    else high = mid;
  }
  return [false, high];
}

/**
 * Get the color at a specific position in the gradient, and the insert index for the position in the gradient
 */
export function gradientColorAt(
  gradient: Gradient,
  pos: number,
  interpolationMethod: string = 'in oklab'
): [color: string, found: boolean, insertIdx: number] {
  if (gradient.length === 1) return [gradient[0][0], pos === gradient[0][1], pos > gradient[0][1] ? 1 : 0];
  const [found, index] = binarySearchBy(gradient, stop => stop[1] - pos);
  if (found || index === 0) return [gradient[index]![0], found, index]
  if (index === gradient.length) return [gradient[index - 1]![0], false, index]
  const [leftColor, leftPos] = gradient[index - 1]!;
  const [rightColor, rightPos] = gradient[index]!;
  const ratio = (pos - leftPos) / (rightPos - leftPos);
  return [
    `color-mix(${interpolationMethod}, ${leftColor} ${(1 - ratio) * 100}%, ${rightColor} ${ratio * 100}%)`,
    found,
    index
  ];
}

/**
 * Clip a gradient to a specific range of positions, inserting new color stops at the boundaries if missing.
 * The new color stops will be interpolated from the existing color stops.
 */
export function clipGradient(
  gradient: Gradient,
  start: number,
  end: number,
  interpolationMethod: string = 'in oklab'
) {
  const [startColor, startFound, startIdx] = gradientColorAt(gradient, start, interpolationMethod);
  const [endColor, , endIdx] = gradientColorAt(gradient, end, interpolationMethod);
  const newGradient: GradientStop[] = [];
  if (!startFound) newGradient.push([startColor, start]);
  for (let i = startIdx; i < endIdx; i++) {
    const [color, pos] = gradient[i]!;
    newGradient.push([color, pos]);
  }
  newGradient.push([endColor, end]);
  return newGradient as Gradient;
}

/**
 * Shift a gradient by a certain offset,
 * wrapping around if necessary and inserting new color stops at the boundaries if missing.
 */
export function shiftGradient(
  gradient: Gradient,
  offset: number,
  interpolationMethod: string = 'in oklab'
) {
  offset = (offset % 1 + 1) % 1;
  const signedOffset = (offset + 0.5) % 1 - 0.5;
  const firstPos = gradient[0][1];
  const lastPos = gradient.at(-1)![1];

  // basically, whether the first/last color stop will not cross the boundary after getting shifted,
  // but if they are already at either end, we don't need to insert new color stops at the boundary positions respectively
  const shouldInsertFirst = firstPos !== 0 && firstPos + signedOffset > 0;
  const shouldInsertLast = lastPos !== 1 && lastPos + signedOffset < 1;
  if (shouldInsertFirst || shouldInsertLast)
    gradient = [
      ...(shouldInsertFirst ? [[gradient[0][0], 0]] : []),
      ...gradient,
      ...(shouldInsertFirst ? [[gradient.at(-1)![0], 1]] : [])
    ] as Gradient;
  const shifted: GradientStop[] = [];
  const [boundaryColor, found, idx] = gradientColorAt(gradient, 1 - offset, interpolationMethod);
  if (!found) shifted.push([boundaryColor, 0]);
  for (let i = idx; i < gradient.length; i++) {
    const [color, pos] = gradient[i]!;
    shifted.push([color, (pos + offset) % 1]);
  }
  for (let i = 0; i < idx; i++) {
    const [color, pos] = gradient[i]!;
    shifted.push([color, pos + offset]);
  }
  shifted.push([boundaryColor, 1]);
  return shifted as Gradient
}

/**
 * Repeat a gradient while the last color stop's position is less than 1,
 * virtually simulating the behavior of CSS `repeating-linear-gradient` function.
 */
export function repeatGradient(
  gradient: Gradient,
  interpolationMethod: string = 'in oklab'
) {
  const firstPos = gradient[0][1];
  if (firstPos !== 0) {
    // ignore the offset like repeating-linear-gradient does
    const newGradient: GradientStop[] = [];
    for (const [color, pos] of gradient) {
      newGradient.push([color, pos - firstPos]);
    }
    gradient = newGradient as Gradient;
  }

  function appendGradientStops(gradient: GradientStop[], ...stops: GradientStop[]) {
    const offset = gradient.at(-1)?.[1] ?? 0;
    for (const [color, pos] of stops) {
      gradient.push([color, offset + pos]);
    }
    return gradient;
  }

  const period = gradient.at(-1)![1];
  const repeatedGradient: GradientStop[] = [];

  const count = Math.floor(1 / period);
  for (let i = 0; i < count; i++) {
    appendGradientStops(repeatedGradient, ...gradient);
  }

  const remaining = 1 % period;
  appendGradientStops(repeatedGradient , ...clipGradient(gradient, 0, remaining, interpolationMethod));

  return repeatedGradient as Gradient;
}

interface ToCSSOptions {
  /**
   * The direction of the gradient. Refers to the CSS `linear-gradient` function.
   */
  direction?: string,
  /**
   * The interpolation method to use for the gradient. Refers to the CSS `linear-gradient` function.
   */
  interpolationMethod?: string,
  /**
   * Whether to use `linear-gradient` or `repeating-linear-gradient`.
   */
  repeating?: boolean,
  /**
   * The maximum value for the gradient positions. Defaults to '100%'.
   */
  max?: string
}

/**
 * Convert a gradient to a CSS linear-gradient string.
 */
export function gradientToCSS(
  gradient: Gradient,
  options: ToCSSOptions = {}
) {
  if (gradient.length === 1) return `${gradient[0][0]}`;
  const direction = options.direction ?? 'to bottom';
  const interpolationMethod = options.interpolationMethod ?? 'in oklab';
  const func = options.repeating ? 'repeating-linear-gradient' : 'linear-gradient';
  const max = options.max ?? '100%';
  const stops = gradient.map(([color, pos]) => `${color} calc(${pos} * ${max})`);
  return `${func}(${direction} ${interpolationMethod}, ${stops.join(', ')})`;
}