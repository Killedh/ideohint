"use strict";

const mixz = require('../support/common').mixz;

function Radical(outline) {
	this.outline = outline;
	this.holes = [];
	this.subs = [];
	this.segments = [];
}
Radical.prototype.includes = function (z) {
	if (!this.outline.includesPoint(z)) return false;
	for (var j = 0; j < this.holes.length; j++) {
		if (this.holes[j].includesPoint(z)) return false;
	}
	return true;
};
Radical.prototype.includesSegment = function (z1, z2) {
	var SEGMENTS = 64;
	for (var s = 1; s < SEGMENTS; s++) {
		var testz = {
			x: z2.x + (z1.x - z2.x) * (s / SEGMENTS),
			y: z2.y + (z1.y - z2.y) * (s / SEGMENTS)
		};
		if (!this.includes(testz)) {
			return false;
		}
	}
	return true;
};
Radical.prototype.includesSegmentEdge = function (z1, z2, um, delta) {
	if (this.includesSegment(z1, z2)) {
		return true;
	}
	for (var u1 = -um; u1 <= um; u1++) for (var u2 = -um; u2 <= um; u2++)
		for (var u3 = -um; u3 <= um; u3++) for (var u4 = -um; u4 <= um; u4++) {
			var z1a = { x: z1.x + u1 * delta, y: z1.y + u2 * delta };
			var z2a = { x: z2.x + u3 * delta, y: z2.y + u4 * delta };
			if (this.includesSegment(z1a, z2a)) {
				return true;
			}
		}
	return false;
};
Radical.prototype.includesTetragon = function (s1, s2) {
	var steps = 32, val = 0, tot = 0;

	for (var u = 0; u < s1.length - 1; u++) {
		for (var v = 0; v < s2.length - 1; v++) {
			var p = s1[u], q = s1[u + 1];
			var r = s2[v], s = s2[v + 1];
			if (p.x > q.x) {
				var t = p;
				p = q; q = t;
			}
			if (r.x > s.x) {
				var t = r;
				r = s; s = t;
			}
			if (
				!this.includesSegmentEdge(mixz(p, q, 1 / 5), mixz(r, s, 1 / 5), 1, 1)
				|| !this.includesSegmentEdge(mixz(p, q, 1 / 2), mixz(r, s, 1 / 2), 1, 1)
				|| !this.includesSegmentEdge(mixz(p, q, 4 / 5), mixz(r, s, 4 / 5), 1, 1)
				|| !this.includesSegmentEdge(p, s, 2, 1)
				|| !this.includesSegmentEdge(q, r, 2, 1)
				|| !this.includesSegmentEdge(p, r, 2, 5)
				|| !this.includesSegmentEdge(q, s, 2, 5)
			) {
				return false;
			}
		}
	}
	return true;
};
module.exports = Radical;