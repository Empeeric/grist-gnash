var Code = module.exports = function (code, scope) {
	if (!(this instanceof Code)) return new Code(code, scope);
	with (scope || {}) {
		this.fun = eval('(' + code + ')');
	}
};