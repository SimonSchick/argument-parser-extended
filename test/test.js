'use strict';

var assert = require('assert'); // node.js core module
var fs = require('fs');

var ArgumentParser = require('../index');

/* global describe, it */

describe('ArgumentParser', function() {
	describe('#parse()', function() {

		it('Should throw when the input is garbage', function() {
			assert.throws(
				function() {
					new ArgumentParser('test', {}).parse('sertzowe785nw3z8945psyie80wzsh\'\'+!!!daefpüs--');
				},
				Error,
				'Did not throw error'
			);
		});

		it('Should supports flags with dashes', function() {
			assert(new ArgumentParser('test', {
				testThis: {
					type: 'boolean'
				}
			}).parse('--test-this').testThis, true);
		});

		it('Should return false when --help was set', function() {
			assert.equal(new ArgumentParser('test', {}).parse('--help'), false, 'Is not false');
		});

		it('Should throw an error when an unregister flag is set', function() {
			assert.throws(
				function() {
					new ArgumentParser('test', {}).parse('--test');
				},
				Error,
				'Did not throw error'
			);
		});

		it('Should parse a single boolean flag', function() {
			assert(
				new ArgumentParser('test', {
					test: {
						type: 'boolean'
					}
				}).parse('--test').test,
				true
			);
		});

		it('Should parse a single boolean flag and fallback to the default value', function() {
			assert(
				new ArgumentParser('test', {
					test: {
						type:		'boolean',
						default:	true
					}
				}).parse('--test').test,
				true
			);
		});

		it('Should fall back to falsy default values', function() {
			assert.equal(
				new ArgumentParser('test', {
					test: {
						type:		'boolean',
						default:	false
					}
				}).parse('').test,
				false
			);

			assert.equal(
				new ArgumentParser('test', {
					test: {
						type:		'integer',
						default:	0
					}
				}).parse('').test,
				0
			);

			assert.equal(
				new ArgumentParser('test', {
					test: {
						type:		'string',
						default:	''
					}
				}).parse('').test,
				''
			);
		});

		it('Should parse a single string flag', function() {
			assert.equal(
				new ArgumentParser('test', {
					test: {
						type: 'string'
					}
				}).parse('--test hello').test,
				'hello'
			);
		});

		it('Should parse a single integer flag', function() {
			assert.equal(
				new ArgumentParser('test', {
					test: {
						type: 'integer'
					}
				}).parse('--test 123').test,
				123
			);
		});

		it('Should parse a single integer flag and fallback to its default value', function() {
			assert.equal(
				new ArgumentParser('test', {
					test: {
						type:		'integer',
						default:	123
					}
				}).parse('--test').test,
				123
			);
		});

		it('Should throw an error if it could not parse an integer', function() {
			assert.throws(function() {
				new ArgumentParser('test', {
					test: {
						type: 'integer'
					}
				}).parse('--test dongs');
			});
		});

		it('Should throw an error if the number was passed a float', function() {
			assert.throws(function() {
				return new ArgumentParser('test', {
					test: {
						type: 'integer'
					}
				}).parse('--test 3.4141');
			});
		});

		it('Should parse a single number flag', function() {
			assert.equal(
				new ArgumentParser('test', {
					test: {
						type: 'number'
					}
				}).parse('--test 3.1415').test,
				3.1415
			);
		});

		it('Should parse a single array flag with number subtype', function() {
			assert.deepEqual(
				new ArgumentParser('test', {
					test: {
						type:		'array',
						subType:	'number'
					}
				}).parse('--test 1,2,3,4,5,6').test,
				[1, 2, 3, 4, 5, 6]
			);
		});

		it('Should parse a single array flag with string subtype', function() {
			assert.deepEqual(
				new ArgumentParser('test', {
					test: {
						type:		'array',
						subType:	'string'
					}
				}).parse('--test "hello,my,name,is a,penis,:D"').test,
				['hello', 'my', 'name', 'is a', 'penis', ':D']
			);
		});

		it('Should parse a single file flag and return the contents', function() {
			assert.equal(
				new ArgumentParser('test', {
					test: {
						type:		'file'
					}
				}).parse('--test test/simple_file.txt').test,
				'hello, world!'
			);
		});

		it('Should parse a single file flag and return the contents as json', function() {
			assert.deepEqual(
				new ArgumentParser('test', {
					test: {
						type:		'file',
						file: {
							json: true
						}
					}
				}).parse('--test test/simple_file.json').test,
				{
					hello: 'world'
				}
			);
		});

		it('Should parse a single file flag and return the contents as stream', function() {
			assert(
				new ArgumentParser('test', {
					test: {
						type:		'file',
						file: {
							stream: true
						}
					}
				}).parse('--test test/simple_file.json').test instanceof fs.ReadStream
			);
		});

		it('Should be able to validate a value', function() {
			assert.throws(function() {
				new ArgumentParser('test', {
					test: {
						type:		'integer',
						validator:	function(val) {
							if (val % 2 !== 0) {
								throw new Error('must be a multiple of 2');
							}
						}
					}
				}).parse('--test 1');
			}, function(error) {
				return error instanceof Error && error.message.indexOf('must be a multiple of 2') > -1;
			});
		});

		it('Should be able to transform a value with a validator', function() {
			assert.equal(
				new ArgumentParser('test', {
					test: {
						type:		'integer',
						validator:	function(val) {
							return val * 2;
						}
					}
				}).parse('--test 1').test,
				2
			);
		});

		it('Should be able to parse a single short flag', function() {
			assert.equal(
				new ArgumentParser('test', {
					test: {
						type:		'integer',
						short:		't'
					}
				}).parse('-t 1').test,
				1
			);
		});

		it('Should be able to parse a multiple short flag', function() {
			assert.deepEqual(
				new ArgumentParser('test', {
					test: {
						type:		'integer',
						short:		't'
					},
					test2: {
						type:		'integer',
						short:		'u'
					}
				}).parse('-t 1 -u 2'),
				{
					test:	1,
					test2:	2
				}
			);
		});

		it('Should be able to parse multiple boolean flags', function() {
			assert.deepEqual(
				new ArgumentParser('test', {
					a: {
						type:		'boolean',
						short:		'a'
					},
					b: {
						type:		'boolean',
						short:		'b'
					},
					c: {
						type:		'boolean',
						short:		'c'
					}
				}).parse('-abc'),
				{
					a:	true,
					b:	true,
					c:	true
				}
			);
		});

		it('Should be able to parse mixed short and long flags without values', function() {
			assert.deepEqual(
				new ArgumentParser('test', {
					a: {
						type:		'boolean',
						short:		'a'
					},
					b: {
						type:		'boolean',
						short:		'b'
					},
					c: {
						type:		'boolean',
						short:		'c'
					}
				}).parse('-a --b --c'),
				{
					a:	true,
					b:	true,
					c:	true
				}
			);
		});

		it('Should be able to parse mixed short and long flags with values', function() {
			assert.deepEqual(
				new ArgumentParser('test', {
					a: {
						type:		'integer',
						short:		'a',
						default:	2
					},
					b: {
						type:		'integer',
						short:		'b'
					},
					c: {
						type:		'integer',
						short:		'c'
					}
				}).parse('-b 1 --c 2'),
				{
					a:	2,
					b:	1,
					c:	2
				}
			);
		});

		it('Should regocnize a general parameter', function() {
			assert.deepEqual(
				new ArgumentParser('test', {
				}).parse('test'),
				{
					__append__: 'test'
				}
			);
		});
	});

	describe('#getHelpString()', function() {

		it('Correctly prints a simple help info', function() {
			assert.equal(
				new ArgumentParser('test', {
					test: {
						type: 'string'
					}
				}).getHelpString(),
				'Description: test\nName  Type    Default  Required  Description   \n\ntest  string           false                   \nhelp                   false     Show the help '
			);
		});

	});

});
