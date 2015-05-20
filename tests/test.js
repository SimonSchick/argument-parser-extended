'use strict';

var ArgumentParser = require('../index');

var parser = new ArgumentParser('Xing clickbot that visits profiles based on keywords', {
	ab: {
		type:			'string',
		description:	'aioghsdioughsdoigdpfgodjgodipfg'
	},
	cd: {
		type:			'array',
		subType:		'string',
		description:	'aioghsdioughsdoigdpfgodjgodipfg'
	}
});

console.log(parser.run());
