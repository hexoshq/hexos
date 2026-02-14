
/**
 * @description
 * Type guard predicate that filters out null and undefined values from arrays.
 *
 * Designed for use in `.filter()` operations where the resulting array should have
 * a narrowed type excluding nullable elements. The type predicate ensures TypeScript
 * correctly infers the filtered type.
 *
 * @param val - Value to check for null or undefined
 * @returns True if value is neither null nor undefined
 *
 * @example
 * ```typescript
 * const items: (string | null | undefined)[] = ['a', null, 'b', undefined];
 * const filtered: string[] = items.filter(notNullOrUndefined);
 * // => ['a', 'b'] with type string[]
 * ```
 *
 * @docsCategory utilities
 */
export function notNullOrUndefined<T>(val: T | undefined | null): val is T {
    return val !== undefined && val !== null;
}

/**
 * @description
 * Exhaustiveness check helper for discriminated union switch statements.
 *
 * Place in the `default` case of a switch over a discriminated union. If a new variant
 * is added to the union but not handled, TypeScript emits a compile-time error because
 * the value is no longer assignable to `never`. Always throws at runtime as a safety net.
 *
 * @param value - Value that should be of type `never` if all cases are handled
 * @returns Never returns; always throws
 * @throws {Error} Always throws with type and value information
 *
 * @example
 * ```typescript
 * type Status = 'pending' | 'completed' | 'error';
 * function handle(s: Status) {
 *   switch (s) {
 *     case 'pending': return 'waiting';
 *     case 'completed': return 'done';
 *     case 'error': return 'failed';
 *     default: return assertNever(s);
 *   }
 * }
 * ```
 *
 * @docsCategory utilities
 */
export function assertNever(value: never): never {
    throw new Error(`Expected never, got ${typeof value} (${JSON.stringify(value)})`);
}

/**
 * @description
 * Type guard that checks whether a value is a plain object (not an array or primitive).
 *
 * Returns true for objects created via `{}`, `Object.create()`, or `new Object()`.
 * Returns false for arrays, null, undefined, and primitive values.
 *
 * @param item - Value to check
 * @returns True if value is a non-array object
 *
 * @docsCategory utilities
 */
export function isObject(item: any): item is object {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * @description
 * Detects whether a value is an instance of a custom class (not a plain object).
 *
 * Distinguishes between plain objects (`{}`) and class instances by checking if the
 * constructor name differs from `'Object'`. Handles null-prototype objects safely
 * (created via `Object.create(null)`).
 *
 * Uses {@link isObject} internally to first confirm the value is an object.
 *
 * @param item - Value to check
 * @returns True if value is a class instance, false for plain objects or non-objects
 *
 * @docsCategory utilities
 */
export function isClassInstance(item: any): boolean {
    // Even if item is an object, it might not have a constructor as in the
    // case when it is a null-prototype object, i.e. created using `Object.create(null)`.
    return isObject(item) && item.constructor && item.constructor.name !== 'Object';
}

type NumericPropsOf<T> = {
    [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

// homomorphic helper type
// From https://stackoverflow.com/a/56140392/772859
type NPO<T, KT extends keyof T> = {
    [K in KT]: T[K] extends string | number | boolean
        ? T[K]
        : T[K] extends Array<infer A>
        ? Array<OnlyNumerics<A>>
        : OnlyNumerics<T[K]>;
};

// quick abort if T is a function or primitive
// otherwise pass to a homomorphic helper type
type OnlyNumerics<T> = NPO<T, NumericPropsOf<T>>;

/**
 * @description
 * Sums a numeric property across an array of objects in a type-safe manner.
 *
 * Only accepts properties that are of type `number`, enforced at the type level via
 * the `OnlyNumerics` mapped type. Handles null and undefined arrays gracefully by
 * treating them as empty.
 *
 * @param items - Array of objects (or null/undefined)
 * @param prop - Key of a numeric property to sum
 * @returns Sum of the specified property across all items
 *
 * @example
 * ```typescript
 * const orders = [{ total: 10 }, { total: 25 }, { total: 5 }];
 * summate(orders, 'total'); // => 40
 * ```
 *
 * @docsCategory utilities
 */
export function summate<T extends OnlyNumerics<T>>(
    items: T[] | undefined | null,
    prop: keyof OnlyNumerics<T>,
): number {
    return (items || []).reduce((sum, i) => sum + (i[prop] as unknown as number), 0);
}

/**
 * @description
 * Computes the Cartesian product of multiple option groups, returning all possible combinations.
 *
 * Takes an array of arrays (option groups) and produces every combination by selecting one
 * element from each group. Empty groups are filtered out before processing. Uses recursive
 * accumulation to build combinations.
 *
 * @param optionGroups - Array of option arrays to combine
 * @param combination - Internal accumulator (do not pass externally)
 * @param k - Internal index (do not pass externally)
 * @param output - Internal result accumulator (do not pass externally)
 * @returns Array of all possible combinations
 *
 * @example
 * ```typescript
 * generateAllCombinations([['red', 'blue'], ['small', 'large']]);
 * // => [['red', 'small'], ['red', 'large'], ['blue', 'small'], ['blue', 'large']]
 * ```
 *
 * @docsCategory utilities
 */
export function generateAllCombinations<T>(
    optionGroups: T[][],
    combination: T[] = [],
    k: number = 0,
    output: T[][] = [],
): T[][] {
    if (k === 0) {
        optionGroups = optionGroups.filter(g => 0 < g.length);
    }
    if (k === optionGroups.length) {
        output.push(combination);
        return [];
    } else {
        /* eslint-disable @typescript-eslint/prefer-for-of */
        for (let i = 0; i < optionGroups[k].length; i++) {
            generateAllCombinations(optionGroups, combination.concat(optionGroups[k][i]), k + 1, output);
        }
        /* eslint-enable @typescript-eslint/prefer-for-of */
        return output;
    }
}

/**
 * @description
 * Resolves the GraphQL input field name for a given field configuration.
 *
 * Relation-type fields receive a suffix: `Id` for single relations and `Ids` for list
 * relations. Non-relation fields return their name unchanged. This convention aligns
 * with common GraphQL input patterns where relation fields reference IDs rather than
 * full objects.
 *
 * @param config - Field configuration with name, type, and optional list flag
 * @returns The resolved input field name
 *
 * @example
 * ```typescript
 * getGraphQlInputName({ name: 'author', type: 'relation' });       // => 'authorId'
 * getGraphQlInputName({ name: 'tags', type: 'relation', list: true }); // => 'tagIds'
 * getGraphQlInputName({ name: 'title', type: 'string' });          // => 'title'
 * ```
 *
 * @docsCategory utilities
 */
export function getGraphQlInputName(config: { name: string; type: string; list?: boolean }): string {
    if (config.type === 'relation') {
        return config.list === true ? `${config.name}Ids` : `${config.name}Id`;
    } else {
        return config.name;
    }
}
