var roundings = require("../roundings");
const toF26D6P = roundings.toF26D6P;
const decideDelta = require('./delta.js').decideDelta;
const decideDeltaShift = require('./delta.js').decideDeltaShift;

const ROUNDING_SEGMENTS = 8;

function showF26D6(x) {
	return Math.round(x) + '+' + Math.round(64 * (x - Math.round(x))) + '/64'
}

function formatdelta(delta) {
	if (delta > 8) return formatdelta(8);
	if (delta < -8) return formatdelta(-8);
	let u = Math.round(delta * ROUNDING_SEGMENTS);
	let d = ROUNDING_SEGMENTS;
	while (!(u % 2) && !(d % 2) && d > 1) { u /= 2, d /= 2; }
	if (d > 1) {
		return u + "/" + d;
	} else {
		return "" + u;
	}
}
function sanityDelta(z, d, tag) {
	var deltas = d.filter((x) => x.delta);
	if (!deltas.length) return "";
	let buf = [];
	let ppemstart = 0, ppemend = 0;
	let curdelta = 0;
	for (let x of deltas) {
		if (x.ppem === ppemend + 1 && x.delta === curdelta) {
			ppemend += 1;
		} else {
			if (curdelta) buf.push(formatdelta(curdelta) + "@" + (ppemend > ppemstart ? ppemstart + ".." + ppemend : ppemstart));
			ppemstart = ppemend = x.ppem;
			curdelta = x.delta;
		}
	}
	if (curdelta) {
		buf.push(formatdelta(curdelta) + "@" + (ppemend > ppemstart ? ppemstart + ".." + ppemend : ppemstart));
	}
	if (buf.length) {
		return `${tag || 'YDelta'}(${z},${buf.join(',')})`;
	} else {
		return '';
	}
}

function encodeStem(s, sid, sd, strategy, pos0s) {
	let buf = "";
	const upm = strategy.UPM;
	function talk(s) { buf += s + "\n"; }

	let deltaPos = [];
	let deltaADv = [];
	let pDsts = [];

	for (let ppem = 0; ppem < sd.length; ppem++) {
		if (!sd[ppem]) continue;
		const [ytouch, wtouch, isStrict, isStacked] = sd[ppem][sid];
		const pos0 = pos0s ? pos0s[ppem] : s.posKeyAtTop ? s.y0 : s.y0 - s.w0 - s.slope * s.keyDX;
		const uppx = upm / ppem;
		if (s.posKeyAtTop) {
			const psrc = roundings.rtg(pos0, upm, ppem);
			const pdst = ytouch * (upm / ppem);
			const posdelta = {
				ppem,
				delta: decideDelta(ROUNDING_SEGMENTS, psrc, pdst, upm, ppem) / ROUNDING_SEGMENTS
			};
			deltaPos.push(posdelta);
			const wsrc = s.w0;
			const wdst = wtouch * (upm / ppem);
			deltaADv.push({
				ppem,
				delta: decideDeltaShift(
					ROUNDING_SEGMENTS, -1,
					isStrict, isStacked,
					pdst, wsrc,
					pdst, wdst,
					upm, ppem) / ROUNDING_SEGMENTS
			});
			pDsts[ppem] = pdst;
		} else {
			const psrc = roundings.rtg(pos0, upm, ppem);
			const pdst = (ytouch - wtouch) * (upm / ppem) - s.keyDX * s.slope;
			const posdelta = {
				ppem,
				delta: decideDelta(ROUNDING_SEGMENTS, psrc, pdst, upm, ppem) / ROUNDING_SEGMENTS
			};
			deltaPos.push(posdelta);
			const wsrc = s.w0;
			const wdst = wtouch * (upm / ppem);
			deltaADv.push({
				ppem,
				delta: decideDeltaShift(
					ROUNDING_SEGMENTS, 1,
					isStrict, isStacked,
					pdst, wsrc,
					pdst, wdst,
					upm, ppem) / ROUNDING_SEGMENTS
			});
			pDsts[ppem] = psrc + posdelta.delta * (upm / ppem);
		}
	}

	talk(sanityDelta(s.posKey, deltaPos));
	if (strategy.SIGNIFICANT_LINK_ARROW) {
		talk(`YNoRound(${s.advKey})`);
		talk(`YDist(${s.posKey},${s.advKey})`);
	} else {
		talk(`YShift(${s.posKey},${s.advKey}) /* !IMPORTANT */`);
	}
	talk(sanityDelta(s.advKey, deltaADv));
	for (let zp of s.posAlign) {
		talk(`YShift(${s.posKey},${zp})`);
	}
	for (let zp of s.advAlign) {
		talk(`YShift(${s.advKey},${zp})`);
	}
	return {
		buf: buf,
		ipz: s.posKey,
		pDsts,
		pOrg: s.posKeyAtTop ? s.y0 : s.y0 - s.w0
	}
}

function table(min, max, f) {
	let a = [];
	for (let j = min; j <= max; j++) { a[j] = f(j) }
	return a;
}

// si : size-inpendent actions
// sd : size-dependent actions
// strategy : strategy object
// padding : CVT padding value, padding + 1 -> bottom anchor; padding + 2 -> top anchor
function produceVTTTalk(record, strategy, padding, isXML) {
	const sd = record.sd;
	const si = record.si;
	const pmin = record.pmin;
	const pmax = record.pmax;
	const upm = strategy.UPM;
	let buf = "";
	function talk(s) { buf += s + "\n"; }

	//// X

	if (si.xIP && si.xIP.length > 1) {
		const zmin = si.xIP[0];
		const zmax = si.xIP[si.xIP.length - 1];
		let deltaL = [];
		let deltaR = [];
		for (let ppem = 0; ppem < sd.length; ppem++) {
			if (!si.xExpansion[ppem]) continue;
			const xL0 = zmin.x;
			const xL1 = strategy.UPM / 2 + (xL0 - strategy.UPM / 2) * si.xExpansion[ppem];
			deltaL.push({
				ppem,
				delta: decideDelta(ROUNDING_SEGMENTS, xL0, xL1, upm, ppem) / ROUNDING_SEGMENTS
			});

			const xR0 = zmax.x;
			const xR1 = strategy.UPM / 2 + (xR0 - strategy.UPM / 2) * si.xExpansion[ppem];
			deltaR.push({
				ppem,
				delta: decideDelta(ROUNDING_SEGMENTS, xR0, xR1, upm, ppem) / ROUNDING_SEGMENTS
			});
		}
		const tkL = sanityDelta(zmin.id, deltaL, 'XDelta');
		const tkR = sanityDelta(zmax.id, deltaR, 'XDelta');
		if (tkL || tkR) {
			talk(`XAnchor(${zmin.id})`);
			talk(tkL);
			talk(`XAnchor(${zmax.id})`);
			talk(tkR);
			if (si.xIP.length > 2) {
				talk(`XInterpolate(${si.xIP.map(z => z.id).join(',')})`);
			}
		}
	}

	//// Y

	talk('/* !!IDH!! ANCHOR BOTTOM */');
	// bottom
	for (let z of si.blue.bottomZs) {
		talk(`YAnchor(${z.id},${padding + 2})`);
	}
	talk('/* !!IDH!! ANCHOR TOP */');
	// top
	for (let j = 0; j < si.blue.topZs.length; j++) {
		const z = si.blue.topZs[j];
		if (j === 0) {
			talk(`YAnchor(${z.id},${padding + 1})`);
			let deltas = [];
			for (let ppem = pmin; ppem <= pmax; ppem++) {
				let source = roundings.rtg(strategy.BLUEZONE_TOP_CENTER, upm, ppem);
				let vtop = roundings.rtg(strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem)
					+ roundings.rtg(strategy.BLUEZONE_TOP_CENTER - strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem);
				deltas.push({
					ppem,
					delta: decideDelta(ROUNDING_SEGMENTS, source, vtop, upm, ppem) / ROUNDING_SEGMENTS
				})
			}
			talk(sanityDelta(z.id, deltas));
		} else {
			talk(`YLink(${si.blue.topZs[0].id}, ${z.id}, ${padding}, ${isXML ? '&lt;' : '<'})`)
		}
	}
	// ip decider
	let candidates = [];
	initCandidates: {
		for (let z of si.blue.bottomZs) {
			candidates.push({
				ipz: z.id,
				pOrg: z.y,
				pDsts: table(pmin, pmax, ppem => roundings.rtg(strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem))
			})
		}
		for (let z of si.blue.topZs) {
			candidates.push({
				ipz: z.id,
				pOrg: z.y,
				pDsts: table(pmin, pmax, ppem => (roundings.rtg(strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem)
					+ roundings.rtg(strategy.BLUEZONE_TOP_CENTER - strategy.BLUEZONE_BOTTOM_CENTER, upm, ppem)))
			})
		}
		for (let sid = 0; sid < si.stems.length; sid++) {
			const s = si.stems[sid];
			candidates.push({
				stem: s,
				sid: sid,
				ipz: s.posKey,
				pOrg: s.posKeyAtTop ? s.y0 : s.y0 - s.w0 - s.slope * s.keyDX,
				pDsts: null
			});
		}
		candidates = candidates.sort((a, b) => (a.pOrg - b.pOrg));
	}
	const refTop = candidates[candidates.length - 1];
	const refBottom = candidates[0];
	if (refTop && refBottom) {
		if (!refTop.pDsts) {
			talk(`/* !!IDH!! StemDef ${refTop.sid} TOP */`)
			talk(`YAnchor(${refTop.ipz})`);
			let { pDsts, buf } = encodeStem(refTop.stem, refTop.sid, sd, strategy, null);
			refTop.pDsts = pDsts;
			talk(buf);
		}
		if (!refBottom.pDsts) {
			talk(`/* !!IDH!! StemDef ${refBottom.sid} BOTTOM */`)
			talk(`YAnchor(${refBottom.ipz})`);
			let { pDsts, buf } = encodeStem(refBottom.stem, refBottom.sid, sd, strategy, null);
			refBottom.pDsts = pDsts;
			talk(buf);
		}
		const ipAnchorZs = [];
		for (let r of candidates) {
			if (!r.stem) continue;
			if (r.pDsts) continue;
			if (r.pOrg > refBottom.pOrg && r.pOrg < refTop.pOrg) {
				ipAnchorZs.push(r.ipz);
			}
		}
		if (ipAnchorZs.length) {
			talk(`YIPAnchor(${refBottom.ipz},${ipAnchorZs.join(',')},${refTop.ipz})`);
		}

		for (let r of candidates) {
			if (!r.stem) continue;
			if (r.pDsts) continue;
			if (r.pOrg > refBottom.pOrg && r.pOrg < refTop.pOrg) {
				talk(`/* !!IDH!! StemDef ${r.sid} INTERPOLATE */`);
				let pos0s = table(pmin, pmax, ppem => {
					const org_dist = r.pOrg - refBottom.pOrg;
					const org_range = refTop.pOrg - refBottom.pOrg;
					const cur_range = refTop.pDsts[ppem] - refBottom.pDsts[ppem];
					return refBottom.pDsts[ppem] + cur_range * org_dist / org_range;
				});
				let { pDsts, buf } = encodeStem(r.stem, r.sid, sd, strategy, pos0s);
				talk(buf);
				r.pDsts = pDsts;
			} else {
				talk(`/* !!IDH!! StemDef ${r.sid} DIRECT */`)
				talk(`YAnchor(${r.ipz})`);
				let { pDsts, buf } = encodeStem(r.stem, r.sid, sd, strategy, null);
				talk(buf);
				r.pDsts = pDsts;
			}
		}
	}
	/* Diag-aligns */
	for (let da of si.diagAligns) {
		if (!da.zs.length) continue;
		talk(`XAnchor(${da.l})`);
		talk(`XAnchor(${da.r})`);
		talk(`DAlign(${da.l},${da.zs.join(',')},${da.r})`);
	}
	/** IPSA calls */
	var l = 0;
	for (let j = 1; j < si.ipsacalls.length; j++) {
		if (si.ipsacalls[l] && si.ipsacalls[j]
			&& si.ipsacalls[l].length > 2
			&& si.ipsacalls[l].length < 16
			&& si.ipsacalls[j].length > 2
			&& si.ipsacalls[l][0] === si.ipsacalls[j][0]
			&& si.ipsacalls[l][1] === si.ipsacalls[j][1]) {
			si.ipsacalls[l].push(si.ipsacalls[j][2]);
			si.ipsacalls[j] = null;
		} else {
			l = j;
		}
	}
	for (let c of si.ipsacalls) {
		if (!c) continue;
		if (c.length >= 3) { // ip
			if (c[0] !== c[1]) talk(`YInterpolate(${c[0]},${c.slice(2).join(',')},${c[1]})`);
		} else {
			talk(`YShift(${c[0]},${c[1]})`);
		}
	}
	talk("Smooth()");
	return buf;
}

exports.talk = produceVTTTalk;
