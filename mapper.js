const jsonRead = require('read-json-stream').default;
const fs = require('fs');

class Mapper {
	constructor() {
		this.data = null;
		this.last = null;
		this.current = null;
		this.netmask = [ 255, 255, 255, 252 ];
		this.graph = new Map();
		this.output = fs.createWriteStream('./graph.gv');

		jsonRead('./dns-records.json').done((e, data) => {
			if (e) process.exit(1);

			this.data = data;
			this.process();
		});
	}

	writeGVHead() {
		this.output.write('graph network {\n');
		this.output.write('\tnode [shape=box]\n\n');
		this.output.write('\t# Graph Start\n');
	}

	writeGVNode(start, end, colour, label) {
		this.output.write(`\t${start} -- ${end} [color=${colour},label="${label}"]\n`);
	}

	writeGVEnd() {
		this.output.write('}');
		this.output.end();
	}

	inSameSubnet(a, b) {
		let parseIP = ip => ip.split('.').map(o => parseInt(o));
		let aa = parseIP(a);

		let ipPair = [
			[
				aa[0] & this.netmask[0],
				aa[1] & this.netmask[1],
				aa[2] & this.netmask[2],
				(aa[3] & this.netmask[3]) + 1,
			].join('.'),
			[
				aa[0] | (~this.netmask[0] & 0xff),
				aa[1] | (~this.netmask[1] & 0xff),
				aa[2] | (~this.netmask[2] & 0xff),
				(aa[3] | (~this.netmask[3] & 0xff)) - 1
			].join('.')
		];

		return ipPair.indexOf(a) >= 0 && ipPair.indexOf(b) >= 0;
	}

	linkSpeedToColour(indicator) {
		if (indicator < 10000) {
			return 'black';
		} else if (indicator < 50000) {
			return 'blue';
		} else if (indicator < 100000) {
			return 'green';
		} else if (indicator < 200000) {
			return 'orange';
		} else {
			return 'red';
		}
	}

	linkSpeedToNumber(indicator) {
		switch (indicator) {
			case 'fa':
			case 'fe':
				return 100;
			case 'g':
			case 'gi':
			case 'ge':
				return 1000;
			case 'te':
			case 'ten':
			case 'teng':
			case 'tenge':
				return 10000;
			case 'hu':
			case 'hundredge':
			case 'hundredgige':
				return 100000;
			case 'pos':
				return 2488; // Multiple speeds exists
			case 'ser':
				return 45; // Assume T3/E1
			default:
				return 0;
		}
	}

	parseName(name) {
		let regex = /([a-z\-]+\.)?([a-z]+|bundle-ether)-?((\d+-){0,3}\d+)(\.\d+)?\.((br|cr|sw|scbr|dcbr|clbr|var)\d+)\.(\w+)/gi;
		let parts = regex.exec(name);

		if (parts !== null) {
			return {
				node: parts[8].substr(0, 3),
				speed: parts[2],
			};
		}

		return false;
	}

	addToGraph(a, b) {
		let name = [a.node, b.node].sort().join('-');

		if (this.graph.has(name)) {
			let old = this.graph.get(name);
			this.graph.set(name, old.concat([ this.linkSpeedToNumber(a.speed) ]));
		} else {
			this.graph.set(name, [ this.linkSpeedToNumber(a.speed) ]);
		}
	}

	formatSpeed(num) {
		let mag = Math.floor(Math.log(num) / Math.log(1000));
		let speeds = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
		return (num / Math.pow(1000, mag)) + speeds[mag];
	}

	processGraph() {
		this.graph.forEach((speeds, pair) => {
			let totalThroughput = speeds.reduce((a, b) => a + b, 0);
			let nodes = pair.split('-');

			this.writeGVNode(nodes[0], nodes[1], this.linkSpeedToColour(totalThroughput), ` ${this.formatSpeed(totalThroughput * 1000000)}`);
		});

		this.writeGVEnd();
	}

	process() {
		this.writeGVHead();

		this.data.forEach(entry => {
			if (entry === null) return;

			this.current = entry;
			if (this.last === null) this.last = entry;

			// Matched a pair of address
			if (this.inSameSubnet(this.current.ip, this.last.ip)) {
				let prevIPdata = this.parseName(this.last.name);
				let currentIPdata = this.parseName(this.current.name);

				if (prevIPdata !== false && currentIPdata !== false) {
					// Both IPs are interface IPs
					if (prevIPdata.node != currentIPdata.node) {
						this.addToGraph(currentIPdata, prevIPdata);
					}
				}
			}

			this.last = entry;
		});

		this.processGraph();
	}
}

new Mapper();
