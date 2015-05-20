'use strict';

var fs = require('fs');
var _ = require('lodash');
var util = require('util');
var esprintf = require('esprintf');

var cmdLineRegex = /(?:(--?)([\w_][\w_-]*))|((:?["'].*?["']|[^"',=\s]+)(?:,(?:["'].*?["']|[^'',\s]+))*)/ig;

/**
 * Trims quotes off the passed string.
 * @param  {string} str
 * @return {string}
 */
function trimQuotes(str) {
	return str.replace(/^'(.*?)'$/, '$1');
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
	_.forEach(this.config, function(v, switchName, o) {
		if (!flagRegex.test(switchName)) {
			throw new Error('Invalid switch ' + switchName + ', long switches must match /^[\\w_][\\w_-]*$/');
		}

		if (v.required && v.default) {
			throw new Error('Flag value cannot be required and have a default');
		}

		if (v.enum && (v.type || v.subType || v.regex || v.min || v.max || v.validator || v.short)) {
			throw new Error('Flag must not have any validation attributes if it is an enum');
		}

		v.type = v.type || 'string';//default to string
		if (validTypes.indexOf(v.type) === -1) {
			throw new Error('Invalid argument to \'type\', \'' + v.type + '\' specified must be [' + validTypes.join(',') + ']');
		}

		v.subType = v.subType || 'string';//default to string
		if (v.type === 'array') {
			if (validSubTypes.indexOf(v.subType) === -1) {
				throw new Error('Invalid argument to \'type\', \'' + v.subType + '\' specified must be [' + validSubTypes.join(',') + ']');
			}
		}

		if (v.regex) {
			if (v.type === 'number' || v.type === 'integer') {
				throw new Error('Cannot use \'regex\' when type is \'' + v.type + '\'');
			}
			if (typeof v.regex === 'string') {
				v.regex = new RegExp(v.regex);//Error is propagated
			}
			else if (!(v.regex instanceof RegExp)) {
				throw new Error('Invalid argument to \'regex\', must be either a RegExp or compilable string');
			}
		}

		if (v.min && typeof v.min !== 'number') {
			throw new Error('Invalid argument to \'min\', must be a number');
		}

		if (v.max && typeof v.max !== 'number') {
			throw new Error('Invalid argument to \'max\', must be a number');
		}

		if (v.filter && typeof v.filter !== 'function') {
			throw new Error('Invalid argument to \'filter\', must be a function');
		}

		if (v.validator && typeof v.validator !== 'function') {
			throw new Error('Invalid argument to \'validator\', must be a function');
		}

		if (v.short) {
			if (typeof v.short !== 'string') {
				throw new Error('Invalid argument to \'short\', must be a string');
			}

			if (!shortRegex.test(v.short)) {
				throw new Error('Invalid argument to \'short\', string must match /^\\w$/');
			}

			this.config[v.short] = v;
		}
	}, this);
	this.values = {};
}

var p = ArgumentParser.prototype;

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

/**
 * Handles the parsing and validation of a value
 * @private
 * @param  {Object} entry The corresponding switch config object for the switch.
 * @param  {string} value The raw string value associated with the switch
 * @param  {string} flag  The name of the flag
 * @return {*}
 */
p.handleValue = function(entry, value, flag) {

	if (!value && entry.default) {
		value = entry.default;
	}

	if (value && typeof value === 'string') {
		value = trimQuotes(value);
	}

	if (entry.enum && entry.enum.indexOf(value) === -1) {
		throw new Error('Invalid enum value for \'' + flag + '\' must be in [' + entry.enum.join(',') + ']');
	}

	switch (entry.type) {
		case 'boolean':
			value = true;
			break;
		case 'number':
		case 'integer':
			value = (entry.type === 'number' ? parseFloat : parseInt)(value);
			if (!isFinite(value)) {
				throw new Error('Could not parse number from argument for \'' + flag + '\'');
			}
			if (entry.min && value < entry.min) {
				throw new Error('Argument for \'' + flag + '\' must be greater or equal to ' + entry.min);
			}

			if (entry.max && value > entry.max) {
				throw new Error('Argument for \'' + flag + '\' must be less or equal to ' + entry.min);
			}
			break;
		case 'string'://heh
			if (entry.regex && !entry.regex.test(value)) {
				throw new Error('Argument for \'' + flag + '\' did not match the regular expression ' + entry.regex.source);
			}
			break;
		case 'array'://we are assuming all arguments in the array should be of a uniform type
			if (typeof value === 'string') {
				value = value.split(',');
			}
			value = value.map(function(value, index, arr) {
				value = trimQuotes(value);
				if (entry.regex && !entry.regex.test(value)) {
					throw new Error(
						util.format(
							'Member \'%s\' of argument for \'%s\' did not match the regular expression %s',
							value,
							flag,
							entry.regex.source
						)
					);
				}
				switch (entry.subType) {
					case 'integer':
						value = (entry.subType === 'number' ? parseFloat : parseInt)(value);
						if (!isFinite(value)) {
							throw new Error('Could not parse number from member \'' + value + '\' of argument for \'' + flag + '\'');
						}

						if (entry.min && value < entry.min) {
							throw new Error(
								util.format(
									'Member \'%s\' of argument for \'%s\' must be greater or equal than %s',
									value,
									flag,
									entry.min
								)
							);
						}

						if (entry.max && value > entry.max) {
							throw new Error(
								util.format(
									'Member \'%s\' of argument for \'%s\' must be less or equal than %s',
									value,
									flag,
									entry.max
								)
							);
						}
				}
				return value;
			});
			break;
		case 'file':
			var path = value;
			if (entry.file.json) {
				var data = fs.readFileSync(path, entry.file.json ? 'utf8' : entry.encoding);
				try {
					value = JSON.parse(data);

				} catch (error) {
					throw new Error('Could not parse json from file ' + path);
				}
			}
			if (entry.stream) {
				try {
					value = fs.createReadStream(path)
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
	var validatorResult;
	if (
		entry.validator &&
		(validatorResult = entry.validator(value)) &&
		((typeof validatorResult === 'object' && validatorResult.error) || validatorResult === false)
	) {
		throw new Error('Validator failed for argument for \'' + flag + '\', \'' + validatorResult.error + '\'');
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
	var entry = this.config[curr.value];
	if (!entry) {
		throw new Error('Unknown flag \'' + curr.value + '\'');
	}
	if (this.values[curr.value]) {
		throw new Error('Dublicate flag \'' + curr.value + '\'');
	}
	if (!curr.isShort) {
		if (entry.required && next.isFlag) {
			throw new Error('Flag \'' + curr.value + '\' requires a value');
		}
		return this.handleValue(entry, next && next.value, curr.value);
	}
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
		name:			flagName,
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

	_.sortBy(helpInfos, 'name');

	var max = {};

	helpInfos.push({//take header size into account
		name:			'Name',
		type:			'Type',
		default:		'Default',
		required:		'Required',
		description:	'Description'
	});

	_.forEach(['name', 'type', 'default', 'required', 'description'], function(attribute) {
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
			max.name,
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
				info.name,
				max.name,
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
			console.log(this.getHelpString());
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
		if (!curr.isFlag) {
			throw new Error('Unhandled value ' + curr.value);
		}
		var val = self.handleFlag(curr, next);
		self.values[curr.value] = val;

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
