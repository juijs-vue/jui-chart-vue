// Shared config-value shape for every `chart.theme.*` registration (`classic.ts`/`dark.ts`/
// `gradient.ts`/`pastel.ts`/`pattern.ts`), each a flat style-value dictionary passed to
// `jui-graph-ts`'s `registerTheme(name, style)` with no logic of its own. One interface covers
// all 5 files (not one per file, unlike `register/brush`/`register/widget`) because they're the
// SAME shape - each theme configures a subset of this same key space with its own color/size
// values, not a per-file-distinct config surface the way each brush/widget type is.
//
// **Every field is optional, and this is a real finding, not a hedge**: the 5 theme files do NOT
// all configure the same keys - `pastel.ts` alone omits 40 keys the other 4 all set (confirmed by
// diffing every theme file's own key set against the union of all 5), and 3 keys
// (`barActiveBackgroundColor`/`crossBorderDashArray`/`zoomScrollButtonImage`) are each missing
// from one or more of the other 4. A brush/widget reading a key no active theme happens to set
// gets `undefined` back from `chart.theme(key)` at runtime (see `mapPathBackgroundColor`'s own
// comment below for a real case this caused - a thrown, chart-aborting `TypeError`). This
// interface documents the REAL, full key space (every key that appears in at least one theme
// file), not a false "every theme has every key" guarantee.
//
// **`pastel.ts`'s 40 missing keys specifically are NOT a porting gap to fix**: `pastel.ts`'s own
// header comment already establishes it was byte-for-byte extracted from the REAL live
// `www.jui-vue.io` bundle's own "pastel" theme object, which genuinely has only 318 keys in
// production - inventing values for the 40 it doesn't have would fabricate configuration that
// was never real, the opposite of this project's "literal port of real behavior" rule. Checked
// whether this is actually reachable: `theme="pastel"` is used in exactly one place across the
// whole site (`web/src/pages/gallery/Fitness.vue`, 6 `<Chart>`s), exclusively with
// `heatmap`/`pie`/`line`/`scatter` brushes and `tooltip`/`title` widgets - none of which read any
// of the 40 missing keys directly (`pie.ts`'s own `pieDisableBackgroundOpacity` read has a
// defensive `|| 0.5` fallback; the other affected types - `guideline`, `ratebar`, `selectbox`,
// `canvas.bubblecloud`, `canvas.equalizercolumn` - are simply never combined with `pastel`
// anywhere in this repo's demos or `play/chart` JSON configs, confirmed by grep). `crossBorderDashArray`
// is additionally dead code everywhere - no widget in this repo ever reads it, not just under
// `pastel`. So: real inconsistency, currently unreachable in practice, correctly left as `pastel`
// actually has it - not "fixed" by putting words in the real site's mouth.
//
// Every value's type was derived from actually reading all 5 theme files' own literal values
// (not guessed from the key name) - confirmed there is exactly one consistent type per key across
// every file that sets it (no key is e.g. a string in one theme and a number in another).
export interface ChartThemeOptions {

  fontFamily?: string
  backgroundColor?: string
  colors?: string[]

  // Axis styles
  axisBackgroundColor?: string
  axisBackgroundOpacity?: number
  axisBorderColor?: string
  axisBorderWidth?: number
  axisBorderRadius?: number

  // Grid styles
  gridXFontSize?: number
  gridYFontSize?: number
  gridZFontSize?: number
  gridCFontSize?: number
  gridXFontColor?: string
  gridYFontColor?: string
  gridZFontColor?: string
  gridCFontColor?: string
  gridXFontWeight?: string
  gridYFontWeight?: string
  gridZFontWeight?: string
  gridCFontWeight?: string
  gridXAxisBorderColor?: string
  gridYAxisBorderColor?: string
  gridZAxisBorderColor?: string
  gridXAxisBorderWidth?: number
  gridYAxisBorderWidth?: number
  gridZAxisBorderWidth?: number

  gridFaceBackgroundColor?: string
  gridFaceBackgroundOpacity?: number

  gridActiveFontColor?: string
  gridActiveBorderColor?: string
  gridActiveBorderWidth?: number
  gridPatternColor?: string
  gridPatternOpacity?: number
  gridBorderColor?: string
  gridBorderWidth?: number
  gridBorderDashArray?: string
  gridBorderOpacity?: number
  gridTickBorderSize?: number
  gridTickBorderWidth?: number
  gridTickPadding?: number

  // Brush styles (only the ones this project's Phase 1 brushes read are exercised, but every
  // legacy key is kept - later phases' brushes will need the rest, and dropping "unused-for-now"
  // keys would be an unrequested scope reduction).
  tooltipPointRadius?: number
  tooltipPointBorderWidth?: number
  tooltipPointFontWeight?: string
  tooltipPointFontSize?: number
  tooltipPointFontColor?: string
  barFontSize?: number
  barFontColor?: string
  barBorderColor?: string
  barBorderWidth?: number
  barBorderOpacity?: number
  barBorderRadius?: number
  barPointBorderColor?: string
  barDisableBackgroundOpacity?: number
  barStackEdgeBorderWidth?: number
  rateBarFontSize?: number
  rateBarFontColor?: string
  rateBarBorderColor?: string
  rateBarBorderWidth?: number
  rateBarBorderOpacity?: number
  rateBarBorderRadius?: number
  rateBarDisableBackgroundOpacity?: number
  rateBarTooltipFontSize?: number
  rateBarTooltipFontColor?: string
  rateBarTooltipBackgroundColor?: string
  rateBarTooltipBorderColor?: string
  gaugeBackgroundColor?: string
  gaugeArrowColor?: string
  gaugeFontColor?: string
  gaugeFontSize?: number
  gaugeFontWeight?: string
  gaugeTitleFontSize?: number
  gaugeTitleFontWeight?: string
  gaugeTitleFontColor?: string
  gaugePaddingAngle?: number
  bargaugeBackgroundColor?: string
  bargaugeFontSize?: number
  bargaugeFontColor?: string
  pieBorderColor?: string
  pieBorderWidth?: number
  pieOuterFontSize?: number
  pieOuterFontColor?: string
  pieOuterLineColor?: string
  pieOuterLineSize?: number
  pieOuterLineRate?: number
  pieOuterLineWidth?: number
  pieInnerFontSize?: number
  pieInnerFontColor?: string
  pieActiveDistance?: number
  pieNoDataBackgroundColor?: string
  pieTotalValueFontSize?: number
  pieTotalValueFontColor?: string
  pieTotalValueFontWeight?: string
  pieDisableBackgroundOpacity?: number
  areaBackgroundOpacity?: number
  areaSplitBackgroundColor?: string
  bubbleBackgroundOpacity?: number
  bubbleBorderWidth?: number
  bubbleFontSize?: number
  bubbleFontColor?: string
  candlestickBorderColor?: string
  candlestickBackgroundColor?: string
  candlestickInvertBorderColor?: string
  candlestickInvertBackgroundColor?: string
  ohlcBorderColor?: string
  ohlcInvertBorderColor?: string
  ohlcBorderRadius?: number
  lineBorderWidth?: number
  lineBorderDashArray?: string
  lineBorderOpacity?: number
  lineDisableBorderOpacity?: number
  linePointBorderColor?: string
  lineSplitBorderColor?: string | null
  lineSplitBorderOpacity?: number
  pathBackgroundOpacity?: number
  pathBorderWidth?: number
  scatterBorderColor?: string
  scatterBorderWidth?: number
  scatterHoverColor?: string
  waterfallBackgroundColor?: string
  waterfallInvertBackgroundColor?: string
  waterfallEdgeBackgroundColor?: string
  waterfallLineColor?: string
  waterfallLineDashArray?: string
  focusBorderColor?: string
  focusBorderWidth?: number
  focusBackgroundColor?: string
  focusBackgroundOpacity?: number
  pinFontColor?: string
  pinFontSize?: number
  pinBorderColor?: string
  pinBorderWidth?: number
  topologyNodeRadius?: number
  topologyNodeFontSize?: number
  topologyNodeFontColor?: string
  topologyNodeTitleFontSize?: number
  topologyNodeTitleFontColor?: string
  topologyEdgeWidth?: number
  topologyActiveEdgeWidth?: number
  topologyHoverEdgeWidth?: number
  topologyEdgeColor?: string
  topologyActiveEdgeColor?: string
  topologyHoverEdgeColor?: string
  topologyEdgeFontSize?: number
  topologyEdgeFontColor?: string
  topologyEdgePointRadius?: number
  topologyEdgeOpacity?: number
  topologyTooltipBackgroundColor?: string
  topologyTooltipBorderColor?: string
  topologyTooltipFontSize?: number
  topologyTooltipFontColor?: string

  timelineTitleFontSize?: number
  timelineTitleFontColor?: string
  timelineTitleFontWeight?: number
  timelineColumnFontSize?: number
  timelineColumnFontColor?: string
  timelineColumnBackgroundColor?: string
  timelineHoverRowBackgroundColor?: string
  timelineEvenRowBackgroundColor?: string
  timelineOddRowBackgroundColor?: string
  timelineActiveBarBackgroundColor?: string
  timelineActiveBarFontColor?: string
  timelineActiveBarFontSize?: number
  timelineHoverBarBackgroundColor?: string | null
  timelineLayerBackgroundOpacity?: number
  timelineActiveLayerBackgroundColor?: string
  timelineActiveLayerBorderColor?: string
  timelineHoverLayerBackgroundColor?: string
  timelineHoverLayerBorderColor?: string
  timelineVerticalLineColor?: string
  timelineHorizontalLineColor?: string

  heatmapBackgroundColor?: string
  heatmapBackgroundOpacity?: number
  heatmapHoverBackgroundOpacity?: number
  heatmapBorderColor?: string
  heatmapBorderWidth?: number
  heatmapBorderOpacity?: number
  heatmapFontSize?: number
  heatmapFontColor?: string

  pyramidLineColor?: string
  pyramidLineWidth?: number
  pyramidTextLineColor?: string
  pyramidTextLineWidth?: number
  pyramidTextLineSize?: number
  pyramidTextFontSize?: number
  pyramidTextFontColor?: string

  heatmapscatterBorderWidth?: number
  heatmapscatterBorderColor?: string
  heatmapscatterActiveBackgroundColor?: string

  treemapNodeBorderWidth?: number
  treemapNodeBorderColor?: string
  treemapTextFontSize?: number
  treemapTextFontColor?: string
  treemapTitleFontSize?: number
  treemapTitleFontColor?: string

  arcEqualizerBorderColor?: string
  arcEqualizerBorderWidth?: number
  arcEqualizerFontSize?: number
  arcEqualizerFontColor?: string
  arcEqualizerBackgroundColor?: string

  flameNodeBorderWidth?: number
  flameNodeBorderColor?: string
  flameDisableBackgroundOpacity?: number
  flameTextFontSize?: number
  flameTextFontColor?: string

  selectBoxBackgroundColor?: string
  selectBoxBackgroundOpacity?: number
  selectBoxBorderColor?: string
  selectBoxBorderOpacity?: number

  // Widget styles
  titleFontColor?: string
  titleFontSize?: number
  titleFontWeight?: string
  legendFontColor?: string
  legendFontSize?: number
  legendSwitchCircleColor?: string
  legendSwitchDisableColor?: string
  tooltipFontColor?: string
  tooltipFontSize?: number
  tooltipBackgroundColor?: string
  tooltipBackgroundOpacity?: number
  tooltipBorderColor?: string | null
  tooltipBorderWidth?: number
  tooltipLineColor?: string | null
  tooltipLineWidth?: number
  scrollBackgroundSize?: number
  scrollBackgroundColor?: string
  scrollThumbBackgroundColor?: string
  scrollThumbBorderColor?: string
  zoomBackgroundColor?: string
  zoomFocusColor?: string
  zoomScrollBackgroundSize?: number
  zoomScrollButtonSize?: number
  zoomScrollAreaBackgroundColor?: string
  zoomScrollAreaBackgroundOpacity?: number
  zoomScrollAreaBorderColor?: string
  zoomScrollAreaBorderWidth?: number
  zoomScrollAreaBorderRadius?: number
  zoomScrollGridFontSize?: number
  zoomScrollGridTickPadding?: number
  zoomScrollBrushAreaBackgroundOpacity?: number
  zoomScrollBrushLineBorderWidth?: number
  crossBorderColor?: string
  crossBorderWidth?: number
  crossBorderOpacity?: number
  crossBalloonFontSize?: number
  crossBalloonFontColor?: string
  crossBalloonBackgroundColor?: string
  crossBalloonBackgroundOpacity?: number
  dragSelectBackgroundColor?: string
  dragSelectBackgroundOpacity?: number
  dragSelectBorderColor?: string
  dragSelectBorderWidth?: number

  guidelineBorderColor?: string
  guidelineBorderWidth?: number
  guidelineBorderOpacity?: number
  guidelineBalloonFontSize?: number
  guidelineBalloonFontColor?: string
  guidelineBalloonBackgroundColor?: string
  guidelineBalloonBackgroundOpacity?: number
  guidelineBorderDashArray?: string
  guidelinePointRadius?: number
  guidelinePointBorderColor?: string
  guidelinePointBorderWidth?: number
  guidelineTooltipFontColor?: string
  guidelineTooltipFontSize?: number
  guidelineTooltipPointRadius?: number
  guidelineTooltipBackgroundColor?: string
  guidelineTooltipBackgroundOpacity?: number
  guidelineTooltipBorderColor?: string
  guidelineTooltipBorderWidth?: number

  polygonColumnBackgroundOpacity?: number
  polygonColumnBorderOpacity?: number
  polygonScatterRadialOpacity?: number
  polygonScatterBackgroundOpacity?: number
  polygonLineBackgroundOpacity?: number
  polygonLineBorderOpacity?: number

  bubbleCloudFontColor?: string
  bubbleCloudFontSize?: number
  bubbleCloudFontWeight?: string

  equalizerColumnErrorBackgroundColor?: string
  equalizerColumnErrorFontColor?: string

  // Map Chart styles - `classic.ts` (the DEFAULT theme - what every `map.*` demo that never
  // passes an explicit `theme` prop actually renders with) was genuinely missing this whole block
  // until a real fix, not a preserved-quirk omission: `dark.ts`/`gradient.ts`/`pattern.ts` already
  // carried it (byte-for-byte, values confirmed against the live bundle) but `classic.ts` never
  // had it at all, confirmed via Playwright against the live site - `map.flightroute`/
  // `map.comparebubble`/`map.minimap` demos (none of which set an explicit theme) threw real
  // jsdom/Chromium SVG-attribute-parse errors (`<circle> attribute r: Expected length,
  // "NaN"/"undefined"`, `<tspan> attribute y: Expected length, "undefined"`) and, for
  // `map.minimap`, a thrown `TypeError` that aborted the entire chart's render - all because
  // `this.chart.theme('mapFlightRouteAirportRadius')` etc. resolved to `undefined` with no
  // default theme value to fall back to.
  mapPathBackgroundColor?: string
  mapPathBackgroundOpacity?: number
  mapPathBorderColor?: string
  mapPathBorderWidth?: number
  mapPathBorderOpacity?: number
  mapBubbleBackgroundOpacity?: number
  mapBubbleBorderWidth?: number
  mapBubbleFontSize?: number
  mapBubbleFontColor?: string
  mapSelectorHoverColor?: string
  mapSelectorActiveColor?: string
  mapFlightRouteAirportSmallColor?: string
  mapFlightRouteAirportLargeColor?: string
  mapFlightRouteAirportBorderWidth?: number
  mapFlightRouteAirportRadius?: number
  mapFlightRouteLineColor?: string
  mapFlightRouteLineWidth?: number
  mapWeatherBackgroundColor?: string
  mapWeatherBorderColor?: string
  mapWeatherFontSize?: number
  mapWeatherTitleFontColor?: string
  mapWeatherInfoFontColor?: string
  mapCompareBubbleMaxLineColor?: string
  mapCompareBubbleMaxLineDashArray?: string
  mapCompareBubbleMaxBorderColor?: string
  mapCompareBubbleMaxFontSize?: number
  mapCompareBubbleMaxFontColor?: string
  mapCompareBubbleMinBorderColor?: string
  mapCompareBubbleMinFontSize?: number
  mapCompareBubbleMinFontColor?: string
  mapControlButtonColor?: string
  mapControlLeftButtonImage?: string
  mapControlRightButtonImage?: string
  mapControlTopButtonImage?: string
  mapControlBottomButtonImage?: string
  mapControlHomeButtonImage?: string
  mapControlUpButtonImage?: string
  mapControlDownButtonImage?: string
  mapControlScrollColor?: string
  mapControlScrollLineColor?: string
  mapMinimapBackgroundColor?: string
  mapMinimapBorderColor?: string
  mapMinimapBorderWidth?: number
  mapMinimapPathBackgroundColor?: string
  mapMinimapPathBackgroundOpacity?: number
  mapMinimapPathBorderColor?: string
  mapMinimapPathBorderWidth?: number
  mapMinimapPathBorderOpacity?: number
  mapMinimapDragBackgroundColor?: string
  mapMinimapDragBackgroundOpacity?: number
  mapMinimapDragBorderColor?: string
  mapMinimapDragBorderWidth?: number

  // hudbar/hudcolumn styles - confirmed byte-identical across all 4 real themes (classic/dark/
  // gradient/pattern), unlike every other per-brush key group above.
  hudColumnGridPointRadius?: number
  hudColumnGridPointBorderColor?: string
  hudColumnGridPointBorderWidth?: number
  hudColumnGridFontColor?: string
  hudColumnGridFontSize?: number
  hudColumnGridFontWeight?: string
  hudColumnLeftBackgroundColor?: string
  hudColumnRightBackgroundColor?: string
  hudBarGridFontColor?: string
  hudBarGridFontSize?: number
  hudBarGridLineColor?: string
  hudBarGridLineWidth?: number
  hudBarGridLineOpacity?: number
  hudBarGridBackgroundColor?: string
  hudBarGridBackgroundOpacity?: number
  hudBarTextLineColor?: string
  hudBarTextLineWidth?: number
  hudBarTextLinePadding?: number
  hudBarTextLineFontColor?: string
  hudBarTextLineFontSize?: number
  hudBarBackgroundOpacity?: number
  hudBarTopBackgroundColor?: string
  hudBarBottomBackgroundColor?: string

  // Theme-specific keys not present in every theme (see this file's own note on
  // real cross-theme inconsistency - not every theme configures every optional style key).
  barActiveBackgroundColor?: string
  crossBorderDashArray?: string
  zoomScrollButtonImage?: string
}
