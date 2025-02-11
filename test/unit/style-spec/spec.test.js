import {test} from '../../util/test';

/* eslint-disable import/namespace */
import * as spec from '../../../rollup/build/tsc/style-spec/style-spec';

['v8', 'latest'].forEach((version) => {
    ['', 'min'].forEach((kind) => {
        const v = version + kind;
        test(v, (t) => {
            for (const k in spec[v]) {
                // Exception for version.
                if (k === '$version') {
                    t.equal(typeof spec[v].$version, 'number', '$version (number)');
                } else {
                    validSchema(k, t, spec[v][k], spec[v], version, kind);
                }
            }
            t.end();
        });
    });
});

test(`v8 Spec SDK Support section`, (t) => {
    const v = 'v8';
    const propObjs = [].concat(spec[v].paint).concat(spec[v].layout);
    propObjs.forEach((objKey) => {
        const props = spec[v][objKey];
        const propKeys = Object.keys(props);
        propKeys.forEach((key) => {
            t.ok(props[key]["sdk-support"], `${objKey}_${key} is missing sdk support section`);
            if (props[key]["sdk-support"]) {
                t.ok(props[key]["sdk-support"]["basic functionality"], `${objKey}_${key} is missing sdk support section for 'basic functionality'`);
                if (props[key]["property-type"].includes("constant")) {
                    t.notOk(props[key]["sdk-support"]["data-driven styling"], `${objKey}_${key} should not have sdk support section for 'data-driven styling'`);
                } else {
                    t.ok(props[key]["sdk-support"]["data-driven styling"], `${objKey}_${key} is missing sdk support section for 'data-driven styling'`);
                }
            }
        });
    });

    const expressions = spec[v].expression_name.values;
    const expressionNames = Object.keys(expressions);
    expressionNames.forEach((expr) => {
        t.ok(expressions[expr]["sdk-support"], `expression_${expr} is missing sdk support section`);
        if (expressions[expr]["sdk-support"]) {
            t.ok(expressions[expr]["sdk-support"]["basic functionality"], `expression_${expr} is missing sdk support section for 'basic functionality'`);
        }
    });
    t.end();
});
function validSchema(k, t, obj, ref, version, kind) {
    const scalar = ['boolean', 'string', 'number'];
    const types = Object.keys(ref).concat(['boolean', 'string', 'number',
        'array', 'enum', 'color', '*',
        // new in v8
        'opacity', 'translate-array', 'dash-array', 'offset-array', 'font-array', 'field-template',
        // new enums in v8
        'line-cap-enum',
        'line-join-enum',
        'symbol-placement-enum',
        'rotation-alignment-enum',
        'text-justify-enum',
        'text-anchor-enum',
        'text-transform-enum',
        'visibility-enum',
        'property-type',
        'formatted',
        'resolvedImage',
        'promoteId'
    ]);
    const keys = [
        'default',
        'doc',
        'example',
        'function',
        'zoom-function',
        'property-function',
        'function-output',
        'expression',
        'property-type',
        'length',
        'min-length',
        'required',
        'transition',
        'type',
        'value',
        'units',
        'tokens',
        'values',
        'maximum',
        'minimum',
        'period',
        'requires',
        'sdk-support',
        'overridable'
    ];

    // Schema object.
    if (Array.isArray(obj.type) || typeof obj.type === 'string') {
        // schema must have only known keys
        for (const attr in obj) {
            t.ok(keys.indexOf(attr) !== -1, `${k}.${attr} stray key`);
        }

        // schema type must be js native, 'color', or present in ref root object.
        t.ok(types.indexOf(obj.type) !== -1, `${k}.type (${obj.type})`);

        // schema type is an enum, it must have 'values' and they must be
        // objects (>=v8) or scalars (<=v7). If objects, check that doc key
        // (if present) is a string.
        if (obj.type === 'enum') {
            const values = (ref.$version >= 8 ? Object.keys(obj.values) : obj.values);
            t.ok(Array.isArray(values) && values.every((v) => {
                return scalar.indexOf(typeof v) !== -1;
            }), `${k}.values [${values}]`);
            if (ref.$version >= 8) {
                for (const v in obj.values) {
                    if (Array.isArray(obj.values) === false) { // skips $root.version
                        if (obj.values[v].doc !== undefined) {
                            t.equal('string', typeof obj.values[v].doc, `${k}.doc (string)`);
                            if (kind === 'min') t.fail(`minified file should not have ${k}.doc`);
                        } else if (t.name === 'latest') t.fail(`doc missing for ${k}`);
                    }
                }
            }
        }

        // schema type is array, it must have 'value' and it must be a type.
        if (obj.value !== undefined) {
            if (Array.isArray(obj.value)) {
                obj.value.forEach((i) => {
                    t.ok(types.indexOf(i) !== -1, `${k}.value (${i})`);
                });
            } else if (typeof obj.value === 'object') {
                validSchema(`${k}.value`, t, obj.value, ref);
            } else {
                t.ok(types.indexOf(obj.value) !== -1, `${k}.value (${obj.value})`);
            }
        }

        // schema key doc checks
        if (obj.doc !== undefined) {
            t.equal('string', typeof obj.doc, `${k}.doc (string)`);
            if (kind === 'min') t.fail(`minified file should not have ${k}.doc`);
        } else if (t.name === 'latest') t.fail(`doc missing for ${k}`);

        // schema key example checks
        if (kind === 'min' && obj.example !== undefined) {
            t.fail(`minified file should not have ${k}.example`);
        }

        // schema key function checks
        if (obj.function !== undefined) {
            t.ok(ref.$version < 8, 'migrated to `expression` schema in v8 spec');
            if (ref.$version >= 7) {
                t.equal(true, ['interpolated', 'piecewise-constant'].indexOf(obj.function) >= 0, `function: ${obj.function}`);
            } else {
                t.equal('boolean', typeof obj.function, `${k}.required (boolean)`);
            }
        } else if (obj.expression !== undefined) {
            const expression = obj.expression;
            t.ok(ref['property-type'][obj['property-type']], `${k}.expression: property-type: ${obj['property-type']}`);
            t.equal('boolean', typeof expression.interpolated, `${k}.expression.interpolated.required (boolean)`);
            t.equal(true, Array.isArray(expression.parameters), `${k}.expression.parameters array`);
            if (obj['property-type'] !== 'color-ramp') t.equal(true, expression.parameters.every(k => k === 'zoom' || k === 'feature' || k === 'feature-state'));
        }

        // schema key required checks
        if (obj.required !== undefined) {
            t.equal('boolean', typeof obj.required, `${k}.required (boolean)`);
        }

        // schema key transition checks
        if (obj.transition !== undefined) {
            t.equal('boolean', typeof obj.transition, `${k}.transition (boolean)`);
        }

        // schema key requires checks
        if (obj.requires !== undefined) {
            t.equal(true, Array.isArray(obj.requires), `${k}.requires (array)`);
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((child, j) => {
            if (typeof child === 'string' && scalar.indexOf(child) !== -1) return;
            validSchema(`${k}[${j}]`, t,  typeof child === 'string' ? ref[child] : child, ref);
        });
        // Container object.
    } else if (typeof obj === 'object') {
        for (const j in obj) validSchema(`${k}.${j}`, t, obj[j], ref);
        // Invalid ref object.
    } else {
        t.ok(false, `Invalid: ${k}`);
    }
}
