'use strict';

var fs = require('fs');
var _ = require('lodash');
var esprintf = require('esprintf');

/**
 * Trims quotes off the passed string.
 * @param  {string} str
 * @return {string}
 */
function trimQuotes(str) {
	return str.replace(/^(['"])(.*?)\1$/, '$2');
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
			throw new Error('Invalid flag ' + flagName + ', long flags must match /^[\\w_][\\w_-]*$/');
		}

		flagConfig.printName = _.kebabCase(flagName);

		if (flagConfig.required && flagConfig.default) {
			throw new Error('Flag value cannot be required and have a default');
		}

		if	(flagConfig.enum &&
			(flagConfig.type || flagConfig.subType || flagConfig.regex || flagConfig.min || flagConfig.max)
			) {
			throw new Error('Flag must not have any validation attributes if it is an enum');
		}

		flagConfig.type = flagConfig.type || 'string';//default to string
		if (validTypes.indexOf(flagConfig.type) === -1) {
			throw new Error('Invalid argument to \'type\', \'' + flagConfig.type + '\' specified must be [' + validTypes.join(',') + ']');
		}

		flagConfig.subType = flagConfig.subType || 'string';//default to string
		if (flagConfig.type === 'array') {
			if (validSubTypes.indexOf(flagConfig.subType) === -1) {
				throw new Error('Invalid argument to \'type\', \'' + flagConfig.subType + '\' specified must be [' + validSubTypes.join(',') + ']');
			}
		}

		if (flagConfig.regex) {
			if (flagConfig.type === 'number' || flagConfig.type === 'integer') {
				throw new Error('Cannot use \'regex\' when type is \'' + flagConfig.type + '\'');
			}
			if (typeof flagConfig.regex === 'string') {
				flagConfig.regex = new RegExp(flagConfig.regex);//Error is propagated
			} else if (!(flagConfig.regex instanceof RegExp)) {
				throw new Error('Invalid argument to \'regex\', must be either a RegExp or compilable string');
			}
		}

		if (flagConfig.min && typeof flagConfig.min !== 'number') {
			throw new Error('Invalid argument to \'min\', must be a number');
		}

		if (flagConfig.max && typeof flagConfig.max !== 'number') {
			throw new Error('Invalid argument to \'max\', must be a number');
		}

		if (flagConfig.filter && typeof flagConfig.filter !== 'function') {
			throw new Error('Invalid argument to \'filter\', must be a function');
		}

		if (flagConfig.validator && typeof flagConfig.validator !== 'function') {
			throw new Error('Invalid argument to \'validator\', must be a function');
		}

		if (flagConfig.short) {
			if (typeof flagConfig.short !== 'string') {
				throw new Error('Invalid argument to \'short\', must be a string');
			}

			if (!shortRegex.test(flagConfig.short)) {
				throw new Error('Invalid argument to \'short\', string must match /^\\w$/');
			}
			if(this.shortFlags[flagConfig.short]) {
				throw new Error('Dublicate short flag ' + flagConfig.short);
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
			return true;
		case 'integer':
			if (value.toString().indexOf('.') > -1) {
				throw new Error('Argument for \'' + flag + '\' must be an integer value');
			}
			value = parseInt(value);
			/* falls through */
		case 'number':

			value = parseFloat(value);

			if (!isFinite(value)) {

				throw new Error('Could not parse number from argument for \'' + flag + '\'');
			}
			if (entry.min && value < entry.min) {
				throw new Error('Argument for \'' + flag + '\' must be greater or equal to ' + entry.min);
			}

			if (entry.max && value > entry.max) {
				throw new Error('Argument for \'' + flag + '\' must be less or equal to ' + entry.min);
			}
			return value;
		case 'string'://heh
			if (entry.regex && !entry.regex.test(value)) {
				throw new Error('Argument for \'' + flag + '\' did not match the regular expression ' + entry.regex.source);
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
						throw new Error('Could not parse json from file ' + path);
					}
				}
				if (entry.file.stream) {
					try {
						return fs.createReadStream(path)
						.on('error', function(error) {
							if (error.errno === 34) {
								throw new Error('Could not open file ' + path);
							}
							throw error;
						});
					} catch (e) {
						throw new Error('Could not open file ' + path);
					}
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

	if (!value && entry.default) {
		value = entry.default;
	}

	if (value && typeof value === 'string' || typeof value === 'array') {
		value = trimQuotes(value);
	}

	if (entry.enum && entry.enum.indexOf(value) === -1) {
		throw new Error('Invalid enum value for \'' + flag + '\' must be in [' + entry.enum.join(',') + ']');
	}

	value = handleType(entry, value, flag);

	if (entry.validator) {
		try {
			var validated = entry.validator(value);
			if (validated !== undefined) {
				value = validated;
			}
		} catch (error) {
			throw new Error('Validator failed for argument for \'' + flag + '\', \'' + error.message + '\'');
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
	if(curr.isShort) {
		name = this.shortFlags[name];
	}

	var entry = this.config[name];
	if (!entry) {
		throw new Error('Unknown flag \'' + name + '\'');
	}
	if (this.values[curr.value]) {
		throw new Error('Dublicate flag \'' + name + '\'');
	}
	if (entry.required && next.isFlag) {
		throw new Error('Flag \'' + name + '\' requires a value');
	}
	this.values[name] = this.handleValue(entry, next && next.value, name);
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
		default:		conf.default ? conf.default : '',
		required:		conf.required === true,
		description:	conf.description || ''
	};
};

function arrayMax(arr) {
  return Math.max.apply(null, arr);
}

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
		max[attribute] = arrayMax(_.map(helpInfos, function(helpInfo) {
			return helpInfo[attribute].toString().length + 1;
		}));
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
			throw new Error('Unhandled value ' + curr.value);
		} else if(!curr.isFlag && !next && (!split[index - 1] || (split[index - 1] && !split[index - 1].isFlag))) {
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
				throw new Error('Flag \'' + k + '\' is required but was not set');
			}
			else if (v.default) {
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
	return this.parse(process.argv.slice(2).join(' '));
};

module.exports = ArgumentParser;
