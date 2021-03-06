"use strict";
const _ = require('lodash-contrib');
const sift = require('sift');


function Updater(op) {
    this.hasAtomic = function () {
        return _.some(_.keys(op), function (k) { return k[0] == "$"; });
    };

    this.update = function ($doc, upsert) {
        if (op.$set)
            applySet($doc, op.$set);
        if (op.$unset)
            applyUnset($doc, op.$unset);
        if (op.$inc)
            applyInc($doc, op.$inc);
        if (op.$push)
            applyPush($doc, op.$push);
        if (op.$pushAll)
            applyPushAll($doc, op.$pushAll);
        if (op.$addToSet)
            applyAddToSet($doc, op.$addToSet);
        if (op.$pop)
            applyPop($doc, op.$pop);
        if (op.$pull)
            applyPull($doc, op.$pull);
        if (op.$pullAll)
            applyPullAll($doc, op.$pullAll);
        if (op.$rename)
            applyRename($doc, op.$rename);
        if (upsert && op.$setOnInsert)
            applySet($doc, op.$setOnInsert);
    };
}


function ensurePath(obj, k, cb) {
    const path = k.split(".");
    let t = null;
    if (path.length == 1)
        t = obj;
    else {
        let l = obj;
        let i = 0;
        for (; i < path.length - 1; i++) {
            const p = path[i];
            if (!l[p])
                l[p] = {};
            l = l[p];
        }
        t = l;
        k = path[i];
    }
    cb(t, k);
}

function applySet(obj, $set) {
    _.each($set, function (v, k) {
        ensurePath(obj, k, function (t, k) {
            // do recursive apply for plain Objects
            if (_.isPlainObject(v)) {
                if (!t[k])
                    t[k] = {};
                applySet(t[k], v);
            }
            else
                t[k] = v;
        });
    });
}

function findDeepest(path, t) {
    let i = 0;
    //noinspection StatementWithEmptyBodyJS
    for (; i < path.length - 1 && t[path[i]]; t = t[path[i++]]);
    return [t, path[i]];
}
function applyUnset(obj, $set) {
    _.each($set, function (val, key) {
        const path = key.split(".");
        const pair = findDeepest(path, obj);
        const t = pair[0];
        const k = pair[1];
        if (!t || !t[k]) return;
        delete t[k];
    });
}

function applyInc(obj, $inc) {
    _.each($inc, function (v, k) {
        ensurePath(obj, k, function (t, k) {
            if (!t[k]) t[k] = 0;
            if (!_.isFinite(t[k]))
                throw new Error("Cannot apply $inc modifier to non-number");
            t[k] += v;
        });
    });
}

function applyPush(obj, $push) {
    _.each($push, function (v, k) {
        ensurePath(obj, k, function (t, k) {
            if (!t[k]) {
                t[k] = v.$each ? v.$each : [v];
            } else {
                if (!_.isArray(t[k]))
                    throw new Error("Cannot apply $push/$pushAll modifier to non-array");

                if (v.$each) {
                    _.each(v.$each, function (elem) {
                        t[k].push(elem);
                    });
                } else
                    t[k].push(v);
            }
        });
    });
}

function applyPop(obj, $op) {
    _.each($op, function (v, key) {
        const path = key.split(".");
        const pair = findDeepest(path, obj);
        const t = pair[0];
        const k = pair[1];
        if (!t || !t[k]) return;
        if (_.isArray(t[k])) {
            if (v === 1)
                t[k] = t[k].slice(0, -1);
            else if (v === -1)
                t[k] = t[k].slice(1);
            else throw new Error("Invalid $pop argument `" + v + "` for field `" + k + "`");
        } else throw new Error("Cannot apply $pop modifier to non-array");
    });
}

function applyPull(obj, $op) {
    _.each($op, function (v, key) {
        const path = key.split(".");
        const pair = findDeepest(path, obj);
        const t = pair[0];
        const k = pair[1];
        if (!t || !t[k]) return;
        if (!_.isArray(t[k]))
            throw new Error("Cannot apply $pull/$pullAll modifier to non-array");
        t[k] = _.difference(t[k], sift(v, t[k]));
    });
}

function applyPullAll(obj, $op) {
    _.each($op, function (v, key) {
        const path = key.split(".");
        const pair = findDeepest(path, obj);
        const t = pair[0];
        const k = pair[1];
        if (!t || !t[k]) return;
        if (_.isArray(t[k])) {
            t[k] = _.without.apply(_, _.union([t[k]], v));
        } else throw new Error("Cannot apply $pull/$pullAll modifier to non-array");
    });
}

function applyRename(obj, $op) {
    _.each($op, function (v, key) {
        const path = key.split(".");
        const pair = findDeepest(path, obj);
        const t = pair[0];
        const k = pair[1];
        if (!t || !t[k]) return;
        ensurePath(obj, v, function (t1, k1) {
            t1[k1] = t[k];
            delete t[k];
        });
    });
}

function applyAddToSet(obj, $op) {
    _.each($op, function (v, k) {
        ensurePath(obj, k, function (t, k) {
            if (!t[k]) {
                t[k] = v.$each ? v.$each : [v];
            } else {
                if (!_.isArray(t[k]))
                    throw new Error("Cannot apply $addToSet modifier to non-array");

                if (v.$each) {
                    _.each(v.$each, function (elem) {
                        if (_.indexOf(t[k], elem) == -1)
                            t[k].push(elem);
                    });
                } else {
                    if (_.indexOf(t[k], v) == -1)
                        t[k].push(v);
                }
            }
        });
    });
}

function applyPushAll(obj, $pushAll) {
    _.each($pushAll, function (v, k) {
        ensurePath(obj, k, function (t, k) {
            if (!t[k]) {
                t[k] = v;
            } else {
                if (!_.isArray(t[k]))
                    throw new Error("Cannot apply $push/$pushAll modifier to non-array");

                _.each(v, function (elem) {
                    t[k].push(elem);
                });
            }
        });
    });
}

module.exports = Updater;
