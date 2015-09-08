'use strict';

var fs = require('fs');
var _ = require('lodash');
var esprintf = require('esprintf');
var util = require('util');

/**
 * Trims quotes off the passed string.
 * @param  {string} str
 * @return {string}
 */
function trimQuotes(str) {
	return str.replace(/^(['"])(.*?)\1$/, '$2');
}

/**
 * Utility function that throws a string formatted error
 */
function fError() {
	throw new Error(util.format.apply(undefined, arguments));
}

/**
 * @constructor
 * @param {string} description The program description to be displayed when using help.
 * @param {Object} config      The command line config parameters, please refer to the examles and/or the readme
 */
function ArgumentParser(description, config) {
	this.config = config;
	this.description = description || '';

	config.help = {
		type:			'boolean',
		description:	'Show the help'
	};

	var flagRegex = /^[\w_][\w_-]*$/i;
	var shortRegex = /^\w$/i;
	var validTypes = ['number', 'integer', 'string', 'array', 'file', 'boolean'];
	var validSubTypes = ['number', 'integer', 'string', 'file'];

	this.values = {};
	this.shortFlags = {};

	_.forEach(this.config, function(flagConfig, flagName, o) {
		if (!flagRegex.test(flagName)) {
			fError('Invalid flag %s, long flags must match /^[\\w_][\\w_-]*$/', flagName);
		}

		flagConfig.printName = _.kebabCase(flagName);

		if (flagConfig.required && flagConfig.default) {
			fError('Flag value cannot be required and have a default');
		}

		if	(flagConfig.enum &&
			(flagConfig.type || flagConfig.subType || flagConfig.regex || flagConfig.min || flagConfig.max)
			) {
			fError('Flag must not have any validation attributes if it is an enum');
		}

		flagConfig.type = flagConfig.type || 'string';//default to string
		if (validTypes.indexOf(flagConfig.type) === -1) {
			fError('Invalid argument to \'type\', \'%s\' specified must be [%s]', flagConfig.type, validTypes.join(','));
		}

		flagConfig.subType = flagConfig.subType || 'string';//default to string
		if (flagConfig.type === 'array') {
			if (validSubTypes.indexOf(flagConfig.subType) === -1) {
				fError('Invalid argument to \'subType\', \'%s\' specified must be [%s]', flagConfig.subType, validSubTypes.join(','));
			}
		}

		if (flagConfig.regex) {
			if (flagConfig.type === 'number' || flagConfig.type === 'integer') {
				fError('Cannot use \'regex\' when type is \'%s\'', flagConfig.type);
			}
			if (typeof flagConfig.regex === 'string') {
				flagConfig.regex = new RegExp(flagConfig.regex);//Error is propagated
			} else if (!(flagConfig.regex instanceof RegExp)) {
				fError('Invalid argument to \'regex\', must be either a RegExp or compilable string');
			}
		}

		if (flagConfig.min && typeof flagConfig.min !== 'number') {
			fError('Invalid argument to \'min\', must be a number');
		}

		if (flagConfig.max && typeof flagConfig.max !== 'number') {
			fError('Invalid argument to \'max\', must be a number');
		}

		if (flagConfig.validator && typeof flagConfig.validator !== 'function') {
			fError('Invalid argument to \'validator\', must be a function');
		}

		if (flagConfig.short) {
			if (typeof flagConfig.short !== 'string') {
				fError('Invalid argument to \'short\', must be a string');
			}

			if (!shortRegex.test(flagConfig.short)) {
				fError('Invalid argument to \'short\', string must match /^\\w$/');
			}
			if (this.shortFlags[flagConfig.short]) {
				fError('Dublicate short flag %s', flagConfig.short);
			}
			this.shortFlags[flagConfig.short] = flagName;
		}
	}, this);
}

var p = ArgumentParser.prototype;

/**
 * First match groups is the long flag indicator
 * Second match group is flag name
 * Third match group is the value of the flag
 * @type {RegExp}
 */
var cmdLineRegex = /(?:(--?)([\w_][\w_-]*))|((?:["'].*?["']|[^"',=\s]+)(?:,(?:["'].*?["']|[^'',\s]+))*)/ig;

/**
 * Attempts to split given command line input into usable pieces.
 * @private
 * @param  {string} line The command line string
 * @return {Array.<Object>}
 */
p.splitArgs = function(line) {
	var ret = [];
	line.replace(cmdLineRegex, function(match, shortDash, shortFlags, value) {
		if (shortDash === '-') {
			shortFlags.split('').forEach(function(shortFlag) {
				ret.push({
					isFlag: true,
					value: shortFlag,
					isShort: true
				});
			});
		} else {
			ret.push({
				isFlag: !!shortDash,
				value: shortDash ? shortFlags : value,
				isShort: false
			});
		}
	});
	return ret;
};

function handleType(entry, value, flag) {
	switch (entry.type) {
		case 'boolean':
			if (value === false) {
				return false;
			}
			return true;
		case 'integer':
			if (value.toString().indexOf('.') > -1) {
				fError('Argument for \'%s\' must be an integer value', flag);
			}
			value = parseInt(value);
			/* falls through */
		case 'number':

			value = parseFloat(value);

			if (!isFinite(value)) {
				fError('Could not parse number from argument for \'%s\'', flag);
			}
			if (entry.min && entry.max && (entry.max < value || entry.min > value)) {
				fError('Argument for \'%s\' must be between to %d and %d', flag, entry.min, entry.max);
			}
			if (entry.min && value < entry.min) {
				fError('Argument for \'%s\' must be greater or equal to %d', flag, entry.min);
			}

			if (entry.max && value > entry.max) {
				fError('Argument for \'%s\' must be less or equal to %d', flag, entry.max);
			}
			return value;
		case 'string'://heh
			if (entry.regex && !entry.regex.test(value)) {
				fError('Argument for \'%s\' did not match the regular expression %s', flag, entry.regex.source);
			}
			return value;
		case 'array'://we are assuming all arguments in the array should be of a uniform type
			if (typeof value === 'string') {
				value = value.split(',');
			}

			var subEntry = _.clone(entry);
			subEntry.type = entry.subType;

			return value.map(function(value, index, arr) {
				value = trimQuotes(value);
				return handleType(subEntry, value, flag);
			});
		case 'file':
			var path = value;

			var encoding = (entry.file && entry.file.json) ? 'utf8' : (entry.file ? entry.file.encoding : 'utf8');

			var data = fs.readFileSync(path, encoding);
			if (entry.file) {
				if (entry.file.json) {
					try {
						return JSON.parse(data);
					} catch (error) {
						fError('Could not parse json from file %s', path);
					}
				}
				if (entry.file.stream) {
					return fs.createReadStream(path);
				}
			}
			return data;
	}
}

/**
 * Handles the parsing and validation of a value
 * @private
 * @param  {Object} entry The corresponding flag config object for the flag.
 * @param  {string} value The raw string value associated with the flag
 * @param  {string} flag  The name of the flag
 * @return {*}
 */
p.handleValue = function(entry, value, flag) {


	if (!value && entry.default !== undefined) {
		value = entry.default;
	}

	if (value && typeof value === 'string' || typeof value === 'array') {
		value = trimQuotes(value);
	}

	if (entry.enum && entry.enum.indexOf(value) === -1) {
		fError('Invalid enum value for \'%s\' must be in [%s]', flag, entry.enum.join(','));
	}

	value = handleType(entry, value, flag);

	if (entry.validator) {
		try {
			var validated = entry.validator(value);
			if (validated !== undefined) {
				value = validated;
			}
		} catch (error) {
			fError('Validator failed for argument for \'%s\', \'%s\'', flag, error.message);
		}
	}
	return value;
};

/**
 * Processes the individual flags and pre-filters non-existant ones.
 * Also handles flag-value associations.
 * @private
 * @param  {Object}   curr The parsed flag/value info
 * @param  {Object} next The next parse flag/value info
 * @return {*}
 */
p.handleFlag = function(curr, next) {
	var name = curr.value;
	if (curr.isShort) {
		name = this.shortFlags[name];
	}

	var entry = this.config[name];
	if (!entry) {
		fError('Unknown flag \'%s\'', name);
	}
	if (this.values[curr.value]) {
		fError('Dublicate flag \'%s\'', name);
	}
	if (entry.type !== 'boolean' && entry.default === undefined && (!next || next.isFlag)) {
		fError('Flag \'%s\' requires a value', name);
	}
	var value;
	if (entry.type === 'boolean') {
		value = true;
	} else {
		value = next && next.value;
	}
	this.values[name] = this.handleValue(entry, value, name);
};

/**
 * Generates the help string for the specified flag name.
 * @public
 * @param  {string} flagName
 * @return {string}
 */
p.getFlagHelpInfo = function(flagName) {
	var conf = this.config[flagName];
	var typeString = '';
	if (conf.enum) {
		typeString = 'enum (' + conf.enum.join(',') + ')';
	} else {
		switch (conf.type) {
			case 'number':
			case 'integer':
				typeString = (conf.min ? (conf.min + '<=') : '') + conf.type + (conf.max ? ('<=' + conf.max) : '');
				break;
			case 'string':
				typeString = 'string' + (conf.regex ? ' matching ' + conf.regex.source : '');
				break;
			case 'array':
				typeString = 'array of ' + conf.subType;
				break;
			case 'file':
				typeString = 'file';
		}
	}

	return {
		printName:		conf.printName,
		type:			typeString,
		default:		conf.default !== undefined ? conf.default : '',
		required:		conf.required === true,
		description:	conf.description || ''
	};
};

/**
 * @public
 * Builds the complete help info.
 * @return {string}
 */
p.getHelpString = function() {

	var helpInfos = _.map(this.config, function(value, flagName) {
		return this.getFlagHelpInfo(flagName);
	}, this);

	_.sortBy(helpInfos, 'printName');

	var max = {};

	helpInfos.push({//take header size into account
		printName:		'Name',
		type:			'Type',
		default:		'Default',
		required:		'Required',
		description:	'Description'
	});

	_.forEach(['printName', 'type', 'default', 'required', 'description'], function(attribute) {
		max[attribute] = _.max(helpInfos, function(helpInfo) {
			return helpInfo[attribute].toString().length;
		})[attribute].toString().length + 1;
	});

	helpInfos.pop();

	var sprintfMask = '%-*s %-*s %-*s %-*s %-*s';

	var ret = [];
	ret.push('Description: ' + this.description);
	ret.push(
		esprintf(
			sprintfMask,
			'Name',
			max.printName,
			'Type',
			max.type,
			'Default',
			max.default,
			'Required',
			max.required,
			'Description',
			max.description
		)
	);
	ret.push('');
	_.forEach(helpInfos, function(info) {
		ret.push(
			esprintf(
				sprintfMask,
				info.printName,
				max.printName,
				info.type,
				max.type,
				info.default,
				max.default,
				info.required,
				max.required,
				info.description,
				max.description
			)
		);
	}, this);
	return ret.join('\n');
};

/**
 * Main function that initiates the parsing, validation and refinement of the data
 * @public
 * @param  {string} str
 * @return {Object.<string, *>}
 */
p.parse = function(str) {
	var split = this.splitArgs(str);
	var stopParse = false;
	split.forEach(function(flag) {
		if (flag.isFlag && flag.value === 'help') {
			stopParse = true;
		}
	}, this);
	if (stopParse) {
		return false;
	}

	var self = this;

	var skipNext = false;

	_.forEach(split, function(curr, index) {
		if (skipNext) {
			skipNext = false;
			return;
		}
		var next = split[index + 1];
		if (!curr.isFlag && next) {
			fError('Unhandled value %s', curr.value);
		} else if (!curr.isFlag && !next && (!split[index - 1] || (split[index - 1] && !split[index - 1].isFlag))) {
			self.values.__append__ = curr.value;
			return;
		}
		curr.value = _.camelCase(curr.value);
		self.handleFlag(curr, next);

		if (next && !next.isFlag) {
			skipNext = true;
		}
	});

	_.forEach(self.config, function(v, k, o) {
		if (!self.values[k]) {
			if (v.required) {
				fError('Flag \'%s\' is required but was not set', k);
			} else if (v.default !== undefined) {
				self.values[k] = this.handleValue(v, undefined, k);
			}
		}
	}, this);
	return self.values;
};

/**
 * Utility function that directory passes the fixed command line args to the parse function.
 * @return {Object.<string, *>}
 */
p.run = function() {
	return this.parse(
		process.argv.slice(2)
		.map(function(segment) {
			if (segment.match(/\s+/)) {
				console.log(segment);
				return '"' + segment + '"';
			}
			return segment;
		}
	)
	.join(' '));
};

module.exports = ArgumentParser;
