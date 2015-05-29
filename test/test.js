'use strict';

var assert = require('assert'); // node.js core module
var fs = require('fs');

var ArgumentParser = require('../index');

/* global describe, it */

function testErrorMessage(regex) {
	return function(error) {
		return regex.test(error.message);
	};
}

function dArg(obj) {
	return new ArgumentParser('test', obj);
}

describe('ArgumentParser', function() {

	describe('ArgumentParser()', function() {
				it('Should throw when trying to specify a flag with a bad name', function() {
			assert.throws(
				function() {
					dArg({
						$: {
							type: 'integer'
						}
					});
				},
				testErrorMessage(/long flags must match/),
				'Did not throw error'
			);
		});

		it('Should throw when a flag is required and has a default', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'integer',
							required:	true,
							default:	1
						}
					});
				},
				testErrorMessage(/Flag value cannot be required and have a default/),
				'Did not throw error'
			);
		});

		it('Should throw when a flag is required and has a default', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'integer',
							required:	true,
							default:	1
						}
					});
				},
				testErrorMessage(/Flag value cannot be required and have a default/),
				'Did not throw error'
			);
		});

		it('Should throw when a flag is is an enum and has other attributes', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							enum:		['a', 'b'],
							type:		'string'
						}
					});
				},
				testErrorMessage(/Flag must not have any validation attributes if it is an enum/),
				'Did not throw error'
			);
		});

		it('Should throw when the specified type is unknown', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'dongs'
						}
					});
				},
				testErrorMessage(/Invalid argument to 'type'/),
				'Did not throw error'
			);
		});

		it('Should throw when the specified subType is unknown', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'array',
							subType:	'dongs'
						}
					});
				},
				testErrorMessage(/Invalid argument to 'subType'/),
				'Did not throw error'
			);
		});

		it('Should throw when regex was not string or RegExp', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'string',
							regex:		1
						}
					});
				},
				testErrorMessage(/must be either a RegExp or compilable string/),
				'Did not throw error'
			);
		});

		it('Should throw when it could not compile the regex', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'string',
							regex:		'('
						}
					});
				},
				testErrorMessage(/Invalid regular expression/),
				'Did not throw error'
			);
		});

		it('Should throw when min is not a number', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'integer',
							min:		'b'
						}
					});
				},
				testErrorMessage(/must be a number/),
				'Did not throw error'
			);
		});

		it('Should throw when max is not a number', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'integer',
							max:		'b'
						}
					});
				},
				testErrorMessage(/must be a number/),
				'Did not throw error'
			);
		});

		it('Should throw when validator is not a function', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:			'integer',
							validator:		'b'
						}
					});
				},
				testErrorMessage(/must be a function/),
				'Did not throw error'
			);
		});

		it('Should throw when short is not a string', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:			'integer',
							short:			1
						}
					});
				},
				testErrorMessage(/must be a string/),
				'Did not throw error'
			);
		});

		it('Should throw when short is invalid', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:			'integer',
							short:			'-'
						}
					});
				},
				testErrorMessage(/string must match/),
				'Did not throw error'
			);
		});

		it('Should throw when short is duplicate', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:			'integer',
							short:			'a'
						},
						test2: {
							type:			'integer',
							short:			'a'
						}
					});
				},
				testErrorMessage(/Dublicate short flag/),
				'Did not throw error'
			);
		});

		it('Should throw when regex is specified for integer/number', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:			'integer',
							regex:			/test/
						}
					});
				},
				testErrorMessage(/Cannot use 'regex' when type is/),
				'Did not throw error'
			);
		});
	});


	describe('#parse()', function() {

		it('Should throw when the input is garbage', function() {
			assert.throws(
				function() {
					dArg({}).parse('sertzowe785nw3z8945psyie80wzsh\'\'+!!!daefpüs--');
				},
				Error,
				'Did not throw error'
			);
		});

		it('Should supports flags with dashes', function() {
			assert(dArg({
				testThis: {
					type: 'boolean'
				}
			}).parse('--test-this').testThis, true);
		});

		it('Should return false when --help was set', function() {
			assert.equal(dArg({}).parse('--help'), false, 'Is not false');
		});

		it('Should throw an error when an unregister flag is set', function() {
			assert.throws(
				function() {
					dArg({}).parse('--test');
				},
				testErrorMessage(/Unknown flag/),
				'Did not throw error'
			);
		});

		it('Should parse a single boolean flag', function() {
			assert(
				dArg({
					test: {
						type: 'boolean'
					}
				}).parse('--test').test,
				true
			);
		});

		it('Should parse a single boolean flag and fallback to the default value', function() {
			assert(
				dArg({
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
				dArg({
					test: {
						type:		'boolean',
						default:	false
					}
				}).parse('').test,
				false
			);

			assert.equal(
				dArg({
					test: {
						type:		'integer',
						default:	0
					}
				}).parse('').test,
				0
			);

			assert.equal(
				dArg({
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
				dArg({
					test: {
						type: 'string'
					}
				}).parse('--test hello').test,
				'hello'
			);
		});

		it('Should parse a single integer flag', function() {
			assert.equal(
				dArg({
					test: {
						type: 'integer'
					}
				}).parse('--test 123').test,
				123
			);
		});

		it('Should parse a single integer flag and fallback to its default value', function() {
			assert.equal(
				dArg({
					test: {
						type:		'integer',
						default:	123
					}
				}).parse('--test').test,
				123
			);
		});

		it('Should throw an error if it could not parse an integer', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type: 'integer'
						}
					}).parse('--test dongs');
				},
				testErrorMessage(/Could not parse number/)
			);
		});

		it('Should throw an error if the specified value is out of range', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:	'integer',
							min:	1,
							max:	2
						}
					}).parse('--test 3');
				},
				testErrorMessage(/must be between to/),
				'Did not throw error'
			);

			assert.throws(
				function() {
					dArg({
						test: {
							type:	'integer',
							min:	1
						}
					}).parse('--test 0');
				},
				testErrorMessage(/must be greater or equal to/),
				'Did not throw error'
			);

			assert.throws(
				function() {
					dArg({
						test: {
							type:	'integer',
							max:	1
						}
					}).parse('--test 2');
				},
				testErrorMessage(/must be less or equal to/),
				'Did not throw error'
			);

		});


		it('Should throw an error if the number was passed a float', function() {
			assert.throws(
				function() {
					return dArg({
						test: {
							type: 'integer'
						}
					}).parse('--test 3.4141');
				},
				Error,
				'Did not throw error'
			);
		});

		it('Should parse a single number flag', function() {
			assert.equal(
				dArg({
					test: {
						type: 'number'
					}
				}).parse('--test 3.1415').test,
				3.1415
			);
		});

		it('Should validate strings using regex', function() {
			assert.throws(
				function() {
					return dArg({
						test: {
							type:	'string',
							regex:	/[a-f]+/
						}
					}).parse('--test g');
				},
				Error,
				'Did not throw error'
			);
		});

		it('Should parse a single array flag with number subtype', function() {
			assert.deepEqual(
				dArg({
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
				dArg({
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
				dArg({
					test: {
						type:		'file'
					}
				}).parse('--test test/simple_file.txt').test,
				'hello, world!'
			);
		});

		it('Should parse a single file flag and return the contents as json', function() {
			assert.deepEqual(
				dArg({
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

		it('Should throw when json file contents are corrupted', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'file',
							file: {
								json: true
							}
						}
					}).parse('--test test/damaged_json.json');
				},
				testErrorMessage(/Could not parse json from file/),
				'Did not throw error'
			);
		});

		it('Should parse a single file flag and return the contents as stream', function() {
			assert(
				dArg({
					test: {
						type:		'file',
						file: {
							stream: true
						}
					}
				}).parse('--test test/simple_file.json').test instanceof fs.ReadStream
			);
		});

		it('Should error when the file specified could not be opened', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'file'
						}
					}).parse('--test test/simple_file.jsn');
				},
				Error,
				'Did not throw error'
			);
		});

		it('Should be able to validate a value', function() {
			assert.throws(
				function() {
				dArg({
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
				dArg({
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
				dArg({
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
				dArg({
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
				dArg({
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
				dArg({
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
				dArg({
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
				dArg({
				}).parse('test'),
				{
					__append__: 'test'
				}
			);
		});

		it('Should error when a required flag was not set', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							required:	true,
							type:		'integer'
						}
					}).parse('');
				},
				Error,
				'Did not throw error'
			);
		});

		it('Should error when a flag was set twice', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'integer'
						}
					}).parse('--test 1 --test 1');
				},
				Error,
				'Did not throw error'
			);
		});

		it('Should error when a non-boolean flag has no value', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type:		'integer'
						}
					}).parse('--test');
				},
				function(error) {
					return error instanceof Error && error.message === 'Flag \'test\' requires a value';
				},
				'Did not throw error'
			);
		});

		it('Should error when an unknown enum is used', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							enum:		['a', 'b']
						}
					}).parse('--test c');
				},
				Error,
				'Did not throw error'
			);
		});

		it('Should error when an unknown enum is used', function() {
			assert.throws(
				function() {
					dArg({
						test: {
							type: 'integer',
							validator: function() {

							}
						}
					}).parse('--test c');
				},
				Error,
				'Did not throw error'
			);
		});

	});




// jshint multistr: true
var argumentTestString = 'Description: test\n\
Name    Type                  Default  Required  Description   \n\
\n\
test    string matching hurp           false                   \n\
test-2  enum (a,b,c)                   false                   \n\
test-3  file                           false                   \n\
test-4  1<=number<=5          3        false                   \n\
test-5  array of string                false                   \n\
help                                   false     Show the help ';
// jshint multistr: false

	describe('#getHelpString()', function() {

		it('Correctly prints a simple help info', function() {

			assert.equal(
				dArg({
					test: {
						type:	'string',
						regex:	/hurp/
					},
					test2: {
						enum: ['a', 'b', 'c']
					},
					test3: {
						type: 'file'
					},
					test4: {
						type:		'number',
						min:		1,
						max:		5,
						default:	3
					},
					test5: {
						type:		'array',
						subType:	'string'
					}
				}).getHelpString(),
				argumentTestString
			);
		});

	});

	describe('#run()', function() {

		it('Correctly pipes process.argv', function() {
			var oldArgv = process.argv;
			process.argv = ['program', 'other', '--test', '1'];
			assert.equal(
				dArg({
					test: {
						type:	'integer'
					}
				}).run().test,
				1
			);
			process.argv = oldArgv;
		});

	});
});
