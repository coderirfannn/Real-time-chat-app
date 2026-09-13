/**
 * Mock for react-native-svg in Vitest test environment.
 * Returns simple stub components so Icon.tsx doesn't blow up in Node context.
 */

const createStub = (name: string) => name;

export const Svg = createStub('Svg');
export const Path = createStub('Path');
export const Line = createStub('Line');
export const Circle = createStub('Circle');
export const Rect = createStub('Rect');
export const Polygon = createStub('Polygon');
export const Polyline = createStub('Polyline');
export const G = createStub('G');
export const Defs = createStub('Defs');
export const ClipPath = createStub('ClipPath');
export const Use = createStub('Use');
export const Symbol = createStub('Symbol');
export const LinearGradient = createStub('LinearGradient');
export const RadialGradient = createStub('RadialGradient');
export const Stop = createStub('Stop');
export const Ellipse = createStub('Ellipse');
export const Text = createStub('SvgText');
export const TSpan = createStub('TSpan');
export const TextPath = createStub('TextPath');
export const Image = createStub('SvgImage');
export const ForeignObject = createStub('ForeignObject');
export const Mask = createStub('Mask');
export const Pattern = createStub('Pattern');
export const Marker = createStub('Marker');
export const Animate = createStub('Animate');

export default Svg;
