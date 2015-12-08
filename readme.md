# argument-parser-extended

[![NPM](https://nodei.co/npm/argument-parser-extended.png)](https://nodei.co/npm/argument-parser-extended/)

[![Build Status](https://travis-ci.org/SimonSchick/argument-parser-extended.svg?branch=master)](https://travis-ci.org/SimonSchick/argument-parser-extended)
[![Dependencies](https://david-dm.org/SimonSchick/argument-parser-extended.svg)](https://david-dm.org/SimonSchick/argument-parser-extended)
[![Coverage Status](https://coveralls.io/repos/SimonSchick/argument-parser-extended/badge.svg)](https://coveralls.io/r/SimonSchick/argument-parser-extended)
[![npm version](http://img.shields.io/npm/v/argument-parser-extended.svg)](https://npmjs.org/package/argument-parser-extended)

## Requirements & Installation

Just run npm install argument-parse

## Documentation

### ArgumentParser(name, options)

* name - Name of the program
* options - Options to be used for validation, see below.

All keys in options are automatically converted from lower camel-case to kebab-case.

```
{
	flagName: {
		enum: ['list', 'of', 'values', 'accepted'], //conflicts with all other validation parameters.
		type: 'boolean|number|string|array|integer|file'//defaults to boolean, if array all validators will be applied to each element.
		default: 'myDefaultValueIfSwitchIsNotSet',
		required: true|false, //will error if a set to true and a default exists
		min: minValue, //only works for integer and number
		max: maxValue, //see above
		regex: /some regex/, //only works for type string, will cause the parser to throw an error if the passed string does not match
		subType: 'boolean|number|string|integer|file', //The type to be validated if type is an array,
		file: { //only works when type = file
			json: true|false, //is the content json?
			stream: true|false, //return a stream rather than reading the whole file,
			encoding: string, //default is utf8
		},
		short: sting, //must be length of 1, the short flag to alias the flag with
		validator: function //will be called with the preprocessed value parsed from the flag, this function can override the return value by simply returning != undefined, otherwise it should just throw an error.
	}
}
```

### Object ArgumentParser.parse(str)

Parses the given string and returns a object representing the parsed data, throws if anything failed.

All "additional" data that was not associated with a flag will be available in the __append__ field.

### Object ArgumentParser.run()

Parses the command line directly, otherwise behaves just like parse.

### string ArgumentParser.getHelpString()

Returns a nicely formatted usage info.

## Usage examples

```js
var ArgumentParser = require('argument-parser-extended');

var argParser = new ArgumentParser('example', {
	myParam: {
		type: 'string',
		default: 'nothing'
	},
	myConfig: {
		type: 'file',
		file: {
			json: true
		}
	}
});

var conf;
try {
	conf = argParser.run();
} catch(e) {
	console.error(argParser.getHelpText());
	return;
}

console.log(conf.myParam, conf.myConfig);
```

```
node filename.js --my-param hello --my-config path/to/json.json
```
