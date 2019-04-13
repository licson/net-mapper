const jsonRead = require('read-json-stream').default;
const fs = require('fs');

class Mapper {
	constructor() {
		this.data = null;
		this.last = null;
		this.current = null;
		this.netmask = [ 255, 255, 255, 252 ];
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

	writeGVNode(start, end, colour) {
		this.output.write(`\t${start} -- ${end} [color=${colour}]\n`);
	}

	writeGVEnd() {
		this.output.write('}');
		this.output.end();
	}

	inSameSubnet(a, b) {
		let parseIP = ip => ip.split('.').map(o => parseInt(o));
		let aa = parseIP(a);
		let bb = parseIP(b);

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
		switch (indicator.toLowerCase()) {
			case 'fa':
			case 'fe':
				return 'red';
			case 'gi':
			case 'ge':
				return 'yellow';
			case 'te':
			case 'ten':
			case 'teng':
			case 'tenge':
				return 'blue';
			case 'hu':
			case 'hundredge':
			case 'hundredgige':
				return 'orange';
			case 'pos':
				return 'green';
			default:
				return 'black';
		}
	}

	parseName(name) {
		let regex = /([a-z\-]+\.)?([a-z]+|bundle-ether)-?((\d+-){0,3}\d+)(\.\d+)?\.((br|cr|sw|scbr|dcbr|clbr|var)\d+)\.(\w+)/gi;
		let parts = regex.exec(name);

		if (parts !== null) {
			return {
				node: parts[8],
				speed: parts[2],
			};
		}

		return false;
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
						this.writeGVNode(
							prevIPdata.node,
							currentIPdata.node,
							this.linkSpeedToColour(currentIPdata.speed)
						);
					}
				}
			}

			this.last = entry;
		});

		this.writeGVEnd();
	}
}

new Mapper();
