(() => {
  'use strict';

  const DR = window.DreamRealms = window.DreamRealms || {};

  DR.RenderUtils = {
    install(Game) {
      Object.assign(Game.prototype, {
lerpPoint(a, b, t) {
      const DR = window.DreamRealms;
      const { CONFIG, TILE, TILE_DEF } = DR;
      const { clamp, lerp, dist, seededNoise, smoothNoise, pct, colorShade } = DR.utils || {};
      const { canvas, ctx, minimap, mmctx, ui } = DR.runtime || {};
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
},

fillPoly(points) {
      const DR = window.DreamRealms;
      const { CONFIG, TILE, TILE_DEF } = DR;
      const { clamp, lerp, dist, seededNoise, smoothNoise, pct, colorShade } = DR.utils || {};
      const { canvas, ctx, minimap, mmctx, ui } = DR.runtime || {};
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
},

strokePoly(points) {
      const DR = window.DreamRealms;
      const { CONFIG, TILE, TILE_DEF } = DR;
      const { clamp, lerp, dist, seededNoise, smoothNoise, pct, colorShade } = DR.utils || {};
      const { canvas, ctx, minimap, mmctx, ui } = DR.runtime || {};
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.stroke();
}
      });
    }
  };
})();
