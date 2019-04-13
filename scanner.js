const dns = require('dns');
const fs = require('fs');
const retry = require('promise-retry');
const pbar = require('cli-progress');

class Scanner {
	constructor(opts) {
		this.startIP = this.ip2dec(opts.start);
		this.endIP = this.ip2dec(opts.end);
		this.records = [];

		this.batch = 0;
		this.batchSize = 64;
		this.bar = new pbar.Bar(
			{ format: 'Scanning #{value} of {total}... {bar} {percentage}% | {eta_formatted} remaining' },
			pbar.Presets.shades_classic
		);

		this.file = fs.createWriteStream('dns-records.json');
		this.file.write('[');

		dns.setServers([ '210.0.128.250', '210.0.128.251', '1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4' ]);
	}

	ip2dec(ip) {
		var octets = ip.split('.').map(oct => parseInt(oct));
		return octets[0] << 24 | octets[1] << 16 | octets[2] << 8 | octets[3];
	}

	dec2ip(dec) {
		var b1 = dec >> 24 & 0xff;
		var b2 = dec >> 16 & 0xff;
		var b3 = dec >> 8 & 0xff;
		var b4 = dec & 0xff;
		return [ b1, b2, b3, b4 ].join('.');
	}

	dec2ptr(dec) {
		var b1 = dec >> 24 & 0xff;
		var b2 = dec >> 16 & 0xff;
		var b3 = dec >> 8 & 0xff;
		var b4 = dec & 0xff;
		return [ b4, b3, b2, b1 ].join('.') + '.in-addr.arpa';
	}

	writeRecord(record) {
		this.file.write(JSON.stringify(record) + ',');
	}

	process(pointer) {
		if (pointer >= this.endIP) {
			this.done();
			return;
		}

		// recalculate new batch size if mismatch
		if (this.endIP - pointer + 1 < this.batchSize) {
			this.batchSize = this.endIP - pointer + 1;
		}

		var self = this;
		var pendingResolveJobs = [];

		for (var i = 0; i < this.batchSize; i++) {
			var addr = pointer + i;
			var resolveJob = new Promise(function(resolve) {
				var ip = self.dec2ip(addr);
				dns.resolvePtr(self.dec2ptr(addr), function(e, result) {
					if (e)
						resolve(null);
					else
						resolve({
							ip: ip,
							name: result[0],
						});
					
					self.bar.increment();
				});
			});

			pendingResolveJobs.push(resolveJob);
		}

		Promise.all(pendingResolveJobs).then(function(result) {
			self.records = self.records.concat(result.filter(i => i !== null));
			self.batch++;

			result.forEach(i => {
				if (i !== null) self.writeRecord(i);
			});

			self.process(pointer + self.batchSize);
		});
	}

	start() {
		this.bar.start(this.endIP - this.startIP + 1, 0);
		this.process(this.startIP);
	}

	done() {
		this.bar.stop();

		// End the file
		this.file.write('null]');
		this.file.end();
	}
}

var a = new Scanner({ start: '63.216.0.0', end: '63.223.255.255' });
a.start();
